// src/services/inbox.service.js
// Inbox centralisée des conversations WhatsApp
const { query, getClient } = require('../config/database');
const { v4: uuidv4 } = require('uuid');
const logger = require('../utils/logger');
const { emitToClient } = require('../socket');

// ============================================================
// CONVERSATIONS
// ============================================================

/**
 * Récupérer ou créer une conversation
 */
async function getOrCreateConversation(clientId, phoneNumber, channelPhone, senderName = null) {
  const existing = await query(
    `SELECT * FROM inbox_conversations
     WHERE client_id = $1 AND phone_number = $2 AND channel_phone = $3`,
    [clientId, phoneNumber, channelPhone]
  );

  if (existing.rows[0]) return existing.rows[0];

  const convId = uuidv4();
  const res = await query(
    `INSERT INTO inbox_conversations
       (id, client_id, phone_number, contact_name, channel_phone, status, unread_count)
     VALUES ($1,$2,$3,$4,$5,'open',1) RETURNING *`,
    [convId, clientId, phoneNumber, senderName || null, channelPhone]
  );

  return res.rows[0];
}

async function getConversations(clientId, filters = {}) {
  const { page = 1, limit = 30, status, assigned_to, search, tag } = filters;
  const offset = (page - 1) * limit;

  let where = 'WHERE c.client_id = $1';
  const params = [clientId];
  let idx = 2;

  if (status) { where += ` AND c.status = $${idx++}`; params.push(status); }
  if (assigned_to === 'me' || assigned_to) {
    where += ` AND c.assigned_to = $${idx++}`;
    params.push(assigned_to === 'me' ? assigned_to : assigned_to);
  }
  if (search) {
    where += ` AND (c.phone_number ILIKE $${idx} OR c.contact_name ILIKE $${idx})`;
    params.push(`%${search}%`); idx++;
  }

  const countRes = await query(`SELECT COUNT(*) FROM inbox_conversations c ${where}`, params);
  const total = parseInt(countRes.rows[0].count);

  const res = await query(
    `SELECT c.*,
       u.email as assigned_to_email,
       COALESCE(u.full_name, u.email) as assigned_to_name
     FROM inbox_conversations c
     LEFT JOIN users u ON c.assigned_to = u.id
     ${where}
     ORDER BY c.last_message_at DESC
     LIMIT $${idx} OFFSET $${idx+1}`,
    [...params, limit, offset]
  );

  return {
    success: true,
    conversations: res.rows,
    pagination: { total, page: parseInt(page), limit: parseInt(limit), totalPages: Math.ceil(total / limit) },
    unread_total: res.rows.reduce((acc, c) => acc + (c.unread_count || 0), 0)
  };
}

async function getConversationById(convId, clientId) {
  const res = await query(
    `SELECT c.*,
       u.email as assigned_to_email,
       COALESCE(u.full_name, u.email) as assigned_to_name
     FROM inbox_conversations c
     LEFT JOIN users u ON c.assigned_to = u.id
     WHERE c.id = $1 AND c.client_id = $2`,
    [convId, clientId]
  );
  if (!res.rows[0]) throw { statusCode: 404, code: 'NOT_FOUND', message: 'Conversation non trouvée' };
  return res.rows[0];
}

async function updateConversation(convId, clientId, updates) {
  const allowed = ['status', 'assigned_to', 'priority', 'contact_name', 'tags', 'is_bot'];
  const sets = [];
  const vals = [convId, clientId];
  let idx = 3;

  for (const key of allowed) {
    if (updates[key] !== undefined) {
      sets.push(`${key} = $${idx++}`);
      vals.push(typeof updates[key] === 'object' && key !== 'tags' ? JSON.stringify(updates[key]) : updates[key]);
    }
  }
  if (!sets.length) throw { statusCode: 400, message: 'Rien à mettre à jour' };
  sets.push('updated_at = NOW()');

  await query(
    `UPDATE inbox_conversations SET ${sets.join(', ')} WHERE id = $1 AND client_id = $2`,
    vals
  );

  return { success: true, conversation: await getConversationById(convId, clientId) };
}

