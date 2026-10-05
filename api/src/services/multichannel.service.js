// src/services/multichannel.service.js
// Multi-canal : SMS (Orange CM, MTN CM, Africa's Talking) + Email (SendGrid, Brevo)
const { query, getClient } = require('../config/database');
const { v4: uuidv4 } = require('uuid');
const logger = require('../utils/logger');

// ============================================================
// SMS PROVIDERS
// ============================================================

class SMSProvider {
  constructor(config) { this.config = config; }

  async send(phone, message) { throw new Error('Not implemented'); }

  cleanPhone(phone) {
    let clean = phone.toString().replace(/\s/g, '').replace(/[^\d+]/g, '');
    if (!clean.startsWith('+')) clean = `+${clean}`;
    return clean;
  }
}

/**
 * Africa's Talking (supporte Cameroun, Nigeria, Kenya, etc.)
 */
class AfricasTalkingProvider extends SMSProvider {
  async send(phone, message) {
    const { username, apiKey, senderId } = this.config;
    const cleanPhone = this.cleanPhone(phone);

    const body = new URLSearchParams({
      username,
      to: cleanPhone,
      message,
      ...(senderId ? { from: senderId } : {})
    });

    const res = await fetch('https://api.africastalking.com/version1/messaging', {
      method: 'POST',
      headers: {
        'apiKey': apiKey,
        'Content-Type': 'application/x-www-form-urlencoded',
        'Accept': 'application/json'
      },
      body: body.toString()
    });

    const data = await res.json();
    const recipient = data.SMSMessageData?.Recipients?.[0];

    if (!res.ok || recipient?.status !== 'Success') {
      throw new Error(recipient?.status || data.SMSMessageData?.Message || 'Erreur Africa\'s Talking');
    }

    return {
      success: true,
      messageId: recipient.messageId,
      status: 'sent',
      cost: recipient.cost || '0',
      provider: 'africas_talking'
    };
  }
}

/**
 * Nexah (opérateur Cameroun)
 */
class NexahProvider extends SMSProvider {
  async send(phone, message) {
    const { apiKey, clientId, senderId } = this.config;
    const cleanPhone = this.cleanPhone(phone).replace('+', '');

    const res = await fetch('https://api.nexah.net/v1/sms', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${apiKey}` },
      body: JSON.stringify({
        clientid: clientId,
        apikey: apiKey,
        phone: cleanPhone,
        sms: message,
        senderid: senderId || 'NumExp',
        type: 1
      })
    });

    const data = await res.json();
    if (!res.ok || data.code !== '200') {
      throw new Error(data.message || `Erreur Nexah: ${res.status}`);
    }
    return { success: true, messageId: data.messageid, status: 'sent', provider: 'nexah' };
  }
}

/**
 * Twilio (international)
 */
class TwilioProvider extends SMSProvider {
  async send(phone, message) {
    const { accountSid, authToken, fromNumber } = this.config;
    const cleanPhone = this.cleanPhone(phone);
    const auth = Buffer.from(`${accountSid}:${authToken}`).toString('base64');

    const body = new URLSearchParams({ To: cleanPhone, From: fromNumber, Body: message });

    const res = await fetch(`https://api.twilio.com/2010-04-01/Accounts/${accountSid}/Messages.json`, {
      method: 'POST',
      headers: { 'Authorization': `Basic ${auth}`, 'Content-Type': 'application/x-www-form-urlencoded' },
      body: body.toString()
    });

    const data = await res.json();
    if (!res.ok || data.status === 'failed') {
      throw new Error(data.message || 'Erreur Twilio');
    }
    return { success: true, messageId: data.sid, status: data.status, provider: 'twilio' };
  }
}

// ============================================================
// EMAIL PROVIDERS
// ============================================================

class EmailProvider {
  constructor(config) { this.config = config; }
  async send(to, subject, htmlContent, textContent, options = {}) { throw new Error('Not implemented'); }
}

/**
 * Brevo (ex-Sendinblue) — très utilisé en Afrique francophone
 */
