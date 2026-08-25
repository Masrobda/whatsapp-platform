// ============================================================
// DIAGNOSTIC ET FIX : Envoi individuel avec PDF bloqué en queue
// ============================================================
//
// PROBLÈME IDENTIFIÉ :
// Dans queue.service.js, le job est ajouté avec jobId = messageId :
//   queue.add('send-message', jobData, { jobId: messageId })
//
// Si un ancien job avec le MÊME messageId existe déjà dans Redis
// (completed, failed, ou active), BullMQ IGNORE silencieusement
// le nouvel ajout → le message reste "queued" indéfiniment.
//
// FIX : Utiliser un jobId unique à chaque ajout pour éviter la déduplication.
// ============================================================

// ============================================================
// FICHIER 1 : src/services/queue.service.js
// Modification : jobId unique pour éviter la déduplication silencieuse
// ============================================================

// src/services/queue.service.js
const { Queue } = require('bullmq');
const { redisConnection } = require('../config/redis');
const { query } = require('../config/database');
const logger = require('../utils/logger');

const queues = new Map();

function normalizePhone(phone) {
  return phone.replace(/[^0-9]/g, '');
}

function getQueue(phoneNumber) {
  if (!phoneNumber) throw new Error('phoneNumber requis');
  const norm = normalizePhone(phoneNumber);
  const name = `whatsapp-messages-${norm}`;

  if (!queues.has(norm)) {
    const q = new Queue(name, {
      connection: redisConnection,
      defaultJobOptions: {
        attempts: 5,
        backoff: { type: 'exponential', delay: 5000 },
        removeOnComplete: { age: 1800, count: 200 },
        removeOnFail: { age: 43200, count: 1000 },
      }
    });
    queues.set(norm, q);
    logger.info(`Queue créée : ${name}`);
  }

  return queues.get(norm);
}

async function addMessageToQueue({ phoneNumber, messageId, ...data }) {
  if (!phoneNumber || !messageId) throw new Error('phoneNumber + messageId requis');

  logger.debug('🔍 [QUEUE] Réception données:', {
    messageId,
    phoneNumber,
    hasInvoiceData: !!data.invoice_data,
    invoiceData: data.invoice_data ? JSON.stringify(data.invoice_data) : 'null',
    isCampaign: !!data.is_campaign,
    messageType: data.message_type
  });

  const queue = getQueue(phoneNumber);

  const jobData = {
    ...data,
    phoneNumber,
    messageId,
    invoice_data: data.invoice_data || null
  };

  // ✅ FIX CRITIQUE : jobId unique = messageId + timestamp
  // Évite la déduplication silencieuse si un ancien job avec le même messageId
  // existe encore dans Redis (completed/failed non nettoyé)
  const jobId = `${messageId}_${Date.now()}`;

  const job = await queue.add('send-message', jobData, {
    jobId: jobId
  });

  logger.info(`✅ Job ajouté: jobId=${jobId}, queue=${queue.name}, messageId=${messageId}`);
  return { success: true, jobId: job.id, queueName: queue.name };
}

async function getStatsForNumber(phoneNumber) {
  try {
    const queue = getQueue(phoneNumber);
    const [waiting, active, failed, completed] = await Promise.all([
      queue.getWaitingCount(),
      queue.getActiveCount(),
      queue.getFailedCount(),
      queue.getCompletedCount(),
    ]);
    return {
      phone: phoneNumber,
      waiting,
      active,
      failed,
      completed,
      total: waiting + active + failed
    };
  } catch (err) {
    logger.error(`Erreur stats pour ${phoneNumber}`, err);
    return { phone: phoneNumber, error: err.message };
  }
}

async function getAllStats() {
  try {
    const res = await query(
      'SELECT phone_number FROM whatsapp_numbers WHERE is_active = true'
    );
    const stats = [];
    for (const { phone_number } of res.rows) {
      stats.push(await getStatsForNumber(phone_number));
    }
    return stats;
  } catch (err) {
    logger.error('Erreur getAllStats', err);
    throw err;
  }
}

async function pauseQueueForNumber(phoneNumber) {
  const queue = getQueue(phoneNumber);
  await queue.pause();
  logger.info(`Queue ${queue.name} mise en pause`);
  return { success: true };
}

async function resumeQueueForNumber(phoneNumber) {
  const queue = getQueue(phoneNumber);
  await queue.resume();
  logger.info(`Queue ${queue.name} reprise`);
  return { success: true };
}

async function retryAllFailedForPhone(phoneNumber) {
  try {
    const queue = getQueue(phoneNumber);
    const failedJobs = await queue.getFailed(0, -1);
    let count = 0;
    for (const job of failedJobs) {
      await job.retry();
      count++;
    }
    logger.info(`[RETRY] ${count} jobs relancés pour ${phoneNumber}`);
    return count;
  } catch (err) {
    logger.error(`Erreur retryAllFailedForPhone ${phoneNumber}:`, err);
    throw err;
  }
}

async function clearFailedForPhone(phoneNumber) {
  try {
    const queue = getQueue(phoneNumber);
    const cleaned = await queue.clean(0, 0, 'failed');
    const count = cleaned.length;
    logger.info(`[CLEAR] ${count} jobs supprimés pour ${phoneNumber}`);
    return count;
  } catch (err) {
    logger.error(`Erreur clearFailedForPhone ${phoneNumber}:`, err);
    throw err;
  }
}

async function numberExists(phoneNumber) {
  try {
    const res = await query(
      'SELECT 1 FROM whatsapp_numbers WHERE phone_number = $1 AND is_active = true',
      [phoneNumber]
    );
    return res.rowCount > 0;
  } catch (err) {
    logger.error(`Erreur numberExists ${phoneNumber}:`, err);
    return false;
  }
}

async function getAllQueues() {
  try {
    const res = await query(
      'SELECT phone_number FROM whatsapp_numbers WHERE is_active = true'
    );
    const queueList = [];
    for (const { phone_number } of res.rows) {
      try {
        const queue = getQueue(phone_number);
        queueList.push(queue);
      } catch (err) {
        logger.error(`Erreur récupération queue ${phone_number}:`, err);
      }
    }
    return queueList;
  } catch (err) {
    logger.error('Erreur getAllQueues:', err);
    return [];
  }
}

// ✅ Nettoyer les jobs complétés/échoués pour libérer Redis
async function cleanQueues() {
  try {
    const res = await query(
      'SELECT phone_number FROM whatsapp_numbers WHERE is_active = true'
    );
    let totalCleaned = 0;
    for (const { phone_number } of res.rows) {
      const queue = getQueue(phone_number);
      // Nettoyer les jobs complétés > 30 minutes
      const cleaned = await queue.clean(1800000, 100, 'completed');
      totalCleaned += cleaned.length;
    }
    if (totalCleaned > 0) {
      logger.info(`[CLEAN] ${totalCleaned} jobs complétés supprimés de Redis`);
    }
    return totalCleaned;
  } catch (err) {
    logger.error('Erreur cleanQueues:', err);
    return 0;
  }
}

module.exports = {
  getQueue,
  addMessageToQueue,
  getStatsForNumber,
  getAllStats,
  pauseQueueForNumber,
  resumeQueueForNumber,
  retryAllFailedForPhone,
  clearFailedForPhone,
  numberExists,
  getAllQueues,
  cleanQueues
};
