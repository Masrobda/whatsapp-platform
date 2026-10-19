// src/controllers/orders.controller.js
const { query, transaction } = require('../config/database');
const logger = require('../utils/logger');
const { v4: uuidv4 } = require('uuid');
const invoiceService = require('../services/invoices.service');
const fs = require('fs-extra');
const path = require('path');

const STORAGE_PATH = process.env.STORAGE_PATH || '/var/www/storage/clients';

// Helpers
async function getFolderSize(folderPath) {
  try {
    const files = await fs.readdir(folderPath);
    let totalSize = 0;
    for (const file of files) {
      const stats = await fs.stat(path.join(folderPath, file));
      totalSize += stats.size;
    }
    return totalSize;
  } catch (e) {
    return 0;
  }
}

function formatBytes(bytes) {
  if (bytes === 0) return '0 Bytes';
  const k = 1024;
  const sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
}

// 1. Liste des offres disponibles (formaté pour frontend)
async function getOffersHandler(req, reply) {
  try {
    const result = await query(`
      SELECT
        id, name, description, storage_gb,
        price_fcfa AS price_per_month,
        price_year_fcfa AS price_per_year,
        discount_percentage, features, popular,
        max_file_size_mb, concurrent_uploads, retention_days,
        is_active
      FROM storage_offers
      WHERE is_active = true
      ORDER BY storage_gb ASC
    `);

    const offers = result.rows.map(row => ({
      id: row.id,
      name: row.name,
      description: row.description || '',
      storage_gb: row.storage_gb,
      price_per_month: row.price_per_month,
      price_per_year: row.price_per_year || row.price_per_month * 12,
      discount_percentage: row.discount_percentage || 0,
      features: row.features || [],
      popular: row.popular || false,
      recommended_for: [],
      limitations: {
        max_file_size: `${row.max_file_size_mb || 500} Mo`,
        concurrent_uploads: row.concurrent_uploads || 3,
        retention_days: row.retention_days || 30
      }
    }));

    return reply.send({
      success: true,
      offers
    });
  } catch (err) {
    logger.error('Erreur getOffersHandler:', err);
    return reply.status(500).send({
      success: false,
      message: 'Erreur lors du chargement des offres'
    });
  }
}

// 2. Commandes du client
async function getClientOrdersHandler(req, reply) {
  const clientId = req.user?.id;
  if (!clientId) {
    return reply.status(401).send({ success: false, message: 'Non authentifié' });
  }

  try {
    const result = await query(
      `SELECT o.*, s.name as offer_name, s.storage_gb, sp.id as space_id,
              sp.is_active as space_active, sp.expires_at
       FROM storage_orders o
       LEFT JOIN storage_offers s ON o.offer_id = s.id
       LEFT JOIN storage_spaces sp ON o.space_id = sp.id
       WHERE o.client_id = $1
       ORDER BY o.created_at DESC`,
      [clientId]
    );

    return reply.send({
      success: true,
      orders: result.rows
    });
  } catch (err) {
    logger.error('Erreur getClientOrdersHandler:', err);
    return reply.status(500).send({
      success: false,
      message: 'Erreur chargement commandes'
    });
  }
}

// 3. Créer une commande (pending) - CORRIGÉ