class BrevoProvider extends EmailProvider {
  async send(to, subject, htmlContent, textContent, options = {}) {
    const { apiKey, fromEmail, fromName, replyTo } = this.config;

    const payload = {
      sender: { email: fromEmail, name: fromName || 'NumericExport' },
      to: [{ email: to, name: options.recipientName || to }],
      subject,
      htmlContent: htmlContent || `<p>${textContent}</p>`,
      textContent: textContent || '',
      ...(replyTo ? { replyTo: { email: replyTo } } : {}),
      ...(options.attachments ? { attachment: options.attachments } : {})
    };

    const res = await fetch('https://api.brevo.com/v3/smtp/email', {
      method: 'POST',
      headers: { 'api-key': apiKey, 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });

    const data = await res.json();
    if (!res.ok) throw new Error(data.message || `Erreur Brevo: ${res.status}`);

    return { success: true, messageId: data.messageId, status: 'sent', provider: 'brevo' };
  }
}

/**
 * SendGrid
 */
class SendGridProvider extends EmailProvider {
  async send(to, subject, htmlContent, textContent, options = {}) {
    const { apiKey, fromEmail, fromName } = this.config;

    const payload = {
      personalizations: [{ to: [{ email: to, name: options.recipientName }] }],
      from: { email: fromEmail, name: fromName || 'NumericExport' },
      subject,
      content: [
        { type: 'text/plain', value: textContent || '' },
        { type: 'text/html', value: htmlContent || `<p>${textContent}</p>` }
      ]
    };

    const res = await fetch('https://api.sendgrid.com/v3/mail/send', {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });

    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.errors?.[0]?.message || `Erreur SendGrid: ${res.status}`);
    }

    return { success: true, messageId: res.headers.get('x-message-id'), status: 'sent', provider: 'sendgrid' };
  }
}

/**
 * SMTP générique (Mailtrap, Gmail SMTP, etc.)
 */
class SMTPProvider extends EmailProvider {
  async send(to, subject, htmlContent, textContent, options = {}) {
    // Nécessite nodemailer — vérifier l'installation
    let nodemailer;
    try { nodemailer = require('nodemailer'); } catch {
      throw new Error('nodemailer non installé: npm install nodemailer');
    }

    const { host, port, user, password, fromEmail, fromName, secure = true } = this.config;
    const transporter = nodemailer.createTransport({ host, port, secure, auth: { user, pass: password } });

    const info = await transporter.sendMail({
      from: `"${fromName || 'NumericExport'}" <${fromEmail || user}>`,
      to, subject,
      text: textContent || '',
      html: htmlContent || `<p>${textContent}</p>`
    });

    return { success: true, messageId: info.messageId, status: 'sent', provider: 'smtp' };
  }
}

// ============================================================
// FACTORY
// ============================================================

function createSMSProvider(providerName, config) {
  const decoded = {};
  for (const [k, v] of Object.entries(config)) {
    try { decoded[k] = v; } catch { decoded[k] = v; }
  }
  switch (providerName) {
    case 'africas_talking': return new AfricasTalkingProvider(decoded);
    case 'nexah':           return new NexahProvider(decoded);
    case 'twilio':
    case 'vonage':          return new TwilioProvider(decoded);
    default: throw new Error(`Provider SMS inconnu: ${providerName}`);
  }
}

function createEmailProvider(providerName, config) {
  switch (providerName) {
    case 'brevo':        return new BrevoProvider(config);
    case 'sendgrid':     return new SendGridProvider(config);
    case 'smtp':         return new SMTPProvider(config);
    default: throw new Error(`Provider Email inconnu: ${providerName}`);
  }
}

// ============================================================
// TEMPLATE VARIABLE INTERPOLATION
// ============================================================

function interpolateTemplate(template, variables = {}) {
  if (!template) return template;
  return template.replace(/\{\{(\w+)\}\}/g, (_, key) => variables[key] || `{{${key}}}`);
}

// ============================================================
// SERVICE PRINCIPAL
// ============================================================

