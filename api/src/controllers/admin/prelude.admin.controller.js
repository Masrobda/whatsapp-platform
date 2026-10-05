// src/controllers/admin/prelude.admin.controller.js
const preludeService = require('../../services/prelude.service');
const { query } = require('../../config/database');
const logger = require('../../utils/logger');

/**
 * Dashboard admin - Vue d'ensemble
 */
async function getDashboardStats(request, reply) {
    try {
        // Statistiques globales
        const globalStats = await query(`
            SELECT 
                COUNT(DISTINCT client_id) as active_clients,
                COUNT(*) as total_messages,
                COUNT(CASE WHEN channel = 'whatsapp' THEN 1 END) as whatsapp_messages,
                COUNT(CASE WHEN channel = 'sms' THEN 1 END) as sms_messages,
                COUNT(CASE WHEN fallback_used = true THEN 1 END) as fallback_count,
                SUM(estimated_cost) as total_cost,
                COUNT(CASE WHEN created_at >= NOW() - INTERVAL '24 hours' THEN 1 END) as last_24h
            FROM messages
            WHERE created_at >= NOW() - INTERVAL '30 days'
        `);

        // Templates en attente
        const pendingTemplates = await query(`
            SELECT t.*, c.company_name as client_name
            FROM templates t
            LEFT JOIN clients c ON c.id = t.created_by
            WHERE t.status = 'pending'
            ORDER BY t.created_at DESC
            LIMIT 10
        `);

        // Dernières campagnes
        const recentCampaigns = await query(`
            SELECT bc.*, c.company_name as client_name, t.name as template_name
            FROM batch_campaigns bc
            JOIN clients c ON c.id = bc.client_id
            LEFT JOIN templates t ON t.id = bc.template_id
            ORDER BY bc.created_at DESC
            LIMIT 10
        `);

        // Préférences clients
        const channelPrefs = await query(`
            SELECT 
                preferred_channel,
                COUNT(*) as count
            FROM client_channel_preferences
            GROUP BY preferred_channel
        `);

        return reply.send({
            success: true,
            data: {
                overview: globalStats.rows[0] || {},
                pending_templates: pendingTemplates.rows,
                recent_campaigns: recentCampaigns.rows,
                channel_preferences: channelPrefs.rows,
                timestamp: new Date().toISOString()
            }
        });

    } catch (error) {
        logger.error('Erreur dashboard stats:', error);
        return reply.code(500).send({
            success: false,
            message: error.message
        });
    }
}

/**
 * Liste tous les clients avec leurs préférences
 */
async function getClientsWithPreferences(request, reply) {
    try {
        const { page = 1, limit = 20, search } = request.query;
        const offset = (page - 1) * limit;

        let whereClause = '';
        const params = [];
        
        if (search) {
            whereClause = 'WHERE c.company_name ILIKE $1 OR c.email ILIKE $1';
            params.push(`%${search}%`);
        }

        const clients = await query(`
            SELECT 
                c.id, c.company_name, c.email, c.quota_total, c.quota_used,
                c.quota_remaining, c.is_active, c.created_at,
                cp.preferred_channel, cp.allow_fallback, 
                cp.opt_out_sms, cp.opt_out_whatsapp,
                cp.marketing_opt_in, cp.transactional_opt_in,
                cp.daily_message_limit,
                (
                    SELECT COUNT(*) FROM messages m 
                    WHERE m.client_id = c.id 
                    AND m.created_at >= NOW() - INTERVAL '30 days'
                ) as messages_30d
            FROM clients c
            LEFT JOIN client_channel_preferences cp ON cp.client_id = c.id
            ${whereClause}
            ORDER BY c.created_at DESC
            LIMIT $${params.length + 1} OFFSET $${params.length + 2}
        `, [...params, limit, offset]);

        const total = await query(
            `SELECT COUNT(*) FROM clients ${whereClause}`,
            params
        );

        return reply.send({
            success: true,
            data: clients.rows,
            pagination: {
                page: parseInt(page),
                limit: parseInt(limit),
                total: parseInt(total.rows[0].count),
                pages: Math.ceil(total.rows[0].count / limit)
            }
        });

    } catch (error) {
        logger.error('Erreur getClientsWithPreferences:', error);
        return reply.code(500).send({
            success: false,
            message: error.message
        });
    }
}

/**
 * Configuration globale des canaux
 */
async function updateGlobalChannelConfig(request, reply) {
    try {
        const {
            default_channel,
            enable_fallback,
            marketing_hours_start,
            marketing_hours_end,
            max_batch_size,
            webhook_retry_count
        } = request.body;

        // Sauvegarder dans une table de configuration
        await query(`
            INSERT INTO system_config (key, value, updated_at)
            VALUES ($1, $2, CURRENT_TIMESTAMP)
            ON CONFLICT (key) DO UPDATE SET
                value = EXCLUDED.value,
                updated_at = CURRENT_TIMESTAMP
        `, ['default_channel', default_channel]);

        // Mettre à jour les variables d'env ou la config

        return reply.send({
            success: true,
            message: 'Configuration mise à jour'
        });

    } catch (error) {
        logger.error('Erreur updateGlobalChannelConfig:', error);
        return reply.code(500).send({
            success: false,
            message: error.message
        });
    }
}

