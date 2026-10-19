const { query } = require('../config/database');
const queueService = require('../services/queue.service');
const logger = require('../utils/logger');

/**
 * GET /api/v1/stats/overview?period=7d
 * Statistiques globales temps réel, filtrées par période
 * OPTIMISÉ avec client_stats_daily
 */
async function getOverviewStats(req, reply) {
  try {
    const clientId = req.user?.role === 'admin' ? null : req.user?.id;
    const { period = '7d' } = req.query;

    // Définir l'intervalle selon la période demandée
    let intervalDays = 7;
    let interval = '7 days';
    switch (period) {
      case '1h': interval = '1 hour'; intervalDays = 0; break;
      case '24h': interval = '24 hours'; intervalDays = 1; break;
      case '7d': interval = '7 days'; intervalDays = 7; break;
      case '30d': interval = '30 days'; intervalDays = 30; break;
      case '90d': interval = '90 days'; intervalDays = 90; break;
      default: interval = '7 days'; intervalDays = 7;
    }

    logger.info(`[STATS] Chargement overview pour période: ${period} (${interval})`);

    let statsResult;
    
    // 🔥 Pour les périodes > 1 jour, utiliser la table agrégée (ULTRA RAPIDE)
    if (intervalDays >= 1 && clientId) {
      statsResult = await query(`
        SELECT 
          COALESCE(SUM(messages_queued), 0) as total_messages,
          COALESCE(SUM(messages_sent), 0) as sent,
          COALESCE(SUM(messages_delivered), 0) as delivered,
          COALESCE(SUM(messages_read), 0) as read,
          COALESCE(SUM(messages_failed), 0) as failed,
          COALESCE(SUM(messages_queued), 0) as queued
        FROM client_stats_daily
        WHERE client_id = $1
          AND stat_date >= CURRENT_DATE - ($2 || ' days')::INTERVAL
      `, [clientId, intervalDays]);
    } 
    // Pour les périodes courtes ou admin, utiliser la table messages
    else {
      statsResult = await query(`
        SELECT
          COUNT(*) as total_messages,
          COUNT(CASE WHEN wa_status = 'sent' THEN 1 END) as sent,
          COUNT(CASE WHEN wa_status = 'delivered' THEN 1 END) as delivered,
          COUNT(CASE WHEN wa_status = 'read' THEN 1 END) as read,
          COUNT(CASE WHEN wa_status = 'failed' THEN 1 END) as failed,
          COUNT(CASE WHEN wa_status = 'queued' THEN 1 END) as queued
        FROM messages
        WHERE created_at >= NOW() - INTERVAL '${interval}'
        ${clientId ? 'AND client_id = $1' : ''}
      `, clientId ? [clientId] : []);
    }

    // 2. Stats files d'attente depuis Redis
    const queueStats = await queueService.getAllStats();

    // 3. Top clients (admin seulement) – utiliser client_stats_daily
    let topClients = [];
    if (req.user?.role === 'admin') {
      topClients = await query(`
        SELECT
          c.id as client_id,
          c.company_name as client_name,
          COALESCE(SUM(csd.messages_sent), 0) as total_messages,
          ROUND(
            (COALESCE(SUM(csd.messages_delivered), 0) * 100.0 /
            NULLIF(COALESCE(SUM(csd.messages_sent), 0), 0)
          ), 1) as success_rate
        FROM clients c
        LEFT JOIN client_stats_daily csd ON c.id = csd.client_id
          AND csd.stat_date >= CURRENT_DATE - ($1 || ' days')::INTERVAL
        GROUP BY c.id, c.company_name
        ORDER BY total_messages DESC
        LIMIT 5
      `, [intervalDays]);
      topClients = topClients.rows;
    }

    // 4. Stats quotidiennes - PRIORITÉ client_stats_daily
    let dailyStats;
    if (clientId) {
      dailyStats = await query(`
        SELECT
          stat_date as date,
          messages_sent as sent,
          messages_delivered as delivered,
          messages_read as read,
          messages_failed as failed,
          messages_queued as queued,
          (messages_sent + messages_failed) as total
        FROM client_stats_daily
        WHERE client_id = $1
          AND stat_date >= CURRENT_DATE - ($2 || ' days')::INTERVAL
        ORDER BY stat_date DESC
      `, [clientId, intervalDays]);
    } else {
      // Pour admin, fallback sur messages
      dailyStats = await query(`
        SELECT
          DATE(created_at) as date,
          COUNT(*) as total,
          COUNT(CASE WHEN wa_status = 'delivered' THEN 1 END) as delivered,
          COUNT(CASE WHEN wa_status = 'failed' THEN 1 END) as failed,
          COUNT(CASE WHEN wa_status = 'read' THEN 1 END) as read,
          COUNT(CASE WHEN wa_status = 'sent' THEN 1 END) as sent
        FROM messages
        WHERE created_at >= NOW() - INTERVAL '${interval}'
        ${clientId ? 'AND client_id = $1' : ''}
        GROUP BY DATE(created_at)
        ORDER BY date DESC
      `, clientId ? [clientId] : []);
    }

    // 5. Stats horaires - pour l'admin ou périodes courtes uniquement
    let hourlyStats = [];
    if (!clientId || intervalDays <= 1) {
      hourlyStats = await query(`
        SELECT
          EXTRACT(HOUR FROM created_at) as hour,
          COUNT(*) as count,
          COUNT(CASE WHEN wa_status = 'delivered' THEN 1 END) as delivered,
          COUNT(CASE WHEN wa_status = 'failed' THEN 1 END) as failed
        FROM messages
        WHERE created_at >= NOW() - INTERVAL '${interval}'
        ${clientId ? 'AND client_id = $1' : ''}
        GROUP BY EXTRACT(HOUR FROM created_at)
        ORDER BY hour ASC
      `, clientId ? [clientId] : []);
    }

    // 6. Métriques de performance - depuis client_stats_daily
    let performance;
    if (clientId && intervalDays >= 1) {
      const perfResult = await query(`
        SELECT
          COALESCE(SUM(messages_sent), 0) as total_sent,
          COALESCE(SUM(messages_delivered), 0) as total_delivered,
          COALESCE(SUM(messages_read), 0) as total_read,
          COALESCE(SUM(messages_failed), 0) as total_failed
        FROM client_stats_daily
        WHERE client_id = $1
          AND stat_date >= CURRENT_DATE - ($2 || ' days')::INTERVAL
      `, [clientId, intervalDays]);
      
      const total = perfResult.rows[0];
      performance = {
        avg_queue_time: 0, // À calculer depuis une autre table si besoin
        avg_processing_time: 0,
        peak_hour: '14:00',
        success_rate: total.total_sent > 0
          ? Math.round((total.total_delivered / total.total_sent) * 100)
          : 0,
        read_rate: total.total_delivered > 0
          ? Math.round((total.total_read / total.total_delivered) * 100)
          : 0
      };
    } else {
      const performanceMetrics = await query(`
        SELECT
          AVG(EXTRACT(EPOCH FROM (sent_at - queued_at)) * 1000) as avg_queue_time,
          AVG(EXTRACT(EPOCH FROM (delivered_at - sent_at)) * 1000) as avg_processing_time,
          MODE() WITHIN GROUP (ORDER BY EXTRACT(HOUR FROM created_at)) as peak_hour
        FROM messages
        WHERE sent_at IS NOT NULL
          AND queued_at IS NOT NULL
          AND created_at >= NOW() - INTERVAL '${interval}'
          ${clientId ? 'AND client_id = $1' : ''}
      `, clientId ? [clientId] : []);
      
      const m = performanceMetrics.rows[0] || {};
      const stats = statsResult.rows[0] || {};
      
      performance = {
        avg_queue_time: Math.round(m.avg_queue_time || 0),
        avg_processing_time: Math.round(m.avg_processing_time || 0),
        peak_hour: `${String(m.peak_hour || 14).padStart(2, '0')}:00`,
        success_rate: stats.total_messages > 0
          ? Math.round(((stats.delivered || 0) + (stats.read || 0)) / stats.total_messages * 100)
          : 0
      };
    }

    const stats = statsResult?.rows[0] || { total_messages: 0, sent: 0, delivered: 0, read: 0, failed: 0, queued: 0 };

    return reply.send({
      success: true,
      timestamp: new Date().toISOString(),
      period,
      stats: {
        total_messages: parseInt(stats.total_messages) || 0,
        sent: parseInt(stats.sent) || 0,
        delivered: parseInt(stats.delivered) || 0,
        read: parseInt(stats.read) || 0,
        failed: parseInt(stats.failed) || 0,
        queued: parseInt(stats.queued) || 0
      },
      queue_stats: queueStats,
      daily_stats: dailyStats.rows.map(row => ({
        ...row,
        date: row.date instanceof Date ? row.date.toISOString().split('T')[0] : row.date
      })),
      hourly_stats: hourlyStats.rows,
      top_clients: topClients,
      performance
    });
  } catch (error) {
    logger.error('Erreur stats overview:', error);
    return reply.status(500).send({
      success: false,
      code: 'INTERNAL_ERROR',
      message: 'Erreur lors de la récupération des statistiques'
    });
  }
}