async function createOrderHandler(req, reply) {
  // Log console forcé - toujours visible même si logger buggé
  console.log('===== CREATE ORDER HANDLER DÉMARRÉ =====', new Date().toISOString());
  console.log('req.user:', JSON.stringify(req.user || 'AUCUN USER'));
  console.log('req.body:', JSON.stringify(req.body));
  console.log('Authorization:', req.headers.authorization ? 'présent' : 'absent');

  const clientId = req.user?.id;

  if (!clientId) {
    console.error('ERREUR: clientId absent');
    return reply.status(401).send({ success: false, message: 'Authentification requise' });
  }

  const { offer_id, period = 'month', months = 1 } = req.body || {};

  if (!offer_id) {
    console.error('ERREUR: offer_id manquant');
    return reply.status(400).send({ success: false, message: 'offer_id requis' });
  }

  const monthsNum = Number(months);
  if (isNaN(monthsNum) || monthsNum < 1) {
    console.error('ERREUR: months invalide');
    return reply.status(400).send({ success: false, message: 'months invalide' });
  }

  if (!['month', 'year'].includes(period)) {
    console.error('ERREUR: period invalide');
    return reply.status(400).send({ success: false, message: 'period invalide' });
  }

  try {
    return await transaction(async (client) => {
      console.log('Transaction démarrée');

      // Vérif offre
      const offerRes = await client.query(
        `SELECT id, name, storage_gb, price_fcfa, price_year_fcfa 
         FROM storage_offers 
         WHERE id = $1 AND is_active = true`,
        [offer_id]
      );

      if (offerRes.rowCount === 0) {
        console.error('Offre introuvable ou inactive:', offer_id);
        return reply.status(404).send({ success: false, message: 'Offre introuvable/inactive' });
      }

      const offer = offerRes.rows[0];
      console.log('Offre trouvée:', offer.name, offer.storage_gb, 'Go');

      const amount = period === 'year' ? offer.price_year_fcfa : offer.price_fcfa * monthsNum;

      // Numéro commande unique (anti-collision renforcée)
      let orderNumber;
      let orderId = uuidv4();
      let attempts = 0;
      while (attempts < 10) {
        const date = new Date();
        orderNumber = `CMD-${date.getFullYear()}${String(date.getMonth() + 1).padStart(2, '0')}-${String(Math.floor(Math.random() * 100000)).padStart(5, '0')}`;

        try {
          await client.query(
            `INSERT INTO storage_orders (
              id,
              client_id,
              offer_id,
              space_id,
              order_number,
              amount_fcfa,
              period_months,
              period_type,
              status,
              created_at,
              updated_at
            ) VALUES (
              $1, $2, $3, NULL, $4, $5, $6, $7, 'pending', NOW(), NOW()
            )`,
            [
              orderId,
              clientId,
              offer_id,
              orderNumber,
              amount,
              monthsNum,
              period
            ]
          );

          console.log('INSERT SUCCÈS ! Order ID:', orderId, 'Numéro:', orderNumber);
          return reply.send({
            success: true,
            message: 'Commande créée avec succès. En attente de validation.',
            order: {
              id: orderId,
              order_number: orderNumber,
              amount_fcfa: amount,
              period_months: monthsNum,
              period_type: period,
              status: 'pending',
              offer_name: offer.name
            }
          });
        } catch (insertErr) {
          console.log('INSERT ÉCHEC (tentative', attempts + 1, '):', insertErr.message, insertErr.code);
          if (insertErr.code === '23505') { // unique violation sur order_number
            attempts++;
            orderId = uuidv4();
            continue;
          }
          throw insertErr;
        }
      }

      throw new Error('Impossible de générer order_number unique après 10 tentatives');
    });
  } catch (err) {
    console.error('===== CRASH TOTAL DANS CREATE ORDER =====');
    console.error('Message:', err.message);
    console.error('Code PG:', err.code);
    console.error('Detail PG:', err.detail || 'aucun');
    console.error('Hint PG:', err.hint || 'aucun');
    console.error('Stack:', err.stack?.substring(0, 800));

    return reply.status(500).send({
      success: false,
      code: 'INTERNAL_ERROR',
      message: 'Erreur lors de la création de la commande',
      debug: process.env.NODE_ENV === 'development' ? {
        pgCode: err.code,
        pgDetail: err.detail,
        error: err.message
      } : undefined
    });
  }
}

