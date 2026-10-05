const { query } = require('../config/database');
const logger = require('../utils/logger');

/**
 * Récupérer le stock total de messages
 */
async function getMessageStock(request, reply) {
  try {
    // Récupérer tous les rechargements validés
    const stockResult = await query(`
      SELECT
        COALESCE(SUM(CASE WHEN type = 'purchase' AND status = 'completed' THEN messages_count ELSE 0 END), 0) as total_purchased,
        COALESCE(SUM(CASE WHEN type = 'consumption' AND status = 'completed' THEN ABS(messages_count) ELSE 0 END), 0) as total_consumed,
        COALESCE(SUM(
          CASE 
            WHEN type = 'purchase' AND status = 'completed' THEN messages_count
            WHEN type = 'consumption' AND status = 'completed' THEN messages_count
            ELSE 0
          END
        ), 0) as available
      FROM message_transactions
    `);

    // Récupérer les 10 dernières transactions - CORRECTION: utiliser company_name
    const recentResult = await query(`
      SELECT
        mt.*,
        b.name as bsp_name,
        o.order_code,
        c.company_name as company_name,  -- CORRECTION: company_name au lieu de name
        u.full_name as created_by_name
      FROM message_transactions mt
      LEFT JOIN bsp_providers b ON mt.bsp_id = b.id
      LEFT JOIN orders o ON mt.order_id = o.id
      LEFT JOIN clients c ON o.client_id = c.id
      LEFT JOIN users u ON mt.created_by = u.id
      ORDER BY mt.created_at DESC
      LIMIT 10
    `);

    const purchased = parseInt(stockResult.rows[0].total_purchased) || 0;
    const consumed = parseInt(stockResult.rows[0].total_consumed) || 0;
    const available = parseInt(stockResult.rows[0].available) || 0;

    return reply.code(200).send({
      success: true,
      data: {
        stock: {
          total: purchased,
          purchased: purchased,
          consumed: consumed,
          available: available
        },
        recent: recentResult.rows
      }
    });
  } catch (error) {
    logger.error('Erreur récupération stock messages:', error);
    console.error('Détail erreur getMessageStock:', error);
    return reply.code(500).send({
      success: false,
      code: 'INTERNAL_ERROR',
      message: 'Erreur lors de la récupération du stock'
    });
  }
}

/**
 * Effectuer un rechargement de messages (achat BSP)
 */
async function purchaseMessages(request, reply) {
  console.log('\n🚀 ========== DÉBUT ACHAT MESSAGES ==========');
  console.log('📦 Body reçu:', JSON.stringify(request.body, null, 2));
  console.log('👤 User ID:', request.user.id);
  
  try {
    const { bsp_id, messages_count, unit_cost, total_cost, reference, notes } = request.body;
    const userId = request.user.id;

    // Validations
    if (!bsp_id || !messages_count || messages_count <= 0) {
      return reply.code(400).send({
        success: false,
        message: 'bsp_id et messages_count requis (positif)'
      });
    }

    // DÉBUT DE LA TRANSACTION - Syntaxe SQL directe
    await query('BEGIN');

    try {
      // Vérifier BSP
      const bspCheck = await query(
        'SELECT * FROM bsp_providers WHERE id = $1',
        [bsp_id]
      );

      if (bspCheck.rowCount === 0) {
        await query('ROLLBACK');
        return reply.code(404).send({
          success: false,
          message: 'Fournisseur BSP non trouvé'
        });
      }

      // Vérifier utilisateur
      const userCheck = await query(
        'SELECT id FROM users WHERE id = $1',
        [userId]
      );

      if (userCheck.rowCount === 0) {
        await query('ROLLBACK');
        return reply.code(400).send({
          success: false,
          message: 'Utilisateur non trouvé'
        });
      }

      // Calculer les coûts
      const finalUnitCost = unit_cost || 0;
      const finalTotalCost = total_cost || (messages_count * finalUnitCost);

      // Générer numéro unique
      const purchaseNumber = `ACH-${Date.now()}`;

      // Insérer la transaction
      const result = await query(`
        INSERT INTO message_transactions (
          transaction_number,
          type,
          bsp_id,
          messages_count,
          unit_cost,
          total_cost,
          reference,
          notes,
          status,
          created_by,
          created_at,
          updated_at
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, NOW(), NOW())
        RETURNING *
      `, [
        purchaseNumber,
        'purchase',
        bsp_id,
        messages_count,
        finalUnitCost,
        finalTotalCost,
        reference || null,
        notes || null,
        'completed',
        userId
      ]);

      // COMMIT de la transaction
      await query('COMMIT');

      console.log('✅ Achat réussi!');
      return reply.code(201).send({
        success: true,
        message: 'Rechargement effectué avec succès',
        data: result.rows[0]
      });

    } catch (innerError) {
      // ROLLBACK en cas d'erreur dans la transaction
      await query('ROLLBACK');
      throw innerError;
    }

  } catch (error) {
    console.error('❌ ERREUR:', error);
    return reply.code(500).send({
      success: false,
      message: error.message
    });
  }
}


