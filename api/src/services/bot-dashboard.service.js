// src/services/bot-dashboard.service.js
//
// Requêtes de lecture/administration pour le dashboard du chatbot Socadel.
// Séparé de chatbot.service.js (qui ne contient que la logique de conversation)
// pour garder une responsabilité claire par fichier.

const { query } = require('../config/database');

// ============================================================
// STATISTIQUES GLOBALES
// ============================================================
async function getStats() {
  const [conv, contacts, clicks] = await Promise.all([
    query(`
      SELECT
        COUNT(*) FILTER (WHERE state = 'LANG_SELECT')                AS lang_select,
        COUNT(*) FILTER (WHERE state = 'MAIN_MENU')                  AS main_menu,
        COUNT(*) FILTER (WHERE state = 'INVOICE_CONTRACT_INPUT')     AS invoice_input,
        COUNT(*) FILTER (WHERE state = 'INVOICE_CONFIRM')            AS invoice_confirm,
        COUNT(*) FILTER (WHERE state = 'LAST_INVOICE_CONTRACT_INPUT') AS last_invoice_input,
        COUNT(*) FILTER (WHERE locked_until IS NOT NULL AND locked_until > NOW()) AS currently_locked,
        COUNT(*) FILTER (WHERE last_message_at > NOW() - INTERVAL '24 hours')     AS active_today,
        COUNT(*) AS total_conversations
      FROM bot_conversations
    `),
    query(`
      SELECT
        COUNT(*) AS total_activated,
        COUNT(*) FILTER (WHERE activated_at > CURRENT_DATE) AS activated_today
      FROM whatsapp_valid_contacts
    `),
    query(`
      SELECT
        COUNT(*) AS clicks_total,
        COUNT(*) FILTER (WHERE clicked_at > CURRENT_DATE) AS clicks_today
      FROM bot_link_clicks
    `).catch(() => ({ rows: [{ clicks_total: 0, clicks_today: 0 }] })), // table optionnelle
  ]);

  return {
    conversations: conv.rows[0],
    contacts: contacts.rows[0],
    link_clicks: clicks.rows[0],
  };
}

// ============================================================
// LISTE PAGINÉE DES CONVERSATIONS
// ============================================================
async function listConversations({ state = null, phone = null, lockedOnly = false, page = 1, limit = 20 }) {
  const offset = (page - 1) * limit;
  const params = [];
  let whereClause = 'WHERE 1=1';

  if (state) {
    params.push(state);
    whereClause += ` AND state = $${params.length}`;
  }
  if (phone) {
    params.push(`%${phone}%`);
    whereClause += ` AND phone ILIKE $${params.length}`;
  }
  if (lockedOnly) {
    whereClause += ` AND locked_until IS NOT NULL AND locked_until > NOW()`;
  }

  const countResult = await query(`SELECT COUNT(*) FROM bot_conversations ${whereClause}`, params);
  const total = parseInt(countResult.rows[0].count);

  const dataResult = await query(
    `SELECT phone, language, state, contact_name, draft_contract_number, draft_client_name,
            invoice_attempts, locked_until, last_message_at, created_at
     FROM bot_conversations
     ${whereClause}
     ORDER BY last_message_at DESC
     LIMIT $${params.length + 1} OFFSET $${params.length + 2}`,
    [...params, limit, offset]
  );

  return {
    conversations: dataResult.rows,
    pagination: { total, page: parseInt(page), limit: parseInt(limit), totalPages: Math.ceil(total / limit) },
  };
}

// ============================================================
// DÉBLOCAGE MANUEL D'UNE CONVERSATION (admin)
// ============================================================
async function unlockConversation(phone) {
  const result = await query(
    `UPDATE bot_conversations
     SET locked_until = NULL, invoice_attempts = 0, updated_at = NOW()
     WHERE phone = $1
     RETURNING phone`,
    [phone]
  );
  return result.rowCount > 0;
}

// ============================================================
// LISTE DES CONTACTS ACTIVÉS ("Facture Digitale")
// ============================================================
async function listActivatedContacts({ search = null, page = 1, limit = 20 }) {
  const offset = (page - 1) * limit;
  const params = [];
  let whereClause = 'WHERE 1=1';

  if (search) {
    params.push(`%${search}%`);
    whereClause += ` AND (contract_number ILIKE $${params.length} OR client_name ILIKE $${params.length} OR whatsapp_phone ILIKE $${params.length})`;
  }

  const countResult = await query(`SELECT COUNT(*) FROM whatsapp_valid_contacts ${whereClause}`, params);
  const total = parseInt(countResult.rows[0].count);

  const dataResult = await query(
    `SELECT contract_number, client_name, whatsapp_phone, activated_at
     FROM whatsapp_valid_contacts
     ${whereClause}
     ORDER BY activated_at DESC
     LIMIT $${params.length + 1} OFFSET $${params.length + 2}`,
    [...params, limit, offset]
  );

  return {
    contacts: dataResult.rows,
    pagination: { total, page: parseInt(page), limit: parseInt(limit), totalPages: Math.ceil(total / limit) },
  };
}

