const queueService = require('../services/queue.service');
const logger = require('../utils/logger');

/**
 * Met en pause la file d'un numéro WhatsApp spécifique
 * @param {string} phone - Numéro de téléphone (ex: +237691234567)
 */
async function pauseQueue(phone) {
  try {
    logger.info(`[PAUSE] Demande de pause pour le numéro ${phone}`);

    // 1. Vérifier que le numéro existe dans whatsapp_numbers
    const numberExists = await queueService.numberExists(phone);
    if (!numberExists) {
      throw new Error(`Numéro ${phone} non trouvé dans whatsapp_numbers`);
    }

    // 2. Marquer la queue comme paused (exemple : flag Redis)
    await queueService.setPaused(phone, true);

    // 3. Optionnel : pause effective de la queue BullMQ si elle existe
    const queue = await queueService.getQueueForPhone(phone);
    if (queue) {
      await queue.pause();
      logger.info(`[PAUSE] Queue BullMQ pour ${phone} mise en pause`);
    }

    return { success: true, message: `File pour ${phone} mise en pause` };
  } catch (error) {
    logger.error(`[PAUSE ERROR] ${phone}:`, error);
    throw error;
  }
}

/**
 * Reprend la file d'un numéro WhatsApp spécifique
 * @param {string} phone - Numéro de téléphone
 */
async function resumeQueue(phone) {
  try {
    logger.info(`[RESUME] Demande de reprise pour le numéro ${phone}`);

    // 1. Vérifier existence
    const numberExists = await queueService.numberExists(phone);
    if (!numberExists) {
      throw new Error(`Numéro ${phone} non trouvé`);
    }

    // 2. Retirer le flag paused
    await queueService.setPaused(phone, false);

    // 3. Reprendre la queue BullMQ si elle existe
    const queue = await queueService.getQueueForPhone(phone);
    if (queue) {
      await queue.resume();
      logger.info(`[RESUME] Queue BullMQ pour ${phone} reprise`);
    }

    return { success: true, message: `File pour ${phone} reprise` };
  } catch (error) {
    logger.error(`[RESUME ERROR] ${phone}:`, error);
    throw error;
  }
}

/**
 * Réessaye TOUS les jobs échoués pour un numéro donné
 * @param {string} phone
 * @returns {Promise<number>} Nombre de jobs relancés
 */
async function retryAllFailedForPhone(phone) {
  try {
    logger.info(`[RETRY-ALL] Demande pour le numéro ${phone}`);

    let totalRetried = 0;

    // Récupérer la queue spécifique au numéro
    const queue = await queueService.getQueueForPhone(phone);
    if (!queue) {
      throw new Error(`Aucune queue trouvée pour ${phone}`);
    }

    // Récupérer tous les jobs failed
    const failedJobs = await queue.getFailed(0, -1); // -1 = tous

    for (const job of failedJobs) {
      await job.retry();
      totalRetried++;
      logger.debug(`[RETRY] Job ${job.id} relancé pour ${phone}`);
    }

    logger.info(`[RETRY-ALL] ${totalRetried} jobs relancés pour ${phone}`);
    return totalRetried;
  } catch (error) {
    logger.error(`[RETRY-ALL ERROR] ${phone}:`, error);
    throw error;
  }
}

/**
 * Supprime TOUS les jobs échoués pour un numéro donné
 * @param {string} phone
 * @returns {Promise<number>} Nombre de jobs supprimés
 */
async function clearFailedForPhone(phone) {
  try {
    logger.info(`[CLEAR-FAILED] Demande pour le numéro ${phone}`);

    let totalCleared = 0;

    const queue = await queueService.getQueueForPhone(phone);
    if (!queue) {
      throw new Error(`Aucune queue trouvée pour ${phone}`);
    }

    // Nettoyer tous les failed jobs
    const cleaned = await queue.clean(0, 0, 'failed');
    totalCleared = cleaned.length;

    logger.info(`[CLEAR-FAILED] ${totalCleared} jobs supprimés pour ${phone}`);
    return totalCleared;
  } catch (error) {
    logger.error(`[CLEAR-FAILED ERROR] ${phone}:`, error);
    throw error;
  }
}

/**
 * GET /api/v1/queue/stats
 * Statistiques globales des files d'attente
 */
async function getQueueStats(request, reply) {
  try {
    const stats = await queueService.getAllStats();
    return reply.send({
      success: true,
      stats
    });
  } catch (error) {
    logger.error('Erreur stats queue:', error);
    return reply.status(500).send({
      success: false,
      code: 'INTERNAL_ERROR',
      message: 'Erreur lors de la récupération des statistiques'
    });
  }
}

/**
 * GET /api/v1/queue/active
 * Jobs actifs (tous numéros confondus)
 */
