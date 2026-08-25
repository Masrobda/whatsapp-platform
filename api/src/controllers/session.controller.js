// src/controllers/session.controller.js
const sessionService = require('../services/session.service');
const { sendMessage } = require('../services/message.service');
const logger = require('../utils/logger');

class SessionController {
  // GET /api/v1/sessions/status/:phone
  // Client‑facing : session du client authentifié
  async getMyStatus(request, reply) {
    try {
      const clientId = request.user?.clientId || request.user?.id;
      const { phone } = request.params;

      if (!clientId) {
        return reply.code(401).send({ success: false, error: 'Non authentifié' });
      }

      const active = await sessionService.isSessionActive({ clientId, phone });
      const info = await sessionService.getSessionInfo({ clientId, phone });

      return reply.code(200).send({
        success: true,
        phone,
        session_active: active,
        window_expires_at: info?.window_expires_at || null,
        can_send_freeform: active,
      });
    } catch (error) {
      logger.error('[SessionController] getMyStatus:', error.message);
      return reply.code(500).send({ success: false, error: 'Erreur vérification session' });
    }
  }

  // GET /api/v1/sessions/stats
  // Dashboard : statistiques du client authentifié
  async getStats(request, reply) {
    try {
      const clientId = request.user?.clientId || request.user?.id;
      if (!clientId) {
        return reply.code(401).send({ success: false, error: 'Non authentifié' });
      }
      const stats = await sessionService.getSessionStats({ clientId });
      return reply.code(200).send({ success: true, stats });
    } catch (error) {
      logger.error('[SessionController] getStats:', error.message);
      return reply.code(500).send({ success: false, error: 'Erreur récupération statistiques' });
    }
  }

  // GET /api/v1/sessions
  // Dashboard : liste des sessions du client authentifié
  async listSessions(request, reply) {
    try {
      const clientId = request.user?.clientId || request.user?.id;
      if (!clientId) {
        return reply.code(401).send({ success: false, error: 'Non authentifié' });
      }
      const { status, page, limit, phone } = request.query;
      const result = await sessionService.listSessions({
        clientId,
        status: status || null,
        phone: phone || null,
        page: page ? parseInt(page) : 1,
        limit: limit ? parseInt(limit) : 20,
      });
      return reply.code(200).send({ success: true, ...result });
    } catch (error) {
      logger.error('[SessionController] listSessions:', error.message);
      return reply.code(500).send({ success: false, error: 'Erreur récupération sessions' });
    }
  }

  // GET /api/v1/sessions/:client_id/:phone
  // Administration : consultation d'une session d'un client spécifique (réservé aux admins)
  async checkSession(request, reply) {
    try {
      const { client_id, phone } = request.params;
      const info = await sessionService.getSessionInfo({ clientId: client_id, phone });
      if (!info) {
        return reply.code(404).send({ success: false, error: 'Aucune session trouvée' });
      }
      return reply.code(200).send({ success: true, session: info });
    } catch (error) {
      logger.error('[SessionController] checkSession:', error.message);
      return reply.code(500).send({ success: false, error: 'Erreur vérification session' });
    }
  }

  // POST /api/v1/sessions/:client_id/:phone/reengage
  // Administration : forcer une relance manuelle (réservé aux admins)
  async reengage(request, reply) {
    try {
      const { client_id, phone } = request.params;
      const { phoneNumber, template_name, template_language, template_params } = request.body || {};

      if (!phoneNumber || !template_name) {
        return reply.code(400).send({
          success: false,
          error: 'phoneNumber (numéro émetteur WhatsApp) et template_name sont requis',
        });
      }

      const result = await sendMessage(client_id, {
        phoneNumber,
        recipient_phone: phone,
        message_type: 'template',
        template_name,
        template_language: template_language || 'fr',
        template_params: template_params || {},
      });

      await sessionService.recordTemplateSent({ clientId: client_id, phone });

      return reply.code(200).send({ success: true, ...result });
    } catch (error) {
      logger.error('[SessionController] reengage:', error.message);
      const statusCode = error.statusCode || 500;
      return reply.code(statusCode).send({
        success: false,
        error: error.message || 'Erreur lors de la relance',
      });
    }
  }
}

module.exports = new SessionController();
