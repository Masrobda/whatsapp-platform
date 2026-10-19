// src/services/last-invoice.service.js
const { query } = require('../config/database');
const watiService = require('./wati.service');
const logger = require('../utils/logger');

/**
 * Récupère la dernière facture pour un contrat depuis la table invoices_bot
 */
async function getLastInvoice(contractNumber) {
  console.log(`[INVOICE] Recherche facture pour contrat: ${contractNumber}`);
  try {
    const result = await query(
      `SELECT lien_pdf, date_creation
       FROM invoices_bot
       WHERE numero_contrat = $1
       ORDER BY date_creation DESC
       LIMIT 1`,
      [contractNumber]
    );
    const rows = result.rows || [];
    console.log(`[INVOICE] Lignes trouvées: ${rows.length}`);
    if (rows.length > 0) {
      console.log(`[INVOICE] Lien PDF: ${rows[0].lien_pdf}`);
    }
    return rows.length ? rows[0] : null;
  } catch (err) {
    logger.error(`[INVOICE] Erreur getLastInvoice: ${err.message}`);
    return null;
  }
}

/**
 * Récupère le nom du client depuis la table contracts ou whatsapp_valid_contacts
 */
async function getClientName(contractNumber) {
  try {
    const result = await query(
      `SELECT client_name FROM contracts WHERE contract_number = $1`,
      [contractNumber]
    );
    const rows = result.rows || [];
    if (rows.length) return rows[0].client_name;

    const result2 = await query(
      `SELECT client_name FROM whatsapp_valid_contacts WHERE contract_number = $1 LIMIT 1`,
      [contractNumber]
    );
    const rows2 = result2.rows || [];
    return rows2.length ? rows2[0].client_name : 'Client';
  } catch (err) {
    logger.error(`[INVOICE] Erreur getClientName: ${err.message}`);
    return 'Client';
  }
}

/**
 * Envoie la dernière facture au client et loggue l’envoi
 */
async function requestLastInvoice(contractNumber, recipientPhone, channelNumber = '+237688359040') {
  try {
    // 1. Récupérer la facture
    const invoice = await getLastInvoice(contractNumber);
    if (!invoice) {
      logger.warn(`[INVOICE] Aucune facture trouvée pour contrat ${contractNumber}`);
      return {
        success: false,
        alreadySent: false,
        message: 'Aucune facture disponible pour ce contrat.'
      };
    }

    // 2. Récupérer le nom du client
    const clientName = await getClientName(contractNumber);

    // 3. Envoyer le message via WATI
    const templateName = process.env.INVOICE_TEMPLATE_NAME || 'next_soc_chat_fact01_v1';
    const templateLang = process.env.INVOICE_TEMPLATE_LANG || 'fr';

    const params = {
      "1": invoice.lien_pdf,
      "2": clientName
    };

    const sendResult = await watiService.sendTemplateMessage(
      recipientPhone,
      templateName,
      params,
      templateLang,
      channelNumber
    );

    // 4. LOGGER l’envoi dans invoice_send_logs (avec gestion d’erreur)
    try {
      await query(
        `INSERT INTO invoice_send_logs
         (contract_number, recipient_phone, pdf_link, template_name, status, error_message)
         VALUES ($1, $2, $3, $4, $5, $6)`,
        [
          contractNumber,
          recipientPhone,
          invoice.lien_pdf,
          templateName,
          sendResult.success ? 'sent' : 'failed',
          sendResult.error || null
        ]
      );
      console.log(`[INVOICE] Log inséré pour contrat ${contractNumber} (${sendResult.success ? 'sent' : 'failed'})`);
    } catch (logErr) {
      // L’échec du log ne doit pas bloquer le flux principal
      logger.error(`[INVOICE] Erreur insertion log: ${logErr.message}`);
      console.error(`[INVOICE] Erreur insertion log: ${logErr.message}`);
    }

    // 5. Retourner le résultat
    if (sendResult.success) {
      logger.info(`[INVOICE] Facture envoyée à ${recipientPhone} pour contrat ${contractNumber}`);
      return {
        success: true,
        alreadySent: false,
        message: 'Facture envoyée avec succès'
      };
    } else {
      logger.error(`[INVOICE] Échec envoi : ${sendResult.error}`);
      return {
        success: false,
        alreadySent: false,
        message: `Erreur d'envoi : ${sendResult.error}`
      };
    }
  } catch (error) {
    logger.error(`[INVOICE] Erreur pour ${contractNumber}:`, error.message);
    return {
      success: false,
      alreadySent: false,
      message: 'Erreur technique lors de l\'envoi de la facture'
    };
  }
}

module.exports = { requestLastInvoice };
