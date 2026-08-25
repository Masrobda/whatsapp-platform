// src/services/session.service.js
//
// Gestion de la fenêtre de service client WhatsApp de 24h.
//
// Principe WhatsApp :
//   - un message ENTRANT du client ouvre/prolonge une fenêtre de 24h
//   - dans cette fenêtre : envoi libre (texte, média, chatbot) autorisé
//   - hors fenêtre : seul un template approuvé peut être envoyé
//
// Stockage hybride :
//   - Redis  = chemin rapide, vérifié à chaque envoi libre (TTL natif)
//   - Postgres = persistance durable pour le dashboard + les relances,
//                écrite en asynchrone pour ne jamais bloquer le webhook
//
// NOTE : normalizePhone est dupliqué ici volontairement, comme c'est déjà
// le cas entre message.service.js et wati.webhook.controller.js dans ce
// projet. Si un jour vous factorisez, mettez les 3 versions en commun.

const { query } = require('../config/database');
const logger = require('../utils/logger');
const { redisConnection } = require('../config/redis');
const axios = require('axios');
const crypto = require('crypto');

const WINDOW_SECONDS = 24 * 60 * 60; // 86400s = 24h

// ============================================================
// CLIENT REDIS
// ============================================================
// redisConnection peut être soit une instance ioredis déjà prête
// (réutilisée telle quelle), soit un objet d'options de connexion
// (host/port/password...) auquel cas on crée un client dédié.
let redisClient;
try {
  if (redisConnection && typeof redisConnection.set === 'function') {
    redisClient = redisConnection;
  } else {
    const Redis = require('ioredis');
    redisClient = new Redis(redisConnection);
  }
} catch (err) {
  logger.error('[SESSION] Impossible d\'initialiser le client Redis:', err.message);
  redisClient = null;
}

function normalizePhone(phone) {
  if (!phone) return null;
  let cleaned = phone.toString().trim().replace(/[\s\-\(\)\.]/g, '');
  let digits = cleaned.replace(/\D/g, '');
  let countryCode = '';
  let localNumber = digits;

  if (digits.startsWith('237'))      { countryCode = '237'; localNumber = digits.substring(3); }
  else if (digits.startsWith('33'))  { countryCode = '33';  localNumber = digits.substring(2); }
  else if (digits.startsWith('221')) { countryCode = '221'; localNumber = digits.substring(3); }
  else if (digits.startsWith('225')) { countryCode = '225'; localNumber = digits.substring(3); }
  else if (digits.startsWith('234')) { countryCode = '234'; localNumber = digits.substring(3); }
  else if (digits.startsWith('233')) { countryCode = '233'; localNumber = digits.substring(3); }
  else if (digits.startsWith('254')) { countryCode = '254'; localNumber = digits.substring(3); }
  else if (digits.startsWith('27'))  { countryCode = '27';  localNumber = digits.substring(2); }
  else {
    if (digits.length === 9) return `+237${digits}`;
    if (digits.length === 8) return `+2376${digits}`;
    return `+${digits}`;
  }

  if (countryCode === '237') {
    if (localNumber.length === 8) localNumber = '6' + localNumber;
    if (localNumber.length === 7) localNumber = '60' + localNumber;
  }

  return `+${countryCode}${localNumber}`;
}

function sessionKey(clientId, phone) {
  return `wsession:${clientId}:${phone}`;
}

// ============================================================
// NOTIFICATION DES WEBHOOKS CLIENTS (événements de session)
// Même logique que triggerClientWebhooks() dans wati.webhook.controller.js,
// dupliquée volontairement ici pour garder ce service indépendant.
// ============================================================
async function notifyClientWebhooks(clientId, event, data) {
  try {
    const webhooksResult = await query(
      `SELECT * FROM client_webhooks WHERE client_id = $1 AND is_active = true AND $2 = ANY(events)`,
      [clientId, event]
    );

    for (const webhook of webhooksResult.rows) {
      const payload = {
        event,
        timestamp: new Date().toISOString(),
        data,
      };
      const signature = crypto
        .createHmac('sha256', webhook.secret)
        .update(JSON.stringify(payload))
        .digest('hex');

      axios
        .post(webhook.url, payload, {
          headers: { 'Content-Type': 'application/json', 'X-Webhook-Signature': signature },
          timeout: 10000,
        })
        .catch(err => logger.error(`[SESSION] Webhook ${event} échoué (${webhook.url}):`, err.message));
    }
  } catch (err) {
    logger.error('[SESSION] Erreur notifyClientWebhooks:', err.message);
  }
}

