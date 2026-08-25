const { query, getClient } = require('../config/database');
const { sendTeamNotification } = require('./email.service');
const logger = require('../utils/logger');
const fs = require('fs').promises;
const path = require('path');

/**
 * Enregistrer un paiement
 */
async function createPayment(userId, paymentData) {
  const client = await getClient();

  try {
    await client.query('BEGIN');

    // Vérifier la facture
    const invoiceResult = await client.query(
      `SELECT i.*, c.company_name, c.email as client_email
       FROM invoices i
       JOIN clients c ON i.client_id = c.id
       WHERE i.id = $1`,
      [paymentData.invoice_id]
    );

    if (invoiceResult.rows.length === 0) {
      throw {
        statusCode: 404,
        code: 'INVOICE_NOT_FOUND',
        message: 'Facture non trouvée'
      };
    }

    const invoice = invoiceResult.rows[0];

    // Créer le paiement
    const paymentResult = await client.query(
      `INSERT INTO payments (
        invoice_id, client_id, amount, payment_method,
        reference, notes, proof_path, recorded_by
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
      RETURNING id, amount, payment_method, reference, created_at`,
      [
        paymentData.invoice_id,
        invoice.client_id,
        paymentData.amount,
        paymentData.payment_method,
        paymentData.reference || null,
        paymentData.notes || null,
        paymentData.proof_path || null,
        userId
      ]
    );

    const newPayment = paymentResult.rows[0];

    // Mettre à jour le statut de la facture si le paiement est complet
    await updateInvoiceStatusIfPaid(invoice.id, client);

    // Log d'audit
    await client.query(
      `INSERT INTO audit_logs (user_id, action, entity_type, entity_id, new_values)
       VALUES ($1, $2, $3, $4, $5)`,
      [
        userId,
        'PAYMENT_RECORDED',
        'payment',
        newPayment.id,
        JSON.stringify({
          invoice_id: invoice.id,
          amount: paymentData.amount,
          payment_method: paymentData.payment_method
        })
      ]
    );

    await client.query('COMMIT');

    // Notification
    sendTeamNotification(
      'Nouveau paiement enregistré',
      `
      <h2>Paiement reçu</h2>
      <p><strong>Client:</strong> ${invoice.company_name}</p>
      <p><strong>Facture:</strong> ${invoice.invoice_number}</p>
      <p><strong>Montant:</strong> ${paymentData.amount} FCFA</p>
      <p><strong>Méthode:</strong> ${paymentData.payment_method}</p>
      <p><strong>Référence:</strong> ${paymentData.reference || 'Non spécifiée'}</p>
      <br>
      <p>À vérifier dans le dashboard.</p>
      `
    ).catch(err => logger.error('Erreur notification paiement:', err));

    logger.info('Paiement enregistré:', newPayment.id);

    return {
      success: true,
      message: 'Paiement enregistré avec succès',
      payment: newPayment
    };

  } catch (error) {
    await client.query('ROLLBACK');
    logger.error('Erreur création paiement:', error);
    throw error;
  } finally {
    client.release();
  }
}

/**
 * Vérifier si une facture est complètement payée
 */
async function updateInvoiceStatusIfPaid(invoiceId, client) {
  const result = await client.query(
    `SELECT 
      i.total_amount,
      COALESCE(SUM(p.amount), 0) as total_paid
     FROM invoices i
     LEFT JOIN payments p ON i.id = p.invoice_id AND p.verified_by IS NOT NULL
     WHERE i.id = $1
     GROUP BY i.id, i.total_amount`,
    [invoiceId]
  );

  if (result.rows.length > 0) {
    const { total_amount, total_paid } = result.rows[0];
    
    if (total_paid >= total_amount) {
      await client.query(
        `UPDATE invoices 
         SET status = 'paid', paid_date = CURRENT_DATE
         WHERE id = $1 AND status != 'paid'`,
        [invoiceId]
      );
    }
  }
}

/**
 * Valider un paiement
 */