async function markConversationRead(convId, clientId) {
  console.log(`🔍 [markConversationRead] Début - conv=${convId}, client=${clientId}`);

  try {
    const check = await query(
      `SELECT id FROM inbox_conversations
       WHERE id = $1 AND client_id = $2`,
      [convId, clientId]
    );

    if (check.rows.length === 0) {
      console.log(`❌ Conversation non trouvée ou accès refusé`);
      throw { statusCode: 404, message: 'Conversation non trouvée ou accès refusé' };
    }

    await query(
      `UPDATE inbox_messages
       SET status = 'read', read_at = NOW()
       WHERE conversation_id = $1 AND direction = 'inbound'`,
      [convId]
    );

    await query(
      `UPDATE inbox_conversations
       SET unread_count = 0, updated_at = NOW()
       WHERE id = $1`,
      [convId]
    );

    console.log(`✅ [markConversationRead] Conversation ${convId} marquée comme lue`);
    return { success: true };

  } catch (error) {
    console.error(`❌ [markConversationRead] Erreur:`, error.message);
    throw error;
  }
}

// ============================================================
// MESSAGES
// ============================================================

async function getMessages(convId, clientId, filters = {}) {
  await getConversationById(convId, clientId);

  const { limit = 50, before } = filters;
  let where = 'WHERE conversation_id = $1';
  const params = [convId];
  let idx = 2;

  if (before) {
    where += ` AND created_at < $${idx++}`;
    params.push(before);
  }

  const res = await query(
    `SELECT m.*,
       u.email as note_author_email,
       COALESCE(u.full_name, u.email) as note_author_name
     FROM inbox_messages m
     LEFT JOIN users u ON m.note_author = u.id
     ${where}
     ORDER BY m.created_at DESC
     LIMIT $${idx}`,
    [...params, limit]
  );

  return { success: true, messages: res.rows.reverse() };
}

async function sendReply(convId, clientId, userId, data) {
  const conv = await getConversationById(convId, clientId);
  const { content, message_type = 'text', template_name, template_params = {}, media_url, phone_number } = data;

  if (!content && !template_name) {
    throw { statusCode: 400, code: 'CONTENT_REQUIRED', message: 'Contenu ou template requis' };
  }

  const emitter = phone_number || conv.channel_phone || '+237689588347';
  const messageId = uuidv4();

  let insertedMsg = null;
  if (message_type === 'text' && content) {
    const msgRes = await query(
      `INSERT INTO inbox_messages
         (id, conversation_id, direction, message_type, content, status, sender_name, wa_status)
       VALUES ($1,$2,'outbound','text',$3,'pending','Agent','queued')
       RETURNING *`,
      [messageId, convId, content]
    );
    insertedMsg = msgRes.rows[0];
  } else if (message_type === 'template' && template_name) {
    const msgRes = await query(
      `INSERT INTO inbox_messages
         (id, conversation_id, direction, message_type, content, status, sender_name, metadata, wa_status)
       VALUES ($1,$2,'outbound','template',$3,'pending','Agent',$4,'queued')
       RETURNING *`,
      [messageId, convId, `[Template: ${template_name}]`, JSON.stringify({ template_name, template_params })]
    );
    insertedMsg = msgRes.rows[0];
  }

  if (!insertedMsg) {
    throw { statusCode: 400, message: 'Impossible de créer le message' };
  }

  const preview = message_type === 'text' ? content.substring(0, 100) : `[Template: ${template_name}]`;
  await query(
    `UPDATE inbox_conversations SET last_message_at = NOW(), last_message_preview = $1, updated_at = NOW()
     WHERE id = $2`,
    [preview, convId]
  );

  let watiResult = { success: false };
  try {
    const watiService = require('./wati.service');
    if (message_type === 'text' && content) {
      watiResult = await watiService.sendTextMessage(conv.phone_number, content, emitter);
    } else if (message_type === 'template' && template_name) {
      watiResult = await watiService.sendTemplateMessage(conv.phone_number, template_name, template_params, 'fr', emitter);
    }

    if (watiResult.success) {
      await query(
        `UPDATE inbox_messages SET status = 'sent', wa_message_id = $1, wa_status = 'sent', sent_at = NOW()
         WHERE id = $2`,
        [watiResult.localMessageId || watiResult.watiMessageId, insertedMsg.id]
      );
      insertedMsg.status = 'sent';
      insertedMsg.wa_message_id = watiResult.localMessageId || watiResult.watiMessageId;
    } else {
      await query(
        `UPDATE inbox_messages SET status = 'failed', error_message = $1, wa_status = 'failed'
         WHERE id = $2`,
        [watiResult.error || 'Unknown error', insertedMsg.id]
      );
      insertedMsg.status = 'failed';
    }
  } catch (err) {
    console.error('Erreur lors de l’envoi WATI:', err);
    await query(
      `UPDATE inbox_messages SET status = 'failed', error_message = $1, wa_status = 'failed'
       WHERE id = $2`,
      [err.message, insertedMsg.id]
    );
    insertedMsg.status = 'failed';
  }

  const { emitToClient } = require('../socket');
  emitToClient(clientId, 'reply-sent', {
    conversationId: convId,
    message: insertedMsg
  });

  return { success: true, message: insertedMsg };
}