// ============================================================
// OUVRIR / PROLONGER UNE SESSION (appelé à chaque message entrant)
// ============================================================
async function openOrExtendSession({ clientId, phone, channelNumber }) {
  const normalizedPhone = normalizePhone(phone);
  if (!clientId || !normalizedPhone) {
    logger.warn('[SESSION] openOrExtendSession appelé sans clientId ou phone valide');
    return { success: false };
  }

  // 1. Redis en priorité — chemin rapide, ne doit jamais bloquer le webhook
  if (redisClient) {
    redisClient
      .set(sessionKey(clientId, normalizedPhone), '1', 'EX', WINDOW_SECONDS)
      .catch(err => logger.error('[SESSION] Erreur SET Redis:', err.message));
  }

  try {
    // On regarde l'état AVANT upsert pour savoir si c'est une vraie réouverture
    // (et éviter de spammer le webhook client à chaque message pendant une
    // conversation déjà active)
    const prev = await query(
      `SELECT status, window_expires_at FROM whatsapp_sessions WHERE client_id = $1 AND recipient_phone = $2`,
      [clientId, normalizedPhone]
    );
    const wasClosed =
      prev.rows.length === 0 ||
      prev.rows[0].status !== 'active' ||
      new Date(prev.rows[0].window_expires_at) <= new Date();

    // 2. Postgres en asynchrone (fire-and-forget côté appelant, mais on
    //    catch ici pour ne jamais faire planter le flux webhook)
    await query(
      `INSERT INTO whatsapp_sessions
         (client_id, recipient_phone, channel_number, window_opened_at, window_expires_at, status, last_inbound_at)
       VALUES ($1, $2, $3, NOW(), NOW() + INTERVAL '24 hours', 'active', NOW())
       ON CONFLICT (client_id, recipient_phone) DO UPDATE SET
         channel_number     = EXCLUDED.channel_number,
         window_opened_at   = NOW(),
         window_expires_at  = NOW() + INTERVAL '24 hours',
         status              = 'active',
         last_inbound_at     = NOW(),
         updated_at          = NOW()`,
      [clientId, normalizedPhone, channelNumber || null]
    );
    logger.debug(`[SESSION] Ouverte/prolongée: client=${clientId} phone=${normalizedPhone}`);

    if (wasClosed) {
      notifyClientWebhooks(clientId, 'session.opened', { phone: normalizedPhone }).catch(() => {});
    }

    return { success: true };
  } catch (err) {
    logger.error('[SESSION] Erreur upsert Postgres:', err.message);
    return { success: false, error: err.message };
  }
}

// ============================================================
// VÉRIFIER SI LA SESSION EST ACTIVE (avant un envoi libre)
// ============================================================
async function isSessionActive({ clientId, phone }) {
  const normalizedPhone = normalizePhone(phone);
  if (!clientId || !normalizedPhone) return false;

  // 1. Chemin rapide : Redis
  if (redisClient) {
    try {
      const pttl = await redisClient.pttl(sessionKey(clientId, normalizedPhone));
      if (pttl > 0) return true;
      if (pttl === -2) {
        // clé absente de Redis : on tombe sur Postgres (fallback / cold start)
      }
    } catch (err) {
      logger.warn('[SESSION] Erreur PTTL Redis, fallback Postgres:', err.message);
    }
  }

  // 2. Fallback Postgres (Redis vidé, en panne, ou clé jamais posée)
  try {
    const result = await query(
      `SELECT status, window_expires_at
       FROM whatsapp_sessions
       WHERE client_id = $1 AND recipient_phone = $2`,
      [clientId, normalizedPhone]
    );
    if (result.rows.length === 0) return false;

    const row = result.rows[0];
    const active = row.status === 'active' && new Date(row.window_expires_at) > new Date();

    // Backfill Redis si Postgres dit "actif" mais Redis ne l'avait pas
    if (active && redisClient) {
      const remainingSeconds = Math.max(
        1,
        Math.floor((new Date(row.window_expires_at).getTime() - Date.now()) / 1000)
      );
      redisClient
        .set(sessionKey(clientId, normalizedPhone), '1', 'EX', remainingSeconds)
        .catch(() => {});
    }

    return active;
  } catch (err) {
    logger.error('[SESSION] Erreur vérification Postgres:', err.message);
    // En cas de doute, on ne bloque pas l'envoi (comportement permissif volontaire,
    // WATI refusera de toute façon l'envoi hors fenêtre au niveau de leur API)
    return true;
  }
}