/**
 * Envoyer un SMS
 */
async function sendSMS(clientId, phone, message, options = {}) {
  const { campaign_id, template_params = {}, messageId: existingId } = options;

  // Récupérer le provider actif
  const providerRes = await query(
    `SELECT * FROM sms_providers WHERE client_id = $1 AND is_active = true LIMIT 1`,
    [clientId]
  );
  if (!providerRes.rows[0]) {
    throw { statusCode: 400, code: 'NO_SMS_PROVIDER', message: 'Aucun provider SMS configuré' };
  }

  const providerConfig = providerRes.rows[0];
  const config = { ...providerConfig.config, ...providerConfig };

  const finalMessage = interpolateTemplate(message, template_params);
  const messageId = existingId || uuidv4();

  // Sauvegarder le message
  await query(
    `INSERT INTO multichannel_messages (id, client_id, campaign_id, recipient_phone,
       channel, message_type, content, template_params, status, queued_at, cost)
     VALUES ($1,$2,$3,$4,'sms','text',$5,$6,'queued',NOW(),$7)
     ON CONFLICT (id) DO NOTHING`,
    [messageId, clientId, campaign_id||null, phone, finalMessage,
     JSON.stringify(template_params), providerConfig.cost_per_sms||0.05]
  );

  // Envoyer
  try {
    const provider = createSMSProvider(providerConfig.provider_name, config);
    const result = await provider.send(phone, finalMessage);

    await query(
      `UPDATE multichannel_messages SET status='sent', channel_message_id=$1, sent_at=NOW() WHERE id=$2`,
      [result.messageId, messageId]
    );

    // Mettre à jour les stats du provider
    await query(
      `UPDATE sms_providers SET messages_sent = messages_sent + 1, last_used_at=NOW() WHERE id=$1`,
      [providerConfig.id]
    );

    logger.info(`[SMS] Envoyé: ${phone} via ${providerConfig.provider_name}`);
    return { success: true, messageId, channel: 'sms', provider: providerConfig.provider_name };

  } catch (err) {
    await query(
      `UPDATE multichannel_messages SET status='failed', error_message=$1, failed_at=NOW() WHERE id=$2`,
      [err.message, messageId]
    );
    throw { statusCode: 500, code: 'SMS_SEND_ERROR', message: err.message };
  }
}

/**
 * Envoyer un Email
 */
async function sendEmail(clientId, toEmail, subject, htmlContent, textContent, options = {}) {
  const { campaign_id, template_params = {}, recipientName, attachments, messageId: existingId } = options;

  const providerRes = await query(
    `SELECT * FROM email_providers WHERE client_id = $1 AND is_active = true LIMIT 1`,
    [clientId]
  );
  if (!providerRes.rows[0]) {
    throw { statusCode: 400, code: 'NO_EMAIL_PROVIDER', message: 'Aucun provider Email configuré' };
  }

  const providerConfig = providerRes.rows[0];
  const config = { ...providerConfig.config, fromEmail: providerConfig.from_email, fromName: providerConfig.from_name };

  const finalSubject = interpolateTemplate(subject, template_params);
  const finalHtml = interpolateTemplate(htmlContent, template_params);
  const finalText = interpolateTemplate(textContent, template_params);
  const messageId = existingId || uuidv4();

  await query(
    `INSERT INTO multichannel_messages (id, client_id, campaign_id, recipient_email, recipient_name,
       channel, message_type, subject, content, html_content, template_params, status, queued_at, cost)
     VALUES ($1,$2,$3,$4,$5,'email','template',$6,$7,$8,$9,'queued',NOW(),$10)
     ON CONFLICT (id) DO NOTHING`,
    [messageId, clientId, campaign_id||null, toEmail, recipientName||null,
     finalSubject, finalText, finalHtml, JSON.stringify(template_params), providerConfig.cost_per_email||0.001]
  );

  try {
    const provider = createEmailProvider(providerConfig.provider_name, config);
    const result = await provider.send(toEmail, finalSubject, finalHtml, finalText, { recipientName, attachments });

    await query(
      `UPDATE multichannel_messages SET status='sent', channel_message_id=$1, sent_at=NOW() WHERE id=$2`,
      [result.messageId, messageId]
    );

    await query(
      `UPDATE email_providers SET messages_sent = messages_sent + 1, last_used_at=NOW() WHERE id=$1`,
      [providerConfig.id]
    );

    logger.info(`[EMAIL] Envoyé: ${toEmail} via ${providerConfig.provider_name}`);
    return { success: true, messageId, channel: 'email', provider: providerConfig.provider_name };

  } catch (err) {
    await query(
      `UPDATE multichannel_messages SET status='failed', error_message=$1, failed_at=NOW() WHERE id=$2`,
      [err.message, messageId]
    );
    throw { statusCode: 500, code: 'EMAIL_SEND_ERROR', message: err.message };
  }
}

