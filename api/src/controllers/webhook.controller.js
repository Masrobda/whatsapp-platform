const { query } = require('../config/database');
const logger = require('../utils/logger');
const crypto = require('crypto');
const { isTestMode } = require('../services/whatsapp.service');

// ============================================
// CONFIGURATION MODE TEST
// ============================================
const TEST_MODE = true; // Activez/désactivez le mode test webhook

/**
 * Vérifier la signature du webhook 360dialog
 */
function verifyWebhookSignature(payload, signature) {
  const secret = process.env.DIALOG360_WEBHOOK_SECRET;
  
  if (!secret) {
    logger.warn('DIALOG360_WEBHOOK_SECRET non configuré');
    return true; // En dev, accepter sans vérification
  }

  const hash = crypto
    .createHmac('sha256', secret)
    .update(JSON.stringify(payload))
    .digest('hex');

  return hash === signature;
}

/**
 * POST /api/v1/webhook/360dialog
 * Webhook pour recevoir les événements de 360dialog
 */
async function handle360DialogWebhook(request, reply) {
  try {
    const payload = request.body;
    const signature = request.headers['x-hub-signature-256'];

    // Log du webhook reçu
    logger.info('Webhook 360dialog reçu:', {
      type: payload.entry?.[0]?.changes?.[0]?.value?.statuses?.[0]?.status || 'unknown',
      testMode: TEST_MODE
    });

    // Si en mode test, simuler des événements
    if (TEST_MODE || isTestMode()) {
      console.log('⚠️  ================================');
      console.log('⚠️  WEBHOOK EN MODE TEST');
      console.log('⚠️  Simulation des événements WhatsApp');
      console.log('⚠️  ================================');
      
      return handleTestWebhook(payload, reply);
    }

    // Vérifier la signature (mode production)
    if (signature && !verifyWebhookSignature(payload, signature)) {
      logger.warn('Signature webhook invalide');
      return reply.code(401).send({ error: 'Invalid signature' });
    }

    // Traiter chaque entrée
    if (payload.entry) {
      for (const entry of payload.entry) {
        if (entry.changes) {
          for (const change of entry.changes) {
            await processWebhookChange(change);
          }
        }
      }
    }

    // Réponse immédiate pour 360dialog
    return reply.code(200).send({ status: 'ok' });

  } catch (error) {
    logger.error('Erreur traitement webhook:', error);
    // Toujours retourner 200 pour éviter les retry de 360dialog
    return reply.code(200).send({ status: 'error' });
  }
}

/**
 * Gérer le webhook en mode test
 */
async function handleTestWebhook(payload, reply) {
  try {
    console.log('🔧 [TEST WEBHOOK] Simulation d\'événements WhatsApp');
    
    // Générer des événements de test basés sur le payload
    if (payload.test_events) {
      // Mode test explicite avec événements spécifiés
      await processTestEvents(payload.test_events);
    } else {
      // Mode test automatique - générer des événements aléatoires
      await generateRandomTestEvents();
    }
    
    console.log('✅ [TEST WEBHOOK] Événements simulés avec succès');
    
    return reply.code(200).send({ 
      status: 'ok',
      test_mode: true,
      message: 'Webhook traité en mode test'
    });

  } catch (error) {
    console.error('❌ [TEST WEBHOOK] Erreur:', error);
    return reply.code(200).send({ 
      status: 'error',
      test_mode: true,
      error: error.message 
    });
  }
}

/**
 * Générer des événements de test aléatoires
 */
async function generateRandomTestEvents() {
  try {
    // Récupérer les derniers messages envoyés
    const messagesResult = await query(
      `SELECT id, wa_message_id, recipient_phone, created_at 
       FROM messages 
       WHERE wa_status IN ('queued', 'sent')
       ORDER BY created_at DESC 
       LIMIT 5`
    );

    if (messagesResult.rows.length === 0) {
      console.log('ℹ️  [TEST WEBHOOK] Aucun message récent pour simuler des événements');
      return;
    }

    const messages = messagesResult.rows;
    
    // Simuler différents statuts pour les messages
    const statuses = ['sent', 'delivered', 'read', 'failed'];
    
    for (const message of messages) {
      const randomStatus = statuses[Math.floor(Math.random() * statuses.length)];
      const timestamp = Math.floor(Date.now() / 1000) - Math.floor(Math.random() * 3600);
      
      const simulatedStatus = {
        id: message.wa_message_id || `test_msg_${message.id}`,
        status: randomStatus,
        timestamp: timestamp,
        recipient_id: message.recipient_phone,
        conversation: {
          id: `conversation_${Date.now()}`,
          expiration_timestamp: timestamp + 86400
        },
        pricing: {
          pricing_model: 'CBP',
          billable: true,
          category: 'business_initiated'
        }
      };

      if (randomStatus === 'failed') {
        simulatedStatus.errors = [{
          code: 131047,
          title: 'Message expired before delivery',
          href: 'https://developers.facebook.com/docs/whatsapp/cloud-api/support/error-codes/'
        }];
      }

      console.log(`📊 [TEST WEBHOOK] Simulation statut: ${randomStatus} pour message ${message.id}`);
      
      // Mettre à jour le statut en base
      await updateMessageStatus(simulatedStatus);
      
      // Attendre un peu entre chaque événement
      await new Promise(resolve => setTimeout(resolve, 500));
    }
    
  } catch (error) {
    console.error('❌ [TEST WEBHOOK] Erreur génération événements:', error);
  }
}