// 4. Valider une commande (admin/financier)
async function validateOrderHandler(req, reply) {
  const { orderId } = req.params;
  const adminId = req.user?.id;

  if (!adminId) {
    return reply.status(401).send({ 
      success: false, 
      message: 'Authentification requise' 
    });
  }

  try {
    return await transaction(async (client) => {
      const orderRes = await client.query(
        `SELECT o.*, c.company_name, c.email, off.storage_gb, off.name as offer_name
         FROM storage_orders o
         JOIN clients c ON o.client_id = c.id
         JOIN storage_offers off ON o.offer_id = off.id
         WHERE o.id = $1 AND o.status = 'pending'`,
        [orderId]
      );

      if (orderRes.rowCount === 0) {
        return reply.status(404).send({ 
          success: false, 
          message: 'Commande introuvable ou déjà traitée' 
        });
      }

      const order = orderRes.rows[0];

      // Génération numéro de facture
      const date = new Date();
      const year = date.getFullYear();
      const month = String(date.getMonth() + 1).padStart(2, '0');
      const random = String(Math.floor(Math.random() * 10000)).padStart(4, '0');
      const invoiceNumber = `FACT-${year}${month}-${random}`;

      // Génération de la facture HTML
      const invoiceHtml = await invoiceService.generateInvoice({
        invoiceNumber,
        orderNumber: order.order_number,
        clientName: order.company_name,
        clientEmail: order.email,
        amount: order.amount_fcfa,
        months: order.period_months,
        offerName: order.offer_name,
        storageGb: order.storage_gb,
        date: new Date()
      });

      // Calcul de la date d'expiration
      const expiresAt = new Date();
      expiresAt.setMonth(expiresAt.getMonth() + order.period_months);

      // Création de l'espace de stockage
      const spaceId = uuidv4();
      const sizeLimitBytes = order.storage_gb * 1024 * 1024 * 1024;

      await client.query(
        `INSERT INTO storage_spaces (
          id, 
          client_id, 
          order_id, 
          size_limit_bytes, 
          is_active, 
          expires_at, 
          activated_at, 
          created_by,
          created_at,
          updated_at
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, NOW(), NOW())`,
        [spaceId, order.client_id, orderId, sizeLimitBytes, true, expiresAt, new Date(), adminId]
      );

      // Mise à jour de la commande
      await client.query(
        `UPDATE storage_orders
         SET status = 'validated',
             validation_date = NOW(),
             validated_by = $1,
             invoice_html = $2,
             invoice_number = $3,
             space_id = $4,
             updated_at = NOW()
         WHERE id = $5`,
        [adminId, invoiceHtml, invoiceNumber, spaceId, orderId]
      );

      logger.info(`Commande validée ${order.order_number} → Espace ${spaceId}`);

      return reply.send({
        success: true,
        message: 'Commande validée – espace activé',
        spaceId,
        invoiceNumber,
        expiresAt: expiresAt.toISOString()
      });
    });
  } catch (err) {
    logger.error('Erreur validateOrderHandler:', err);
    return reply.status(500).send({ 
      success: false, 
      message: 'Erreur serveur lors de la validation' 
    });
  }
}

// 5. Renouvellement automatique
async function renewOrderHandler(req, reply) {
  const clientId = req.user?.id;
  if (!clientId) {
    return reply.status(401).send({ 
      success: false, 
      message: 'Authentification requise' 
    });
  }

  const { offer_id, period = 'month', months = 1 } = req.body;

  try {
    return await transaction(async (client) => {
      // Récupérer l'espace actif du client
      const spaceRes = await client.query(
        `SELECT s.*, off.price_fcfa, off.price_year_fcfa, off.name as offer_name
         FROM storage_spaces s
         LEFT JOIN storage_orders o ON s.order_id = o.id
         LEFT JOIN storage_offers off ON o.offer_id = off.id
         WHERE s.client_id = $1 AND s.is_active = true AND s.deleted_at IS NULL`,
        [clientId]
      );

      if (spaceRes.rowCount === 0) {
        return reply.status(404).send({ 
          success: false, 
          message: 'Aucun espace actif à renouveler' 
        });
      }

      const space = spaceRes.rows[0];

      // Calcul nouvelle date d'expiration
      const newExpiry = new Date(space.expires_at);
      newExpiry.setMonth(newExpiry.getMonth() + months);

      // Mise à jour de l'espace
      await client.query(
        `UPDATE storage_spaces 
         SET expires_at = $1, 
             updated_at = NOW() 
         WHERE id = $2`,
        [newExpiry, space.id]
      );

      // Calcul du montant
      const amount = period === 'year' 
        ? (space.price_year_fcfa || space.price_fcfa * 12) 
        : space.price_fcfa * months;

      // Génération numéro de commande
      const date = new Date();
      const year = date.getFullYear();
      const month = String(date.getMonth() + 1).padStart(2, '0');
      const random = String(Math.floor(Math.random() * 10000)).padStart(4, '0');
      const orderNumber = `REN-${year}${month}-${random}`;

      // Création de la commande de renouvellement
      const orderId = uuidv4();
      await client.query(
        `INSERT INTO storage_orders (
          id, 
          client_id, 
          offer_id, 
          space_id, 
          order_number, 
          amount_fcfa, 
          period_months, 
          period_type, 
          status, 
          validation_date,
          created_at,
          updated_at
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, NOW(), NOW(), NOW())`,
        [orderId, clientId, offer_id || null, space.id, orderNumber, amount, months, period, 'paid']
      );

      logger.info(`Renouvellement pour client ${clientId} jusqu'au ${newExpiry.toLocaleDateString('fr-FR')}`);

      return reply.send({
        success: true,
        message: `Abonnement renouvelé jusqu'au ${newExpiry.toLocaleDateString('fr-FR')}`,
        newExpiry: newExpiry.toISOString(),
        orderId,
        orderNumber
      });
    });
  } catch (err) {
    logger.error('Erreur renewOrderHandler:', err);
    return reply.status(500).send({ 
      success: false, 
      message: 'Erreur lors du renouvellement' 
    });
  }
}

