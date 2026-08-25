// src/controllers/webhook/prelude.webhook.controller.js
const { query } = require('../../config/database');
const logger = require('../../utils/logger');
const preludeService = require('../../services/prelude.service');
const crypto = require('crypto');

async function handlePreludeWebhook(request, reply) {
    try {
        const payload = request.body;
        const signature = request.headers['x-prelude-signature'];

        // Vérifier la signature
        const secret = process.env.PRELUDE_WEBHOOK_SECRET;
        if (secret && signature) {
            const expected = crypto
                .createHmac('sha256', secret)
                .update(JSON.stringify(payload))
                .digest('hex');
            
            if (signature !== expected) {
                logger.warn('Signature webhook invalide');
                return reply.code(401).send({ error: 'Invalid signature' });
            }
        }

        logger.info('Webhook Prelude reçu:', {
            event: payload.event,
            message_id: payload.message_id,
            status: payload.status
        });

        // Mise à jour du statut du message
        if (payload.message_id) {
            const statusField = payload.status === 'sent' ? 'sent_at' :
                               payload.status === 'delivered' ? 'delivered_at' :
                               payload.status === 'read' ? 'read_at' :
                               payload.status === 'failed' ? 'failed_at' : null;

            await query(
                `UPDATE messages 
                 SET wa_status = $1,
                     ${statusField ? statusField + ' = CURRENT_TIMESTAMP,' : ''}
                     prelude_response = prelude_response || $2::jsonb
                 WHERE prelude_message_id = $3`,
                [payload.status, JSON.stringify(payload), payload.message_id]
            );

            // Récupérer le client_id pour le webhook
            const message = await query(
                `SELECT client_id FROM messages WHERE prelude_message_id = $1`,
                [payload.message_id]
            );

            if (message.rows[0]) {
                // Déclencher le webhook client
                await preludeService.triggerClientWebhook(
                    message.rows[0].client_id,
                    `message.${payload.status}`,
                    {
                        message_id: payload.message_id,
                        status: payload.status,
                        channel: payload.channel,
                        timestamp: new Date().toISOString()
                    }
                );
            }
        }

        // Mise à jour de campagne si batch
        if (payload.batch_id) {
            await query(
                `UPDATE batch_campaigns 
                 SET successful = successful + 1
                 WHERE id = $1`,
                [payload.batch_id]
            );
        }

        return reply.code(200).send({ status: 'ok' });

    } catch (error) {
        logger.error('Erreur webhook Prelude:', error);
        return reply.code(200).send({ status: 'error' });
    }
}

module.exports = { handlePreludeWebhook };