async function addNote(convId, clientId, userId, noteContent) {
  await getConversationById(convId, clientId);

  const res = await query(
    `INSERT INTO inbox_messages
       (id, conversation_id, direction, message_type, content, is_note, note_author, status)
     VALUES ($1,$2,'outbound','text',$3,true,$4,'sent') RETURNING *`,
    [uuidv4(), convId, noteContent, userId]
  );

  return { success: true, note: res.rows[0] };
}

async function processIncomingMessage(payload, clientId) {
  try {
    const {
      fromNumber, messageText, messageType = 'text',
      senderName, channelPhone, waMessageId, receivedAt
    } = payload;

    if (!fromNumber || !clientId) return;

    const conv = await getOrCreateConversation(clientId, fromNumber, channelPhone || '', senderName);

    const msgRes = await query(
      `INSERT INTO inbox_messages
         (id, conversation_id, direction, message_type, content, wa_message_id, status, sender_name)
       VALUES ($1,$2,'inbound',$3,$4,$5,'received',$6)
       ON CONFLICT DO NOTHING RETURNING *`,
      [uuidv4(), conv.id, messageType, messageText || '', waMessageId || null, senderName || fromNumber]
    );

    const updatedConvRes = await query(
      `UPDATE inbox_conversations SET
         last_message_at = $1, last_message_preview = $2,
         unread_count = unread_count + 1, contact_name = COALESCE(contact_name, $3),
         updated_at = NOW()
       WHERE id = $4
       RETURNING *`,
      [receivedAt || new Date(), (messageText || '').substring(0, 100), senderName, conv.id]
    );

    logger.info(`[INBOX] Message entrant de ${fromNumber} → conv ${conv.id}`);

    if (msgRes.rows[0]) {
      emitToClient(clientId, 'new-inbox-message', {
        conversationId: conv.id,
        message: msgRes.rows[0],
        conversation: updatedConvRes.rows[0]
      });
    }

    return conv;
  } catch (err) {
    logger.error('[INBOX] processIncomingMessage:', err);
  }
}

// ============================================================
// RÉPONSES RAPIDES (CANNED RESPONSES)
// ============================================================

async function getCannedResponses(clientId, search = '') {
  let where = 'WHERE client_id = $1';
  const params = [clientId];
  if (search) { where += ' AND (title ILIKE $2 OR shortcut ILIKE $2 OR content ILIKE $2)'; params.push(`%${search}%`); }

  const res = await query(
    `SELECT * FROM inbox_canned_responses ${where} ORDER BY usage_count DESC, title ASC`,
    params
  );
  return { success: true, responses: res.rows };
}

async function createCannedResponse(clientId, userId, data) {
  const { title, shortcut, content, category } = data;
  if (!title || !content) throw { statusCode: 400, message: 'Titre et contenu requis' };

  const res = await query(
    `INSERT INTO inbox_canned_responses (id, client_id, title, shortcut, content, category, created_by)
     VALUES ($1,$2,$3,$4,$5,$6,$7) RETURNING *`,
    [uuidv4(), clientId, title, shortcut || null, content, category || null, userId]
  );
  return { success: true, response: res.rows[0] };
}

async function useCannedResponse(responseId, clientId) {
  await query(
    `UPDATE inbox_canned_responses SET usage_count = usage_count + 1 WHERE id = $1 AND client_id = $2`,
    [responseId, clientId]
  );
  const res = await query(`SELECT * FROM inbox_canned_responses WHERE id = $1`, [responseId]);
  return { success: true, response: res.rows[0] };
}

// ============================================================
// STATS INBOX
// ============================================================

