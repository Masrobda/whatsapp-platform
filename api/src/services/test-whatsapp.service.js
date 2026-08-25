const logger = require('../utils/logger');

class TestWhatsAppService {
  constructor() {
    this.name = 'TestWhatsAppService';
    this.simulateDelay = 1000; // 1 seconde
    this.successRate = 1.0; // 100% de succès
  }

  /**
   * Simuler l'envoi d'un message texte
   */
  async sendTextMessage(recipientPhone, messageContent) {
    try {
      logger.info(`[TestWhatsAppService] Simulating text message to ${recipientPhone}`);
      logger.info(`[TestWhatsAppService] Content: ${messageContent.substring(0, 50)}...`);
      
      // Simuler un délai d'envoi
      await new Promise(resolve => setTimeout(resolve, this.simulateDelay));
      
      // Simuler un succès ou échec aléatoire (si successRate < 1)
      const isSuccess = Math.random() < this.successRate;
      
      if (!isSuccess) {
        return {
          success: false,
          error: 'Simulated failure',
          errorCode: 'TEST_FAILURE'
        };
      }
      
      // Générer un ID de message simulé
      const messageId = `test_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
      
      return {
        success: true,
        messageId: messageId,
        status: 'delivered',
        simulated: true,
        timestamp: new Date().toISOString()
      };
      
    } catch (error) {
      logger.error('[TestWhatsAppService] Error:', error);
      return {
        success: false,
        error: error.message,
        errorCode: 'TEST_ERROR'
      };
    }
  }

  /**
   * Simuler l'envoi d'un message template
   */
  async sendTemplateMessage(recipientPhone, templateName, languageCode, parameters = []) {
    try {
      logger.info(`[TestWhatsAppService] Simulating template message to ${recipientPhone}`);
      logger.info(`[TestWhatsAppService] Template: ${templateName}, Language: ${languageCode}`);
      
      await new Promise(resolve => setTimeout(resolve, this.simulateDelay));
      
      const messageId = `template_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
      
      return {
        success: true,
        messageId: messageId,
        status: 'delivered',
        simulated: true,
        template: templateName,
        parameters: parameters
      };
      
    } catch (error) {
      logger.error('[TestWhatsAppService] Error:', error);
      return {
        success: false,
        error: error.message,
        errorCode: 'TEST_ERROR'
      };
    }
  }

  /**
   * Simuler l'envoi d'un média
   */
  async sendMediaMessage(recipientPhone, mediaType, mediaUrl, caption = '') {
    try {
      logger.info(`[TestWhatsAppService] Simulating media message to ${recipientPhone}`);
      logger.info(`[TestWhatsAppService] Type: ${mediaType}, URL: ${mediaUrl}`);
      
      await new Promise(resolve => setTimeout(resolve, this.simulateDelay));
      
      const messageId = `media_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
      
      return {
        success: true,
        messageId: messageId,
        status: 'delivered',
        simulated: true,
        mediaType: mediaType
      };
      
    } catch (error) {
      logger.error('[TestWhatsAppService] Error:', error);
      return {
        success: false,
        error: error.message,
        errorCode: 'TEST_ERROR'
      };
    }
  }
}

module.exports = new TestWhatsAppService();
