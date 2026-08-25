// src/controllers/template.controller.js

const templateService = require('../services/template.service');
const logger = require('../utils/logger');

/**
 * Créer un template
 */
async function createTemplateHandler(request, reply) {
  try {
    const userId = request.user.id;
    console.log('PAYLOAD REÇU (création template) :', JSON.stringify(request.body, null, 2));

    // Validation SUPPRIMÉE - maintenant gérée dans le service avec fallback
    const result = await templateService.createTemplate(userId, request.body);
    
    return reply.code(201).send({
      success: true,
      message: 'Template créé avec succès',
      template: result
    });
  } catch (error) {
    logger.error('Erreur création template:', error);
    const statusCode = error.statusCode || 500;
    return reply.code(statusCode).send({
      success: false,
      message: error.message || 'Erreur lors de la création du template'
    });
  }
}

/**
 * Soumettre un template à Meta
 */
async function submitTemplateHandler(request, reply) {
  try {
    const { id } = request.params;
    const userId = request.user.id;
    const result = await templateService.submitTemplateToMeta(id, userId);
    
    return reply.code(200).send({
      success: true,
      message: 'Template soumis avec succès à Meta',
      ...result
    });
  } catch (error) {
    logger.error('Erreur soumission template:', error);
    const statusCode = error.statusCode || 500;
    const message = error.message || 'Erreur lors de la soumission du template';
    return reply.code(statusCode).send({
      success: false,
      message
    });
  }
}

/**
 * Rafraîchir le statut d'un template
 */
async function refreshTemplateHandler(request, reply) {
  try {
    const { id } = request.params;
    const result = await templateService.refreshTemplateStatus(id);
    
    return reply.code(200).send({
      success: true,
      message: 'Statut du template mis à jour',
      ...result
    });
  } catch (error) {
    logger.error('Erreur rafraîchissement template:', error);
    const statusCode = error.statusCode || 500;
    const message = error.message || 'Erreur lors du rafraîchissement du statut';
    return reply.code(statusCode).send({
      success: false,
      message
    });
  }
}

/**
 * Récupérer tous les templates
 */
async function getTemplatesHandler(request, reply) {
  try {
    const filters = {
      page: parseInt(request.query.page) || 1,
      limit: parseInt(request.query.limit) || 10,
      status: request.query.status,
      category: request.query.category,
      search: request.query.search,
      language: request.query.language,
      created_by: request.query.created_by
    };

    const result = await templateService.getTemplates(filters);
    
    return reply.code(200).send({
      success: true,
      ...result
    });
  } catch (error) {
    logger.error('Erreur récupération templates:', error);
    return reply.code(500).send({
      success: false,
      message: 'Erreur lors de la récupération des templates'
    });
  }
}

/**
 * Récupérer un template par ID
 */
async function getTemplateByIdHandler(request, reply) {
  try {
    const { id } = request.params;
    const template = await templateService.getTemplateById(id);
    
    return reply.code(200).send({
      success: true,
      template
    });
  } catch (error) {
    logger.error('Erreur récupération template:', error);
    const statusCode = error.statusCode || 500;
    const message = error.message || 'Erreur lors de la récupération du template';
    return reply.code(statusCode).send({
      success: false,
      message
    });
  }
}

/**
 * Mettre à jour un template
 */
async function updateTemplateHandler(request, reply) {
  try {
    const { id } = request.params;
    const userId = request.user.id;
    
    // Validation SUPPRIMÉE - maintenant gérée dans le service
    const template = await templateService.updateTemplate(id, userId, request.body);
    
    return reply.code(200).send({
      success: true,
      message: 'Template mis à jour avec succès',
      template
    });
  } catch (error) {
    logger.error('Erreur mise à jour template:', error);
    const statusCode = error.statusCode || 500;
    const message = error.message || 'Erreur lors de la mise à jour du template';
    return reply.code(statusCode).send({
      success: false,
      message
    });
  }
}

/**
 * Supprimer un template
 */
async function deleteTemplateHandler(request, reply) {
  try {
    const { id } = request.params;
    const userId = request.user.id;
    await templateService.deleteTemplate(id, userId);
    
    return reply.code(200).send({
      success: true,
      message: 'Template supprimé avec succès'
    });
  } catch (error) {
    logger.error('Erreur suppression template:', error);
    const statusCode = error.statusCode || 500;
    const message = error.message || 'Erreur lors de la suppression du template';
    return reply.code(statusCode).send({
      success: false,
      message
    });
  }
}

/**
 * Dupliquer un template
 */
async function duplicateTemplateHandler(request, reply) {
  try {
    const { id } = request.params;
    const userId = request.user.id;
    const template = await templateService.duplicateTemplate(id, userId);
    
    return reply.code(201).send({
      success: true,
      message: 'Template dupliqué avec succès',
      template
    });
  } catch (error) {
    logger.error('Erreur duplication template:', error);
    const statusCode = error.statusCode || 500;
    const message = error.message || 'Erreur lors de la duplication du template';
    return reply.code(statusCode).send({
      success: false,
      message
    });
  }
}

/**
 * Mettre à jour manuellement le statut d'un template
 */
async function manualStatusUpdateHandler(request, reply) {
  try {
    const { id } = request.params;
    const { status, reason } = request.body;
    const userId = request.user.id;

    if (!['approved', 'rejected'].includes(status)) {
      return reply.code(400).send({
        success: false,
        message: 'Statut invalide. Utilisez "approved" ou "rejected"'
      });
    }

    if (status === 'rejected' && !reason) {
      return reply.code(400).send({
        success: false,
        message: 'La raison du rejet est obligatoire'
      });
    }

    const result = await templateService.manualStatusUpdate(id, userId, status, reason);

    return reply.code(200).send({
      success: true,
      message: `Template ${status === 'approved' ? 'approuvé' : 'rejeté'} avec succès`,
      ...result
    });
  } catch (error) {
    logger.error('Erreur mise à jour manuelle statut:', error);
    const statusCode = error.statusCode || 500;
    const message = error.message || 'Erreur lors de la mise à jour du statut';
    return reply.code(statusCode).send({
      success: false,
      message
    });
  }
}


/**
 * Prévisualiser un template
 */
async function previewTemplateHandler(request, reply) {
  try {
    const { id } = request.params;
    const { variables } = request.body;
    const template = await templateService.getTemplateById(id);
    const preview = templateService.previewTemplate(template, variables || {});
    
    return reply.code(200).send({
      success: true,
      preview
    });
  } catch (error) {
    logger.error('Erreur prévisualisation template:', error);
    const statusCode = error.statusCode || 500;
    const message = error.message || 'Erreur lors de la prévisualisation';
    return reply.code(statusCode).send({
      success: false,
      message
    });
  }
}

module.exports = {
  createTemplateHandler,
  submitTemplateHandler,
  refreshTemplateHandler,
  getTemplatesHandler,
  getTemplateByIdHandler,
  updateTemplateHandler,
  deleteTemplateHandler,
  duplicateTemplateHandler,
  previewTemplateHandler,
  manualStatusUpdateHandler
};