async function getInboxStats(clientId) {
  const res = await query(
    `SELECT
       COUNT(*) as total,
       COUNT(CASE WHEN status = 'open' THEN 1 END) as open,
       COUNT(CASE WHEN status = 'assigned' THEN 1 END) as assigned,
       COUNT(CASE WHEN status = 'resolved' THEN 1 END) as resolved,
       COUNT(CASE WHEN status = 'waiting' THEN 1 END) as waiting,
       COALESCE(SUM(unread_count), 0) as total_unread,
       COUNT(CASE WHEN priority = 'urgent' AND status != 'resolved' THEN 1 END) as urgent
     FROM inbox_conversations WHERE client_id = $1`,
    [clientId]
  );

  const byAgent = await query(
    `SELECT
       u.email, COALESCE(u.full_name, u.email) as name,
       COUNT(*) as assigned_count,
       COUNT(CASE WHEN c.status = 'resolved' THEN 1 END) as resolved_count
     FROM inbox_conversations c
     JOIN users u ON u.id = c.assigned_to
     WHERE c.client_id = $1 AND c.assigned_to IS NOT NULL
     GROUP BY u.id, u.email, u.full_name`,
    [clientId]
  );

  return {
    success: true,
    stats: res.rows[0],
    by_agent: byAgent.rows
  };
}

// ============================================================
// NOUVELLES FONCTIONS POUR LES EXPORTS
// ============================================================

/**
 * Récupérer les conversations des dernières X jours
 */
async function getConversationsByDays(clientId, days = 1, filters = {}) {
  const { page = 1, limit = 30, status, assigned_to, search, tag } = filters;
  const offset = (page - 1) * limit;

  const dateLimit = new Date();
  dateLimit.setDate(dateLimit.getDate() - days);

  let where = 'WHERE c.client_id = $1 AND c.last_message_at >= $2';
  const params = [clientId, dateLimit];
  let idx = 3;

  if (status) { where += ` AND c.status = $${idx++}`; params.push(status); }
  if (assigned_to === 'me' || assigned_to) {
    where += ` AND c.assigned_to = $${idx++}`;
    params.push(assigned_to === 'me' ? assigned_to : assigned_to);
  }
  if (search) {
    where += ` AND (c.phone_number ILIKE $${idx} OR c.contact_name ILIKE $${idx})`;
    params.push(`%${search}%`); idx++;
  }

  const countRes = await query(`SELECT COUNT(*) FROM inbox_conversations c ${where}`, params);
  const total = parseInt(countRes.rows[0].count);

  const res = await query(
    `SELECT c.*,
       u.email as assigned_to_email,
       COALESCE(u.full_name, u.email) as assigned_to_name
     FROM inbox_conversations c
     LEFT JOIN users u ON c.assigned_to = u.id
     ${where}
     ORDER BY c.last_message_at DESC
     LIMIT $${idx} OFFSET $${idx+1}`,
    [...params, limit, offset]
  );

  return {
    success: true,
    conversations: res.rows,
    pagination: { total, page: parseInt(page), limit: parseInt(limit), totalPages: Math.ceil(total / limit) },
    unread_total: res.rows.reduce((acc, c) => acc + (c.unread_count || 0), 0)
  };
}

/**
 * Exporter une conversation complète au format CSV
 */
