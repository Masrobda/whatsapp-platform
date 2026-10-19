// src/controllers/whatsapp.monitor.controller.js
const queueService = require('../services/queue.service');
const logger = require('../utils/logger');

/**
 * POST /api/v1/admin/whatsapp/:phoneNumber/pause
 * Pause la queue d’un numéro WhatsApp
 */
async function pauseQueueHandler(request, reply) {
  try {
    const { phoneNumber } = request.params;

    if (!phoneNumber) {
      return reply.code(400).send({
        success: false,
        message: 'phoneNumber requis dans l’URL (ex: +237691234567)'
      });
    }

    const result = await queueService.pauseQueueForNumber(phoneNumber);

    return reply.send(result);
  } catch (err) {
    logger.error('Erreur pause queue', { phoneNumber: request.params.phoneNumber, err });
    return reply.code(500).send({
      success: false,
      code: 'INTERNAL_ERROR',
      message: 'Erreur lors de la pause de la queue'
    });
  }
}

/**
 * POST /api/v1/admin/whatsapp/:phoneNumber/resume
 * Reprend la queue d’un numéro WhatsApp
 */
async function resumeQueueHandler(request, reply) {
  try {
    const { phoneNumber } = request.params;

    if (!phoneNumber) {
      return reply.code(400).send({
        success: false,
        message: 'phoneNumber requis dans l’URL'
      });
    }

    const result = await queueService.resumeQueueForNumber(phoneNumber);

    return reply.send(result);
  } catch (err) {
    logger.error('Erreur reprise queue', { phoneNumber: request.params.phoneNumber, err });
    return reply.code(500).send({
      success: false,
      code: 'INTERNAL_ERROR',
      message: 'Erreur lors de la reprise de la queue'
    });
  }
}

module.exports = {
  pauseQueueHandler,
  resumeQueueHandler
};
