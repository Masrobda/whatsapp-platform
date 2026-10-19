// src/routes/v1/client/preferences.routes.js
const preludeService = require('../../../services/prelude.service');
const { query } = require('../../../config/database'); // AJOUTER CETTE LIGNE
const { authenticateJWT } = require('../../../middlewares/auth.middleware');

async function clientPreferencesRoutes(fastify, options) {
    const auth = { preHandler: [authenticateJWT] };

    // Récupérer les préférences
    fastify.get('/preferences', auth, async (request, reply) => {
        try {

      let clientIdToUse;

if (request.user.type === 'client' || request.user.role === 'client') {
  // C'est un vrai client → on utilise son ID
  clientIdToUse = request.user.id;
} else {
  // C'est un admin ou autre → on ne touche pas aux prefs, ou on prend un clientId depuis query/params si fourni
  // Pour la validation commande, on devrait recevoir clientId en paramètre ou body
  clientIdToUse = request.query.clientId || request.body?.clientId;
  
  if (!clientIdToUse) {
    logger.warn('[PREFERENCES] Appel depuis admin sans clientId fourni – fallback safe');
    return reply.send({
      success: true,
      preferences: {
        preferred_channel: 'whatsapp',
        allow_fallback: true,
        opt_out_sms: false,
        opt_out_whatsapp: false,
        marketing_opt_in: true,
        transactional_opt_in: true,
        daily_message_limit: 1000
      }
    });
  }
}

const preferences = await preludeService.getClientPreferences(clientIdToUse);

            return reply.send({
                success: true,
                data: preferences
            });
        } catch (error) {
            return reply.code(500).send({
                success: false,
                message: error.message
            });
        }
    });

    // Mettre à jour les préférences
    fastify.put('/preferences', auth, async (request, reply) => {
        try {
            const preferences = await preludeService.updateClientPreferences(
                request.user.id, 
                request.body
            );
            return reply.send({
                success: true,
                message: 'Préférences mises à jour',
                data: preferences
            });
        } catch (error) {
            return reply.code(500).send({
                success: false,
                message: error.message
            });
        }
    });

    // Statistiques personnelles
    fastify.get('/stats', auth, async (request, reply) => {
        try {
            const { period = '30days' } = request.query;
            const stats = await preludeService.getStats(request.user.id, period);
            return reply.send(stats);
        } catch (error) {
            return reply.code(500).send({
                success: false,
                message: error.message
            });
        }
    });

    // Webhooks personnels
    fastify.get('/webhooks', auth, async (request, reply) => {
        try {
            const webhooks = await query(
                `SELECT * FROM client_webhooks WHERE client_id = $1 AND is_active = true`,
                [request.user.id]
            );
            return reply.send({
                success: true,
                data: webhooks.rows
            });
        } catch (error) {
            return reply.code(500).send({
                success: false,
                message: error.message
            });
        }
    });

    fastify.post('/webhooks', auth, async (request, reply) => {
        try {
            const { url, events, secret } = request.body;
            
            const result = await query(
                `INSERT INTO client_webhooks (client_id, url, events, secret)
                 VALUES ($1, $2, $3, $4)
                 RETURNING *`,
                [request.user.id, url, events, secret]
            );

            return reply.code(201).send({
                success: true,
                message: 'Webhook créé',
                data: result.rows[0]
            });
        } catch (error) {
            return reply.code(500).send({
                success: false,
                message: error.message
            });
        }
    });

    fastify.delete('/webhooks/:id', auth, async (request, reply) => {
        try {
            const { id } = request.params;
            await query(
                `DELETE FROM client_webhooks WHERE id = $1 AND client_id = $2`,
                [id, request.user.id]
            );
            return reply.send({
                success: true,
                message: 'Webhook supprimé'
            });
        } catch (error) {
            return reply.code(500).send({
                success: false,
                message: error.message
            });
        }
    });

    // Validation de numéro
    fastify.post('/validate-phone', auth, async (request, reply) => {
        try {
            const { phone } = request.body;
            const available = await preludeService.checkWhatsAppAvailability(phone);
            
            return reply.send({
                success: true,
                data: {
                    phone,
                    whatsapp_available: available,
                    formatted: preludeService.formatPhoneNumber(phone),
                    country_code: preludeService.extractCountryCode(phone)
                }
            });
        } catch (error) {
            return reply.code(500).send({
                success: false,
                message: error.message
            });
        }
    });
}

module.exports = clientPreferencesRoutes;
