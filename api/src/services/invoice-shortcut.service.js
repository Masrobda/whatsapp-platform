// api/src/services/invoice-shortcut.service.js
'use strict';

const { query } = require('../config/database');
const logger = require('../utils/logger');
const lastInvoiceService = require('./last-invoice.service');

const INVOICE_SHORTCUT_NUMBERS = (
  process.env.INVOICE_SHORTCUT_NUMBERS ||
  '+237689588347,+237688359040,+237688356291,+237697519248,+237688363526'
)
  .split(',')
  .map((n) => n.trim())
  .filter(Boolean)
  .map((n) => (n.startsWith('+') ? n : `+${n}`));

function normalizePhone(phone) {
  if (!phone) return '';
  let digits = String(phone).replace(/\D/g, '');
  if (digits.startsWith('237') && digits.length >= 12) return `+${digits}`;
  if (digits.length === 9) return `+237${digits}`;
  if (digits.length === 8) return `+2376${digits}`;
  if (String(phone).startsWith('+')) return `+${digits}`;
  return digits ? `+${digits}` : '';
}

function digitsOnly(p) {
  return String(p || '').replace(/\D/g, '');
}

function phoneVariants(phone) {
  const n = normalizePhone(phone);
  return [...new Set([phone, n, n.replace(/^\+/, ''), digitsOnly(n)].filter(Boolean))];
}

function isShortcutChannel(channelNumber) {
  const n = normalizePhone(channelNumber);
  return INVOICE_SHORTCUT_NUMBERS.some((x) => normalizePhone(x) === n);
}

