// src/routes/v1/monitoring.routes.js
const queueService = require('../../services/queue.service');
const { authenticateJWT } = require('../../middlewares/auth.middleware');
const { requireRole, ROLES } = require('../../middlewares/role.middleware');
const { query } = require('../../config/database');
const logger = require('../../utils/logger');

async function monitoringRoutes(fastify, options) {
  // ============================================
  // ROUTES ADMIN - MONITORING QUEUES
  // ============================================

  fastify.get('/queue-stats', {
    preHandler: [authenticateJWT, requireRole(ROLES.ADMIN)],
    schema: {
      description: 'Statistiques globales des files WhatsApp par numéro (admin)',
      tags: ['Admin - Monitoring'],
      security: [{ bearerAuth: [] }]
    }
  }, async (request, reply) => {
    try {
      const stats = await queueService.getAllStats();
      return reply.send({
        success: true,
        stats,
        count: stats.length,
        timestamp: new Date().toISOString()
      });
    } catch (err) {
      logger.error('Erreur /queue-stats admin', err);
      return reply.code(500).send({
        success: false,
        code: 'INTERNAL_ERROR',
        message: 'Erreur récupération stats queues'
      });
    }
  });

  // ============================================
  // ROUTES CLIENT - MONITORING QUEUES
  // ============================================

  fastify.get('/client-queue-stats', {
    // Note : On utilise authenticateJWT. La logique interne filtre par clientId.
    preHandler: [authenticateJWT], 
    schema: {
      description: 'Statistiques des files WhatsApp pour le client connecté',
      tags: ['Client - Dashboard'],
      security: [{ bearerAuth: [] }]
    }
  }, async (request, reply) => {
    try {
      // Sécurité : Si ce n'est pas un admin, on force le filtrage par son propre ID
      const clientId = request.user.id;

      // Récupérer uniquement les numéros appartenant à ce client
      const numbersRes = await query(
        `SELECT phone_number 
         FROM whatsapp_numbers 
         WHERE client_id = $1 AND is_active = true`,
        [clientId]
      );

      if (numbersRes.rows.length === 0) {
        return reply.send({
          success: true,
          stats: [],
          message: 'Aucun numéro WhatsApp actif associé à votre compte'
        });
      }

      const stats = [];
      for (const { phone_number } of numbersRes.rows) {
        const queueStats = await queueService.getStatsForNumber(phone_number);
        stats.push(queueStats);
      }

      return reply.send({
        success: true,
        stats,
        count: stats.length,
        timestamp: new Date().toISOString()
      });
    } catch (err) {
      logger.error('Erreur /client-queue-stats', err);
      return reply.code(500).send({
        success: false,
        code: 'INTERNAL_ERROR',
        message: 'Erreur récupération stats client'
      });
    }
  });

// GET /api/v1/monitoring/whatsapp/:phoneNumber/status
  fastify.get('/whatsapp/:phoneNumber/status', {
    preHandler: [authenticateJWT, requireRole(ROLES.ADMIN)],
    schema: {
      description: 'Etat détaillé d\'une queue WhatsApp (admin)',
      tags: ['Admin - Monitoring'],
      params: {
        type: 'object',
        required: ['phoneNumber'],
        properties: {
          phoneNumber: { 
            type: 'string',
            pattern: '^\\+?[1-9]\\d{1,14}$',
            description: 'Numéro WhatsApp avec ou sans +'
          }
        }
      },
      response: {
        200: {
          type: 'object',
          properties: {
            success: { type: 'boolean' },
            data: {
              type: 'object',
              properties: {
                phoneNumber: { type: 'string' },
                isPaused: { type: 'boolean' },
                queueName: { type: 'string' },
                counts: {
                  type: 'object',
                  properties: {
                    waiting: { type: 'integer' },
                    active: { type: 'integer' },
                    failed: { type: 'integer' }
                  }
                }
              }
            }
          }
        }
      },
      security: [{ bearerAuth: [] }]
    }
  }, async (request, reply) => {
    try {
      const { phoneNumber } = request.params;

      // Accès à BullMQ via le service
      const queue = queueService.getQueue(phoneNumber);
      const isPaused = await queue.isPaused();

      // Récupération des compteurs en temps réel
      const stats = await queueService.getStatsForNumber(phoneNumber);

      return reply.send({
        success: true,
        data: {
          phoneNumber,
          isPaused,
          queueName: queue.name,
          counts: {
            waiting: stats.waiting || 0,
            active: stats.active || 0,
            failed: stats.failed || 0
          }
        }
      });
    } catch (err) {
      logger.error(`Erreur status queue pour ${request.params.phoneNumber}`, err);
      return reply.code(500).send({ 
        success: false, 
        message: 'Erreur lors de la récupération du statut de la file' 
      });
    }
  });

}

module.exports = monitoringRoutes;
