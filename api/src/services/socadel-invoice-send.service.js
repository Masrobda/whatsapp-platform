// api/src/services/socadel-invoice-send.service.js
'use strict';

const { query } = require('../config/database');
const logger = require('../utils/logger');

const CHATBOT_CLIENT_ID =
  process.env.CHATBOT_CLIENT_ID || 'ccd14b70-aa49-4906-8abc-5ff097e16107';

/**
 * Numéros utilisés pour l'envoi de dernière facture après quick-register.
 * Priorité :
 *   1) SOCADEL_QUICK_REGISTER_INVOICE_NUMBERS  (liste, virgules)
 *   2) SOCADEL_QUICK_REGISTER_INVOICE_NUMBER   (un seul)
 *   3) défaut +237688356291
 *
 * Si plusieurs numéros : on prend le premier (round-robin possible plus tard).
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

  const pendingIns = await query(
    `INSERT INTO socadel_invoice_pending
       (contract_number, recipient_phone, channel, collected_by_type, collected_by_id, status)
     VALUES ($1, $2, 'whatsapp', $3, $4, 'pending')
     RETURNING id`,
    [
      contractNumber,
      recipientPhone,
      collector.type || null,
      collector.id || null,
    ]
  );
  const pendingId = pendingIns.rows[0]?.id;

  // Canal dédié quick-register (pas le numéro chatbot générique)
  const botNumber = getQuickRegisterInvoiceChannel();

  try {
    const lastInvoiceService = require('./last-invoice.service');
    const result = await lastInvoiceService.requestLastInvoice(
      contractNumber,
      recipientPhone,
      botNumber,
      language,
      'quick_register' // source audit invoice_send_logs
    );

    if (result?.success) {
      const messageId = result.messageId || result.message_id || null;
      const watiLocalId =
        result.localMessageId ||
        result.wati_local_id ||
        result.watiMessageId ||
        null;

      await query(
        `UPDATE socadel_invoice_pending
         SET status = 'sent',
             message_id = COALESCE($2, message_id),
             wati_local_id = COALESCE($3, wati_local_id)
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

    await query(
      `UPDATE socadel_invoice_pending SET status = 'failed' WHERE id = $1`,
      [pendingId]
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
    logger.error(`[SOCADEL-INVOICE] Erreur contrat=${contractNumber}:`, err.message);
    if (pendingId) {
      await query(
        `UPDATE socadel_invoice_pending SET status = 'failed' WHERE id = $1`,
        [pendingId]
      ).catch(() => {});
    }
    return { success: false, pendingId, message: err.message };
  }
}

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
