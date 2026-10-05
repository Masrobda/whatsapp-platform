// src/routes/v1/prelude.routes.js
const preludeService = require('../../services/prelude.service');
const messageService = require('../../services/message.service');
const { authenticateJWT, authenticateApiToken } = require('../../middlewares/auth.middleware');

async function preludeRoutes(fastify, options) {

    // POST /api/v1/prelude/send - Envoyer un message
    fastify.post('/send', {
        preHandler: [async (request, reply) => {
            try {
                await authenticateApiToken(request, reply);
            } catch {
                await authenticateJWT(request, reply);
            }
        }]
    }, async (request, reply) => {
        try {
            const clientId = request.client?.id || request.user?.id;
            
            const result = await messageService.sendMessage(clientId, {
                phoneNumber: request.body.phoneNumber,
                recipient_phone: request.body.recipient_phone,
                message_type: request.body.message_type || 'template',
                template_name: request.body.template_name || request.body.template_id,
                template_params: request.body.template_params || 
                    (request.body.variables ? Object.values(request.body.variables) : []),
                ...request.body
            });

            return reply.code(201).send(result);
        } catch (error) {
            return reply.code(error.statusCode || 500).send({
                success: false,
                message: error.message
            });
        }
    });

    // POST /api/v1/prelude/batch - Envoi en lot
    fastify.post('/batch', {
        preHandler: [authenticateJWT]
    }, async (request, reply) => {
        try {
            const clientId = request.user.id;
            const result = await preludeService.sendBatchMessages(clientId, {
                name: request.body.name,
                template_id: request.body.template_id,
                recipients: request.body.recipients,
                channel: request.body.preferred_channel,
                schedule_at: request.body.schedule_at
            });
            return reply.code(201).send(result);
        } catch (error) {
            return reply.code(500).send({
                success: false,
                message: error.message
            });
        }
    });

    // GET /api/v1/prelude/status/:messageId - Statut d'un message
    fastify.get('/status/:messageId', {
        preHandler: [authenticateJWT]
    }, async (request, reply) => {
        try {
            const { messageId } = request.params;
            const status = await preludeService.getMessageStatus(messageId);
            return reply.send({
                success: true,
                data: status
            });
        } catch (error) {
            return reply.code(500).send({
                success: false,
                message: error.message
            });
        }
    });

    // POST /api/v1/prelude/check-whatsapp - Vérifier disponibilité WhatsApp
    fastify.post('/check-whatsapp', {
        preHandler: [authenticateJWT]
    }, async (request, reply) => {
        try {
            const { phone } = request.body;
            const available = await preludeService.checkWhatsAppAvailability(phone);
            return reply.send({
                success: true,
                data: {
                    phone,
                    whatsapp_available: available,
                    formatted: preludeService.formatPhoneNumber(phone)
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

module.exports = preludeRoutes;
