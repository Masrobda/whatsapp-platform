// src/services/campaign.service.js
// Module complet de gestion des campagnes WhatsApp
const { query, getClient } = require('../config/database');
const { v4: uuidv4 } = require('uuid');
const { addMessageToQueue } = require('./queue.service');
const { canSendToRecipient } = require('./message.service');
const logger = require('../utils/logger');
const csv = require('csv-parse/sync');
const xlsx = require('xlsx');

// ============================================================
// IMPORT DU DISPATCH QUEUE (AJOUTÉ)
// ============================================================
const { enqueueCampaignDispatch, removeDispatchJob } = require('./campaign-dispatch.queue');

const TVA_RATE = 0.1925; // 19.25%

// ============================================================
// CRÉATION & CONFIGURATION
// ============================================================

/**
 * Créer une nouvelle campagne
 */
async function createCampaign(clientId, userId, data) {
  const db = await getClient();
  try {
    await db.query('BEGIN');

    const {
      name, description, campaign_type = 'broadcast',
      template_id, template_name, template_language = 'fr', template_params = {},
      phone_number, send_mode = 'instant', batch_size = 50,
      batch_interval_seconds = 60, daily_limit = 5000, rate_per_minute = data.rate_per_minute || 4000,
      scheduled_at, priority = 5, category, tags = [],
      contacts = [], segment_ids = []
    } = data;

    if (!name?.trim()) throw { statusCode: 400, code: 'NAME_REQUIRED', message: 'Nom de campagne requis' };
    if (!phone_number) throw { statusCode: 400, code: 'PHONE_REQUIRED', message: 'Numéro émetteur requis' };
    if (!template_name && campaign_type !== 'ab_test') throw { statusCode: 400, code: 'TEMPLATE_REQUIRED', message: 'Template requis' };

    // Estimer le coût (0.005 USD par message en Cameroun)
    const totalContacts = contacts.length;
    const clientResult = await db.query(
      `SELECT message_cost FROM clients WHERE id = $1`,
      [clientId]
    );
    const ratePerMessage = clientResult.rows[0]?.message_cost || 20; // 20 FCFA par défaut
    const estimatedCost = totalContacts * (ratePerMessage);

    const campaignId = uuidv4();

    const result = await db.query(
      `INSERT INTO campaigns (
        id, client_id, name, description, status, campaign_type, priority, category,
        template_id, template_name, template_language, template_params, phone_number,
        send_mode, batch_size, batch_interval_seconds, daily_limit, rate_per_minute,
        scheduled_at, total_contacts, estimated_cost, tags, created_by, updated_by
      ) VALUES (
        $1,$2,$3,$4,'draft',$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19,$20,$21,$22,$22
      ) RETURNING *`,
      [
        campaignId, clientId, name.trim(), description || null, campaign_type,
        priority, category || null, template_id || null, template_name || null,
        template_language, JSON.stringify(template_params), phone_number,
        send_mode, batch_size, batch_interval_seconds, daily_limit, rate_per_minute,
        scheduled_at || null, totalContacts, estimatedCost,
        JSON.stringify(tags), userId
      ]
    );

    const campaign = result.rows[0];

    // Insérer les contacts si fournis
    if (contacts.length > 0) {
      const enrichedContacts = contacts.map(contact => ({
        ...contact,
        variables_order: contact.variables_order || contact._ordered_values || Object.values(contact.variables || {})
      }));
      await insertCampaignContacts(db, campaignId, contacts, 'manual');
    }

    // Assigner les segments
    for (const segmentId of segment_ids) {
      await db.query(
        `INSERT INTO campaign_segment_assignments (campaign_id, segment_id) VALUES ($1, $2) ON CONFLICT DO NOTHING`,
        [campaignId, segmentId]
      );
    }

    // Log
    await logCampaignEvent(db, campaignId, null, 'info', 'campaign.created',
      `Campagne "${name}" créée`, { totalContacts, send_mode });

    await db.query('COMMIT');
    logger.info(`Campagne créée: ${campaignId} par ${userId}`);

    return { success: true, campaign };
  } catch (error) {
    await db.query('ROLLBACK');
    logger.error('Erreur création campagne:', error);
    throw error;
  } finally {
    db.release();
  }
}

/**
 * Mettre à jour une campagne
 */