async function verifyPayment(paymentId, userId, verificationData) {
  const client = await getClient();

  try {
    await client.query('BEGIN');

    const paymentResult = await client.query(
      `SELECT p.*, i.invoice_number, i.client_id, c.company_name
       FROM payments p
       JOIN invoices i ON p.invoice_id = i.id
       JOIN clients c ON i.client_id = c.id
       WHERE p.id = $1`,
      [paymentId]
    );

    if (paymentResult.rows.length === 0) {
      throw {
        statusCode: 404,
        code: 'PAYMENT_NOT_FOUND',
        message: 'Paiement non trouvé'
      };
    }

    const payment = paymentResult.rows[0];

    if (payment.verified_by) {
      throw {
        statusCode: 400,
        code: 'PAYMENT_ALREADY_VERIFIED',
        message: 'Ce paiement a déjà été vérifié'
      };
    }

    // Valider le paiement
    await client.query(
      `UPDATE payments 
       SET verified_by = $1, verified_at = CURRENT_TIMESTAMP,
           notes = COALESCE($2, notes)
       WHERE id = $3`,
      [userId, verificationData.notes || null, paymentId]
    );

    // Mettre à jour le statut de la facture
    await updateInvoiceStatusIfPaid(payment.invoice_id, client);

    // Log d'audit
    await client.query(
      `INSERT INTO audit_logs (user_id, action, entity_type, entity_id, new_values)
       VALUES ($1, $2, $3, $4, $5)`,
      [
        userId,
        'PAYMENT_VERIFIED',
        'payment',
        paymentId,
        JSON.stringify({ notes: verificationData.notes })
      ]
    );

    await client.query('COMMIT');

    logger.info('Paiement vérifié:', paymentId);

    return {
      success: true,
      message: 'Paiement validé avec succès'
    };

  } catch (error) {
    await client.query('ROLLBACK');
    logger.error('Erreur vérification paiement:', error);
    throw error;
  } finally {
    client.release();
  }
}

/**
 * Récupérer les paiements d'une facture
 */
async function getInvoicePayments(invoiceId, userId, userType) {
  try {
    let whereClause = 'WHERE p.invoice_id = $1';
    const params = [invoiceId];

    // Vérifier les permissions
    if (userType === 'client') {
      const invoiceCheck = await query(
        `SELECT client_id FROM invoices WHERE id = $1`,
        [invoiceId]
      );
      
      if (invoiceCheck.rows.length === 0 || invoiceCheck.rows[0].client_id !== userId) {
        throw {
          statusCode: 403,
          code: 'FORBIDDEN',
          message: 'Accès non autorisé'
        };
      }
    }

    const paymentsResult = await query(
      `SELECT 
        p.*,
        u.full_name as recorded_by_name,
        uv.full_name as verified_by_name,
        i.invoice_number
       FROM payments p
       JOIN invoices i ON p.invoice_id = i.id
       LEFT JOIN users u ON p.recorded_by = u.id
       LEFT JOIN users uv ON p.verified_by = uv.id
       ${whereClause}
       ORDER BY p.created_at DESC`,
      params
    );

    const totalResult = await query(
      `SELECT 
        i.total_amount,
        COALESCE(SUM(p.amount), 0) as total_paid,
        COALESCE(SUM(CASE WHEN p.verified_by IS NOT NULL THEN p.amount ELSE 0 END), 0) as total_verified
       FROM invoices i
       LEFT JOIN payments p ON i.id = p.invoice_id
       WHERE i.id = $1
       GROUP BY i.id`,
      [invoiceId]
    );

    const totals = totalResult.rows[0] || {
      total_amount: 0,
      total_paid: 0,
      total_verified: 0
    };

    return {
      success: true,
      payments: paymentsResult.rows,
      totals: {
        invoice_total: parseFloat(totals.total_amount) || 0,
        paid_amount: parseFloat(totals.total_paid) || 0,
        verified_amount: parseFloat(totals.total_verified) || 0,
        remaining: (parseFloat(totals.total_amount) || 0) - (parseFloat(totals.total_verified) || 0)
      }
    };

  } catch (error) {
    logger.error('Erreur récupération paiements:', error);
    throw error;
  }
}

/**
 * Récupérer tous les paiements (admin)
 */
