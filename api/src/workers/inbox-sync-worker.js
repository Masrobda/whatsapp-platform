// src/workers/inbox-sync-worker.js
const { query } = require('../config/database');
const { processIncomingMessage } = require('../services/inbox.service');
const logger = require('../utils/logger');

class InboxSyncWorker {
  constructor() {
    this.isRunning = false;
    this.interval = null;
    this.intervalMs = 5000; // 5 secondes
  }

  /**
   * Trouve le client associé à un numéro de canal
   */
  async findClientId(channelPhoneNumber) {
    if (!channelPhoneNumber) return null;

    // Chercher dans whatsapp_numbers
    const result = await query(
      `SELECT wna.client_id
       FROM whatsapp_numbers wn
       JOIN whatsapp_number_assignments wna ON wna.number_id = wn.id
       WHERE wn.phone_number = $1 AND wn.is_active = true
       LIMIT 1`,
      [channelPhoneNumber]
    );

    if (result.rows[0]?.client_id) {
      return result.rows[0].client_id;
    }

    // Fallback: premier client actif
    const defaultClient = await query(
      `SELECT id FROM clients WHERE is_active = true LIMIT 1`
    );

    if (defaultClient.rows[0]) {
      logger.warn(`⚠️ Aucun client trouvé pour ${channelPhoneNumber}, utilisation du client par défaut: ${defaultClient.rows[0].id}`);
      return defaultClient.rows[0].id;
    }

    return null;
  }

  /**
   * Traite un lot de messages incoming non traités
   */
  async processPendingMessages() {
    if (this.isRunning) {
      logger.debug('Worker déjà en cours d\'exécution, skip');
      return;
    }

    this.isRunning = true;

    try {
      // Récupérer les messages non traités
      const result = await query(`
        SELECT
          id,
          message_id,
          wa_message_id,
          conversation_id,
          ticket_id,
          message_content,
          message_type,
          phone_number,
          sender_name,
          channel_phone,
          received_at,
          raw_payload,
          is_stop,
          processed,
          error
        FROM incoming_messages
        WHERE (processed IS NULL OR processed = false)
          AND (retry_count IS NULL OR retry_count < 3)
        ORDER BY received_at ASC
        LIMIT 50
      `);

      if (result.rows.length === 0) {
        return;
      }

      logger.info(`📥 Traitement de ${result.rows.length} messages incoming...`);

      for (const msg of result.rows) {
        let clientId = null;

        try {
          // 1. Déterminer le client_id
          clientId = await this.findClientId(msg.channel_phone);

          if (!clientId) {
            logger.error(`❌ Impossible de trouver un client pour le message ${msg.id}`);
            await this.markAsFailed(msg.id, 'Aucun client trouvé');
            continue;
          }

          // 2. Extraire le channel_phone du raw_payload si nécessaire
          let channelPhone = msg.channel_phone;
          if (!channelPhone && msg.raw_payload) {
            channelPhone = msg.raw_payload.channelPhoneNumber || msg.raw_payload.channel_phone;
          }
          if (!channelPhone) {
            channelPhone = '+237689588347'; // Valeur par défaut
          }

          // 3. Appeler processIncomingMessage
          const conv = await processIncomingMessage({
            fromNumber: msg.phone_number,
            messageText: msg.message_content,
            messageType: msg.message_type || 'text',
            senderName: msg.sender_name,
            channelPhone: channelPhone,
            waMessageId: msg.wa_message_id,
            receivedAt: msg.received_at
          }, clientId);

          // 4. Marquer comme traité avec succès
          await this.markAsProcessed(msg.id, conv?.id);

          logger.info(`✅ Message ${msg.id} traité vers conversation ${conv?.id}`);

        } catch (err) {
          logger.error(`❌ Erreur traitement message ${msg.id}:`, err);
          await this.markAsFailed(msg.id, err.message);
        }
      }

    } catch (err) {
      logger.error('❌ Erreur dans processPendingMessages:', err);
    } finally {
      this.isRunning = false;
    }
  }

