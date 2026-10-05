// src/routes/v1/admin/prelude.routes.js
const preludeAdminController = require('../../../controllers/admin/prelude.admin.controller');
const { authenticateJWT } = require('../../../middlewares/auth.middleware');
const { requireRole, ROLES } = require('../../../middlewares/role.middleware');

async function adminPreludeRoutes(fastify, options) {
    const adminOnly = { preHandler: [authenticateJWT, requireRole(ROLES.ADMIN)] };

    // Dashboard
    fastify.get('/dashboard', adminOnly, preludeAdminController.getDashboardStats);
    
    // Clients
    fastify.get('/clients', adminOnly, preludeAdminController.getClientsWithPreferences);
    
    // Configuration
    fastify.post('/config/channels', adminOnly, preludeAdminController.updateGlobalChannelConfig);
    
    // Monitoring
    fastify.get('/monitoring/queues', adminOnly, preludeAdminController.getQueueMonitoring);
    fastify.get('/monitoring/logs', adminOnly, preludeAdminController.getMessageLogs);
    
    // Templates
    fastify.post('/templates/sync', adminOnly, preludeAdminController.syncTemplates);
    fastify.post('/templates/default', adminOnly, preludeAdminController.createDefaultTemplate);
}

module.exports = adminPreludeRoutes;
