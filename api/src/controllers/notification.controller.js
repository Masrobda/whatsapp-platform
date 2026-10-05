const notificationService = require('../services/notification.service');
const logger = require('../utils/logger');

class NotificationController {
  /**
   * GET /api/v1/notifications
   */
  async getNotifications(request, reply) {
    try {
      const userId = request.user.id;
      const userType = request.user.type;

      const filters = {
        limit: request.query.limit || 50,
        unread_only: request.query.unread_only === 'true',
        include_archived: request.query.include_archived === 'true'
      };

      let result;
      if (userType === 'client') {
        result = await notificationService.getClientNotifications(userId, filters);
      } else {
        result = await notificationService.getUserNotifications(userId, filters);
      }

      return reply.code(200).send(result);

    } catch (error) {
      logger.error('Erreur récupération notifications:', error);
      return reply.code(500).send({
        success: false,
        code: 'INTERNAL_ERROR',
        message: 'Une erreur est survenue'
      });
    }
  }

  /**
   * POST /api/v1/notifications/:id/read
   */
  async markAsRead(request, reply) {
    try {
      const { id } = request.params;
      const userId = request.user.id;

      const result = await notificationService.markAsRead(id, userId);

      return reply.code(200).send(result);

    } catch (error) {
      if (error.statusCode) {
        return reply.code(error.statusCode).send({
          success: false,
          code: error.code,
          message: error.message
        });
      }

      logger.error('Erreur marquer notification comme lue:', error);
      return reply.code(500).send({
        success: false,
        code: 'INTERNAL_ERROR',
        message: 'Une erreur est survenue'
      });
    }
  }

  /**
   * POST /api/v1/notifications/read-all
   */
  async markAllAsRead(request, reply) {
    try {
      const userId = request.user.id;

      const result = await notificationService.markAllAsRead(userId);

      return reply.code(200).send(result);

    } catch (error) {
      logger.error('Erreur marquer toutes comme lues:', error);
      return reply.code(500).send({
        success: false,
        code: 'INTERNAL_ERROR',
        message: 'Une erreur est survenue'
      });
    }
  }

  /**
   * POST /api/v1/notifications/:id/archive
   */
  async archiveNotification(request, reply) {
    try {
      const { id } = request.params;
      const userId = request.user.id;

      const result = await notificationService.archiveNotification(id, userId);

      return reply.code(200).send(result);

    } catch (error) {
      if (error.statusCode) {
        return reply.code(error.statusCode).send({
          success: false,
          code: error.code,
          message: error.message
        });
      }

      logger.error('Erreur archivage notification:', error);
      return reply.code(500).send({
        success: false,
        code: 'INTERNAL_ERROR',
        message: 'Une erreur est survenue'
      });
    }
  }

  /**
 * GET /api/v1/notifications/promotions/:code
 * Récupérer une promotion par son code
 */
async getPromotionByCode(request, reply) {
  try {
    const { code } = request.params;
    const result = await notificationService.getPromotionByCode(code);
    return reply.code(200).send(result);
  } catch (error) {
    logger.error('Erreur récupération promotion:', error);
    return reply.code(500).send({
      success: false,
      code: 'INTERNAL_ERROR',
      message: 'Une erreur est survenue'
    });
  }
}


  /**
   * POST /api/v1/notifications/broadcast (Admin)
   * Diffusion à tous les clients
   */
  async broadcastToClients(request, reply) {
    try {
      const result = await notificationService.createClientBroadcast({
        ...request.body,
        created_by: request.user.id
      });

      return reply.code(201).send(result);

    } catch (error) {
      logger.error('Erreur diffusion notifications:', error);
      return reply.code(500).send({
        success: false,
        code: 'INTERNAL_ERROR',
        message: 'Une erreur est survenue'
      });
    }
  }

