'use strict';

const { query } = require('../config/database');
const logger = require('../utils/logger');
const { sendLastInvoiceAfterRegister } = require('./socadel-invoice-send.service');

const BATCH = parseInt(process.env.SOCADEL_INVOICE_RETRY_BATCH || '40', 10);
const MAX_ATTEMPTS = parseInt(process.env.SOCADEL_INVOICE_RETRY_MAX || '5', 10);

/**
 * Alimente la file : check OK + téléphone + NON ABONNE
 * (et pas déjà ABONNE dans whatsapp_valid_contacts)
 */
async function enqueueMissingInvoices() {
  const res = await query(
    `
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
      AND NOT EXISTS (
        SELECT 1 FROM whatsapp_valid_contacts w
        WHERE w.contract_number = sc.service_no
          AND regexp_replace(w.whatsapp_phone, '[^0-9]', '', 'g')
            = regexp_replace(sc.numero_telephone, '[^0-9]', '', 'g')
      )
      AND NOT EXISTS (
        SELECT 1 FROM socadel_invoice_retry_queue q
        WHERE q.contract_number = sc.service_no
          AND q.recipient_phone = sc.numero_telephone
          AND q.status IN ('pending', 'processing', 'sent')
      )
    ORDER BY sc.service_no, sc.numero_telephone, sc.check_date DESC NULLS LAST
    ON CONFLICT DO NOTHING
    RETURNING id
    `,
    [MAX_ATTEMPTS]
  );

  logger.info(`[INVOICE-RETRY] Enqueued ${res.rowCount} candidates`);
  return { enqueued: res.rowCount };
}

/**
 * Traite un lot : envoi facture + si succès → valid contacts + pending socadel
 */
async function processRetryBatch() {
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

      if (result?.success) {
        // Contact validé immédiatement (en plus du webhook ABONNE au delivered)
        // ─── FIX : cast explicite ::text sur tous les $1 ───
        await query(
          `
          INSERT INTO whatsapp_valid_contacts
            (contract_number, client_name, whatsapp_phone, activated_at)
          SELECT
            $1::text,
            COALESCE(
              (SELECT noms FROM socadel_contacts WHERE service_no = $1::text LIMIT 1),
              (SELECT client_name FROM contracts WHERE contract_number = $1::text LIMIT 1),
              'Client'
            ),
            $2::text,
            NOW()
          ON CONFLICT (contract_number) DO UPDATE SET
            whatsapp_phone = EXCLUDED.whatsapp_phone,
            activated_at = COALESCE(whatsapp_valid_contacts.activated_at, NOW())
          `,
          [row.contract_number, row.recipient_phone]
        ).catch(async () => {
          // Si pas de UNIQUE seul sur contract_number : upsert manuel
          const exists = await query(
            `SELECT 1 FROM whatsapp_valid_contacts WHERE contract_number = $1::text LIMIT 1`,
            [row.contract_number]
          );
          if (!exists.rows.length) {
            // ─── FIX ici aussi ───
            await query(
              `INSERT INTO whatsapp_valid_contacts
                 (contract_number, client_name, whatsapp_phone, activated_at)
               VALUES (
                 $1::text,
                 COALESCE(
                   (SELECT noms FROM socadel_contacts WHERE service_no = $1::text LIMIT 1),
                   'Client'
                 ),
                 $2::text,
                 NOW()
               )`,
              [row.contract_number, row.recipient_phone]
            );
          }
        });

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

  logger.info(`[INVOICE-RETRY] batch processed=${batch.rows.length} sent=${sent} failed=${failed}`);
  return { processed: batch.rows.length, sent, failed };
}

async function runInvoiceRetryJob() {
  const enq = await enqueueMissingInvoices();
  const proc = await processRetryBatch();
  return { ...enq, ...proc };
}

module.exports = {
  enqueueMissingInvoices,
  processRetryBatch,
  runInvoiceRetryJob,
};
