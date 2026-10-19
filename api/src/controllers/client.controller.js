const clientService = require('../services/client.service');
const logger = require('../utils/logger');

/**
 * GET /api/v1/client/profile
 */
async function getProfileHandler(request, reply) {
  try {
    const clientId = request.user.id;
    const result = await clientService.getClientProfile(clientId);

    return reply.code(200).send(result);

  } catch (error) {
    if (error.statusCode) {
      return reply.code(error.statusCode).send({
        success: false,
        code: error.code,
        message: error.message
      });
    }

    logger.error('Erreur récupération profil:', error);
    return reply.code(500).send({
      success: false,
      code: 'INTERNAL_ERROR',
      message: 'Une erreur est survenue'
    });
  }
}

/**
 * PUT /api/v1/client/profile
 */
async function updateProfileHandler(request, reply) {
  try {
    const clientId = request.user.id;
    const result = await clientService.updateClientProfile(clientId, request.body);

    return reply.code(200).send(result);

  } catch (error) {
    if (error.statusCode) {
      return reply.code(error.statusCode).send({
        success: false,
        code: error.code,
        message: error.message
      });
    }

    logger.error('Erreur mise à jour profil:', error);
    return reply.code(500).send({
      success: false,
      code: 'INTERNAL_ERROR',
      message: 'Une erreur est survenue'
    });
  }
}

/**
 * GET /api/v1/client/credentials
 */
async function getCredentialsHandler(request, reply) {
  try {
    const clientId = request.user.id;
    const result = await clientService.getApiCredentials(clientId);

    return reply.code(200).send(result);

  } catch (error) {
    logger.error('Erreur récupération credentials:', error);
    return reply.code(500).send({
      success: false,
      code: 'INTERNAL_ERROR',
      message: 'Une erreur est survenue'
    });
  }
}

/**
 * GET /api/v1/client/dashboard
 */
async function getDashboardHandler(request, reply) {
  try {
    const clientId = request.user.id;
    const result = await clientService.getClientDashboard(clientId);

    return reply.code(200).send(result);

  } catch (error) {
    logger.error('Erreur récupération dashboard:', error);
    return reply.code(500).send({
      success: false,
      code: 'INTERNAL_ERROR',
      message: 'Une erreur est survenue'
    });
  }
}

/**
 * GET /api/v1/client/all (Admin)
 */
async function getAllClientsHandler(request, reply) {
  try {
    const filters = {
      page: request.query.page,
      limit: request.query.limit,
      search: request.query.search,
      is_active: request.query.is_active
    };

    const result = await clientService.getAllClients(filters);

    return reply.code(200).send(result);

  } catch (error) {
    logger.error('Erreur récupération clients:', error);
    return reply.code(500).send({
      success: false,
      code: 'INTERNAL_ERROR',
      message: 'Une erreur est survenue'
    });
  }
}

/**
 * PUT /api/v1/client/:id/pricing (Admin)
 */
async function updatePricingHandler(request, reply) {
  try {
    const { id } = request.params;
    const userId = request.user.id;

    const result = await clientService.updateClientPricing(id, userId, request.body);

    return reply.code(200).send(result);

  } catch (error) {
    logger.error('Erreur mise à jour tarif:', error);
    return reply.code(500).send({
      success: false,
      code: 'INTERNAL_ERROR',
      message: 'Une erreur est survenue'
    });
  }
}

/**
 * POST /api/v1/client/:id/recharge (Admin)
 */
async function rechargeQuotaHandler(request, reply) {
  try {
    const { id } = request.params;
    const userId = request.user.id;

    const result = await clientService.rechargeClientQuota(id, userId, request.body);

    return reply.code(200).send(result);

  } catch (error) {
    logger.error('Erreur recharge quota:', error);
    return reply.code(500).send({
      success: false,
      code: 'INTERNAL_ERROR',
      message: 'Une erreur est survenue'
    });
  }
}

async function toggleBlockHandler(request, reply) {
  try {
    const { id } = request.params;
    const { blocked, reason, duration_days } = request.body;
    const result = await clientService.toggleClientBlock(id, blocked, reason, duration_days);
    return reply.send(result);
  } catch (error) {
    logger.error('Erreur toggle block:', error);
    return reply.code(500).send({ success: false, message: 'Erreur serveur' });
  }
}

async function toggleActiveHandler(request, reply) {
  try {
    const { id } = request.params;
    const { active } = request.body;
    const result = await clientService.toggleClientActive(id, active);
    return reply.send(result);
  } catch (error) {
    logger.error('Erreur toggle active:', error);
    return reply.code(500).send({ success: false, message: 'Erreur serveur' });
  }
}


module.exports = {
  getProfileHandler,
  updateProfileHandler,
  getCredentialsHandler,
  getDashboardHandler,
  getAllClientsHandler,
  updatePricingHandler,
  rechargeQuotaHandler,
  toggleBlockHandler,
  toggleActiveHandler,  
};