/**
 * Envoi multi-canal avec fallback automatique
 * Séquence: WhatsApp → SMS → Email si échec
 */
async function sendWithFallback(clientId, recipient, content, options = {}) {
  const { channels = ['whatsapp', 'sms', 'email'], campaign_id } = options;
  const results = [];

  for (const channel of channels) {
    try {
      let result;

      if (channel === 'whatsapp' && recipient.phone) {
        const watiService = require('./wati.service');
        result = await watiService.sendTextMessage(recipient.phone, content.text, options.phoneNumber);
        if (!result.success) throw new Error(result.error);
        result = { success: true, channel: 'whatsapp', messageId: result.localMessageId };

      } else if (channel === 'sms' && recipient.phone) {
        result = await sendSMS(clientId, recipient.phone, content.sms || content.text, { campaign_id });

      } else if (channel === 'email' && recipient.email) {
        result = await sendEmail(clientId, recipient.email,
          content.subject || 'Message de NumericExport',
          content.html, content.text, { campaign_id, recipientName: recipient.name });

      } else {
        continue;
      }

      results.push({ channel, success: true, messageId: result.messageId });
      break; // Succès — pas de fallback nécessaire

    } catch (err) {
      logger.warn(`[MULTICHANNEL] Échec ${channel} pour ${recipient.phone||recipient.email}: ${err.message}`);
      results.push({ channel, success: false, error: err.message, fallback: true });
      // Continuer avec le canal suivant
    }
  }

  const successResult = results.find(r => r.success);
  return {
    success: !!successResult,
    channel_used: successResult?.channel,
    attempts: results,
    fallback_used: results.some(r => r.fallback)
  };
}

/**
 * Envoyer une campagne multi-canal
 */
async function sendMultichannelCampaign(clientId, campaignId, contacts, options = {}) {
  const { channels = ['whatsapp'], content = {} } = options;

  let sent = 0, failed = 0;

  for (const contact of contacts) {
    try {
      const result = await sendWithFallback(
        clientId,
        { phone: contact.phone_number, email: contact.email, name: contact.name },
        {
          text: interpolateTemplate(content.text || '', contact.variables || {}),
          sms: interpolateTemplate(content.sms || content.text || '', contact.variables || {}),
          html: interpolateTemplate(content.html || '', contact.variables || {}),
          subject: interpolateTemplate(content.subject || '', contact.variables || {})
        },
        { channels, campaign_id: campaignId, phoneNumber: content.phone_number }
      );

      if (result.success) sent++;
      else failed++;

      // Stats multi-canal
      if (result.channel_used) {
        const today = new Date().toISOString().split('T')[0];
        await query(
          `INSERT INTO multichannel_stats (id, campaign_id, channel, stat_date, sent)
           VALUES ($1,$2,$3,$4,1)
           ON CONFLICT (campaign_id, channel, stat_date) DO UPDATE SET sent = multichannel_stats.sent + 1`,
          [uuidv4(), campaignId, result.channel_used, today]
        );
      }

      await new Promise(r => setTimeout(r, 300));
    } catch (err) {
      logger.error(`[MULTICHANNEL] Erreur contact ${contact.phone_number}:`, err.message);
      failed++;
    }
  }

  return { success: true, sent, failed, total: contacts.length };
}

