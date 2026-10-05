// src/routes/v1/storage.routes.js
module.exports = async function (fastify, opts) {
  // Logs de debug au chargement (exécutés une fois au boot)
  fastify.log.info('=== CHARGEMENT storage.routes.js ===');

  // Charger les controllers et middlewares
  const storageController = require('../../controllers/storage.controller');

  let ordersController;
  try {
    ordersController = require('../../controllers/orders.controller');
    fastify.log.info('ordersController chargé avec succès');
    fastify.log.info('getOffersHandler existe ?', typeof ordersController.getOffersHandler === 'function' ? 'OUI' : 'NON');
    fastify.log.info('createOrderHandler existe ?', typeof ordersController.createOrderHandler === 'function' ? 'OUI' : 'NON');
    fastify.log.info('validateOrderHandler existe ?', typeof ordersController.validateOrderHandler === 'function' ? 'OUI' : 'NON');
  } catch (err) {
    fastify.log.error('ERREUR CRITIQUE : impossible de charger orders.controller.js', err);
    throw err; // Arrête le boot pour debug
  }

  const { authenticateJWT } = require('../../middlewares/auth.middleware');
  const { requireRole, ROLES } = require('../../middlewares/role.middleware');

  const clientGuard = [authenticateJWT];
  const financialGuard = [authenticateJWT, requireRole(ROLES.ADMIN, ROLES.FINANCIAL_MANAGER)];

  // ROUTES CLIENT (accessibles aux utilisateurs connectés normaux)
  fastify.get('/offers', { preHandler: clientGuard }, ordersController.getOffersHandler);
  fastify.get('/client-orders', { preHandler: clientGuard }, ordersController.getClientOrdersHandler);
  fastify.post('/order', { preHandler: clientGuard }, ordersController.createOrderHandler);
  fastify.post('/order/renew', { preHandler: clientGuard }, ordersController.renewOrderHandler);
  fastify.get('/subscription', { preHandler: clientGuard }, ordersController.getClientSubscriptionHandler);
  fastify.get('/upgrade-options', { preHandler: clientGuard }, ordersController.getUpgradeOptionsHandler);
  fastify.post('/subscription/upgrade', { preHandler: clientGuard }, ordersController.upgradeSubscriptionHandler);
  fastify.post('/subscription/cancel', { preHandler: clientGuard }, ordersController.cancelSubscriptionHandler);
  fastify.put('/subscription/auto-renew', { preHandler: clientGuard }, ordersController.toggleAutoRenewHandler);

  // Liste tous les fichiers du client (nouvelle route)
  fastify.get('/client/storage/files', { preHandler: clientGuard }, async (request, reply) => {
    const clientId = request.user.id;
    try {
      const { rowCount, rows } = await fastify.pg.query( // ← utilise fastify.pg si configuré, sinon ton helper query
        `SELECT f.*, s.id as space_id, s.expires_at
         FROM storage_files f
         JOIN storage_spaces s ON f.space_id = s.id
         WHERE s.client_id = $1 AND f.is_deleted = false
         ORDER BY f.uploaded_at DESC`,
        [clientId]
      );
      return reply.send({ success: true, files: rows, count: rowCount });
    } catch (err) {
      fastify.log.error('Erreur liste fichiers client:', err);
      return reply.status(500).send({ success: false, message: 'Erreur serveur' });
    }
  });

// Récupérer l'espace de stockage par défaut du client connecté (le plus récent et actif)
fastify.get('/client/storage', {
  preHandler: clientGuard,
  schema: {
    description: "Récupérer l'espace de stockage par défaut du client connecté (le plus récent et actif)",
    tags: ['Stockage - Client'],
    security: [{ bearerAuth: [] }],
    response: {
      200: {
        type: 'object',
        properties: {
          success: { type: 'boolean' },
          id: { type: 'string', format: 'uuid' },
          client_id: { type: 'string', format: 'uuid' },
          size_limit_bytes: { type: 'number' },
          size_limit_formatted: { type: 'string' },
          current_usage_bytes: { type: 'number' },
          current_usage_formatted: { type: 'string' },
          usage_percentage: { type: 'number' },
          is_active: { type: 'boolean' },
          is_expired: { type: 'boolean' },
          is_blocked: { type: 'boolean' },
          blocked_reason: { type: ['string', 'null'] },
          expires_at: { type: ['string', 'null'], format: 'date-time' },
          created_at: { type: 'string', format: 'date-time' },
          offer_id: { type: ['string', 'null'], format: 'uuid' },
          period_months: { type: ['number', 'null'] }
        }
      },
      401: {
        type: 'object',
        properties: {
          success: { type: 'boolean' },
          message: { type: 'string' }
        }
      },
      404: {
        type: 'object',
        properties: {
          success: { type: 'boolean' },
          message: { type: 'string' }
        }
      },
      500: {
        type: 'object',
        properties: {
          success: { type: 'boolean' },
          message: { type: 'string' }
        }
      }
    }
  }
}, storageController.getClientDefaultStorageHandler);

// ---- NOUVELLE ROUTE : suppression massive ----
fastify.delete('/client/storage/:spaceId/delete-all-files', {
  preHandler: clientGuard
}, storageController.deleteAllFilesHandler);

   // Récupérer toutes les factures du client
fastify.get('/invoices', {
  preHandler: [authenticateJWT]
}, async (request, reply) => {
  try {
    const clientId = request.user.id;

    // Récupérer les commandes validées/payées du client
    const { rows } = await fastify.pg.query(
      `SELECT o.*, off.name as offer_name, off.storage_gb
       FROM storage_orders o
       LEFT JOIN storage_offers off ON o.offer_id = off.id
       WHERE o.client_id = $1 AND o.status IN ('paid', 'validated', 'pending')
       ORDER BY o.created_at DESC`,
      [clientId]
    );

    return reply.send({ success: true, invoices: rows });
  } catch (err) {
    fastify.log.error('Erreur récupération factures:', err);
    return reply.status(500).send({ success: false, message: 'Erreur serveur' });
  }
});

// Télécharger une facture
fastify.get('/invoice/:orderId/download', {
  preHandler: [authenticateJWT]
}, async (request, reply) => {
  try {
    const { orderId } = request.params;
    const clientId = request.user.id;

    const { rows } = await fastify.pg.query(
      'SELECT invoice_html, invoice_number FROM storage_orders WHERE id = $1 AND client_id = $2',
      [orderId, clientId]
    );

    if (rows.length === 0 || !rows[0].invoice_html) {
      return reply.status(404).send({
        success: false,
        message: "Facture non trouvée"
      });
    }

    const invoice = rows[0];

    reply.header('Content-Type', 'text/html');
    reply.header('Content-Disposition', `attachment; filename="facture-${invoice.invoice_number}.html"`);

    return reply.send(invoice.invoice_html);

  } catch (err) {
    fastify.log.error('Erreur téléchargement facture:', err);
    return reply.status(500).send({ success: false, message: 'Erreur serveur' });
  }
});

  // ROUTES CLIENT STOCKAGE (détails, upload, download, delete)
  fastify.get('/client/storage/:spaceId', { preHandler: clientGuard }, storageController.getStorageDetailHandler);
  fastify.post('/client/storage/:spaceId/upload', { preHandler: clientGuard }, storageController.uploadFileHandler);
  fastify.get('/client/storage/:spaceId/files/:filename', { preHandler: clientGuard }, storageController.downloadFileHandler);
  fastify.delete('/client/storage/:spaceId/files/:filename', { preHandler: clientGuard }, storageController.deleteFileHandler);
  
  // Route publique (sans authentification)
   fastify.get('/s/:token/:filename?', storageController.getPublicFileHandler);
   fastify.log.info('✅ Route publique courte /s/:token enregistrée');

  // ROUTES ADMIN (protégées par financialGuard)
  fastify.get('/admin/storage', { preHandler: financialGuard }, storageController.getAllStorageSpacesHandler);
  fastify.get('/admin/clients', { preHandler: financialGuard }, storageController.getClientsListHandler);
  fastify.get('/admin/storage/:spaceId/files', { preHandler: financialGuard }, storageController.getSpaceFilesHandler);
  fastify.put('/admin/storage/:spaceId/size', { preHandler: financialGuard }, storageController.updateStorageSizeHandler);
  fastify.put('/admin/storage/:spaceId/expiration', { preHandler: financialGuard }, storageController.updateExpirationHandler);
  fastify.post('/admin/storage/:spaceId/renew', { preHandler: financialGuard }, storageController.renewStorageSpaceHandler);
  fastify.post('/admin/storage/:spaceId/reassign', { preHandler: financialGuard }, storageController.reassignStorageSpaceHandler);
  fastify.post('/admin/storage/:spaceId/block', { preHandler: financialGuard }, storageController.blockStorageSpaceHandler);
  fastify.post('/admin/storage/:spaceId/activate', { preHandler: financialGuard }, storageController.activateStorageSpaceHandler);

  // ROUTE VALIDATION COMMANDE (très importante)
  fastify.post('/admin/orders/:orderId/validate', { preHandler: financialGuard }, ordersController.validateOrderHandler);

  // ROUTE DEBUG PENDING (guard enlevé temporairement pour test)
  fastify.get('/admin/orders/pending', { preHandler: financialGuard }, async (request, reply) => {
    try {
      const { rowCount, rows } = await fastify.pg.query(
        `SELECT o.*, c.company_name, c.email, off.name as offer_name
         FROM storage_orders o
         JOIN clients c ON o.client_id = c.id
         JOIN storage_offers off ON o.offer_id = off.id
         WHERE o.status = 'pending'
         ORDER BY o.created_at DESC`
      );

      fastify.log.info('[PENDING ORDERS DEBUG] Nombre trouvées :', rowCount);
      fastify.log.info('[PENDING ORDERS DEBUG] Résultat :', JSON.stringify(rows, null, 2));

      return reply.send({ success: true, orders: rows });
    } catch (err) {
      fastify.log.error('[PENDING ORDERS ERROR]', err);
      return reply.status(500).send({ success: false, message: 'Erreur serveur' });
    }
  });
};
