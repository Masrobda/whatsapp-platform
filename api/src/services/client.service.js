const { query } = require('../config/database');
const logger = require('../utils/logger');

/**
 * Récupérer le profil d'un client
 */
async function getClientProfile(clientId) {
  try {
    const result = await query(
      `SELECT 
        id, company_name, company_type, email, phone, 
        address, city, country, tax_id, vat_rate,
        message_cost, is_custom_pricing,
        quota_total, quota_used, quota_remaining,
        trial_expires_at, is_active, email_verified,
        created_at, last_login
       FROM clients WHERE id = $1`,
      [clientId]
    );

    if (result.rows.length === 0) {
      throw {
        statusCode: 404,
        code: 'CLIENT_NOT_FOUND',
        message: 'Client non trouvé'
      };
    }

    return {
      success: true,
      client: result.rows[0]
    };

  } catch (error) {
    logger.error('Erreur récupération profil client:', error);
    throw error;
  }
}

/**
 * Mettre à jour le profil d'un client
 */
async function updateClientProfile(clientId, updateData) {
  try {
    const allowedFields = [
      'company_name', 'phone', 'address', 'city', 'country', 'tax_id'
    ];

    const updates = [];
    const values = [];
    let paramIndex = 1;

    Object.keys(updateData).forEach(key => {
      if (allowedFields.includes(key) && updateData[key] !== undefined) {
        updates.push(`${key} = $${paramIndex}`);
        values.push(updateData[key]);
        paramIndex++;
      }
    });

    if (updates.length === 0) {
      throw {
        statusCode: 400,
        code: 'NO_UPDATES',
        message: 'Aucune mise à jour fournie'
      };
    }

    values.push(clientId);

    const result = await query(
      `UPDATE clients 
       SET ${updates.join(', ')}, updated_at = CURRENT_TIMESTAMP
       WHERE id = $${paramIndex}
       RETURNING *`,
      values
    );

    // Log d'audit
    await query(
      `INSERT INTO audit_logs (client_id, action, entity_type, entity_id, new_values)
       VALUES ($1, $2, $3, $4, $5)`,
      [
        clientId,
        'CLIENT_PROFILE_UPDATED',
        'client',
        clientId,
        JSON.stringify(updateData)
      ]
    );

    logger.info('Profil client mis à jour:', clientId);

    return {
      success: true,
      message: 'Profil mis à jour avec succès',
      client: result.rows[0]
    };

  } catch (error) {
    logger.error('Erreur mise à jour profil:', error);
    throw error;
  }
}

/**
 * Récupérer les identifiants API (Token & Instance)
 */
async function getApiCredentials(clientId) {
  try {
    const result = await query(
      `SELECT api_token, api_instance FROM clients WHERE id = $1`,
      [clientId]
    );

    if (result.rows.length === 0) {
      throw {
        statusCode: 404,
        code: 'CLIENT_NOT_FOUND',
        message: 'Client non trouvé'
      };
    }

    return {
      success: true,
      credentials: {
        api_token: result.rows[0].api_token,
        api_instance: result.rows[0].api_instance
      }
    };

  } catch (error) {
    logger.error('Erreur récupération credentials API:', error);
    throw error;
  }
}

/**
 * Récupérer le dashboard summary d'un client
 */
async function getClientDashboard(clientId) {
  try {
    // Informations client
    const clientResult = await query(
      `SELECT 
        company_name, email, quota_total, quota_used, quota_remaining,
        trial_expires_at, message_cost, is_custom_pricing
       FROM clients WHERE id = $1`,
      [clientId]
    );

    if (clientResult.rows.length === 0) {
      throw {
        statusCode: 404,
        code: 'CLIENT_NOT_FOUND',
        message: 'Client non trouvé'
      };
    }

    const client = clientResult.rows[0];

    // Statistiques messages (7 derniers jours)
    const statsResult = await query(
      `SELECT 
        COUNT(*) as total_messages,
        COUNT(CASE WHEN wa_status = 'sent' THEN 1 END) as sent,
        COUNT(CASE WHEN wa_status = 'delivered' THEN 1 END) as delivered,
        COUNT(CASE WHEN wa_status = 'read' THEN 1 END) as read,
        COUNT(CASE WHEN wa_status = 'failed' THEN 1 END) as failed
       FROM messages 
       WHERE client_id = $1 
       AND created_at >= NOW() - INTERVAL '7 days'`,
      [clientId]
    );

    // Commandes récentes
    const ordersResult = await query(
      `SELECT id, order_code, quantity, total_amount, status, created_at
       FROM orders 
       WHERE client_id = $1
       ORDER BY created_at DESC
       LIMIT 5`,
      [clientId]
    );

    // Factures récentes
    const invoicesResult = await query(
      `SELECT id, invoice_number, invoice_type, total_amount, status, issue_date
       FROM invoices 
       WHERE client_id = $1
       ORDER BY created_at DESC
       LIMIT 5`,
      [clientId]
    );

    return {
      success: true,
      dashboard: {
        client: {
          name: client.company_name || client.email,
          email: client.email,
          quota: {
            total: client.quota_total,
            used: client.quota_used,
            remaining: client.quota_remaining,
            percentage: client.quota_total > 0 
              ? Math.round((client.quota_remaining / client.quota_total) * 100)
              : 0
          },
          trial_expires_at: client.trial_expires_at,
          pricing: {
            message_cost: client.message_cost,
            is_custom: client.is_custom_pricing
          }
        },
        stats: statsResult.rows[0],
        recent_orders: ordersResult.rows,
        recent_invoices: invoicesResult.rows
      }
    };

  } catch (error) {
    logger.error('Erreur récupération dashboard:', error);
    throw error;
  }
}

