// src/workers/session.worker.js
//
// Worker INDÉPENDANT du worker d'envoi de messages (whatsapp.worker.universal.js).
// Rôle unique : maintenir à jour le statut des sessions WhatsApp de 24h.
//
// À lancer comme process séparé, par exemple avec PM2 :
//   pm2 start src/workers/session.worker.js --name session-worker
//
// Un crash ou redémarrage de ce worker n'affecte JAMAIS l'envoi des
// messages en cours sur les queues par numéro WhatsApp.

const { Worker, Queue } = require('bullmq');
const { redisConnection } = require('../config/redis');
const sessionService = require('../services/session.service');
const logger = require('../utils/logger');

const QUEUE_NAME = 'session-maintenance';

const sessionQueue = new Queue(QUEUE_NAME, { connection: redisConnection });

// ============================================================
// PROGRAMMATION DU JOB RÉPÉTABLE (toutes les 5 minutes)
// ============================================================
async function scheduleRepeatableJobs() {
  await sessionQueue.add(
    'expire-sessions',
    {},
    {
      repeat: { every: 5 * 60 * 1000 }, // 5 minutes
      jobId: 'expire-sessions-cron',    // évite les doublons de job répétable
    }
  );
  logger.info(`🚀 [SESSION-WORKER] Job répétable "expire-sessions" programmé (toutes les 5 min)`);
}

// ============================================================
// TRAITEMENT DES JOBS
// ============================================================
async function processJob(job) {
  const start = Date.now();

  switch (job.name) {
    case 'expire-sessions': {
      const totalExpired = await sessionService.expireSessionsBatch();
      const duration = Date.now() - start;
      if (totalExpired > 0) {
        logger.info(`[SESSION-WORKER] ✅ ${totalExpired} session(s) expirée(s) en ${duration}ms`);
      } else {
        logger.debug(`[SESSION-WORKER] Aucune session à expirer (${duration}ms)`);
      }
      return { expired: totalExpired, duration };
    }

    default:
      logger.warn(`[SESSION-WORKER] Job inconnu ignoré: ${job.name}`);
      return { skipped: true };
  }
}

// ============================================================
// WORKER
// ============================================================
const worker = new Worker(QUEUE_NAME, processJob, {
  connection: redisConnection,
  concurrency: 1, // un seul job de maintenance à la fois, pas de compétition inutile
  removeOnComplete: { age: 3600, count: 100 },
  removeOnFail: { age: 86400, count: 200 },
});

worker.on('completed', (job, result) => {
  logger.debug(`[SESSION-WORKER] Job "${job.name}" terminé:`, result);
});

worker.on('failed', (job, err) => {
  logger.error(`[SESSION-WORKER] Job "${job?.name}" échoué:`, err.message);
});

worker.on('error', (err) => {
  logger.error('[SESSION-WORKER] Erreur worker:', err.message);
});

// ============================================================
// DÉMARRAGE
// ============================================================
async function start() {
  try {
    await scheduleRepeatableJobs();
    logger.info('🚀 [SESSION-WORKER] Worker de maintenance des sessions démarré (process indépendant)');
  } catch (err) {
    logger.error('❌ [SESSION-WORKER] Erreur au démarrage:', err.message);
    process.exit(1);
  }
}

start();

// ============================================================
// ARRÊT GRACIEUX
// ============================================================
async function shutdown(signal) {
  logger.info(`🛑 [SESSION-WORKER][${signal}] Arrêt gracieux...`);
  await worker.close();
  await sessionQueue.close();
  process.exit(0);
}

process.on('SIGTERM', () => shutdown('SIGTERM'));
process.on('SIGINT', () => shutdown('SIGINT'));

module.exports = { worker, sessionQueue };