async function exportConversationToCSV(convId, clientId) {
  try {
    const conv = await getConversationById(convId, clientId);

    const messagesRes = await query(
      `SELECT
         m.created_at,
         m.direction,
         m.message_type,
         m.content,
         m.status,
         m.sent_at,
         m.delivered_at,
         m.read_at,
         m.sender_name,
         COALESCE(u.full_name, u.email) as note_author
       FROM inbox_messages m
       LEFT JOIN users u ON m.note_author = u.id
       WHERE m.conversation_id = $1
       ORDER BY m.created_at ASC`,
      [convId]
    );

    const formatDateForCSV = (dateString) => {
      if (!dateString) return '';
      const date = new Date(dateString);
      if (isNaN(date.getTime())) return '';

      const day = String(date.getDate()).padStart(2, '0');
      const month = String(date.getMonth() + 1).padStart(2, '0');
      const year = date.getFullYear();
      const hours = String(date.getHours()).padStart(2, '0');
      const minutes = String(date.getMinutes()).padStart(2, '0');
      const seconds = String(date.getSeconds()).padStart(2, '0');

      return `${day}/${month}/${year} ${hours}:${minutes}:${seconds}`;
    };

    const headers = [
      'Date',
      'Direction',
      'Type',
      'Contenu',
      'Statut',
      'Date envoi',
  //    'Date livraison',
      'Date lecture',
      'Expéditeur'
    ];

    const rows = messagesRes.rows.map(msg => [
      formatDateForCSV(msg.created_at),
      msg.direction === 'inbound' ? '📥 Reçu' : (msg.is_note ? '📝 Note interne' : '📤 Envoyé'),
      msg.message_type,
      msg.content || '',
      msg.status || '',
      formatDateForCSV(msg.sent_at),
  //    formatDateForCSV(msg.delivered_at),
      formatDateForCSV(msg.read_at),
      msg.sender_name || (msg.direction === 'outbound' ? 'Agent' : msg.note_author || 'Client')
    ]);

    const csv = [
      `# Conversation avec ${conv.contact_name || conv.phone_number}`,
      `# Téléphone: ${conv.phone_number}`,
      `# Canal: ${conv.channel_phone}`,
      `# Statut: ${conv.status}`,
      `# Exporté le: ${new Date().toLocaleString('fr-FR')}`,
      '',
      headers.join(','),
      ...rows.map(row => row.map(cell => `"${String(cell || '').replace(/"/g, '""')}"`).join(','))
    ].join('\n');

    return {
      success: true,
      csv,
      conversation: conv,
      messageCount: messagesRes.rows.length
    };
  } catch (error) {
    logger.error('Erreur export conversation CSV:', error);
    throw error;
  }
}

/**
 * Exporter toutes les conversations d'une période au format CSV
 */
async function exportConversationsByPeriod(clientId, days = 7) {
  try {
    const dateLimit = new Date();
    dateLimit.setDate(dateLimit.getDate() - days);

    const conversationsRes = await query(
      `SELECT c.*,
         u.email as assigned_to_email,
         COALESCE(u.full_name, u.email) as assigned_to_name
       FROM inbox_conversations c
       LEFT JOIN users u ON c.assigned_to = u.id
       WHERE c.client_id = $1 AND c.last_message_at >= $2
       ORDER BY c.last_message_at DESC`,
      [clientId, dateLimit]
    );

    const conversations = conversationsRes.rows;
    const allMessages = [];

    for (const conv of conversations) {
      const messagesRes = await query(
        `SELECT
           m.created_at,
           m.direction,
           m.message_type,
           m.content,
           m.status,
           m.sent_at,
           m.delivered_at,
           m.read_at
         FROM inbox_messages m
         WHERE m.conversation_id = $1
         ORDER BY m.created_at ASC`,
        [conv.id]
      );

      messagesRes.rows.forEach(msg => {
        allMessages.push({
          phone_number: conv.phone_number,
          contact_name: conv.contact_name,
          message_date: msg.created_at,
          direction: msg.direction,
          type: msg.message_type,
          content: msg.content,
          status: msg.status,
          sent_at: msg.sent_at,
          delivered_at: msg.delivered_at,
          read_at: msg.read_at
        });
      });
    }

    const formatDateForCSV = (dateString) => {
      if (!dateString) return '';
      const date = new Date(dateString);
      if (isNaN(date.getTime())) return '';

      const day = String(date.getDate()).padStart(2, '0');
      const month = String(date.getMonth() + 1).padStart(2, '0');
      const year = date.getFullYear();
      const hours = String(date.getHours()).padStart(2, '0');
      const minutes = String(date.getMinutes()).padStart(2, '0');
      const seconds = String(date.getSeconds()).padStart(2, '0');

      return `${day}/${month}/${year} ${hours}:${minutes}:${seconds}`;
    };

    const headers = [
      'Numéro de téléphone',
      'Nom du contact',
      'Date du message',
      'Direction',
      'Type',
      'Contenu',
      'Statut',
      'Date envoi',
  //    'Date livraison',
      'Date lecture'
    ];

    const rows = allMessages.map(msg => [
      msg.phone_number,
      msg.contact_name || '',
      formatDateForCSV(msg.message_date),
      msg.direction === 'inbound' ? 'Reçu' : 'Envoyé',
      msg.type,
      msg.content || '',
      msg.status || '',
      formatDateForCSV(msg.sent_at),
//      formatDateForCSV(msg.delivered_at),
      formatDateForCSV(msg.read_at)
    ]);

    const csv = [
      `# Export des conversations des ${days} derniers jours`,
      `# Date d'export: ${new Date().toLocaleString('fr-FR')}`,
      `# Total conversations: ${conversations.length}`,
      `# Total messages: ${allMessages.length}`,
      '',
      headers.join(','),
      ...rows.map(row => row.map(cell => `"${String(cell || '').replace(/"/g, '""')}"`).join(','))
    ].join('\n');

    return {
      success: true,
      csv,
      conversationCount: conversations.length,
      messageCount: allMessages.length,
      days
    };
  } catch (error) {
    logger.error('Erreur export conversations période CSV:', error);
    throw error;
  }
}

