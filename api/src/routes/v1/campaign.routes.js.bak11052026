// src/routes/v1/campaign.routes.js
const {
  getGlobalStatsHandler,
  listCampaignsHandler,
  createCampaignHandler,
  getCampaignHandler,
  updateCampaignHandler,
  launchCampaignHandler,
  pauseCampaignHandler,
  cancelCampaignHandler,
  getCampaignStatsHandler,
  getCampaignContactsHandler,
  importContactsHandler,
  getCampaignLogsHandler,
} = require('../../controllers/campaign.controller');

const { authenticateJWT } = require('../../middlewares/auth.middleware');
const { requireRole, ROLES } = require('../../middlewares/role.middleware');

async function campaignRoutes(fastify, options) {

  // Ajouter multipart pour l'upload
//  await fastify.register(require('@fastify/multipart'), {
//    limits: { fileSize: 10 * 1024 * 1024 } // 10MB
//  });

  // =============================================
  // STATS GLOBALES
  // =============================================
  fastify.get('/stats', {
    preHandler: [authenticateJWT],
    schema: {
      description: 'Statistiques globales des campagnes',
      tags: ['Campaigns'],
      security: [{ bearerAuth: [] }],
    }
  }, getGlobalStatsHandler);

  // =============================================
  // CRUD CAMPAGNES
  // =============================================
  fastify.get('/', {
    preHandler: [authenticateJWT],
    schema: {
      description: 'Lister les campagnes',
      tags: ['Campaigns'],
      querystring: {
        type: 'object',
        properties: {
          page: { type: 'integer', default: 1 },
          limit: { type: 'integer', default: 20 },
          status: { type: 'string', enum: ['draft','scheduled','running','paused','completed','cancelled','failed'] },
          search: { type: 'string' },
          category: { type: 'string' },
          campaign_type: { type: 'string', enum: ['broadcast','drip','trigger','ab_test'] },
          clientId: { type: 'string', format: 'uuid' },
        }
      }
    }
  }, listCampaignsHandler);

  fastify.post('/', {
    preHandler: [authenticateJWT],
    schema: {
      description: 'Créer une campagne',
      tags: ['Campaigns'],
      body: {
        type: 'object',
        required: ['name', 'phone_number', 'template_name'],
        properties: {
          name: { type: 'string', minLength: 1, maxLength: 255 },
          description: { type: 'string' },
          campaign_type: { type: 'string', enum: ['broadcast','drip','trigger','ab_test'], default: 'broadcast' },
          phone_number: { type: 'string' },
          template_name: { type: 'string' },
          template_language: { type: 'string', default: 'fr' },
          template_params: { type: 'object' },
          send_mode: { type: 'string', enum: ['instant','scheduled','batch','smart'], default: 'instant' },
          batch_size: { type: 'integer', default: 50 },
          batch_interval_seconds: { type: 'integer', default: 60 },
          daily_limit: { type: 'integer', default: 1000 },
          rate_per_minute: { type: 'integer', default: 30 },
          scheduled_at: { type: 'string', format: 'date-time' },
          priority: { type: 'integer', minimum: 1, maximum: 10, default: 5 },
          category: { type: 'string' },
          tags: { type: 'array', items: { type: 'string' } },
          contacts: {
            type: 'array',
            items: {
              type: 'object',
              properties: {
                phone_number: { type: 'string' },
                name: { type: 'string' },
                email: { type: 'string' },
                variables: { type: 'object' }
              }
            }
          },
          segment_ids: { type: 'array', items: { type: 'string', format: 'uuid' } }
        }
      }
    }
  }, createCampaignHandler);

  fastify.get('/:id', {
    preHandler: [authenticateJWT],
    schema: {
      description: 'Détails d\'une campagne',
      tags: ['Campaigns'],
      params: { type: 'object', properties: { id: { type: 'string', format: 'uuid' } } }
    }
  }, getCampaignHandler);

  fastify.put('/:id', {
    preHandler: [authenticateJWT],
    schema: {
      description: 'Modifier une campagne',
      tags: ['Campaigns'],
      params: { type: 'object', properties: { id: { type: 'string', format: 'uuid' } } }
    }
  }, updateCampaignHandler);

  // =============================================
  // ACTIONS
  // =============================================
  fastify.post('/:id/launch', {
    preHandler: [authenticateJWT],
    schema: {
      description: 'Lancer une campagne',
      tags: ['Campaigns'],
      params: { type: 'object', properties: { id: { type: 'string', format: 'uuid' } } }
    }
  }, launchCampaignHandler);

  fastify.post('/:id/pause', {
    preHandler: [authenticateJWT],
    schema: {
      description: 'Mettre en pause une campagne',
      tags: ['Campaigns'],
      params: { type: 'object', properties: { id: { type: 'string', format: 'uuid' } } }
    }
  }, pauseCampaignHandler);

  fastify.post('/:id/cancel', {
    preHandler: [authenticateJWT],
    schema: {
      description: 'Annuler une campagne',
      tags: ['Campaigns'],
      params: { type: 'object', properties: { id: { type: 'string', format: 'uuid' } } }
    }
  }, cancelCampaignHandler);

  // =============================================
  // ANALYTICS
  // =============================================
  fastify.get('/:id/stats', {
    preHandler: [authenticateJWT],
    schema: {
      description: 'Statistiques d\'une campagne',
      tags: ['Campaigns'],
      params: { type: 'object', properties: { id: { type: 'string', format: 'uuid' } } }
    }
  }, getCampaignStatsHandler);

  // =============================================
  // CONTACTS
  // =============================================
  fastify.get('/:id/contacts', {
    preHandler: [authenticateJWT],
    schema: {
      description: 'Contacts d\'une campagne',
      tags: ['Campaigns'],
      params: { type: 'object', properties: { id: { type: 'string', format: 'uuid' } } },
      querystring: {
        type: 'object',
        properties: {
          page: { type: 'integer', default: 1 },
          limit: { type: 'integer', default: 50 },
          status: { type: 'string' },
          search: { type: 'string' }
        }
      }
    }
  }, getCampaignContactsHandler);

  fastify.post('/:id/contacts/import', {
    preHandler: [authenticateJWT],
    schema: {
      description: 'Importer des contacts (CSV/Excel)',
      tags: ['Campaigns'],
      params: { type: 'object', properties: { id: { type: 'string', format: 'uuid' } } },
      consumes: ['multipart/form-data']
    }
  }, importContactsHandler);

  // =============================================
  // LOGS
  // =============================================
  fastify.get('/:id/logs', {
    preHandler: [authenticateJWT],
    schema: {
      description: 'Logs d\'une campagne',
      tags: ['Campaigns'],
      params: { type: 'object', properties: { id: { type: 'string', format: 'uuid' } } },
      querystring: {
        type: 'object',
        properties: {
          limit: { type: 'integer', default: 100 },
          level: { type: 'string', enum: ['debug','info','warn','error','critical'] }
        }
      }
    }
  }, getCampaignLogsHandler);
}

module.exports = campaignRoutes;
