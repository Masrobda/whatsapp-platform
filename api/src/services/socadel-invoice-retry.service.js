'use strict';

const { query } = require('../config/database');
const logger = require('../utils/logger');
const { sendLastInvoiceAfterRegister } = require('./socadel-invoice-send.service');

const BATCH = parseInt(process.env.SOCADEL_INVOICE_RETRY_BATCH || '40', 10);
const MAX_ATTEMPTS = parseInt(process.env.SOCADEL_INVOICE_RETRY_MAX || '5', 10);

/**
 * Garantit :
 *  1) la présence de la ligne dans `contracts` (FK de whatsapp_valid_contacts)
 *  2) l'existence de whatsapp_valid_contacts pour ce contrat
 *  3) l'ajout du téléphone dans whatsapp_contact_phones (primaire)
 * Idempotent : peut être appelé plusieurs fois sans effet de bord.
 */
async function ensureContractAndValidContact(contractNumber, phone) {
  // Nom client (fallback 'Client' si rien en base)
  const n = await query(
    `SELECT noms FROM socadel_contacts
     WHERE service_no = $1 AND noms IS NOT NULL AND noms <> ''
     LIMIT 1`,
    [contractNumber]
  );
  const clientName = (n.rows[0]?.noms || 'Client').trim() || 'Client';

  // 1) Garantir la ligne dans contracts (FK)
  await query(
    `INSERT INTO contracts (contract_number, client_name)
     VALUES ($1, $2)
     ON CONFLICT (contract_number) DO NOTHING`,
    [contractNumber, clientName]
  );

  // 2) whatsapp_valid_contacts (upsert manuel pour rester compatible
  //    même si la table n'a pas de UNIQUE seul sur contract_number)
  const exists = await query(
    `SELECT 1 FROM whatsapp_valid_contacts WHERE contract_number = $1 LIMIT 1`,
    [contractNumber]
  );

  if (!exists.rows.length) {
    await query(
      `INSERT INTO whatsapp_valid_contacts
         (contract_number, client_name, whatsapp_phone, activated_at)
       VALUES ($1, $2, $3, NOW())`,
      [contractNumber, clientName, phone]
    );
  }

  // 3) Téléphone primaire (best effort — pas bloquant)
  await query(
    `INSERT INTO whatsapp_contact_phones
       (contract_number, whatsapp_phone, source, is_primary, collected_by_type)
     VALUES ($1, $2, 'invoice_retry', true, 'system')
     ON CONFLICT (contract_number, whatsapp_phone) DO NOTHING`,
    [contractNumber, phone]
  ).catch(() => {});

  return { ok: true, clientName };
}

/**
 * Alimente la file : check OK + téléphone + NON ABONNE
 * - Retente : jamais envoyé OU failed OU pending bloqué (quota/ancien)
 * - Skip : déjà pending/processing en queue
 */
