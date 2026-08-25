// src/routes/v1/webhook.routes.js
const {
  handle360DialogWebhook,
  verify360DialogWebhook,
} = require('../../controllers/webhook.controller');
const { handleSendZenWebhook } = require('../../controllers/webhook/sendzen.webhook.controller');
const watiWebhookController = require('../../controllers/webhook/wati.webhook.controller');
const { handleNewAlarm } = require('../../controllers/webhook/hetu-webhook.controller');

/**
 * Routes webhook
 */
async function webhookRoutes(fastify, options) {

  // Vérification du webhook (GET)
  fastify.get('/360dialog', {
    schema: {
      description: 'Vérification du webhook 360dialog',
      tags: ['Webhook'],
      querystring: {
        type: 'object',
        properties: {
          'hub.mode': { type: 'string' },
          'hub.verify_token': { type: 'string' },
          'hub.challenge': { type: 'string' }
        }
      }
    }
  }, verify360DialogWebhook);

  // Réception des événements (POST)
  fastify.post('/360dialog', {
    schema: {
      description: 'Réception des événements 360dialog',
      tags: ['Webhook'],
      body: {
        type: 'object'
      }
    }
  }, handle360DialogWebhook);

  // Webhook SendZen - ✅ CORRIGÉ : placé À L'INTÉRIEUR de la fonction
  fastify.post('/sendzen', {
    config: {
      rawBody: true
    }
  }, handleSendZenWebhook);

// Webhook WATI pour recevoir les statuts
fastify.post('/wati', {
  config: {
    rawBody: true
  },
  schema: {
    description: 'Webhook pour recevoir les statuts WhatsApp de WATI',
    tags: ['Webhook'],
    body: { type: 'object' }
  }
}, watiWebhookController.handleWebhook.bind(watiWebhookController));

fastify.post('/hetu/new-alarm', {
  schema: {
    description: 'Webhook reçu de Hetu lorsqu\'une nouvelle alarme est créée',
    tags: ['Webhook'],
    body: { type: 'object' }
  }
}, handleNewAlarm);

// Endpoint pour tester le webhook WATI
fastify.post('/wati/test', {
  schema: {
    description: 'Tester le webhook WATI',
    tags: ['Webhook'],
    body: { type: 'object' }
  }
}, async (request, reply) => {
  const testPayload = {
    type: 'message_status',
    data: {
      messageId: request.body.messageId || 'test_message_123',
      status: request.body.status || 'delivered',
      timestamp: Math.floor(Date.now() / 1000),
      phoneNumber: request.body.phoneNumber || '+237600000000'
    }
  };
  
  await watiWebhookController.handleWebhook(
    { body: testPayload, headers: {} },
    { code: () => ({ send: (data) => data }) }
  );
  
  return reply.send({
    success: true,
    message: 'Test webhook exécuté',
    payload: testPayload
  });
});

fastify.get('/wati/test', async (request, reply) => {
  return reply.send({ 
    success: true, 
    message: 'Webhook endpoint is reachable',
    timestamp: new Date().toISOString()
  });
});
}

module.exports = webhookRoutes;
