// src/routes/v1/session.routes.js
const sessionController = require('../../controllers/session.controller');
const { authenticateJWT } = require('../../middlewares/auth.middleware');
const { requireRole, ROLES } = require('../../middlewares/role.middleware');

async function sessionRoutes(fastify, opts) {
  // ────────────────────────────────────────────────
  // CLIENT-FACING : scopé au client authentifié via son token
  // ────────────────────────────────────────────────
  fastify.get('/status/:phone', { preHandler: [authenticateJWT] }, sessionController.getMyStatus);

  // ────────────────────────────────────────────────
  // DASHBOARD INTERNE : filtré par le client du token JWT
  // (aucun paramètre client_id externe n'est accepté)
  // ────────────────────────────────────────────────
  fastify.get('/stats', { preHandler: [authenticateJWT] }, sessionController.getStats);
  fastify.get('/', { preHandler: [authenticateJWT] }, sessionController.listSessions);

  // ────────────────────────────────────────────────
  // ROUTES ADMINISTRATIVES (explicites, réservées aux admins)
  // ────────────────────────────────────────────────
  fastify.get('/:client_id/:phone', {
    preHandler: [authenticateJWT, requireRole(ROLES.ADMIN)]
  }, sessionController.checkSession);

  fastify.post('/:client_id/:phone/reengage', {
    preHandler: [authenticateJWT, requireRole(ROLES.ADMIN)]
  }, sessionController.reengage);
}

module.exports = sessionRoutes;
