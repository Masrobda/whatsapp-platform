// src/routes/v1/phase2.routes.js
// Routes Phase 2 : Segments, Automatisation, Inbox, Rapports
const { authenticateJWT } = require('../../middlewares/auth.middleware');
const { requireRole, ROLES } = require('../../middlewares/role.middleware');
const { query, getClient } = require('../../config/database');
const segmentService = require('../../services/segment.service');
const automationService = require('../../services/automation.service');
const inboxService = require('../../services/inbox.service');
const reportService = require('../../services/report.service');
const logger = require('../../utils/logger');
const fs = require('fs');

async function phase2Routes(fastify, options) {

  // ============================================================
  // SEGMENTS
  // ============================================================

  fastify.get('/segments', { preHandler: [authenticateJWT] }, async (req, reply) => {
    try {
      const clientId = req.user.role === 'admin' ? req.query.clientId : req.user.id;
      const result = await segmentService.getSegments(clientId, {
        page: req.query.page || 1, limit: req.query.limit || 20,
        search: req.query.search, type: req.query.type
      });
      return reply.send(result);
    } catch (e) { return reply.code(e.statusCode||500).send({ success:false, message:e.message }); }
  });

  fastify.post('/segments', { preHandler: [authenticateJWT] }, async (req, reply) => {
    try {
      const result = await segmentService.createSegment(req.user.id, req.user.id, req.body);
      return reply.code(201).send(result);
    } catch (e) { return reply.code(e.statusCode||500).send({ success:false, message:e.message }); }
  });

  fastify.get('/segments/:id', { preHandler: [authenticateJWT] }, async (req, reply) => {
    try {
      const seg = await segmentService.getSegmentById(req.params.id, req.user.id);
      return reply.send({ success:true, segment:seg });
    } catch (e) { return reply.code(e.statusCode||500).send({ success:false, message:e.message }); }
  });

  fastify.put('/segments/:id', { preHandler: [authenticateJWT] }, async (req, reply) => {
    try {
      const result = await segmentService.updateSegment(req.params.id, req.user.id, req.user.id, req.body);
      return reply.send(result);
    } catch (e) { return reply.code(e.statusCode||500).send({ success:false, message:e.message }); }
  });

  fastify.delete('/segments/:id', { preHandler: [authenticateJWT] }, async (req, reply) => {
    try {
      await segmentService.deleteSegment(req.params.id, req.user.id);
      return reply.send({ success:true });
    } catch (e) { return reply.code(e.statusCode||500).send({ success:false, message:e.message }); }
  });

  fastify.post('/segments/preview', { preHandler: [authenticateJWT] }, async (req, reply) => {
    try {
      const { filters = [], logic = 'AND', limit = 10 } = req.body;
      const result = await segmentService.previewSegment(req.user.id, filters, logic, limit);
      return reply.send(result);
    } catch (e) { return reply.code(e.statusCode||400).send({ success:false, message:e.message }); }
  });

  fastify.post('/segments/:id/refresh', { preHandler: [authenticateJWT] }, async (req, reply) => {
    try {
      const result = await segmentService.refreshSegmentCount(req.params.id, req.user.id);
      return reply.send({ success:true, ...result });
    } catch (e) { return reply.code(e.statusCode||500).send({ success:false, message:e.message }); }
  });

  fastify.get('/segments/:id/contacts', { preHandler: [authenticateJWT] }, async (req, reply) => {
    try {
      const contacts = await segmentService.getSegmentContacts(req.params.id, req.user.id, req.query.limit || 5000);
      return reply.send({ success:true, contacts, count: contacts.length });
    } catch (e) { return reply.code(e.statusCode||500).send({ success:false, message:e.message }); }
  });

  fastify.post('/segments/:id/contacts', { preHandler: [authenticateJWT] }, async (req, reply) => {
    try {
      const result = await segmentService.addContactsToSegment(req.params.id, req.user.id, req.body.contacts || []);
      return reply.send(result);
    } catch (e) { return reply.code(e.statusCode||500).send({ success:false, message:e.message }); }
  });

   fastify.get('/segments/:id/export', { preHandler: [authenticateJWT] }, async (req, reply) => {
  try {
    const segmentId = req.params.id;
    const clientId = req.user.id;
    // Récupérer tous les contacts (sans limite)
    const contacts = await segmentService.getSegmentContacts(segmentId, clientId, 100000); // ou sans limite

    // Générer CSV
    const csvRows = [];
    // En-têtes
    csvRows.push(['phone_number', 'name', 'variables'].join(','));
    // Données
    for (const contact of contacts) {
      const row = [
        contact.phone_number,
        contact.name || '',
        JSON.stringify(contact.variables || {}).replace(/,/g, ';') // éviter conflit CSV
      ];
      csvRows.push(row.join(','));
    }

    const csvContent = csvRows.join('\n');
    reply.header('Content-Type', 'text/csv; charset=utf-8');
    reply.header('Content-Disposition', `attachment; filename="segment_${segmentId}_contacts.csv"`);
    return reply.send('\uFEFF' + csvContent); // BOM pour Excel
  } catch (e) {
    return reply.code(e.statusCode || 500).send({ success: false, message: e.message });
  }
});

  // Champs disponibles pour les filtres dynamiques
  fastify.get('/segments/filter-fields', { preHandler: [authenticateJWT] }, async (req, reply) => {
    return reply.send({
      success: true,
      fields: [
        { id: 'contacts.phone_number', label: 'Numéro de téléphone', type: 'text',
          operators: ['eq','neq','like','nlike','in','nin'] },
        { id: 'contacts.name', label: 'Nom du contact', type: 'text',
          operators: ['eq','neq','like','nlike','is_null','is_not_null'] },
        { id: 'contacts.status', label: 'Statut dernier envoi', type: 'enum',
          values: ['pending','queued','sent','delivered','read','failed','skipped'],
          operators: ['eq','neq','in','nin'] },
        { id: 'contacts.source', label: 'Source', type: 'enum',
          values: ['manual','csv','api','segment'], operators: ['eq','neq'] },
        { id: 'contacts.created_at', label: 'Date d\'ajout', type: 'date',
          operators: ['gt','gte','lt','lte'] },
        { id: 'contacts.sent_at', label: 'Date d\'envoi', type: 'date',
          operators: ['gt','gte','lt','lte','is_null','is_not_null'] },
        { id: 'contacts.delivered_at', label: 'Date de livraison', type: 'date',
          operators: ['is_null','is_not_null'] },
        { id: 'contacts.read_at', label: 'Date de lecture', type: 'date',
          operators: ['is_null','is_not_null'] },
        { id: 'opt_out.opted_out', label: 'Désabonné', type: 'boolean',
          operators: ['eq'] },
      ],
      operators: {
        eq: 'Égal à', neq: 'Différent de', gt: 'Supérieur à', gte: '≥',
        lt: 'Inférieur à', lte: '≤', like: 'Contient', nlike: 'Ne contient pas',
        in: 'Dans la liste', nin: 'Pas dans la liste',
        is_null: 'Est vide', is_not_null: 'N\'est pas vide'
      }
    });
  });

  // ============================================================
  // AUTOMATISATION / DRIP CAMPAIGNS
  // ============================================================

  fastify.get('/automations', { preHandler: [authenticateJWT] }, async (req, reply) => {
    try {
      const clientId = req.user.role === 'admin' ? req.query.clientId : req.user.id;
      const result = await automationService.getWorkflows(clientId, {
        page: req.query.page || 1, limit: req.query.limit || 20,
        status: req.query.status, search: req.query.search
      });
      return reply.send(result);
    } catch (e) { return reply.code(e.statusCode||500).send({ success:false, message:e.message }); }
  });

  fastify.post('/automations', { preHandler: [authenticateJWT] }, async (req, reply) => {
    try {
      const result = await automationService.createWorkflow(req.user.id, req.user.id, req.body);
      return reply.code(201).send(result);
    } catch (e) { return reply.code(e.statusCode||500).send({ success:false, message:e.message }); }
  });

  fastify.get('/automations/:id', { preHandler: [authenticateJWT] }, async (req, reply) => {
    try {
      const wf = await automationService.getWorkflowById(req.params.id, req.user.id);
      return reply.send({ success:true, workflow:wf });
    } catch (e) { return reply.code(e.statusCode||500).send({ success:false, message:e.message }); }
  });

  fastify.put('/automations/:id', { preHandler: [authenticateJWT] }, async (req, reply) => {
    try {
      const result = await automationService.updateWorkflow(req.params.id, req.user.id, req.user.id, req.body);
      return reply.send(result);
    } catch (e) { return reply.code(e.statusCode||500).send({ success:false, message:e.message }); }
  });

  fastify.post('/automations/:id/activate', { preHandler: [authenticateJWT] }, async (req, reply) => {
    try {
      const result = await automationService.toggleWorkflow(req.params.id, req.user.id, true);
      return reply.send(result);
    } catch (e) { return reply.code(e.statusCode||500).send({ success:false, message:e.message }); }
  });

  fastify.post('/automations/:id/pause', { preHandler: [authenticateJWT] }, async (req, reply) => {
    try {
      const result = await automationService.toggleWorkflow(req.params.id, req.user.id, false);
      return reply.send(result);
    } catch (e) { return reply.code(e.statusCode||500).send({ success:false, message:e.message }); }
  });

  fastify.get('/automations/:id/stats', { preHandler: [authenticateJWT] }, async (req, reply) => {
    try {
      const result = await automationService.getWorkflowStats(req.params.id, req.user.id);
      return reply.send(result);
    } catch (e) { return reply.code(e.statusCode||500).send({ success:false, message:e.message }); }
  });

  // Étapes
  fastify.post('/automations/:id/steps', { preHandler: [authenticateJWT] }, async (req, reply) => {
    try {
      const result = await automationService.addStep(req.params.id, req.user.id, req.body);
      return reply.code(201).send(result);
    } catch (e) { return reply.code(e.statusCode||500).send({ success:false, message:e.message }); }
  });

  fastify.put('/automations/:id/steps/:stepId', { preHandler: [authenticateJWT] }, async (req, reply) => {
    try {
      const result = await automationService.updateStep(req.params.stepId, req.params.id, req.user.id, req.body);
      return reply.send(result);
    } catch (e) { return reply.code(e.statusCode||500).send({ success:false, message:e.message }); }
  });

  fastify.delete('/automations/:id/steps/:stepId', { preHandler: [authenticateJWT] }, async (req, reply) => {
    try {
      await automationService.deleteStep(req.params.stepId, req.params.id, req.user.id);
      return reply.send({ success:true });
    } catch (e) { return reply.code(e.statusCode||500).send({ success:false, message:e.message }); }
  });

  // Inscriptions
  fastify.post('/automations/:id/enroll', { preHandler: [authenticateJWT] }, async (req, reply) => {
    try {
      const { phone, name, variables, segment_id } = req.body;
      let result;
      if (segment_id) {
        result = await automationService.enrollSegment(req.params.id, req.user.id, segment_id);
      } else {
        result = await automationService.enrollContact(req.params.id, req.user.id, phone, name, variables);
      }
      return reply.send(result);
    } catch (e) { return reply.code(e.statusCode||500).send({ success:false, message:e.message }); }
  });

  // Récupération des logs d’un workflow
fastify.get('/automations/:id/logs', { preHandler: [authenticateJWT] }, async (req, reply) => {
  try {
    const { id } = req.params;
    const { page = 1, limit = 50, result, phone } = req.query;
    await automationService.getWorkflowById(id, req.user.id); // vérifie droits
    const logs = await automationService.getWorkflowLogs(id, { page, limit, result, phone });
    return reply.send(logs);
  } catch (e) {
    return reply.code(e.statusCode || 500).send({ success: false, message: e.message });
  }
});

// Export CSV des logs
fastify.get('/automations/:id/logs/export', { preHandler: [authenticateJWT] }, async (req, reply) => {
  try {
    const { id } = req.params;
    const { result, phone } = req.query;
    const csv = await automationService.exportWorkflowLogsCSV(id, req.user.id, { result, phone });
    reply.header('Content-Type', 'text/csv; charset=utf-8');
    reply.header('Content-Disposition', `attachment; filename="workflow_logs_${id}.csv"`);
    return reply.send('\uFEFF' + csv);
  } catch (e) {
    return reply.code(e.statusCode || 500).send({ success: false, message: e.message });
  }
});

  // ============================================================
  // INBOX
  // ============================================================

  fastify.get('/inbox', { preHandler: [authenticateJWT] }, async (req, reply) => {
    try {
      const clientId = req.user.role === 'admin' ? (req.query.clientId || req.user.id) : req.user.id;
      const result = await inboxService.getConversations(clientId, {
        page: req.query.page || 1, limit: req.query.limit || 30,
        status: req.query.status, assigned_to: req.query.assigned_to,
        search: req.query.search
      });
      return reply.send(result);
    } catch (e) { return reply.code(e.statusCode||500).send({ success:false, message:e.message }); }
  });

  fastify.get('/inbox/stats', { preHandler: [authenticateJWT] }, async (req, reply) => {
    try {
      const clientId = req.user.role === 'admin' ? (req.query.clientId||req.user.id) : req.user.id;
      const result = await inboxService.getInboxStats(clientId);
      return reply.send(result);
    } catch (e) { return reply.code(e.statusCode||500).send({ success:false, message:e.message }); }
  });

  fastify.get('/inbox/satisfaction-stats', { preHandler: [authenticateJWT] }, async (req, reply) => {
  try {
    const clientId = req.user.role === 'admin' ? (req.query.clientId || req.user.id) : req.user.id;
    const result = await inboxService.getSatisfactionStats(clientId);
    return reply.send(result);
  } catch (e) {
    return reply.code(e.statusCode || 500).send({ success: false, message: e.message });
  }
});

  fastify.get('/inbox/:id', { preHandler: [authenticateJWT] }, async (req, reply) => {
    try {
      const clientId = req.user.role === 'admin' ? null : req.user.id;
      const conv = await inboxService.getConversationById(req.params.id, clientId || req.user.id);
      return reply.send({ success:true, conversation:conv });
    } catch (e) { return reply.code(e.statusCode||500).send({ success:false, message:e.message }); }
  });

  fastify.put('/inbox/:id', { preHandler: [authenticateJWT] }, async (req, reply) => {
    try {
      const result = await inboxService.updateConversation(req.params.id, req.user.id, req.body);
      return reply.send(result);
    } catch (e) { return reply.code(e.statusCode||500).send({ success:false, message:e.message }); }
  });

  fastify.post('/inbox/:id/read', { preHandler: [authenticateJWT] }, async (req, reply) => {
  const convId = req.params.id;
  const clientId = req.user?.id;

  console.log(`📌 [ROUTE /read] Reçu ! conv=${convId}, client=${clientId}, user=${JSON.stringify(req.user)}`);

  if (!convId) {
    return reply.code(400).send({ success: false, message: 'ID conversation manquant' });
  }

  try {
    const result = await inboxService.markConversationRead(convId, clientId);
    return reply.send(result);
  } catch (e) {
    console.error(`❌ [ROUTE /read] Erreur:`, e);
    return reply.code(500).send({ 
      success: false, 
      message: e.message || 'Erreur serveur' 
    });
  }
});

  fastify.get('/inbox/:id/messages', { preHandler: [authenticateJWT] }, async (req, reply) => {
    try {
      const result = await inboxService.getMessages(req.params.id, req.user.id, {
        limit: req.query.limit || 50, before: req.query.before
      });
      return reply.send(result);
    } catch (e) { return reply.code(e.statusCode||500).send({ success:false, message:e.message }); }
  });

  fastify.post('/inbox/:id/reply', { preHandler: [authenticateJWT] }, async (req, reply) => {
    try {
      const result = await inboxService.sendReply(req.params.id, req.user.id, req.user.id, req.body);
      return reply.send(result);
    } catch (e) { return reply.code(e.statusCode||500).send({ success:false, message:e.message }); }
  });

  fastify.post('/inbox/:id/note', { preHandler: [authenticateJWT] }, async (req, reply) => {
  try {
    console.log('Note request:', { convId: req.params.id, userId: req.user.id, content: req.body.content });
    const result = await inboxService.addNote(req.params.id, req.user.id, req.user.id, req.body.content);
    return reply.send(result);
  } catch (e) {
    console.error('Erreur note:', e);
    return reply.code(e.statusCode || 500).send({ success: false, message: e.message });
  }
});

  // Réponses rapides
  fastify.get('/inbox/canned', { preHandler: [authenticateJWT] }, async (req, reply) => {
    try {
      const result = await inboxService.getCannedResponses(req.user.id, req.query.search);
      return reply.send(result);
    } catch (e) { return reply.code(e.statusCode||500).send({ success:false, message:e.message }); }
  });

  fastify.post('/inbox/canned', { preHandler: [authenticateJWT] }, async (req, reply) => {
    try {
      const result = await inboxService.createCannedResponse(req.user.id, req.user.id, req.body);
      return reply.code(201).send(result);
    } catch (e) { return reply.code(e.statusCode||500).send({ success:false, message:e.message }); }
  });

  // Récupérer les conversations des dernières X jours
  fastify.get('/inbox/recent/:days', { preHandler: [authenticateJWT] }, async (req, reply) => {
    try {
      const clientId = req.user.role === 'admin' ? (req.query.clientId || req.user.id) : req.user.id;
      const days = parseInt(req.params.days) || 1;
      const result = await inboxService.getConversationsByDays(clientId, days, {
        page: req.query.page || 1, limit: req.query.limit || 30,
        status: req.query.status, assigned_to: req.query.assigned_to,
        search: req.query.search
      });
      return reply.send(result);
    } catch (e) { 
      return reply.code(e.statusCode||500).send({ success:false, message:e.message }); 
    }
  });

  // Exporter une conversation spécifique
  fastify.get('/inbox/:id/export', { preHandler: [authenticateJWT] }, async (req, reply) => {
    try {
      const clientId = req.user.role === 'admin' ? null : req.user.id;
      const result = await inboxService.exportConversationToCSV(req.params.id, clientId || req.user.id);
      
      reply.header('Content-Type', 'text/csv; charset=utf-8');
      reply.header('Content-Disposition', `attachment; filename="conversation_${req.params.id}_${Date.now()}.csv"`);
      return reply.send('\uFEFF' + result.csv);
    } catch (e) { 
      return reply.code(e.statusCode||500).send({ success:false, message:e.message }); 
    }
  });

  // Exporter toutes les conversations d'une période
  fastify.get('/inbox/export/period/:days', { preHandler: [authenticateJWT] }, async (req, reply) => {
    try {
      const clientId = req.user.role === 'admin' ? (req.query.clientId || req.user.id) : req.user.id;
      const days = parseInt(req.params.days) || 7;
      const result = await inboxService.exportConversationsByPeriod(clientId, days);
      
      reply.header('Content-Type', 'text/csv; charset=utf-8');
      reply.header('Content-Disposition', `attachment; filename="conversations_${days}days_${Date.now()}.csv"`);
      return reply.send('\uFEFF' + result.csv);
    } catch (e) { 
      return reply.code(e.statusCode||500).send({ success:false, message:e.message }); 
    }
  });


  // ============================================================
  // RAPPORTS & EXPORTS
  // ============================================================

  fastify.post('/campaigns/:id/export/pdf', { preHandler: [authenticateJWT] }, async (req, reply) => {
    try {
      const clientId = req.user.role === 'admin' ? (req.body.clientId||req.user.id) : req.user.id;
      const result = await reportService.generateCampaignPDF(req.params.id, clientId, req.user.id, req.body);
      return reply.send(result);
    } catch (e) { return reply.code(e.statusCode||500).send({ success:false, message:e.message }); }
  });

  fastify.get('/campaigns/:id/export/csv', { preHandler: [authenticateJWT] }, async (req, reply) => {
    try {
      const clientId = req.user.role === 'admin' ? (req.query.clientId||req.user.id) : req.user.id;
      const result = await reportService.generateCampaignCSV(req.params.id, clientId, {
        status: req.query.status, start_date: req.query.start_date, end_date: req.query.end_date
      });
      reply.header('Content-Type', 'text/csv; charset=utf-8');
      reply.header('Content-Disposition', `attachment; filename="${result.filename}"`);
      return reply.code(200).send('\uFEFF' + result.csv); // BOM pour Excel
    } catch (e) { return reply.code(e.statusCode||500).send({ success:false, message:e.message }); }
  });

  fastify.get('/exports/:exportId/status', { preHandler: [authenticateJWT] }, async (req, reply) => {
    try {
      const result = await reportService.getExportStatus(req.params.exportId, req.user.id);
      return reply.send(result);
    } catch (e) { return reply.code(e.statusCode||500).send({ success:false, message:e.message }); }
  });

  fastify.get('/exports', { preHandler: [authenticateJWT] }, async (req, reply) => {
    try {
      const result = await reportService.listExports(req.user.id, req.query.campaignId);
      return reply.send(result);
    } catch (e) { return reply.code(e.statusCode||500).send({ success:false, message:e.message }); }
  });

  // Servir les fichiers PDF générés
  fastify.get('/reports/:filename', { preHandler: [authenticateJWT] }, async (req, reply) => {
    try {
      const filePath = reportService.getReportFilePath(req.params.filename);
      reply.header('Content-Type', 'application/pdf');
      reply.header('Content-Disposition', `attachment; filename="${req.params.filename}"`);
      return reply.send(fs.createReadStream(filePath));
    } catch (e) { return reply.code(e.statusCode||404).send({ success:false, message:e.message }); }
  });

  // Cron interne : traitement des étapes d'automatisation (appelé par un scheduler)
  fastify.post('/automations/cron/process', {
    preHandler: [authenticateJWT, requireRole(ROLES.ADMIN)]
  }, async (req, reply) => {
    try {
      const result = await automationService.processScheduledSteps();
      return reply.send({ success:true, ...result });
    } catch (e) { return reply.code(500).send({ success:false, message:e.message }); }
  });

  // ============================================================
// ROUTE SIMPLE POUR EXPORT PDF (sans préfixe complexe)
// ============================================================
fastify.post('/export-pdf/:campaignId', { preHandler: [authenticateJWT] }, async (req, reply) => {
  try {
    const clientId = req.user.role === 'admin' ? (req.body.clientId || req.user.id) : req.user.id;
    const userId = req.user.id;
    const campaignId = req.params.campaignId;
    const options = req.body;

    const result = await reportService.generateCampaignPDF(campaignId, clientId, userId, options);
    return reply.send(result);
  } catch (e) {
    req.log.error(e);
    return reply.code(e.statusCode || 500).send({ success: false, message: e.message });
  }
});

fastify.get('/debug-routes', { preHandler: [authenticateJWT] }, async (req, reply) => {
  const routes = fastify.printRoutes();
  return reply.send({ routes });
});
}

module.exports = phase2Routes;
