const templateAssignmentController = require('../../controllers/template-assignment.controller');
const { authenticateJWT } = require('../../middlewares/auth.middleware');
const { requireRole, ROLES } = require('../../middlewares/role.middleware');
const { query } = require('../../config/database');
const logger = require('../../utils/logger');

async function templateAssignmentRoutes(fastify, options) {
  const adminOnly = { preHandler: [authenticateJWT, requireRole(ROLES.ADMIN, ROLES.COMMERCIAL)] };
  const clientAuth = { preHandler: [authenticateJWT] };

  // ========== ROUTES ADMIN ==========
  fastify.post('/admin/assign/:clientId/:templateId', adminOnly, templateAssignmentController.assignTemplateToClientHandler);
  fastify.delete('/admin/assign/:clientId/:templateId', adminOnly, templateAssignmentController.removeTemplateFromClientHandler);
  fastify.get('/admin/client/:clientId/templates', adminOnly, templateAssignmentController.getClientTemplatesHandler);
  fastify.get('/admin/client/:clientId/available-templates', adminOnly, templateAssignmentController.getAvailableTemplatesHandler);
  fastify.get('/admin/template/:templateId/clients', adminOnly, templateAssignmentController.getTemplateClientsHandler);

  // Récupérer toutes les assignations (version inline que tu veux garder)
  fastify.get('/admin/assignments', adminOnly, async (request, reply) => {
    try {
      const result = await query(`
        SELECT
          ct.*,
          c.company_name as client_name,
          c.email as client_email,
          t.name as template_name,
          t.category as template_category,
          u.email as assigned_by_email,
          COALESCE(u.full_name, u.email) as assigned_by_name
        FROM client_templates ct
        JOIN clients c ON ct.client_id = c.id
        JOIN templates t ON ct.template_id = t.id
        LEFT JOIN users u ON ct.assigned_by = u.id
        ORDER BY ct.assigned_at DESC
      `);
      return reply.send({ success: true, data: result.rows });
    } catch (err) {
      logger.error('Erreur récupération assignations:', err);
      return reply.status(500).send({ success: false, message: err.message || 'Erreur serveur interne' });
    }
  });

  fastify.get('/admin/assignments/stats', adminOnly, templateAssignmentController.getAssignmentStatsHandler);

  // ========== ROUTES CLIENT ==========
  fastify.get('/my-templates', clientAuth, templateAssignmentController.getMyAccessibleTemplatesHandler);

  // Tu peux ajouter ici d'autres routes si besoin (ex: preview template)
}

module.exports = templateAssignmentRoutes;
