// src/routes/v1/invitations.routes.js
const invitationController = require('../../controllers/invitation.controller');
const { authenticateJWT } = require('../../middlewares/auth.middleware');

module.exports = async function (fastify) {
  // 1. Créer une invitation (protégée)
  fastify.post('/', {
    preValidation: [authenticateJWT],
    schema: {
      description: 'Créer un nouveau lien d\'invitation',
      tags: ['Invitations'],
      body: {
        type: 'object',
        required: ['role', 'max_uses', 'expires_in_days'],
        properties: {
          role: { type: 'string' },
          permissions: { type: 'array', items: { type: 'string' } },
          max_uses: { type: 'number', minimum: 1 },
          expires_in_days: { type: 'number', minimum: 1 },
          email: { type: 'string' }
        }
      }
    },
    handler: invitationController.create
  });

  // 2. Lister toutes les invitations (protégée)
  fastify.get('/', {
    preValidation: [authenticateJWT],
    handler: invitationController.getAll
  });

  // 3. Supprimer une invitation (protégée)
  fastify.delete('/:id', {
    preValidation: [authenticateJWT],
    handler: invitationController.delete
  });

  // 4. Envoyer l'invitation par email (protégée)
  fastify.post('/:id/send', {
    preValidation: [authenticateJWT],
    schema: {
      body: {
        type: 'object',
        required: ['email'],
        properties: {
          email: { type: 'string', format: 'email' }
        }
      }
    },
    handler: invitationController.sendByEmail
  });

  // 5. Valider une invitation par token (route PUBLIQUE – PAS D'AUTHENTIFICATION)
  fastify.get('/token/:token', {
    schema: {
      description: 'Valider un lien d\'invitation par token (accès public pour inscription)',
      tags: ['Invitations'],
      params: {
        type: 'object',
        required: ['token'],
        properties: {
          token: { type: 'string', minLength: 64 }
        }
      },
      response: {
        200: {
          type: 'object',
          properties: {
            success: { type: 'boolean' },
            invitation: {
              type: 'object',
              properties: {
                id: { type: 'string' },
                token: { type: 'string' },
                role: { type: 'string' },
                permissions: { type: 'array', items: { type: 'string' } },
                expires_at: { type: 'string', format: 'date-time' },
                current_uses: { type: 'number' },
                max_uses: { type: 'number' }
              }
            }
          }
        },
        400: {
          type: 'object',
          properties: {
            success: { type: 'boolean' },
            message: { type: 'string' }
          }
        },
        404: {
          type: 'object',
          properties: {
            success: { type: 'boolean' },
            message: { type: 'string' }
          }
        }
      }
    },
    handler: invitationController.validateToken
  });
};