async function enqueueMissingInvoices() {
  // Pas la peine d'alimenter la queue si on ne va pas envoyer
  if (process.env.SOCADEL_INVOICE_AUTO_DISABLED !== '0') {
    logger.info('[INVOICE-RETRY] Auto-send désactivé — enqueue skip');
    return { enqueued: 0 };
  }

  const res = await query(
    `
    WITH invalid_phones AS (
      SELECT DISTINCT
        regexp_replace(COALESCE(phone, ''), '[^0-9]', '', 'g') AS p
      FROM whatsapp_invalid_contacts
      WHERE checked_at > NOW() - INTERVAL '180 days'
    )
    INSERT INTO socadel_invoice_retry_queue
      (contact_id, contract_number, recipient_phone, status, max_attempts)
    SELECT DISTINCT ON (sc.service_no, sc.numero_telephone)
      sc.id,
      sc.service_no,
      sc.numero_telephone,
      'pending',
      $1::int
    FROM socadel_contacts sc
    WHERE sc.check_status = 'OK'
      AND sc.numero_telephone IS NOT NULL
      AND length(regexp_replace(sc.numero_telephone, '[^0-9]', '', 'g')) >= 9
      AND (sc.statut IS DISTINCT FROM 'ABONNE')
      AND UPPER(COALESCE(sc.rapport, 'MRA')) = 'MRA'

      -- Ne pas retraiter si déjà en queue active
      AND NOT EXISTS (
        SELECT 1 FROM socadel_invoice_retry_queue q
        WHERE q.contract_number = sc.service_no
          AND q.recipient_phone = sc.numero_telephone
          AND q.status IN ('pending', 'processing')
      )

      -- Exclut les numéros vérifiés invalides
      AND regexp_replace(sc.numero_telephone, '[^0-9]', '', 'g')
          NOT IN (SELECT p FROM invalid_phones)

      -- ⭐ NOUVELLE LOGIQUE : 
      --   ✅ Jamais envoyé (aucune ligne socadel_invoice_pending)
      --   ✅ OU déjà 'pending' dans pending (en attente d'envoi)
      --   ❌ PAS de retry si 'sent' (attente Meta)
      --   ❌ PAS de retry si 'failed' (déjà KO)
      AND (
        NOT EXISTS (
          SELECT 1 FROM socadel_invoice_pending p
          WHERE p.contract_number = sc.service_no
        )
        OR
        EXISTS (
          SELECT 1 FROM socadel_invoice_pending p
          WHERE p.contract_number = sc.service_no
            AND p.status = 'pending'
        )
      )
    ORDER BY sc.service_no, sc.numero_telephone, sc.check_date DESC NULLS LAST
    ON CONFLICT DO NOTHING
    RETURNING id
    `,
    [MAX_ATTEMPTS]
  );

  logger.info(`[INVOICE-RETRY] Enqueued ${res.rowCount} candidates (pending + jamais envoyés uniquement)`);
  return { enqueued: res.rowCount };
}

/**
 * Traite un lot : envoi facture + si succès → valid contacts + pending socadel
 */