// ============================================================
// STATISTIQUES DE SATISFACTION CLIENT
// ============================================================

async function getSatisfactionStats(clientId) {
  const res = await query(
    `SELECT
       COUNT(*) as total_replied,
       COUNT(CASE WHEN LOWER(TRIM(m.message_content)) = 'stop' THEN 1 END) as stop_count,
       COUNT(CASE WHEN LOWER(TRIM(m.message_content)) = 'start' THEN 1 END) as start_count
     FROM incoming_messages m
     JOIN whatsapp_numbers wn ON REPLACE(m.channel_phone, '+', '') = REPLACE(wn.phone_number, '+', '')
     JOIN whatsapp_number_assignments wa ON wa.number_id = wn.id
     WHERE wa.client_id = $1
     -- AND LOWER(TRIM(m.message_content)) IN ('stop', 'start')
    `,
    [clientId]
  );

  const stats = res.rows[0] || { total_replied: 0, stop_count: 0, start_count: 0 };
  return {
    success: true,
    total_replied: parseInt(stats.total_replied) || 0,
    stop_count: parseInt(stats.stop_count) || 0,
    start_count: parseInt(stats.start_count) || 0,
  };
}

/**
 * Récupérer les conversations des dernières X jours
 */
async function getConversationsByDays(clientId, days = 1, filters = {}) {
  const { page = 1, limit = 30, status, assigned_to, search, tag } = filters;
  const offset = (page - 1) * limit;

  const dateLimit = new Date();
  dateLimit.setDate(dateLimit.getDate() - days);

  let where = 'WHERE c.client_id = $1 AND c.last_message_at >= $2';
  const params = [clientId, dateLimit];
  let idx = 3;

  if (status) { where += ` AND c.status = $${idx++}`; params.push(status); }
  if (assigned_to === 'me' || assigned_to) {
    where += ` AND c.assigned_to = $${idx++}`;
    params.push(assigned_to === 'me' ? assigned_to : assigned_to);
  }
  if (search) {
    where += ` AND (c.phone_number ILIKE $${idx} OR c.contact_name ILIKE $${idx})`;
    params.push(`%${search}%`); idx++;
  }

  const countRes = await query(`SELECT COUNT(*) FROM inbox_conversations c ${where}`, params);
  const total = parseInt(countRes.rows[0].count);

  const res = await query(
    `SELECT c.*,
       u.email as assigned_to_email,
       COALESCE(u.full_name, u.email) as assigned_to_name
     FROM inbox_conversations c
     LEFT JOIN users u ON c.assigned_to = u.id
     ${where}
     ORDER BY c.last_message_at DESC
     LIMIT $${idx} OFFSET $${idx+1}`,
    [...params, limit, offset]
  );

  return {
    success: true,
    conversations: res.rows,
    pagination: { total, page: parseInt(page), limit: parseInt(limit), totalPages: Math.ceil(total / limit) },
    unread_total: res.rows.reduce((acc, c) => acc + (c.unread_count || 0), 0)
  };
}

// ============================================================
// EXPORTS
// ============================================================

module.exports = {
  getOrCreateConversation,
  getConversations,
  getConversationsByDays,
  getConversationById,
  updateConversation,
  markConversationRead,
  getMessages,
  sendReply,
  addNote,
  processIncomingMessage,
  getCannedResponses,
  createCannedResponse,
  useCannedResponse,
  getInboxStats,
  exportConversationToCSV,
  exportConversationsByPeriod,
  getSatisfactionStats
};
