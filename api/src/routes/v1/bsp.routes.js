const {
  getAllBspProviders,
  createBspProvider,
  updateBspProvider,
  deleteBspProvider,
  getBspById,
  calculateBspCost
} = require('../../controllers/bsp.controller');
const { authenticateJWT } = require('../../middlewares/auth.middleware');
const { requireRole, ROLES } = require('../../middlewares/role.middleware');

async function bspRoutes(fastify, options) {
  // GET /api/v1/bsp - Liste tous les BSP
  fastify.get('/', {
    preHandler: [authenticateJWT, requireRole(ROLES.ADMIN, ROLES.FINANCIAL_MANAGER, ROLES.PURCHASE_MANAGER)],
    schema: {
      description: 'Récupérer tous les fournisseurs BSP',
      tags: ['BSP'],
      security: [{ bearerAuth: [] }],
      querystring: {
        type: 'object',
        properties: {
          active_only: { type: 'boolean', default: true }
        }
      }
    }
  }, getAllBspProviders);

  // GET /api/v1/bsp/:id - Récupérer un BSP spécifique
  fastify.get('/:id', {
    preHandler: [authenticateJWT, requireRole(ROLES.ADMIN, ROLES.FINANCIAL_MANAGER, ROLES.PURCHASE_MANAGER)],
    schema: {
      description: 'Récupérer un fournisseur BSP',
      tags: ['BSP'],
      security: [{ bearerAuth: [] }],
      params: {
        type: 'object',
        properties: {
          id: { type: 'string', format: 'uuid' }
        }
      }
    }
  }, getBspById);

  // POST /api/v1/bsp - Créer un nouveau BSP (admin uniquement)
  fastify.post('/', {
    preHandler: [authenticateJWT, requireRole(ROLES.ADMIN)],
    schema: {
      description: 'Créer un nouveau fournisseur BSP',
      tags: ['BSP'],
      security: [{ bearerAuth: [] }],
      body: {
        type: 'object',
        required: ['name', 'message_cost'],
        properties: {
          name: { type: 'string', minLength: 2, maxLength: 255 },
          message_cost: { type: 'number', minimum: 0 },
          additional_charges: {
            type: 'object',
            properties: {
              fixed: { type: 'number', default: 0 },
              percent: { type: 'number', default: 0, maximum: 100 }
            }
          },
          is_active: { type: 'boolean', default: true }
        }
      }
    }
  }, createBspProvider);

  // PUT /api/v1/bsp/:id - Mettre à jour un BSP
  fastify.put('/:id', {
    preHandler: [authenticateJWT, requireRole(ROLES.ADMIN)],
    schema: {
      description: 'Mettre à jour un fournisseur BSP',
      tags: ['BSP'],
      security: [{ bearerAuth: [] }],
      params: {
        type: 'object',
        properties: {
          id: { type: 'string', format: 'uuid' }
        }
      },
      body: {
        type: 'object',
        properties: {
          name: { type: 'string', minLength: 2, maxLength: 255 },
          message_cost: { type: 'number', minimum: 0 },
          additional_charges: {
            type: 'object',
            properties: {
              fixed: { type: 'number' },
              percent: { type: 'number', maximum: 100 }
            }
          },
          is_active: { type: 'boolean' }
        }
      }
    }
  }, updateBspProvider);

  // DELETE /api/v1/bsp/:id - Supprimer un BSP
  fastify.delete('/:id', {
    preHandler: [authenticateJWT, requireRole(ROLES.ADMIN)],
    schema: {
      description: 'Supprimer un fournisseur BSP',
      tags: ['BSP'],
      security: [{ bearerAuth: [] }],
      params: {
        type: 'object',
        properties: {
          id: { type: 'string', format: 'uuid' }
        }
      }
    }
  }, deleteBspProvider);

  // POST /api/v1/bsp/calculate - Calculer le coût avec un BSP
  fastify.post('/calculate', {
    preHandler: [authenticateJWT, requireRole(ROLES.ADMIN, ROLES.FINANCIAL_MANAGER, ROLES.PURCHASE_MANAGER)],
    schema: {
      description: 'Calculer le coût d\'achat avec un BSP',
      tags: ['BSP'],
      security: [{ bearerAuth: [] }],
      body: {
        type: 'object',
        required: ['bsp_id', 'quantity'],
        properties: {
          bsp_id: { type: 'string', format: 'uuid' },
          quantity: { type: 'integer', minimum: 1 },
          custom_cost: { type: 'number', minimum: 0 }
        }
      }
    }
  }, calculateBspCost);
}

module.exports = bspRoutes;
