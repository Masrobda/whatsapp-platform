// src/routes/v1/whatsapp.routes.js
const whatsappController = require('../../controllers/whatsapp.controller');
const { authenticateJWT } = require('../../middlewares/auth.middleware');
const { requireRole, ROLES } = require('../../middlewares/role.middleware');

async function whatsappRoutes(fastify, options) {
    // Middleware pour tous les utilisateurs connectés
    const auth = { preHandler: [authenticateJWT] };
    const adminOnly = { preHandler: [authenticateJWT, requireRole(ROLES.ADMIN)] };

    // --- Routes ADMIN ---
    
    // Liste complète avec filtres
    fastify.get('/admin/numbers', adminOnly, whatsappController.getAllNumbersWithAssignments);
    
    // Statistiques globales
    fastify.get('/admin/numbers/stats', adminOnly, whatsappController.getNumbersStats);
    
    // Liste des clients pour assignation
    fastify.get('/admin/clients/list', adminOnly, whatsappController.getClientsList);
    
    // CRUD complet
    fastify.post('/admin/numbers', adminOnly, whatsappController.addNumber);
    fastify.get('/admin/numbers/:id', adminOnly, whatsappController.getNumberDetails);
    fastify.patch('/admin/numbers/:id', adminOnly, whatsappController.updateNumber);
    fastify.patch('/admin/numbers/:id/toggle', adminOnly, whatsappController.toggleNumberStatus);
    fastify.delete('/admin/numbers/:id', adminOnly, whatsappController.deleteNumber);
    
    // Import massif
    fastify.post('/admin/numbers/sync', adminOnly, whatsappController.syncNumbersBulk);
    
    // Réassignation
    fastify.patch('/admin/numbers/:id/reassign', adminOnly, whatsappController.reassignNumber);

    fastify.patch('/admin/numbers/:numberId/assignments/:clientId/limit', 
  adminOnly, 
  whatsappController.updateAssignmentLimit
);

    // --- Routes CLIENT ---
    
    // Mes numéros
    fastify.get('/my-numbers', auth, whatsappController.getMyNumbers);
    
    // Validation
    fastify.post('/numbers/validate', auth, whatsappController.validateClientNumber);
    fastify.get('/admin/numbers/:numberId/assignments', adminOnly, whatsappController.getNumberAssignments);
    fastify.post('/admin/numbers/:numberId/assign', adminOnly, whatsappController.assignNumberToClient);
    fastify.delete('/admin/numbers/:numberId/assignments/:clientId', adminOnly, whatsappController.removeNumberAssignment);

}

module.exports = whatsappRoutes;