/**
 * GET /api/v1/stats/numbers/:phone?
 * Stats détaillées par numéro
 */
async function getNumberStats(req, reply) {
  try {
    const { phone } = req.params;
    const clientId = req.user?.id;

    let whereClause = 'wn.is_active = true';
    const params = [];

    if (phone) {
      whereClause += ' AND wn.phone_number = $1';
      params.push(phone);
    }

    if (req.user?.role !== 'admin' && clientId) {
      whereClause += params.length === 0 ? ' AND wn.client_id = $1' : ' AND wn.client_id = $2';
      params.push(clientId);
    }

    const numbers = await query(`
      SELECT
        wn.id,
        wn.phone_number,
        wn.display_name,
        wn.quality_rating,
        wn.tier_current,
        wn.messages_sent_24h,
        wn.daily_conversation_limit,
        wn.is_active,
        c.company_name as client_name,
        c.id as client_id,
        COALESCE(csd.messages_sent, 0) as total_messages_30d,
        COALESCE(csd.messages_delivered, 0) as delivered_30d,
        COALESCE(csd.messages_failed, 0) as failed_30d
      FROM whatsapp_numbers wn
      LEFT JOIN clients c ON wn.client_id = c.id
      LEFT JOIN (
        SELECT 
          client_id,
          SUM(messages_sent) as messages_sent,
          SUM(messages_delivered) as messages_delivered,
          SUM(messages_failed) as messages_failed
        FROM client_stats_daily
        WHERE stat_date >= CURRENT_DATE - INTERVAL '30 days'
        GROUP BY client_id
      ) csd ON c.id = csd.client_id
      WHERE ${whereClause}
      GROUP BY wn.id, wn.phone_number, wn.display_name, wn.quality_rating,
               wn.tier_current, wn.messages_sent_24h, wn.daily_conversation_limit,
               wn.is_active, c.company_name, c.id, csd.messages_sent,
               csd.messages_delivered, csd.messages_failed
      ORDER BY wn.phone_number
    `, params);

    // Enrichir avec stats Redis
    const stats = await Promise.all(
      numbers.rows.map(async (num) => {
        const queueStats = await queueService.getStatsForNumber(num.phone_number).catch(() => ({
          waiting: 0,
          active: 0,
          failed: 0
        }));

        return {
          ...num,
          ...queueStats,
          total: (queueStats.waiting || 0) + (queueStats.active || 0) + (queueStats.failed || 0),
          success_rate: num.total_messages_30d > 0
            ? (num.delivered_30d / num.total_messages_30d * 100).toFixed(1)
            : 100,
          throughput: Math.round((num.messages_sent_24h || 0) / 24)
        };
      })
    );

    return reply.send({
      success: true,
      count: stats.length,
      stats
    });
  } catch (error) {
    logger.error('Erreur stats numéros:', error);
    return reply.status(500).send({
      success: false,
      code: 'INTERNAL_ERROR',
      message: 'Erreur lors de la récupération des stats par numéro'
    });
  }
}

module.exports = {
  getOverviewStats,
  getNumberStats
};
