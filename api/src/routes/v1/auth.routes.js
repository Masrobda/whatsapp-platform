const {
  registerClientHandler,
  loginHandler,
  forgotPasswordHandler,
  resetPasswordHandler,
  getMeHandler,
  registerStaffViaInvitation
} = require('../../controllers/auth.controller');

const { authenticateJWT } = require('../../middlewares/auth.middleware');

/**
 * Routes d'authentification
 */
async function authRoutes(fastify, options) {
  
  // Inscription client
  fastify.post('/register/client', {
    schema: {
      description: 'Inscription d\'un nouveau client',
      tags: ['Auth'],
      body: {
        type: 'object',
        required: ['email', 'password', 'confirm_password', 'company_type'],
        properties: {
          company_name: { type: 'string' },
          company_type: { type: 'string', enum: ['entreprise', 'personnel'] },
          email: { type: 'string', format: 'email' },
          phone: { type: 'string' },
          address: { type: 'string' },
          city: { type: 'string' },
          country: { type: 'string' },
          tax_id: { type: 'string' },
          password: { type: 'string', minLength: 8 },
          confirm_password: { type: 'string' }
        }
      },
      response: {
        201: {
          type: 'object',
          properties: {
            success: { type: 'boolean' },
            message: { type: 'string' },
            client: { type: 'object' }
          }
        }
      }
    }
  }, registerClientHandler);

// Inscription personnel via invitation
// Inscription du personnel via lien d'invitation
fastify.post('/register/invitation', {
  schema: {
    description: 'Inscription d\'un membre du personnel via lien d\'invitation',
    tags: ['Auth'],
    body: {
      type: 'object',
      required: ['full_name', 'email', 'password', 'confirm_password', 'invitation_token'],
      properties: {
        full_name:       { type: 'string', minLength: 2 },
        email:           { type: 'string', format: 'email' },
        password:        { type: 'string', minLength: 8 },
        confirm_password: { type: 'string' },
        invitation_token: { type: 'string', minLength: 32 }
      }
    },
    response: {
      201: {
        type: 'object',
        properties: {
          success: { type: 'boolean' },
          message: { type: 'string' },
          user: {
            type: 'object',
            properties: {
              id:        { type: 'string' },
              email:     { type: 'string' },
              full_name: { type: 'string' },
              role:      { type: 'string' }
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
      }
    }
  },
  // handler corrigé avec l'import ci-dessus
}, registerStaffViaInvitation);


  // Connexion

  fastify.post('/login', {
    schema: {
      description: 'Connexion client ou utilisateur',
      tags: ['Auth'],
      body: {
        type: 'object',
        required: ['email', 'password'],
        properties: {
          email: { type: 'string', format: 'email' },
          password: { type: 'string' },
          user_type: { type: 'string', enum: ['client', 'user'], default: 'client' },
          remember_me: { type: 'boolean', default: false }
        }
      },
      response: {
        200: {
          type: 'object',
          properties: {
            success: { type: 'boolean' },
            token: { type: 'string' },
            // AJOUT DES OBJETS POUR ÉVITER LE FILTRAGE FASTIFY
            user: { type: 'object', additionalProperties: true },
            client: { type: 'object', additionalProperties: true }
          }
        }
      }
    }
  }, loginHandler);
  // Mot de passe oublié
  fastify.post('/forgot-password', {
    schema: {
      description: 'Demande de réinitialisation de mot de passe',
      tags: ['Auth'],
      body: {
        type: 'object',
        required: ['email'],
        properties: {
          email: { type: 'string', format: 'email' },
          user_type: { type: 'string', enum: ['client', 'user'], default: 'client' }
        }
      },
      response: {
        200: {
          type: 'object',
          properties: {
            success: { type: 'boolean' },
            message: { type: 'string' }
          }
        }
      }
    }
  }, forgotPasswordHandler);

  // Réinitialisation mot de passe
  fastify.post('/reset-password', {
    schema: {
      description: 'Réinitialisation du mot de passe',
      tags: ['Auth'],
      body: {
        type: 'object',
        required: ['token', 'password', 'confirm_password'],
        properties: {
          token: { type: 'string' },
          password: { type: 'string', minLength: 8 },
          confirm_password: { type: 'string' }
        }
      },
      response: {
        200: {
          type: 'object',
          properties: {
            success: { type: 'boolean' },
            message: { type: 'string' }
          }
        }
      }
    }
  }, resetPasswordHandler);

  // Récupérer les infos de l'utilisateur connecté
  fastify.get('/me', {
    preHandler: [authenticateJWT],
    schema: {
      description: 'Récupérer les informations de l\'utilisateur connecté',
      tags: ['Auth'],
      security: [{ bearerAuth: [] }],
      response: {
        200: {
          type: 'object',
          properties: {
            success: { type: 'boolean' },
            user: { type: 'object' }
          }
        }
      }
    }
  }, getMeHandler);
}

module.exports = authRoutes;
