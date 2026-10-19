const {
  sendMessageHandler,
  getMessagesHandler,
  getMessageByIdHandler,
  getStatsHandler,
  exportCSVHandler,
  getQueueStatsHandler,
  getActiveJobsHandler,
  getFailedJobsHandler,
  retryJobHandler,
} = require('../../controllers/message.controller');

const { authenticateJWT, authenticateApiToken } = require('../../middlewares/auth.middleware');
const { requireRole, ROLES } = require('../../middlewares/role.middleware');
const queueService = require('../../services/queue.service'); // <--- CELUI-CI EST CRUCIAL
const { query } = require('../../config/database');
const logger = require('../../utils/logger');
const messageService = require('../../services/message.service');

/**
 * Routes de gestion des messages
 */
async function messageRoutes(fastify, options) {

  // ============================================
  // ROUTES API (Avec API Token)
  // ============================================

  // Envoyer un message (API Token OU JWT)
  // Dans message.routes.js, section POST /send

fastify.post('/send', {
  preHandler: [async (request, reply) => {
    try {
      await authenticateApiToken(request, reply);
    } catch {
      await authenticateJWT(request, reply);
    }
  }],
  schema: {
    description: 'Envoyer un message WhatsApp',
    tags: ['Messages'],
    security: [{ bearerAuth: [] }],
    body: {
      type: 'object',
      required: ['recipient_phone', 'message_type'],
      properties: {
        phoneNumber: { type: 'string' },
        recipient_phone: { type: 'string', pattern: '^\\+?[1-9]\\d{1,14}$' },
        message_type: { type: 'string', enum: ['text', 'template', 'media'] },
        message_content: { type: 'string' },
        template_name: { type: 'string' },
        template_language: { type: 'string', default: 'fr' },
        template_params: { type: 'object' },
        media_url: { type: 'string', format: 'uri' },
        media_type: { type: 'string', enum: ['image', 'video', 'document', 'audio'] },
        invoice_data: { type: 'object' }
      }
    },
    // 🔥 NOUVEAU SCHÉMA DE RÉPONSE – correspond à votre format admin
    response: {
      201: {
        type: 'array',
        items: {
          type: 'object',
          properties: {
            messages: { type: 'string' },
            data: {
              type: 'array',
              items: {
                type: 'object',
                properties: {
                  message_id: { type: ['string', 'null'] },
                  status: { type: 'string' },
                  to: { type: 'string' },
                  timestamp: { type: 'string' },
                  error: { type: 'string' }
                }
              }
            }
          }
        }
      },
      // Gestion des erreurs (401, 500, etc.) – laissez tel quel ou supprimez
      401: {
        type: 'array',
        items: {
          type: 'object',
          properties: {
            messages: { type: 'string' },
            data: {
              type: 'array',
              items: {
                type: 'object',
                properties: {
                  message_id: { type: 'null' },
                  status: { type: 'string' },
                  to: { type: 'string' },
                  timestamp: { type: 'string' },
                  error: { type: 'string' }
                }
              }
            }
          }
        }
      },
      500: {
        type: 'array',
        items: {
          type: 'object',
          properties: {
            messages: { type: 'string' },
            data: {
              type: 'array',
              items: {
                type: 'object',
                properties: {
                  message_id: { type: 'null' },
                  status: { type: 'string' },
                  to: { type: 'string' },
                  timestamp: { type: 'string' },
                  error: { type: 'string' }
                }
              }
            }
          }
        }
      }
    }
  }
}, sendMessageHandler);

  // ============================================
  // ROUTES CLIENT (Avec JWT)
  // ============================================

  // Récupérer les messages
  fastify.get('/', {
    preHandler: [authenticateJWT],
    schema: {
      description: 'Récupérer les messages du client',
      tags: ['Messages'],
      security: [{ bearerAuth: [] }],
      querystring: {
        type: 'object',
        properties: {
          page: { type: 'integer', default: 1 },
          limit: { type: 'integer', default: 5 },
          status: { 
            type: 'string',
            enum: ['queued', 'sent', 'delivered', 'read', 'failed']
          },
          recipient_phone: { type: 'string' },
          message_type: { 
            type: 'string',
            enum: ['text', 'template', 'media']
          },
          start_date: { type: 'string', format: 'date' },
          end_date: { type: 'string', format: 'date' }
        }
      }
    }
  }, getMessagesHandler);

fastify.get('/test-token', {
  preHandler: [authenticateApiToken],
}, async (request, reply) => {
  return {
    success: true,
    clientId: request.client?.id,
    token: request.headers.authorization
  };
});


  // Récupérer un message
  fastify.get('/:id', {
    preHandler: [authenticateJWT],
    schema: {
      description: 'Récupérer un message spécifique',
      tags: ['Messages'],
      security: [{ bearerAuth: [] }],
      params: {
        type: 'object',
        properties: {
          id: { type: 'string', format: 'uuid' }
        }
      }
    }
  }, getMessageByIdHandler);

  // Statistiques
  fastify.get('/stats/summary', {
  preHandler: [authenticateJWT],
  schema: {
    querystring: {
      type: 'object',
      properties: {
        period: { type: 'string', enum: ['24h', '7days', '15days', '30days', '90days', 'all'] },
        clientId: { type: 'string', format: 'uuid' }
      }
    }
  }
}, async (request, reply) => {
  const { period = '30days', clientId: queryClientId } = request.query;

  // Priorité : clientId en query > clientId du JWT > null (admin/global)
  const effectiveClientId = queryClientId || request.user?.client_id || request.user?.id || null;

  logger.info(`[STATS] Appel stats avec clientId=${effectiveClientId || 'global'}, period=${period}, user=${request.user?.id || 'anon'}`);

  try {
    // UTILISER messageService.getClientStats au lieu de preludeService.getStats
    const result = await messageService.getClientStats(effectiveClientId, period);
    
    // Vérifier que result existe et a les bonnes propriétés
    const stats = result.stats || {
      total_messages: 0,
      sent: 0,
      delivered: 0,
      read: 0,
      failed: 0,
      queued: 0
    };
    
    const dailyStats = result.daily_stats || [];
    
    // Formater les dates pour le frontend (format JJ/MM)
    const formattedDailyStats = dailyStats.map(day => ({
      date: day.date ? new Date(day.date).toLocaleDateString('fr-FR', { day: '2-digit', month: '2-digit' }) : '',
      sent: parseInt(day.sent) || parseInt(day.total) || 0,
      delivered: parseInt(day.delivered) || 0,
      read: parseInt(day.read) || 0,
      failed: parseInt(day.failed) || 0,
      queued: parseInt(day.queued) || 0
    }));
    
    // Retourner les données au format attendu par le frontend
    return reply.send({
      success: true,
      stats: {
        total_messages: parseInt(stats.total_messages) || 0,
        sent: parseInt(stats.sent) || 0,
        delivered: parseInt(stats.delivered) || 0,
        read: parseInt(stats.read) || 0,
        failed: parseInt(stats.failed) || 0,
        queued: parseInt(stats.queued) || 0
      },
      daily_stats: formattedDailyStats
    });
    
  } catch (err) {
    logger.error(`[STATS ERROR] clientId=${effectiveClientId || 'global'}:`, {
      message: err.message,
      stack: err.stack?.substring(0, 500)
    });
    
    // NE PAS CRASHER le dashboard : retourne stats vides
    return reply.send({
      success: true,  // important pour ne pas déclencher erreur frontend
      stats: {
        total_messages: 0,
        sent: 0,
        delivered: 0,
        read: 0,
        failed: 0,
        queued: 0
      },
      daily_stats: []
    });
  }
});

  // Export CSV
  fastify.get('/export/csv', {
    preHandler: [authenticateJWT],
    schema: {
      description: 'Exporter les messages en CSV',
      tags: ['Messages'],
      security: [{ bearerAuth: [] }],
      querystring: {
        type: 'object',
        properties: {
          status: { type: 'string' },
          start_date: { type: 'string', format: 'date' },
          end_date: { type: 'string', format: 'date' }
        }
      }
    }
  }, exportCSVHandler);

  // ============================================
  // ROUTES ADMIN (Monitoring de la file)
  // ============================================

  // Stats de la file d'attente
  fastify.get('/queue/stats', {
    preHandler: [authenticateJWT, requireRole(ROLES.ADMIN)],
    schema: {
      description: 'Statistiques de la file d\'attente',
      tags: ['Messages - Queue'],
      security: [{ bearerAuth: [] }]
    }
  }, getQueueStatsHandler);

  // Jobs actifs
  fastify.get('/queue/active', {
    preHandler: [authenticateJWT, requireRole(ROLES.ADMIN)],
    schema: {
      description: 'Jobs actifs dans la file',
      tags: ['Messages - Queue'],
      security: [{ bearerAuth: [] }],
      querystring: {
        type: 'object',
        properties: {
          limit: { type: 'integer', default: 10 }
        }
      }
    }
  }, getActiveJobsHandler);

  // Jobs échoués
  fastify.get('/queue/failed', {
    preHandler: [authenticateJWT, requireRole(ROLES.ADMIN)],
    schema: {
      description: 'Jobs échoués dans la file',
      tags: ['Messages - Queue'],
      security: [{ bearerAuth: [] }],
      querystring: {
        type: 'object',
        properties: {
          limit: { type: 'integer', default: 10 }
        }
      }
    }
  }, getFailedJobsHandler);

  // Réessayer un job
  fastify.post('/queue/:jobId/retry', {
    preHandler: [authenticateJWT, requireRole(ROLES.ADMIN)],
    schema: {
      description: 'Réessayer un job échoué',
      tags: ['Messages - Queue'],
      security: [{ bearerAuth: [] }],
      params: {
        type: 'object',
        properties: {
          jobId: { type: 'string' }
        }
      }
    }
  }, retryJobHandler);

// Dans admin.routes.js ou message.routes.js (à la fin de la fonction)

fastify.post('/whatsapp/:phoneNumber/pause', {
  preHandler: [authenticateJWT, requireRole(ROLES.ADMIN)],
  schema: {
    description: 'Mettre en pause la file d’attente d’un numéro WhatsApp',
    tags: ['Admin - WhatsApp'],
    security: [{ bearerAuth: [] }],
    params: {
      type: 'object',
      required: ['phoneNumber'],
      properties: {
        phoneNumber: { type: 'string', pattern: '^\\+[1-9]\\d{1,14}$' }
      }
    }
  }
}, require('../../controllers/whatsapp.monitor.controller').pauseQueueHandler);

fastify.post('/whatsapp/:phoneNumber/resume', {
  preHandler: [authenticateJWT, requireRole(ROLES.ADMIN)],
  schema: {
    description: 'Reprendre la file d’attente d’un numéro WhatsApp',
    tags: ['Admin - WhatsApp'],
    security: [{ bearerAuth: [] }],
    params: {
      type: 'object',
      required: ['phoneNumber'],
      properties: {
        phoneNumber: { type: 'string', pattern: '^\\+[1-9]\\d{1,14}$' }
      }
    }
  }
}, require('../../controllers/whatsapp.monitor.controller').resumeQueueHandler);

// POST /api/v1/admin/whatsapp/:phoneNumber/disable
fastify.post('/whatsapp/:phoneNumber/disable', {
  preHandler: [authenticateJWT, requireRole(ROLES.ADMIN)],
  schema: {
    description: 'Désactiver un numéro WhatsApp (is_active = false)',
    tags: ['Admin - WhatsApp'],
    security: [{ bearerAuth: [] }],
    params: {
      type: 'object',
      required: ['phoneNumber'],
      properties: {
        phoneNumber: { type: 'string', pattern: '^\\+[1-9]\\d{1,14}$' }
      }
    }
  }
}, async (request, reply) => {
  try {
    const { phoneNumber } = request.params;

    const res = await query(
      'UPDATE whatsapp_numbers SET is_active = false, updated_at = NOW() WHERE phone_number = $1 RETURNING phone_number',
      [phoneNumber]
    );

    if (res.rowCount === 0) {
      return reply.code(404).send({ success: false, message: 'Numéro non trouvé' });
    }

    // Optionnel : pause la queue en même temps
    await queueService.pauseQueueForNumber(phoneNumber);

    logger.info(`Numéro désactivé`, { phoneNumber, by: request.user.id });

    return reply.send({
      success: true,
      message: `Numéro ${phoneNumber} désactivé avec succès`
    });
  } catch (err) {
    logger.error('Erreur disable numéro', err);
    return reply.code(500).send({ success: false, message: 'Erreur serveur' });
  }
});

// POST /api/v1/admin/whatsapp/:phoneNumber/enable
fastify.post('/whatsapp/:phoneNumber/enable', {
  preHandler: [authenticateJWT, requireRole(ROLES.ADMIN)],
  schema: {
    description: 'Activer un numéro WhatsApp (is_active = true)',
    tags: ['Admin - WhatsApp'],
    security: [{ bearerAuth: [] }],
    params: {
      type: 'object',
      required: ['phoneNumber'],
      properties: {
        phoneNumber: { type: 'string', pattern: '^\\+[1-9]\\d{1,14}$' }
      }
    }
  }
}, async (request, reply) => {
  try {
    const { phoneNumber } = request.params;

    const res = await query(
      'UPDATE whatsapp_numbers SET is_active = true, updated_at = NOW() WHERE phone_number = $1 RETURNING phone_number',
      [phoneNumber]
    );

    if (res.rowCount === 0) {
      return reply.code(404).send({ success: false, message: 'Numéro non trouvé' });
    }

    // Optionnel : reprendre la queue
    await queueService.resumeQueueForNumber(phoneNumber);

    logger.info(`Numéro activé`, { phoneNumber, by: request.user.id });

    return reply.send({
      success: true,
      message: `Numéro ${phoneNumber} activé avec succès`
    });
  } catch (err) {
    logger.error('Erreur enable numéro', err);
    return reply.code(500).send({ success: false, message: 'Erreur serveur' });
  }
});

// POST /api/v1/admin/whatsapp/:phoneNumber/assign
fastify.post('/whatsapp/:phoneNumber/assign', {
  preHandler: [authenticateJWT, requireRole(ROLES.ADMIN)],
  schema: {
    description: 'Réassigner un numéro WhatsApp à un client différent',
    tags: ['Admin - WhatsApp'],
    security: [{ bearerAuth: [] }],
    params: {
      type: 'object',
      required: ['phoneNumber'],
      properties: { phoneNumber: { type: 'string' } }
    },
    body: {
      type: 'object',
      required: ['clientId'],
      properties: {
        clientId: { type: 'string', format: 'uuid' },
        notes: { type: 'string' }
      }
    }
  }
}, async (request, reply) => {
  try {
    const { phoneNumber } = request.params;
    const { clientId, notes } = request.body;

    // Vérifier que le client existe
    const clientCheck = await query('SELECT id FROM clients WHERE id = $1', [clientId]);
    if (clientCheck.rowCount === 0) {
      return reply.code(404).send({ success: false, message: 'Client non trouvé' });
    }

    const res = await query(
      `UPDATE whatsapp_numbers 
       SET client_id = $1, notes = COALESCE(notes || '\n' || $2, $2), updated_at = NOW() 
       WHERE phone_number = $3 
       RETURNING phone_number, client_id`,
      [clientId, notes || 'Réassigné par admin', phoneNumber]
    );

    if (res.rowCount === 0) {
      return reply.code(404).send({ success: false, message: 'Numéro non trouvé' });
    }

    logger.info(`Numéro réassigné`, { phoneNumber, newClientId: clientId, by: request.user.id });

    return reply.send({
      success: true,
      message: `Numéro ${phoneNumber} assigné au client ${clientId}`
    });
  } catch (err) {
    logger.error('Erreur assign numéro', err);
    return reply.code(500).send({ success: false, message: 'Erreur serveur' });
  }
});

// GET /api/v1/admin/whatsapp/numbers
// Liste complète des numéros avec statut + stats queue
fastify.get('/whatsapp/numbers', {
  preHandler: [authenticateJWT, requireRole(ROLES.ADMIN)],
  schema: {
    description: 'Liste complète des numéros WhatsApp avec statut et stats',
    tags: ['Admin - WhatsApp'],
    security: [{ bearerAuth: [] }],
    response: {
      200: {
        type: 'object',
        properties: {
          success: { type: 'boolean' },
          data: {  // Changé de 'numbers' à 'data' pour correspondre au contrôleur
            type: 'array',
            items: {
              type: 'object',
              properties: {
                id: { type: 'string', format: 'uuid' },
                phone_number: { type: 'string' },
                display_name: { type: 'string' },
                quality_rating: { type: 'string' },
                tier_current: { type: 'string' },
                client_id: { type: ['string', 'null'] },
                is_active: { type: 'boolean' },
                messages_sent_24h: { type: 'integer' },
                daily_conversation_limit: { type: 'integer' },
                created_at: { type: 'string', format: 'date-time' },
                updated_at: { type: 'string', format: 'date-time' },
                notes: { type: ['string', 'null'] },
                assignments: { type: 'array' },
                primary_client: { type: ['object', 'null'] }
              }
            }
          }
        }
      }
    }
  }
}, async (request, reply) => {
  try {
    // Importer le contrôleur ici pour éviter les dépendances circulaires
    const whatsappController = require('../../controllers/whatsapp.controller');
    
    // Appeler la fonction qui retourne les stats complètes
    const result = await whatsappController.getAllNumbersWithAssignments(request, reply);
    
    // Si la fonction a déjà envoyé une réponse, ne rien faire
    if (reply.sent) return;
    
    return result;
  } catch (err) {
    logger.error('Erreur récupération numéros:', err);
    return reply.status(500).send({ 
      success: false, 
      message: 'Erreur serveur' 
    });
  }
});
}

module.exports = messageRoutes;
