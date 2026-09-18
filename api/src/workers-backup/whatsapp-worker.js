// src/workers/whatsapp-worker.js
// Lancez avec : node src/workers/whatsapp-worker.js --phone=+237691234567
const { Worker } = require('bullmq');
const { redisConnection } = require('../config/redis');
const whatsappService = require('../services/whatsapp.service');
const { query } = require('../config/database');
const logger = require('../utils/logger');

const phoneArg = process.argv.find(a => a.startsWith('--phone='));
const phoneNumber = phoneArg ? phoneArg.split('=')[1] : null;

if (!phoneNumber) {
  console.error('Utilisation : node whatsapp-worker.js --phone=+237xxxxxxxxx');
  process.exit(1);
}

const queueName = `whatsapp-${phoneNumber.replace(/[^0-9]/g, '')}`;

logger.info(`Worker démarré pour ${phoneNumber} (queue: ${queueName})`);

const worker = new Worker(
  queueName,
  async (job) => {
    const { messageId, client_id, recipient_phone, message_type, message_content } = job.data;

    try {
      // Vérif quota rapide
      const quota = await query('SELECT quota_remaining FROM clients WHERE id = $1', [client_id]);
      if (quota.rows[0]?.quota_remaining <= 0) {
        throw new Error('Quota épuisé');
      }

      let result;
      if (message_type === 'text') {
        result = await whatsappService.sendTextMessage(recipient_phone, message_content);
      } else {
        throw new Error('Type non supporté');
      }

      if (!result.success) throw new Error(result.error || 'Échec');

      await query(
        'UPDATE messages SET wa_status = $1, wa_message_id = $2 WHERE id = $3',
        ['sent', result.messageId, messageId]
      );

      return { success: true };
    } catch (err) {
      await query(
        'UPDATE messages SET wa_status = $1, wa_error_message = $2 WHERE id = $3',
        ['failed', err.message, messageId]
      );
      throw err;
    }
  },
  {
    connection: redisConnection,
    concurrency: 1,
    limiter: { max: 5, duration: 1000 }
  }
);

worker.on('failed', (job, err) => {
  logger.error(`Job échoué ${job.id}`, err);
});

process.on('SIGTERM', async () => {
  await worker.close();
  process.exit(0);
});
