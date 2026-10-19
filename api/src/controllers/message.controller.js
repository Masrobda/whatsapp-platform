// src/controllers/message.controller.js
const messageService = require('../services/message.service');
const queueService = require('../services/queue.service');
const { validate, schemas } = require('../utils/validators');
const logger = require('../utils/logger');

/**
 * POST /api/v1/messages/send
 * Envoyer un message WhatsApp
 * Retourne le format standardisé pour tous les clients :
 * [
 *   {
 *     "messages": "Message queued successfully." | "Message sending failed.",
 *     "data": [
 *       {
 *         "message_id": "msg_xxx" | null,
 *         "status": "queued" | "failed",
 *         "to": "237XXXXXXXXX",  // sans le '+'
 *         "timestamp": "2026-...",
 *         "error": "..." (uniquement en cas d'échec)
 *       }
 *     ]
 *   }
 * ]
 * 
 * La réponse est un tableau limité à 30 éléments maximum.
 */
async function sendMessageHandler(request, reply) {
  try {
    const validatedData = validate(schemas.sendMessageSchema, request.body);
    console.log('DEBUG - Données reçues:', validatedData);

    const clientId = request.client?.id || request.user?.id;
    if (!clientId) {
      return reply.code(401).send([{
        messages: "Message sending failed.",
        data: [{
          message_id: null,
          status: "failed",
          to: (request.body?.recipient_phone || 'unknown').replace(/^\+/, ''),
          timestamp: new Date().toISOString(),
          error: 'Aucun identifiant client trouvé (token invalide ?)'
        }]
      }]);
    }
    console.log('DEBUG - clientId utilisé:', clientId);

    // Appel du service
    const result = await messageService.sendMessage(clientId, validatedData);

    // Construire la réponse au format standard
    const adminResponse = [];

    if (result.success) {
      // Succès : on construit l'objet avec les infos du message
      const messageId = result.data?.message_id || result.data?.id || 'msg_' + Date.now();
      // Retirer le '+' du numéro
      const phone = (result.data?.recipient || validatedData.recipient_phone || 'unknown').replace(/^\+/, '');
      const status = result.data?.status || 'queued';
      const timestamp = result.data?.timestamp || new Date().toISOString();

      adminResponse.push({
        messages: "Message queued successfully.",
        data: [{
          message_id: messageId,
          status: status,
          to: phone,
          timestamp: timestamp
        }]
      });
    } else {
      // Échec : on renvoie un objet d'erreur
      adminResponse.push({
        messages: "Message sending failed.",
        data: [{
          message_id: null,
          status: "failed",
          to: (validatedData.recipient_phone || 'unknown').replace(/^\+/, ''),
          timestamp: new Date().toISOString(),
          error: result.message || 'Erreur inconnue'
        }]
      });
    }

    // Limiter la réponse à 30 éléments maximum (sécurité)
    const limitedResponse = adminResponse.slice(0, 100);

    // Retourner avec le code HTTP 201
    return reply.code(201).send(limitedResponse);

  } catch (error) {
    console.error('Erreur dans sendMessageHandler:', error);

    // Construire une réponse d'erreur au format standard
    const errorResponse = [{
      messages: "Message sending failed.",
      data: [{
        message_id: null,
        status: "failed",
        to: (request.body?.recipient_phone || 'unknown').replace(/^\+/, ''),
        timestamp: new Date().toISOString(),
        error: error.message || 'Erreur interne'
      }]
    }];

    // Déterminer le code HTTP approprié
    const statusCode = error.statusCode || 500;
    return reply.code(statusCode).send(errorResponse);
  }
}

/**
 * GET /api/v1/messages
 * Récupérer les messages (admin voit tout, client voit ses messages)
 */
async function getMessagesHandler(request, reply) {
  try {
    const user = request.user;
    const clientId = user.role === 'admin' ? null : user.id;

    const filters = {
      page: request.query.page || 1,
      limit: request.query.limit || 20,
      status: request.query.status,
      recipient_phone: request.query.recipient_phone,
      start_date: request.query.start_date,
      end_date: request.query.end_date,
      message_type: request.query.message_type,
    };

    const result = await messageService.getClientMessages(clientId, filters);
    return reply.code(200).send(result);
  } catch (error) {
    logger.error('Erreur récupération messages:', error);
    return reply.code(500).send({
      success: false,
      code: 'INTERNAL_ERROR',
      message: 'Une erreur est survenue'
    });
  }
}

/**
 * GET /api/v1/messages/:id
 * Récupérer un message spécifique
 */
