// src/workers/message.worker.js
const { Worker } = require('bullmq');
const { redisConnection } = require('../config/redis');
const { query } = require('../config/database');
const logger = require('../utils/logger');
const watiService = require('../services/wati.service');
const { canSendToRecipient, incrementClientStats } = require('../services/message.service');

/**
 * Processeur de message unique (compatible avec toutes les queues)
 */
async function processMessage(job) {
  const startTime = Date.now();
  const {
    messageId,
    client_id,
    recipient_phone,
    message_type,
    template_name,
    template_language,
    template_params,
    message_content,
    media_url,
    media_type,
    invoice_data,
    phoneNumber
  } = job.data;

  logger.info(`[WORKER] Traitement ${messageId} | Queue: ${job.queueName} | Tentative: ${job.attemptsMade + 1}`);

  try {
    // 1. Vérifier que le message est toujours en 'queued'
    const check = await query(
      `SELECT wa_status FROM messages WHERE id = $1`,
      [messageId]
    );
    
    if (check.rows.length === 0) {
      throw new Error(`Message ${messageId} non trouvé`);
    }
    
    if (check.rows[0].wa_status !== 'queued') {
      logger.info(`Message ${messageId} déjà traité (${check.rows[0].wa_status})`);
      return { success: true, skipped: true };
    }

    // 2. Vérifier cooldown
    const cooldownCheck = await canSendToRecipient(recipient_phone, client_id);
    if (!cooldownCheck.canSend) {
      const errorMsg = `Cooldown: ${cooldownCheck.reason}`;
      await query(
        `UPDATE messages SET wa_status = 'failed', wa_error_message = $1, failed_at = NOW() WHERE id = $2`,
        [errorMsg, messageId]
      );
      const clientTable = `messages_client_${client_id.replace(/-/g, '_')}`;
      await query(
        `UPDATE ${clientTable} SET wa_status = 'failed', wa_error_message = $1, failed_at = NOW() WHERE id = $2`,
        [errorMsg, messageId]
      );
      throw new Error(errorMsg);
    }

    // 3. Envoi WATI
    let result;
    switch (message_type) {
      case 'template':
        if (invoice_data?.pdfUrl) {
          result = await watiService.sendInvoiceWithPDF(recipient_phone, invoice_data);
        } else {
          result = await watiService.sendTemplateMessage(
            recipient_phone,
            template_name,
            template_params || {},
            template_language || 'fr'
          );
        }
        break;
      case 'text':
        result = await watiService.sendTextMessage(recipient_phone, message_content);
        break;
      case 'media':
        result = await watiService.sendMediaMessage(recipient_phone, media_url, media_type || 'image', message_content);
        break;
      default:
        throw new Error(`Type inconnu: ${message_type}`);
    }

    if (!result?.success) {
      throw new Error(result?.error || 'Échec WATI');
    }

    // 4. Mise à jour succès
    await query(
      `UPDATE messages SET wa_message_id = $1, wa_status = $2, sent_at = NOW() WHERE id = $3`,
      [result.messageId, 'sent', messageId]
    );
    
    const clientTable = `messages_client_${client_id.replace(/-/g, '_')}`;
    await query(
      `UPDATE ${clientTable} SET wa_message_id = $1, wa_status = $2, sent_at = NOW() WHERE id = $3`,
      [result.messageId, 'sent', messageId]
    );

    // 5. Stats
    await incrementClientStats(phoneNumber, client_id);

    const duration = Date.now() - startTime;
    logger.info(`[WORKER] Succès ${messageId} en ${duration}ms`);

    return { success: true, duration, watiId: result.messageId };

  } catch (error) {
    const duration = Date.now() - startTime;
    logger.error(`[WORKER] Échec ${messageId}: ${error.message}`);

    // Mise à jour erreur seulement si encore en 'queued'
    await query(
      `UPDATE messages SET wa_status = 'failed', wa_error_message = $1, failed_at = NOW() WHERE id = $2 AND wa_status = 'queued'`,
      [error.message.substring(0, 500), messageId]
    );

    throw error;
  }
}

/**
 * Initialise des workers pour TOUTES les queues dynamiques
 */
const workers = new Map();

async function initWorkers() {
  try {
    // Récupérer tous les numéros WhatsApp actifs
    const result = await query(
      `SELECT phone_number FROM whatsapp_numbers WHERE is_active = true`
    );
    
    const activePhones = result.rows.map(r => r.phone_number);
    logger.info(`[INIT] ${activePhones.length} numéros actifs trouvés`);
    
    for (const phone of activePhones) {
      const normalizedPhone = phone.replace(/[^0-9]/g, '');
      const queueName = `whatsapp-messages-${normalizedPhone}`;
      
      if (!workers.has(queueName)) {
        logger.info(`[INIT] Création worker pour queue: ${queueName}`);
        
        const worker = new Worker(queueName, processMessage, {
          connection: redisConnection,
          concurrency: 10,
          lockDuration: 60000,
          stalledInterval: 30000,
          removeOnComplete: { age: 3600, count: 1000 },
          removeOnFail: { age: 86400, count: 5000 },
          settings: {
            backoffStrategies: {
              exponential: (attemptsMade) => Math.min(Math.pow(2, attemptsMade) * 1000, 300000)
            }
          }
        });
        
        worker.on('completed', (job) => {
          logger.debug(`Job ${job.id} completed`);
        });
        
        worker.on('failed', (job, err) => {
          logger.error(`Job ${job?.id} failed: ${err?.message}`);
        });
        
        worker.on('error', (err) => {
          logger.error(`Worker error ${queueName}:`, err);
        });
        
        workers.set(queueName, worker);
      }
    }
    
    logger.info(`[INIT] ${workers.size} workers actifs`);
    
  } catch (error) {
    logger.error('[INIT] Erreur initialisation workers:', error);
  }
}

// Rafraîchir les workers toutes les 5 minutes (pour détecter nouveaux numéros)
setInterval(initWorkers, 300000);

// Nettoyage à l'arrêt
process.on('SIGTERM', async () => {
  logger.info('Arrêt des workers...');
  for (const [name, worker] of workers) {
    await worker.close();
  }
  process.exit(0);
});

// Démarrer
initWorkers();

module.exports = { processMessage, initWorkers };
