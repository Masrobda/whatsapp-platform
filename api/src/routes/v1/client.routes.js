// src/routes/v1/client.routes.js
const { query } = require('../../config/database');
const logger = require('../../utils/logger');
const { v4: uuidv4 } = require('uuid');

// 1. Imports destructurés pour le contrôleur client
const {
  getProfileHandler,
  updateProfileHandler,
  getCredentialsHandler,
  getDashboardHandler,
  getAllClientsHandler,
  updatePricingHandler,
  rechargeQuotaHandler,
} = require('../../controllers/client.controller');

// 2. Import de l'objet complet pour le stockage
const storageController = require('../../controllers/storage.controller');
const orderController = require('../../controllers/order.controller');

const { authenticateJWT } = require('../../middlewares/auth.middleware');
const { requireRole, ROLES } = require('../../middlewares/role.middleware');

/**
 * Routes de gestion des clients
 */
async function clientRoutes(fastify, options) {

  // ============================================
  // ROUTES CLIENT (Profil & Dashboard)
  // ============================================

  fastify.get('/profile', {
    preHandler: [authenticateJWT],
    schema: {
      description: 'Récupérer le profil du client',
      tags: ['Client'],
      security: [{ bearerAuth: [] }]
    }
  }, getProfileHandler);

  fastify.put('/profile', {
    preHandler: [authenticateJWT],
    schema: {
      description: 'Mettre à jour le profil',
      tags: ['Client'],
      security: [{ bearerAuth: [] }],
      body: {
        type: 'object',
        properties: {
          company_name: { type: 'string' },
          phone: { type: 'string' },
          address: { type: 'string' },
          city: { type: 'string' },
          country: { type: 'string' },
          tax_id: { type: 'string' }
        }
      }
    }
  }, updateProfileHandler);

  fastify.get('/credentials', {
    preHandler: [authenticateJWT],
    schema: {
      description: 'Récupérer les identifiants API',
      tags: ['Client'],
      security: [{ bearerAuth: [] }]
    }
  }, getCredentialsHandler);

  fastify.get('/dashboard', {
    preHandler: [authenticateJWT],
    schema: {
      description: 'Récupérer le résumé du dashboard',
      tags: ['Client'],
      security: [{ bearerAuth: [] }]
    }
  }, getDashboardHandler);

  // ============================================
  // PERFORMANCE WHATSAPP
  // ============================================

  fastify.get('/whatsapp-performance', {
    preHandler: [authenticateJWT],
  }, async (request, reply) => {
    try {
      const clientId = request.user.id;
      const numbers = await query(
        `SELECT
            wn.phone_number, wn.display_name, wn.client_id,
            wn.quality_rating, wn.tier_current,
            wn.messages_sent_24h, wn.daily_conversation_limit,
            COUNT(m.id) FILTER (WHERE m.wa_status = 'sent') as total_sent,
            COUNT(m.id) FILTER (WHERE m.wa_status = 'failed') as total_failed
         FROM whatsapp_numbers wn
         LEFT JOIN messages m ON m.client_id = wn.client_id
                             AND m.created_at >= NOW() - INTERVAL '30 days'
         WHERE wn.client_id = $1 OR wn.client_id IS NULL
         GROUP BY wn.id
         ORDER BY wn.phone_number`,
        [clientId]
      );
      return reply.send({ success: true, performance: numbers.rows });
    } catch (err) {
      logger.error('Erreur dashboard whatsapp perf', err);
      return reply.code(500).send({ success: false, message: 'Erreur serveur' });
    }
  });

  // ============================================
  // ROUTES STOCKAGE CLIENT (Storage)
  // ============================================
  
  // Récupérer les offres disponibles
  fastify.get('/storage/offers', {
    preHandler: [authenticateJWT]
  }, async (request, reply) => {
    try {
      const result = await query(
        'SELECT * FROM storage_offers WHERE is_active = true ORDER BY storage_gb ASC'
      );
      return reply.send({ success: true, offers: result.rows });
    } catch (err) {
      logger.error('Erreur récupération offres:', err);
      return reply.code(500).send({ success: false, message: 'Erreur serveur' });
    }
  });

  // Créer une demande d'espace de stockage (avec validation)
  fastify.post('/storage/request', {
    preHandler: [authenticateJWT]
  }, async (request, reply) => {
    try {
      const clientId = request.user.id;
      const { offer_id, period_months = 1, period_type = 'month' } = request.body;

      if (!offer_id) {
        return reply.code(400).send({ 
          success: false, 
          message: "L'ID de l'offre est requis" 
        });
      }

      // Vérifier que l'offre existe
      const offerRes = await query(
        'SELECT * FROM storage_offers WHERE id = $1 AND is_active = true',
        [offer_id]
      );

      if (offerRes.rows.length === 0) {
        return reply.code(404).send({ 
          success: false, 
          message: "Offre non trouvée" 
        });
      }

      const offer = offerRes.rows[0];
      
      // Calculer le montant
      let amount = offer.price_fcfa * period_months;
      if (period_type === 'year') {
        amount = offer.price_year_fcfa;
      }

      // Générer un numéro de commande
      const orderNumber = `CMD-${new Date().getFullYear()}${String(new Date().getMonth() + 1).padStart(2, '0')}-${String(Math.floor(Math.random() * 10000)).padStart(4, '0')}`;
      const orderId = uuidv4();

      // Créer la commande
      await query(
        `INSERT INTO storage_orders 
         (id, client_id, offer_id, order_number, amount_fcfa, period_months, period_type, status)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
        [orderId, clientId, offer_id, orderNumber, amount, period_months, period_type, 'pending']
      );

      logger.info(`Demande de stockage créée: ${orderNumber} pour client ${clientId}`);

      return reply.send({
        success: true,
        message: "Demande de stockage créée avec succès. En attente de validation.",
        order: {
          id: orderId,
          number: orderNumber,
          amount: amount,
          status: 'pending',
          offer_name: offer.name,
          storage_gb: offer.storage_gb
        }
      });

    } catch (error) {
      logger.error('Erreur demande stockage:', error);
      return reply.code(500).send({ 
        success: false, 
        message: "Erreur lors de la création de la demande" 
      });
    }
  });

  // Récupérer les commandes du client
  fastify.get('/storage/orders', {
    preHandler: [authenticateJWT]
  }, async (request, reply) => {
    try {
      const clientId = request.user.id;
      
      const orders = await query(
        `SELECT o.*, off.name as offer_name, off.storage_gb,
                s.id as space_id, s.is_active as space_active, s.expires_at
         FROM storage_orders o
         LEFT JOIN storage_offers off ON o.offer_id = off.id
         LEFT JOIN storage_spaces s ON o.space_id = s.id
         WHERE o.client_id = $1
         ORDER BY o.created_at DESC`,
        [clientId]
      );

      return reply.send({ success: true, orders: orders.rows });
    } catch (err) {
      logger.error('Erreur récupération commandes:', err);
      return reply.code(500).send({ success: false, message: 'Erreur serveur' });
    }
  });

  // Récupérer l'abonnement actif du client
  fastify.get('/storage/subscription', {
    preHandler: [authenticateJWT]
  }, async (request, reply) => {
    try {
      const clientId = request.user.id;
      
      const subRes = await query(
        `SELECT s.*, o.offer_id, off.name as offer_name, off.storage_gb,
                o.amount_fcfa, o.period_months, o.order_number,
                (SELECT COUNT(*) FROM storage_files WHERE space_id = s.id AND is_deleted = false) as file_count
         FROM storage_spaces s
         LEFT JOIN storage_orders o ON s.order_id = o.id
         LEFT JOIN storage_offers off ON o.offer_id = off.id
         WHERE s.client_id = $1 AND s.deleted_at IS NULL
         ORDER BY s.created_at DESC
         LIMIT 1`,
        [clientId]
      );

      if (subRes.rows.length === 0) {
        return reply.code(404).send({ 
          success: false, 
          message: "Aucun abonnement actif" 
        });
      }

      return reply.send({ success: true, subscription: subRes.rows[0] });
    } catch (err) {
      logger.error('Erreur récupération abonnement:', err);
      return reply.code(500).send({ success: false, message: 'Erreur serveur' });
    }
  });

  // Récupérer les détails d'un espace de stockage
  fastify.get('/storage/space/:spaceId', {
    preHandler: [authenticateJWT]
  }, async (request, reply) => {
    try {
      const { spaceId } = request.params;
      const clientId = request.user.id;

      // Vérifier que l'espace appartient bien au client
      const spaceRes = await query(
        'SELECT * FROM storage_spaces WHERE id = $1 AND client_id = $2 AND deleted_at IS NULL',
        [spaceId, clientId]
      );

      if (spaceRes.rows.length === 0) {
        return reply.code(404).send({ 
          success: false, 
          message: "Espace non trouvé" 
        });
      }

      // Déléguer au contrôleur pour les détails complets
      return storageController.getStorageDetailHandler(request, reply);
      
    } catch (err) {
      logger.error('Erreur récupération espace:', err);
      return reply.code(500).send({ success: false, message: 'Erreur serveur' });
    }
  });

  // Upload de fichier
  fastify.post('/storage/space/:spaceId/upload', {
    preHandler: [authenticateJWT]
  }, storageController.uploadFileHandler);

  // Télécharger un fichier
  fastify.get('/storage/space/:spaceId/files/:filename', {
    preHandler: [authenticateJWT]
  }, storageController.downloadFileHandler);

  // Supprimer un fichier
  fastify.delete('/storage/space/:spaceId/files/:filename', {
    preHandler: [authenticateJWT]
  }, storageController.deleteFileHandler);

  // Renouvellement automatique (sans validation)
  fastify.post('/storage/renew', {
    preHandler: [authenticateJWT]
  }, async (request, reply) => {
    try {
      const clientId = request.user.id;
      const { offer_id, months = 12 } = request.body;

      // Vérifier si le client a un espace actif
      const spaceRes = await query(
        'SELECT * FROM storage_spaces WHERE client_id = $1 AND is_active = true AND deleted_at IS NULL',
        [clientId]
      );

      if (spaceRes.rows.length === 0) {
        return reply.code(404).send({ 
          success: false, 
          message: "Aucun espace actif à renouveler" 
        });
      }

      const space = spaceRes.rows[0];
      
      // Calculer nouvelle date d'expiration
      const newExpiry = new Date(space.expires_at);
      newExpiry.setMonth(newExpiry.getMonth() + months);

      // Mettre à jour l'espace
      await query(
        'UPDATE storage_spaces SET expires_at = $1, updated_at = now() WHERE id = $2',
        [newExpiry, space.id]
      );

      // Récupérer l'offre pour générer la facture
      const offerRes = await query(
        'SELECT * FROM storage_offers WHERE id = $1',
        [offer_id]
      );

      if (offerRes.rows.length > 0) {
        const offer = offerRes.rows[0];
        
        // Créer une commande de renouvellement
        const orderNumber = `REN-${new Date().getFullYear()}${String(new Date().getMonth() + 1).padStart(2, '0')}-${String(Math.floor(Math.random() * 10000)).padStart(4, '0')}`;
        
        await query(
          `INSERT INTO storage_orders 
           (id, client_id, offer_id, space_id, order_number, amount_fcfa, period_months, status, validation_date)
           VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)`,
          [uuidv4(), clientId, offer_id, space.id, orderNumber, offer.price_fcfa * months, months, 'paid', new Date()]
        );
      }

      return reply.send({
        success: true,
        message: `Abonnement renouvelé avec succès jusqu'au ${newExpiry.toLocaleDateString('fr-FR')}`,
        new_expiry: newExpiry
      });

    } catch (err) {
      logger.error('Erreur renouvellement:', err);
      return reply.code(500).send({ success: false, message: 'Erreur serveur' });
    }
  });

  // Obtenir les factures du client
  fastify.get('/storage/invoices', {
    preHandler: [authenticateJWT]
  }, async (request, reply) => {
    try {
      const clientId = request.user.id;
      
      const invoices = await query(
        `SELECT o.*, off.name as offer_name
         FROM storage_orders o
         LEFT JOIN storage_offers off ON o.offer_id = off.id
         WHERE o.client_id = $1 AND o.status IN ('paid', 'validated')
         ORDER BY o.created_at DESC`,
        [clientId]
      );

      return reply.send({ success: true, invoices: invoices.rows });
    } catch (err) {
      logger.error('Erreur récupération factures:', err);
      return reply.code(500).send({ success: false, message: 'Erreur serveur' });
    }
  });

  // Télécharger une facture
  fastify.get('/storage/invoice/:orderId/download', {
    preHandler: [authenticateJWT]
  }, async (request, reply) => {
    try {
      const { orderId } = request.params;
      const clientId = request.user.id;

      const invoiceRes = await query(
        'SELECT invoice_html, invoice_number FROM storage_orders WHERE id = $1 AND client_id = $2',
        [orderId, clientId]
      );

      if (invoiceRes.rows.length === 0 || !invoiceRes.rows[0].invoice_html) {
        return reply.code(404).send({ 
          success: false, 
          message: "Facture non trouvée" 
        });
      }

      const invoice = invoiceRes.rows[0];
      
      reply.header('Content-Type', 'text/html');
      reply.header('Content-Disposition', `attachment; filename="facture-${invoice.invoice_number}.html"`);
      
      return reply.send(invoice.invoice_html);
      
    } catch (err) {
      logger.error('Erreur téléchargement facture:', err);
      return reply.code(500).send({ success: false, message: 'Erreur serveur' });
    }
  });

  // ============================================
  // ROUTES ADMIN (Gestion des clients)
  // ============================================

  fastify.get('/all', {
    preHandler: [authenticateJWT, requireRole(ROLES.ADMIN)],
    schema: {
      description: 'Récupérer tous les clients (Admin)',
      tags: ['Client - Admin'],
      security: [{ bearerAuth: [] }]
    }
  }, getAllClientsHandler);

  fastify.put('/:id/pricing', {
    preHandler: [authenticateJWT, requireRole(ROLES.ADMIN, ROLES.FINANCIAL_MANAGER)],
    schema: {
      description: 'Mettre à jour le tarif d\'un client',
      tags: ['Client - Admin'],
      security: [{ bearerAuth: [] }]
    }
  }, updatePricingHandler);

  fastify.post('/:id/recharge', {
    preHandler: [authenticateJWT, requireRole(ROLES.ADMIN)],
    schema: {
      description: 'Recharger le quota d\'un client',
      tags: ['Client - Admin'],
      security: [{ bearerAuth: [] }]
    }
  }, rechargeQuotaHandler);

  // ============================================
  // ROUTES ADMIN STORAGE (Gestion des espaces)
  // ============================================
  const adminOptions = { preHandler: [authenticateJWT, requireRole(ROLES.ADMIN, ROLES.FINANCIAL_MANAGER)] };

  // Lister tous les espaces
  fastify.get('/admin/storage/spaces', adminOptions, storageController.getAllStorageSpacesHandler);

  // Récupérer les clients pour l'assignation
  fastify.get('/admin/storage/clients', adminOptions, storageController.getClientsListHandler);

  // Récupérer les fichiers d'un espace
  fastify.get('/admin/storage/:spaceId/files', adminOptions, storageController.getSpaceFilesHandler);

  // Modifier la taille
  fastify.put('/admin/storage/:spaceId/size', adminOptions, storageController.updateStorageSizeHandler);

  // Modifier l'expiration manuellement
  fastify.put('/admin/storage/:spaceId/expiration', adminOptions, storageController.updateExpirationHandler);

  // Renouveler (ajoute X mois)
  fastify.post('/admin/storage/:spaceId/renew', adminOptions, storageController.renewStorageSpaceHandler);

  // Réassigner à un autre client
  fastify.post('/admin/storage/:spaceId/reassign', adminOptions, storageController.reassignStorageSpaceHandler);

  // Bloquer
  fastify.post('/admin/storage/:spaceId/block', adminOptions, storageController.blockStorageSpaceHandler);

  // Activer
  fastify.post('/admin/storage/:spaceId/activate', adminOptions, storageController.activateStorageSpaceHandler);

  // Upload fichier (admin)
  fastify.post('/admin/storage/:spaceId/upload', adminOptions, storageController.uploadFileHandler);

  // Télécharger fichier (admin)
  fastify.get('/admin/storage/:spaceId/files/:filename', adminOptions, storageController.downloadFileHandler);

  // Supprimer fichier (admin)
  fastify.delete('/admin/storage/:spaceId/files/:filename', adminOptions, storageController.deleteFileHandler);

  // Valider une commande
  fastify.post('/admin/orders/:orderId/validate', {
    preHandler: [authenticateJWT, requireRole(ROLES.ADMIN, ROLES.FINANCIAL_MANAGER)]
  }, async (request, reply) => {
    try {
      const { orderId } = request.params;
      const adminId = request.user.id;

      // Vérifier que la commande existe et est en attente
      const orderRes = await query(
        `SELECT o.*, c.company_name, c.email, off.name as offer_name, off.storage_gb
         FROM storage_orders o
         JOIN clients c ON o.client_id = c.id
         JOIN storage_offers off ON o.offer_id = off.id
         WHERE o.id = $1 AND o.status = 'pending'`,
        [orderId]
      );

      if (orderRes.rows.length === 0) {
        return reply.code(404).send({ 
          success: false, 
          message: "Commande non trouvée ou déjà traitée" 
        });
      }

      const order = orderRes.rows[0];
      
      // Générer la facture
      const invoiceNumber = `FACT-${new Date().getFullYear()}${String(new Date().getMonth() + 1).padStart(2, '0')}-${String(Math.floor(Math.random() * 10000)).padStart(4, '0')}`;
      const invoiceHtml = `<html><body><h1>Facture ${invoiceNumber}</h1><p>Client: ${order.company_name}</p><p>Montant: ${order.amount_fcfa} FCFA</p></body></html>`;

      // Calculer date d'expiration
      const expiresAt = new Date();
      expiresAt.setMonth(expiresAt.getMonth() + order.period_months);

      // Créer l'espace de stockage
      const spaceId = uuidv4();
      const sizeLimitBytes = order.storage_gb * 1024 * 1024 * 1024;

      await query(
        `INSERT INTO storage_spaces 
         (id, client_id, order_id, size_limit_bytes, is_active, expires_at, activated_at, created_by)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
        [spaceId, order.client_id, orderId, sizeLimitBytes, true, expiresAt, new Date(), adminId]
      );

      // Mettre à jour la commande
      await query(
        `UPDATE storage_orders 
         SET status = 'validated', validation_date = now(), validated_by = $1,
             invoice_html = $2, invoice_number = $3, space_id = $4
         WHERE id = $5`,
        [adminId, invoiceHtml, invoiceNumber, spaceId, orderId]
      );

      logger.info(`Commande ${order.order_number} validée par admin ${adminId}`);

      return reply.send({
        success: true,
        message: "Commande validée avec succès",
        space_id: spaceId,
        invoice_number: invoiceNumber
      });

    } catch (err) {
      logger.error('Erreur validation commande:', err);
      return reply.code(500).send({ success: false, message: 'Erreur serveur' });
    }
  });

  // Lister les commandes en attente
  fastify.get('/admin/orders/pending', {
    preHandler: [authenticateJWT, requireRole(ROLES.ADMIN, ROLES.FINANCIAL_MANAGER)]
  }, async (request, reply) => {
    try {
      const orders = await query(
        `SELECT o.*, c.company_name, c.email, off.name as offer_name, off.storage_gb
         FROM storage_orders o
         JOIN clients c ON o.client_id = c.id
         JOIN storage_offers off ON o.offer_id = off.id
         WHERE o.status = 'pending'
         ORDER BY o.created_at DESC`
      );

      return reply.send({ success: true, orders: orders.rows });
    } catch (err) {
      logger.error('Erreur récupération commandes en attente:', err);
      return reply.code(500).send({ success: false, message: 'Erreur serveur' });
    }
  });

  // Statistiques stockage (admin)
  fastify.get('/admin/storage/stats', {
    preHandler: [authenticateJWT, requireRole(ROLES.ADMIN)]
  }, async (request, reply) => {
    try {
      const stats = await query(`
        SELECT 
          COUNT(*) as total_spaces,
          COUNT(*) FILTER (WHERE is_active = true) as active_spaces,
          COUNT(*) FILTER (WHERE expires_at < NOW()) as expired_spaces,
          SUM(size_limit_bytes) as total_allocated_bytes,
          SUM(current_usage_bytes) as total_used_bytes,
          AVG(current_usage_bytes::float / NULLIF(size_limit_bytes, 0) * 100) as avg_usage_percentage
        FROM storage_spaces
        WHERE deleted_at IS NULL
      `);

      return reply.send({ success: true, stats: stats.rows[0] });
    } catch (err) {
      logger.error('Erreur stats stockage:', err);
      return reply.code(500).send({ success: false, message: 'Erreur serveur' });
    }
  });

  // Bloquer / débloquer un client (temporaire ou permanent)
fastify.post('/:id/block', {
  preHandler: [authenticateJWT, requireRole(ROLES.ADMIN, ROLES.FINANCIAL_MANAGER)],
  schema: {
    description: 'Bloquer ou débloquer un client',
    tags: ['Client - Admin'],
    security: [{ bearerAuth: [] }],
    body: {
      type: 'object',
      properties: {
        blocked: { type: 'boolean' },           // true = bloquer, false = débloquer
        reason: { type: 'string' },             // raison du blocage
        duration_days: { type: 'integer' }      // optionnel : durée en jours (si absent → permanent)
      },
      required: ['blocked']
    }
  }
}, async (request, reply) => {
  try {
    const { id } = request.params;
    const { blocked, reason, duration_days } = request.body;
    const adminId = request.user.id;

    let blockExpiresAt = null;
    if (blocked && duration_days > 0) {
      blockExpiresAt = new Date();
      blockExpiresAt.setDate(blockExpiresAt.getDate() + duration_days);
    }

    await query(
      `UPDATE clients
       SET is_blocked = $1,
           block_reason = $2,
           block_expires_at = $3,
           updated_at = CURRENT_TIMESTAMP
       WHERE id = $4`,
      [blocked, reason || null, blockExpiresAt, id]
    );

    // Log d'audit
    await query(
      `INSERT INTO audit_logs (user_id, action, entity_type, entity_id, new_values)
       VALUES ($1, $2, $3, $4, $5)`,
      [
        adminId,
        blocked ? 'CLIENT_BLOCKED' : 'CLIENT_UNBLOCKED',
        'client',
        id,
        JSON.stringify({ blocked, reason, duration_days, expires_at: blockExpiresAt })
      ]
    );

    return reply.send({
      success: true,
      message: blocked
        ? (duration_days ? `Client bloqué pour ${duration_days} jours` : 'Client bloqué définitivement')
        : 'Client débloqué avec succès'
    });
  } catch (err) {
    logger.error('Erreur blocage client:', err);
    return reply.code(500).send({ success: false, message: 'Erreur serveur' });
  }
});

// Désactiver / réactiver définitivement (is_active)
fastify.post('/:id/toggle-active', {
  preHandler: [authenticateJWT, requireRole(ROLES.ADMIN)],
  schema: {
    description: 'Activer ou désactiver un compte client',
    tags: ['Client - Admin'],
    security: [{ bearerAuth: [] }],
    body: {
      type: 'object',
      properties: {
        active: { type: 'boolean' },
        reason: { type: 'string' }
      },
      required: ['active']
    }
  }
}, async (request, reply) => {
  try {
    const { id } = request.params;
    const { active, reason } = request.body;
    const adminId = request.user.id;

    await query(
      `UPDATE clients
       SET is_active = $1,
           updated_at = CURRENT_TIMESTAMP
       WHERE id = $2`,
      [active, id]
    );

    // Log d'audit
    await query(
      `INSERT INTO audit_logs (user_id, action, entity_type, entity_id, new_values)
       VALUES ($1, $2, $3, $4, $5)`,
      [
        adminId,
        active ? 'CLIENT_ACTIVATED' : 'CLIENT_DEACTIVATED',
        'client',
        id,
        JSON.stringify({ active, reason })
      ]
    );

    return reply.send({
      success: true,
      message: active ? 'Compte activé' : 'Compte désactivé définitivement'
    });
  } catch (err) {
    logger.error('Erreur activation/désactivation client:', err);
    return reply.code(500).send({ success: false, message: 'Erreur serveur' });
  }
});

fastify.delete('/:id', {
  preHandler: [authenticateJWT, requireRole(ROLES.ADMIN)], // uniquement admin
  schema: {
    description: 'Supprimer un client et toutes ses données associées',
    tags: ['Clients - Admin'],
    params: {
      type: 'object',
      required: ['id'],
      properties: {
        id: { type: 'string', format: 'uuid' }
      }
    },
    response: {
      200: {
        type: 'object',
        properties: {
          success: { type: 'boolean' },
          message: { type: 'string' }
        }
      }
    }
  }
}, async (request, reply) => {
  const { id } = request.params;

  try {
    // Le trigger BEFORE DELETE s'occupera de DROP la table messages_client_<id>
    const result = await query(
      'DELETE FROM clients WHERE id = $1 RETURNING id, email, company_name',
      [id]
    );

    if (result.rowCount === 0) {
      return reply.code(404).send({ success: false, message: 'Client non trouvé' });
    }

    const deletedClient = result.rows[0];

    // Insertion dans les logs d'audit
    await query(
      `INSERT INTO audit_logs (user_id, action, entity_type, entity_id, new_values)
       VALUES ($1, $2, $3, $4, $5)`,
      [request.user.id, 'CLIENT_DELETED', 'client', id, JSON.stringify(deletedClient)]
    );

    logger.info('Client supprimé avec succès', {
      clientId: deletedClient.id,
      email: deletedClient.email,
      company: deletedClient.company_name,
      by: request.user.id
    });

    return reply.send({
      success: true,
      message: `Client ${deletedClient.company_name} (${deletedClient.email}) supprimé avec succès`
    });
  } catch (err) {
    logger.error('Erreur suppression client:', err);
    return reply.code(500).send({
      success: false,
      message: 'Erreur lors de la suppression du client'
    });
  }
});

fastify.get('/quota', { preHandler: [authenticateJWT] }, async (request, reply) => {
  try {
    const clientId = request.user.id;
    const result = await query(
      `SELECT quota_total, quota_remaining, trial_expires_at,
        (SELECT COUNT(*) FROM messages 
         WHERE client_id = $1 
           AND created_at >= CURRENT_DATE 
           AND wa_status IN ('sent', 'delivered', 'read')) as daily_count
       FROM clients WHERE id = $1`,
      [clientId]
    );
    
    return reply.send({
      success: true,
      quota: {
        total: result.rows[0].quota_total,
        remaining: result.rows[0].quota_remaining,
        used: result.rows[0].quota_total - result.rows[0].quota_remaining,
        daily_limit: parseInt(process.env.TRIAL_MESSAGES_PER_DAY) || 5,
        daily_used: parseInt(result.rows[0].daily_count),
        trial_expires_at: result.rows[0].trial_expires_at,
        is_trial_active: result.rows[0].trial_expires_at && new Date() < new Date(result.rows[0].trial_expires_at)
      }
    });
  } catch (error) {
    return reply.code(500).send({ success: false, message: error.message });
  }
});

}

module.exports = clientRoutes;
