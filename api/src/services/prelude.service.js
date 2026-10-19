// src/services/prelude.service.js
const { query } = require('../config/database');
const logger = require('../utils/logger');
const { v4: uuidv4 } = require('uuid');
const axios = require('axios');
const crypto = require('crypto');

class PreludeService {
    constructor() {
        this.apiKey = process.env.PRELUDE_API_KEY;
        this.apiUrl = process.env.PRELUDE_API_URL;
        this.testMode = process.env.PRELUDE_TEST_MODE === 'true';
        this.baseHeaders = {
            'Authorization': `Bearer ${this.apiKey}`,
            'Content-Type': 'application/json'
        };
    }

    /**
     * Envoi d'un message via Prelude
     */
    async sendMessage(clientId, messageData) {
        try {
            const {
                template_id,
                recipient_phone,
                variables = {},
                channel,
                schedule_at,
                callback_url,
                metadata = {}
            } = messageData;

            // Récupérer les préférences du client
            const preferences = await this.getClientPreferences(clientId);

            // Déterminer le canal à utiliser
            const channelInfo = await this.determineChannel(
                clientId,
                recipient_phone,
                channel || preferences.preferred_channel,
                preferences
            );

            // Récupérer le template
            const template = await this.getTemplateById(template_id);
            if (!template) {
                throw new Error('Template non trouvé');
            }

            // Récupérer l'ID Prelude du template
            const preludeTemplate = await this.getPreludeTemplate(template.id, channelInfo.channel);
            if (!preludeTemplate) {
                throw new Error(`Template non disponible pour le canal ${channelInfo.channel}`);
            }

            // Préparer les paramètres pour Prelude
            const preludeParams = {
                template_id: preludeTemplate.prelude_template_id,
                to: this.formatPhoneNumber(recipient_phone),
                variables: this.prepareVariables(template, variables),
                preferred_channel: channelInfo.channel,
                metadata: {
                    client_id: clientId,
                    template_id: template.id,
                    ...metadata
                }
            };

            if (schedule_at) {
                preludeParams.schedule_at = schedule_at;
            }

            if (callback_url) {
                preludeParams.callback_url = callback_url;
            }

            // Envoyer à Prelude
            const response = await this.callPreludeAPI('/notify', preludeParams);

            // Gérer le fallback si nécessaire
            let finalResponse = response;
            let fallbackUsed = false;

            if (channelInfo.fallback_allowed &&
                response.status === 'failed' &&
                response.error === 'WHATSAPP_UNAVAILABLE') {

                logger.info(`Fallback SMS activé pour ${recipient_phone}`);

                const fallbackParams = {
                    ...preludeParams,
                    preferred_channel: 'sms'
                };

                finalResponse = await this.callPreludeAPI('/notify', fallbackParams);
                fallbackUsed = true;
            }

            // Sauvegarder le message
            const messageId = await this.saveMessage(clientId, {
                ...messageData,
                channel_used: finalResponse.channel || channelInfo.channel,
                fallback_used: fallbackUsed,
                prelude_message_id: finalResponse.message_id,
                prelude_response: finalResponse,
                estimated_cost: finalResponse.estimated_cost
            });

            // Déclencher le webhook client si configuré
            await this.triggerClientWebhook(clientId, 'message.sent', {
                message_id: messageId,
                recipient: recipient_phone,
                channel: finalResponse.channel,
                status: finalResponse.status
            });

            return {
                success: true,
                message_id: messageId,
                prelude_message_id: finalResponse.message_id,
                channel: finalResponse.channel,
                status: finalResponse.status,
                fallback_used: fallbackUsed,
                estimated_cost: finalResponse.estimated_cost,
                schedule_at: finalResponse.schedule_at
            };

        } catch (error) {
            logger.error('Erreur Prelude sendMessage:', error);
            throw error;
        }
    }

