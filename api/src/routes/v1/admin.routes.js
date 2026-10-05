// src/routes/v1/admin.routes.js
const { query } = require('../../config/database');
const logger = require('../../utils/logger');
const { v4: uuidv4 } = require('uuid');

// Import des contrôleurs
const whatsappAdminController = require('../../controllers/whatsapp.admin.controller');
const storageController = require('../../controllers/storage.controller');

// Middlewares
const { authenticateJWT } = require('../../middlewares/auth.middleware');
const { requireRole, ROLES } = require('../../middlewares/role.middleware');
const invoiceService = require('../../services/invoices.service');

/**
 * Routes d'administration (toutes protégées)
 */
async function adminRoutes(fastify, options) {
  // Guards communs
const adminGuard = { preHandler: [authenticateJWT, requireRole(ROLES.ADMIN)] };
const financialGuard = { preHandler: [authenticateJWT, requireRole(ROLES.ADMIN, ROLES.FINANCIAL_MANAGER)] };

  // ============================================
  // DASHBOARD ADMIN
  // ============================================
  fastify.get('/dashboard', adminGuard, async (request, reply) => {
    try {
      const stats = await query(`
        SELECT
          (SELECT COUNT(*) FROM clients) as total_clients,
          (SELECT COUNT(*) FROM storage_spaces WHERE is_active = true) as active_spaces,
          (SELECT COUNT(*) FROM storage_orders WHERE status = 'pending') as pending_orders,
          (SELECT COUNT(*) FROM storage_orders WHERE status = 'validated' AND created_at >= NOW() - INTERVAL '30 days') as orders_last_30_days,
          (SELECT COALESCE(SUM(amount_fcfa), 0) FROM storage_orders WHERE status = 'validated' AND created_at >= NOW() - INTERVAL '30 days') as revenue_last_30_days
      `);
      return reply.send({ success: true, dashboard: stats.rows[0] });
    } catch (err) {
      logger.error('Erreur dashboard admin:', err);
      return reply.code(500).send({ success: false, message: 'Erreur serveur' });
    }
  });

  // ============================================
  // WHATSAPP NUMBERS
  // ============================================
  fastify.get('/whatsapp/numbers', financialGuard, whatsappAdminController.getAllWhatsappNumbers);
  fastify.get('/whatsapp/:phoneNumber', financialGuard, whatsappAdminController.getWhatsappNumberDetail);
  fastify.post('/whatsapp/:phoneNumber/pause', financialGuard, whatsappAdminController.pauseQueueHandler);
  fastify.post('/whatsapp/:phoneNumber/resume', financialGuard, whatsappAdminController.resumeQueueHandler);
  fastify.post('/whatsapp/:phoneNumber/disable', financialGuard, whatsappAdminController.disableWhatsappNumberHandler);
  fastify.post('/whatsapp/:phoneNumber/enable', financialGuard, whatsappAdminController.enableWhatsappNumberHandler);
  fastify.post('/whatsapp/:phoneNumber/assign', financialGuard, whatsappAdminController.assignWhatsappNumberHandler);

  // ============================================
  // ESPACES DE STOCKAGE
  // ============================================
  fastify.get('/storage/spaces', financialGuard, storageController.getAllStorageSpacesHandler);
  
  fastify.get('/storage/space/:spaceId', financialGuard, async (request, reply) => {
    try {
      const { spaceId } = request.params;
      const spaceRes = await query(
        `SELECT s.*, c.company_name, c.email, o.order_number, o.amount_fcfa, off.name as offer_name
         FROM storage_spaces s
         LEFT JOIN clients c ON s.client_id = c.id
         LEFT JOIN storage_orders o ON s.order_id = o.id
         LEFT JOIN storage_offers off ON o.offer_id = off.id
         WHERE s.id = $1`,
        [spaceId]
      );
      if (spaceRes.rows.length === 0) {
        return reply.code(404).send({ success: false, message: "Espace non trouvé" });
      }
      return reply.send({ success: true, space: spaceRes.rows[0] });
    } catch (err) {
      logger.error('Erreur récupération espace:', err);
      return reply.code(500).send({ success: false, message: 'Erreur serveur' });
    }
  });

  // CRUD espaces
  fastify.post('/storage/space', adminGuard, storageController.createStorageSpaceHandler);
  fastify.put('/storage/space/:spaceId/size', financialGuard, storageController.updateStorageSizeHandler);
  fastify.put('/storage/space/:spaceId/expiration', financialGuard, storageController.updateExpirationHandler);
  fastify.post('/storage/space/:spaceId/renew', financialGuard, storageController.renewStorageSpaceHandler);
  fastify.post('/storage/space/:spaceId/reassign', financialGuard, storageController.reassignStorageSpaceHandler);
  fastify.post('/storage/space/:spaceId/block', financialGuard, storageController.blockStorageSpaceHandler);
  fastify.post('/storage/space/:spaceId/activate', financialGuard, storageController.activateStorageSpaceHandler);
  fastify.delete('/storage/space/:spaceId', adminGuard, storageController.deleteStorageSpaceHandler);

  // Gestion des fichiers
  fastify.get('/storage/space/:spaceId/files', financialGuard, storageController.getSpaceFilesHandler);
  fastify.post('/storage/space/:spaceId/upload', financialGuard, storageController.uploadFileHandler);
  fastify.get('/storage/space/:spaceId/files/:filename', financialGuard, storageController.downloadFileHandler);
  fastify.delete('/storage/space/:spaceId/files/:filename', financialGuard, storageController.deleteFileHandler);

  // ============================================
  // OFFRES DE STOCKAGE (CRUD)
  // ============================================
  fastify.get('/storage/offers', financialGuard, storageController.getAllOffersHandler);
  fastify.post('/storage/offers', adminGuard, storageController.createOfferHandler);
  fastify.put('/storage/offers/:offerId', adminGuard, storageController.updateOfferHandler);
  fastify.delete('/storage/offers/:offerId', adminGuard, storageController.deleteOfferHandler);

  // ============================================
  // COMMANDES STORAGE - POINTS D'ENTRÉE CORRIGÉS
  // ============================================
  
  // Liste toutes les commandes
  fastify.get('/orders', financialGuard, async (request, reply) => {
    try {
      const orders = await query(`
        SELECT o.*, c.company_name, c.email, off.name as offer_name, off.storage_gb,
               s.id as space_id, s.is_active as space_active
        FROM storage_orders o
        JOIN clients c ON o.client_id = c.id
        LEFT JOIN storage_offers off ON o.offer_id = off.id
        LEFT JOIN storage_spaces s ON o.space_id = s.id
        ORDER BY o.created_at DESC
      `);
      return reply.send({ success: true, orders: orders.rows });
    } catch (err) {
      logger.error('Erreur récupération commandes:', err);
      return reply.code(500).send({ success: false, message: 'Erreur serveur' });
    }
  });

  // Commandes en attente
  fastify.get('/orders/pending', financialGuard, async (request, reply) => {
    try {
      const orders = await query(
        `SELECT o.*, c.company_name as client_name, c.email as client_email,
                off.name as offer_name, off.storage_gb
         FROM storage_orders o
         JOIN clients c ON o.client_id = c.id
         JOIN storage_offers off ON o.offer_id = off.id
         WHERE o.status = 'pending'
         ORDER BY o.created_at ASC`
      );
      return reply.send({ success: true, orders: orders.rows });
    } catch (err) {
      logger.error('Erreur commandes pending:', err);
      return reply.code(500).send({ success: false, message: 'Erreur serveur' });
    }
  });

  // Détails d'une commande
  fastify.get('/orders/:orderId', financialGuard, async (request, reply) => {
    try {
      const { orderId } = request.params;
      const orderRes = await query(
        `SELECT o.*, c.company_name, c.email, c.phone, c.address,
                off.name as offer_name, off.storage_gb, off.features,
                s.id as space_id, s.is_active as space_active, s.expires_at
         FROM storage_orders o
         JOIN clients c ON o.client_id = c.id
         LEFT JOIN storage_offers off ON o.offer_id = off.id
         LEFT JOIN storage_spaces s ON o.space_id = s.id
         WHERE o.id = $1`,
        [orderId]
      );

      if (orderRes.rows.length === 0) {
        return reply.code(404).send({ success: false, message: "Commande non trouvée" });
      }
      return reply.send({ success: true, order: orderRes.rows[0] });
    } catch (err) {
      logger.error('Erreur récupération commande:', err);
      return reply.code(500).send({ success: false, message: 'Erreur serveur' });
    }
  });

  // VALIDER une commande (avec vérification client)
fastify.post('/orders/:orderId/validate', financialGuard, async (request, reply) => {
    try {
      const { orderId } = request.params;
      const adminId = request.user.id;

      // Récupérer la commande
      const orderRes = await query(
        `SELECT o.*, c.id as client_id, c.company_name, c.email,
                off.name as offer_name, off.storage_gb
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
    //  const invoiceHtml = generateInvoiceHtml(order, invoiceNumber);
        const invoiceHtml = await generateProfessionalInvoice(order, invoiceNumber);

      // Calculer date d'expiration
      const expiresAt = new Date();
      expiresAt.setMonth(expiresAt.getMonth() + order.period_months);

      // Créer l'espace de stockage
      const spaceId = uuidv4();
      const sizeLimitBytes = order.storage_gb * 1024 * 1024 * 1024;

      // 1. Créer l'espace
      await query(
        `INSERT INTO storage_spaces
         (id, client_id, order_id, size_limit_bytes, is_active, expires_at, activated_at, created_by)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
        [spaceId, order.client_id, orderId, sizeLimitBytes, true, expiresAt, new Date(), adminId]
      );

      // 2. Mettre à jour la commande
      await query(
        `UPDATE storage_orders
         SET status = 'validated',
             validation_date = NOW(),
             validated_by = $1,
             invoice_html = $2,
             invoice_number = $3,
             space_id = $4
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
      return reply.code(500).send({ 
        success: false, 
        message: 'Erreur serveur lors de la validation'
      });
    }
  });

  // ANNULER une commande
  fastify.post('/orders/:orderId/cancel', financialGuard, async (request, reply) => {
    try {
      const { orderId } = request.params;
      await query(
        `UPDATE storage_orders SET status = 'cancelled', updated_at = NOW() WHERE id = $1 AND status = 'pending'`,
        [orderId]
      );
      return reply.send({ success: true, message: "Commande annulée" });
    } catch (err) {
      logger.error('Erreur annulation commande:', err);
      return reply.code(500).send({ success: false, message: 'Erreur serveur' });
    }
  });

  // ============================================
  // STATISTIQUES
  // ============================================
  fastify.get('/stats/storage', adminGuard, async (request, reply) => {
    try {
      const stats = await query(`
        SELECT
          COUNT(*) as total_spaces,
          COUNT(*) FILTER (WHERE is_active = true) as active_spaces,
          COUNT(*) FILTER (WHERE expires_at < NOW()) as expired_spaces,
          COALESCE(SUM(size_limit_bytes), 0) as total_allocated_bytes,
          COALESCE(SUM(current_usage_bytes), 0) as total_used_bytes,
          COUNT(DISTINCT client_id) as clients_with_space
        FROM storage_spaces WHERE deleted_at IS NULL
      `);

      const ordersStats = await query(`
        SELECT
          COUNT(*) as total_orders,
          COUNT(*) FILTER (WHERE status = 'pending') as pending_orders,
          COUNT(*) FILTER (WHERE status = 'validated') as validated_orders,
          COALESCE(SUM(amount_fcfa) FILTER (WHERE status = 'validated'), 0) as total_revenue
        FROM storage_orders
      `);

      return reply.send({ success: true, stats: { spaces: stats.rows[0], orders: ordersStats.rows[0] } });
    } catch (err) {
      logger.error('Erreur stats stockage:', err);
      return reply.code(500).send({ success: false, message: 'Erreur serveur' });
    }
  });

  // ============================================
  // CLIENTS
  // ============================================
  fastify.get('/clients', financialGuard, async (request, reply) => {
    try {
      const clients = await query(`
        SELECT c.*, COUNT(DISTINCT s.id) as spaces_count
        FROM clients c
        LEFT JOIN storage_spaces s ON c.id = s.client_id AND s.deleted_at IS NULL
        GROUP BY c.id ORDER BY c.created_at DESC
      `);
      return reply.send({ success: true, clients: clients.rows });
    } catch (err) {
      logger.error('Erreur récupération clients:', err);
      return reply.code(500).send({ success: false, message: 'Erreur serveur' });
    }
  });

  fastify.get('/clients-simple', {
    preHandler: [authenticateJWT, requireRole(ROLES.ADMIN, ROLES.COMMERCIAL)]
  }, async (request, reply) => {
    try {
      const result = await query(
        'SELECT id, company_name, email FROM clients ORDER BY company_name'
      );
      return reply.send({ success: true, data: result.rows });
    } catch (err) {
      logger.error('Erreur route clients-simple:', err);
      return reply.status(500).send({ success: false, message: err.message });
    }
  });

}

// Fonction helper pour la facture
//function generateInvoiceHtml(order, invoiceNumber) {
  //const date = new Date().toLocaleDateString('fr-FR');
 // const amountFormatted = new Intl.NumberFormat('fr-FR', { style: 'currency', currency: 'XOF', minimumFractionDigits: 0 }).format(order.amount_fcfa);

 // return `<html><body style="font-family: Arial; padding: 20px;">
   // <h1 style="color:#2ecc71;">NUMERICEXPORT</h1>
   // <h2>FACTURE ${invoiceNumber}</h2>
   // <p><strong>Client:</strong> ${order.company_name}</p>
  //  <p><strong>Email:</strong> ${order.email}</p>
  //  <p><strong>Offre:</strong> ${order.offer_name} (${order.storage_gb} Go)</p>
  //  <p><strong>Montant:</strong> ${amountFormatted}</p>
  //  <p><strong>Date:</strong> ${date}</p>
  //  <p><em>Validée - Paiement par virement bancaire</em></p>
 // </body></html>`;
//}

async function generateProfessionalInvoice(order, invoiceNumber) {
    try {
        // Préparer les données pour le service de facture
        const invoiceData = {
            invoiceNumber: invoiceNumber,
            orderNumber: order.order_number,
            clientName: order.company_name,
            clientEmail: order.email,
            amount: order.amount_fcfa,
            months: order.period_months,
            offerName: order.offer_name,
            storageGb: order.storage_gb,
            space: {
                company_name: order.company_name,
                email: order.email,
                storage_gb: order.storage_gb
            },
            date: new Date(),
            status: 'validated'
        };

        // Appeler le service pour générer la facture professionnelle
        const html = await invoiceService.generateInvoice(invoiceData);
        return html;
    } catch (err) {
        console.error('Erreur génération facture professionnelle:', err);
        // Fallback vers l'ancien format en cas d'erreur
        const date = new Date().toLocaleDateString('fr-FR');
        const amountFormatted = new Intl.NumberFormat('fr-FR', { 
            style: 'currency', 
            currency: 'XOF', 
            minimumFractionDigits: 0 
        }).format(order.amount_fcfa);

        return `<html><body style="font-family: Arial; padding: 20px;">
            <h1 style="color:#2ecc71;">NUMERICEXPORT</h1>
            <h2>FACTURE ${invoiceNumber}</h2>
            <p><strong>Client:</strong> ${order.company_name}</p>
            <p><strong>Email:</strong> ${order.email}</p>
            <p><strong>Offre:</strong> ${order.offer_name} (${order.storage_gb} Go)</p>
            <p><strong>Montant:</strong> ${amountFormatted}</p>
            <p><strong>Date:</strong> ${date}</p>
            <p><em>Validée - Paiement par virement bancaire</em></p>
        </body></html>`;
    }
}

module.exports = adminRoutes;
