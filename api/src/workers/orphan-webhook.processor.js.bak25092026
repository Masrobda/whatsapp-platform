const { query } = require('../config/database');
const logger = require('../utils/logger');

async function processOrphanWebhooks() {
  logger.info('🔄 Début traitement webhooks orphelins');

  const orphans = await query(
    `SELECT id, local_message_id, whatsapp_message_id, event_type,
            sent_at, delivered_at, read_at, failed_at
     FROM orphan_webhooks
     WHERE processed = false
     ORDER BY created_at ASC
     LIMIT 100`
  );

  for (const orphan of orphans.rows) {
    try {
      let message = null;

      // 1. wati_local_id (cast UUID→text)
if (orphan.local_message_id) {
  const res = await query(
    `SELECT id, client_id, wa_status FROM messages 
     WHERE wati_local_id = $1::text LIMIT 1`,
    [orphan.local_message_id]
  );
  if (res.rows.length) message = res.rows[0];
}

// 2. wa_message_id avec local_message_id
if (!message && orphan.local_message_id) {
  const res = await query(
    `SELECT id, client_id, wa_status FROM messages 
     WHERE wa_message_id = $1::text LIMIT 1`,
    [orphan.local_message_id]
  );
  if (res.rows.length) message = res.rows[0];
}

// 3. wa_message_id avec whatsapp_message_id
if (!message && orphan.whatsapp_message_id) {
  const res = await query(
    `SELECT id, client_id, wa_status FROM messages 
     WHERE wa_message_id = $1 LIMIT 1`,
    [orphan.whatsapp_message_id]
  );
  if (res.rows.length) message = res.rows[0];
}

// 4. id::text (déjà un UUID, cast correct)
if (!message && orphan.local_message_id) {
  const res = await query(
    `SELECT id, client_id, wa_status FROM messages 
     WHERE id::text = $1::text LIMIT 1`,
    [orphan.local_message_id]
  );
  if (res.rows.length) message = res.rows[0];
}

      if (!message) {
        logger.warn(`Orphelin sans correspondance: localId=${orphan.local_message_id}`);
        continue;
      }

      let newStatus = null;
      let timestampField = null;
      let timestampValue = null;

      if (orphan.delivered_at) {
        newStatus = 'delivered';
        timestampField = 'delivered_at';
        timestampValue = orphan.delivered_at;
      } else if (orphan.read_at) {
        newStatus = 'read';
        timestampField = 'read_at';
        timestampValue = orphan.read_at;
      } else if (orphan.sent_at) {
        newStatus = 'sent';
        timestampField = 'sent_at';
        timestampValue = orphan.sent_at;
      } else if (orphan.failed_at) {
        newStatus = 'failed';
        timestampField = 'failed_at';
        timestampValue = orphan.failed_at;
      }

      if (!newStatus) continue;

      const currentStatus = message.wa_status;
      const statusOrder = { queued:0, sent:1, delivered:2, read:3, failed:4 };
      if (statusOrder[newStatus] > statusOrder[currentStatus] || newStatus === 'failed') {
        await query(
          `UPDATE messages SET wa_status = $1, ${timestampField} = $2 WHERE id = $3`,
          [newStatus, timestampValue, message.id]
        );
        const clientTable = `messages_client_${message.client_id.replace(/-/g, '_')}`;
        await query(
          `UPDATE ${clientTable} SET wa_status = $1, ${timestampField} = $2 WHERE id = $3`,
          [newStatus, timestampValue, message.id]
        );
        logger.info(`Orphelin traité: message ${message.id} -> ${newStatus}`);
      }

      await query(`UPDATE orphan_webhooks SET processed = true WHERE id = $1`, [orphan.id]);

    } catch (err) {
      logger.error(`Erreur traitement orphelin ${orphan.id}:`, err);
    }
  }

  logger.info(`✅ Traitement terminé: ${orphans.rows.length} orphelins analysés`);
}

module.exports = { processOrphanWebhooks };
