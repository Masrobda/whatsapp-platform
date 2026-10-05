const paymentService = require('../services/payment.service');
const { validate } = require('../utils/validators');
const logger = require('../utils/logger');

/**
 * POST /api/v1/payments
 * Enregistrer un paiement
 */
async function createPaymentHandler(request, reply) {
  try {
    const validatedData = validate({
      invoice_id: Joi.string().uuid().required(),
      amount: Joi.number().positive().required(),
      payment_method: Joi.string().valid('virement', 'cheque', 'especes', 'mobile_money').required(),
      reference: Joi.string().optional(),
      notes: Joi.string().optional(),
      proof_path: Joi.string().optional()
    }, request.body);

    const result = await paymentService.createPayment(
      request.user.id,
      validatedData
    );

    return reply.code(201).send(result);

  } catch (error) {
    if (error.statusCode) {
      return reply.code(error.statusCode).send({
        success: false,
        code: error.code,
        message: error.message
      });
    }

    logger.error('Erreur createPayment:', error);
    return reply.code(500).send({
      success: false,
      code: 'INTERNAL_ERROR',
      message: 'Erreur lors de l\'enregistrement du paiement'
    });
  }
}

/**
 * POST /api/v1/payments/:id/verify
 * Valider un paiement
 */
async function verifyPaymentHandler(request, reply) {
  try {
    const validatedData = validate({
      notes: Joi.string().optional()
    }, request.body);

    const result = await paymentService.verifyPayment(
      request.params.id,
      request.user.id,
      validatedData
    );

    return reply.code(200).send(result);

  } catch (error) {
    if (error.statusCode) {
      return reply.code(error.statusCode).send({
        success: false,
        code: error.code,
        message: error.message
      });
    }

    logger.error('Erreur verifyPayment:', error);
    return reply.code(500).send({
      success: false,
      code: 'INTERNAL_ERROR',
      message: 'Erreur lors de la validation du paiement'
    });
  }
}

/**
 * GET /api/v1/payments
 * Récupérer tous les paiements (admin)
 */
async function getAllPaymentsHandler(request, reply) {
  try {
    const result = await paymentService.getAllPayments(request.query);

    return reply.code(200).send(result);

  } catch (error) {
    if (error.statusCode) {
      return reply.code(error.statusCode).send({
        success: false,
        code: error.code,
        message: error.message
      });
    }

    logger.error('Erreur getAllPayments:', error);
    return reply.code(500).send({
      success: false,
      code: 'INTERNAL_ERROR',
      message: 'Erreur lors de la récupération des paiements'
    });
  }
}

/**
 * GET /api/v1/invoices/:id/payments
 * Récupérer les paiements d'une facture
 */
async function getInvoicePaymentsHandler(request, reply) {
  try {
    const result = await paymentService.getInvoicePayments(
      request.params.id,
      request.user.id,
      request.user.type
    );

    return reply.code(200).send(result);

  } catch (error) {
    if (error.statusCode) {
      return reply.code(error.statusCode).send({
        success: false,
        code: error.code,
        message: error.message
      });
    }

    logger.error('Erreur getInvoicePayments:', error);
    return reply.code(500).send({
      success: false,
      code: 'INTERNAL_ERROR',
      message: 'Erreur lors de la récupération des paiements'
    });
  }
}

/**
 * POST /api/v1/payments/:id/upload-proof
 * Uploader une preuve de paiement
 */
async function uploadPaymentProofHandler(request, reply) {
  try {
    const file = await request.file();
    
    if (!file) {
      return reply.code(400).send({
        success: false,
        code: 'NO_FILE',
        message: 'Aucun fichier fourni'
      });
    }

    const result = await paymentService.uploadPaymentProof(
      request.params.id,
      {
        originalname: file.filename,
        buffer: await file.toBuffer(),
        mimetype: file.mimetype
      }
    );

    return reply.code(200).send(result);

  } catch (error) {
    if (error.statusCode) {
      return reply.code(error.statusCode).send({
        success: false,
        code: error.code,
        message: error.message
      });
    }

    logger.error('Erreur uploadPaymentProof:', error);
    return reply.code(500).send({
      success: false,
      code: 'INTERNAL_ERROR',
      message: 'Erreur lors de l\'upload de la preuve'
    });
  }
}

module.exports = {
  createPaymentHandler,
  verifyPaymentHandler,
  getAllPaymentsHandler,
  getInvoicePaymentsHandler,
  uploadPaymentProofHandler,
};