// 6. Abonnement actuel du client
async function getClientSubscriptionHandler(req, reply) {
  const clientId = req.user?.id;
  if (!clientId) {
    return reply.status(401).send({
      success: false,
      message: 'Authentification requise'
    });
  }

  try {
    // Récupération de l'espace de stockage actif le plus récent
    const result = await query(
      `SELECT 
         s.id AS space_id,
         s.client_id,
         s.size_limit_bytes,
         s.expires_at,
         s.created_at AS subscription_start,
         s.is_active,
         s.auto_renew,
         o.id AS order_id,
         o.offer_id,
         o.amount_fcfa,
         o.period_months,
         o.order_number,
         o.validation_date,
         off.name AS offer_name,
         off.storage_gb,
         (SELECT COUNT(*) FROM storage_files WHERE space_id = s.id AND is_deleted = false) AS file_count
       FROM storage_spaces s
       LEFT JOIN storage_orders o ON s.id = o.space_id
       LEFT JOIN storage_offers off ON o.offer_id = off.id
       WHERE s.client_id = $1 
         AND s.deleted_at IS NULL
         AND s.is_active = true
       ORDER BY s.created_at DESC
       LIMIT 1`,
      [clientId]
    );

    if (result.rowCount === 0) {
      return reply.status(404).send({
        success: false,
        message: 'Aucun abonnement actif'
      });
    }

    const sub = result.rows[0];

    // Calcul de l'utilisation disque
    const folderPath = path.join(STORAGE_PATH, sub.space_id);
    const usedBytes = await getFolderSize(folderPath);
    const usagePercentage = sub.size_limit_bytes 
      ? (usedBytes / sub.size_limit_bytes) * 100 
      : 0;

    const now = new Date();
    const expiryDate = new Date(sub.expires_at);
    const daysRemaining = Math.max(0, Math.ceil((expiryDate - now) / (1000 * 60 * 60 * 24)));

    // Récupération de l'historique des abonnements (commandes validées)
    const historyRes = await query(
      `SELECT 
         o.id,
         o.validation_date AS date,
         o.amount_fcfa AS amount,
         o.status,
         off.name AS offer_name,
         o.period_months,
         o.invoice_html IS NOT NULL AS has_invoice
       FROM storage_orders o
       LEFT JOIN storage_offers off ON o.offer_id = off.id
       WHERE o.client_id = $1 
         AND o.status IN ('validated', 'paid')
       ORDER BY o.validation_date DESC
       LIMIT 10`,
      [clientId]
    );

    // Construction finale de l'objet subscription
    const subscription = {
      ...sub,
      id: sub.space_id,
      offer_name: sub.offer_name || 'Stockage',
      storage_gb: sub.storage_gb,
      used_gb: parseFloat((usedBytes / (1024 ** 3)).toFixed(2)),
      total_gb: Math.round(sub.size_limit_bytes / (1024 ** 3)),
      usage_percentage: Math.min(100, usagePercentage),
      current_period_start: sub.subscription_start?.toISOString(),
      current_period_end: sub.expires_at?.toISOString(),
      status: sub.is_active ? 'active' : (expiryDate < now ? 'expired' : 'pending'),
      days_remaining: daysRemaining,
      is_expired: expiryDate < now,
      auto_renew: sub.auto_renew ?? false,
      payment_history: historyRes.rows.map(row => ({
        id: row.id,
        date: row.date ? row.date.toISOString() : null,
        amount: row.amount,
        status: row.status,
        offer_name: row.offer_name || 'Offre inconnue',
        period_months: row.period_months || 1,
        invoice_url: row.has_invoice 
          ? `https://api.numericexport.com/api/v1/storage/invoice/${row.id}/download`
          : undefined
      }))
    };

    return reply.send({
      success: true,
      subscription
    });
  } catch (err) {
    logger.error('Erreur getClientSubscriptionHandler:', {
      message: err.message,
      stack: err.stack,
      code: err.code,
      detail: err.detail,
      position: err.position
    });

    console.error('Erreur subscription détaillée:', err);

    return reply.status(500).send({
      success: false,
      message: 'Erreur serveur lors du chargement de l\'abonnement',
      debug: process.env.NODE_ENV !== 'production' ? {
        pgCode: err.code,
        pgMessage: err.message,
        pgPosition: err.position
      } : undefined
    });
  }
}

