// src/workers/chatbot.worker.js
'use strict';

const { Worker, Queue } = require('bullmq');
const { redisConnection } = require('../config/redis');
const logger = require('../utils/logger');
const chatbotService = require('../services/chatbot.service');
const watiService = require('../services/wati.service');
const sessionService = require('../services/session.service');

const QUEUE_NAME = 'bot-messages';
const CHATBOT_CLIENT_ID =
  process.env.CHATBOT_CLIENT_ID || 'ccd14b70-aa49-4906-8abc-5ff097e16107';
const WELCOME_TEMPLATE =
  process.env.DEFAULT_WELCOME_TEMPLATE_NAME || 'next_tmp_chatbot_v3';
const WELCOME_LANG =
  process.env.DEFAULT_WELCOME_TEMPLATE_LANGUAGE || 'fr';

const botQueue = new Queue(QUEUE_NAME, {
  connection: redisConnection,
  defaultJobOptions: {
    attempts: 2,
    backoff: { type: 'fixed', delay: 1500 },
    removeOnComplete: { age: 600, count: 300 },
    removeOnFail: { age: 3600, count: 500 },
  },
});

async function enqueueIncomingBotMessage({ phone, text, senderName, botNumber }) {
  const jobId = `bot_${phone}_${Date.now()}`;
  await botQueue.add(
    'process-message',
    { phone, text, senderName, botNumber },
    {
      jobId,
      priority: 1,
    }
  );
  logger.debug(`[BOT-WORKER] Job ajouté: ${jobId}`);
}

async function processJob(job) {
  const { phone, text, senderName, botNumber } = job.data;
  const start = Date.now();

  const { reply, requiresTemplate } = await chatbotService.processIncomingText({
    phone,
    text,
    senderName,
    botNumber,
  });

  if (!reply) {
    return { success: true, skipped: true };
  }

  // Après un message client, on privilégie TOUJOURS le texte libre.
  // requiresTemplate ne doit plus remplacer le contenu métier par le template.
  let sendResult = await watiService.sendTextMessage(phone, reply, botNumber);

  if (!sendResult?.success) {
    const err = String(sendResult?.error || sendResult?.message || '');
    const needTemplate = /ticket has been expired|closed|session|not allowed/i.test(err);

    if (needTemplate) {
      logger.info(`[BOT-WORKER] Ticket fermé → template puis reply ${phone}`);

      // 1) Rouvrir le ticket WATI
      const tpl = await watiService.sendTemplateMessage(
        phone,
        WELCOME_TEMPLATE,
        { name: senderName || 'Client' },
        WELCOME_LANG,
        botNumber
      );

      if (tpl?.success) {
        // 2) Renvoyer le VRAI message du bot (menu, étapes…)
        // Petit délai pour laisser WATI ouvrir le ticket
        await new Promise((r) => setTimeout(r, 800));
        sendResult = await watiService.sendTextMessage(phone, reply, botNumber);
      } else {
        sendResult = tpl;
      }
    }
  }

  if (!sendResult?.success) {
    throw new Error(sendResult?.error || 'Échec envoi réponse chatbot');
  }

  sessionService
    .openOrExtendSession({
      clientId: CHATBOT_CLIENT_ID,
      phone,
      channelNumber: botNumber,
    })
    .catch((err) => logger.warn('[BOT] session extend:', err.message));

  logger.info(`[BOT-WORKER] ${phone} traité en ${Date.now() - start}ms`);
  return { success: true, durationMs: Date.now() - start };
}

const worker = new Worker(QUEUE_NAME, processJob, {
  connection: redisConnection,
  concurrency: 50,
  lockDuration: 20000,
  // PAS de limiter max:10 — frein majeur
  removeOnComplete: { age: 600, count: 300 },
  removeOnFail: { age: 3600, count: 500 },
});

worker.on('completed', (job) =>
  logger.debug(`[BOT-WORKER] Job ${job.id} terminé`)
);
worker.on('failed', (job, err) =>
  logger.error(`[BOT-WORKER] Job ${job?.id} échoué:`, err.message)
);
worker.on('error', (err) =>
  logger.error('[BOT-WORKER] Erreur worker:', err.message)
);

logger.info('🚀 [BOT-WORKER] Worker chatbot optimisé démarré');

async function shutdown(signal) {
  logger.info(`🛑 [BOT-WORKER][${signal}] Arrêt gracieux...`);
  await worker.close();
  await botQueue.close();
  process.exit(0);
}
process.on('SIGTERM', () => shutdown('SIGTERM'));
process.on('SIGINT', () => shutdown('SIGINT'));

module.exports = { worker, botQueue, enqueueIncomingBotMessage };
