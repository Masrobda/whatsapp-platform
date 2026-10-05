// src/workers/webhook-retry.worker.js
const { query } = require('../config/database');
const logger = require('../utils/logger');
const watiWebhookController = require('../controllers/webhook/wati.webhook.controller');

async function processRetry() {
  try {
    // Récupérer les échecs à retenter (backoff exponentiel)
    const result = await query(
      `SELECT id, local_message_id, whatsapp_message_id, event_type, payload
       FROM webhook_failures
       WHERE processed = false
         AND next_retry_at <= NOW()
       ORDER BY next_retry_at ASC
       LIMIT 10
       FOR UPDATE SKIP LOCKED`
    );

    if (result.rows.length === 0) return;

    for (const row of result.rows) {
      try {
        // Rejouer le webhook
        const payload = row.payload;
        const eventType = row.event_type;
        let status = '';

        if (eventType.includes('DELIVERED')) status = 'delivered';
        else if (eventType.includes('READ')) status = 'read';
        else if (eventType.includes('SENT')) status = 'sent';
        else if (eventType.includes('FAILED')) status = 'failed';

        // Appeler la méthode de mise à jour (elle gère la recherche et la mise à jour)
        await watiWebhookController.updateMessageStatus(
          row.whatsapp_message_id,
          status,
          payload.timestamp,
          eventType,
          row.local_message_id
        );

        // Si la mise à jour a réussi (message trouvé), marquer comme processed
        await query(
          `UPDATE webhook_failures SET processed = true WHERE id = $1`,
          [row.id]
        );
        logger.info(`✅ Retry réussi pour webhook_failure ${row.id}`);

      } catch (error) {
        logger.error(`❌ Retry échoué pour webhook_failure ${row.id}:`, error);
        // Backoff exponentiel
        const retryCount = await getRetryCount(row.id);
        const nextDelay = Math.min(Math.pow(2, retryCount), 300); // max 300 secondes = 5 minutes
        await query(
          `UPDATE webhook_failures
           SET retry_count = retry_count + 1,
               next_retry_at = NOW() + ($1 || ' seconds')::INTERVAL
           WHERE id = $2`,
          [nextDelay, row.id]
        );
      }
    }
  } catch (err) {
    logger.error('Erreur dans webhook-retry worker:', err);
  }
}

async function getRetryCount(failureId) {
  const res = await query(`SELECT retry_count FROM webhook_failures WHERE id = $1`, [failureId]);
  return res.rows[0]?.retry_count || 0;
}

// Lancer en boucle toutes les 5 secondes
setInterval(processRetry, 5000);
logger.info('🚀 Webhook retry worker démarré (intervalle 5s)');

// Pour les arrêts propres
process.on('SIGTERM', () => process.exit(0));