/**
 * Consommer des messages (lors de validation commande)
 */
async function consumeMessages(orderId, messagesCount, bspId, userId) {
  // PAS DE BEGIN ici car appelé depuis une transaction existante
  try {
    // Récupérer les infos de la commande
    const orderInfo = await query(
      `SELECT o.order_code, c.company_name 
       FROM orders o 
       LEFT JOIN clients c ON o.client_id = c.id 
       WHERE o.id = $1`,
      [orderId]
    );

    // Générer un numéro de consommation
    const consumptionNumber = 'CONS-' + Date.now();

    // Créer la transaction de consommation
    const transactionResult = await query(`
      INSERT INTO message_transactions (
        transaction_number,
        type,
        order_id,
        messages_count,
        bsp_id,
        reference,
        notes,
        status,
        created_by,
        created_at,
        updated_at
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, NOW(), NOW())
      RETURNING *
    `, [
      consumptionNumber,
      'consumption',
      orderId,
      -Math.abs(messagesCount),
      bspId,
      orderInfo.rows[0]?.order_code || null,
      `Consommation automatique pour commande ${orderInfo.rows[0]?.order_code || orderId}`,
      'completed',
      userId
    ]);

    console.log('✅ Messages consommés:', transactionResult.rows[0].id);
    return transactionResult.rows[0];

  } catch (error) {
    console.error('❌ Erreur consommation messages:', error);
    throw error; // Relancer pour que la transaction principale puisse ROLLBACK
  }
}


/**
 * Récupérer l'historique complet des transactions
 */
async function getTransactionHistory(request, reply) {
  try {
    const {
      page = 1,
      limit = 20,
      type,
      bsp_id,
      start_date,
      end_date,
      month,   // Format : "01" à "12"
      year     // Format : "2024", "2025", etc.
    } = request.query;

    const offset = (page - 1) * limit;

    // Construction de la requête principale
    let sql = `
      SELECT
        mt.*,
        b.name as bsp_name,
        o.order_code,
        c.company_name as company_name,
        u.full_name as created_by_name
      FROM message_transactions mt
      LEFT JOIN bsp_providers b ON mt.bsp_id = b.id
      LEFT JOIN orders o ON mt.order_id = o.id
      LEFT JOIN clients c ON o.client_id = c.id
      LEFT JOIN users u ON mt.created_by = u.id
      WHERE 1=1
    `;

    const params = [];
    let paramIndex = 1;

    if (type && type !== 'all') {
      sql += ` AND mt.type = $${paramIndex}`;
      params.push(type);
      paramIndex++;
    }
    if (bsp_id) {
      sql += ` AND mt.bsp_id = $${paramIndex}`;
      params.push(bsp_id);
      paramIndex++;
    }
    if (start_date) {
      sql += ` AND DATE(mt.created_at) >= $${paramIndex}`;
      params.push(start_date);
      paramIndex++;
    }
    if (end_date) {
      sql += ` AND DATE(mt.created_at) <= $${paramIndex}`;
      params.push(end_date);
      paramIndex++;
    }
    // Filtre par mois (ex: 03 pour mars)
    if (month && /^\d{2}$/.test(month)) {
      sql += ` AND TO_CHAR(mt.created_at, 'MM') = $${paramIndex}`;
      params.push(month);
      paramIndex++;
    }
    // Filtre par année
    if (year && /^\d{4}$/.test(year)) {
      sql += ` AND EXTRACT(YEAR FROM mt.created_at) = $${paramIndex}`;
      params.push(parseInt(year));
      paramIndex++;
    }

    // ====================== REQUÊTE DE COMPTAGE ======================
    let countSql = `
      SELECT COUNT(*) as total
      FROM message_transactions mt
      WHERE 1=1
    `;

    const countParams = [];
    let countIndex = 1;

    if (type && type !== 'all') {
      countSql += ` AND mt.type = $${countIndex}`;
      countParams.push(type);
      countIndex++;
    }
    if (bsp_id) {
      countSql += ` AND mt.bsp_id = $${countIndex}`;
      countParams.push(bsp_id);
      countIndex++;
    }
    if (start_date) {
      countSql += ` AND DATE(mt.created_at) >= $${countIndex}`;
      countParams.push(start_date);
      countIndex++;
    }
    if (end_date) {
      countSql += ` AND DATE(mt.created_at) <= $${countIndex}`;
      countParams.push(end_date);
      countIndex++;
    }
    if (month && /^\d{2}$/.test(month)) {
      countSql += ` AND TO_CHAR(mt.created_at, 'MM') = $${countIndex}`;
      countParams.push(month);
      countIndex++;
    }
    if (year && /^\d{4}$/.test(year)) {
      countSql += ` AND EXTRACT(YEAR FROM mt.created_at) = $${countIndex}`;
      countParams.push(parseInt(year));
      countIndex++;
    }

    const countResult = await query(countSql, countParams);
    const total = parseInt(countResult.rows[0]?.total) || 0;

    // Pagination
    sql += ` ORDER BY mt.created_at DESC LIMIT $${paramIndex} OFFSET $${paramIndex + 1}`;
    params.push(parseInt(limit), parseInt(offset));

    const result = await query(sql, params);

    return reply.code(200).send({
      success: true,
      data: result.rows,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total: total,
        totalPages: Math.ceil(total / limit)
      }
    });
  } catch (error) {
    logger.error('Erreur historique transactions:', error);
    console.error('Détail erreur getTransactionHistory:', error);
    return reply.code(500).send({
      success: false,
      code: 'INTERNAL_ERROR',
      message: 'Erreur lors de la récupération de l\'historique'
    });
  }
}


