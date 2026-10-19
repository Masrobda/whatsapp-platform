const orderService = require('../services/order.service');
const invoiceService = require('../services/invoice.service');
const { validate, schemas } = require('../utils/validators');
const logger = require('../utils/logger');

/**
 * POST /api/v1/orders
 * Créer une nouvelle commande (client)
 */
async function createOrderHandler(request, reply) {
  try {
    const validatedData = validate(schemas.createOrderSchema, request.body);
    const clientId = request.user.id;

    const result = await orderService.createOrder(clientId, validatedData);

    return reply.code(201).send(result);

  } catch (error) {
    if (error.statusCode) {
      return reply.code(error.statusCode).send({
        success: false,
        code: error.code,
        message: error.message,
        errors: error.errors
      });
    }

    logger.error('Erreur création commande:', error);
    return reply.code(500).send({
      success: false,
      code: 'INTERNAL_ERROR',
      message: 'Une erreur est survenue lors de la création de la commande'
    });
  }
}

/**
 * GET /api/v1/orders
 * Récupérer les commandes
 */
async function getOrdersHandler(request, reply) {
  try {
    const { page, limit, status, client_id, start_date, end_date } = request.query;

    let result;
    if (request.user.type === 'client') {
      // Client : uniquement ses commandes
      result = await orderService.getClientOrders(request.user.id, { page, limit, status });
    } else {
      // Utilisateur interne : toutes les commandes
      result = await orderService.getAllOrders({ page, limit, status, client_id, start_date, end_date });
    }

    return reply.code(200).send(result);

  } catch (error) {
    logger.error('Erreur récupération commandes:', error);
    return reply.code(500).send({
      success: false,
      code: 'INTERNAL_ERROR',
      message: 'Une erreur est survenue'
    });
  }
}

/**
 * GET /api/v1/orders/:id
 * Récupérer une commande spécifique
 */
async function getOrderByIdHandler(request, reply) {
  try {
    const { id } = request.params;

    const result = await orderService.getOrderById(id, request.user.id, request.user.type);

    return reply.code(200).send(result);

  } catch (error) {
    if (error.statusCode) {
      return reply.code(error.statusCode).send({
        success: false,
        code: error.code,
        message: error.message
      });
    }

    logger.error('Erreur récupération commande:', error);
    return reply.code(500).send({
      success: false,
      code: 'INTERNAL_ERROR',
      message: 'Une erreur est survenue'
    });
  }
}

/**
 * POST /api/v1/orders/:id/validate/secretary
 * Validation par secrétaire
 */
async function validateBySecretaryHandler(request, reply) {
  try {
    const { id } = request.params;
    const userId = request.user.id;

    const result = await orderService.validateBySecretary(id, userId, request.body);

    return reply.code(200).send(result);

  } catch (error) {
    if (error.statusCode) {
      return reply.code(error.statusCode).send({
        success: false,
        code: error.code,
        message: error.message
      });
    }

    logger.error('Erreur validation secrétaire:', error);
    return reply.code(500).send({
      success: false,
      code: 'INTERNAL_ERROR',
      message: 'Une erreur est survenue'
    });
  }
}

/**
 * POST /api/v1/orders/:id/validate/auditor
 * Validation par auditeur
 */
async function validateByAuditorHandler(request, reply) {
  try {
    const { id } = request.params;
    const userId = request.user.id;

    const result = await orderService.validateByAuditor(id, userId, request.body);

    return reply.code(200).send(result);

  } catch (error) {
    if (error.statusCode) {
      return reply.code(error.statusCode).send({
        success: false,
        code: error.code,
        message: error.message
      });
    }

    logger.error('Erreur validation auditeur:', error);
    return reply.code(500).send({
      success: false,
      code: 'INTERNAL_ERROR',
      message: 'Une erreur est survenue'
    });
  }
}

/**
 * POST /api/v1/orders/:id/validate/financial
 * Validation par responsable financier
 */

/**
 * POST /api/v1/orders/:id/validate/financial
 * Validation par responsable financier
 */
