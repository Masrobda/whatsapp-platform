// src/services/sendzen.service.js
const axios = require('axios');
const logger = require('../utils/logger');

class SendZenService {
  constructor(apiKey, instanceId) {
    this.apiKey = apiKey || process.env.SENDZEN_API_KEY;
    this.instanceId = instanceId || process.env.SENDZEN_INSTANCE_ID;
    this.baseURL = process.env.SENDZEN_API_URL || 'https://api.sendzen.com.br';
    this.client = axios.create({
      baseURL: this.baseURL,
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${this.apiKey}`
      }
    });
  }

  // Envoyer un message texte
  async sendTextMessage(to, message, options = {}) {
    try {
      const response = await this.client.post('/messages/send', {
        instanceId: this.instanceId,
        to: this.formatPhoneNumber(to),
        type: 'text',
        content: message,
        ...options
      });

      return {
        success: true,
        wa_message_id: response.data.messageId, // Correspond à votre champ wa_message_id
        status: 'sent',
        data: response.data
      };
    } catch (error) {
      logger.error('[SendZen] Erreur envoi message texte:', error.response?.data || error.message);
      return {
        success: false,
        error: error.response?.data || error.message,
        errorCode: error.response?.data?.code,
        errorMessage: error.response?.data?.message
      };
    }
  }

  // Envoyer un template
  async sendTemplateMessage(to, templateName, languageCode = 'fr', components = [], options = {}) {
    try {
      const response = await this.client.post('/messages/template', {
        instanceId: this.instanceId,
        to: this.formatPhoneNumber(to),
        templateName,
        languageCode,
        components,
        ...options
      });

      return {
        success: true,
        wa_message_id: response.data.messageId,
        status: 'sent',
        data: response.data
      };
    } catch (error) {
      logger.error('[SendZen] Erreur envoi template:', error.response?.data || error.message);
      return {
        success: false,
        error: error.response?.data || error.message,
        errorCode: error.response?.data?.code,
        errorMessage: error.response?.data?.message
      };
    }
  }

  // Envoyer un média
  async sendMediaMessage(to, mediaUrl, type = 'image', caption = '', options = {}) {
    try {
      const response = await this.client.post('/messages/media', {
        instanceId: this.instanceId,
        to: this.formatPhoneNumber(to),
        type,
        mediaUrl,
        caption,
        ...options
      });

      return {
        success: true,
        wa_message_id: response.data.messageId,
        status: 'sent',
        data: response.data
      };
    } catch (error) {
      logger.error('[SendZen] Erreur envoi média:', error.response?.data || error.message);
      return {
        success: false,
        error: error.response?.data || error.message,
        errorCode: error.response?.data?.code,
        errorMessage: error.response?.data?.message
      };
    }
  }

  // Récupérer le statut d'un message
  async getMessageStatus(messageId) {
    try {
      const response = await this.client.get(`/messages/${messageId}/status`);
      return {
        success: true,
        status: this.mapSendZenStatus(response.data.status),
        data: response.data
      };
    } catch (error) {
      logger.error('[SendZen] Erreur récupération statut:', error.response?.data || error.message);
      return {
        success: false,
        error: error.response?.data || error.message
      };
    }
  }

  // Formater le numéro de téléphone
  formatPhoneNumber(phone) {
    let cleaned = phone.replace(/\D/g, '');
    if (!cleaned.startsWith('+')) {
      if (cleaned.length === 9) {
        cleaned = '33' + cleaned;
      } else if (cleaned.length === 10 && cleaned.startsWith('0')) {
        cleaned = '33' + cleaned.substring(1);
      }
      cleaned = '+' + cleaned;
    }
    return cleaned;
  }

  // Mapper les statuts SendZen vers vos statuts
  mapSendZenStatus(sendzenStatus) {
    const statusMap = {
      'pending': 'queued',
      'sent': 'sent',
      'delivered': 'delivered',
      'read': 'read',
      'failed': 'failed',
      'cancelled': 'failed',
      'expired': 'failed'
    };
    return statusMap[sendzenStatus] || 'queued';
  }

  // Configurer le webhook
  async setupWebhook(webhookUrl) {
    try {
      const response = await this.client.post('/webhook/register', {
        instanceId: this.instanceId,
        webhookUrl,
        events: ['message.sent', 'message.delivered', 'message.read', 'message.failed']
      });
      return response.data;
    } catch (error) {
      logger.error('[SendZen] Erreur configuration webhook:', error);
      throw error;
    }
  }

  // Vérifier la connexion
  async testConnection() {
    try {
      const response = await this.client.get('/instance/status', {
        params: { instanceId: this.instanceId }
      });
      return {
        success: true,
        connected: response.data.connected,
        data: response.data
      };
    } catch (error) {
      logger.error('[SendZen] Erreur test connexion:', error);
      return {
        success: false,
        connected: false,
        error: error.message
      };
    }
  }
}

module.exports = SendZenService;
