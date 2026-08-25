const { query } = require('../config/database');
const logger = require('../utils/logger');

class NotificationService {
  /**
   * Créer une notification
   */
  async createNotification(notificationData) {
    try {
      const {
        user_id,
        client_id,
        title,
        message,
        type = 'info',
        action_url,
        action_label,
        metadata,
        expires_in_hours = 168
      } = notificationData;

      const result = await query(
        `SELECT create_notification($1, $2, $3, $4, $5, $6, $7, $8, $9) as notification_id`,
        [
          user_id,
          client_id,
          title,
          message,
          type,
          action_url,
          action_label,
          metadata ? JSON.stringify(metadata) : null,
          expires_in_hours
        ]
      );

      logger.info('Notification créée:', {
        notificationId: result.rows[0].notification_id,
        userId: user_id,
        title
      });

      return {
        success: true,
        notification_id: result.rows[0].notification_id
      };

    } catch (error) {
      logger.error('Erreur création notification:', error);
      throw error;
    }
  }

  /**
   * Récupérer les notifications d'un utilisateur
   */
  async getUserNotifications(userId, filters = {}) {
    try {
      const { limit = 50, unread_only = false, include_archived = false } = filters;

      let whereClause = 'WHERE (user_id = $1 OR (user_id IS NULL AND client_id IS NULL))';
      const params = [userId];
      let paramIndex = 2;

      if (unread_only) {
        whereClause += ' AND is_read = false';
      }

      if (!include_archived) {
        whereClause += ' AND is_archived = false';
      }

      // Filtrer les notifications expirées
      whereClause += ' AND (expires_at IS NULL OR expires_at > CURRENT_TIMESTAMP)';

      // Compter les non lues
      const unreadCountResult = await query(
        `SELECT COUNT(*) as count FROM notifications
         WHERE (user_id = $1 OR (user_id IS NULL AND client_id IS NULL))
         AND is_read = false
         AND is_archived = false
         AND (expires_at IS NULL OR expires_at > CURRENT_TIMESTAMP)`,
        [userId]
      );

      // Récupérer les notifications
      const notificationsResult = await query(
        `SELECT
          id, title, message, type,
          action_url, action_label, metadata,
          is_read, is_archived,
          created_at, read_at
         FROM notifications
         ${whereClause}
         ORDER BY created_at DESC
         LIMIT $${paramIndex}`,
        [...params, limit]
      );

      return {
        success: true,
        notifications: notificationsResult.rows,
        unread_count: parseInt(unreadCountResult.rows[0].count)
      };

    } catch (error) {
      logger.error('Erreur récupération notifications:', error);
      throw error;
    }
  }

  /**
   * Récupérer les notifications d'un client
   */
  async getClientNotifications(clientId, filters = {}) {
    try {
      const { limit = 50, unread_only = false } = filters;

      let whereClause = 'WHERE client_id = $1';
      const params = [clientId];
      let paramIndex = 2;

      if (unread_only) {
        whereClause += ' AND is_read = false';
      }

      whereClause += ' AND is_archived = false';
      whereClause += ' AND (expires_at IS NULL OR expires_at > CURRENT_TIMESTAMP)';

      // Compter les non lues
      const unreadCountResult = await query(
        `SELECT COUNT(*) as count FROM notifications
         WHERE client_id = $1
         AND is_read = false
         AND is_archived = false
         AND (expires_at IS NULL OR expires_at > CURRENT_TIMESTAMP)`,
        [clientId]
      );

      const notificationsResult = await query(
        `SELECT
          id, title, message, type,
          action_url, action_label, metadata,
          is_read, created_at, read_at
         FROM notifications
         ${whereClause}
         ORDER BY created_at DESC
         LIMIT $${paramIndex}`,
        [...params, limit]
      );

      return {
        success: true,
        notifications: notificationsResult.rows,
        unread_count: parseInt(unreadCountResult.rows[0].count)
      };

    } catch (error) {
      logger.error('Erreur récupération notifications client:', error);
      throw error;
    }
  }

