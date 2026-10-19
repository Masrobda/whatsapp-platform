// src/services/prelude-provider.service.js
const { PreludeClient } = require('@prelude/notify-sdk');
const logger = require('../utils/logger');

class PreludeProvider {
    constructor() {
        this.client = null;
        this.testMode = process.env.PRELUDE_TEST_MODE === 'true';
    }

    async initialize() {
        if (this.client) return;

        const apiKey = process.env.PRELUDE_API_KEY;
        if (!apiKey && !this.testMode) {
            throw new Error('PRELUDE_API_KEY manquante');
        }

        this.client = {
            notify: {
                send: async (params) => {
                    if (this.testMode) {
                        logger.info('[PRELUDE TEST] Envoi message:', params);
                        return {
                            messages: [{
                                id: `test_${Date.now()}`,
                                status: 'sent'
                            }]
                        };
                    }

                    // Appel réel à l'API Prelude
                    const response = await fetch(`${process.env.PRELUDE_API_URL}/notify`, {
                        method: 'POST',
                        headers: {
                            'Authorization': `Bearer ${apiKey}`,
                            'Content-Type': 'application/json'
                        },
                        body: JSON.stringify(params)
                    });

                    return response.json();
                }
            }
        };
    }

    // Méthodes compatibles avec votre structure actuelle
    async sendTextMessage(recipientPhone, messageText) {
        await this.initialize();

        const params = {
            template_id: 'text_template', // Vous devrez créer un template texte dans Prelude
            to: recipientPhone,
            variables: { message: messageText },
            preferred_channel: 'whatsapp'
        };

        const response = await this.client.notify.send(params);
        
        return {
            success: true,
            messageId: response.messages[0].id,
            status: response.messages[0].status
        };
    }

    async sendTemplateMessage(recipientPhone, templateName, language, parameters = []) {
        await this.initialize();

        // Convertir les paramètres en variables
        const variables = {};
        parameters.forEach((param, index) => {
            variables[`param${index + 1}`] = param;
        });

        const params = {
            template_id: templateName,
            to: recipientPhone,
            variables: variables,
            preferred_channel: 'whatsapp'
        };

        const response = await this.client.notify.send(params);
        
        return {
            success: true,
            messageId: response.messages[0].id,
            status: response.messages[0].status
        };
    }

    async sendMediaMessage(recipientPhone, mediaType, mediaUrl, caption = '') {
        // Pour les médias, Prelude utilise des templates spécifiques
        // Vous devrez créer un template média dans Prelude
        await this.initialize();

        const params = {
            template_id: `media_${mediaType}_template`,
            to: recipientPhone,
            variables: {
                media_url: mediaUrl,
                caption: caption
            },
            preferred_channel: 'whatsapp'
        };

        const response = await this.client.notify.send(params);
        
        return {
            success: true,
            messageId: response.messages[0].id,
            status: response.messages[0].status
        };
    }

    async getMessageStatus(messageId) {
        // À implémenter selon l'API Prelude
        return {
            success: true,
            status: 'sent'
        };
    }

    validatePhoneNumber(phone) {
        // Gardez votre validation actuelle
        let cleanPhone = phone.replace(/[\s\-\(\)]/g, '');
        if (!cleanPhone.startsWith('+')) {
            if (cleanPhone.match(/^[6|2][0-9]{7}$/)) {
                cleanPhone = '+237' + cleanPhone;
            } else {
                cleanPhone = '+' + cleanPhone;
            }
        }
        return cleanPhone;
    }

    isTestMode() {
        return this.testMode;
    }
}

module.exports = new PreludeProvider();