/**
 * Traiter des événements de test spécifiques
 */
async function processTestEvents(testEvents) {
  try {
    console.log(`🔧 [TEST WEBHOOK] Traitement de ${testEvents.length} événements de test`);
    
    for (const event of testEvents) {
      console.log(`📋 [TEST WEBHOOK] Événement:`, event);
      
      switch (event.type) {
        case 'message_status':
          await updateMessageStatus(event.data);
          break;
          
        case 'incoming_message':
          await handleIncomingMessage(event.data);
          break;
          
        case 'opt_in':
          console.log(`✅ [TEST WEBHOOK] Opt-in simulé: ${event.data.phone}`);
          break;
          
        case 'opt_out':
          console.log(`🚫 [TEST WEBHOOK] Opt-out simulé: ${event.data.phone}`);
          await handleIncomingMessage({
            from: event.data.phone,
            type: 'text',
            text: { body: 'stop' }
          });
          break;
          
        default:
          console.log(`⚠️  [TEST WEBHOOK] Type d'événement non reconnu: ${event.type}`);
      }
      
      await new Promise(resolve => setTimeout(resolve, 300));
    }
    
  } catch (error) {
    console.error('❌ [TEST WEBHOOK] Erreur traitement événements:', error);
  }
}

/**
 * Endpoint pour tester le webhook manuellement
 * POST /api/v1/webhook/test
 */
async function testWebhookHandler(request, reply) {
  try {
    if (!TEST_MODE && !isTestMode()) {
      return reply.code(403).send({
        success: false,
        code: 'TEST_MODE_REQUIRED',
        message: 'Le mode test doit être activé pour utiliser cet endpoint'
      });
    }

    const testData = request.body;
    
    console.log('🧪 [TEST WEBHOOK] Test manuel déclenché');
    console.log('🧪 [TEST WEBHOOK] Données de test:', testData);
    
    // Générer un payload de test
    const testPayload = {
      test_events: testData.events || [
        {
          type: 'message_status',
          data: {
            id: testData.message_id || `test_msg_${Date.now()}`,
            status: testData.status || 'delivered',
            timestamp: Math.floor(Date.now() / 1000),
            recipient_id: testData.recipient_phone || '+237600000000'
          }
        }
      ]
    };
    
    // Simuler le traitement
    await handleTestWebhook(testPayload, {
      code: (statusCode) => ({
        send: (data) => {
          console.log(`🧪 [TEST WEBHOOK] Réponse simulée (${statusCode}):`, data);
          return data;
        }
      })
    });
    
    return reply.code(200).send({
      success: true,
      message: 'Test webhook exécuté avec succès',
      test_mode: true,
      data: testPayload
    });

  } catch (error) {
    console.error('❌ [TEST WEBHOOK] Erreur test manuel:', error);
    return reply.code(500).send({
      success: false,
      code: 'TEST_ERROR',
      message: error.message
    });
  }
}

/**
 * Mettre à jour le statut d'un message (inchangé)
 */
