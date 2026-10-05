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

    try {
      await query(
        `INSERT INTO contracts (contract_number, client_name)
         VALUES ($1, $2)
         ON CONFLICT (contract_number) DO NOTHING`,
        [contractNumber, clientName]
      );
    } catch (fkErr) {
      // Si pas de contrainte unique sur contracts.contract_number,
      // fallback en SELECT puis INSERT conditionnel
      const exists = await query(
        `SELECT 1 FROM contracts WHERE contract_number = $1 LIMIT 1`,
        [contractNumber]
      );
      if (!exists.rows.length) {
        await query(
          `INSERT INTO contracts (contract_number, client_name)
           VALUES ($1, $2)`,
          [contractNumber, clientName]
        );
      }
    }


        // Upsert whatsapp_valid_contacts — ATOMIQUE (gère la race condition
    // entre webhooks delivered et read qui arrivent quasi simultanément)
    try {
      const upsertRes = await query(
        `INSERT INTO whatsapp_valid_contacts
           (contract_number, client_name, whatsapp_phone, activated_at)
         VALUES ($1, $2, $3, NOW())
         ON CONFLICT (contract_number) DO UPDATE
           SET client_name = COALESCE(EXCLUDED.client_name,
                                      whatsapp_valid_contacts.client_name),
               updated_at  = NOW()
         RETURNING (xmax = 0) AS was_inserted, whatsapp_phone`,
        [contractNumber, clientName, phone]
      );

      const wasInserted = upsertRes.rows[0]?.was_inserted === true;
      const currentPhone = upsertRes.rows[0]?.whatsapp_phone;

      if (wasInserted) {
        activated++;
        logger.info(
          `[SOCADEL-CONFIRM] INSERT contract=${contractNumber} phone=${phone}`
        );
      } else {
        // Déjà existant → éventuellement ajouter en secondaire si numéro différent
        const same =
          String(currentPhone || '').replace(/\D/g, '') ===
          String(phone || '').replace(/\D/g, '');

        if (!same && phone) {
          await query(
            `INSERT INTO whatsapp_contact_phones
               (contract_number, whatsapp_phone, source, is_primary, collected_by_type)
             VALUES ($1, $2, 'facture_auto', false, $3)
             ON CONFLICT (contract_number, whatsapp_phone) DO NOTHING`,
            [contractNumber, phone, row.collected_by_type || 'releveur']
          );
        }
        logger.info(
          `[SOCADEL-CONFIRM] UPSERT (déjà existant) contract=${contractNumber}`
        );
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

/**
 * Appelé depuis le webhook WATI quand un message facture échoue définitivement
 * (numéro non WhatsApp, template rejeté, etc.).
 * Marque socadel_invoice_pending en 'failed' + stoppe le retry.
 */
async function markSocadelInvoiceFailed({
  watiLocalId = null,
  waMessageId = null,
  failedDetail = "Échec d'envoi WATI/Meta"
}) {
  if (!watiLocalId && !waMessageId) return { marked: 0 };

  // 1) Marquer socadel_invoice_pending en 'failed'
  let rows = [];

  if (watiLocalId) {
    const r = await query(
      `UPDATE socadel_invoice_pending
       SET status = 'failed',
           failed_at = COALESCE(failed_at, NOW()),
           last_error = $2
       WHERE status IN ('pending', 'sent')
         AND wati_local_id = $1
       RETURNING contract_number, recipient_phone`,
      [watiLocalId, failedDetail]
    );
    rows = r.rows;
  }

  // Fallback : waMessageId
  if (!rows.length && waMessageId) {
    const r = await query(
      `UPDATE socadel_invoice_pending
       SET status = 'failed',
           failed_at = COALESCE(failed_at, NOW()),
           last_error = $2
       WHERE status IN ('pending', 'sent')
         AND wati_local_id = $1
       RETURNING contract_number, recipient_phone`,
      [waMessageId, failedDetail]
    );
    rows = r.rows;
  }

  // 2) Stoppe immédiatement le retry pour ces contrats
  //    → évite 4 tentatives inutiles sur un numéro invalide
  if (rows.length) {
    const contractNumbers = [...new Set(rows.map((r) => r.contract_number))];
    await query(
      `UPDATE socadel_invoice_retry_queue
       SET status = 'failed',
           last_error = $1,
           last_attempt_at = NOW(),
           updated_at = NOW()
       WHERE contract_number = ANY($2::text[])
         AND status IN ('pending', 'processing')`,
      [failedDetail, contractNumbers]
    ).catch((e) => logger.warn('[SOCADEL-FAIL] retry queue:', e.message));
  }

  return { marked: rows.length };
}

module.exports = {
  confirmSocadelSubscriptionFromDelivery,
  markSocadelInvoiceFailed
};
