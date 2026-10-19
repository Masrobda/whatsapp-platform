// api/src/services/socadel-subscription-confirm.service.js
'use strict';

const { query } = require('../config/database');
const logger = require('../utils/logger');

/**
 * Appelé depuis le webhook WATI quand un message passe delivered ou read.
 * Si ce message correspond à une facture post-collecte (socadel_invoice_pending),
 * on finalise l'abonnement digital.
 */
async function confirmSocadelSubscriptionFromDelivery({
  messageId = null,
  watiLocalId = null,
  waMessageId = null,
  status // 'delivered' | 'read'
}) {
  if (!['delivered', 'read'].includes(status)) return { matched: 0 };

  if (!messageId && !watiLocalId && !waMessageId) {
    return { matched: 0 };
  }

  // ── Match pending ─────────────────────────────────────────────
  // 1) Priorité : wati_local_id (UUID renvoyé par WATI à l'envoi)
  // 2) Fallback : message_id interne (si un jour on passe par messages)
  let rows = [];

  if (watiLocalId) {
    const r1 = await query(
      `UPDATE socadel_invoice_pending
       SET status = $1,
           confirmed_at = COALESCE(confirmed_at, NOW())
       WHERE status IN ('pending', 'sent', 'delivered')
         AND wati_local_id = $2
       RETURNING *`,
      [status, watiLocalId]
    );
    rows = r1.rows;
  }

  if (!rows.length && messageId) {
    const r2 = await query(
      `UPDATE socadel_invoice_pending
       SET status = $1,
           confirmed_at = COALESCE(confirmed_at, NOW())
       WHERE status IN ('pending', 'sent', 'delivered')
         AND message_id = $2::uuid
       RETURNING *`,
      [status, messageId]
    );
    rows = r2.rows;
  }

  // 3) Dernier recours : waMessageId (rare — WATI renvoie parfois le même id)
  if (!rows.length && waMessageId) {
    const r3 = await query(
      `UPDATE socadel_invoice_pending
       SET status = $1,
           confirmed_at = COALESCE(confirmed_at, NOW())
       WHERE status IN ('pending', 'sent', 'delivered')
         AND wati_local_id = $2
       RETURNING *`,
      [status, waMessageId]
    );
    rows = r3.rows;
  }

  if (!rows.length) {
    return { matched: 0 };
  }

  let activated = 0;

  for (const row of rows) {
    if (row.channel === 'sms') continue;

    const contractNumber = row.contract_number;
    const phone = row.recipient_phone;

    // Nom client
    let clientName = 'Client';
    try {
      const n = await query(
        `SELECT COALESCE(
           (SELECT client_name FROM contracts WHERE contract_number = $1 LIMIT 1),
           (SELECT noms FROM socadel_contacts WHERE service_no = $1 LIMIT 1),
           'Client'
         ) AS name`,
        [contractNumber]
      );
      clientName = n.rows[0]?.name || 'Client';
    } catch (_) {}

    // Upsert whatsapp_valid_contacts
    try {
      const existing = await query(
        `SELECT whatsapp_phone FROM whatsapp_valid_contacts
         WHERE contract_number = $1 LIMIT 1`,
        [contractNumber]
      );

      if (existing.rows.length === 0) {
        await query(
          `INSERT INTO whatsapp_valid_contacts
             (contract_number, client_name, whatsapp_phone, activated_at)
           VALUES ($1, $2, $3, NOW())`,
          [contractNumber, clientName, phone]
        );
        activated++;
      } else {
        const current = existing.rows[0].whatsapp_phone;
        const same =
          String(current || '').replace(/\D/g, '') ===
          String(phone || '').replace(/\D/g, '');

        if (!same) {
          // Ne pas écraser le principal → secondaire
          await query(
            `INSERT INTO whatsapp_contact_phones
               (contract_number, whatsapp_phone, source, is_primary, collected_by_type)
             VALUES ($1, $2, 'facture_auto', false, $3)
             ON CONFLICT (contract_number, whatsapp_phone) DO NOTHING`,
            [contractNumber, phone, row.collected_by_type || 'releveur']
          );
        }
        // Si même numéro et pas encore activated_at, ne pas toucher activated_at existant
      }

      // Registry
      await query(
        `INSERT INTO client_phone_registry
           (contract_number, phone, channel, statut, source, collected_by_type, collected_by_id)
         VALUES ($1, $2, 'whatsapp', 'valide', 'facture_delivered', $3, $4)
         ON CONFLICT (contract_number, phone) DO UPDATE SET
           statut = 'valide',
           channel = 'whatsapp',
           updated_at = NOW()`,
        [contractNumber, phone, row.collected_by_type || null, row.collected_by_id || null]
      );

      // socadel_contacts → ABONNE (ne pas écraser api_date si déjà OK)
      await query(
        `UPDATE socadel_contacts
         SET statut = 'ABONNE',
             api_status = 'OK',
             api_date = CASE
               WHEN api_status = 'OK' AND api_date IS NOT NULL THEN api_date
               ELSE NOW()
             END,
             activated_at = COALESCE(activated_at, NOW()),
             updated_at = NOW()
         WHERE service_no = $1`,
        [contractNumber]
      );

      logger.info(
        `[SOCADEL-CONFIRM] ABONNE contract=${contractNumber} phone=${phone} status=${status}`
      );
    } catch (err) {
      logger.error(
        `[SOCADEL-CONFIRM] Erreur contract=${contractNumber}: ${err.message}`
      );
    }
  }

  // Invalider cache stats
  try {
    const { redis } = require('../config/redis');
    const keys = await redis.keys('socadel:stats*');
    if (keys.length) await redis.del(...keys);
  } catch (_) {}

  return { matched: rows.length, activated };
}

module.exports = { confirmSocadelSubscriptionFromDelivery };
