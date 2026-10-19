const { query, getClient } = require('../config/database');
const { generateOrderCode } = require('../utils/crypto');
const { sendTeamNotification } = require('./email.service');
const logger = require('../utils/logger');

/**
 * Créer une nouvelle commande
 */
async function createOrder(clientId, orderData) {
  const client = await getClient();

  try {
    await client.query('BEGIN');

    // Récupérer les infos du client
    const clientResult = await client.query(
      `SELECT company_name, email, message_cost, vat_rate
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

    const clientInfo = clientResult.rows[0];
    const unitPrice = clientInfo.message_cost;
    const vatRate = clientInfo.vat_rate;

    // Calculs
    const subtotal = orderData.quantity * unitPrice;
    const vatAmount = subtotal * (vatRate / 100);
    const totalAmount = subtotal + vatAmount;

    // Générer le code de commande
    const orderCode = generateOrderCode();

    // Créer la commande
    const orderResult = await client.query(
      `INSERT INTO orders (
        order_code, client_id, quantity, unit_price,
        subtotal, vat_rate, vat_amount, total_amount, status
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
      RETURNING *`,
      [
        orderCode,
        clientId,
        orderData.quantity,
        unitPrice,
        subtotal,
        vatRate,
        vatAmount,
        totalAmount,
        'pending'
      ]
    );

    const newOrder = orderResult.rows[0];

    // Log d'audit
    await client.query(
      `INSERT INTO audit_logs (client_id, action, entity_type, entity_id, new_values)
       VALUES ($1, $2, $3, $4, $5)`,
      [
        clientId,
        'ORDER_CREATED',
        'order',
        newOrder.id,
        JSON.stringify({
          order_code: orderCode,
          quantity: orderData.quantity,
          total_amount: totalAmount
        })
      ]
    );

    await client.query('COMMIT');

    // Notification à l'équipe (async)
    sendTeamNotification(
      'Nouvelle commande reçue',
      `
      <h2>Nouvelle commande client</h2>
      <p><strong>Client:</strong> ${clientInfo.company_name || clientInfo.email}</p>
      <p><strong>Code commande:</strong> ${orderCode}</p>
      <p><strong>Quantité:</strong> ${orderData.quantity} messages</p>
      <p><strong>Montant total:</strong> ${totalAmount.toFixed(2)} FCFA</p>
      <p><strong>Statut:</strong> En attente de validation</p>
      <br>
      <p>Connectez-vous au dashboard pour traiter cette commande.</p>
      `
    ).catch(err => logger.error('Erreur notification équipe:', err));

    logger.info('Commande créée:', orderCode);

    return {
      success: true,
      message: 'Commande créée avec succès',
      order: {
        id: newOrder.id,
        order_code: newOrder.order_code,
        quantity: newOrder.quantity,
        unit_price: newOrder.unit_price,
        subtotal: newOrder.subtotal,
        vat_rate: newOrder.vat_rate,
        vat_amount: newOrder.vat_amount,
        total_amount: newOrder.total_amount,
        status: newOrder.status,
        created_at: newOrder.created_at
      }
    };

  } catch (error) {
    await client.query('ROLLBACK');
    logger.error('Erreur création commande:', error);
    throw error;
  } finally {
    client.release();
  }
}

/**
 * Récupérer les commandes d'un client
 */
async function getClientOrders(clientId, filters = {}) {
  try {
    const { page = 1, limit = 5, status } = filters;
    const offset = (page - 1) * limit;

    let whereClause = 'WHERE client_id = $1';
    const params = [clientId];
    let paramIndex = 2;

    if (status) {
      whereClause += ` AND status = $${paramIndex}`;
      params.push(status);
      paramIndex++;
    }

    // Compter le total
    const countResult = await query(
      `SELECT COUNT(*) FROM orders ${whereClause}`,
      params
    );
    const total = parseInt(countResult.rows[0].count);

    // Récupérer les commandes
    const ordersResult = await query(
      `SELECT
        id, order_code, quantity, unit_price, subtotal,
        vat_rate, vat_amount, total_amount, status,
        created_at, updated_at
       FROM orders
       ${whereClause}
       ORDER BY created_at DESC
       LIMIT $${paramIndex} OFFSET $${paramIndex + 1}`,
      [...params, limit, offset]
    );

    return {
      success: true,
      orders: ordersResult.rows,
      pagination: {
        total,
        page: parseInt(page),
        limit: parseInt(limit),
        totalPages: Math.ceil(total / limit)
      }
    };

  } catch (error) {
    logger.error('Erreur récupération commandes:', error);
    throw error;
  }
}

/**
 * Récupérer une commande spécifique
 */
async function getOrderById(orderId, userId, userType) {
  try {
    let whereClause = 'WHERE o.id = $1';
    const params = [orderId];

    // Si c'est un client, vérifier qu'il a accès à cette commande
    if (userType === 'client') {
      whereClause += ' AND o.client_id = $2';
      params.push(userId);
    }

    const result = await query(
      `SELECT
        o.*,
        c.company_name, c.email as client_email,
        u1.full_name as validated_by_secretary_name,
        u2.full_name as validated_by_auditor_name,
        u3.full_name as validated_by_financial_name,
        u4.full_name as purchase_confirmed_by_name
       FROM orders o
       JOIN clients c ON o.client_id = c.id
       LEFT JOIN users u1 ON o.validated_by_secretary = u1.id
       LEFT JOIN users u2 ON o.validated_by_auditor = u2.id
       LEFT JOIN users u3 ON o.validated_by_financial = u3.id
       LEFT JOIN users u4 ON o.purchase_confirmed_by = u4.id
       ${whereClause}`,
      params
    );

    if (result.rows.length === 0) {
      throw {
        statusCode: 404,
        code: 'ORDER_NOT_FOUND',
        message: 'Commande non trouvée'
      };
    }

    return {
      success: true,
      order: result.rows[0]
    };

  } catch (error) {
    logger.error('Erreur récupération commande:', error);
    throw error;
  }
}

/**
 * Validation par la secrétaire/commercial
 */
async function validateBySecretary(orderId, userId, validationData) {
  const client = await getClient();

  try {
    await client.query('BEGIN');

    // Récupérer la commande
    const orderResult = await client.query(
      'SELECT * FROM orders WHERE id = $1',
      [orderId]
    );

    if (orderResult.rows.length === 0) {
      throw {
        statusCode: 404,
        code: 'ORDER_NOT_FOUND',
        message: 'Commande non trouvée'
      };
    }

    const order = orderResult.rows[0];

    if (order.status !== 'pending') {
      throw {
        statusCode: 400,
        code: 'INVALID_STATUS',
        message: 'Cette commande a déjà été validée ou est dans un état invalide'
      };
    }

    // Mettre à jour la commande
    await client.query(
      `UPDATE orders
       SET status = $1,
           validated_by_secretary = $2,
           validated_by_secretary_at = CURRENT_TIMESTAMP,
           notes = $3
       WHERE id = $4`,
      ['validated_secretary', userId, validationData.notes || null, orderId]
    );

    // Log d'audit
    await client.query(
      `INSERT INTO audit_logs (user_id, action, entity_type, entity_id, new_values)
       VALUES ($1, $2, $3, $4, $5)`,
      [
        userId,
        'ORDER_VALIDATED_SECRETARY',
        'order',
        orderId,
        JSON.stringify({ notes: validationData.notes })
      ]
    );

    await client.query('COMMIT');

    // Notification à l'équipe
    sendTeamNotification(
      'Commande validée par secrétaire',
      `
      <h2>Commande validée</h2>
      <p><strong>Code commande:</strong> ${order.order_code}</p>
      <p><strong>Validée par:</strong> Secrétaire/Commercial</p>
      <p><strong>Prochaine étape:</strong> Validation auditeur</p>
      `
    ).catch(err => logger.error('Erreur notification:', err));

    logger.info('Commande validée par secrétaire:', order.order_code);

    return {
      success: true,
      message: 'Commande validée avec succès. En attente de validation auditeur.'
    };

  } catch (error) {
    await client.query('ROLLBACK');
    logger.error('Erreur validation secrétaire:', error);
    throw error;
  } finally {
    client.release();
  }
}

/**
 * Validation par l'auditeur
 */
async function validateByAuditor(orderId, userId, validationData) {
  const client = await getClient();

  try {
    await client.query('BEGIN');

    const orderResult = await client.query(
      'SELECT * FROM orders WHERE id = $1',
      [orderId]
    );

    if (orderResult.rows.length === 0) {
      throw {
        statusCode: 404,
        code: 'ORDER_NOT_FOUND',
        message: 'Commande non trouvée'
      };
    }

    const order = orderResult.rows[0];

    if (order.status !== 'validated_secretary') {
      throw {
        statusCode: 400,
        code: 'INVALID_STATUS',
        message: 'La commande doit d\'abord être validée par la secrétaire'
      };
    }

    await client.query(
      `UPDATE orders
       SET status = $1,
           validated_by_auditor = $2,
           validated_by_auditor_at = CURRENT_TIMESTAMP
       WHERE id = $3`,
      ['validated_auditor', userId, orderId]
    );

    await client.query(
      `INSERT INTO audit_logs (user_id, action, entity_type, entity_id)
       VALUES ($1, $2, $3, $4)`,
      [userId, 'ORDER_VALIDATED_AUDITOR', 'order', orderId]
    );

    await client.query('COMMIT');

    sendTeamNotification(
      'Commande validée par auditeur',
      `
      <h2>Commande validée</h2>
      <p><strong>Code commande:</strong> ${order.order_code}</p>
      <p><strong>Validée par:</strong> Auditeur</p>
      <p><strong>Prochaine étape:</strong> Validation responsable financier</p>
      `
    ).catch(err => logger.error('Erreur notification:', err));

    logger.info('Commande validée par auditeur:', order.order_code);

    return {
      success: true,
      message: 'Commande validée avec succès. En attente de validation financière.'
    };

  } catch (error) {
    await client.query('ROLLBACK');
    logger.error('Erreur validation auditeur:', error);
    throw error;
  } finally {
    client.release();
  }
}

/**
 * Validation par le responsable financier + génération facture proforma
 */
async function validateByFinancial(orderId, userId) {
  const client = await getClient();

  try {
    await client.query('BEGIN');

    const orderResult = await client.query(
      'SELECT o.*, c.company_name, c.email FROM orders o JOIN clients c ON o.client_id = c.id WHERE o.id = $1',
      [orderId]
    );

    if (orderResult.rows.length === 0) {
      throw {
        statusCode: 404,
        code: 'ORDER_NOT_FOUND',
        message: 'Commande non trouvée'
      };
    }

    const order = orderResult.rows[0];

    if (order.status !== 'validated_auditor') {
      throw {
        statusCode: 400,
        code: 'INVALID_STATUS',
        message: 'La commande doit d\'abord être validée par l\'auditeur'
      };
    }

    // Mettre à jour le statut de la commande
    await client.query(
      `UPDATE orders
       SET status = $1,
           validated_by_financial = $2,
           validated_by_financial_at = CURRENT_TIMESTAMP
       WHERE id = $3`,
      ['validated_financial', userId, orderId]
    );

    // Générer la facture proforma sera fait dans le service invoice
    // Pour l'instant on marque juste le statut

    await client.query(
      `INSERT INTO audit_logs (user_id, action, entity_type, entity_id)
       VALUES ($1, $2, $3, $4)`,
      [userId, 'ORDER_VALIDATED_FINANCIAL', 'order', orderId]
    );

    await client.query('COMMIT');

    sendTeamNotification(
      'Commande validée par responsable financier',
      `
      <h2>Commande validée</h2>
      <p><strong>Code commande:</strong> ${order.order_code}</p>
      <p><strong>Validée par:</strong> Responsable Financier</p>
      <p><strong>Prochaine étape:</strong> Génération facture proforma et validation responsable achats</p>
      `
    ).catch(err => logger.error('Erreur notification:', err));

    logger.info('Commande validée par responsable financier:', order.order_code);

    return {
      success: true,
      message: 'Commande validée avec succès',
      order: {
        id: orderId,
        order_code: order.order_code,
        status: 'validated_financial',
        client_name: order.company_name,
        total_amount: order.total_amount
      },
      next_step: 'Générer la facture proforma'
    };

  } catch (error) {
    await client.query('ROLLBACK');
    logger.error('Erreur validation financier:', error);
    throw error;
  } finally {
    client.release();
  }
}

async function validateByFinancialWithBSP(orderId, userId, data) {
  try {
    const { bsp_id, messages_to_purchase, custom_cost, purpose } = data;

    // Récupérer la commande
    const orderResult = await query(
      `SELECT o.*, c.company_name, c.email as client_email
       FROM orders o
       JOIN clients c ON o.client_id = c.id
       WHERE o.id = $1`,
      [orderId]
    );

    if (orderResult.rowCount === 0) {
      throw { statusCode: 404, code: 'ORDER_NOT_FOUND', message: 'Commande non trouvée' };
    }

    const order = orderResult.rows[0];

    // Vérifier que la commande est au bon statut
    if (order.status !== 'validated_auditor') {
      throw {
        statusCode: 400,
        code: 'INVALID_STATUS',
        message: 'La commande doit être validée par l\'auditeur avant validation financière'
      };
    }

    // Récupérer les informations du BSP sélectionné
    let bsp = null;
    let totalCost = 0;
    let messageCost = order.unit_price; // Par défaut, utiliser le prix unitaire

    if (bsp_id) {
      const bspResult = await query(
        'SELECT * FROM bsp_providers WHERE id = $1 AND is_active = true',
        [bsp_id]
      );

      if (bspResult.rowCount === 0) {
        throw {
          statusCode: 404,
          code: 'BSP_NOT_FOUND',
          message: 'Fournisseur BSP non trouvé ou inactif'
        };
      }

      bsp = bspResult.rows[0];
      messageCost = custom_cost || bsp.message_cost;

      // Calculer le coût total
      const quantity = messages_to_purchase || order.quantity;
      const additionalCharges = bsp.additional_charges || { fixed: 0, percent: 0 };

      totalCost = messageCost * quantity;
      totalCost += additionalCharges.fixed || 0;
      totalCost += totalCost * ((additionalCharges.percent || 0) / 100);

      // Calculer la marge
      const orderAmount = order.total_amount;
      const margin = orderAmount - totalCost;
      const marginPercentage = (margin / orderAmount) * 100;

      // Mettre à jour la commande avec les infos BSP
      await query(
        `UPDATE orders
         SET status = 'validated_financial',
             selected_bsp_id = $1,
             bsp_message_cost = $2,
             bsp_additional_charges = $3,
             estimated_purchase_cost = $4,
             messages_to_purchase = $5,
             financial_purpose = $6,
             validated_financial_at = NOW(),
             validated_financial_by = $7
         WHERE id = $8`,
        [
          bsp_id,
          messageCost,
          bsp.additional_charges,
          totalCost,
          messages_to_purchase || order.quantity,
          purpose || `Achat de ${quantity} messages via ${bsp.name}`,
          userId,
          orderId
        ]
      );

      // Créer automatiquement la facture proforma
      await generateProforma(orderId, userId);

      // Créer un log d'audit
      await createAuditLog({
        action: 'FINANCIAL_VALIDATION_WITH_BSP',
        entity_type: 'order',
        entity_id: orderId,
        user_id: userId,
        details: {
          bsp: bsp.name,
          message_cost: messageCost,
          estimated_purchase_cost: totalCost,
          margin_amount: margin,
          margin_percentage: marginPercentage,
          messages_to_purchase: messages_to_purchase || order.quantity,
          purpose: purpose
        }
      });

      return {
        success: true,
        message: 'Validation financière avec BSP effectuée avec succès',
        order_id: orderId,
        bsp: bsp.name,
        order_amount: orderAmount,
        estimated_cost: totalCost,
        margin: margin,
        margin_percentage: marginPercentage,
        proforma_generated: true
      };
    } else {
      // Validation financière sans BSP spécifique (pour compatibilité)
      await query(
        `UPDATE orders
         SET status = 'validated_financial',
             validated_financial_at = NOW(),
             validated_financial_by = $1
         WHERE id = $2`,
        [userId, orderId]
      );

      return {
        success: true,
        message: 'Validation financière effectuée sans BSP spécifique',
        order_id: orderId
      };
    }
  } catch (error) {
    logger.error('Erreur validation financière avec BSP:', error);
    throw error;
  }
}


/**
 * Récupérer toutes les commandes (pour admin)
 */
async function getAllOrders(filters = {}) {
  try {
    const { page = 1, limit = 5, status, client_id, start_date, end_date } = filters;
    const offset = (page - 1) * limit;

    let whereClause = 'WHERE 1=1';
    const params = [];
    let paramIndex = 1;

    if (status) {
      whereClause += ` AND o.status = $${paramIndex}`;
      params.push(status);
      paramIndex++;
    }

    if (client_id) {
      whereClause += ` AND o.client_id = $${paramIndex}`;
      params.push(client_id);
      paramIndex++;
    }

    if (start_date) {
      whereClause += ` AND o.created_at >= $${paramIndex}`;
      params.push(start_date);
      paramIndex++;
    }

    if (end_date) {
      whereClause += ` AND o.created_at <= $${paramIndex}`;
      params.push(end_date);
      paramIndex++;
    }

    // Compter le total
    const countResult = await query(
      `SELECT COUNT(*) FROM orders o ${whereClause}`,
      params
    );
    const total = parseInt(countResult.rows[0].count);

    // Récupérer les commandes
    const ordersResult = await query(
      `SELECT
        o.*,
        c.company_name, c.email as client_email,
        u1.full_name as validated_by_secretary_name,
        u2.full_name as validated_by_auditor_name,
        u3.full_name as validated_by_financial_name
       FROM orders o
       JOIN clients c ON o.client_id = c.id
       LEFT JOIN users u1 ON o.validated_by_secretary = u1.id
       LEFT JOIN users u2 ON o.validated_by_auditor = u2.id
       LEFT JOIN users u3 ON o.validated_by_financial = u3.id
       ${whereClause}
       ORDER BY o.created_at DESC
       LIMIT $${paramIndex} OFFSET $${paramIndex + 1}`,
      [...params, limit, offset]
    );

    return {
      success: true,
      orders: ordersResult.rows,
      pagination: {
        total,
        page: parseInt(page),
        limit: parseInt(limit),
        totalPages: Math.ceil(total / limit)
      }
    };

  } catch (error) {
    logger.error('Erreur récupération toutes commandes:', error);
    throw error;
  }
}

module.exports = {
  createOrder,
  getClientOrders,
  getOrderById,
  validateBySecretary,
  validateByAuditor,
  validateByFinancial,
  getAllOrders,
};