// ============================================================
// CONFIGURATION DES PROVIDERS
// ============================================================

async function configureSMSProvider(clientId, data) {
  const { provider_name, api_key, api_secret, sender_id, config = {}, cost_per_sms = 0.05 } = data;

  await query(
    `INSERT INTO sms_providers (id, client_id, provider_name, api_key, api_secret, sender_id, config, cost_per_sms)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8)
     ON CONFLICT (client_id, provider_name) DO UPDATE SET
       api_key=$4, api_secret=$5, sender_id=$6, config=$7, cost_per_sms=$8, updated_at=NOW()`,
    [uuidv4(), clientId, provider_name, api_key, api_secret||null, sender_id||null,
     JSON.stringify(config), cost_per_sms]
  ).catch(() => query(
    `INSERT INTO sms_providers (id, client_id, provider_name, api_key, api_secret, sender_id, config, cost_per_sms)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8)`,
    [uuidv4(), clientId, provider_name, api_key, api_secret||null, sender_id||null, JSON.stringify(config), cost_per_sms]
  ));

  return { success: true, provider: provider_name };
}

async function configureEmailProvider(clientId, data) {
  const { provider_name, api_key, from_email, from_name, reply_to, config = {}, cost_per_email = 0.001 } = data;

  await query(
    `INSERT INTO email_providers (id, client_id, provider_name, api_key, from_email, from_name, reply_to, config, cost_per_email)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)`,
    [uuidv4(), clientId, provider_name, api_key, from_email, from_name||null, reply_to||null,
     JSON.stringify(config), cost_per_email]
  );

  return { success: true, provider: provider_name };
}

async function getChannelStats(clientId, period = '30days') {
  const interval = { '7days': '7 days', '30days': '30 days', '90days': '90 days' }[period] || '30 days';

  const res = await query(
    `SELECT channel,
       COUNT(*) as total,
       COUNT(CASE WHEN status IN('delivered','read') THEN 1 END) as delivered,
       COUNT(CASE WHEN status = 'read' THEN 1 END) as read,
       COUNT(CASE WHEN status = 'failed' THEN 1 END) as failed,
       ROUND(AVG(CASE WHEN status IN('delivered','read','sent') THEN 1.0 ELSE 0 END)*100,1) as delivery_rate,
       COALESCE(SUM(cost),0) as total_cost
     FROM multichannel_messages
     WHERE client_id = $1 AND created_at >= NOW() - INTERVAL '${interval}'
     GROUP BY channel`,
    [clientId]
  );

  return { success: true, stats: res.rows, period };
}

async function getMultichannelMessages(clientId, filters = {}) {
  const { page=1, limit=50, channel, status, search } = filters;
  const offset = (page-1)*limit;

  let where = 'WHERE client_id = $1';
  const params = [clientId];
  let idx = 2;

  if (channel) { where += ` AND channel = $${idx++}`; params.push(channel); }
  if (status) { where += ` AND status = $${idx++}`; params.push(status); }
  if (search) {
    where += ` AND (recipient_phone ILIKE $${idx} OR recipient_email ILIKE $${idx})`;
    params.push(`%${search}%`); idx++;
  }

  const countRes = await query(`SELECT COUNT(*) FROM multichannel_messages ${where}`, params);
  const total = parseInt(countRes.rows[0].count);

  const res = await query(
    `SELECT * FROM multichannel_messages ${where}
     ORDER BY created_at DESC LIMIT $${idx} OFFSET $${idx+1}`,
    [...params, limit, offset]
  );

  return { success: true, messages: res.rows, pagination: { total, page: parseInt(page), limit: parseInt(limit), totalPages: Math.ceil(total/limit) } };
}

module.exports = {
  sendSMS, sendEmail, sendWithFallback, sendMultichannelCampaign,
  configureSMSProvider, configureEmailProvider,
  getChannelStats, getMultichannelMessages, interpolateTemplate
};
