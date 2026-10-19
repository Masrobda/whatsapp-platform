const statsController = require('../../controllers/stats.controller');
const { authenticateJWT } = require('../../middlewares/auth.middleware');
const { requireRole, ROLES } = require('../../middlewares/role.middleware');

async function statsRoutes(fastify, options) {
  const auth = { preHandler: [authenticateJWT] };
  const adminOnly = { preHandler: [authenticateJWT, requireRole(ROLES.ADMIN)] };

  // Vue d'ensemble - tous les utilisateurs authentifiés (filtre selon rôle)
  fastify.get('/overview', auth, statsController.getOverviewStats);
  
  // Stats par numéro - admin tous, client ses numéros
  fastify.get('/numbers', auth, statsController.getNumberStats);
  fastify.get('/numbers/:phone', auth, statsController.getNumberStats);
}

module.exports = statsRoutes;