async function updateCampaign(campaignId, clientId, userId, updates) {
  const db = await getClient();
  try {
    await db.query('BEGIN');

    const campaign = await getCampaignById(campaignId, clientId);
    if (['running', 'completed', 'cancelled'].includes(campaign.status)) {
      throw { statusCode: 400, code: 'INVALID_STATUS', message: 'Impossible de modifier une campagne en cours ou terminée' };
    }

    const allowed = ['name','description','template_name','template_language','template_params',
      'phone_number','send_mode','batch_size','batch_interval_seconds','daily_limit',
      'rate_per_minute','scheduled_at','priority','category','tags'];

    const sets = [];
    const vals = [];
    let idx = 1;

    for (const key of allowed) {
      if (updates[key] !== undefined) {
        sets.push(`${key} = $${idx}`);
        vals.push(typeof updates[key] === 'object' ? JSON.stringify(updates[key]) : updates[key]);
        idx++;
      }
    }

    if (sets.length === 0) throw { statusCode: 400, code: 'NO_UPDATES', message: 'Aucune modification' };

    sets.push(`updated_by = $${idx}`, `updated_at = NOW()`);
    vals.push(userId, campaignId, clientId);

    await db.query(
      `UPDATE campaigns SET ${sets.join(', ')} WHERE id = $${idx + 1} AND client_id = $${idx + 2}`,
      vals
    );

    await logCampaignEvent(db, campaignId, null, 'info', 'campaign.updated', 'Campagne modifiée', updates);
    await db.query('COMMIT');

    return { success: true, campaign: await getCampaignById(campaignId, clientId) };
  } catch (error) {
    await db.query('ROLLBACK');
    throw error;
  } finally {
    db.release();
  }
}

// ============================================================
// GESTION DES CONTACTS
// ============================================================

/**
 * Insérer des contacts dans une campagne (helper interne)
 */
async function insertCampaignContacts(db, campaignId, contacts, source = 'manual') {
  if (!contacts || contacts.length === 0) return 0;

  const values = [];
  const params = [];
  let paramIdx = 1;

  for (const contact of contacts) {
    const phone = normalizePhoneForCampaign(contact.phone_number || contact.phone);
    if (!phone) continue;

    let variablesOrder = contact.variables_order || contact._ordered_values || [];

    if (variablesOrder.length === 0 && contact.variables) {
      variablesOrder = Object.values(contact.variables);
    }

    const variablesObj = contact.variables || {};
    const variablesOrderStr = JSON.stringify(variablesOrder);
    const variablesStr = JSON.stringify(variablesObj);

    values.push(`($${paramIdx++},$${paramIdx++},$${paramIdx++},$${paramIdx++},$${paramIdx++},$${paramIdx++},$${paramIdx++},'pending')`);
    params.push(
      uuidv4(), campaignId, phone,
      contact.name || null, contact.email || null,
      variablesStr,
      variablesOrderStr
    );
  }

  if (values.length === 0) return 0;

  const inserted = await db.query(
    `INSERT INTO campaign_contacts (id, campaign_id, phone_number, name, email, variables, variables_order, status)
     VALUES ${values.join(',')}
     ON CONFLICT (campaign_id, phone_number) DO NOTHING
     RETURNING id`,
    params
  );

  await db.query(
    `UPDATE campaigns SET total_contacts = (
      SELECT COUNT(*) FROM campaign_contacts WHERE campaign_id = $1
    ) WHERE id = $1`,
    [campaignId]
  );

  return inserted.rowCount;
}

/**
 * Importer des contacts depuis un CSV
 */
async function importContactsFromCSV(campaignId, clientId, fileBuffer, options = {}) {
  const db = await getClient();
  try {
    await db.query('BEGIN');

    const campaign = await getCampaignById(campaignId, clientId);
    if (!['draft', 'scheduled'].includes(campaign.status)) {
      throw { statusCode: 400, code: 'INVALID_STATUS', message: 'Import impossible sur une campagne active' };
    }

    const records = csv.parse(fileBuffer, {
      columns: true,
      skip_empty_lines: true,
      trim: true,
      bom: true,
    });

    const contacts = records.map(row => {
      const phone = row.phone_number || row.phone || row.telephone || row.numero || row['Téléphone'];
      const name = row.name || row.nom || row.prenom || row['Nom'] || row['Prénom'];
      const email = row.email || row['Email'];

      const variables = {};
      for (const [key, val] of Object.entries(row)) {
        if (!['phone_number','phone','telephone','numero','Téléphone','name','nom','prenom','Nom','Prénom','email','Email'].includes(key)) {
          variables[key] = val;
        }
      }

      return { phone_number: phone, name, email, variables };
    });

    const validContacts = [];
    const invalidPhones = [];

    for (const c of contacts) {
      const normalized = normalizePhoneForCampaign(c.phone_number);
      if (normalized) {
        validContacts.push({ ...c, phone_number: normalized });
      } else {
        invalidPhones.push(c.phone_number);
      }
    }

    const blacklisted = await db.query(
      `SELECT phone_number FROM campaign_blacklist WHERE client_id = $1 AND phone_number = ANY($2)`,
      [clientId, validContacts.map(c => c.phone_number)]
    );
    const blacklistedSet = new Set(blacklisted.rows.map(r => r.phone_number));

    const filteredContacts = validContacts.filter(c => !blacklistedSet.has(c.phone_number));

    const inserted = await insertCampaignContacts(db, campaignId, filteredContacts, 'csv');

    await logCampaignEvent(db, campaignId, null, 'info', 'contacts.imported',
      `${inserted} contacts importés depuis CSV`, {
        total: records.length,
        valid: validContacts.length,
        invalid: invalidPhones.length,
        blacklisted: blacklistedSet.size,
        inserted
      });

    await db.query('COMMIT');

    return {
      success: true,
      total: records.length,
      imported: inserted,
      invalid: invalidPhones.length,
      blacklisted: blacklistedSet.size,
      invalid_phones: invalidPhones.slice(0, 20)
    };
  } catch (error) {
    await db.query('ROLLBACK');
    throw error;
  } finally {
    db.release();
  }
}