async function updateMessageStatus(status) {
  try {
    const waMessageId = status.id;
    const newStatus = status.status; // sent, delivered, read, failed
    const timestamp = new Date(parseInt(status.timestamp) * 1000);

    logger.info('Mise à jour statut message:', {
      waMessageId,
      status: newStatus,
      timestamp
    });

    // Déterminer le champ timestamp à mettre à jour
    let timestampField;
    switch (newStatus) {
      case 'sent':
        timestampField = 'sent_at';
        break;
      case 'delivered':
        timestampField = 'delivered_at';
        break;
      case 'read':
        timestampField = 'read_at';
        break;
      case 'failed':
        timestampField = 'failed_at';
        break;
      default:
        timestampField = null;
    }

    // Construire la requête de mise à jour
    let updateQuery = `UPDATE messages SET wa_status = $1`;
    const params = [newStatus];
    let paramIndex = 2;

    if (timestampField) {
      updateQuery += `, ${timestampField} = $${paramIndex}`;
      params.push(timestamp);
      paramIndex++;
    }

    // Ajouter les informations d'erreur si présentes
    if (status.errors && status.errors.length > 0) {
      const error = status.errors[0];
      updateQuery += `, wa_error_code = $${paramIndex}, wa_error_message = $${paramIndex + 1}`;
      params.push(error.code, error.title);
      paramIndex += 2;
    }

    updateQuery += ` WHERE wa_message_id = $${paramIndex}`;
    params.push(waMessageId);

    const result = await query(updateQuery, params);

    if (result.rowCount === 0) {
      logger.warn('Message non trouvé pour mise à jour:', waMessageId);
    } else {
      logger.info('Statut message mis à jour:', {
        waMessageId,
        newStatus,
        rowsUpdated: result.rowCount
      });
    }

  } catch (error) {
    logger.error('Erreur updateMessageStatus:', error);
  }
}

/**
 * Gérer les messages entrants (inchangé)
 */
async function handleIncomingMessage(message) {
  try {
    const from = message.from;
    const messageType = message.type;
    const messageText = message.text?.body?.toLowerCase();

    logger.info('Message entrant:', {
      from,
      type: messageType,
      text: messageText
    });

    // Gérer les mots-clés d'opt-out (STOP, ARRÊTER, etc.)
    const optOutKeywords = ['stop', 'arrêter', 'arret', 'unsubscribe', 'désabonner'];
    
    if (messageText && optOutKeywords.some(keyword => messageText.includes(keyword))) {
      logger.warn('Opt-out détecté:', from);
      
      // Marquer les messages futurs comme bloqués
      await query(
        `INSERT INTO audit_logs (action, entity_type, new_values)
         VALUES ($1, $2, $3)`,
        [
          'OPT_OUT_RECEIVED',
          'contact',
          JSON.stringify({ phone: from, message: messageText })
        ]
      );

      // TODO: Implémenter la logique de blocage des envois futurs
      // Pour l'instant, juste logger
    }

  } catch (error) {
    logger.error('Erreur handleIncomingMessage:', error);
  }
}

/**
 * GET /api/v1/webhook/360dialog (Vérification du webhook)
 */
// async function verify360DialogWebhook(request, reply) {
//   try {
//     const mode = request.query['hub.mode'];
//     const token = request.query['hub.verify_token'];
//     const challenge = request.query['hub.challenge'];

//     // Vérifier le token
//     const verifyToken = process.env.DIALOG360_WEBHOOK_SECRET || 'nextltd_verify_token';

//     if (mode === 'subscribe' && token === verifyToken) {
//       logger.info('Webhook 360dialog vérifié avec succès');
//       return reply.code(200).send(challenge);
//     } else {
//       logger.warn('Échec vérification webhook 360dialog');
//       return reply.code(403).send({ error: 'Verification failed' });
//     }

//   } catch (error) {
//     logger.error('Erreur verify webhook:', error);
//     return reply.code(500).send({ error: 'Internal error' });
//   }
// }


async function verify360DialogWebhook(request, reply) {
  try {
    const mode = request.query['hub.mode'];
    const token = request.query['hub.verify_token'];
    const challenge = request.query['hub.challenge'];

    const verifyToken = 'nextltd_verify_token';  // ← force en dur pour test

    console.log('Webhook verify debug:', {
      receivedMode: mode,
      receivedToken: token,
      expectedToken: verifyToken,
      challenge
    });

    if (mode === 'subscribe' && token === verifyToken) {
      logger.info('Webhook 360dialog vérifié avec succès');
      return reply.code(200).send(challenge);
    } else {
      logger.warn('Échec vérification webhook 360dialog', { received: token, expected: verifyToken });
      return reply.code(403).send({ error: 'Verification failed' });
    }
  } catch (error) {
    logger.error('Erreur verify webhook:', error);
    return reply.code(500).send({ error: 'Internal error' });
  }
}

module.exports = {
  handle360DialogWebhook,
  verify360DialogWebhook,
  testWebhookHandler  // <-- AJOUT de la nouvelle fonction
};