function isReceiveInvoiceIntent(text) {
  const t = String(text || '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^\p{L}\p{N}\s]/gu, ' ')
    .replace(/\s+/g, ' ')
    .trim();
  if (!t) return false;
  const needles = [
    'recevoir ma facture',
    'recevoir ma derniere facture',
    'receive my bill',
    'receive my invoice',
    'receive my latest invoice',
  ];
  return needles.some((n) => t === n || t.includes(n));
}

/** Templates de notif avec bouton "Recevoir ma facture" */
function isInvoiceNotifyTemplate(templateName) {
  if (!templateName) return false;
  const list = (
    process.env.INVOICE_NOTIFY_TEMPLATES ||
    'next_simple_tmp_facture_fr_02'
  )
    .split(',')
    .map((s) => s.trim().toLowerCase())
    .filter(Boolean);
  return list.includes(String(templateName).toLowerCase());
}

/**
 * Extrait nom ({{1}}) et contrat ({{2}}) depuis params / ordered_values
 */
function extractContractAndName(templateParams, orderedValues) {
  let name = null;
  let contract = null;

  if (Array.isArray(orderedValues) && orderedValues.length >= 2) {
    name = orderedValues[0] != null ? String(orderedValues[0]) : null;
    contract = orderedValues[1] != null ? String(orderedValues[1]) : null;
  }

  const p = templateParams && typeof templateParams === 'object' ? templateParams : {};
  if (!name) name = p['1'] || p.name || p.nom || null;
  if (!contract) {
    contract = p['2'] || p.contract || p.contract_number || p.numero_contrat || null;
  }

  if (contract) contract = String(contract).trim();

  // Contrat Socadel type 20xxxxxxx — fallback si mal positionné
  if (contract && !/^20\d{7}$/.test(contract)) {
    if (Array.isArray(orderedValues)) {
      const found = orderedValues
        .map(String)
        .find((v) => /^20\d{7}$/.test(v.trim()));
      if (found) contract = found.trim();
    }
    if (!/^20\d{7}$/.test(contract || '')) {
      for (const v of Object.values(p)) {
        if (v != null && /^20\d{7}$/.test(String(v).trim())) {
          contract = String(v).trim();
          break;
        }
      }
    }
  }

  if (name) name = String(name).trim();
  return { name, contract };
}

/**
 * À appeler AU MOMENT de l'envoi du template avec bouton
 * ({{1}} nom, {{2}} contrat)
 */
async function registerInvoiceButtonContext({
  recipientPhone,
  contractNumber,
  clientName = null,
  channelNumber = null,
  templateName = null,
}) {
  const phone = normalizePhone(recipientPhone);
  const contract = String(contractNumber || '').trim();
  if (!phone || !contract) {
    throw new Error('recipientPhone et contractNumber requis');
  }

  let name = clientName;
  if (!name) {
    const r = await query(
      `SELECT client_name FROM contracts WHERE contract_number = $1 LIMIT 1`,
      [contract]
    );
    name = r.rows[0]?.client_name || 'Client';
  }

  await query(
    `INSERT INTO invoice_button_pending
       (recipient_phone, contract_number, client_name, channel_number, template_name)
     VALUES ($1, $2, $3, $4, $5)`,
    [
      phone,
      contract,
      name,
      channelNumber ? normalizePhone(channelNumber) : null,
      templateName,
    ]
  );

  logger.info(
    `[INVOICE-SHORTCUT] Contexte bouton enregistré ${phone} contrat=${contract}`
  );
  return { phone, contract, name };
}

/** Dernier contexte non consommé pour ce téléphone (72h) */
async function consumePendingContext(phone) {
  const variants = phoneVariants(phone);
  const res = await query(
    `UPDATE invoice_button_pending p
     SET consumed_at = NOW()
     WHERE p.id = (
       SELECT id FROM invoice_button_pending
       WHERE recipient_phone = ANY($1::text[])
         AND consumed_at IS NULL
         AND created_at > NOW() - INTERVAL '72 hours'
       ORDER BY created_at DESC
       LIMIT 1
       FOR UPDATE SKIP LOCKED
     )
     RETURNING *`,
    [variants]
  );
  return res.rows[0] || null;
}

async function ensureValidContact(contractNumber, clientName, phone) {
  const existing = await query(
    `SELECT whatsapp_phone FROM whatsapp_valid_contacts WHERE contract_number = $1`,
    [contractNumber]
  );

  if (existing.rows.length === 0) {
    await query(
      `INSERT INTO whatsapp_valid_contacts
         (contract_number, client_name, whatsapp_phone, activated_at)
       VALUES ($1, $2, $3, NOW())`,
      [contractNumber, clientName || 'Client', phone]
    );
    await query(
      `INSERT INTO whatsapp_contact_phones
         (contract_number, whatsapp_phone, source, is_primary, collected_by_type)
       VALUES ($1, $2, 'invoice_button', true, 'button')
       ON CONFLICT (contract_number, whatsapp_phone) DO NOTHING`,
      [contractNumber, phone]
    );
    return { created: true };
  }

  const same =
    normalizePhone(existing.rows[0].whatsapp_phone) === normalizePhone(phone);
  if (!same) {
    await query(
      `INSERT INTO whatsapp_contact_phones
         (contract_number, whatsapp_phone, source, is_primary, collected_by_type)
       VALUES ($1, $2, 'invoice_button', false, 'button')
       ON CONFLICT (contract_number, whatsapp_phone) DO NOTHING`,
      [contractNumber, phone]
    );
  }
  return { created: false };
}

/**
 * Clic bouton / texte "Recevoir ma facture"
 */
async function handleReceiveInvoiceShortcut({
  phone,
  text,
  channelNumber,
  language = 'fr',
}) {
  if (process.env.INVOICE_SHORTCUT_REQUIRE_CHANNEL !== '0') {
    if (!isShortcutChannel(channelNumber)) return { handled: false };
  }
  if (!isReceiveInvoiceIntent(text)) return { handled: false };

  const cleanPhone = normalizePhone(phone);

  let pending = await consumePendingContext(cleanPhone);

  let contractNumber = pending?.contract_number || null;
  let clientName = pending?.client_name || null;

  if (!contractNumber) {
    const linked = await query(
      `SELECT contract_number, client_name FROM whatsapp_valid_contacts
       WHERE whatsapp_phone = ANY($1::text[])
       ORDER BY activated_at DESC NULLS LAST
       LIMIT 1`,
      [phoneVariants(cleanPhone)]
    );
    if (linked.rows[0]) {
      contractNumber = linked.rows[0].contract_number;
      clientName = linked.rows[0].client_name;
    }
  }

  if (!contractNumber) {
    const reply =
      language === 'en'
        ? 'We could not find your contract for this request. Please contact 8010 or subscribe to digital invoice.'
        : "Nous n'avons pas pu retrouver votre contrat pour cette demande. Contactez le 8010 ou inscrivez-vous à la facture digitale.";
    return { handled: true, reply, sent: 0 };
  }

  if (!clientName) {
    const r = await query(
      `SELECT client_name FROM contracts WHERE contract_number = $1 LIMIT 1`,
      [contractNumber]
    );
    clientName = r.rows[0]?.client_name || 'Client';
  }

  await ensureValidContact(contractNumber, clientName, cleanPhone);

  const result = await lastInvoiceService.requestLastInvoice(
    contractNumber,
    cleanPhone,
    channelNumber,
    language
  );

  const sent = result?.success ? 1 : 0;
  const reply =
    language === 'en'
      ? sent
        ? 'Thank you. Your latest invoice is being sent.'
        : 'Unable to send the invoice right now. Please try again later or contact 8010.'
      : sent
        ? "Merci. Votre dernière facture est en cours d'envoi."
        : 'Impossible d\'envoyer la facture pour le moment. Réessayez plus tard ou contactez le 8010.';

  logger.info(
    `[INVOICE-SHORTCUT] ${cleanPhone} contrat=${contractNumber} sent=${sent} pending=${!!pending}`
  );

  return {
    handled: true,
    reply,
    sent,
    contractNumber,
    clientName,
  };
}

module.exports = {
  INVOICE_SHORTCUT_NUMBERS,
  isShortcutChannel,
  isReceiveInvoiceIntent,
  isInvoiceNotifyTemplate,
  extractContractAndName,
  registerInvoiceButtonContext,
  handleReceiveInvoiceShortcut,
  normalizePhone,
};