/**
 * Détecte automatiquement si une variable contient un média (PDF, image, vidéo)
 * et retourne les informations du média
 */
function detectMediaFromVariables(variables) {
  if (!variables || typeof variables !== 'object') return null;

  const mediaPatterns = {
    pdf: /\.(pdf)$/i,
    image: /\.(png|jpg|jpeg|gif|webp)$/i,
    video: /\.(mp4|mov|avi|mkv|webm)$/i,
    audio: /\.(mp3|wav|ogg|m4a)$/i,
    document: /\.(doc|docx|xls|xlsx|ppt|pptx)$/i
  };

  for (const [key, value] of Object.entries(variables)) {
    if (typeof value === 'string') {
      const trimmedValue = value.trim();
      if (trimmedValue.startsWith('http://') || trimmedValue.startsWith('https://')) {
        for (const [mediaType, pattern] of Object.entries(mediaPatterns)) {
          if (pattern.test(trimmedValue)) {
            return {
              type: mediaType,
              url: trimmedValue,
              variableName: key,
              isMedia: true
            };
          }
        }
      }
    }
  }
  return null;
}

/**
 * Fusionne intelligemment les variables et détecte les médias
 */
function mergeTemplateParamsWithMediaDetection(defaultParams, contactVariables, contactName) {
  const merged = {
    ...(typeof defaultParams === 'string' ? JSON.parse(defaultParams) : defaultParams || {}),
    ...(contactVariables || {})
  };

  if (contactName && !merged.name) {
    merged.name = contactName;
  }

  const media = detectMediaFromVariables(merged);

  return {
    template_params: merged,
    media: media
  };
}

/**
 * Importer depuis Excel
 */
async function importContactsFromExcel(campaignId, clientId, fileBuffer) {
  const workbook = xlsx.read(fileBuffer, { type: 'buffer' });
  const sheetName = workbook.SheetNames[0];
  const sheet = workbook.Sheets[sheetName];
  const records = xlsx.utils.sheet_to_json(sheet);

  const contacts = records.map(row => {
    const phone = String(row.phone_number || row.phone || row.telephone || row['Téléphone'] || '');
    const name = row.name || row.nom || row['Nom'] || '';
    const email = row.email || row['Email'] || '';
    const variables = {};
    for (const [k, v] of Object.entries(row)) {
      if (!['phone_number','phone','telephone','Téléphone','name','nom','Nom','email','Email'].includes(k)) {
        variables[String(k)] = String(v || '');
      }
    }
    return { phone_number: phone, name: String(name), email: String(email), variables };
  });

  return importContactsFromCSVData(campaignId, clientId, contacts);
}

async function importContactsFromCSVData(campaignId, clientId, contacts) {
  const db = await getClient();
  try {
    await db.query('BEGIN');
    const inserted = await insertCampaignContacts(db, campaignId, contacts, 'csv');
    await db.query('COMMIT');
    return { success: true, imported: inserted };
  } catch(e) {
    await db.query('ROLLBACK');
    throw e;
  } finally {
    db.release();
  }
}

// ============================================================
// LANCEMENT & CONTRÔLE (MODIFIÉ SELON PATCH)
// ============================================================

/**
 * Lancer une campagne (VERSION AVEC BULLMQ)
 */