// 7. Options de mise à niveau
async function getUpgradeOptionsHandler(req, reply) {
  const clientId = req.user?.id;
  if (!clientId) {
    return reply.status(401).send({ 
      success: false, 
      message: 'Authentification requise' 
    });
  }

  try {
    // Récupérer l'abonnement actuel
    const currentRes = await query(
      `SELECT s.size_limit_bytes, off.storage_gb as current_gb
       FROM storage_spaces s
       LEFT JOIN storage_orders o ON s.order_id = o.id
       LEFT JOIN storage_offers off ON o.offer_id = off.id
       WHERE s.client_id = $1 AND s.is_active = true AND s.deleted_at IS NULL
       LIMIT 1`,
      [clientId]
    );

    const currentGb = currentRes.rowCount > 0 
      ? (currentRes.rows[0].current_gb || Math.round(currentRes.rows[0].size_limit_bytes / (1024 ** 3)))
      : 0;

    // Récupérer les offres supérieures
    const offersRes = await query(
      `SELECT id, name, storage_gb, price_fcfa, price_year_fcfa, features, description
       FROM storage_offers
       WHERE storage_gb > $1 AND is_active = true
       ORDER BY storage_gb ASC`,
      [currentGb]
    );

    return reply.send({
      success: true,
      current_storage_gb: currentGb,
      options: offersRes.rows.map(offer => ({
        ...offer,
        price_per_month: offer.price_fcfa,
        price_per_year: offer.price_year_fcfa || offer.price_fcfa * 12,
        additional_gb: offer.storage_gb - currentGb
      }))
    });
  } catch (err) {
    logger.error('Erreur getUpgradeOptionsHandler:', err);
    return reply.status(500).send({ 
      success: false, 
      message: 'Erreur serveur' 
    });
  }
}

