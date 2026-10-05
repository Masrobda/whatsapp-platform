// api/src/services/socadel-invoice-send.service.js
'use strict';

const { query } = require('../config/database');
const logger = require('../utils/logger');
const {
  canSendToday,
  recordSuccessfulSend,
} = require('./wa-daily-limit.service');

const CHATBOT_CLIENT_ID =
  process.env.CHATBOT_CLIENT_ID || 'ccd14b70-aa49-4906-8abc-5ff097e16107';

/**
 * Numéros utilisés pour l'envoi de dernière facture après quick-register.
 * Priorité :
 *   1) SOCADEL_QUICK_REGISTER_INVOICE_NUMBERS  (liste, virgules)
 *   2) SOCADEL_QUICK_REGISTER_INVOICE_NUMBER   (un seul)
 *   3) défaut +237688356291
 */
function getQuickRegisterInvoiceChannel() {
  const list = (
    process.env.SOCADEL_QUICK_REGISTER_INVOICE_NUMBERS ||
    process.env.SOCADEL_QUICK_REGISTER_INVOICE_NUMBER ||
    '+237688356291'
  )
    .split(',')
    .map((n) => n.trim())
    .filter(Boolean)
    .map((n) => (n.startsWith('+') ? n : `+${n}`));
  return list[0] || '+237688356291';
}

/**
 * Envoie la dernière facture pour un contrat et enregistre le pending
 * pour flag ABONNE au delivered/read.
 *
 * - UPSERT atomique : 1 seule ligne par contrat
 * - Ne renvoie PAS si déjà delivered ou read
 * - Quota journalier : lecture seule avant envoi, INCR uniquement après succès WATI
 */
