// src/services/campaign-dispatch.queue.js
// ============================================================
// Queue BullMQ dédiée au DISPATCH de campagne.
//
// Rôle : un seul type de job ("dispatch-campaign") qui pousse les
// contacts d'une campagne vers les queues d'envoi WATI existantes
// (whatsapp-messages-<numero>), par lots, avec un curseur persistant.
//
// Pourquoi une queue séparée plutôt qu'une boucle en mémoire :
//   - Le job survit aux redémarrages PM2 / crash / déploiement.
//   - BullMQ retente automatiquement en cas d'erreur (cf defaultJobOptions).
//   - On peut suivre la progression (job.progress) depuis le dashboard.
//   - On évite tout risque de double dispatch grâce à jobId = campaignId.
// ============================================================

const { Queue } = require('bullmq');
const { redisConnection } = require('../config/redis');
const logger = require('../utils/logger');

const QUEUE_NAME = 'campaign-dispatch';

const dispatchQueue = new Queue(QUEUE_NAME, {
  connection: redisConnection,
  defaultJobOptions: {
    attempts: 10,
    backoff: { type: 'exponential', delay: 10000 }, // 10s, 20s, 40s...
    removeOnComplete: { age: 86400, count: 500 },
    removeOnFail: { age: 604800, count: 1000 }, // garder 7 jours pour debug
  },
});

/**
 * Enfile (ou réutilise) le job de dispatch pour une campagne.
 * jobId = campaignId => garantit qu'une même campagne ne peut jamais
 * avoir deux jobs de dispatch actifs en parallèle (idempotent).
 */
async function enqueueCampaignDispatch(campaignId) {
  const job = await dispatchQueue.add(
    'dispatch-campaign',
    { campaignId },
    { jobId: `dispatch-${campaignId}` }
  );
  logger.info(`[DISPATCH-QUEUE] Job de dispatch enfilé pour campagne ${campaignId} (jobId=${job.id})`);
  return job;
}

/**
 * Récupère l'état du job de dispatch d'une campagne (pour l'API stats/debug).
 */
async function getDispatchJobStatus(campaignId) {
  const job = await dispatchQueue.getJob(`dispatch-${campaignId}`);
  if (!job) return { exists: false };

  const state = await job.getState();
  return {
    exists: true,
    state, // waiting | active | completed | failed | delayed
    progress: job.progress,
    attemptsMade: job.attemptsMade,
    failedReason: job.failedReason || null,
  };
}

/**
 * Annule un job de dispatch en attente ou actif (utilisé par cancelCampaign).
 * Si le job est déjà 'active', on ne peut pas le tuer instantanément (BullMQ
 * limitation), mais le worker vérifie le statut DB à chaque lot et s'arrêtera
 * de lui-même au prochain checkpoint (voir campaign.service.js).
 */
async function removeDispatchJob(campaignId) {
  const job = await dispatchQueue.getJob(`dispatch-${campaignId}`);
  if (!job) return false;

  const state = await job.getState();
  if (state === 'waiting' || state === 'delayed') {
    await job.remove();
    logger.info(`[DISPATCH-QUEUE] Job de dispatch supprimé (était ${state}) pour campagne ${campaignId}`);
    return true;
  }

  // Job actif : laissé tourner, il s'arrêtera au prochain checkpoint
  // car processCampaignDispatch relit le statut DB à chaque lot.
  logger.info(`[DISPATCH-QUEUE] Job actif pour ${campaignId}, arrêt différé au prochain checkpoint`);
  return false;
}

module.exports = {
  dispatchQueue,
  enqueueCampaignDispatch,
  getDispatchJobStatus,
  removeDispatchJob,
  QUEUE_NAME,
};
