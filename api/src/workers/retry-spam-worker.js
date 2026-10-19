// src/workers/retry-spam-worker.js
const { query } = require('../config/database');
const logger = require('../utils/logger');
const axios = require('axios');

const RETRY_DELAY_HOURS = 24;   // ← 24h comme demandé (limites Meta)
const MAX_RETRY_COUNT = 5;
const BATCH_LIMIT = 20;         // un peu plus confortable

async function sendMessageViaAPI(payload, apiToken) {
  try {
    const response = await axios.post(
      'https://api.numericexport.com/api/v1/messages/send',
      payload,
      {
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${apiToken}`,
        },
        timeout: 30000,
      }
    );
    return { success: true, data: response.data };
  } catch (error) {
    const status = error.response?.status || 500;
    const message = error.response?.data?.message || error.message;
    logger.error(`[RETRY-WORKER] Erreur API: ${status} - ${message}`);
    return { success: false, error: message, status };
  }
}

async function processRetry() {
  const startTime = Date.now();
  console.log('[RETRY-WORKER] 🔄 Démarrage du traitement des retentatives...');
  logger.info('[RETRY-WORKER] 🔄 Démarrage du traitement des retentatives...');

  try {
    console.log(`[RETRY-WORKER] Paramètres: delay=${RETRY_DELAY_HOURS}h, maxRetry=${MAX_RETRY_COUNT}, limit=${BATCH_LIMIT}`);
    logger.info(`[RETRY-WORKER] Paramètres: delay=${RETRY_DELAY_HOURS}h, maxRetry=${MAX_RETRY_COUNT}, limit=${BATCH_LIMIT}`);

    const messages = await query(`
      SELECT
        m.id,
        m.client_id,
        m.recipient_phone,
        m.template_name,
        m.template_language,
        m.template_params,
        m.created_at,
        m.wati_local_id,
        m.wa_message_id,
        m.metadata,
        m.failed_at,
        sender.phone_number AS sender_phone,
        c.api_token
      FROM messages m
      JOIN clients c ON m.client_id = c.id
      LEFT JOIN LATERAL (
        SELECT wn.phone_number
        FROM whatsapp_number_assignments wna
        JOIN whatsapp_numbers wn ON wn.id = wna.number_id
        WHERE wna.client_id = c.id
          AND wn.is_active = true
        ORDER BY wna.is_primary DESC, wna.assigned_at ASC
        LIMIT 1
      ) sender ON true
      WHERE m.wa_status = 'failed'
        AND (
          m.wa_error_message ILIKE '%spam%'
          OR m.wa_error_message ILIKE '%rate limit%'
          OR m.wa_error_message ILIKE '%limit hit%'
        )
        AND (
          m.metadata IS NULL
          OR (m.metadata->>'retry_count') IS NULL
          OR (m.metadata->>'retry_count')::int < $1
        )
        AND (m.failed_at IS NULL OR m.failed_at < NOW() - INTERVAL '${RETRY_DELAY_HOURS} hours')
      ORDER BY m.failed_at ASC NULLS FIRST
      LIMIT $2
    `, [MAX_RETRY_COUNT, BATCH_LIMIT]);

    console.log(`[RETRY-WORKER] Nombre de messages trouvés: ${messages.rows.length}`);
    logger.info(`[RETRY-WORKER] Nombre de messages trouvés: ${messages.rows.length}`);

    if (messages.rows.length === 0) {
      console.log('[RETRY-WORKER] ℹ️ Aucun message à retenter.');
      logger.info('[RETRY-WORKER] ℹ️ Aucun message à retenter.');
      return;
    }

    const ids = messages.rows.map(m => m.id).join(', ');
    console.log(`[RETRY-WORKER] IDs concernés: ${ids}`);
    logger.info(`[RETRY-WORKER] IDs concernés: ${ids}`);

    let successCount = 0;
    let failureCount = 0;
    let skippedCount = 0;

    for (const msg of messages.rows) {
      const senderPhone = msg.sender_phone || process.env.DEFAULT_SENDER_PHONE;
      const apiToken = msg.api_token || process.env.DEFAULT_API_TOKEN;

      if (!senderPhone) {
        console.warn(`[RETRY-WORKER] ⚠️ Aucun numéro expéditeur pour client ${msg.client_id}, message ${msg.id}`);
        logger.warn(`[RETRY-WORKER] ⚠️ Aucun numéro expéditeur pour client ${msg.client_id}, message ${msg.id}`);
        skippedCount++;
        continue;
      }

      if (!apiToken) {
        console.warn(`[RETRY-WORKER] ⚠️ Aucun token pour client ${msg.client_id}, message ${msg.id}`);
        logger.warn(`[RETRY-WORKER] ⚠️ Aucun token pour client ${msg.client_id}, message ${msg.id}`);
        skippedCount++;
        continue;
      }

      try {
        // template_params peut être un objet ou une string JSON selon le driver
        let params = msg.template_params || {};
        if (typeof params === 'string') {
          try { params = JSON.parse(params); } catch (e) { params = {}; }
        }

        const payload = {
          phoneNumber: senderPhone,
          recipient_phone: msg.recipient_phone,
          message_type: 'template',
          template_name: msg.template_name,
          template_language: msg.template_language || 'fr',
          template_params: params,
        };

        // support invoice_data si présent dans metadata
        if (msg.metadata && msg.metadata.invoice_data) {
          payload.invoice_data = msg.metadata.invoice_data;
        }

        console.log(`[RETRY-WORKER] → Tentative envoi ${msg.id} → ${msg.recipient_phone} via ${senderPhone}`);
        const sendResult = await sendMessageViaAPI(payload, apiToken);

        const currentRetry = (msg.metadata && msg.metadata.retry_count) ? parseInt(msg.metadata.retry_count, 10) : 0;
        const newRetry = currentRetry + 1;

        if (sendResult.success) {
  let newMessageId = null;
  let waStatus = 'queued';
  const responseData = sendResult.data;

  if (Array.isArray(responseData) && responseData.length > 0 && responseData[0]?.data?.[0]) {
    newMessageId = responseData[0].data[0].message_id;
    waStatus = responseData[0].data[0].status || 'queued';
  } else if (responseData?.data?.message_id) {
    newMessageId = responseData.data.message_id;
    waStatus = responseData.data.status || 'queued';
  } else {
    waStatus = 'sent';
    newMessageId = `retry_${Date.now()}_${msg.id}`;
  }

  // On construit le JSON côté JS pour éviter le problème de type
  const metaUpdate = {
    retry_count: 0,
    last_retry_success: new Date().toISOString(),
    previous_failed_at: msg.failed_at || null
  };

  await query(`
    UPDATE messages
    SET wa_status = $1,
        wa_message_id = COALESCE($2, wa_message_id),
        wati_local_id = COALESCE($3, wati_local_id),
        sent_at = NOW(),
        failed_at = NULL,
        wa_error_message = NULL,
        metadata = COALESCE(metadata, '{}'::jsonb) || $6::jsonb
    WHERE id = $4 AND created_at = $5
  `, [
    waStatus,
    newMessageId,
    msg.wati_local_id || `retry_${Date.now()}`,
    msg.id,
    msg.created_at,
    JSON.stringify(metaUpdate)
  ]);

  successCount++;
  console.log(`[RETRY-WORKER] ✅ Message ${msg.id} retenté avec succès (${waStatus})`);
  logger.info(`[RETRY-WORKER] ✅ Message ${msg.id} retenté avec succès (${waStatus})`);


        } else {
          const errorMsg = sendResult.error || 'Unknown error';
          await query(`
            UPDATE messages
            SET wa_status = 'failed',
                failed_at = NOW(),
                wa_error_message = $1,
                metadata = COALESCE(metadata, '{}'::jsonb) || jsonb_build_object(
                  'retry_count', $2,
                  'last_retry_error', NOW(),
                  'last_retry_error_msg', $1
                )
            WHERE id = $3 AND created_at = $4
          `, [`Retry ${newRetry} failed: ${errorMsg}`, newRetry, msg.id, msg.created_at]);

          failureCount++;
          console.warn(`[RETRY-WORKER] ❌ Échec retentative ${msg.id} (tentative ${newRetry}/${MAX_RETRY_COUNT}): ${errorMsg}`);
          logger.warn(`[RETRY-WORKER] ❌ Échec retentative ${msg.id} (tentative ${newRetry}/${MAX_RETRY_COUNT}): ${errorMsg}`);
        }

        // petite pause pour ne pas spammer l’API
        await new Promise(resolve => setTimeout(resolve, 300));
      } catch (err) {
        console.error(`[RETRY-WORKER] ❌ Erreur traitement message ${msg.id}:`, err.message);
        logger.error(`[RETRY-WORKER] ❌ Erreur traitement message ${msg.id}:`, err.message);
        failureCount++;
      }
    }

    const elapsed = (Date.now() - startTime) / 1000;
    console.log(`[RETRY-WORKER] ✅ Terminé en ${elapsed.toFixed(2)}s. Succès: ${successCount}, Échecs: ${failureCount}, Ignorés: ${skippedCount}`);
    logger.info(`[RETRY-WORKER] ✅ Terminé en ${elapsed.toFixed(2)}s. Succès: ${successCount}, Échecs: ${failureCount}, Ignorés: ${skippedCount}`);
  } catch (error) {
    console.error('[RETRY-WORKER] ❌ Erreur globale:', error.message);
    logger.error('[RETRY-WORKER] ❌ Erreur globale:', error.message);
  }
}

// Mode cron / manuel
if (require.main === module) {
  processRetry()
    .then(() => {
      console.log('[RETRY-WORKER] Processus terminé proprement');
      process.exit(0);
    })
    .catch((err) => {
      console.error('[RETRY-WORKER] Erreur fatale:', err);
      logger.error('[RETRY-WORKER] Erreur fatale:', err);
      process.exit(1);
    });
}

module.exports = { processRetry };
