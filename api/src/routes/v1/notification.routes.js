// /var/www/numericexport/api/src/routes/v1/notification.routes.js

const NotificationController = require('../../controllers/notification.controller');
const { authenticateJWT } = require('../../middlewares/auth.middleware');
const { requireRole, ROLES } = require('../../middlewares/role.middleware');

async function notificationRoutes(fastify, options) {

  // Récupérer les notifications
  fastify.get('/', {
    preHandler: [authenticateJWT],
    schema: {
      description: 'Récupérer les notifications',
      tags: ['Notifications'],
      security: [{ bearerAuth: [] }],
      querystring: {
        type: 'object',
        properties: {
          limit: { type: 'integer', default: 50 },
          unread_only: { type: 'boolean', default: false },
          include_archived: { type: 'boolean', default: false }
        }
      }
    }
  }, NotificationController.getNotifications);

  // Marquer une notification comme lue
  fastify.post('/:id/read', {
    preHandler: [authenticateJWT],
    schema: {
      description: 'Marquer une notification comme lue',
      tags: ['Notifications'],
      security: [{ bearerAuth: [] }],
      params: {
        type: 'object',
        properties: {
          id: { type: 'string', format: 'uuid' }
        }
      }
    }
  }, NotificationController.markAsRead);

  // Marquer toutes les notifications comme lues
  fastify.post('/read-all', {
    preHandler: [authenticateJWT],
    schema: {
      description: 'Marquer toutes les notifications comme lues',
      tags: ['Notifications'],
      security: [{ bearerAuth: [] }]
    }
  }, NotificationController.markAllAsRead);

  // Archiver une notification
  fastify.post('/:id/archive', {
    preHandler: [authenticateJWT],
    schema: {
      description: 'Archiver une notification',
      tags: ['Notifications'],
      security: [{ bearerAuth: [] }],
      params: {
        type: 'object',
        properties: {
          id: { type: 'string', format: 'uuid' }
        }
      }
    }
  }, NotificationController.archiveNotification);

  // ============ AJOUTER CES ROUTES MANQUANTES ============
  
  // Récupérer l'historique des diffusions (GET)
  fastify.get('/broadcasts', {
    preHandler: [authenticateJWT, requireRole(ROLES.ADMIN)],
    schema: {
      description: 'Récupérer l\'historique des diffusions',
      tags: ['Notifications - Admin'],
      security: [{ bearerAuth: [] }]
    }
  }, NotificationController.getBroadcasts);

  // Récupérer l'historique des promotions (GET)
  fastify.get('/promotions', {
    preHandler: [authenticateJWT, requireRole(ROLES.ADMIN)],
    schema: {
      description: 'Récupérer l\'historique des promotions',
      tags: ['Notifications - Admin'],
      security: [{ bearerAuth: [] }]
    }
  }, NotificationController.getPromotions);

  // Récupérer les préférences (GET)
  fastify.get('/preferences', {
    preHandler: [authenticateJWT],
    schema: {
      description: 'Récupérer les préférences de notification',
      tags: ['Notifications'],
      security: [{ bearerAuth: [] }]
    }
  }, NotificationController.getPreferences);

  // ======================================================

  // DIFFUSIONS ADMIN (POST)
  fastify.post('/broadcast', {
    preHandler: [authenticateJWT, requireRole(ROLES.ADMIN)],
    schema: {
      description: 'Diffuser une notification à tous les clients',
      tags: ['Notifications - Admin'],
      security: [{ bearerAuth: [] }],
      body: {
        type: 'object',
        required: ['title', 'message'],
        properties: {
          title: { type: 'string' },
          message: { type: 'string' },
          type: { type: 'string', enum: ['info', 'success', 'warning', 'error'] },
          target_clients: { type: 'string', enum: ['all', 'active', 'specific'] },
          client_ids: { type: 'array', items: { type: 'string', format: 'uuid' } },
          action_url: { type: 'string' },
          action_label: { type: 'string' },
          metadata: { type: 'object' },
          expires_in_hours: { type: 'integer', default: 168 }
        }
      }
    }
  }, NotificationController.broadcastToClients);

  // PROMOTIONS ADMIN (POST)
  fastify.post('/promotion', {
    preHandler: [authenticateJWT, requireRole(ROLES.ADMIN)],
    schema: {
      description: 'Créer une notification promotionnelle',
      tags: ['Notifications - Admin'],
      security: [{ bearerAuth: [] }],
      body: {
        type: 'object',
        required: ['title', 'message', 'promotion_code'],
        properties: {
          title: { type: 'string' },
          message: { type: 'string' },
          promotion_code: { type: 'string' },
          discount_percentage: { type: 'number' },
          valid_until: { type: 'string', format: 'date-time' },
          target_segments: { type: 'string', enum: ['all', 'active', 'inactive', 'specific'] },
          segment_ids: { type: 'array', items: { type: 'string', format: 'uuid' } },
          metadata: { type: 'object' }
        }
      }
    }
  }, NotificationController.createPromotionNotification);

  // RECUPERE UNE PROMOTION
  fastify.get('/promotions/:code', {
  preHandler: [authenticateJWT],
  schema: {
    description: 'Récupérer les détails d\'une promotion par son code',
    tags: ['Notifications'],
    security: [{ bearerAuth: [] }],
    params: {
      type: 'object',
      properties: {
        code: { type: 'string' }
      }
    }
  }
}, NotificationController.getPromotionByCode);

  // STATISTIQUES
  fastify.get('/stats', {
    preHandler: [authenticateJWT],
    schema: {
      description: 'Statistiques des notifications',
      tags: ['Notifications'],
      security: [{ bearerAuth: [] }],
      querystring: {
        type: 'object',
        properties: {
          startDate: { type: 'string', format: 'date-time' },
          endDate: { type: 'string', format: 'date-time' },
          type: { type: 'string', enum: ['info', 'success', 'warning', 'error', 'promotion'] }
        }
      }
    }
  }, NotificationController.getNotificationStats);

  // NOTIFIER LES UTILISATEURS D'UN CLIENT
  fastify.post('/client/:clientId/users', {
    preHandler: [authenticateJWT, requireRole(ROLES.ADMIN)],
    schema: {
      description: 'Notifier tous les utilisateurs d\'un client',
      tags: ['Notifications - Admin'],
      security: [{ bearerAuth: [] }],
      params: {
        type: 'object',
        properties: {
          clientId: { type: 'string', format: 'uuid' }
        }
      },
      body: {
        type: 'object',
        required: ['title', 'message'],
        properties: {
          title: { type: 'string' },
          message: { type: 'string' },
          type: { type: 'string', enum: ['info', 'success', 'warning', 'error'] },
          action_url: { type: 'string' },
          action_label: { type: 'string' },
          metadata: { type: 'object' }
        }
      }
    }
  }, NotificationController.notifyClientUsers);

  // PRÉFÉRENCES CLIENT (PUT)
  fastify.put('/preferences', {
    preHandler: [authenticateJWT],
    schema: {
      description: 'Gérer les préférences de notification',
      tags: ['Notifications'],
      security: [{ bearerAuth: [] }],
      body: {
        type: 'object',
        properties: {
          email_enabled: { type: 'boolean' },
          push_enabled: { type: 'boolean' },
          promotion_enabled: { type: 'boolean' },
          system_enabled: { type: 'boolean' },
          quiet_hours_start: { type: 'string' },
          quiet_hours_end: { type: 'string' }
        }
      }
    }
  }, NotificationController.updatePreferences);

  // Créer une notification système (Admin)
  fastify.post('/system', {
    preHandler: [authenticateJWT, requireRole(ROLES.ADMIN)],
    schema: {
      description: 'Créer une notification système',
      tags: ['Notifications - Admin'],
      security: [{ bearerAuth: [] }],
      body: {
        type: 'object',
        required: ['title', 'message'],
        properties: {
          title: { type: 'string' },
          message: { type: 'string' },
          type: { type: 'string', enum: ['info', 'success', 'warning', 'error'] },
          action_url: { type: 'string' },
          action_label: { type: 'string' },
          metadata: { type: 'object' }
        }
      }
    }
  }, NotificationController.createSystemNotification);
}

module.exports = notificationRoutes;
