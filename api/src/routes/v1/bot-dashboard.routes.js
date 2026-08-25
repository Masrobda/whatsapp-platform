// src/routes/v1/bot-dashboard.routes.js
const botDashboardController = require('../../controllers/bot-dashboard.controller');
const { authenticateJWT } = require('../../middlewares/auth.middleware');
const { requireRole, ROLES } = require('../../middlewares/role.middleware');
const { query } = require('../../config/database');
const logger = require('../../utils/logger');
const validContactsController = require('../../controllers/valid-contacts.controller');

// Middleware de vérification de la clé API (pour les appels externes)
async function verifyApiKey(request, reply) {
  const apiKey = request.headers['x-api-key'];
  const expectedKey = process.env.INTERNAL_API_KEY;
  if (!apiKey || apiKey !== expectedKey) {
    reply.code(401).send({ success: false, message: 'Clé API invalide' });
    throw new Error('Clé API invalide');
  }
}

async function botDashboardRoutes(fastify, opts) {
  const adminOnly = { preHandler: [authenticateJWT, requireRole(ROLES.ADMIN)] };

  fastify.get('/stats', adminOnly, botDashboardController.getStats);
  fastify.get('/conversations', adminOnly, botDashboardController.listConversations);
  fastify.post('/conversations/:phone/unlock', adminOnly, botDashboardController.unlockConversation);
  fastify.get('/contracts', adminOnly, botDashboardController.listActivatedContacts);
  fastify.get('/link-clicks', adminOnly, botDashboardController.getLinkClicks);
  fastify.get('/invoices/stats', adminOnly, botDashboardController.getInvoiceStats);
  fastify.get('/invoices/export', adminOnly, botDashboardController.exportInvoices);
  fastify.get('/contracts/invoice-stats', adminOnly, botDashboardController.getContractInvoiceStats);
  fastify.get('/payment-clicks', adminOnly, botDashboardController.getPaymentClickStats);
  fastify.get('/whatsapp-sessions/stats', adminOnly, botDashboardController.getWhatsappSessionStats);
fastify.get('/whatsapp-sessions', adminOnly, botDashboardController.listWhatsappSessions);
fastify.get('/whatsapp-sessions/export', adminOnly, botDashboardController.exportWhatsappSessions);
  fastify.get('/whatsapp-sessions/stats/period', adminOnly, botDashboardController.getSessionStatsByPeriod);
  fastify.get('/valid-contacts', { preHandler: [verifyApiKey] }, validContactsController.getValidContacts);
  // ────────────────────────────────────────────────────────────────
  // ROUTE EXTERNE – Mise à jour des stats de facture (appelée par le script distant)
  // Protégée par une clé API, pas par JWT.
  // ────────────────────────────────────────────────────────────────
  fastify.post('/contracts/:contract_number/invoice-sent', { preHandler: [verifyApiKey] }, async (request, reply) => {
    try {
      const { contract_number } = request.params;
      const result = await query(
        `UPDATE contracts 
         SET last_invoice_sent_at = NOW(), 
             total_invoices_sent = total_invoices_sent + 1 
         WHERE contract_number = $1
         RETURNING id`,
        [contract_number]
      );
      if (result.rowCount === 0) {
        return reply.code(404).send({ success: false, message: 'Contrat non trouvé' });
      }
      return reply.send({ success: true });
    } catch (err) {
      request.log.error(err);
      return reply.code(500).send({ success: false, message: 'Erreur mise à jour' });
    }
  });
}

module.exports = botDashboardRoutes;