  /**
   * Marque un message comme traité avec succès
   */
  async markAsProcessed(messageId, conversationId) {
    await query(
      `UPDATE incoming_messages
       SET processed = true,
           processed_at = NOW(),
           conversation_id = $2,
           error = NULL
       WHERE id = $1`,
      [messageId, conversationId]
    );
  }

  /**
   * Marque un message comme échoué
   */
  async markAsFailed(messageId, errorMessage) {
    const result = await query(
      `UPDATE incoming_messages
       SET retry_count = COALESCE(retry_count, 0) + 1,
           error = $2,
           last_error_at = NOW()
       WHERE id = $1
       RETURNING retry_count`,
      [messageId, errorMessage]
    );

    const retryCount = result.rows[0]?.retry_count || 0;

    // Après 3 échecs, marquer comme processed pour ne plus retenter
    if (retryCount >= 3) {
      await query(
        `UPDATE incoming_messages SET processed = true WHERE id = $1`,
        [messageId]
      );
      logger.warn(`⚠️ Message ${messageId} abandonné après 3 tentatives`);
    }
  }

  /**
   * Traite les messages STOP
   */
  async processStopMessages() {
    try {
      const result = await query(`
        SELECT id, phone_number, sender_name, channel_phone
        FROM incoming_messages
        WHERE is_stop = true
          AND stop_processed IS NULL
        LIMIT 10
      `);

      for (const msg of result.rows) {
        // Marquer le contact comme opt-out
        await query(
          `INSERT INTO opt_out_contacts (phone_number, source, metadata)
           VALUES ($1, 'wati', $2)
           ON CONFLICT (phone_number) DO UPDATE SET
             opt_out_at = NOW(),
             source = 'wati',
             metadata = EXCLUDED.metadata`,
          [msg.phone_number, JSON.stringify({ message_id: msg.id, channel: msg.channel_phone })]
        );

        await query(
          `UPDATE incoming_messages SET stop_processed = true WHERE id = $1`,
          [msg.id]
        );

        logger.info(`🚫 STOP traité pour ${msg.phone_number}`);
      }
    } catch (err) {
      logger.error('Erreur traitement STOP:', err);
    }
  }

  /**
   * Nettoie les vieux messages processed
   */
  async cleanOldMessages() {
    try {
      const result = await query(
        `DELETE FROM incoming_messages
         WHERE processed = true
           AND processed_at < NOW() - INTERVAL '30 days'
         RETURNING id`
      );

      if (result.rows.length > 0) {
        logger.info(`🧹 Nettoyage: ${result.rows.length} vieux messages supprimés`);
      }
    } catch (err) {
      logger.error('Erreur nettoyage:', err);
    }
  }

  /**
   * Démarre le worker
   */
  start() {
    if (this.interval) {
      logger.warn('Worker déjà démarré');
      return;
    }

    logger.info(`🚀 Démarrage du worker inbox-sync (intervalle: ${this.intervalMs}ms)`);

    // Exécution immédiate
    this.processPendingMessages();
    this.processStopMessages();

    // Planification
    this.interval = setInterval(() => {
      this.processPendingMessages();
      this.processStopMessages();
    }, this.intervalMs);

    // Nettoyage quotidien
    setInterval(() => {
      this.cleanOldMessages();
    }, 24 * 60 * 60 * 1000); // 24h
  }

  /**
   * Arrête le worker
   */
  stop() {
    if (this.interval) {
      clearInterval(this.interval);
      this.interval = null;
      logger.info('🛑 Worker inbox-sync arrêté');
    }
  }
}

// 🔥 INTÉGRATION DEMANDÉE
if (require.main === module) {
  const worker = new InboxSyncWorker();
  worker.start();
  console.log(`🚀 Worker inbox-sync démarré (PID: ${process.pid})`);
}

// Exporte la classe pour d'éventuels requires
module.exports = InboxSyncWorker;
