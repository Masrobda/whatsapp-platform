// src/controllers/invitation.controller.js
const invitationService = require('../services/invitation.service');
const logger = require('../utils/logger');

module.exports = {
  create: async (request, reply) => {
    try {
      const userId = request.user?.id || request.userId;

      if (!userId) {
        return reply.code(401).send({ success: false, message: 'Non authentifié' });
      }

      const data = request.body;

      // Si email est vide ou absent → on le supprime du payload
      if (!data.email || data.email.trim() === '') {
        delete data.email;
      }

      const result = await invitationService.createInvitation(userId, data);
      reply.code(201).send(result);
    } catch (err) {
      logger.error('Erreur création invitation:', err);
      reply.code(err.statusCode || 500).send({
        success: false,
        message: err.message || 'Erreur serveur'
      });
    }
  },

  getAll: async (request, reply) => {
    try {
      const result = await invitationService.getAllInvitations(request.query);
      reply.send(result);
    } catch (err) {
      reply.code(500).send({ success: false, message: 'Erreur serveur' });
    }
  },

  delete: async (request, reply) => {
    try {
      const result = await invitationService.deleteInvitation(request.params.id, request.user?.id);
      reply.send(result);
    } catch (err) {
      reply.code(err.statusCode || 500).send({ success: false, message: err.message });
    }
  },

  sendByEmail: async (request, reply) => {
    try {
      const { email } = request.body;
      const invitationId = request.params.id;
      const userId = request.user?.id;

      if (!userId) {
        return reply.code(401).send({ success: false, message: 'Non authentifié' });
      }

      // Utiliser le service pour envoyer l'email
      const result = await invitationService.sendInvitationEmailById(invitationId, email, userId);
      
      reply.send(result);
    } catch (err) {
      logger.error('Erreur envoi email invitation:', err);
      reply.code(err.statusCode || 500).send({ 
        success: false, 
        message: err.message || 'Erreur lors de l\'envoi de l\'email' 
      });
    }
  },

  // Méthode pour la validation de token
  validateToken: async (request, reply) => {
    try {
      const { token } = request.params;
      
      const result = await invitationService.validateInvitation(token);
      
      return reply.send(result);
    } catch (err) {
      if (err.statusCode === 404 || err.statusCode === 400) {
        return reply.code(err.statusCode).send({
          success: false,
          message: err.message || 'Lien d\'invitation invalide ou expiré'
        });
      }

      return reply.code(500).send({
        success: false,
        code: 'INTERNAL_ERROR',
        message: 'Une erreur interne est survenue lors de la validation'
      });
    }
  }
};