async function sendLastInvoiceAfterRegister({
  contractNumber,
  recipientPhone,
  collector = {},
  clientId = CHATBOT_CLIENT_ID,
  language = 'fr',
}) {
  if (!contractNumber || !recipientPhone) {
    return { success: false, message: 'contractNumber et recipientPhone requis' };
  }

  // ── 1) Déjà livrée / lue → pas de renvoi ──
  const existing = await query(
    `SELECT id, status, updated_at, created_at
     FROM socadel_invoice_pending
     WHERE contract_number = $1
     LIMIT 1`,
    [contractNumber]
  );
  const current = existing.rows[0];

  // Skip si déjà livré/lu, OU si déjà envoyé récemment (< 24h)
const DELIVERED = ['delivered', 'read'];
  const isDelivered = current && DELIVERED.includes(current.status);

  const lastTouch = current?.updated_at || current?.created_at;
  const isRecentlySent =
    current &&
    current.status === 'sent' &&
    lastTouch &&
    (Date.now() - new Date(lastTouch).getTime()) < 24 * 3600 * 1000;

  if (isDelivered || isRecentlySent) {
    logger.info(
      `[SOCADEL-INVOICE] Skip contract=${contractNumber} status=${current.status} (${isRecentlySent ? 'sent <24h' : 'déjà livré'})`
    );
    return {
      success: true,
      alreadySent: true,
      message: isDelivered
        ? `Facture déjà ${current.status}`
        : 'Facture envoyée il y a moins de 24h',
      pendingId: current.id,
    };
  }

  // ── 2) UPSERT atomique ──
  const pendingIns = await query(
    `INSERT INTO socadel_invoice_pending
       (contract_number, recipient_phone, channel, collected_by_type, collected_by_id, status)
     VALUES ($1, $2, 'whatsapp', $3, $4, 'pending')
     ON CONFLICT (contract_number) DO UPDATE
       SET recipient_phone   = EXCLUDED.recipient_phone,
           channel           = EXCLUDED.channel,
           collected_by_type = EXCLUDED.collected_by_type,
           collected_by_id   = EXCLUDED.collected_by_id,
           status            = 'pending',
           wati_local_id     = NULL,
           message_id        = NULL,
           confirmed_at      = NULL,
           failed_at         = NULL,
           last_error        = NULL,
           created_at        = NOW(),
           updated_at        = NOW()
     RETURNING id`,
    [
      contractNumber,
      recipientPhone,
      collector.type || null,
      collector.id || null,
    ]
  );
  const pendingId = pendingIns.rows[0]?.id;

  const botNumber = getQuickRegisterInvoiceChannel();

  // ── 3) Quota jour (lecture Redis uniquement — pas d'INCR ici) ──
  const slot = await canSendToday(botNumber);
  if (!slot.ok) {
    await query(
      `UPDATE socadel_invoice_pending
       SET status = 'pending',
           last_error = $2,
           updated_at = NOW()
       WHERE id = $1`,
      [
        pendingId,
        `Quota journalier atteint (${slot.limit}/j) — reporté`,
      ]
    );
    logger.info(
      `[SOCADEL-INVOICE] LIMIT ${botNumber} ${slot.limit}/j — report contrat=${contractNumber}`
    );
    return {
      success: false,
      deferred: true,
      pendingId,
      channelNumber: botNumber,
      message: `Limite journalière ${slot.limit} atteinte — envoi demain`,
    };
  }

  try {
    const lastInvoiceService = require('./last-invoice.service');
    const result = await lastInvoiceService.requestLastInvoice(
      contractNumber,
      recipientPhone,
      botNumber,
      language,
      'quick_register'
    );

    // ── Cas 1 : succès WATI ──
    if (result?.success) {
      // Compte 1 vrai succès (INCR Redis)
      await recordSuccessfulSend(botNumber);

      const messageId = result.messageId || result.message_id || null;
      const watiLocalId =
        result.localMessageId ||
        result.wati_local_id ||
        result.watiMessageId ||
        null;

      await query(
        `UPDATE socadel_invoice_pending
         SET status        = 'sent',
             message_id    = COALESCE($2, message_id),
             wati_local_id = COALESCE($3, wati_local_id),
             updated_at    = NOW()
         WHERE id = $1`,
        [pendingId, messageId, watiLocalId]
      );

      logger.info(
        `[SOCADEL-INVOICE] Facture envoyée contrat=${contractNumber} phone=${recipientPhone} via=${botNumber} pending=${pendingId}`
      );

      return {
        success: true,
        pendingId,
        messageId,
        watiLocalId,
        channelNumber: botNumber,
        alreadySent: !!result.alreadySent,
      };
    }

    // ── Cas 2 : échec WATI — PAS d'INCR ──
    await query(
      `UPDATE socadel_invoice_pending
       SET status     = 'failed',
           failed_at  = NOW(),
           last_error = COALESCE($2, last_error),
           updated_at = NOW()
       WHERE id = $1`,
      [pendingId, result?.message || 'Échec envoi facture']
    );

    logger.warn(
      `[SOCADEL-INVOICE] Échec envoi contrat=${contractNumber}: ${result?.message || 'inconnu'}`
    );

    return {
      success: false,
      pendingId,
      channelNumber: botNumber,
      message: result?.message || 'Échec envoi facture',
    };
  } catch (err) {
    // ── Cas 3 : exception — PAS d'INCR ──
    logger.error(`[SOCADEL-INVOICE] Erreur contrat=${contractNumber}:`, err.message);
    if (pendingId) {
      await query(
        `UPDATE socadel_invoice_pending
         SET status     = 'failed',
             failed_at  = NOW(),
             last_error = $2,
             updated_at = NOW()
         WHERE id = $1`,
        [pendingId, err.message]
      ).catch(() => {});
    }
    return { success: false, pendingId, message: err.message };
  }
}

/**
 * Envoie les dernières factures pour plusieurs contrats (Promise.allSettled).
 */
async function sendLastInvoicesForContracts({
  contracts,
  recipientPhone,
  collector,
  language = 'fr',
}) {
  const list = [...new Set((contracts || []).filter(Boolean))];
  if (!list.length || !recipientPhone) {
    return { results: [], sent: 0, failed: 0 };
  }

  const results = await Promise.allSettled(
    list.map((contractNumber) =>
      sendLastInvoiceAfterRegister({
        contractNumber,
        recipientPhone,
        collector,
        language,
      })
    )
  );

  const mapped = results.map((r, i) => ({
    contract: list[i],
    ...(r.status === 'fulfilled'
      ? r.value
      : { success: false, message: r.reason?.message || 'error' }),
  }));

  return {
    results: mapped,
    sent: mapped.filter((x) => x.success).length,
    failed: mapped.filter((x) => !x.success).length,
  };
}

module.exports = {
  sendLastInvoiceAfterRegister,
  sendLastInvoicesForContracts,
  getQuickRegisterInvoiceChannel,
};