async function validateByFinancialHandler(request, reply) {
  try {
    const { id } = request.params;
    const userId = request.user.id;

    // Utiliser le service orderService pour la validation financière
    const result = await orderService.validateByFinancial(id, userId);

    // Maintenant, générer automatiquement la facture proforma
    try {
      const invoiceResult = await invoiceService.generateProforma(id, userId);
      
      return reply.code(200).send({
        success: true,
        message: 'Commande validée par le responsable financier et facture proforma générée',
        validation: result,
        invoice: invoiceResult
      });
      
    } catch (invoiceError) {
      // Si la génération de facture échoue, on retourne quand même le succès de validation
      logger.warn('Facture non générée:', invoiceError.message);
      
      return reply.code(200).send({
        success: true,
        message: 'Commande validée mais échec génération facture',
        validation: result,
        warning: invoiceError.message
      });
    }

  } catch (error) {
    if (error.statusCode) {
      return reply.code(error.statusCode).send({
        success: false,
        code: error.code,
        message: error.message
      });
    }

    logger.error('Erreur validation financier:', error);
    return reply.code(500).send({
      success: false,
      code: 'INTERNAL_ERROR',
      message: 'Une erreur est survenue'
    });
  }
}

/**
 * POST /api/v1/orders/:id/proforma
 * Générer la facture proforma
 */
async function generateProformaHandler(request, reply) {
  try {
    const { id } = request.params;
    const userId = request.user.id;

    const result = await invoiceService.generateProforma(id, userId);

    return reply.code(201).send(result);

  } catch (error) {
    if (error.statusCode) {
      return reply.code(error.statusCode).send({
        success: false,
        code: error.code,
        message: error.message
      });
    }

    logger.error('Erreur génération proforma:', error);
    return reply.code(500).send({
      success: false,
      code: 'INTERNAL_ERROR',
      message: 'Une erreur est survenue'
    });
  }
}

/**
 * POST /api/v1/orders/:id/disbursement
 * Créer une fiche de décaissement
 */
async function createDisbursementHandler(request, reply) {
  try {
    const { id } = request.params;
    const userId = request.user.id;

    const result = await invoiceService.createDisbursementSlip(id, userId, request.body);

    return reply.code(201).send(result);

  } catch (error) {
    if (error.statusCode) {
      return reply.code(error.statusCode).send({
        success: false,
        code: error.code,
        message: error.message
      });
    }

    logger.error('Erreur création fiche décaissement:', error);
    return reply.code(500).send({
      success: false,
      code: 'INTERNAL_ERROR',
      message: 'Une erreur est survenue'
    });
  }
}

/**
 * POST /api/v1/orders/:id/confirm-purchase
 * Confirmer l'achat et créditer le compte client
 */
async function confirmPurchaseHandler(request, reply) {
  try {
    const { id } = request.params;
    const userId = request.user.id;

    const result = await invoiceService.confirmPurchase(id, userId);

    return reply.code(200).send(result);

  } catch (error) {
    if (error.statusCode) {
      return reply.code(error.statusCode).send({
        success: false,
        code: error.code,
        message: error.message
      });
    }

    logger.error('Erreur confirmation achat:', error);
    return reply.code(500).send({
      success: false,
      code: 'INTERNAL_ERROR',
      message: 'Une erreur est survenue'
    });
  }
}

/**
 * GET /api/v1/invoices
 * Récupérer les factures
 */
async function getInvoicesHandler(request, reply) {
  try {
    const { page, limit, status, type, client_id } = request.query;

    let result;

    if (request.user.type === 'client') {
      // Client : uniquement ses propres factures
      result = await invoiceService.getClientInvoices(
        request.user.id,
        { page, limit, status, type }
      );
    } else {
      // Admin/Staff : utiliser la nouvelle fonction getInvoices avec filtres
      result = await invoiceService.getInvoices({
        page,
        limit,
        status,
        type,
        client_id  // Optionnel pour filtrer par client
      });
    }

    return reply.code(200).send(result);

  } catch (error) {
    logger.error('Erreur récupération factures:', error);
    return reply.code(500).send({
      success: false,
      code: 'INTERNAL_ERROR',
      message: 'Une erreur est survenue'
    });
  }
}

module.exports = {
  createOrderHandler,
  getOrdersHandler,
  getOrderByIdHandler,
  validateBySecretaryHandler,
  validateByAuditorHandler,
  validateByFinancialHandler,
  generateProformaHandler,
  createDisbursementHandler,
  confirmPurchaseHandler,
  getInvoicesHandler,
};