async function launchCampaign(campaignId, clientId, userId) {
  const db = await getClient();
  try {
    await db.query('BEGIN');

    const campaign = await getCampaignById(campaignId, clientId);

    if (!['draft', 'scheduled', 'paused'].includes(campaign.status)) {
      throw { statusCode: 400, code: 'INVALID_STATUS', message: `Impossible de lancer une campagne en état: ${campaign.status}` };
    }

    if (campaign.total_contacts === 0) {
      throw { statusCode: 400, code: 'NO_CONTACTS', message: 'Aucun contact dans la campagne' };
    }

    // Si planifiée dans le futur, ne pas lancer maintenant
    if (campaign.scheduled_at && new Date(campaign.scheduled_at) > new Date()) {
      await db.query(
        `UPDATE campaigns SET status = 'scheduled', updated_by = $2, updated_at = NOW() WHERE id = $1`,
        [campaignId, userId]
      );
      await db.query('COMMIT');
      return { success: true, status: 'scheduled', message: 'Campagne planifiée' };
    }

    // Lancer immédiatement : on passe en 'running' et on (ré)initialise le
    // curseur de dispatch UNIQUEMENT si on part d'un état 'draft'/'scheduled'.
    // Si on reprend depuis 'paused', le curseur existant est conservé tel quel
    // (reprise exacte là où le dispatch s'était arrêté).
    if (campaign.status === 'paused') {
      await db.query(
        `UPDATE campaigns SET status = 'running', updated_by = $2, updated_at = NOW() WHERE id = $1`,
        [campaignId, userId]
      );
    } else {
      await db.query(
        `UPDATE campaigns
         SET status = 'running', started_at = NOW(), dispatch_cursor = NULL,
             dispatch_status = 'idle', updated_by = $2, updated_at = NOW()
         WHERE id = $1`,
        [campaignId, userId]
      );
    }

    await logCampaignEvent(db, campaignId, null, 'info', 'campaign.launched',
      `Campagne lancée par ${userId}`, { send_mode: campaign.send_mode });

    await db.query('COMMIT');

    // Enfiler le job de dispatch (persistant, survit aux restarts PM2).
    // jobId = campaignId => idempotent, jamais deux dispatchs en parallèle
    // pour la même campagne, même en cas de double-clic ou retry réseau.
    await enqueueCampaignDispatch(campaignId);

    return { success: true, status: 'running', message: 'Campagne lancée' };
  } catch (error) {
    await db.query('ROLLBACK');
    throw error;
  } finally {
    db.release();
  }
}

// ============================================================
// LA FONCTION processCampaignSend A ÉTÉ SUPPRIMÉE (REMPLACÉE PAR LE WORKER)
// ============================================================

/**
 * Mettre en pause une campagne (MODIFIÉ : ajout dispatch_status)
 */
async function pauseCampaign(campaignId, clientId, userId) {
  const campaign = await getCampaignById(campaignId, clientId);
  if (campaign.status !== 'running') {
    throw { statusCode: 400, code: 'NOT_RUNNING', message: 'La campagne n\'est pas en cours' };
  }

  await query(
    `UPDATE campaigns
     SET status = 'paused', paused_at = NOW(), dispatch_status = 'idle',
         updated_by = $2, updated_at = NOW()
     WHERE id = $1`,
    [campaignId, userId]
  );

  await logCampaignEventDirect(campaignId, 'warn', 'campaign.paused', `Pausée par ${userId}`);
  return { success: true };
}

/**
 * Annuler une campagne (MODIFIÉ : ajout dispatch_status et removeDispatchJob)
 */
async function cancelCampaign(campaignId, clientId, userId) {
  const campaign = await getCampaignById(campaignId, clientId);
  if (['completed', 'cancelled'].includes(campaign.status)) {
    throw { statusCode: 400, code: 'ALREADY_DONE', message: 'Campagne déjà terminée ou annulée' };
  }

  await query(
    `UPDATE campaigns
     SET status = 'cancelled', dispatch_status = 'idle', updated_by = $2, updated_at = NOW()
     WHERE id = $1`,
    [campaignId, userId]
  );

  await query(
    `UPDATE campaign_contacts SET status = 'skipped', skip_reason = 'Campaign cancelled', updated_at = NOW()
     WHERE campaign_id = $1 AND status IN ('pending','queued')`,
    [campaignId]
  );

  // Retire le job BullMQ s'il est encore en attente (pas encore démarré).
  // S'il est déjà actif, il s'arrêtera lui-même au prochain checkpoint.
  await removeDispatchJob(campaignId);

  await logCampaignEventDirect(campaignId, 'warn', 'campaign.cancelled', `Annulée par ${userId}`);
  return { success: true };
}

/**
 * Récupérer l'état du dispatch d'une campagne (NOUVEAU)
 */
async function getCampaignDispatchStatus(campaignId, clientId) {
  const campaign = await getCampaignById(campaignId, clientId);
  const { getDispatchJobStatus } = require('./campaign-dispatch.queue');
  const jobStatus = await getDispatchJobStatus(campaignId);

  return {
    success: true,
    campaign_status: campaign.status,
    dispatch_status: campaign.dispatch_status,
    dispatch_cursor: campaign.dispatch_cursor,
    job: jobStatus,
  };
}

/**
 * Marquer une campagne comme échouée
 */
async function markCampaignFailed(campaignId, reason) {
  await query(
    `UPDATE campaigns SET status = 'failed', updated_at = NOW() WHERE id = $1`,
    [campaignId]
  );
  await logCampaignEventDirect(campaignId, 'error', 'campaign.failed', reason);
}

// ============================================================
// LECTURE & STATISTIQUES
// ============================================================

