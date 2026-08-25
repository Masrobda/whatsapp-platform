
// src/routes/v1/index.js
const authRoutes                  = require('./auth.routes');
const orderRoutes                 = require('./order.routes');
const messageRoutes               = require('./message.routes');
const webhookRoutes               = require('./webhook.routes');
const clientRoutes                = require('./client.routes');
const whatsappRoutes              = require('./whatsapp.routes');
const notificationRoutes          = require('./notification.routes');
const adminRoutes                 = require('./admin.routes');
const bspRoutes                   = require('./bsp.routes');
const invoiceDisbursementRoutes   = require('./invoice-disbursement.routes');
const queueRoutes                 = require('./queue.routes');
const statsRoutes                 = require('./stats.routes');
const templateRoutes              = require('./template.routes');
const reconciliationRoutes        = require('./reconciliation.routes');
const storageRoutes               = require('./storage.routes');
const invitationsRoutes           = require('./invitations.routes');
const monitoringRoutes            = require('./monitoring.routes');
const preludeRoutes = require('./prelude.routes');
const adminPreludeRoutes = require('./admin/prelude.routes');
const clientPreferencesRoutes = require('./client/preferences.routes');
const { handlePreludeWebhook } = require('../../controllers/webhook/prelude.webhook.controller');
const messageStockRoutes = require('./message-stock.routes');
const templateAssignmentRoutes = require('./template-assignment.routes');
const clientWebhookRoutes = require('./client-webhook.routes');
const campaignRoutes = require('./campaign.routes');
const phase2Routes = require('./phase2.routes');
const phase3Routes = require('./phase3.routes');
const alarmRoutes = require('./alarm.routes');
const audienceRoutes = require('./audience.routes');
const vehicleMappingRoutes = require('./vehicle-mapping.routes');
const sessionRoutes = require('./session.routes');
const botDashboardRoutes = require('./bot-dashboard.routes');

/**
 * Enregistrement centralisé et explicite de toutes les routes v1
 */
async function v1Routes(fastify, opts) {
  // ────────────────────────────────────────────────
  // Authentification & utilisateurs
  // ────────────────────────────────────────────────
  fastify.register(authRoutes,        { prefix: '/auth' });

  // ────────────────────────────────────────────────
  // Clients & profils
  // ────────────────────────────────────────────────
  fastify.register(clientRoutes,      { prefix: '/client' });

  // ────────────────────────────────────────────────
  // Commandes & facturation
  // ────────────────────────────────────────────────
  fastify.register(orderRoutes,       { prefix: '/orders' });
  fastify.register(invoiceDisbursementRoutes, { prefix: '/invoice-disbursements' });
  fastify.register(reconciliationRoutes, { prefix: '/reconciliation' });
  fastify.register(preludeRoutes, { prefix: '/prelude' });

  // ────────────────────────────────────────────────
  // Messages WhatsApp & templates
  // ────────────────────────────────────────────────
  fastify.register(messageRoutes,     { prefix: '/messages' });
  fastify.register(whatsappRoutes,    { prefix: '/whatsapp' });
  fastify.register(templateRoutes,    { prefix: '/templates' });
  fastify.register(messageStockRoutes, { prefix: '/message-stock' });
  fastify.register(templateAssignmentRoutes, { prefix: '/template-assignments' });
  fastify.register(sessionRoutes, { prefix: '/sessions' });  
  fastify.register(botDashboardRoutes, { prefix: '/bot' });

  // ────────────────────────────────────────────────
  // CAMPAGNES WHATSAPP ← AJOUTER CETTE SECTION
  // ────────────────────────────────────────────────
  fastify.register(campaignRoutes,    { prefix: '/campaigns' });
  fastify.register(phase2Routes);     // ← Pas de préfixe !
  fastify.register(phase3Routes);     // ← Pas de préfixe !
  fastify.register(audienceRoutes, { prefix: '/audience' });
  // ────────────────────────────────────────────────
  // Webhooks & notifications
  // ────────────────────────────────────────────────
  fastify.register(webhookRoutes,     { prefix: '/webhooks' });
  fastify.register(clientWebhookRoutes, { prefix: '/webhooks' });
  fastify.register(notificationRoutes, { prefix: '/notifications' });
  fastify.post('/webhook/prelude', handlePreludeWebhook);

  // ────────────────────────────────────────────────
  // Administration & monitoring
  // ────────────────────────────────────────────────
  fastify.register(adminRoutes,       { prefix: '/admin' });
  fastify.register(monitoringRoutes,  { prefix: '/monitoring' });
  fastify.register(adminPreludeRoutes, { prefix: '/admin/prelude' });
  fastify.register(clientPreferencesRoutes, { prefix: '/client' });

  // ────────────────────────────────────────────────
  // Files, storage, queue & stats
  // ────────────────────────────────────────────────
  fastify.register(storageRoutes,     { prefix: '/storage' });
  fastify.register(queueRoutes,       { prefix: '/queue' });
  fastify.register(statsRoutes,       { prefix: '/stats' });

  // ────────────────────────────────────────────────
  // Invitations & BSP
  // ────────────────────────────────────────────────
  fastify.register(invitationsRoutes, { prefix: '/invitations' });
  fastify.register(bspRoutes,         { prefix: '/bsp' });

  // ────────────────────────────────────────────────
  // Alarmes & vidéos (nouveau)
  // ────────────────────────────────────────────────
  fastify.register(alarmRoutes, { prefix: '/alarm' });
  fastify.register(vehicleMappingRoutes, { prefix: '/vehicle-mapping' });

  // ────────────────────────────────────────────────
  // Health check (accessible sans authentification)
  // ────────────────────────────────────────────────
  fastify.get('/health', async (request, reply) => {
    return {
      success: true,
      status: 'healthy',
      timestamp: new Date().toISOString(),
      uptime: process.uptime(),
      services: {
        whatsapp: process.env.WHATSAPP_TEST_MODE === 'true' ? 'test' : 'production',
        redis: fastify.redis ? 'connected' : 'not configured',
        // Ajoute d'autres checks si besoin (db, etc.)
      }
    };
  });

  // Optionnel : une petite route racine v1 pour debug
  fastify.get('/', async () => ({
    api: 'v1',
    message: 'NEXT LTD API v1 – toutes les routes sont sous /api/v1/*',
    time: new Date().toISOString()
  }));
}

module.exports = v1Routes;