// 8. Mettre à niveau abonnement
async function upgradeSubscriptionHandler(req, reply) {
  const clientId = req.user?.id;
  if (!clientId) {
    return reply.status(401).send({ 
      success: false, 
      message: 'Authentification requise' 
    });
  }

  const { new_offer_id } = req.body;
  if (!new_offer_id) {
    return reply.status(400).send({ 
      success: false, 
      message: 'new_offer_id requis' 
    });
  }

  try {
    return await transaction(async (client) => {
      // Récupérer l'espace actif
      const spaceRes = await client.query(
        `SELECT s.*
         FROM storage_spaces s
         WHERE s.client_id = $1 AND s.is_active = true AND s.deleted_at IS NULL
         LIMIT 1`,
        [clientId]
      );

      if (spaceRes.rowCount === 0) {
        return reply.status(404).send({ 
          success: false, 
          message: 'Aucun espace actif' 
        });
      }

      const space = spaceRes.rows[0];

      // Récupérer la nouvelle offre
      const offerRes = await client.query(
        'SELECT * FROM storage_offers WHERE id = $1 AND is_active = true',
        [new_offer_id]
      );

      if (offerRes.rowCount === 0) {
        return reply.status(404).send({ 
          success: false, 
          message: 'Offre non trouvée' 
        });
      }

      const newOffer = offerRes.rows[0];
      const newSizeBytes = newOffer.storage_gb * 1024 * 1024 * 1024;

      // Mettre à jour l'espace
      await client.query(
        `UPDATE storage_spaces 
         SET size_limit_bytes = $1, 
             updated_at = NOW() 
         WHERE id = $2`,
        [newSizeBytes, space.id]
      );

      logger.info(`Upgrade: client ${clientId} → ${newOffer.name} (${newOffer.storage_gb} Go)`);

      return reply.send({
        success: true,
        message: 'Abonnement mis à niveau avec succès',
        newStorageGb: newOffer.storage_gb,
        newStorageBytes: newSizeBytes
      });
    });
  } catch (err) {
    logger.error('Erreur upgradeSubscriptionHandler:', err);
    return reply.status(500).send({ 
      success: false, 
      message: 'Erreur lors de la mise à niveau' 
    });
  }
}

// 9. Annuler abonnement
async function cancelSubscriptionHandler(req, reply) {
  const clientId = req.user?.id;
  if (!clientId) {
    return reply.status(401).send({ 
      success: false, 
      message: 'Authentification requise' 
    });
  }

  try {
    const result = await query(
      `UPDATE storage_spaces
       SET is_active = false,
           deleted_at = NOW() + INTERVAL '7 days',
           updated_at = NOW()
       WHERE client_id = $1 AND deleted_at IS NULL
       RETURNING id, expires_at`,
      [clientId]
    );

    if (result.rowCount === 0) {
      return reply.status(404).send({ 
        success: false, 
        message: 'Aucun abonnement actif à annuler' 
      });
    }

    const space = result.rows[0];
    const deletionDate = new Date();
    deletionDate.setDate(deletionDate.getDate() + 7);

    logger.info(`Abonnement annulé pour client ${clientId}, espace ${space.id}`);

    return reply.send({
      success: true,
      message: 'Abonnement annulé avec succès. Vos données seront conservées pendant 7 jours.',
      deletion_date: deletionDate.toISOString(),
      space_id: space.id
    });
  } catch (err) {
    logger.error('Erreur cancelSubscriptionHandler:', err);
    return reply.status(500).send({ 
      success: false, 
      message: 'Erreur lors de l\'annulation' 
    });
  }
}

// 10. Toggle renouvellement auto
async function toggleAutoRenewHandler(req, reply) {
  const clientId = req.user?.id;
  if (!clientId) {
    return reply.status(401).send({ 
      success: false, 
      message: 'Authentification requise' 
    });
  }

  const { auto_renew } = req.body;

  if (typeof auto_renew !== 'boolean') {
    return reply.status(400).send({ 
      success: false, 
      message: 'auto_renew doit être un booléen' 
    });
  }

  try {
    const result = await query(
      `UPDATE storage_spaces
       SET auto_renew = $1, 
           updated_at = NOW()
       WHERE client_id = $2 AND deleted_at IS NULL
       RETURNING id`,
      [auto_renew, clientId]
    );

    if (result.rowCount === 0) {
      return reply.status(404).send({ 
        success: false, 
        message: 'Aucun espace actif trouvé' 
      });
    }

    return reply.send({
      success: true,
      message: `Renouvellement automatique ${auto_renew ? 'activé' : 'désactivé'} avec succès`,
      auto_renew
    });
  } catch (err) {
    logger.error('Erreur toggleAutoRenewHandler:', err);
    return reply.status(500).send({ 
      success: false, 
      message: 'Erreur serveur' 
    });
  }
}

module.exports = {
  getOffersHandler,
  getClientOrdersHandler,
  createOrderHandler,
  validateOrderHandler,
  renewOrderHandler,
  getClientSubscriptionHandler,
  getUpgradeOptionsHandler,
  upgradeSubscriptionHandler,
  cancelSubscriptionHandler,
  toggleAutoRenewHandler
};