  /**
   * Marquer une notification comme lue
   */
  async markAsRead(notificationId, userId) {
    try {
      const result = await query(
        `UPDATE notifications
         SET is_read = true, read_at = CURRENT_TIMESTAMP
         WHERE id = $1 AND (user_id = $2 OR user_id IS NULL)
         RETURNING id`,
        [notificationId, userId]
      );

      if (result.rows.length === 0) {
        throw {
          statusCode: 404,
          code: 'NOTIFICATION_NOT_FOUND',
          message: 'Notification non trouvée ou non autorisée'
        };
      }

      logger.info('Notification marquée comme lue:', notificationId);

      return {
        success: true,
        message: 'Notification marquée comme lue'
      };

    } catch (error) {
      logger.error('Erreur marquer notification comme lue:', error);
      throw error;
    }
  }

  /**
   * Marquer toutes les notifications comme lues
   */
  async markAllAsRead(userId) {
    try {
      await query(
        `UPDATE notifications
         SET is_read = true, read_at = CURRENT_TIMESTAMP
         WHERE (user_id = $1 OR user_id IS NULL)
         AND is_read = false
         AND is_archived = false`,
        [userId]
      );

      logger.info('Toutes les notifications marquées comme lues pour:', userId);

      return {
        success: true,
        message: 'Toutes les notifications marquées comme lues'
      };

    } catch (error) {
      logger.error('Erreur marquer toutes comme lues:', error);
      throw error;
    }
  }

  /**
   * Archiver une notification
   */
  async archiveNotification(notificationId, userId) {
    try {
      const result = await query(
        `UPDATE notifications
         SET is_archived = true
         WHERE id = $1 AND (user_id = $2 OR user_id IS NULL)
         RETURNING id`,
        [notificationId, userId]
      );

      if (result.rows.length === 0) {
        throw {
          statusCode: 404,
          code: 'NOTIFICATION_NOT_FOUND',
          message: 'Notification non trouvée ou non autorisée'
        };
      }

      logger.info('Notification archivée:', notificationId);

      return {
        success: true,
        message: 'Notification archivée'
      };

    } catch (error) {
      logger.error('Erreur archivage notification:', error);
      throw error;
    }
  }

  /**
   * Supprimer les notifications expirées
   */
  async cleanupExpiredNotifications() {
    try {
      const result = await query(
        `DELETE FROM notifications
         WHERE expires_at IS NOT NULL
         AND expires_at <= CURRENT_TIMESTAMP
         RETURNING COUNT(*) as deleted_count`
      );

      const deletedCount = parseInt(result.rows[0].deleted_count);

      logger.info('Notifications expirées nettoyées:', { deletedCount });

      return {
        success: true,
        deleted_count: deletedCount
      };

    } catch (error) {
      logger.error('Erreur nettoyage notifications expirées:', error);
      throw error;
    }
  }

  /**
   * Créer une notification système (pour tous les utilisateurs)
   */
  async createSystemNotification(notificationData) {
    try {
      const {
        title,
        message,
        type = 'info',
        action_url,
        action_label,
        metadata
      } = notificationData;

      const result = await query(
        `INSERT INTO notifications (
          title, message, type, action_url, action_label, metadata
        ) VALUES ($1, $2, $3, $4, $5, $6)
        RETURNING id`,
        [title, message, type, action_url, action_label, metadata ? JSON.stringify(metadata) : null]
      );

      logger.info('Notification système créée:', {
        notificationId: result.rows[0].id,
        title
      });

      return {
        success: true,
        notification_id: result.rows[0].id
      };

    } catch (error) {
      logger.error('Erreur création notification système:', error);
      throw error;
    }
  }

/**
   * Créer une notification pour tous les clients
   */
  async createClientBroadcast(notificationData) {
    try {
      const {
        title,
        message,
        type = 'info',
        action_url,
        action_label,
        metadata,
        target_clients = 'all', // 'all', 'active', 'specific'
        client_ids = [],
        expires_in_hours = 168
      } = notificationData;

      // Récupérer les clients cibles
      let targetClientIds = [];
      
      if (target_clients === 'all') {
        const result = await query(
          `SELECT id FROM clients WHERE is_active = true`
        );
        targetClientIds = result.rows.map(row => row.id);
      } else if (target_clients === 'active') {
        const result = await query(
          `SELECT id FROM clients WHERE is_active = true AND has_active_subscription = true`
        );
        targetClientIds = result.rows.map(row => row.id);
      } else if (target_clients === 'specific' && client_ids.length > 0) {
        targetClientIds = client_ids;
      }

      // Créer les notifications pour chaque client
      const notifications = [];
      for (const clientId of targetClientIds) {
        const result = await query(
          `SELECT create_notification(NULL, $1, $2, $3, $4, $5, $6, $7, $8) as notification_id`,
          [
            clientId,
            title,
            message,
            type,
            action_url,
            action_label,
            metadata ? JSON.stringify(metadata) : null,
            expires_in_hours
          ]
        );
        notifications.push({
          client_id: clientId,
          notification_id: result.rows[0].notification_id
        });
      }

      // Enregistrer l'historique de diffusion
      await query(
        `INSERT INTO notification_broadcasts (
          title, message, type, target_clients, client_ids, total_sent,
          action_url, action_label, metadata, created_by
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)`,
        [
          title,
          message,
          type,
          target_clients,
          JSON.stringify(client_ids),
          notifications.length,
          action_url,
          action_label,
          metadata ? JSON.stringify(metadata) : null,
          notificationData.created_by
        ]
      );

      logger.info('Diffusion de notification créée:', {
        title,
        total_clients: notifications.length,
        target_type: target_clients
      });

      return {
        success: true,
        total_sent: notifications.length,
        notifications: notifications
      };

    } catch (error) {
      logger.error('Erreur création diffusion notification:', error);
      throw error;
    }
  }