// ============================================================
// STATISTIQUES DES DERNIÈRES FACTURES (LAST_INVOICE_CONTRACT_INPUT)
// ============================================================
async function getLastInvoiceStats({ days = 30, groupBy = 'day' }) {
  // groupBy : 'day' | 'week' | 'month'
  let interval;
  let dateTrunc;
  switch (groupBy) {
    case 'week': interval = '7 days'; dateTrunc = 'week'; break;
    case 'month': interval = '30 days'; dateTrunc = 'month'; break;
    default: interval = '1 day'; dateTrunc = 'day';
  }

  const result = await query(
    `SELECT
       DATE_TRUNC($1, last_message_at) AS period,
       COUNT(*) AS count
     FROM bot_conversations
     WHERE state = 'LAST_INVOICE_CONTRACT_INPUT'
       AND last_message_at > NOW() - INTERVAL '${parseInt(days)} days'
     GROUP BY period
     ORDER BY period ASC`,
    [dateTrunc]
  );
  return result.rows.map(row => ({
    date: row.period,
    count: parseInt(row.count)
  }));
}

// ============================================================
// EXPORT DES CONVERSATIONS "DERNIÈRE FACTURE" (CSV)
// ============================================================
async function exportLastInvoices({ search = null, from = null, to = null } = {}) {
  const params = [];
  let whereClause = `WHERE state = 'LAST_INVOICE_CONTRACT_INPUT'`;

  if (search) {
    params.push(`%${search}%`);
    whereClause += ` AND (phone ILIKE $${params.length} OR draft_contract_number ILIKE $${params.length} OR draft_client_name ILIKE $${params.length})`;
  }
  if (from) {
    params.push(from);
    whereClause += ` AND last_message_at >= $${params.length}`;
  }
  if (to) {
    params.push(to);
    whereClause += ` AND last_message_at <= $${params.length}`;
  }

  const result = await query(
    `SELECT phone, draft_contract_number, draft_client_name, contact_name,
            invoice_attempts, locked_until, last_message_at, created_at
     FROM bot_conversations
     ${whereClause}
     ORDER BY last_message_at DESC`,
    params
  );
  return result.rows;
}

// ============================================================
// STATISTIQUES DES CONTRATS (factures envoyées)
// ============================================================
async function getContractInvoiceStats() {
  const result = await query(`
    SELECT 
      COUNT(*) AS total_contracts,
      COALESCE(SUM(total_invoices_sent), 0) AS total_invoices,
      COALESCE(AVG(total_invoices_sent), 0) AS avg_invoices
    FROM contracts
  `);
  return result.rows[0];
}

// ============================================================
// STATISTIQUES DES CLICS DE PAIEMENT (par méthode et par jour)
// ============================================================
async function getPaymentClickStats(days = 30) {
  // Par méthode (Orange / MTN)
  const methodStats = await query(`
    SELECT 
      metadata->>'method' AS method,
      COUNT(*) AS count
    FROM bot_link_clicks
    WHERE type = 'pay'
    GROUP BY metadata->>'method'
  `);

  // Par jour (derniers 'days' jours)
  const dailyStats = await query(`
    SELECT 
      DATE(clicked_at) AS jour,
      COUNT(*) AS count
    FROM bot_link_clicks
    WHERE type = 'pay'
      AND clicked_at > CURRENT_DATE - INTERVAL '${parseInt(days)} days'
    GROUP BY DATE(clicked_at)
    ORDER BY jour ASC
  `);

  return {
    byMethod: methodStats.rows,
    byDay: dailyStats.rows
  };
}

// ============================================================
// STATS QUOTIDIENNES DES CLICS SUR LE LIEN wa.me (7 derniers jours)
// ============================================================
async function getLinkClickStats(days = 7) {
  try {
    const result = await query(
      `SELECT DATE(clicked_at) AS date, COUNT(*) AS clicks
       FROM bot_link_clicks
       WHERE clicked_at > CURRENT_DATE - INTERVAL '${parseInt(days)} days'
       GROUP BY DATE(clicked_at)
       ORDER BY date ASC`
    );
    return result.rows;
  } catch (err) {
    return []; // table optionnelle, pas encore créée/utilisée
  }
}



module.exports = {
  getStats,
  listConversations,
  unlockConversation,
  listActivatedContacts,
  getLinkClickStats,
  getLastInvoiceStats,   // nouveau
  exportLastInvoices,    // nouveau
  getContractInvoiceStats,   // nouveau
  getPaymentClickStats,
};