// ============================================================
// INFOS DÉTAILLÉES D'UNE SESSION (pour dashboard / debug)
// ============================================================
async function getSessionInfo({ clientId, phone }) {
  const normalizedPhone = normalizePhone(phone);
  const result = await query(
    `SELECT * FROM whatsapp_sessions WHERE client_id = $1 AND recipient_phone = $2`,
    [clientId, normalizedPhone]
  );
  return result.rows[0] || null;
}

// ============================================================
// MARQUER L'ENVOI D'UN TEMPLATE DE RELANCE
// (n'ouvre PAS la fenêtre — seule une réponse du client le fait)
// ============================================================
async function recordTemplateSent({ clientId, phone }) {
  const normalizedPhone = normalizePhone(phone);
  try {
    await query(
      `UPDATE whatsapp_sessions
       SET last_template_sent_at = NOW(),
           reengagement_count    = reengagement_count + 1,
           updated_at            = NOW()
       WHERE client_id = $1 AND recipient_phone = $2`,
      [clientId, normalizedPhone]
    );
  } catch (err) {
    logger.error('[SESSION] Erreur recordTemplateSent:', err.message);
  }
}

// ============================================================
// RÉSOLUTION DU TEMPLATE DE RELANCE AUTOMATIQUE
// Priorité : config par client (clients.default_reengagement_template_name)
// Fallback : variables d'environnement globales
// ============================================================
async function getDefaultReengagementTemplate(clientId) {
  try {
    const result = await query(
      `SELECT default_reengagement_template_name AS "templateName",
              default_reengagement_template_language AS "templateLanguage"
       FROM clients WHERE id = $1`,
      [clientId]
    );
    const row = result.rows[0];
    if (row?.templateName) {
      return {
        templateName: row.templateName,
        templateLanguage: row.templateLanguage || 'fr',
      };
    }
  } catch (err) {
    logger.warn('[SESSION] Erreur lecture template de relance client:', err.message);
  }

  if (process.env.DEFAULT_REENGAGEMENT_TEMPLATE_NAME) {
    return {
      templateName: process.env.DEFAULT_REENGAGEMENT_TEMPLATE_NAME,
      templateLanguage: process.env.DEFAULT_REENGAGEMENT_TEMPLATE_LANGUAGE || 'fr',
    };
  }

  return null; // aucun template configuré nulle part → à traiter comme erreur fatale par l'appelant
}

async function getDefaultWelcomeTemplate(clientId) {
  try {
    const result = await query(
      `SELECT default_welcome_template_name AS "templateName",
              default_welcome_template_language AS "templateLanguage"
       FROM clients WHERE id = $1`,
      [clientId]
    );
    const row = result.rows[0];
    if (row?.templateName) {
      return {
        templateName: row.templateName,
        templateLanguage: row.templateLanguage || 'fr',
      };
    }
  } catch (err) {
    logger.warn('[SESSION] Erreur lecture template de bienvenue client:', err.message);
  }

  // Fallback : utiliser le template de relance s'il est défini
  const fallback = await getDefaultReengagementTemplate(clientId);
  if (fallback) return fallback;

  // Sinon variable d'environnement globale
  if (process.env.DEFAULT_WELCOME_TEMPLATE_NAME) {
    return {
      templateName: process.env.DEFAULT_WELCOME_TEMPLATE_NAME,
      templateLanguage: process.env.DEFAULT_WELCOME_TEMPLATE_LANGUAGE || 'fr',
    };
  }

  return null;
}

// ============================================================
// EXPIRATION EN BATCH (appelé par le worker de maintenance)
// ============================================================
async function expireSessionsBatch(maxBatch = 5000, maxIterations = 50) {
  let totalExpired = 0;

  for (let i = 0; i < maxIterations; i++) {
    const result = await query(
      `WITH to_expire AS (
         SELECT id FROM whatsapp_sessions
         WHERE status = 'active' AND window_expires_at < NOW()
         LIMIT $1
         FOR UPDATE SKIP LOCKED
       )
       UPDATE whatsapp_sessions ws
       SET status = 'expired', updated_at = NOW()
       FROM to_expire
       WHERE ws.id = to_expire.id
       RETURNING ws.id, ws.client_id, ws.recipient_phone`,
      [maxBatch]
    );

    totalExpired += result.rowCount;

    // Notifier chaque client concerné (fire-and-forget, ne bloque pas la boucle)
    for (const row of result.rows) {
      notifyClientWebhooks(row.client_id, 'session.expired', { phone: row.recipient_phone }).catch(() => {});
    }

    if (result.rowCount < maxBatch) break; // plus rien à expirer
  }

  return totalExpired;
}