  /**
   * Créer une notification pour tous les utilisateurs d'un client
   */
  async createClientUsersNotification(clientId, notificationData) {
    try {
      const {
        title,
        message,
        type = 'info',
        action_url,
        action_label,
        metadata,
        expires_in_hours = 168
      } = notificationData;

      // Récupérer tous les utilisateurs du client
      const usersResult = await query(
        `SELECT id FROM users WHERE client_id = $1 AND is_active = true`,
        [clientId]
      );

      // Créer les notifications pour chaque utilisateur
      const notifications = [];
      for (const user of usersResult.rows) {
        const result = await query(
          `SELECT create_notification($1, $2, $3, $4, $5, $6, $7, $8, $9) as notification_id`,
          [
            user.id,
            clientId,
            title,
            message,
            type,
            action_url,
            action_label,
            metadata ? JSON.stringify(metadata) : null,
            expires_in_hours
          ]
        );
        notifications.push({
          user_id: user.id,
          notification_id: result.rows[0].notification_id
        });
      }

      logger.info('Notification créée pour tous les utilisateurs du client:', {
        clientId,
        total_users: notifications.length,
        title
      });

      return {
        success: true,
        total_sent: notifications.length,
        notifications: notifications
      };

    } catch (error) {
      logger.error('Erreur création notification utilisateurs client:', error);
      throw error;
    }
  }

  /**
   * Créer une notification promotionnelle
   */
  async createPromotionalNotification(notificationData) {
    try {
      const {
        title,
        message,
        promotion_code,
        discount_percentage,
        valid_until,
        target_segments = 'all', // 'all', 'active', 'inactive', 'specific'
        segment_ids = []
      } = notificationData;

      // Ajouter les informations de promotion aux métadonnées
      const metadata = {
        type: 'promotion',
        promotion_code,
        discount_percentage,
        valid_until,
        target_segments,
        ...notificationData.metadata
      };

      // Déterminer les clients cibles
      let targetClientIds = [];
      
      if (target_segments === 'all') {
        const result = await query(
          `SELECT id FROM clients WHERE is_active = true`
        );
        targetClientIds = result.rows.map(row => row.id);
      } else if (target_segments === 'active') {
        const result = await query(
          `SELECT id FROM clients 
           WHERE is_active = true 
           AND has_active_subscription = true
           AND last_activity_at > NOW() - INTERVAL '30 days'`
        );
        targetClientIds = result.rows.map(row => row.id);
      } else if (target_segments === 'inactive') {
        const result = await query(
          `SELECT id FROM clients 
           WHERE is_active = false 
           OR last_activity_at < NOW() - INTERVAL '90 days'`
        );
        targetClientIds = result.rows.map(row => row.id);
      } else if (target_segments === 'specific' && segment_ids.length > 0) {
        targetClientIds = segment_ids;
      }

      // Créer les notifications promotionnelles
      const notifications = [];
      for (const clientId of targetClientIds) {
        const result = await query(
          `SELECT create_notification(NULL, $1, $2, $3, $4, $5, $6, $7, $8) as notification_id`,
          [
            clientId,
            title,
            message,
            'promotion',
            `/promotions/${promotion_code}`,
            'Voir l\'offre',
            JSON.stringify(metadata),
            720 // 30 jours d'expiration
          ]
        );
        notifications.push({
          client_id: clientId,
          notification_id: result.rows[0].notification_id
        });
      }

      logger.info('Notification promotionnelle créée:', {
        title,
        promotion_code,
        total_sent: notifications.length
      });

      return {
        success: true,
        total_sent: notifications.length,
        promotion_code,
        valid_until
      };

    } catch (error) {
      logger.error('Erreur création notification promotionnelle:', error);
      throw error;
    }
  }