/**
 * Obtenir les statistiques des transactions
 */
async function getTransactionStats(request, reply) {
  try {
    const result = await query(`
      SELECT
        DATE_TRUNC('month', created_at) as month,
        SUM(CASE WHEN type = 'purchase' AND status = 'completed' THEN messages_count ELSE 0 END) as purchases,
        SUM(CASE WHEN type = 'consumption' AND status = 'completed' THEN ABS(messages_count) ELSE 0 END) as consumptions,
        COUNT(CASE WHEN type = 'purchase' THEN 1 END) as purchase_count,
        COUNT(CASE WHEN type = 'consumption' THEN 1 END) as consumption_count
      FROM message_transactions
      WHERE created_at >= NOW() - INTERVAL '12 months'
      GROUP BY DATE_TRUNC('month', created_at)
      ORDER BY month DESC
    `);

    // Top BSP par achats
    const topBsp = await query(`
      SELECT
        b.name,
        COUNT(mt.*) as transaction_count,
        SUM(mt.messages_count) as total_messages,
        SUM(mt.total_cost) as total_cost
      FROM message_transactions mt
      JOIN bsp_providers b ON mt.bsp_id = b.id
      WHERE mt.type = 'purchase' AND mt.status = 'completed'
      GROUP BY b.id, b.name
      ORDER BY total_messages DESC
      LIMIT 5
    `);

    return reply.code(200).send({
      success: true,
      data: {
        monthly: result.rows,
        top_bsp: topBsp.rows
      }
    });

  } catch (error) {
    logger.error('Erreur stats transactions:', error);
    return reply.code(500).send({
      success: false,
      code: 'INTERNAL_ERROR',
      message: 'Erreur lors de la récupération des statistiques'
    });
  }
}

/**
 * Vérifier le stock disponible
 */
async function checkAvailability(request, reply) {
  try {
    const { required } = request.query;

    const stockResult = await query(`
      SELECT COALESCE(SUM(
        CASE 
          WHEN type = 'purchase' AND status = 'completed' THEN messages_count
          WHEN type = 'consumption' AND status = 'completed' THEN messages_count
          ELSE 0
        END
      ), 0) as available
      FROM message_transactions
    `);

    const available = parseInt(stockResult.rows[0].available) || 0;

    return reply.code(200).send({
      success: true,
      data: {
        available,
        required: required ? parseInt(required) : null,
        sufficient: required ? available >= parseInt(required) : true
      }
    });

  } catch (error) {
    logger.error('Erreur vérification stock:', error);
    return reply.code(500).send({
      success: false,
      code: 'INTERNAL_ERROR',
      message: 'Erreur lors de la vérification du stock'
    });
  }
}

module.exports = {
  getMessageStock,
  purchaseMessages,
  consumeMessages,
  getTransactionHistory,
  getTransactionStats,
  checkAvailability
};
