// src/routes/v1/reconciliation.routes.js
const {
    generateReportHandler,
    updateReportHandler,
    getReportsHandler,
    getReportByIdHandler,
    getBSPProvidersHandler,
    getStatisticsHandler,
    recalculateHandler,
    validateHandler,
    exportHandler
} = require('../../controllers/reconciliation.controller');
const { authenticateJWT } = require('../../middlewares/auth.middleware');
const { requireRole, ROLES } = require('../../middlewares/role.middleware');

async function reconciliationRoutes(fastify, options) {
    
    // GET /api/v1/reconciliation/bsp - Liste des BSP
    fastify.get('/bsp', {
        preHandler: [authenticateJWT, requireRole(ROLES.ADMIN, ROLES.FINANCIAL_MANAGER)]
    }, getBSPProvidersHandler);
    
    // GET /api/v1/reconciliation/statistics - Statistiques
    fastify.get('/statistics', {
        preHandler: [authenticateJWT, requireRole(ROLES.ADMIN, ROLES.FINANCIAL_MANAGER)]
    }, getStatisticsHandler);
    
    // POST /api/v1/reconciliation - Générer
    fastify.post('/', {
        preHandler: [authenticateJWT, requireRole(ROLES.ADMIN, ROLES.FINANCIAL_MANAGER)]
    }, generateReportHandler);
    
    // GET /api/v1/reconciliation - Liste
    fastify.get('/', {
        preHandler: [authenticateJWT, requireRole(ROLES.ADMIN, ROLES.FINANCIAL_MANAGER)]
    }, getReportsHandler);
    
    // GET /api/v1/reconciliation/:id - Détail
    fastify.get('/:id', {
        preHandler: [authenticateJWT, requireRole(ROLES.ADMIN, ROLES.FINANCIAL_MANAGER)]
    }, getReportByIdHandler);
    
    // PUT /api/v1/reconciliation/:id - Mettre à jour
    fastify.put('/:id', {
        preHandler: [authenticateJWT, requireRole(ROLES.ADMIN, ROLES.FINANCIAL_MANAGER)]
    }, updateReportHandler);
    
    // POST /api/v1/reconciliation/:id/recalculate - Recalculer
    fastify.post('/:id/recalculate', {
        preHandler: [authenticateJWT, requireRole(ROLES.ADMIN, ROLES.FINANCIAL_MANAGER)]
    }, recalculateHandler);
    
    // POST /api/v1/reconciliation/:id/validate - Valider/Rejeter
    fastify.post('/:id/validate', {
        preHandler: [authenticateJWT, requireRole(ROLES.ADMIN, ROLES.FINANCIAL_MANAGER)]
    }, validateHandler);
    
    // GET /api/v1/reconciliation/:id/export - Exporter CSV
    fastify.get('/:id/export', {
        preHandler: [authenticateJWT, requireRole(ROLES.ADMIN, ROLES.FINANCIAL_MANAGER)]
    }, exportHandler);

    fastify.get('/test/:id', {
    preHandler: [authenticateJWT]
}, async (request, reply) => {
    const { id } = request.params;
    const report = await reconciliationService.getReportById(id);
    return reply.send(report);
});

}

module.exports = reconciliationRoutes;
