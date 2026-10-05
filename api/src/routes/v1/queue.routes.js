const queueController = require('../../controllers/queue.controller');
const { authenticateJWT } = require('../../middlewares/auth.middleware');
const { requireRole, ROLES } = require('../../middlewares/role.middleware');

async function queueRoutes(fastify, options) {
  // Middleware admin obligatoire pour toutes ces routes
  const adminOnly = { preHandler: [authenticateJWT, requireRole(ROLES.ADMIN)] };

  // ──────────────────────────────────────────────────────────────
  // Gestion pause / reprise par numéro WhatsApp
  // ──────────────────────────────────────────────────────────────

  // Mettre en pause la file d'un numéro
  fastify.post('/messages/whatsapp/:phone/pause', adminOnly, async (request, reply) => {
    const { phone } = request.params;
    try {
      await queueController.pauseQueue(phone);
      return reply.send({ success: true, message: `File pour ${phone} mise en pause` });
    } catch (err) {
      request.log.error(err);
      return reply.status(500).send({ success: false, message: err.message || 'Erreur lors de la mise en pause' });
    }
  });

  // Reprendre la file d'un numéro
  fastify.post('/messages/whatsapp/:phone/resume', adminOnly, async (request, reply) => {
    const { phone } = request.params;
    try {
      await queueController.resumeQueue(phone);
      return reply.send({ success: true, message: `File pour ${phone} reprise` });
    } catch (err) {
      request.log.error(err);
      return reply.status(500).send({ success: false, message: err.message || 'Erreur lors de la reprise' });
    }
  });

  // ──────────────────────────────────────────────────────────────
  // Statistiques et monitoring de la queue
  // ──────────────────────────────────────────────────────────────

  fastify.get('/stats', adminOnly, queueController.getQueueStats);
  fastify.get('/active', adminOnly, queueController.getActiveJobs);
  fastify.get('/failed', adminOnly, queueController.getFailedJobs);

  // ──────────────────────────────────────────────────────────────
  // Actions sur les jobs
  // ──────────────────────────────────────────────────────────────

  // Réessayer un job spécifique
  fastify.post('/:jobId/retry', adminOnly, queueController.retryJobHandler);

  // Supprimer un job spécifique
  fastify.delete('/:jobId', adminOnly, queueController.removeJob);

  // Vider tous les jobs échoués (global)
  fastify.delete('/failed/clear', adminOnly, queueController.clearFailedJobs);

  // ──────────────────────────────────────────────────────────────
  // NOUVELLES ROUTES MANQUANTES (pour matcher le frontend)
  // ──────────────────────────────────────────────────────────────

  // Réessayer TOUS les jobs échoués pour un numéro donné
  fastify.post('/messages/queue/retry-all', adminOnly, async (request, reply) => {
    const { phone } = request.query;
    if (!phone) {
      return reply.status(400).send({ success: false, message: 'Paramètre phone requis' });
    }

    try {
      const count = await queueController.retryAllFailedForPhone(phone);
      return reply.send({
        success: true,
        message: `Retry lancé pour ${count} jobs échoués sur ${phone}`,
        count
      });
    } catch (err) {
      request.log.error(err);
      return reply.status(500).send({ success: false, message: err.message || 'Erreur lors du retry-all' });
    }
  });

  // Supprimer TOUS les jobs échoués pour un numéro donné
  fastify.delete('/messages/queue/failed', adminOnly, async (request, reply) => {
    const { phone } = request.query;
    if (!phone) {
      return reply.status(400).send({ success: false, message: 'Paramètre phone requis' });
    }

    try {
      const count = await queueController.clearFailedForPhone(phone);
      return reply.send({
        success: true,
        message: `${count} jobs échoués supprimés pour ${phone}`,
        count
      });
    } catch (err) {
      request.log.error(err);
      return reply.status(500).send({ success: false, message: err.message || 'Erreur lors de la suppression' });
    }
  });
}

module.exports = queueRoutes;
