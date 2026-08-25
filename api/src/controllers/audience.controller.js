// src/controllers/audience.controller.js
const audienceService = require('../services/audience.service');
const logger = require('../utils/logger');

function getClientId(request) {
  return request.client?.id || request.user?.id;
}

async function getStatsHandler(request, reply) {
  try {
    const result = await audienceService.getAudienceStats(getClientId(request));
    return reply.send(result);
  } catch (e) { return reply.code(e.statusCode || 500).send({ success: false, code: e.code, message: e.message }); }
}

async function listContactsHandler(request, reply) {
  try {
    const q = request.query;
    const filters = {
      page: q.page || 1,
      limit: q.limit || 50,
      search: q.search,
      status: q.status,
      source: q.source,
      sort: q.sort,
      min_campaigns: q.min_campaigns !== undefined ? parseInt(q.min_campaigns) : undefined,
      max_campaigns: q.max_campaigns !== undefined ? parseInt(q.max_campaigns) : undefined,
      opted_out: q.opted_out !== undefined ? q.opted_out === 'true' : undefined,
      take_first_n: q.take_first_n ? parseInt(q.take_first_n) : undefined,
      tags: q.tags ? q.tags.split(',') : undefined,
      dynamic_filters: q.dynamic_filters ? JSON.parse(q.dynamic_filters) : [],
      logic: q.logic || 'AND',
      list_id: q.list_id, // 👈 nouveau paramètre
    };
    const result = await audienceService.getAudienceContacts(getClientId(request), filters);
    return reply.send(result);
  } catch (e) { return reply.code(e.statusCode || 500).send({ success: false, code: e.code, message: e.message }); }
}

async function listContactsPostHandler(request, reply) {
  try {
    const result = await audienceService.getAudienceContacts(getClientId(request), request.body || {});
    return reply.send(result);
  } catch (e) { return reply.code(e.statusCode || 500).send({ success: false, code: e.code, message: e.message }); }
}

async function getContactDetailHandler(request, reply) {
  try {
    const result = await audienceService.getContactDetail(getClientId(request), request.params.id);
    return reply.send(result);
  } catch (e) { return reply.code(e.statusCode || 500).send({ success: false, code: e.code, message: e.message }); }
}

async function addContactsHandler(request, reply) {
  try {
    const { contacts } = request.body;
    if (!Array.isArray(contacts) || contacts.length === 0) {
      return reply.code(400).send({ success: false, code: 'CONTACTS_REQUIRED', message: 'Liste de contacts requise' });
    }
    const result = await audienceService.upsertContacts(getClientId(request), contacts, 'manual');
    return reply.code(201).send(result);
  } catch (e) { return reply.code(e.statusCode || 500).send({ success: false, code: e.code, message: e.message }); }
}

async function importContactsHandler(request, reply) {
  try {
    const data = await request.file();
    if (!data) return reply.code(400).send({ success: false, code: 'NO_FILE', message: 'Aucun fichier fourni' });

    const buffer = await data.toBuffer();
    const filename = data.filename?.toLowerCase() || '';
    let result;

    if (filename.endsWith('.csv') || data.mimetype === 'text/csv') {
      result = await audienceService.importAudienceFromCSV(getClientId(request), buffer);
    } else if (filename.endsWith('.xlsx') || filename.endsWith('.xls')) {
      result = await audienceService.importAudienceFromExcel(getClientId(request), buffer);
    } else {
      return reply.code(400).send({ success: false, code: 'INVALID_FORMAT', message: 'Format non supporté (CSV ou Excel uniquement)' });
    }
    return reply.send(result);
  } catch (e) {
    logger.error('Erreur import audience:', e);
    return reply.code(e.statusCode || 500).send({ success: false, code: e.code, message: e.message });
  }
}

async function importFromCampaignHandler(request, reply) {
  try {
    const result = await audienceService.importFromExistingCampaign(getClientId(request), request.params.campaignId);
    return reply.send(result);
  } catch (e) { return reply.code(e.statusCode || 500).send({ success: false, code: e.code, message: e.message }); }
}

async function exportCSVHandler(request, reply) {
  try {
    const q = request.query;
    const filters = {
      search: q.search,
      status: q.status,
      source: q.source,
      sort: q.sort,
      min_campaigns: q.min_campaigns !== undefined ? parseInt(q.min_campaigns) : undefined,
      max_campaigns: q.max_campaigns !== undefined ? parseInt(q.max_campaigns) : undefined,
      opted_out: q.opted_out !== undefined ? q.opted_out === 'true' : undefined,
      take_first_n: q.take_first_n ? parseInt(q.take_first_n) : undefined,
      list_id: q.list_id, // 👈 nouveau paramètre
    };
    const result = await audienceService.exportAudienceToCSV(getClientId(request), filters);
    reply.header('Content-Type', 'text/csv; charset=utf-8');
    reply.header('Content-Disposition', `attachment; filename="${result.filename}"`);
    return reply.code(200).send(result.csv);
  } catch (e) { return reply.code(e.statusCode || 500).send({ success: false, code: e.code, message: e.message }); }
}