/**
 * Récupérer tous les clients (Admin)
 */
async function getAllClients(filters = {}) {
  try {
    const { page = 1, limit = 10, search, is_active } = filters;
    const offset = (page - 1) * limit;

    let whereClause = 'WHERE 1=1';
    const params = [];
    let paramIndex = 1;

    if (search) {
      whereClause += ` AND (company_name ILIKE $${paramIndex} OR email ILIKE $${paramIndex})`;
      params.push(`%${search}%`);
      paramIndex++;
    }

    if (is_active !== undefined) {
      whereClause += ` AND is_active = $${paramIndex}`;
      params.push(is_active);
      paramIndex++;
    }

    // Compter le total
    const countResult = await query(
      `SELECT COUNT(*) FROM clients ${whereClause}`,
      params
    );
    const total = parseInt(countResult.rows[0].count);

    // Récupérer les clients
    const clientsResult = await query(
      `SELECT 
        id, company_name, email, phone, country,
        quota_total, quota_used, quota_remaining,
        message_cost, is_custom_pricing, is_active,
        is_blocked, block_reason, block_expires_at,
        created_at, last_login
       FROM clients 
       ${whereClause}
       ORDER BY created_at DESC
       LIMIT $${paramIndex} OFFSET $${paramIndex + 1}`,
      [...params, limit, offset]
    );

    return {
      success: true,
      clients: clientsResult.rows,
      pagination: {
        total,
        page: parseInt(page),
        limit: parseInt(limit),
        totalPages: Math.ceil(total / limit)
      }
    };

  } catch (error) {
    logger.error('Erreur récupération clients:', error);
    throw error;
  }
}

/**
 * Mettre à jour le tarif d'un client (Admin)
 */
async function updateClientPricing(clientId, userId, pricingData) {
  try {
    const { message_cost } = pricingData;

    await query(
      `UPDATE clients 
       SET message_cost = $1, 
           is_custom_pricing = true,
           updated_at = CURRENT_TIMESTAMP
       WHERE id = $2`,
      [message_cost, clientId]
    );

    // Log d'audit
    await query(
      `INSERT INTO audit_logs (user_id, action, entity_type, entity_id, new_values)
       VALUES ($1, $2, $3, $4, $5)`,
      [
        userId,
        'CLIENT_PRICING_UPDATED',
        'client',
        clientId,
        JSON.stringify({ message_cost })
      ]
    );

    logger.info('Tarif client mis à jour:', { clientId, message_cost });

    return {
      success: true,
      message: 'Tarif mis à jour avec succès'
    };

  } catch (error) {
    logger.error('Erreur mise à jour tarif:', error);
    throw error;
  }
}

/**
 * Recharger manuellement le quota d'un client (Admin)
 */
async function rechargeClientQuota(clientId, userId, rechargeData) {
  try {
    const { quantity, notes } = rechargeData;

    await query(
      `UPDATE clients 
       SET quota_total = quota_total + $1,
           quota_remaining = quota_remaining + $1
       WHERE id = $2`,
      [quantity, clientId]
    );

    // Log d'audit
    await query(
      `INSERT INTO audit_logs (user_id, action, entity_type, entity_id, new_values)
       VALUES ($1, $2, $3, $4, $5)`,
      [
        userId,
        'CLIENT_QUOTA_RECHARGED',
        'client',
        clientId,
        JSON.stringify({ quantity, notes })
      ]
    );

    logger.info('Quota rechargé:', { clientId, quantity });

    return {
      success: true,
      message: `${quantity} messages ajoutés au compte`
    };

  } catch (error) {
    logger.error('Erreur recharge quota:', error);
    throw error;
  }
}

/**
 * Bloquer / débloquer un client
 */
async function toggleClientBlock(clientId, blocked, reason = null, durationDays = null) {
  try {
    let expiresAt = null;
    if (blocked && durationDays) {
      expiresAt = new Date();
      expiresAt.setDate(expiresAt.getDate() + durationDays);
    }

    await query(
      `UPDATE clients
       SET is_blocked = $1,
           block_reason = $2,
           block_expires_at = $3,
           updated_at = CURRENT_TIMESTAMP
       WHERE id = $4`,
      [blocked, reason, expiresAt, clientId]
    );

    return { success: true };
  } catch (error) {
    logger.error('Erreur toggle block:', error);
    throw error;
  }
}

/**
 * Activer / désactiver un client
 */
async function toggleClientActive(clientId, active) {
  try {
    await query(
      `UPDATE clients
       SET is_active = $1,
           updated_at = CURRENT_TIMESTAMP
       WHERE id = $2`,
      [active, clientId]
    );
    return { success: true };
  } catch (error) {
    logger.error('Erreur toggle active:', error);
    throw error;
  }
}


module.exports = {
  getClientProfile,
  updateClientProfile,
  getApiCredentials,
  getClientDashboard,
  getAllClients,
  updateClientPricing,
  rechargeClientQuota,
  toggleClientBlock,
  toggleClientActive,
};
