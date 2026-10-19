// api/src/services/last-invoice.service.js
'use strict';

const { query } = require('../config/database');
const watiService = require('./wati.service');
const logger = require('../utils/logger');

const TEMPLATE_FR =
  process.env.INVOICE_TEMPLATE_NAME || 'next_soc_tmp_bill_fr_01';
const TEMPLATE_EN =
  process.env.INVOICE_TEMPLATE_NAME_EN || 'next_soc_tmp_bill_en_02';

const MONTHS_FR = [
  'janvier', 'février', 'mars', 'avril', 'mai', 'juin',
  'juillet', 'août', 'septembre', 'octobre', 'novembre', 'décembre',
];
const MONTHS_EN = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
];

/**
 * Ex: date 2026-08-14 + fr → "août 2026"
 *     date 2026-08-14 + en → "August 2026"
 */
function formatInvoiceMonth(dateCreation, language) {
  if (!dateCreation) return language === 'en' ? '' : '';
  const d = new Date(dateCreation);
  if (Number.isNaN(d.getTime())) return '';

  const monthIndex = d.getUTCMonth(); // 0-11 (date_creation est en UTC en base)
  const year = d.getUTCFullYear();
  const isEn = String(language || 'fr').toLowerCase().startsWith('en');

  if (isEn) {
    return `${MONTHS_EN[monthIndex]} ${year}`;
  }
  // Français : "août 2026" (minuscule comme dans l'exemple client)
  return `${MONTHS_FR[monthIndex]} ${year}`;
}

function resolveInvoiceTemplate(language) {
  const lang = String(language || 'fr').toLowerCase().startsWith('en')
    ? 'en'
    : 'fr';
  return {
    templateName: lang === 'en' ? TEMPLATE_EN : TEMPLATE_FR,
    templateLang: lang,
  };
}

async function getLastInvoice(contractNumber) {
  console.log(`[INVOICE] Recherche facture pour contrat: ${contractNumber}`);
  try {
    const result = await query(
      `SELECT lien_pdf, date_creation, numero_facture, montant
       FROM invoices_bot
       WHERE numero_contrat = $1
       ORDER BY date_creation DESC
       LIMIT 1`,
      [contractNumber]
    );
    const rows = result.rows || [];
    if (rows.length > 0) {
      console.log(`[INVOICE] Lien PDF: ${rows[0].lien_pdf}`);
    }
    return rows.length ? rows[0] : null;
  } catch (err) {
    logger.error(`[INVOICE] Erreur getLastInvoice: ${err.message}`);
    return null;
  }
}

async function getClientName(contractNumber) {
  try {
    const result = await query(
      `SELECT client_name FROM contracts WHERE contract_number = $1`,
      [contractNumber]
    );
    if (result.rows?.length) return result.rows[0].client_name;

    const result2 = await query(
      `SELECT client_name FROM whatsapp_valid_contacts WHERE contract_number = $1 LIMIT 1`,
      [contractNumber]
    );
    return result2.rows?.length ? result2.rows[0].client_name : 'Client';
  } catch (err) {
    logger.error(`[INVOICE] Erreur getClientName: ${err.message}`);
    return 'Client';
  }
}

/**
 * @param {string} contractNumber
 * @param {string} recipientPhone
 * @param {string} [channelNumber]
 * @param {string} [language] 'fr' | 'en'
 * @param {string} [source] 'last_invoice' | 'chatbot' | 'shortcut_button' | 'quick_register' | ...
 */