async function getCampaigns(clientId, filters = {}) {
  console.log('🔍 getCampaigns appelé avec clientId:', clientId);

  const { page = 1, limit = 20, status, search, category, campaign_type } = filters;
  const offset = (page - 1) * limit;

  let where = 'WHERE c.client_id = $1';
  const params = [clientId];
  let idx = 2;

  if (status) { where += ` AND c.status = $${idx++}`; params.push(status); }
  if (campaign_type) { where += ` AND c.campaign_type = $${idx++}`; params.push(campaign_type); }
  if (category) { where += ` AND c.category = $${idx++}`; params.push(category); }
  if (search) {
    where += ` AND (c.name ILIKE $${idx} OR c.description ILIKE $${idx})`;
    params.push(`%${search}%`); idx++;
  }

  const countRes = await query(`SELECT COUNT(*) FROM campaigns c ${where}`, params);
  const total = parseInt(countRes.rows[0].count);

  const res = await query(
    `SELECT c.*,
       CASE WHEN c.total_contacts > 0
         THEN ROUND((c.delivered_count::numeric / c.total_contacts) * 100, 1)
         ELSE 0 END as delivery_rate,
       CASE WHEN c.delivered_count > 0
         THEN ROUND((c.read_count::numeric / c.delivered_count) * 100, 1)
         ELSE 0 END as read_rate,
       u.email as created_by_email
     FROM campaigns c
     LEFT JOIN users u ON c.created_by = u.id
     ${where}
     ORDER BY c.created_at DESC
     LIMIT $${idx} OFFSET $${idx+1}`,
    [...params, limit, offset]
  );

  return {
    success: true,
    campaigns: res.rows,
    pagination: { total, page: parseInt(page), limit: parseInt(limit), totalPages: Math.ceil(total / limit) }
  };
}

async function getCampaignById(campaignId, clientId) {
  const res = await query(
    `SELECT c.*,
       CASE WHEN c.total_contacts > 0
         THEN ROUND((c.delivered_count::numeric / c.total_contacts) * 100, 1)
         ELSE 0 END as delivery_rate,
       CASE WHEN c.delivered_count > 0
         THEN ROUND((c.read_count::numeric / c.delivered_count) * 100, 1)
         ELSE 0 END as read_rate,
       u.email as created_by_email
     FROM campaigns c
     LEFT JOIN users u ON c.created_by = u.id
     WHERE c.id = $1 ${clientId ? 'AND c.client_id = $2' : ''}`,
    clientId ? [campaignId, clientId] : [campaignId]
  );

  if (res.rows.length === 0) {
    throw { statusCode: 404, code: 'NOT_FOUND', message: 'Campagne non trouvée' };
  }
  return res.rows[0];
}

async function getCampaignStats(campaignId, clientId) {
  const campaign = await getCampaignById(campaignId, clientId);

  const daily = await query(
    `SELECT stat_date, sent, delivered, read, failed, replied, cost
     FROM campaign_stats_daily
     WHERE campaign_id = $1
     ORDER BY stat_date ASC`,
    [campaignId]
  );

  const contactStats = await query(
    `SELECT status, COUNT(*) as count
     FROM campaign_contacts
     WHERE campaign_id = $1
     GROUP BY status`,
    [campaignId]
  );

  const statusMap = {};
  for (const row of contactStats.rows) {
    statusMap[row.status] = parseInt(row.count);
  }

  return {
    success: true,
    campaign: {
      id: campaign.id,
      name: campaign.name,
      status: campaign.status,
      total_contacts: campaign.total_contacts,
      sent_count: campaign.sent_count,
      delivered_count: campaign.delivered_count,
      read_count: campaign.read_count,
      failed_count: campaign.failed_count,
      replied_count: campaign.replied_count,
      delivery_rate: campaign.delivery_rate,
      read_rate: campaign.read_rate,
      actual_cost: campaign.actual_cost,
      started_at: campaign.started_at,
      completed_at: campaign.completed_at
    },
    contact_status_breakdown: statusMap,
    daily_stats: daily.rows
  };
}