/**
 * Monitoring des files d'attente
 */
async function getQueueMonitoring(request, reply) {
    try {
        const queues = await query(`
            SELECT 
                channel,
                COUNT(*) as waiting,
                COUNT(CASE WHEN queued_at > NOW() - INTERVAL '5 minutes' THEN 1 END) as active,
                COUNT(CASE WHEN wa_status = 'failed' THEN 1 END) as failed,
                AVG(EXTRACT(EPOCH FROM (sent_at - queued_at))) as avg_processing_time
            FROM messages
            WHERE created_at > NOW() - INTERVAL '24 hours'
            GROUP BY channel
        `);

        return reply.send({
            success: true,
            data: queues.rows
        });

    } catch (error) {
        logger.error('Erreur getQueueMonitoring:', error);
        return reply.code(500).send({
            success: false,
            message: error.message
        });
    }
}

/**
 * Logs d'envoi détaillés
 */
async function getMessageLogs(request, reply) {
    try {
        const {
            page = 1,
            limit = 50,
            client_id,
            channel,
            status,
            start_date,
            end_date
        } = request.query;

        const offset = (page - 1) * limit;
        const params = [];
        let whereConditions = [];
        let paramIndex = 1;

        if (client_id) {
            whereConditions.push(`client_id = $${paramIndex++}`);
            params.push(client_id);
        }

        if (channel) {
            whereConditions.push(`channel = $${paramIndex++}`);
            params.push(channel);
        }

        if (status) {
            whereConditions.push(`wa_status = $${paramIndex++}`);
            params.push(status);
        }

        if (start_date) {
            whereConditions.push(`created_at >= $${paramIndex++}`);
            params.push(start_date);
        }

        if (end_date) {
            whereConditions.push(`created_at <= $${paramIndex++}`);
            params.push(end_date);
        }

        const whereClause = whereConditions.length > 0 
            ? 'WHERE ' + whereConditions.join(' AND ')
            : '';

        const logs = await query(`
            SELECT 
                m.id, m.client_id, c.company_name, m.recipient_phone,
                m.channel, m.fallback_used, m.wa_status as status,
                m.estimated_cost, m.created_at, m.sent_at, m.delivered_at,
                m.prelude_response->>'error' as error_message
            FROM messages m
            JOIN clients c ON c.id = m.client_id
            ${whereClause}
            ORDER BY m.created_at DESC
            LIMIT $${paramIndex} OFFSET $${paramIndex + 1}
        `, [...params, limit, offset]);

        const total = await query(
            `SELECT COUNT(*) FROM messages m ${whereClause}`,
            params
        );

        return reply.send({
            success: true,
            data: logs.rows,
            pagination: {
                page: parseInt(page),
                limit: parseInt(limit),
                total: parseInt(total.rows[0].count),
                pages: Math.ceil(total.rows[0].count / limit)
            }
        });

    } catch (error) {
        logger.error('Erreur getMessageLogs:', error);
        return reply.code(500).send({
            success: false,
            message: error.message
        });
    }
}

/**
 * Forcer la synchronisation des templates
 */
async function syncTemplates(request, reply) {
    try {
        const result = await preludeService.syncTemplateStatus();
        
        return reply.send({
            success: true,
            message: 'Synchronisation lancée',
            data: result
        });

    } catch (error) {
        logger.error('Erreur syncTemplates:', error);
        return reply.code(500).send({
            success: false,
            message: error.message
        });
    }
}

/**
 * Créer un template par défaut
 */
    async function createDefaultTemplate(request, reply) {
    try {
        const {
            name,
            type, // 'text', 'media', 'interactive'
        } = request.body;

        let templateData;

        if (type === 'text') {
            templateData = {
                name: `default_${name}_${Date.now()}`,
                language: 'fr',
                category: 'UTILITY',
                header_type: 'none',
                body_content: '{{1}}',
                footer_content: '',
                buttons: [],
                created_by: request.user.id
            };
        } else if (type === 'media') {
            templateData = {
                name: `default_media_${Date.now()}`,
                language: 'fr',
                category: 'MARKETING',
                header_type: 'image',
                header_content: '{{media_url}}',
                body_content: '{{caption}}',
                footer_content: '',
                buttons: [],
                created_by: request.user.id
            };
        } else {
            return reply.code(400).send({
                success: false,
                message: 'Type de template non supporté'
            });
        }

        const template = await preludeService.createTemplate(templateData);

        return reply.send({
            success: true,
            message: 'Template par défaut créé',
            data: template
        });

    } catch (error) {
        logger.error('Erreur createDefaultTemplate:', error);
        return reply.code(500).send({
            success: false,
            message: error.message
        });
    }
}

module.exports = {
    getDashboardStats,
    getClientsWithPreferences,
    updateGlobalChannelConfig,
    getQueueMonitoring,
    getMessageLogs,
    syncTemplates,
    createDefaultTemplate
};