async function requestLastInvoice(
  contractNumber,
  recipientPhone,
  channelNumber = '+237688359040',
  language = 'fr',
  source = 'last_invoice'
) {
  try {
    const invoice = await getLastInvoice(contractNumber);
    if (!invoice) {
      logger.warn(`[INVOICE] Aucune facture pour contrat ${contractNumber}`);
      return {
        success: false,
        alreadySent: false,
        message: 'Aucune facture disponible pour ce contrat.',
      };
    }

    const clientName = await getClientName(contractNumber);
    const { templateName, templateLang } = resolveInvoiceTemplate(language);
    const moisFacture = formatInvoiceMonth(invoice.date_creation, templateLang);

    // Variables alignées sur les templates WATI
    // {{1}} lien PDF
    // {{2}} nom client
    // {{3}} n° facture
    // {{4}} n° contrat
    // {{5}} montant
    // {{6}} mois (ex: "août 2026" / "August 2026")
    const params = {
      '1': invoice.lien_pdf,
      '2': clientName,
      '3': String(invoice.numero_facture ?? ''),
      '4': String(contractNumber),
      '5': String(invoice.montant ?? ''),
      '6': moisFacture,
    };

    logger.info(
      `[INVOICE] Template=${templateName} lang=${templateLang} mois="${moisFacture}" contrat=${contractNumber} → ${recipientPhone} (source=${source})`
    );

    // --- avant l'envoi : dernier envoi réussi connu (audit)
    let previous = null;
    try {
      const prevRes = await query(
        `SELECT sent_at, numero_facture
         FROM invoice_send_logs
         WHERE contract_number = $1
           AND recipient_phone = $2
           AND status = 'sent'
         ORDER BY sent_at DESC
         LIMIT 1`,
        [contractNumber, recipientPhone]
      );
      previous = prevRes.rows[0] || null;
    } catch (_) {}

    const sendResult = await watiService.sendTemplateMessage(
      recipientPhone,
      templateName,
      params,
      templateLang,
      channelNumber
    );

    try {
      await query(
        `INSERT INTO invoice_send_logs (
           contract_number, client_name, recipient_phone,
           numero_facture, montant, pdf_link, invoice_month,
           template_name, template_lang, channel_number,
           status, error_message,
           local_message_id, wati_message_id,
           source,
           previous_sent_at, previous_numero_facture,
           sent_at
         ) VALUES (
           $1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17, NOW()
         )`,
        [
          contractNumber,
          clientName,
          recipientPhone,
          invoice.numero_facture || null,
          invoice.montant != null ? String(invoice.montant) : null,
          invoice.lien_pdf || null,
          moisFacture || null,
          templateName,
          templateLang,
          channelNumber || null,
          sendResult.success ? 'sent' : 'failed',
          sendResult.error || null,
          sendResult.localMessageId || sendResult.local_message_id || null,
          sendResult.watiMessageId || sendResult.waMessageId || null,
          source,
          previous?.sent_at || null,
          previous?.numero_facture || null,
        ]
      );
    } catch (logErr) {
      logger.error(`[INVOICE] Erreur insertion log: ${logErr.message}`);
    }

    if (sendResult.success) {
      logger.info(
        `[INVOICE] Facture envoyée (${templateName}) à ${recipientPhone} pour ${contractNumber} (source=${source})`
      );
      return {
        success: true,
        alreadySent: false,
        message: 'Facture envoyée avec succès',
        templateName,
        templateLang,
        invoiceMonth: moisFacture,
        source,
        localMessageId:
          sendResult.localMessageId ||
          sendResult.local_message_id ||
          null,
        watiMessageId:
          sendResult.watiMessageId ||
          sendResult.waMessageId ||
          sendResult.whatsappMessageId ||
          null,
      };
    }

    logger.error(`[INVOICE] Échec envoi : ${sendResult.error}`);
    return {
      success: false,
      alreadySent: false,
      message: `Erreur d'envoi : ${sendResult.error}`,
    };
  } catch (error) {
    logger.error(`[INVOICE] Erreur pour ${contractNumber}:`, error.message);
    return {
      success: false,
      alreadySent: false,
      message: "Erreur technique lors de l'envoi de la facture",
    };
  }
}

module.exports = {
  requestLastInvoice,
  getLastInvoice,
  getClientName,
  resolveInvoiceTemplate,
  formatInvoiceMonth,
};