async function getAllPayments(filters = {}) {
  try {
    const { 
      page = 1, 
      limit = 5, 
      client_id, 
      status, 
      start_date, 
      end_date,
      payment_method 
    } = filters;
    
    const offset = (page - 1) * limit;

    let whereClause = 'WHERE 1=1';
    const params = [];
    let paramIndex = 1;

    if (client_id) {
      whereClause += ` AND i.client_id = $${paramIndex}`;
      params.push(client_id);
      paramIndex++;
    }

    if (status === 'verified') {
      whereClause += ` AND p.verified_by IS NOT NULL`;
    } else if (status === 'pending') {
      whereClause += ` AND p.verified_by IS NULL`;
    }

    if (payment_method) {
      whereClause += ` AND p.payment_method = $${paramIndex}`;
      params.push(payment_method);
      paramIndex++;
    }

    if (start_date) {
      whereClause += ` AND p.created_at >= $${paramIndex}`;
      params.push(start_date);
      paramIndex++;
    }

    if (end_date) {
      whereClause += ` AND p.created_at <= $${paramIndex}`;
      params.push(end_date);
      paramIndex++;
    }

    // Compter le total
    const countResult = await query(
      `SELECT COUNT(*) FROM payments p
       JOIN invoices i ON p.invoice_id = i.id
       ${whereClause}`,
      params
    );
    const total = parseInt(countResult.rows[0].count);

    // Récupérer les paiements
    const paymentsResult = await query(
      `SELECT 
        p.*,
        i.invoice_number,
        i.invoice_type,
        i.total_amount as invoice_total,
        c.company_name,
        c.email as client_email,
        u.full_name as recorded_by_name,
        uv.full_name as verified_by_name
       FROM payments p
       JOIN invoices i ON p.invoice_id = i.id
       JOIN clients c ON i.client_id = c.id
       LEFT JOIN users u ON p.recorded_by = u.id
       LEFT JOIN users uv ON p.verified_by = uv.id
       ${whereClause}
       ORDER BY p.created_at DESC
       LIMIT $${paramIndex} OFFSET $${paramIndex + 1}`,
      [...params, limit, offset]
    );

    // Statistiques
    const statsResult = await query(
      `SELECT 
        COUNT(*) as total_count,
        COUNT(CASE WHEN p.verified_by IS NOT NULL THEN 1 END) as verified_count,
        SUM(p.amount) as total_amount,
        SUM(CASE WHEN p.verified_by IS NOT NULL THEN p.amount ELSE 0 END) as verified_amount
       FROM payments p
       ${whereClause.replace(/i\./g, 'p.').replace(/c\./g, 'p.')}`,
      params
    );

    const stats = statsResult.rows[0] || {
      total_count: 0,
      verified_count: 0,
      total_amount: 0,
      verified_amount: 0
    };

    return {
      success: true,
      payments: paymentsResult.rows,
      statistics: {
        total_payments: parseInt(stats.total_count) || 0,
        verified_payments: parseInt(stats.verified_count) || 0,
        total_amount: parseFloat(stats.total_amount) || 0,
        verified_amount: parseFloat(stats.verified_amount) || 0,
        pending_amount: (parseFloat(stats.total_amount) || 0) - (parseFloat(stats.verified_amount) || 0)
      },
      pagination: {
        total,
        page: parseInt(page),
        limit: parseInt(limit),
        totalPages: Math.ceil(total / limit)
      }
    };

  } catch (error) {
    logger.error('Erreur récupération paiements:', error);
    throw error;
  }
}

/**
 * Upload de preuve de paiement
 */
async function uploadPaymentProof(paymentId, file) {
  try {
    const uploadDir = path.join(process.env.MEDIA_PATH || '/var/www/numericexport/media', 'proofs');
    
    // Créer le répertoire s'il n'existe pas
    await fs.mkdir(uploadDir, { recursive: true });

    const filename = `payment_${paymentId}_${Date.now()}${path.extname(file.originalname)}`;
    const filepath = path.join(uploadDir, filename);

    // Sauvegarder le fichier
    await fs.writeFile(filepath, file.buffer);

    // Mettre à jour le paiement
    await query(
      'UPDATE payments SET proof_path = $1 WHERE id = $2',
      [`/media/proofs/${filename}`, paymentId]
    );

    logger.info('Preuve de paiement uploadée:', { paymentId, filename });

    return {
      success: true,
      filepath: `/media/proofs/${filename}`,
      filename
    };

  } catch (error) {
    logger.error('Erreur upload preuve paiement:', error);
    throw error;
  }
}

module.exports = {
  createPayment,
  verifyPayment,
  getInvoicePayments,
  getAllPayments,
  uploadPaymentProof,
};