// ============================================================
// STATISTIQUES POUR LE DASHBOARD
// ============================================================
async function getSessionStats({ clientId = null } = {}) {
  const params = [];
  let whereClause = '';
  if (clientId) {
    params.push(clientId);
    whereClause = 'WHERE client_id = $1';
  }

  const result = await query(
    `SELECT
       COUNT(*) FILTER (WHERE status = 'active' AND window_expires_at > NOW()) AS active,
       COUNT(*) FILTER (WHERE status = 'active' AND window_expires_at BETWEEN NOW() AND NOW() + INTERVAL '1 hour') AS expiring_soon,
       COUNT(*) FILTER (WHERE status = 'expired') AS expired,
       COUNT(*) AS total
     FROM whatsapp_sessions
     ${whereClause}`,
    params
  );

  return result.rows[0];
}

// ============================================================
// STATISTIQUES PAR PÉRIODE (mois, année)
// ============================================================
async function getSessionStatsByPeriod({ groupBy = 'month', year = null, month = null } = {}) {
  // Validation
  if (groupBy === 'month') {
    if (!year || !month) throw new Error('Pour un groupement mensuel, year et month sont requis');
  } else if (groupBy === 'year') {
    if (!year) throw new Error('Pour un groupement annuel, year est requis');
  } else {
    throw new Error('groupBy doit être "month" ou "year"');
  }

  // Définir les bornes de la période (UTC)
  let startDate, endDate, dateTrunc;
  if (groupBy === 'month') {
    // Du 1er du mois au 1er du mois suivant
    startDate = new Date(Date.UTC(year, month - 1, 1));
    endDate = new Date(Date.UTC(year, month, 1));
    dateTrunc = 'day'; // pour le groupement par jour
  } else { // year
    startDate = new Date(Date.UTC(year, 0, 1));
    endDate = new Date(Date.UTC(year + 1, 0, 1));
    dateTrunc = 'month'; // pour le groupement par mois
  }

  const params = [startDate.toISOString(), endDate.toISOString()];

  // Statistiques globales sur la période (total, actives)
  const globalStats = await query(
    `SELECT
       COUNT(*) FILTER (WHERE status = 'active' AND window_expires_at > NOW()) AS active,
       COUNT(*) AS total
     FROM whatsapp_sessions
     WHERE window_opened_at >= $1 AND window_opened_at < $2`,
    params
  );

  // Distribution par jour (pour mois) ou par mois (pour année)
  const distribution = await query(
    `SELECT
       DATE_TRUNC($3, window_opened_at) AS period,
       COUNT(*) AS count
     FROM whatsapp_sessions
     WHERE window_opened_at >= $1 AND window_opened_at < $2
     GROUP BY period
     ORDER BY period ASC`,
    [...params, dateTrunc]
  );

  return {
    global: globalStats.rows[0],
    distribution: distribution.rows.map(row => ({
      period: row.period,
      count: parseInt(row.count)
    }))
  };
}

// ============================================================
// LISTE PAGINÉE POUR LE DASHBOARD
// ============================================================
async function listSessions({ clientId = null, status = null, phone = null, page = 1, limit = 20 }) {
  const offset = (page - 1) * limit;
  const params = [];
  let whereClause = 'WHERE 1=1';

  if (clientId) {
    params.push(clientId);
    whereClause += ` AND client_id = $${params.length}`;
  }
  if (status) {
    params.push(status);
    whereClause += ` AND status = $${params.length}`;
  }
  if (phone) {
    params.push(`%${phone}%`);
    whereClause += ` AND recipient_phone ILIKE $${params.length}`;
  }

  const countResult = await query(
    `SELECT COUNT(*) FROM whatsapp_sessions ${whereClause}`,
    params
  );
  const total = parseInt(countResult.rows[0].count);

  const dataResult = await query(
    `SELECT id, client_id, recipient_phone, channel_number, status,
            window_opened_at, window_expires_at, last_inbound_at,
            last_template_sent_at, reengagement_count
     FROM whatsapp_sessions
     ${whereClause}
     ORDER BY window_expires_at DESC
     LIMIT $${params.length + 1} OFFSET $${params.length + 2}`,
    [...params, limit, offset]
  );

  return {
    sessions: dataResult.rows,
    pagination: {
      total,
      page: parseInt(page),
      limit: parseInt(limit),
      totalPages: Math.ceil(total / limit),
    },
  };
}

module.exports = {
  normalizePhone,
  openOrExtendSession,
  isSessionActive,
  getSessionInfo,
  recordTemplateSent,
  getDefaultReengagementTemplate,
  getDefaultWelcomeTemplate,
  expireSessionsBatch,
  getSessionStats,
  listSessions,
  WINDOW_SECONDS,
  getSessionStatsByPeriod,
};