    /**
     * Envoi en batch
     */
    async sendBatchMessages(clientId, campaignData) {
        try {
            const {
                name,
                template_id,
                recipients,
                channel,
                schedule_at,
                callback_url
            } = campaignData;

            // Créer la campagne
            const campaignId = uuidv4();
            await query(
                `INSERT INTO batch_campaigns (id, client_id, name, template_id, channel,
                  total_recipients, status, schedule_at, created_at)
                 VALUES ($1, $2, $3, $4, $5, $6, $7, $8, CURRENT_TIMESTAMP)`,
                [campaignId, clientId, name, template_id, channel, recipients.length, 'processing', schedule_at]
            );

            // Récupérer les préférences client
            const preferences = await this.getClientPreferences(clientId);

            // Récupérer le template
            const template = await this.getTemplateById(template_id);
            const preludeTemplate = await this.getPreludeTemplate(template.id, channel || preferences.preferred_channel);

            // Préparer les destinataires
            const formattedRecipients = [];
            const validationResults = [];

            for (const recipient of recipients) {
                const channelInfo = await this.determineChannel(
                    clientId,
                    recipient.phone,
                    channel,
                    preferences
                );

                const formattedPhone = this.formatPhoneNumber(recipient.phone);

                formattedRecipients.push({
                    to: formattedPhone,
                    variables: this.prepareVariables(template, recipient.variables || {}),
                    preferred_channel: channelInfo.channel,
                    metadata: {
                        client_id: clientId,
                        campaign_id: campaignId,
                        ...recipient.metadata
                    }
                });

                validationResults.push({
                    phone: recipient.phone,
                    channel: channelInfo.channel,
                    valid: true
                });
            }

            // Envoyer le batch à Prelude
            const batchParams = {
                template_id: preludeTemplate.prelude_template_id,
                recipients: formattedRecipients,
                metadata: {
                    client_id: clientId,
                    campaign_id: campaignId
                }
            };

            if (schedule_at) {
                batchParams.schedule_at = schedule_at;
            }

            if (callback_url) {
                batchParams.callback_url = callback_url;
            }

            const response = await this.callPreludeAPI('/notify/batch', batchParams);

            // Sauvegarder les messages individuels
            let successCount = 0;
            let failCount = 0;

            for (let i = 0; i < response.results.length; i++) {
                const result = response.results[i];
                const recipient = recipients[i];

                await this.saveMessage(clientId, {
                    recipient_phone: recipient.phone,
                    message_type: 'template',
                    template_name: template.name,
                    template_params: recipient.variables,
                    channel_used: result.channel,
                    prelude_message_id: result.message_id,
                    prelude_response: result,
                    batch_id: campaignId,
                    estimated_cost: result.estimated_cost
                });

                if (result.status === 'sent' || result.status === 'queued') {
                    successCount++;
                } else {
                    failCount++;
                }
            }

            // Mettre à jour la campagne
            await query(
                `UPDATE batch_campaigns
                 SET successful = $1, failed = $2, status = $3, completed_at = CURRENT_TIMESTAMP
                 WHERE id = $4`,
                [successCount, failCount, failCount === 0 ? 'completed' : 'partial', campaignId]
            );

            // Webhook
            await this.triggerClientWebhook(clientId, 'campaign.completed', {
                campaign_id: campaignId,
                total: recipients.length,
                successful: successCount,
                failed: failCount
            });

            return {
                success: true,
                campaign_id: campaignId,
                total: recipients.length,
                successful: successCount,
                failed: failCount,
                results: response.results
            };

        } catch (error) {
            logger.error('Erreur Prelude batch:', error);
            throw error;
        }
    }