async function getActiveJobs(request, reply) {
  try {
    const limit = parseInt(request.query.limit) || 10;
    const queues = await queueService.getAllQueues();
    const activeJobs = [];
    for (const queue of queues) {
      const jobs = await queue.getJobs(['active'], 0, limit);
      activeJobs.push(...jobs.map(job => ({
        id: job.id,
        queue: queue.name,
        data: job.data,
        timestamp: job.timestamp,
        attemptsMade: job.attemptsMade,
        processedOn: job.processedOn
      })));
    }
    activeJobs.sort((a, b) => b.timestamp - a.timestamp);
    return reply.send({
      success: true,
      count: activeJobs.length,
      jobs: activeJobs.slice(0, limit)
    });
  } catch (error) {
    logger.error('Erreur jobs actifs:', error);
    return reply.status(500).send({
      success: false,
      code: 'INTERNAL_ERROR',
      message: 'Erreur lors de la récupération des jobs actifs'
    });
  }
}

/**
 * GET /api/v1/queue/failed
 * Jobs échoués
 */
async function getFailedJobs(request, reply) {
  try {
    const limit = parseInt(request.query.limit) || 10;
    const queues = await queueService.getAllQueues();
    const failedJobs = [];
    for (const queue of queues) {
      const jobs = await queue.getJobs(['failed'], 0, limit);
      failedJobs.push(...jobs.map(job => ({
        id: job.id,
        queue: queue.name,
        data: job.data,
        timestamp: job.timestamp,
        failedReason: job.failedReason,
        attemptsMade: job.attemptsMade,
        finishedOn: job.finishedOn,
        processedOn: job.processedOn
      })));
    }
    failedJobs.sort((a, b) => b.timestamp - a.timestamp);
    return reply.send({
      success: true,
      count: failedJobs.length,
      jobs: failedJobs.slice(0, limit)
    });
  } catch (error) {
    logger.error('Erreur jobs échoués:', error);
    return reply.status(500).send({
      success: false,
      code: 'INTERNAL_ERROR',
      message: 'Erreur lors de la récupération des jobs échoués'
    });
  }
}

/**
 * POST /api/v1/queue/:jobId/retry
 * Réessayer un job échoué
 */
async function retryJobHandler(request, reply) {
  try {
    const { jobId } = request.params;
    const queues = await queueService.getAllQueues();
    for (const queue of queues) {
      const job = await queue.getJob(jobId);
      if (job) {
        await job.retry();
        return reply.send({
          success: true,
          message: `Job ${jobId} réessayé avec succès`
        });
      }
    }
    return reply.status(404).send({
      success: false,
      code: 'JOB_NOT_FOUND',
      message: `Job ${jobId} non trouvé`
    });
  } catch (error) {
    logger.error('Erreur retry job:', error);
    return reply.status(500).send({
      success: false,
      code: 'INTERNAL_ERROR',
      message: 'Erreur lors du réessai du job'
    });
  }
}

/**
 * DELETE /api/v1/queue/:jobId
 * Supprimer un job échoué
 */
async function removeJob(request, reply) {
  try {
    const { jobId } = request.params;
    const queues = await queueService.getAllQueues();
    for (const queue of queues) {
      const job = await queue.getJob(jobId);
      if (job) {
        await job.remove();
        return reply.send({
          success: true,
          message: `Job ${jobId} supprimé avec succès`
        });
      }
    }
    return reply.status(404).send({
      success: false,
      code: 'JOB_NOT_FOUND',
      message: `Job ${jobId} non trouvé`
    });
  } catch (error) {
    logger.error('Erreur suppression job:', error);
    return reply.status(500).send({
      success: false,
      code: 'INTERNAL_ERROR',
      message: 'Erreur lors de la suppression du job'
    });
  }
}

/**
 * DELETE /api/v1/queue/failed/clear
 * Vider tous les jobs échoués (global)
 */
async function clearFailedJobs(request, reply) {
  try {
    const queues = await queueService.getAllQueues();
    let total = 0;
    for (const queue of queues) {
      const cleaned = await queue.clean(0, 0, 'failed');
      total += cleaned.length;
    }
    return reply.send({
      success: true,
      message: `${total} jobs échoués supprimés`,
      count: total
    });
  } catch (error) {
    logger.error('Erreur clear failed jobs:', error);
    return reply.status(500).send({
      success: false,
      code: 'INTERNAL_ERROR',
      message: 'Erreur lors du nettoyage des jobs échoués'
    });
  }
}

module.exports = {
  getQueueStats,
  getActiveJobs,
  getFailedJobs,
  retryJobHandler,
  removeJob,
  clearFailedJobs,
  pauseQueue,
  resumeQueue,
  retryAllFailedForPhone,
  clearFailedForPhone
};