async function getGlobalCampaignStats(clientId) {
  if (!clientId) {
    throw { statusCode: 400, code: 'CLIENT_ID_REQUIRED', message: 'Client ID requis' };
  }

  const res = await query(
    `SELECT
       COUNT(*) as total_campaigns,
       COUNT(CASE WHEN status = 'running' THEN 1 END) as active_campaigns,
       COUNT(CASE WHEN status = 'completed' THEN 1 END) as completed_campaigns,
       COALESCE(SUM(total_contacts), 0) as total_contacts,
       COALESCE(SUM(sent_count), 0) as total_sent,
       COALESCE(SUM(delivered_count), 0) as total_delivered,
       COALESCE(SUM(read_count), 0) as total_read,
       COALESCE(SUM(failed_count), 0) as total_failed,
       COALESCE(SUM(actual_cost), 0) as total_cost,
       COALESCE(SUM(replied_count), 0) as total_replied,
       CASE WHEN SUM(sent_count) > 0
         THEN ROUND((SUM(delivered_count)::numeric / SUM(sent_count)) * 100, 1)
         ELSE 0 END as avg_delivery_rate,
       CASE WHEN SUM(delivered_count) > 0
         THEN ROUND((SUM(read_count)::numeric / SUM(delivered_count)) * 100, 1)
         ELSE 0 END as avg_read_rate
     FROM campaigns
     WHERE client_id = $1`,
    [clientId]
  );

  const recent = await query(
    `SELECT id, name, status, total_contacts, sent_count, delivered_count, read_count,
       created_at, started_at, completed_at
     FROM campaigns
     WHERE client_id = $1
     ORDER BY created_at DESC
     LIMIT 5`,
    [clientId]
  );

  const dailyStats = await query(
    `SELECT
       ds.stat_date,
       SUM(ds.sent) as sent,
       SUM(ds.delivered) as delivered,
       SUM(ds.read) as read,
       SUM(ds.failed) as failed,
       SUM(ds.cost) as cost
     FROM campaign_stats_daily ds
     INNER JOIN campaigns c ON c.id = ds.campaign_id
     WHERE c.client_id = $1
       AND ds.stat_date >= (CURRENT_DATE - INTERVAL '7 days')
     GROUP BY ds.stat_date
     ORDER BY ds.stat_date ASC`,
    [clientId]
  );

  return {
    success: true,
    stats: res.rows[0],
    recent_campaigns: recent.rows,
    daily_stats: dailyStats.rows
  };
}

async function getCampaignContacts(campaignId, clientId, filters = {}) {
  await getCampaignById(campaignId, clientId);
  const { page = 1, limit = 50, status, search } = filters;
  const offset = (page - 1) * limit;

  let where = 'WHERE campaign_id = $1';
  const params = [campaignId];
  let idx = 2;

  if (status) { where += ` AND status = $${idx++}`; params.push(status); }
  if (search) {
    where += ` AND (phone_number ILIKE $${idx} OR name ILIKE $${idx})`;
    params.push(`%${search}%`); idx++;
  }

  const countRes = await query(`SELECT COUNT(*) FROM campaign_contacts ${where}`, params);
  const total = parseInt(countRes.rows[0].count);

  const res = await query(
    `SELECT * FROM campaign_contacts ${where} ORDER BY created_at ASC LIMIT $${idx} OFFSET $${idx+1}`,
    [...params, limit, offset]
  );

  return {
    success: true,
    contacts: res.rows,
    pagination: { total, page: parseInt(page), limit: parseInt(limit), totalPages: Math.ceil(total / limit) }
  };
}

async function getCampaignLogs(campaignId, clientId, filters = {}) {
  await getCampaignById(campaignId, clientId);
  const { limit = 100, level } = filters;

  let where = 'WHERE campaign_id = $1';
  const params = [campaignId];
  if (level) { where += ' AND level = $2'; params.push(level); }

  const res = await query(
    `SELECT * FROM campaign_logs ${where} ORDER BY created_at DESC LIMIT $${params.length + 1}`,
    [...params, limit]
  );

  return { success: true, logs: res.rows };
}

// ============================================================
// UTILITAIRES INTERNES
// ============================================================

async function logCampaignEvent(db, campaignId, contactId, level, event, message, metadata = {}) {
  await db.query(
    `INSERT INTO campaign_logs (id, campaign_id, contact_id, level, event, message, metadata)
     VALUES ($1,$2,$3,$4,$5,$6,$7)`,
    [uuidv4(), campaignId, contactId, level, event, message, JSON.stringify(metadata)]
  );
}

async function logCampaignEventDirect(campaignId, level, event, message, metadata = {}) {
  try {
    await query(
      `INSERT INTO campaign_logs (id, campaign_id, level, event, message, metadata)
       VALUES ($1,$2,$3,$4,$5,$6)`,
      [uuidv4(), campaignId, level, event, message, JSON.stringify(metadata)]
    );
  } catch(e) {
    logger.error('Erreur log campagne:', e);
  }
}

function normalizePhoneForCampaign(phone) {
  if (!phone) return null;
  let cleaned = String(phone).replace(/[\s\-\(\)\.]/g, '').replace(/\D/g, '');
  if (!cleaned) return null;

  if (cleaned.startsWith('237') && cleaned.length >= 12) return `+${cleaned}`;
  if (cleaned.length === 9) return `+237${cleaned}`;
  if (cleaned.length === 8) return `+2376${cleaned}`;
  if (cleaned.length >= 10) return `+${cleaned}`;
  return null;
}

// ============================================================
// LA FONCTION sleep A ÉTÉ SUPPRIMÉE (PLUS UTILISÉE)
// ============================================================

/**
 * fonction utilitaire
 */
function parseContactVariables(variables) {
  if (!variables) return {};
  if (typeof variables === 'object') return variables;
  if (typeof variables === 'string') {
    try {
      return JSON.parse(variables);
    } catch(e) {
      console.error('Erreur parsing variables:', e);
      return {};
    }
  }
  return {};
}