async function deleteContactsHandler(request, reply) {
  try {
    const { contact_ids, filters } = request.body;
    let result;
    if (Array.isArray(contact_ids) && contact_ids.length > 0) {
      result = await audienceService.deleteContacts(getClientId(request), contact_ids);
    } else if (filters) {
      result = await audienceService.deleteContactsByFilter(getClientId(request), filters);
    } else {
      return reply.code(400).send({ success: false, code: 'MISSING_PARAMS', message: 'contact_ids ou filters requis' });
    }
    return reply.send(result);
  } catch (e) { return reply.code(e.statusCode || 500).send({ success: false, code: e.code, message: e.message }); }
}

async function resendCampaignHandler(request, reply) {
  try {
    const clientId = getClientId(request);
    const userId = request.user?.id || clientId;
    const { campaign_id, new_media_url, contact_filters, name_suffix, template_params_override } = request.body;

    if (!campaign_id) return reply.code(400).send({ success: false, code: 'CAMPAIGN_ID_REQUIRED', message: 'campaign_id requis' });

    const result = await audienceService.resendCampaignWithNewMedia(clientId, userId, campaign_id, {
      new_media_url,
      contact_filters: contact_filters || {},
      name_suffix,
      template_params_override,
    });
    return reply.code(201).send(result);
  } catch (e) { return reply.code(e.statusCode || 500).send({ success: false, code: e.code, message: e.message }); }
}

async function getContactsForNewCampaignHandler(request, reply) {
  try {
    const result = await audienceService.getAudienceContactsForNewCampaign(getClientId(request), request.body || {});
    return reply.send(result);
  } catch (e) { return reply.code(e.statusCode || 500).send({ success: false, code: e.code, message: e.message }); }
}

async function createListHandler(request, reply) {
  try {
    const { name, description, contact_ids } = request.body;
    if (!name) return reply.code(400).send({ success: false, code: 'NAME_REQUIRED', message: 'Nom requis' });
    const result = await audienceService.createList(getClientId(request), name, description, contact_ids || []);
    return reply.code(201).send(result);
  } catch (e) { return reply.code(e.statusCode || 500).send({ success: false, code: e.code, message: e.message }); }
}

async function addContactsToListHandler(request, reply) {
  try {
    const clientId = getClientId(request);
    const { listId } = request.params;
    const { contact_ids } = request.body;
    if (!Array.isArray(contact_ids) || contact_ids.length === 0) {
      return reply.code(400).send({ success: false, code: 'CONTACTS_REQUIRED', message: 'contact_ids requis' });
    }
    const result = await audienceService.addContactsToList(listId, clientId, contact_ids);
    return reply.send(result);
  } catch (e) {
    return reply.code(e.statusCode || 500).send({ success: false, code: e.code, message: e.message });
  }
}

async function removeContactsFromListHandler(request, reply) {
  try {
    const clientId = getClientId(request);
    const { listId } = request.params;
    const { contact_ids } = request.body;
    if (!Array.isArray(contact_ids) || contact_ids.length === 0) {
      return reply.code(400).send({ success: false, code: 'CONTACTS_REQUIRED', message: 'contact_ids requis' });
    }
    const result = await audienceService.removeContactsFromList(listId, clientId, contact_ids);
    return reply.send(result);
  } catch (e) {
    return reply.code(e.statusCode || 500).send({ success: false, code: e.code, message: e.message });
  }
}

async function deleteListHandler(request, reply) {
  try {
    const clientId = getClientId(request);
    const { listId } = request.params;
    const result = await audienceService.deleteList(listId, clientId);
    return reply.send(result);
  } catch (e) {
    return reply.code(e.statusCode || 500).send({ success: false, code: e.code, message: e.message });
  }
}

async function getListsHandler(request, reply) {
  try {
    const result = await audienceService.getLists(getClientId(request));
    return reply.send(result);
  } catch (e) { return reply.code(e.statusCode || 500).send({ success: false, code: e.code, message: e.message }); }
}

module.exports = {
  getStatsHandler, listContactsHandler, listContactsPostHandler, getContactDetailHandler,
  addContactsHandler, importContactsHandler, importFromCampaignHandler, exportCSVHandler,
  deleteContactsHandler, resendCampaignHandler, getContactsForNewCampaignHandler,
  createListHandler, getListsHandler, addContactsToListHandler,
  removeContactsFromListHandler, 
  deleteListHandler,
};
