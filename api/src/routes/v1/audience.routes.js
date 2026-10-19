// src/routes/v1/audience.routes.js
const {
  getStatsHandler, listContactsHandler, listContactsPostHandler, getContactDetailHandler,
  addContactsHandler, importContactsHandler, importFromCampaignHandler, exportCSVHandler,
  deleteContactsHandler, resendCampaignHandler, getContactsForNewCampaignHandler,
  createListHandler, getListsHandler, addContactsToListHandler,  
  removeContactsFromListHandler, 
  deleteListHandler,
} = require('../../controllers/audience.controller');

// ✅ Utiliser uniquement authenticateJWT (comme pour le reste du dashboard)
const { authenticateJWT } = require('../../middlewares/auth.middleware');

async function audienceRoutes(fastify, options) {

  // multipart pour l'import CSV/Excel
  if (!fastify.hasContentTypeParser('multipart/form-data')) {
    await fastify.register(require('@fastify/multipart'), {
      limits: { fileSize: 10 * 1024 * 1024 },
    });
  }

  // ─── STATS & LECTURE ───
  fastify.get('/stats', {
    preHandler: [authenticateJWT],
    schema: { description: "Statistiques globales de l'audience", tags: ['Audience'] }
  }, getStatsHandler);

  fastify.get('/', {
    preHandler: [authenticateJWT],
    schema: {
      description: 'Lister les contacts de l\'audience (filtrable, triable, paginable)',
      tags: ['Audience'],
      querystring: {
        type: 'object',
        properties: {
          page: { type: 'integer', default: 1 },
          limit: { type: 'integer', default: 50 },
          search: { type: 'string' },
          status: { type: 'string' },
          source: { type: 'string', enum: ['manual', 'csv', 'excel', 'api', 'campaign_import'] },
          sort: { type: 'string', enum: ['recent', 'oldest', 'most_campaigns', 'least_campaigns', 'name', 'never_contacted'] },
          min_campaigns: { type: 'integer' },
          max_campaigns: { type: 'integer' },
          opted_out: { type: 'string', enum: ['true', 'false'] },
          take_first_n: { type: 'integer', description: 'Pour "les 50 premiers" etc.' },
          tags: { type: 'string', description: 'Tags séparés par virgule' },
          dynamic_filters: { type: 'string', description: 'JSON stringifié des filtres avancés' },
          logic: { type: 'string', enum: ['AND', 'OR'] },
          list_id: { type: 'string', format: 'uuid', description: 'Filtrer par liste statique' }, // 👈 nouveau
        }
      }
    }
  }, listContactsHandler);

  fastify.post('/search', {
    preHandler: [authenticateJWT],
    schema: { description: 'Recherche avancée avec filtres dynamiques (segments)', tags: ['Audience'] }
  }, listContactsPostHandler);

  fastify.get('/:id', {
    preHandler: [authenticateJWT],
    schema: {
      description: 'Détail d\'un contact + historique des campagnes reçues',
      tags: ['Audience'],
      params: { type: 'object', properties: { id: { type: 'string', format: 'uuid' } } }
    }
  }, getContactDetailHandler);

  // ─── AJOUT / IMPORT ───
  fastify.post('/contacts', {
    preHandler: [authenticateJWT],
    schema: {
      description: 'Ajouter/mettre à jour des contacts (upsert manuel)',
      tags: ['Audience'],
      body: {
        type: 'object',
        required: ['contacts'],
        properties: {
          contacts: {
            type: 'array',
            items: {
              type: 'object',
              required: ['phone_number'],
              properties: {
                phone_number: { type: 'string' },
                name: { type: 'string' },
                email: { type: 'string' },
                variables: { type: 'object' },
              }
            }
          }
        }
      }
    }
  }, addContactsHandler);

  fastify.post('/import', {
    preHandler: [authenticateJWT],
    schema: {
      description: 'Importer des contacts via CSV ou Excel',
      tags: ['Audience'],
      consumes: ['multipart/form-data'],
    }
  }, importContactsHandler);

  fastify.post('/import/from-campaign/:campaignId', {
    preHandler: [authenticateJWT],
    schema: {
      description: 'Récupérer dans l\'audience les contacts d\'une campagne déjà envoyée',
      tags: ['Audience'],
      params: { type: 'object', properties: { campaignId: { type: 'string', format: 'uuid' } } }
    }
  }, importFromCampaignHandler);

  // ─── EXPORT ───
  fastify.get('/export/csv', {
    preHandler: [authenticateJWT],
    schema: {
      description: 'Exporter l\'audience filtrée en CSV',
      tags: ['Audience'],
      querystring: {
        type: 'object',
        properties: {
          search: { type: 'string' },
          status: { type: 'string' },
          source: { type: 'string' },
          sort: { type: 'string' },
          min_campaigns: { type: 'integer' },
          max_campaigns: { type: 'integer' },
          opted_out: { type: 'string', enum: ['true', 'false'] },
          take_first_n: { type: 'integer' },
          list_id: { type: 'string', format: 'uuid' }, // 👈 nouveau
        }
      }
    }
  }, exportCSVHandler);

  // ─── SUPPRESSION ───
  fastify.post('/delete', {
    preHandler: [authenticateJWT],
    schema: {
      description: 'Supprimer (archiver) des contacts par ID ou par filtre',
      tags: ['Audience'],
      body: {
        type: 'object',
        properties: {
          contact_ids: { type: 'array', items: { type: 'string', format: 'uuid' } },
          filters: { type: 'object' },
        }
      }
    }
  }, deleteContactsHandler);

  // ─── RENVOI INTELLIGENT ───
  fastify.post('/resend', {
    preHandler: [authenticateJWT],
    schema: {
      description: 'Renvoyer une campagne existante (même template) avec un nouveau lien média et/ou un sous-ensemble de contacts filtrés',
      tags: ['Audience'],
      body: {
        type: 'object',
        required: ['campaign_id'],
        properties: {
          campaign_id: { type: 'string', format: 'uuid' },
          new_media_url: { type: 'string', description: 'Nouveau lien public (image/vidéo/document) à substituer' },
          contact_filters: {
            type: 'object',
            description: 'Mêmes filtres que GET /audience (take_first_n, sort, dynamic_filters, list_id...)',
            properties: {
              list_id: { type: 'string', format: 'uuid' }, // 👈 nouveau
              contact_ids: { type: 'array', items: { type: 'string', format: 'uuid' } },
              // autres filtres possibles
            }
          },
          name_suffix: { type: 'string', default: ' (renvoi)' },
          template_params_override: { type: 'object' },
        }
      }
    }
  }, resendCampaignHandler);

  fastify.post('/for-new-campaign', {
    preHandler: [authenticateJWT],
    schema: {
      description: 'Récupérer une liste de contacts filtrée de l\'audience, prête à injecter dans une NOUVELLE campagne (autre template)',
      tags: ['Audience'],
    }
  }, getContactsForNewCampaignHandler);

  // ─── LISTES ───
  fastify.get('/lists', {
    preHandler: [authenticateJWT],
    schema: { tags: ['Audience'] }
  }, getListsHandler);

  // Ajouter des contacts à une liste
fastify.post('/lists/:listId/contacts', {
  preHandler: [authenticateJWT],
  schema: {
    tags: ['Audience'],
    params: { type: 'object', properties: { listId: { type: 'string', format: 'uuid' } } },
    body: {
      type: 'object',
      required: ['contact_ids'],
      properties: {
        contact_ids: { type: 'array', items: { type: 'string', format: 'uuid' } }
      }
    }
  }
}, addContactsToListHandler);

// Retirer des contacts d'une liste
fastify.delete('/lists/:listId/contacts', {
  preHandler: [authenticateJWT],
  schema: {
    tags: ['Audience'],
    params: { type: 'object', properties: { listId: { type: 'string', format: 'uuid' } } },
    body: {
      type: 'object',
      required: ['contact_ids'],
      properties: {
        contact_ids: { type: 'array', items: { type: 'string', format: 'uuid' } }
      }
    }
  }
}, removeContactsFromListHandler);

// Supprimer une liste
fastify.delete('/lists/:listId', {
  preHandler: [authenticateJWT],
  schema: {
    tags: ['Audience'],
    params: { type: 'object', properties: { listId: { type: 'string', format: 'uuid' } } }
  }
}, deleteListHandler);

  fastify.post('/lists', {
    preHandler: [authenticateJWT],
    schema: {
      tags: ['Audience'],
      body: {
        type: 'object',
        required: ['name'],
        properties: {
          name: { type: 'string' },
          description: { type: 'string' },
          contact_ids: { type: 'array', items: { type: 'string', format: 'uuid' } },
        }
      }
    }
  }, createListHandler);
}

module.exports = audienceRoutes;
