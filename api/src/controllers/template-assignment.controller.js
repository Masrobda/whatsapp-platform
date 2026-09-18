// src/controllers/template-assignment.controller.js

const assignmentService = require('../services/template-assignment.service');
const logger = require('../utils/logger');

/**
 * Assigner un template à un client
 */
async function assignTemplateToClientHandler(request, reply) {
  try {
    const { clientId, templateId } = request.params;
    const { notes } = request.body;
    const userId = request.user.id;

    const result = await assignmentService.assignTemplateToClient(
      clientId, 
      templateId, 
      userId, 
      notes
    );

    return reply.send({
      success: true,
      message: `Template "${result.template}" assigné avec succès`,
      data: result.data
    });

  } catch (error) {
    logger.error('Erreur assignation template:', error);
    const statusCode = error.statusCode || 500;
    return reply.code(statusCode).send({
      success: false,
      message: error.message || 'Erreur lors de l\'assignation'
    });
  }
}

/**
 * Retirer un template d'un client
 */
async function removeTemplateFromClientHandler(request, reply) {
  try {
    const { clientId, templateId } = request.params;

    await assignmentService.removeTemplateFromClient(clientId, templateId);

    return reply.send({
      success: true,
      message: 'Template retiré du client avec succès'
    });

  } catch (error) {
    logger.error('Erreur retrait template:', error);
    const statusCode = error.statusCode || 500;
    return reply.code(statusCode).send({
      success: false,
      message: error.message || 'Erreur lors du retrait'
    });
  }
}

/**
 * Récupérer les templates d'un client
 */
async function getClientTemplatesHandler(request, reply) {
  try {
    const { clientId } = request.params;
    const filters = {
      is_active: request.query.is_active !== 'false',
      page: parseInt(request.query.page) || 1,
      limit: parseInt(request.query.limit) || 50
    };

    const result = await assignmentService.getClientTemplates(clientId, filters);

    return reply.send(result);

  } catch (error) {
    logger.error('Erreur récupération templates client:', error);
    return reply.code(500).send({
      success: false,
      message: 'Erreur lors de la récupération des templates'
    });
  }
}

/**
 * Récupérer les clients d'un template
 */
async function getTemplateClientsHandler(request, reply) {
  try {
    const { templateId } = request.params;
    const filters = {
      is_active: request.query.is_active !== 'false',
      page: parseInt(request.query.page) || 1,
      limit: parseInt(request.query.limit) || 50
    };

    const result = await assignmentService.getTemplateClients(templateId, filters);

    return reply.send(result);

  } catch (error) {
    logger.error('Erreur récupération clients template:', error);
    return reply.code(500).send({
      success: false,
      message: 'Erreur lors de la récupération des clients'
    });
  }
}

/**
 * Récupérer les templates disponibles pour un client
 */
async function getAvailableTemplatesHandler(request, reply) {
  try {
    const { clientId } = request.params;
    const filters = {
      page: parseInt(request.query.page) || 1,
      limit: parseInt(request.query.limit) || 50,
      category: request.query.category,
      language: request.query.language
    };

    const result = await assignmentService.getAvailableTemplatesForClient(clientId, filters);

    return reply.send(result);

  } catch (error) {
    logger.error('Erreur récupération templates disponibles:', error);
    return reply.code(500).send({
      success: false,
      message: 'Erreur lors de la récupération des templates disponibles'
    });
  }
}

/**
 * Récupérer toutes les assignations (vue admin)
 */
async function getAllAssignmentsHandler(request, reply) {
  try {
    const filters = {
      page: parseInt(request.query.page) || 1,
      limit: parseInt(request.query.limit) || 50,
      client_id: request.query.client_id,
      template_id: request.query.template_id,
      is_active: request.query.is_active !== 'false'
    };

    const result = await assignmentService.getAllAssignments(filters);

    return reply.send(result);

  } catch (error) {
    logger.error('Erreur récupération toutes assignations:', error);
    return reply.code(500).send({
      success: false,
      message: error.message || 'Erreur lors de la récupération des assignations'
    });
  }
}

/**
 * Récupérer les statistiques des assignations
 */
async function getAssignmentStatsHandler(request, reply) {
  try {
    const result = await assignmentService.getAssignmentStats();
    return reply.send(result);
  } catch (error) {
    logger.error('Erreur récupération stats assignations:', error);
    return reply.code(500).send({
      success: false,
      message: error.message || 'Erreur lors de la récupération des statistiques'
    });
  }
}

/**
 * Récupérer les templates accessibles pour l'envoi (pour le client connecté)
 */
async function getMyAccessibleTemplatesHandler(request, reply) {
  try {
    const clientId = request.user.id;
    const filters = {
      category: request.query.category,
      language: request.query.language
    };

    const result = await assignmentService.getAccessibleTemplates(clientId, filters);

    return reply.send(result);

  } catch (error) {
    logger.error('Erreur récupération templates accessibles:', error);
    return reply.code(500).send({
      success: false,
      message: 'Erreur lors de la récupération des templates'
    });
  }
}

module.exports = {
  assignTemplateToClientHandler,
  removeTemplateFromClientHandler,
  getClientTemplatesHandler,
  getTemplateClientsHandler,
  getAvailableTemplatesHandler,
  getMyAccessibleTemplatesHandler,
  getAllAssignmentsHandler,      
  getAssignmentStatsHandler     
};