async function processRetryBatch() {
 
// ═══════════════════════════════════════════════════════════
  // SKIP GLOBAL : pas d'envoi pendant le cycle de vérification
  // ═══════════════════════════════════════════════════════════
  if (process.env.SOCADEL_INVOICE_AUTO_DISABLED !== '0') {
    logger.info('[INVOICE-RETRY] Auto-send désactivé — batch skip');
    return { processed: 0, sent: 0, failed: 0, deferred_by_disabled: true };
  }

// ── 0) Vérif quota global AVANT de tirer un lot ──
  const { canSendToday } = require('./wa-daily-limit.service');
  const channel = require('./socadel-invoice-send.service').getQuickRegisterInvoiceChannel();
  const slot = await canSendToday(channel);

  if (!slot.ok) {
    logger.info(
      `[INVOICE-RETRY] Quota atteint (${slot.used}/${slot.limit}) — lot reporté`
    );
    return { processed: 0, sent: 0, failed: 0, deferred_by_quota: true };
  }

  // Reset auto des processing zombies (process tué, WATI hang…)
  await query(
    `UPDATE socadel_invoice_retry_queue
     SET status = 'pending', updated_at = NOW()
     WHERE status = 'processing'
       AND updated_at < NOW() - INTERVAL '15 minutes'`
  );

 const batch = await query(
    `
    UPDATE socadel_invoice_retry_queue q
    SET status = 'processing', updated_at = NOW()
    WHERE q.id IN (
      SELECT id FROM socadel_invoice_retry_queue
      WHERE status = 'pending'
        AND attempts < max_attempts
      ORDER BY created_at ASC
      LIMIT $1::int
      FOR UPDATE SKIP LOCKED
    )
    RETURNING *
    `,
    [BATCH]
  );

  let sent = 0;
  let failed = 0;

  for (const row of batch.rows) {
    try {
      const result = await sendLastInvoiceAfterRegister({
        contractNumber: row.contract_number,
        recipientPhone: row.recipient_phone,
        collector: { type: 'system', id: null, label: 'invoice-retry' },
      });

      // ── Quota journalier atteint → report sans brûler les tentatives ──
      if (result?.deferred) {
        await query(
          `UPDATE socadel_invoice_retry_queue
           SET status = 'pending',
               last_error = $2,
               last_attempt_at = NOW(),
               updated_at = NOW()
               -- attempts NON incrémenté
           WHERE id = $1`,
          [row.id, result.message || 'Quota journalier — reporté']
        );
        continue;
      }

      if (result?.success) {
        // La file passe en 'sent' même si l'insert contact a logué un warning
        // (la facture est déjà partie — on ne veut pas réessayer en boucle)
        await query(
          `UPDATE socadel_invoice_retry_queue
           SET status = 'sent', sent_at = NOW(), attempts = attempts + 1,
               last_attempt_at = NOW(), updated_at = NOW(), last_error = NULL
           WHERE id = $1`,
          [row.id]
        );
        sent++;
      } else {
        const attempts = row.attempts + 1;
        const status = attempts >= row.max_attempts ? 'failed' : 'pending';
        await query(
          `UPDATE socadel_invoice_retry_queue
           SET status = $2, attempts = $3, last_error = $4,
               last_attempt_at = NOW(), updated_at = NOW()
           WHERE id = $1`,
          [row.id, status, attempts, result?.message || 'send failed']
        );
        failed++;
      }
    } catch (err) {
      const attempts = row.attempts + 1;
      const status = attempts >= row.max_attempts ? 'failed' : 'pending';
      await query(
        `UPDATE socadel_invoice_retry_queue
         SET status = $2, attempts = $3, last_error = $4,
             last_attempt_at = NOW(), updated_at = NOW()
         WHERE id = $1`,
        [row.id, status, attempts, err.message]
      );
      failed++;
      logger.error(`[INVOICE-RETRY] ${row.contract_number}: ${err.message}`);
    }
  }

  logger.info(
    `[INVOICE-RETRY] batch processed=${batch.rows.length} sent=${sent} failed=${failed}`
  );
  return { processed: batch.rows.length, sent, failed };
}

async function runInvoiceRetryJob() {
  const enq = await enqueueMissingInvoices();

  // Traite jusqu'à 25 batches par tick (25 × 100 = 2500 contrats)
  const MAX_BATCHES = parseInt(
    process.env.SOCADEL_INVOICE_RETRY_MAX_BATCHES || '25',
    10
  );

  let total = { processed: 0, sent: 0, failed: 0, deferred_by_quota: false };

  for (let i = 0; i < MAX_BATCHES; i++) {
    const proc = await processRetryBatch();

    total.processed += proc.processed;
    total.sent      += proc.sent;
    total.failed    += proc.failed;

    if (proc.deferred_by_disabled) {
      total.deferred_by_disabled = true;
      logger.info(`[INVOICE-RETRY] Auto-send désactivé — arrêt immédiat`);
      break;
    }

    if (proc.deferred_by_quota) {
      total.deferred_by_quota = true;
      logger.info(`[INVOICE-RETRY] Quota atteint après ${i + 1} batches`);
      break;
    }

    if (proc.processed === 0) break;

    // Petite pause pour ne pas saturer WATI
    await new Promise((r) => setTimeout(r, 200));
  }

  logger.info(
    `[INVOICE-RETRY] RUN TERMINÉ enq=${enq.enqueued} processed=${total.processed} sent=${total.sent} failed=${total.failed} quota=${total.deferred_by_quota}`
  );

  return { ...enq, ...total };
}

module.exports = {
  enqueueMissingInvoices,
  processRetryBatch,
  runInvoiceRetryJob,
  ensureContractAndValidContact,
};