  /**
   * POST /api/v1/notifications/promotion (Admin)
   * Créer une notification promotionnelle
   */
  async createPromotionNotification(request, reply) {
    try {
      const result = await notificationService.createPromotionalNotification({
        ...request.body,
        created_by: request.user.id
      });

      return reply.code(201).send(result);

    } catch (error) {
      logger.error('Erreur création notification promotionnelle:', error);
      return reply.code(500).send({
        success: false,
        code: 'INTERNAL_ERROR',
        message: 'Une erreur est survenue'
      });
    }
  }

  /**
   * GET /api/v1/notifications/stats
   * Statistiques des notifications
   */
  async getNotificationStats(request, reply) {
    try {
      const userId = request.user.id;
      const userType = request.user.type;

      const result = await notificationService.getNotificationStats(
        userType,
        userId,
        request.query
      );

      return reply.code(200).send(result);

    } catch (error) {
      logger.error('Erreur récupération statistiques:', error);
      return reply.code(500).send({
        success: false,
        code: 'INTERNAL_ERROR',
        message: 'Une erreur est survenue'
      });
    }
  }

  /**
   * POST /api/v1/notifications/client/:clientId/users
   * Notifier tous les utilisateurs d'un client
   */
  async notifyClientUsers(request, reply) {
    try {
      const { clientId } = request.params;
      
      const result = await notificationService.createClientUsersNotification(
        clientId,
        request.body
      );

      return reply.code(201).send(result);

    } catch (error) {
      logger.error('Erreur notification utilisateurs client:', error);
      return reply.code(500).send({
        success: false,
        code: 'INTERNAL_ERROR',
        message: 'Une erreur est survenue'
      });
    }
  }

  /**
   * PUT /api/v1/notifications/preferences
   * Gérer les préférences de notification
   */
  async updatePreferences(request, reply) {
    try {
      const clientId = request.user.client_id;
      
      const result = await notificationService.updateClientPreferences(
        clientId,
        request.body
      );

      return reply.code(200).send(result);

    } catch (error) {
      logger.error('Erreur mise à jour préférences:', error);
      return reply.code(500).send({
        success: false,
        code: 'INTERNAL_ERROR',
        message: 'Une erreur est survenue'
      });
    }
  }

  /**
 * GET /api/v1/notifications/broadcasts
 * Récupérer l'historique des diffusions (Admin)
 */
async getBroadcasts(request, reply) {
  try {
    // Implémentez la récupération des diffusions
    const result = await notificationService.getBroadcasts();
    return reply.code(200).send(result);
  } catch (error) {
    logger.error('Erreur récupération diffusions:', error);
    return reply.code(500).send({
      success: false,
      code: 'INTERNAL_ERROR',
      message: 'Une erreur est survenue'
    });
  }
}

/**
 * GET /api/v1/notifications/promotions
 * Récupérer l'historique des promotions (Admin)
 */
async getPromotions(request, reply) {
  try {
    const result = await notificationService.getPromotions();
    return reply.code(200).send(result);
  } catch (error) {
    logger.error('Erreur récupération promotions:', error);
    return reply.code(500).send({
      success: false,
      code: 'INTERNAL_ERROR',
      message: 'Une erreur est survenue'
    });
  }
}

/**
 * GET /api/v1/notifications/preferences
 * Récupérer les préférences de notification
 */
async getPreferences(request, reply) {
  try {
    const clientId = request.user.client_id;
    const result = await notificationService.getClientPreferences(clientId);
    return reply.code(200).send(result);
  } catch (error) {
    logger.error('Erreur récupération préférences:', error);
    return reply.code(500).send({
      success: false,
      code: 'INTERNAL_ERROR',
      message: 'Une erreur est survenue'
    });
  }
}


  /**
   * POST /api/v1/notifications/system (Admin)
   */
  async createSystemNotification(request, reply) {
    try {
      const result = await notificationService.createSystemNotification(request.body);

      return reply.code(201).send(result);

    } catch (error) {
      logger.error('Erreur création notification système:', error);
      return reply.code(500).send({
        success: false,
        code: 'INTERNAL_ERROR',
        message: 'Une erreur est survenue'
      });
    }
  }
}

module.exports = new NotificationController();
