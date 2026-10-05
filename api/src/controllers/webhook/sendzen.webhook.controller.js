// src/controllers/webhook/sendzen.webhook.controller.js
const { query } = require('../../config/database');
const logger = require('../../utils/logger');

async function handleSendZenWebhook(request, reply) {
  try {
    const webhookData = request.body;
    logger.info('[SendZen Webhook] Reçu:', webhookData);

    const {
      messageId,        // ID SendZen du message
      status,           // Statut SendZen
      timestamp,        // Timestamp
      details,          // Détails (erreur éventuelle)
      recipient         // Destinataire
    } = webhookData;

    if (!messageId || !status) {
      return reply.code(400).send({
        success: false,
        error: 'Données webhook incomplètes'
      });
    }

    // Mapper le statut SendZen vers votre statut
    const statusMap = {
      'pending': 'queued',
      'sent': 'sent',
      'delivered': 'delivered',
      'read': 'read',
      'failed': 'failed',
      'cancelled': 'failed',
      'expired': 'failed'
    };

    const mappedStatus = statusMap[status] || 'queued';
    
    // Mettre à jour la table messages
    // Note : votre table a wa_message_id pour stocker l'ID du provider
    const updateResult = await query(
      `UPDATE messages 
       SET wa_status = $1,
           wa_error_message = $2,
           ${mappedStatus}_at = NOW(),
           updated_at = NOW()
       WHERE wa_message_id = $3
       RETURNING id, client_id`,
      [mappedStatus, details || null, messageId]
    );

    if (updateResult.rowCount > 0) {
      const { id: messageId, client_id: clientId } = updateResult.rows[0];

      // Mettre à jour la table partitionnée du client
      if (clientId) {
        const clientTable = `messages_client_${clientId.replace(/-/g, '_')}`;
        
        await query(
          `UPDATE ${clientTable} 
           SET wa_status = $1,
               wa_error_message = $2,
               ${mappedStatus}_at = NOW(),
               updated_at = NOW()
           WHERE id = $3`,
          [mappedStatus, details || null, messageId]
        );
      }

      logger.info(`[SendZen] Message ${messageId} mis à jour: ${status} -> ${mappedStatus}`);
    } else {
      logger.warn(`[SendZen] Message avec wa_message_id ${messageId} non trouvé`);
    }

    return reply.code(200).send({
      success: true,
      received: true
    });

  } catch (error) {
    logger.error('[SendZen Webhook] Erreur:', error);
    return reply.code(500).send({
      success: false,
      error: error.message
    });
  }
}

module.exports = {
  handleSendZenWebhook
};