async function getMessageByIdHandler(request, reply) {
  try {
    const { id } = request.params;
    const user = request.user;
    const clientId = user.role === 'admin' ? null : user.id;

    const result = await messageService.getMessageById(id, clientId);
    return reply.code(200).send(result);
  } catch (error) {
    if (error.statusCode) {
      return reply.code(error.statusCode).send({
        success: false,
        code: error.code,
        message: error.message
      });
    }
    logger.error('Erreur récupération message:', error);
    return reply.code(500).send({
      success: false,
      code: 'INTERNAL_ERROR',
      message: 'Une erreur est survenue'
    });
  }
}

/**
 * GET /api/v1/messages/stats
 * Récupérer les statistiques des messages (admin voit tout)
 */
async function getStatsHandler(request, reply) {
  try {
    const user = request.user;
    const clientId = user.role === 'admin' ? null : user.id;
    const { period = '30days' } = request.query;

    const result = await messageService.getClientStats(clientId, period);
    return reply.code(200).send(result);
  } catch (error) {
    logger.error('Erreur récupération stats:', error);
    return reply.code(500).send({
      success: false,
      code: 'INTERNAL_ERROR',
      message: 'Une erreur est survenue'
    });
  }
}

/**
 * GET /api/v1/messages/export/csv
 * Exporter les messages en CSV (admin voit tout)
 */
async function exportCSVHandler(request, reply) {
  try {
    const user = request.user;
    const clientId = user.role === 'admin' ? null : user.id;

    const filters = {
      status: request.query.status,
      start_date: request.query.start_date,
      end_date: request.query.end_date,
    };

    const result = await messageService.exportMessagesToCSV(clientId, filters);
    reply.header('Content-Type', 'text/csv');
    reply.header('Content-Disposition', `attachment; filename="messages_${Date.now()}.csv"`);
    return reply.code(200).send(result.csv);
  } catch (error) {
    logger.error('Erreur export CSV:', error);
    return reply.code(500).send({
      success: false,
      code: 'INTERNAL_ERROR',
      message: 'Une erreur est survenue'
    });
  }
}

/**
 * GET /api/v1/messages/queue/stats
 * Récupérer les statistiques de la file d'attente (admin seulement)
 */
async function getQueueStatsHandler(request, reply) {
  try {
    const stats = await queueService.getQueueStats();
    return reply.code(200).send({
      success: true,
      stats
    });
  } catch (error) {
    logger.error('Erreur stats file:', error);
    return reply.code(500).send({
      success: false,
      code: 'INTERNAL_ERROR',
      message: 'Une erreur est survenue'
    });
  }
}

/**
 * GET /api/v1/messages/queue/active
 * Récupérer les jobs actifs (admin)
 */
async function getActiveJobsHandler(request, reply) {
  try {
    const { limit } = request.query;
    const jobs = await queueService.getActiveJobs(parseInt(limit) || 10);
    return reply.code(200).send({
      success: true,
      jobs
    });
  } catch (error) {
    logger.error('Erreur jobs actifs:', error);
    return reply.code(500).send({
      success: false,
      code: 'INTERNAL_ERROR',
      message: 'Une erreur est survenue'
    });
  }
}

/**
 * GET /api/v1/messages/queue/failed
 * Récupérer les jobs échoués (admin)
 */
async function getFailedJobsHandler(request, reply) {
  try {
    const { limit } = request.query;
    const jobs = await queueService.getFailedJobs(parseInt(limit) || 10);
    return reply.code(200).send({
      success: true,
      jobs
    });
  } catch (error) {
    logger.error('Erreur jobs échoués:', error);
    return reply.code(500).send({
      success: false,
      code: 'INTERNAL_ERROR',
      message: 'Une erreur est survenue'
    });
  }
}

/**
 * POST /api/v1/messages/queue/:jobId/retry
 * Réessayer un job échoué (admin)
 */
async function retryJobHandler(request, reply) {
  try {
    const { jobId } = request.params;
    const result = await queueService.retryFailedJob(jobId);
    return reply.code(200).send(result);
  } catch (error) {
    logger.error('Erreur retry job:', error);
    return reply.code(500).send({
      success: false,
      code: 'INTERNAL_ERROR',
      message: 'Une erreur est survenue'
    });
  }
}

module.exports = {
  sendMessageHandler,
  getMessagesHandler,
  getMessageByIdHandler,
  getStatsHandler,
  exportCSVHandler,
  getQueueStatsHandler,
  getActiveJobsHandler,
  getFailedJobsHandler,
  retryJobHandler,
};
