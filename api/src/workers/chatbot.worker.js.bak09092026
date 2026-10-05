// src/workers/chatbot.worker.js
//
// Worker INDÉPENDANT — queue dédiée `bot-messages`, séparée de :
//   - whatsapp-messages-{numero}  (envoi transactionnel/campagnes)
//   - session-maintenance         (expiration des sessions B2B 24h)
//
// Rôle : traiter les messages entrants adressés au numéro du chatbot
// consommateur (+237688359040), faire tourner le state machine, répondre.
//
// GESTION DES TICKETS WATI (24h) :
//   - Premier contact jamais vu : aucun ticket WATI n'existe → on envoie le
//     tout premier message via un TEMPLATE approuvé (DEFAULT_WELCOME_TEMPLATE_NAME),
//     jamais en texte libre (ça échouerait avec "Ticket has been expired.").
//   - Filet de sécurité : si un envoi en texte libre échoue quand même avec un
//     ticket expiré (ex: contact revenu après une longue absence), on renvoie
//     automatiquement le template de bienvenue pour rouvrir le ticket, puis on
//     retente le texte original une fois.
//
// Scalabilité : ce n'est PAS un serveur à connexions persistantes. Le débit
// se règle avec `concurrency` ci-dessous et, si besoin, en lançant plusieurs
// instances de ce même worker (PM2 `instances: N` en mode fork) — BullMQ
// répartit automatiquement les jobs de la queue `bot-messages` entre elles.

// src/workers/chatbot.worker.js
const { Worker, Queue } = require('bullmq');
const { redisConnection } = require('../config/redis');
const logger = require('../utils/logger');
const chatbotService = require('../services/chatbot.service');
const watiService = require('../services/wati.service');
const sessionService = require('../services/session.service'); // ← IMPORTANT

const QUEUE_NAME = 'bot-messages';
const CHATBOT_CLIENT_ID = process.env.CHATBOT_CLIENT_ID || 'ccd14b70-aa49-4906-8abc-5ff097e16107';

const botQueue = new Queue(QUEUE_NAME, {
  connection: redisConnection,
  defaultJobOptions: {
    attempts: 3,
    backoff: { type: 'exponential', delay: 3000 },
    removeOnComplete: { age: 1800, count: 500 },
    removeOnFail: { age: 43200, count: 1000 },
  },
});

async function enqueueIncomingBotMessage({ phone, text, senderName, botNumber }) {
  const jobId = `bot_${phone}_${Date.now()}`;
  await botQueue.add('process-message', { phone, text, senderName, botNumber }, { jobId });
  logger.debug(`[BOT-WORKER] Job ajouté: ${jobId}`);
}

async function processJob(job) {
  const { phone, text, senderName, botNumber } = job.data;
  const start = Date.now();

  // 1. Faire tourner le state machine pour obtenir la réponse
  const { reply } = await chatbotService.processIncomingText({ phone, text, senderName, botNumber });

  if (reply) {
    // 2. Vérifier si la session est active (sans l'ouvrir)
    const sessionActive = await sessionService.isSessionActive({
      clientId: CHATBOT_CLIENT_ID,
      phone: phone,
    });

    let sendResult;
    if (!sessionActive) {
      // Session inactive → envoyer le template approuvé
      const templateName = process.env.DEFAULT_WELCOME_TEMPLATE_NAME || 'next_tmp_chatbot_v3';
      const templateLang = process.env.DEFAULT_WELCOME_TEMPLATE_LANGUAGE || 'fr';
      const contactName = senderName || 'Client';

      sendResult = await watiService.sendTemplateMessage(
        phone,
        templateName,
        { name: contactName },
        templateLang,
        botNumber
      );
    } else {
      // Session active → envoi libre (texte)
      sendResult = await watiService.sendTextMessage(phone, reply, botNumber);
    }

    if (!sendResult?.success) {
      throw new Error(sendResult?.error || 'Échec envoi réponse chatbot');
    }

    // 3. Ouvrir/prolonger la session (après l'envoi, pour les prochains messages)
    await sessionService.openOrExtendSession({
      clientId: CHATBOT_CLIENT_ID,
      phone: phone,
      channelNumber: botNumber,
    }).catch(err => logger.warn('[BOT] Erreur ouverture session:', err.message));
  }

  logger.info(`[BOT-WORKER] ${phone} traité en ${Date.now() - start}ms`);
  return { success: true };
}

const worker = new Worker(QUEUE_NAME, processJob, {
  connection: redisConnection,
  concurrency: 200,
  lockDuration: 30000,
  removeOnComplete: { age: 1800, count: 500 },
  removeOnFail: { age: 43200, count: 1000 },
  limiter: { max: 10, duration: 1000 },
});

worker.on('completed', (job) => logger.debug(`[BOT-WORKER] Job ${job.id} terminé`));
worker.on('failed', (job, err) => logger.error(`[BOT-WORKER] Job ${job?.id} échoué:`, err.message));
worker.on('error', (err) => logger.error('[BOT-WORKER] Erreur worker:', err.message));

logger.info('🚀 [BOT-WORKER] Worker chatbot démarré');

async function shutdown(signal) {
  logger.info(`🛑 [BOT-WORKER][${signal}] Arrêt gracieux...`);
  await worker.close();
  await botQueue.close();
  process.exit(0);
}
process.on('SIGTERM', () => shutdown('SIGTERM'));
process.on('SIGINT', () => shutdown('SIGINT'));

module.exports = { worker, botQueue, enqueueIncomingBotMessage };