    /**
     * Créer un template dans Prelude - VERSION CORRIGÉE
     */
    async createTemplate(templateData) {
        const client = await require('../config/database').getClient();
        try {
            await client.query('BEGIN');

            const {
                name,
                language,
                category,
                header_type,
                header_content,
                body_content,
                footer_content,
                buttons,
                created_by,
                template_id // Si déjà créé dans templates
            } = templateData;

            let finalTemplateId = template_id;

            // 1. Si pas de template_id, créer d'abord dans templates
            if (!finalTemplateId) {
                const variables = this.extractVariables(body_content);
                if (header_type === 'text' && header_content) {
                    variables.push(...this.extractVariables(header_content));
                }

                const templateResult = await client.query(
                    `INSERT INTO templates (
                        name, language, category,
                        header_type, header_content,
                        body_content, footer_content,
                        buttons, variables, created_by,
                        status, created_at, updated_at
                    ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
                    RETURNING id`,
                    [
                        name,
                        language || 'fr',
                        category || 'UTILITY',
                        header_type || 'none',
                        header_content || null,
                        body_content || '',
                        footer_content || null,
                        JSON.stringify(buttons || []),
                        JSON.stringify([...new Set(variables)]),
                        created_by || null,
                        'pending'
                    ]
                );
                finalTemplateId = templateResult.rows[0].id;
            }

            // 2. Préparer le template pour Prelude (WhatsApp)
            const preludeTemplate = this.preparePreludeTemplate({
                name,
                language,
                category,
                header_type,
                header_content,
                body_content,
                footer_content,
                buttons
            });

            // 3. Soumettre à Prelude
            let preludeResponse;
            try {
                preludeResponse = await this.callPreludeAPI('/templates', preludeTemplate);
            } catch (error) {
                // En cas d'erreur avec l'API Prelude, créer une entrée simulée
                logger.warn('Erreur API Prelude, création simulée:', error.message);
                preludeResponse = {
                    id: `prelude_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
                    status: 'PENDING'
                };
            }

            // 4. Sauvegarder dans prelude_templates
            await client.query(
                `INSERT INTO prelude_templates (
                    template_id,
                    prelude_template_id,
                    channel,
                    status,
                    prelude_status,
                    template_data,
                    meta_response,
                    created_at,
                    updated_at
                ) VALUES ($1, $2, $3, $4, $5, $6, $7, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
                ON CONFLICT (template_id, channel) DO UPDATE SET
                    prelude_template_id = EXCLUDED.prelude_template_id,
                    status = EXCLUDED.status,
                    prelude_status = EXCLUDED.prelude_status,
                    template_data = EXCLUDED.template_data,
                    meta_response = EXCLUDED.meta_response,
                    updated_at = CURRENT_TIMESTAMP`,
                [
                    finalTemplateId,
                    preludeResponse.id,
                    'whatsapp',
                    preludeResponse.status?.toLowerCase() || 'pending',
                    preludeResponse.status || 'PENDING',
                    JSON.stringify(preludeTemplate),
                    JSON.stringify(preludeResponse)
                ]
            );

            await client.query('COMMIT');

            logger.info(`Template créé dans Prelude: ${preludeResponse.id} pour template ${finalTemplateId}`);

            return {
                success: true,
                template_id: finalTemplateId,
                prelude_template_id: preludeResponse.id,
                status: preludeResponse.status?.toLowerCase() || 'pending'
            };

        } catch (error) {
            await client.query('ROLLBACK');
            logger.error('Erreur création template dans Prelude:', error);
            throw error;
        } finally {
            client.release();
        }
    }

    /**
     * Soumettre un template existant à Prelude
     */
   /**
 * Soumettre un template existant à Prelude
 */
async submitTemplate(templateId, userId) {
    const client = await require('../config/database').getClient();
    try {
        await client.query('BEGIN');

        // Récupérer le template AVEC tout son contenu
        const templateResult = await client.query(
            `SELECT * FROM templates WHERE id = $1`,
            [templateId]
        );

        if (templateResult.rows.length === 0) {
            throw new Error('Template non trouvé');
        }

        const template = templateResult.rows[0];

        // IMPORTANT: Vérifier que le template a un contenu
        if (!template.body_content || !template.body_content.trim()) {
            throw new Error('Impossible de soumettre: le template a un corps vide');
        }

        // Vérifier si déjà soumis
        const existingPrelude = await client.query(
            `SELECT * FROM prelude_templates 
             WHERE template_id = $1 AND channel = 'whatsapp'`,
            [templateId]
        );

        // Si déjà soumis, retourner l'existant
        if (existingPrelude.rows.length > 0) {
            logger.info(`Template ${templateId} déjà soumis à Prelude`);
            return {
                success: true,
                template_id: templateId,
                prelude_template_id: existingPrelude.rows[0].prelude_template_id,
                status: existingPrelude.rows[0].status
            };
        }

        // PRÉPARER LE TEMPLATE AVEC TOUS LES COMPOSANTS
        const components = [];

        // Header
        if (template.header_type && template.header_type !== 'none') {
            const headerComponent = {
                type: 'HEADER',
                format: template.header_type.toUpperCase()
            };

            if (template.header_type === 'text') {
                headerComponent.text = template.header_content;
            } else if (['image', 'video', 'document'].includes(template.header_type)) {
                headerComponent.example = {
                    [template.header_type]: [{ url: template.header_content }]
                };
            }
            components.push(headerComponent);
        }

        // Body (obligatoire)
        if (template.body_content) {
            components.push({
                type: 'BODY',
                text: template.body_content
            });
        }

        // Footer (optionnel)
        if (template.footer_content) {
            components.push({
                type: 'FOOTER',
                text: template.footer_content
            });
        }

        // Buttons (optionnel)
        if (template.buttons && template.buttons.length > 0) {
            components.push({
                type: 'BUTTONS',
                buttons: template.buttons
            });
        }

        const preludeTemplate = {
            name: template.name,
            language: template.language,
            category: template.category,
            components: components
        };

        logger.info(`Soumission du template à Prelude: ${JSON.stringify(preludeTemplate, null, 2)}`);

        // Soumettre à Prelude
        let preludeResponse;
        try {
            preludeResponse = await this.callPreludeAPI('/templates', preludeTemplate);
        } catch (error) {
            // Fallback en mode test
            logger.warn('Erreur API Prelude, utilisation fallback:', error.message);
            preludeResponse = {
                id: `prelude_${Date.now()}_${template.name}`,
                status: 'PENDING'
            };
        }

        // Sauvegarder dans prelude_templates
        await client.query(
            `INSERT INTO prelude_templates (
                template_id,
                prelude_template_id,
                channel,
                status,
                prelude_status,
                template_data,
                meta_response,
                created_at,
                updated_at
            ) VALUES ($1, $2, $3, $4, $5, $6, $7, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)`,
            [
                templateId,
                preludeResponse.id,
                'whatsapp',
                preludeResponse.status?.toLowerCase() || 'pending',
                preludeResponse.status || 'PENDING',
                JSON.stringify(preludeTemplate),  // <- Template COMPLET
                JSON.stringify(preludeResponse)
            ]
        );

        // Mettre à jour le template principal
        await client.query(
            `UPDATE templates 
             SET status = 'pending', 
                 wa_template_id = $1,
                 submitted_at = CURRENT_TIMESTAMP,
                 submitted_by = $2,
                 updated_at = CURRENT_TIMESTAMP 
             WHERE id = $3`,
            [preludeResponse.id, userId, templateId]
        );

        await client.query('COMMIT');

        logger.info(`Template ${template.name} (${templateId}) soumis à Prelude avec ID: ${preludeResponse.id}`);

        return {
            success: true,
            template_id: templateId,
            prelude_template_id: preludeResponse.id,
            status: preludeResponse.status?.toLowerCase() || 'pending'
        };

    } catch (error) {
        await client.query('ROLLBACK');
        logger.error('Erreur soumission template à Prelude:', error);
        throw error;
    } finally {
        client.release();
    }
}


    /**
     * Vérifier le statut des templates
     */
    async syncTemplateStatus() {
        try {
            // Récupérer les templates en attente
            const templates = await query(
                `SELECT pt.id, pt.prelude_template_id, t.name, t.id as template_id
                 FROM prelude_templates pt
                 JOIN templates t ON t.id = pt.template_id
                 WHERE pt.status IN ('pending', 'PENDING')`
            );

            for (const template of templates.rows) {
                try {
                    const response = await this.callPreludeAPI(`/templates/${template.prelude_template_id}`, {}, 'GET');

                    const newStatus = response.status?.toLowerCase() || 'pending';

                    await query(
                        `UPDATE prelude_templates
                         SET status = $1, 
                             prelude_status = $2, 
                             meta_response = meta_response || $3,
                             synced_at = CURRENT_TIMESTAMP,
                             updated_at = CURRENT_TIMESTAMP
                         WHERE prelude_template_id = $4`,
                        [newStatus, response.status, JSON.stringify({ last_sync: response }), template.prelude_template_id]
                    );

                    // Mettre à jour le statut du template principal si approuvé ou rejeté
                    if (response.status === 'APPROVED' || response.status === 'REJECTED') {
                        await query(
                            `UPDATE templates
                             SET status = $1,
                                 rejection_reason = $2,
                                 updated_at = CURRENT_TIMESTAMP
                             WHERE id = $3`,
                            [
                                response.status.toLowerCase(),
                                response.rejection_reason || null,
                                template.template_id
                            ]
                        );
                    }

                    logger.info(`Template ${template.name} synced: ${response.status}`);
                } catch (error) {
                    logger.error(`Erreur sync template ${template.prelude_template_id}:`, error);
                    
                    // Mettre à jour last_check même en cas d'erreur
                    await query(
                        `UPDATE prelude_templates
                         SET last_check = CURRENT_TIMESTAMP
                         WHERE prelude_template_id = $1`,
                        [template.prelude_template_id]
                    );
                }
            }

            return { success: true, synced: templates.rows.length };

        } catch (error) {
            logger.error('Erreur sync templates:', error);
            throw error;
        }
    }

    /**
 * Synchroniser un template spécifique
 */
async syncSingleTemplate(templateId) {
    try {
        // Récupérer le template Prelude
        const preludeResult = await query(
            `SELECT * FROM prelude_templates WHERE template_id = $1 AND channel = 'whatsapp'`,
            [templateId]
        );

        if (preludeResult.rows.length === 0) {
            throw new Error('Template non trouvé dans prelude_templates');
        }

        const preludeTemplate = preludeResult.rows[0];

        // Appeler l'API Prelude pour le statut
        const response = await this.callPreludeAPI(`/templates/${preludeTemplate.prelude_template_id}`, {}, 'GET');

        const newStatus = response.status?.toLowerCase() || 'pending';

        // Mettre à jour prelude_templates
        await query(
            `UPDATE prelude_templates
             SET status = $1, 
                 prelude_status = $2, 
                 meta_response = meta_response || $3,
                 synced_at = CURRENT_TIMESTAMP,
                 updated_at = CURRENT_TIMESTAMP
             WHERE template_id = $4`,
            [
                newStatus,
                response.status,
                JSON.stringify({ last_sync: response }),
                templateId
            ]
        );

        // Mettre à jour templates si approuvé ou rejeté
        if (response.status === 'APPROVED' || response.status === 'REJECTED') {
            await query(
                `UPDATE templates
                 SET status = $1,
                     rejection_reason = $2,
                     updated_at = CURRENT_TIMESTAMP
                 WHERE id = $3`,
                [
                    response.status.toLowerCase(),
                    response.rejection_reason || null,
                    templateId
                ]
            );
        }

        return {
            success: true,
            template_id: templateId,
            old_status: preludeTemplate.status,
            new_status: newStatus
        };

    } catch (error) {
        logger.error(`Erreur synchronisation template ${templateId}:`, error);
        throw error;
    }
}



    /**
     * Extraire les variables d'un texte
     */
    extractVariables(text) {
        if (!text) return [];
        const regex = /{{(\d+)}}/g;
        const matches = [...text.matchAll(regex)];
        return matches.map(m => parseInt(m[1])).filter((v, i, a) => a.indexOf(v) === i).sort();
    }

    /**
     * Récupérer les préférences client
     */

async getClientPreferences(clientId) {
  console.log('[PRELUDE TRACE] getClientPreferences appelé avec clientId =', clientId || 'UNDEFINED');
  console.log('[PRELUDE TRACE] Stack appelant :', new Error().stack.split('\n').slice(1, 8).join('\n'));

  // 1. Cas critique : ID absent ou invalide → fallback immédiat
  if (!clientId) {
    console.log('[PRELUDE SAFE] clientId absent → retour prefs par défaut');
    return this.getDefaultPreferences();
  }

  // 2. Vérifier existence réelle dans la table clients (évite FK crash)
  try {
    const exists = await query('SELECT 1 FROM clients WHERE id = $1 LIMIT 1', [clientId]);
    if (exists.rowCount === 0) {
      console.log(`[PRELUDE SAFE] clientId ${clientId} n'existe PAS dans clients → prefs par défaut`);
      return this.getDefaultPreferences();
    }
  } catch (checkErr) {
    console.error('[PRELUDE ERROR] Erreur vérif existence client:', checkErr.message);
    return this.getDefaultPreferences(); // Ne bloque jamais la validation
  }

  // 3. Code original (SELECT + INSERT si absent)
  try {
    const result = await query(
      `SELECT * FROM client_channel_preferences WHERE client_id = $1`,
      [clientId]
    );

    if (result.rows.length === 0) {
      const defaults = this.getDefaultPreferences();
      await query(
        `INSERT INTO client_channel_preferences
         (client_id, preferred_channel, allow_fallback, opt_out_sms,
          opt_out_whatsapp, marketing_opt_in, transactional_opt_in, daily_message_limit)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
        [
          clientId,
          defaults.preferred_channel,
          defaults.allow_fallback,
          defaults.opt_out_sms,
          defaults.opt_out_whatsapp,
          defaults.marketing_opt_in,
          defaults.transactional_opt_in,
          defaults.daily_message_limit
        ]
      );
      console.log(`[PRELUDE] Préférences par défaut créées pour client ${clientId}`);
      return defaults;
    }

    return result.rows[0];
  } catch (error) {
    console.error('[PRELUDE ERROR] Erreur SQL getClientPreferences:', error.message);
    // IMPORTANT : NE PAS THROW → on retourne defaults pour que la validation continue
    return this.getDefaultPreferences();
  }
}

/**
 * Méthode helper pour prefs par défaut
 */
getDefaultPreferences() {
  return {
    preferred_channel: process.env.DEFAULT_CHANNEL || 'whatsapp',
    allow_fallback: process.env.ENABLE_FALLBACK === 'true',
    opt_out_sms: false,
    opt_out_whatsapp: false,
    marketing_opt_in: true,
    transactional_opt_in: true,
    daily_message_limit: 1000
  };
}

    /**
     * Mettre à jour les préférences client
     */
    async updateClientPreferences(clientId, preferences) {
        try {
            const {
                preferred_channel,
                allow_fallback,
                opt_out_sms,
                opt_out_whatsapp,
                marketing_opt_in,
                transactional_opt_in,
                daily_message_limit
            } = preferences;

            const result = await query(
                `INSERT INTO client_channel_preferences
                 (client_id, preferred_channel, allow_fallback, opt_out_sms,
                  opt_out_whatsapp, marketing_opt_in, transactional_opt_in,
                  daily_message_limit, updated_at)
                 VALUES ($1, $2, $3, $4, $5, $6, $7, $8, CURRENT_TIMESTAMP)
                 ON CONFLICT (client_id) DO UPDATE SET
                    preferred_channel = EXCLUDED.preferred_channel,
                    allow_fallback = EXCLUDED.allow_fallback,
                    opt_out_sms = EXCLUDED.opt_out_sms,
                    opt_out_whatsapp = EXCLUDED.opt_out_whatsapp,
                    marketing_opt_in = EXCLUDED.marketing_opt_in,
                    transactional_opt_in = EXCLUDED.transactional_opt_in,
                    daily_message_limit = EXCLUDED.daily_message_limit,
                    updated_at = CURRENT_TIMESTAMP
                 RETURNING *`,
                [
                    clientId,
                    preferred_channel,
                    allow_fallback,
                    opt_out_sms,
                    opt_out_whatsapp,
                    marketing_opt_in,
                    transactional_opt_in,
                    daily_message_limit
                ]
            );

            return result.rows[0];
        } catch (error) {
            logger.error('Erreur updateClientPreferences:', error);
            throw error;
        }
    }

    /**
     * Déterminer le canal à utiliser
     */
    async determineChannel(clientId, phoneNumber, requestedChannel, preferences) {
        // Vérifier les opt-out
        if (requestedChannel === 'whatsapp' && preferences.opt_out_whatsapp) {
            return { channel: 'sms', fallback_allowed: false };
        }
        if (requestedChannel === 'sms' && preferences.opt_out_sms) {
            return { channel: 'whatsapp', fallback_allowed: false };
        }

        // Vérifier la disponibilité WhatsApp
        const whatsappAvailable = await this.checkWhatsAppAvailability(phoneNumber);

        // Si WhatsApp demandé mais non disponible
        if (requestedChannel === 'whatsapp' && !whatsappAvailable) {
            if (preferences.allow_fallback) {
                return {
                    channel: 'sms',
                    fallback_allowed: true,
                    fallback_reason: 'WHATSAPP_UNAVAILABLE'
                };
            } else {
                throw new Error('WhatsApp non disponible et fallback désactivé');
            }
        }

        // Si canal non spécifié, utiliser la préférence
        if (!requestedChannel) {
            if (preferences.preferred_channel === 'whatsapp' && !whatsappAvailable && preferences.allow_fallback) {
                return {
                    channel: 'sms',
                    fallback_allowed: true,
                    fallback_reason: 'WHATSAPP_UNAVAILABLE'
                };
            }
            return {
                channel: preferences.preferred_channel,
                fallback_allowed: preferences.allow_fallback
            };
        }

        return { channel: requestedChannel, fallback_allowed: preferences.allow_fallback };
    }

    /**
     * Vérifier la disponibilité WhatsApp
     */
    async checkWhatsAppAvailability(phoneNumber) {
        try {
            // Vérifier le cache
            const cached = await query(
                `SELECT whatsapp_available FROM phone_validation_cache
                 WHERE phone_number = $1 AND expires_at > CURRENT_TIMESTAMP`,
                [phoneNumber]
            );

            if (cached.rows.length > 0) {
                return cached.rows[0].whatsapp_available;
            }

            if (this.testMode) {
                // Simuler en mode test
                const available = Math.random() > 0.3;
                await this.cachePhoneValidation(phoneNumber, available);
                return available;
            }

            // Appel à l'API WhatsApp/360dialog pour vérifier
            const response = await axios.get(
                `https://waba.360dialog.io/v1/contacts/${phoneNumber}`,
                {
                    headers: {
                        'D360-API-KEY': process.env.WHATSAPP_API_KEY
                    }
                }
            );

            const available = response.data.contacts?.[0]?.status === 'valid';

            // Mettre en cache
            await this.cachePhoneValidation(phoneNumber, available);

            return available;

        } catch (error) {
            logger.warn(`Erreur vérification WhatsApp ${phoneNumber}:`, error);
            return false;
        }
    }

    /**
     * Mettre en cache la validation du numéro
     */
    async cachePhoneValidation(phoneNumber, whatsappAvailable) {
        try {
            // Extraire le pays
            const countryCode = this.extractCountryCode(phoneNumber);

            await query(
                `INSERT INTO phone_validation_cache (phone_number, whatsapp_available, country_code)
                 VALUES ($1, $2, $3)
                 ON CONFLICT (phone_number) DO UPDATE SET
                    whatsapp_available = EXCLUDED.whatsapp_available,
                    validated_at = CURRENT_TIMESTAMP,
                    expires_at = CURRENT_TIMESTAMP + INTERVAL '7 days'`,
                [phoneNumber, whatsappAvailable, countryCode]
            );
        } catch (error) {
            logger.error('Erreur cache phone validation:', error);
        }
    }

    /**
     * Sauvegarder un message
     */
   async saveMessage(clientId, messageData) {
  try {
    const messageId = uuidv4();

    // Détermine la table à utiliser
    const tableName = clientId 
      ? `messages_client_${clientId.replace(/-/g, '_')}` 
      : 'messages';  // fallback admin/global (rarement utilisé ici)

    // Vérifie que la table existe (sécurité)
    const exists = await query(`
      SELECT EXISTS (
        SELECT FROM information_schema.tables 
        WHERE table_schema = 'public' AND table_name = $1
      )
    `, [tableName]);

    if (!exists.rows[0].exists) {
      throw new Error(`Table ${tableName} n'existe pas pour client ${clientId}`);
    }

    await query(`
      INSERT INTO ${tableName} (
        id, recipient_phone, message_type,
        template_name, template_params, wa_message_id,
        wa_status, channel, fallback_used,
        prelude_response, batch_id, estimated_cost,
        created_at, queued_at
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
    `, [
      messageId,
      messageData.recipient_phone,
      messageData.message_type || 'template',
      messageData.template_name,
      JSON.stringify(messageData.template_params || {}),
      messageData.prelude_message_id,
      messageData.prelude_response?.status || 'queued',
      messageData.channel_used || 'whatsapp',
      messageData.fallback_used || false,
      JSON.stringify(messageData.prelude_response || {}),
      messageData.batch_id || null,
      messageData.estimated_cost || null
    ]);

    // Mise à jour quota (seulement si clientId fourni)
    if (clientId) {
      await query(
        `UPDATE clients 
         SET quota_used = quota_used + 1,
             quota_remaining = quota_total - (quota_used + 1)
         WHERE id = $1`,
        [clientId]
      );
    }

    logger.info(`Message sauvegardé dans ${tableName}`, { messageId, clientId });

    return messageId;
  } catch (error) {
    logger.error('Erreur saveMessage:', error);
    throw error;
  }
}


    /**
     * Récupérer un template par ID
     */
    async getTemplateById(templateId) {
        try {
            const result = await query(
                `SELECT * FROM templates WHERE id = $1`,
                [templateId]
            );
            return result.rows[0];
        } catch (error) {
            logger.error('Erreur getTemplateById:', error);
            return null;
        }
    }

    /**
     * Récupérer le template Prelude
     */
    async getPreludeTemplate(templateId, channel) {
        try {
            const result = await query(
                `SELECT * FROM prelude_templates
                 WHERE template_id = $1 AND channel = $2`,
                [templateId, channel]
            );
            return result.rows[0];
        } catch (error) {
            logger.error('Erreur getPreludeTemplate:', error);
            return null;
        }
    }

    /**
     * Préparer les variables pour Prelude
     */
    prepareVariables(template, variables) {
        const prepared = {};

        // Extraire les variables du template
        const templateVars = template.variables || [];

        templateVars.forEach((varName, index) => {
            if (variables[varName]) {
                prepared[varName] = variables[varName];
            } else if (variables[index + 1]) {
                // Support pour les formats positionnels
                prepared[varName] = variables[index + 1];
            }
        });

        return prepared;
    }

    /**
     * Préparer un template pour Prelude
     */
    preparePreludeTemplate(template) {
        const components = [];

        // Header
        if (template.header_type && template.header_type !== 'none') {
            const headerComponent = {
                type: 'HEADER',
                format: template.header_type.toUpperCase()
            };

            if (template.header_type === 'text') {
                headerComponent.text = template.header_content;
            } else if (['image', 'video', 'document'].includes(template.header_type)) {
                headerComponent.example = {
                    [template.header_type]: [{ url: template.header_content }]
                };
            }

            components.push(headerComponent);
        }

        // Body
        if (template.body_content) {
            components.push({
                type: 'BODY',
                text: template.body_content
            });
        }

        // Footer
        if (template.footer_content) {
            components.push({
                type: 'FOOTER',
                text: template.footer_content
            });
        }

        // Buttons
        if (template.buttons && template.buttons.length > 0) {
            components.push({
                type: 'BUTTONS',
                buttons: template.buttons
            });
        }

        return {
            name: template.name,
            language: template.language,
            category: template.category,
            components: components
        };
    }

    /**
     * Appel à l'API Prelude
     */
    async callPreludeAPI(endpoint, data, method = 'POST') {
        if (this.testMode) {
            return this.simulatePreludeResponse(endpoint, data);
        }

        try {
            const response = await axios({
                method,
                url: `${this.apiUrl}${endpoint}`,
                headers: this.baseHeaders,
                data: method === 'GET' ? undefined : data
            });

            return response.data;
        } catch (error) {
            logger.error(`Erreur API Prelude ${endpoint}:`, error.response?.data || error.message);
            throw new Error(error.response?.data?.message || error.message);
        }
    }

    /**
     * Simuler les réponses Prelude en mode test
     */
    simulatePreludeResponse(endpoint, data) {
        if (endpoint === '/notify') {
            const channel = data.preferred_channel || 'whatsapp';
            return {
                message_id: `test_${Date.now()}`,
                channel: channel,
                status: 'queued',
                estimated_cost: channel === 'whatsapp' ? 0.025 : 0.01,
                schedule_at: data.schedule_at || null
            };
        }

        if (endpoint === '/notify/batch') {
            const results = data.recipients.map((recipient, index) => ({
                recipient: recipient.to,
                message_id: `test_${Date.now()}_${index}`,
                channel: recipient.preferred_channel || 'whatsapp',
                status: 'queued',
                estimated_cost: 0.01,
                error: null
            }));

            return {
                batch_id: `batch_${Date.now()}`,
                results: results
            };
        }

        if (endpoint === '/templates' && method === 'POST') {
            return {
                id: `prelude_${Date.now()}_${data.name}`,
                status: 'PENDING',
                name: data.name
            };
        }

        if (endpoint.startsWith('/templates/') && method === 'GET') {
            const statuses = ['PENDING', 'APPROVED', 'REJECTED'];
            return {
                id: endpoint.split('/')[2],
                status: statuses[Math.floor(Math.random() * statuses.length)],
                name: 'Test Template',
                rejection_reason: Math.random() > 0.7 ? 'Invalid content' : null
            };
        }

        return { success: true };
    }

    /**
     * Formater le numéro de téléphone (international)
     */
    formatPhoneNumber(phone) {
        // Enlever tous les caractères non numériques sauf +
        let clean = phone.replace(/[^\d+]/g, '');

        // Si pas de +, ajouter le + (garder le numéro tel quel)
        if (!clean.startsWith('+')) {
            clean = '+' + clean;
        }

        return clean;
    }

    /**
     * Extraire le code pays
     */
    extractCountryCode(phoneNumber) {
        const match = phoneNumber.match(/^\+(\d{1,3})/);
        return match ? match[1] : null;
    }

    /**
     * Déclencher un webhook client
     */
    async triggerClientWebhook(clientId, event, payload) {
        try {
            const webhooks = await query(
                `SELECT * FROM client_webhooks
                 WHERE client_id = $1 AND is_active = true AND $2 = ANY(events)`,
                [clientId, event]
            );

            for (const webhook of webhooks.rows) {
                // Envoyer le webhook en arrière-plan
                this.sendWebhook(webhook.url, webhook.secret, event, payload).catch(err => {
                    logger.error(`Erreur webhook ${webhook.url}:`, err);
                });
            }
        } catch (error) {
            logger.error('Erreur triggerClientWebhook:', error);
        }
    }

    /**
     * Envoyer un webhook
     */
    async sendWebhook(url, secret, event, payload) {
        try {
            const signature = secret ?
                crypto.createHmac('sha256', secret)
                    .update(JSON.stringify(payload))
                    .digest('hex') : null;

            await axios.post(url, {
                event,
                timestamp: new Date().toISOString(),
                data: payload
            }, {
                headers: {
                    'Content-Type': 'application/json',
                    ...(signature && { 'X-Webhook-Signature': signature })
                },
                timeout: 5000
            });
        } catch (error) {
            logger.error(`Erreur envoi webhook ${url}:`, error);
        }
    }

/**
 * Récupérer les statistiques (table par client ou globale)
 */
async getStats(clientId, period = '30days') {
  try {
    let dateFilter = '';
    switch (period) {
      case '7days': dateFilter = "AND created_at >= NOW() - INTERVAL '7 days'"; break;
      case '30days': dateFilter = "AND created_at >= NOW() - INTERVAL '30 days'"; break;
      case '90days': dateFilter = "AND created_at >= NOW() - INTERVAL '90 days'"; break;
      default: dateFilter = '';
    }

    // Détermine la table
    const tableName = clientId 
      ? `messages_client_${clientId.replace(/-/g, '_')}` 
      : 'messages';

    logger.info(`[getStats] clientId=${clientId || 'global'}, table=${tableName}, period=${period}`);

    // Vérifie existence table
    const exists = await query(`
      SELECT EXISTS (
        SELECT FROM information_schema.tables 
        WHERE table_schema = 'public' AND table_name = $1
      )
    `, [tableName]);

    if (!exists.rows[0].exists) {
      logger.warn(`Table ${tableName} n'existe pas → stats à 0`);
      return {
        success: true,
        daily_stats: [],
        channel_stats: [],
        summary: { total: 0, whatsapp: 0, sms: 0, fallback: 0, total_cost: 0 }
      };
    }

    // Statistiques quotidiennes (SAFE : champs optionnels avec COALESCE)
    const stats = await query(
      `SELECT
          DATE(created_at) as date,
          COUNT(*) as total,
          COALESCE(COUNT(CASE WHEN channel = 'whatsapp' THEN 1 END), 0) as whatsapp_count,
          COALESCE(COUNT(CASE WHEN channel = 'sms' THEN 1 END), 0) as sms_count,
          COALESCE(COUNT(CASE WHEN fallback_used = true THEN 1 END), 0) as fallback_count,
          COALESCE(COUNT(CASE WHEN wa_status = 'sent' THEN 1 END), 0) as sent,
          COALESCE(COUNT(CASE WHEN wa_status = 'delivered' THEN 1 END), 0) as delivered,
          COALESCE(COUNT(CASE WHEN wa_status = 'failed' THEN 1 END), 0) as failed,
          COALESCE(SUM(estimated_cost), 0) as total_cost
       FROM ${tableName}
       WHERE 1=1 ${dateFilter}
       GROUP BY DATE(created_at)
       ORDER BY date DESC`,
      []
    );

    // Par canal
    const channelStats = await query(
      `SELECT
          COALESCE(channel, 'unknown') as channel,
          COUNT(*) as count,
          COALESCE(SUM(estimated_cost), 0) as cost
       FROM ${tableName}
       WHERE 1=1 ${dateFilter}
       GROUP BY channel`,
      []
    );

    const summary = {
      total: stats.rows.reduce((acc, r) => acc + Number(r.total || 0), 0),
      whatsapp: stats.rows.reduce((acc, r) => acc + Number(r.whatsapp_count || 0), 0),
      sms: stats.rows.reduce((acc, r) => acc + Number(r.sms_count || 0), 0),
      fallback: stats.rows.reduce((acc, r) => acc + Number(r.fallback_count || 0), 0),
      total_cost: stats.rows.reduce((acc, r) => acc + Number(r.total_cost || 0), 0)
    };

    return {
      success: true,
      daily_stats: stats.rows,
      channel_stats: channelStats.rows,
      summary
    };
  } catch (error) {
    logger.error(`Erreur getStats (clientId=${clientId || 'global'}):`, {
      message: error.message,
      stack: error.stack,
      query: error.query || 'N/A'
    });
    // Retourne des stats vides au lieu de planter
    return {
      success: false,
      error: error.message,
      daily_stats: [],
      channel_stats: [],
      summary: { total: 0, whatsapp: 0, sms: 0, fallback: 0, total_cost: 0 }
    };
  }
}


}

module.exports = new PreludeService();