  /**
   * Récupérer les statistiques des notifications
   */
  async getNotificationStats(userType, userId, filters = {}) {
    try {
      const { startDate, endDate, type } = filters;

      let queryStr = `
        SELECT 
          COUNT(*) as total,
          COUNT(CASE WHEN is_read THEN 1 END) as read_count,
          COUNT(CASE WHEN NOT is_read THEN 1 END) as unread_count,
          COUNT(CASE WHEN is_archived THEN 1 END) as archived_count,
          COUNT(CASE WHEN type = 'promotion' THEN 1 END) as promotion_count,
          COUNT(CASE WHEN type = 'info' THEN 1 END) as info_count,
          COUNT(CASE WHEN type = 'success' THEN 1 END) as success_count,
          COUNT(CASE WHEN type = 'warning' THEN 1 END) as warning_count,
          COUNT(CASE WHEN type = 'error' THEN 1 END) as error_count
      `;

      const params = [];
      let whereClause = '';

      if (userType === 'client') {
        whereClause = 'WHERE client_id = $1';
        params.push(userId);
      } else {
        whereClause = 'WHERE (user_id = $1 OR (user_id IS NULL AND client_id IS NULL))';
        params.push(userId);
      }

      if (startDate) {
        whereClause += ` AND created_at >= $${params.length + 1}`;
        params.push(startDate);
      }
      if (endDate) {
        whereClause += ` AND created_at <= $${params.length + 1}`;
        params.push(endDate);
      }
      if (type) {
        whereClause += ` AND type = $${params.length + 1}`;
        params.push(type);
      }

      queryStr += ` FROM notifications ${whereClause}`;

      const result = await query(queryStr, params);

      return {
        success: true,
        stats: result.rows[0]
      };

    } catch (error) {
      logger.error('Erreur récupération statistiques notifications:', error);
      throw error;
    }
  }

  /**
   * Gérer les préférences de notification d'un client
   */
  async updateClientPreferences(clientId, preferences) {
    try {
      const {
        email_enabled = true,
        push_enabled = true,
        promotion_enabled = true,
        system_enabled = true,
        quiet_hours_start,
        quiet_hours_end
      } = preferences;

      const result = await query(
        `INSERT INTO client_notification_preferences (
          client_id, email_enabled, push_enabled, 
          promotion_enabled, system_enabled, 
          quiet_hours_start, quiet_hours_end
        ) VALUES ($1, $2, $3, $4, $5, $6, $7)
        ON CONFLICT (client_id) 
        DO UPDATE SET
          email_enabled = EXCLUDED.email_enabled,
          push_enabled = EXCLUDED.push_enabled,
          promotion_enabled = EXCLUDED.promotion_enabled,
          system_enabled = EXCLUDED.system_enabled,
          quiet_hours_start = EXCLUDED.quiet_hours_start,
          quiet_hours_end = EXCLUDED.quiet_hours_end,
          updated_at = CURRENT_TIMESTAMP
        RETURNING *`,
        [clientId, email_enabled, push_enabled, promotion_enabled, system_enabled, quiet_hours_start, quiet_hours_end]
      );

      return {
        success: true,
        preferences: result.rows[0]
      };

    } catch (error) {
      logger.error('Erreur mise à jour préférences client:', error);
      throw error;
    }
  }

async getClientPreferences(clientId) {
    const result = await query(
        `SELECT * FROM client_notification_preferences WHERE client_id = $1`,
        [clientId]
    );
    return { success: true, preferences: result.rows[0] || null };
}

async getBroadcasts() {
    try {
        const result = await query(
            `SELECT * FROM notification_broadcasts ORDER BY created_at DESC LIMIT 100`
        );
        return { success: true, broadcasts: result.rows };
    } catch (error) {
        logger.error('Erreur récupération diffusions:', error);
        throw error;
    }
}

async getPromotions() {
    try {
        // Récupère les notifications de type promotion
        const result = await query(
            `SELECT * FROM notifications 
             WHERE type = 'promotion' 
             ORDER BY created_at DESC 
             LIMIT 100`
        );
        return { success: true, promotions: result.rows };
    } catch (error) {
        logger.error('Erreur récupération promotions:', error);
        throw error;
    }
}

async getClientPreferences(clientId) {
    try {
        const result = await query(
            `SELECT * FROM client_notification_preferences WHERE client_id = $1`,
            [clientId]
        );
        return { success: true, preferences: result.rows[0] || null };
    } catch (error) {
        logger.error('Erreur récupération préférences:', error);
        throw error;
    }
}