/**
 * Extrait l'ordre des variables depuis le body_content du template
 * Retourne un tableau comme [1, 2, 3, 4, 5, 6, 7, 8]
 */
async function getTemplateVariableOrderFromBody(templateName) {
  const result = await query(
    `SELECT body_content FROM templates WHERE name = $1 AND status = 'approved'`,
    [templateName]
  );

  if (result.rows.length === 0) {
    return null;
  }

  const bodyContent = result.rows[0].body_content;

  const regex = /{{(\d+)}}/g;
  const matches = [...bodyContent.matchAll(regex)];
  const positions = matches.map(m => parseInt(m[1]));

  const uniquePositions = [...new Set(positions)];
  uniquePositions.sort((a, b) => a - b);

  return uniquePositions;
}

/**
 * Mettre à jour le statut d'un contact de campagne (via webhook WATI)
 
async function updateCampaignContactStatus(waMessageId, newStatus, messageId = null, clientId = null) {
  try {
    console.log(`📊 updateCampaignContactStatus: waMessageId=${waMessageId}, newStatus=${newStatus}, messageId=${messageId}`);

    let campaign_id = null;
    let contact_id = null;

    if (messageId) {
      const indexResult = await query(
        `SELECT campaign_id, contact_id FROM message_id_index WHERE message_id = $1 LIMIT 1`,
        [messageId]
      );
      if (indexResult.rows.length > 0) {
        campaign_id = indexResult.rows[0].campaign_id;
        contact_id = indexResult.rows[0].contact_id;
      } else {
        const msgResult = await query(
          `SELECT  campaign_id, metadata->>'contact_id' as contact_id
           FROM messages
           WHERE id = $1
             AND created_at > NOW() - INTERVAL '30 days'
           LIMIT 1`,
          [messageId]
        );
        if (msgResult.rows.length > 0) {
          campaign_id = msgResult.rows[0].campaign_id;
          contact_id = msgResult.rows[0].contact_id;
        }
      }
    }

    if (!campaign_id || !contact_id) {
      const indexResult = await query(
        `SELECT campaign_id, contact_id FROM message_id_index WHERE wa_message_id = $1 LIMIT 1`,
        [waMessageId]
      );
      if (indexResult.rows.length > 0) {
        campaign_id = indexResult.rows[0].campaign_id;
        contact_id = indexResult.rows[0].contact_id;
      } else {
        const msgResult = await query(
          `SELECT  campaign_id, metadata->>'contact_id' as contact_id
           FROM messages
           WHERE wa_message_id = $1
             AND created_at > NOW() - INTERVAL '30 days'
           LIMIT 1`,
          [waMessageId]
        );
        if (msgResult.rows.length > 0) {
          campaign_id = msgResult.rows[0].campaign_id;
          contact_id = msgResult.rows[0].contact_id;
        }
      }
    }

    if (!campaign_id || !contact_id) {
      console.log(`❌ Aucun message trouvé pour waMessageId=${waMessageId} ou messageId=${messageId}`);
      return;
    }

    const tsField = { sent: 'sent_at', delivered: 'delivered_at', read: 'read_at', failed: 'failed_at' }[newStatus];
    await query(
      `UPDATE campaign_contacts
       SET status = $1 ${tsField ? `, ${tsField} = NOW()` : ''}, updated_at = NOW()
       WHERE id = $2`,
      [newStatus, contact_id]
    );

    if (newStatus === 'delivered') {
      await query(
        `UPDATE campaign_contacts
         SET sent_at = NOW()
         WHERE id = $1 AND sent_at IS NULL`,
        [contact_id]
      );
    }

    const incrementField = {
      sent: 'sent_count',
      delivered: 'delivered_count',
      read: 'read_count',
      failed: 'failed_count'
    }[newStatus];

    if (incrementField) {
      await query(
        `UPDATE campaigns
         SET ${incrementField} = ${incrementField} + 1,
             updated_at = NOW()
         WHERE id = $1`,
        [campaign_id]
      );
    }

    if (newStatus === 'delivered') {
      const costPerMessage = parseFloat(process.env.WATI_COST_PER_MESSAGE || 0.032258);
      await query(
        `UPDATE campaigns
         SET actual_cost = COALESCE(actual_cost, 0) + $1
         WHERE id = $2`,
        [costPerMessage, campaign_id]
      );
    }

    console.log(`✅ Campaign ${campaign_id} mis à jour: ${newStatus} (contact ${contact_id})`);

  } catch (error) {
    console.error('❌ Erreur updateCampaignContactStatus:', error);
  }
}*/

