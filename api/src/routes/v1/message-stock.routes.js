const {
  getMessageStock,
  purchaseMessages,
  getTransactionHistory,
  getTransactionStats,
  checkAvailability
} = require('../../controllers/message-stock.controller');
const { authenticateJWT } = require('../../middlewares/auth.middleware');
const { requireRole, ROLES } = require('../../middlewares/role.middleware');

async function messageStockRoutes(fastify, options) {
  
  // GET /api/v1/message-stock - Récupérer l'état du stock
  fastify.get('/', {
    preHandler: [authenticateJWT, requireRole(ROLES.ADMIN, ROLES.PURCHASE_MANAGER, ROLES.FINANCIAL_MANAGER)],
    schema: {
      description: 'Récupérer l\'état du stock de messages',
      tags: ['Message Stock'],
      security: [{ bearerAuth: [] }]
    }
  }, getMessageStock);

  // POST /api/v1/message-stock/purchase - Acheter des messages
  fastify.post('/purchase', {
    preHandler: [authenticateJWT, requireRole(ROLES.ADMIN, ROLES.PURCHASE_MANAGER)],
    schema: {
      description: 'Effectuer un achat de messages auprès d\'un BSP',
      tags: ['Message Stock'],
      security: [{ bearerAuth: [] }],
      body: {
        type: 'object',
        required: ['bsp_id', 'messages_count', 'unit_cost', 'total_cost'],
        properties: {
          bsp_id: { type: 'string', format: 'uuid' },
          messages_count: { type: 'integer', minimum: 1 },
          unit_cost: { type: 'number', minimum: 0 },
          total_cost: { type: 'number', minimum: 0 },
          reference: { type: 'string' },
          notes: { type: 'string' }
        }
      }
    }
  }, purchaseMessages);

  // GET /api/v1/message-stock/history - Historique des transactions
  fastify.get('/history', {
    preHandler: [authenticateJWT, requireRole(ROLES.ADMIN, ROLES.PURCHASE_MANAGER, ROLES.FINANCIAL_MANAGER)],
    schema: {
      description: 'Récupérer l\'historique des transactions',
      tags: ['Message Stock'],
      security: [{ bearerAuth: [] }],
      querystring: {
        type: 'object',
        properties: {
          page: { type: 'integer', default: 1 },
          limit: { type: 'integer', default: 20 },
          type: { type: 'string', enum: ['purchase', 'consumption'] },
          bsp_id: { type: 'string', format: 'uuid' },
          start_date: { type: 'string', format: 'date' },
          end_date: { type: 'string', format: 'date' },
          month: { type: 'string', pattern: '^\\d{2}$' },
          year: { type: 'string', pattern: '^\\d{4}$' }
        }
      }
    }
  }, getTransactionHistory);

  // GET /api/v1/message-stock/stats - Statistiques
  fastify.get('/stats', {
    preHandler: [authenticateJWT, requireRole(ROLES.ADMIN, ROLES.PURCHASE_MANAGER, ROLES.FINANCIAL_MANAGER)]
  }, getTransactionStats);

  // GET /api/v1/message-stock/check - Vérifier disponibilité
  fastify.get('/check', {
    preHandler: [authenticateJWT, requireRole(ROLES.ADMIN, ROLES.PURCHASE_MANAGER)]
  }, checkAvailability);
}

module.exports = messageStockRoutes;