  /**
 * Récupérer une promotion par son code
 */
async getPromotionByCode(promotionCode) {
  try {
    const result = await query(
      `SELECT 
        metadata->>'promotion_code' as promotion_code,
        title,
        message,
        (metadata->>'discount_percentage')::int as discount_percentage,
        metadata->>'valid_until' as valid_until,
        metadata->>'terms' as terms
       FROM notifications 
       WHERE type = 'promotion' 
       AND metadata->>'promotion_code' = $1
       AND (expires_at IS NULL OR expires_at > CURRENT_TIMESTAMP)
       LIMIT 1`,
      [promotionCode]
    );
    
    if (result.rows.length === 0) {
      throw { statusCode: 404, code: 'NOT_FOUND', message: 'Promotion non trouvée' };
    }
    
    return { success: true, promotion: result.rows[0] };
  } catch (error) {
    logger.error('Erreur récupération promotion par code:', error);
    throw error;
  }
}


  /**
   * Notifications pour événements système
   */
  async createEventNotification(eventType, data) {
    const eventTemplates = {
      ORDER_CREATED: {
        title: '📦 Nouvelle commande',
        message: 'Une nouvelle commande a été créée par {company_name}',
        type: 'info'
      },
      ORDER_VALIDATED: {
        title: '✅ Commande validée',
        message: 'La commande {order_code} a été validée par {role}',
        type: 'success'
      },
      INVOICE_GENERATED: {
        title: '📄 Facture générée',
        message: 'Facture {invoice_number} générée pour la commande {order_code}',
        type: 'info'
      },
      PAYMENT_RECEIVED: {
        title: '💰 Paiement reçu',
        message: 'Paiement reçu pour la facture {invoice_number}',
        type: 'success'
      },
      QUOTA_LOW: {
        title: '⚠️ Quota faible',
        message: 'Le quota de {company_name} est faible ({remaining}/{total})',
        type: 'warning'
      },
      QUOTA_EXHAUSTED: {
        title: '🚨 Quota épuisé',
        message: 'Le quota de {company_name} est épuisé',
        type: 'error'
      },
      MESSAGE_FAILED: {
        title: '❌ Échec d\'envoi',
        message: 'Échec d\'envoi du message à {recipient_phone}',
        type: 'error'
      },
      SYSTEM_ALERT: {
        title: '🚨 Alerte système',
        message: '{message}',
        type: 'error'
      }
    };

    const template = eventTemplates[eventType];
    if (!template) {
      logger.warn('Template de notification non trouvé pour:', eventType);
      return null;
    }

    // Remplacer les variables dans le message
    let finalMessage = template.message;
    for (const [key, value] of Object.entries(data)) {
      finalMessage = finalMessage.replace(`{${key}}`, value);
    }

    const notificationData = {
      title: template.title,
      message: finalMessage,
      type: template.type,
      metadata: {
        event_type: eventType,
        ...data
      }
    };

    // Si un user_id est fourni, créer une notification personnelle
    if (data.user_id) {
      notificationData.user_id = data.user_id;
    } else if (data.client_id) {
      notificationData.client_id = data.client_id;
    }

    return await this.createNotification(notificationData);
  }
}

module.exports = new NotificationService();