async function updateCampaignContactStatus(waMessageId, newStatus, messageId = null, clientId = null) {
  try {
    console.log(`📊 updateCampaignContactStatus: waMessageId=${waMessageId}, newStatus=${newStatus}, messageId=${messageId}`);

    let campaign_id = null;
    let contact_id = null;

    // 1. Recherche du message (idem que précédemment)
    if (messageId) {
      const indexResult = await query(
        `SELECT campaign_id, contact_id FROM message_id_index WHERE message_id = $1 LIMIT 1`,
        [messageId]
      );
      if (indexResult.rows.length > 0) {
        campaign_id = indexResult.rows[0].campaign_id;
        contact_id = indexResult.rows[0].contact_id;
      } else {
        const msgResult = await query(
          `SELECT campaign_id, metadata->>'contact_id' as contact_id
           FROM messages
           WHERE id = $1
             AND created_at > NOW() - INTERVAL '30 days'
           LIMIT 1`,
          [messageId]
        );
        if (msgResult.rows.length > 0) {
          campaign_id = msgResult.rows[0].campaign_id;
          contact_id = msgResult.rows[0].contact_id;
        }
      }
    }

    if (!campaign_id || !contact_id) {
      const indexResult = await query(
        `SELECT campaign_id, contact_id FROM message_id_index WHERE wa_message_id = $1 LIMIT 1`,
        [waMessageId]
      );
      if (indexResult.rows.length > 0) {
        campaign_id = indexResult.rows[0].campaign_id;
        contact_id = indexResult.rows[0].contact_id;
      } else {
        const msgResult = await query(
          `SELECT campaign_id, metadata->>'contact_id' as contact_id
           FROM messages
           WHERE wa_message_id = $1
             AND created_at > NOW() - INTERVAL '30 days'
           LIMIT 1`,
          [waMessageId]
        );
        if (msgResult.rows.length > 0) {
          campaign_id = msgResult.rows[0].campaign_id;
          contact_id = msgResult.rows[0].contact_id;
        }
      }
    }

    if (!campaign_id || !contact_id) {
      console.log(`❌ Aucun message trouvé pour waMessageId=${waMessageId} ou messageId=${messageId}`);
      return;
    }

    // 2. Lire l’ancien statut du contact (pour ne compter le coût qu’à la première transition vers 'sent')
    const before = await query(
      `SELECT status FROM campaign_contacts WHERE id = $1`,
      [contact_id]
    );
    const oldStatus = before.rows[0]?.status || '';

    // 3. Mise à jour du statut et des timestamps
    const tsField = { sent: 'sent_at', delivered: 'delivered_at', read: 'read_at', failed: 'failed_at' }[newStatus];
    await query(
      `UPDATE campaign_contacts
       SET status = $1 ${tsField ? `, ${tsField} = NOW()` : ''}, updated_at = NOW()
       WHERE id = $2`,
      [newStatus, contact_id]
    );

    if (newStatus === 'delivered') {
      await query(
        `UPDATE campaign_contacts
         SET sent_at = NOW()
         WHERE id = $1 AND sent_at IS NULL`,
        [contact_id]
      );
    }

    // 4. Incrémenter les compteurs de la campagne
    const incrementField = {
      sent: 'sent_count',
      delivered: 'delivered_count',
      read: 'read_count',
      failed: 'failed_count'
    }[newStatus];

    if (incrementField) {
      await query(
        `UPDATE campaigns
         SET ${incrementField} = ${incrementField} + 1,
             updated_at = NOW()
         WHERE id = $1`,
        [campaign_id]
      );
    }

    // 5. ✅ AJOUT DU COÛT RÉEL (si premier passage à 'sent')
   if (newStatus === 'sent' && oldStatus !== 'sent') {
      const costRes = await query(
        `SELECT c.message_cost 
         FROM campaigns ca 
         JOIN clients c ON c.id = ca.client_id 
         WHERE ca.id = $1`,
        [campaign_id]
      );

      const unitPrice = parseFloat(costRes.rows[0]?.message_cost) || 20;
      const costTTC = unitPrice * (1 + TVA_RATE);

      await query(
        `UPDATE campaigns 
         SET actual_cost = COALESCE(actual_cost, 0) + $1 
         WHERE id = $2`,
        [costTTC, campaign_id]
      );

      console.log(`💰 Coût ajouté : ${costTTC.toFixed(2)} FCFA (unitaire = ${unitPrice})`);
    }

    console.log(`✅ Campaign ${campaign_id} mis à jour: ${newStatus} (contact ${contact_id})`);

  } catch (error) {
    console.error('❌ Erreur updateCampaignContactStatus:', error);
  }
}

// ============================================================
// EXPORT (AJOUT DE getCampaignDispatchStatus)
// ============================================================

module.exports = {
  createCampaign,
  updateCampaign,
  getCampaigns,
  getCampaignById,
  getCampaignStats,
  getGlobalCampaignStats,
  getCampaignContacts,
  getCampaignLogs,
  launchCampaign,
  pauseCampaign,
  cancelCampaign,
  importContactsFromCSV,
  importContactsFromExcel,
  updateCampaignContactStatus,
  normalizePhoneForCampaign,
  getCampaignDispatchStatus, // <-- NOUVEAU
};
