// src/services/audience.service.js
// Module Audience — Carnet de contacts centralisé, réutilisable entre campagnes
const { query, getClient } = require('../config/database');
const { v4: uuidv4 } = require('uuid');
const { addMessageToQueue } = require('./queue.service');
const { canSendToRecipient } = require('./message.service');
const logger = require('../utils/logger');
const csv = require('csv-parse/sync');
const xlsx = require('xlsx');

// ============================================================
// NORMALISATION TÉLÉPHONE (cohérent avec campaign.service.js)
// ============================================================
function normalizePhone(phone) {
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
// DÉTECTION DE MÉDIA DANS UNE URL (pour le renvoi avec nouveau lien)
// ============================================================
function detectMediaType(url) {
  if (!url || typeof url !== 'string') return null;
  const trimmed = url.trim();
  if (!trimmed.startsWith('http://') && !trimmed.startsWith('https://')) return null;

  const patterns = {
    pdf: /\.(pdf)$/i,
    image: /\.(png|jpg|jpeg|gif|webp)$/i,
    video: /\.(mp4|mov|avi|mkv|webm)$/i,
    audio: /\.(mp3|wav|ogg|m4a)$/i,
    document: /\.(doc|docx|xls|xlsx|ppt|pptx)$/i,
  };
  for (const [type, pattern] of Object.entries(patterns)) {
    if (pattern.test(trimmed)) return { type, url: trimmed };
  }
  // URL sans extension reconnue mais valide quand même (ex: lien de stockage cloud)
  return { type: 'document', url: trimmed };
}

// ============================================================
// CRUD CONTACTS AUDIENCE
// ============================================================

/**
 * Liste paginée + filtrée des contacts de l'audience
 * Supporte: recherche, tags, segments dynamiques (filtres avancés), tri, limite ("50 premiers")
 * Ajout : filtre par liste (list_id)
 */
async function getAudienceContacts(clientId, filters = {}) {
  const {
    page = 1, limit = 50, search, tags, status, source,
    min_campaigns, max_campaigns, opted_out,
    sort = 'recent', // recent | oldest | most_campaigns | least_campaigns | name
    dynamic_filters = [], // [{field, operator, value}] — style Phase 2
    logic = 'AND',
    take_first_n, // pour "les 50 premiers, 100 etc"
    list_id,      // filtre par liste statique
    contact_ids,
  } = filters;

  const offset = (page - 1) * limit;
  const params = [clientId];
  let idx = 2;
  let where = 'WHERE ac.client_id = $1 AND ac.is_active = true';

  // Filtre par liste (jointure avec audience_list_members)
  if (list_id) {
    where += ` AND ac.id IN (SELECT audience_contact_id FROM audience_list_members WHERE list_id = $${idx})`;
    params.push(list_id);
    idx++;
  }

   // Filtre par IDs de contacts sélectionnés
if (contact_ids && Array.isArray(contact_ids) && contact_ids.length > 0) {
  where += ` AND ac.id = ANY($${idx}::uuid[])`;
  params.push(contact_ids);
  idx++;
}


  if (search) {
    where += ` AND (ac.phone_number ILIKE $${idx} OR ac.name ILIKE $${idx} OR ac.email ILIKE $${idx})`;
    params.push(`%${search}%`); idx++;
  }
  if (status) { where += ` AND ac.last_status = $${idx++}`; params.push(status); }
  if (source) { where += ` AND ac.source = $${idx++}`; params.push(source); }
  if (min_campaigns !== undefined) { where += ` AND ac.campaigns_count >= $${idx++}`; params.push(min_campaigns); }
  if (max_campaigns !== undefined) { where += ` AND ac.campaigns_count <= $${idx++}`; params.push(max_campaigns); }
  if (opted_out !== undefined) { where += ` AND ac.is_opted_out = $${idx++}`; params.push(opted_out); }
  if (tags && tags.length > 0) {
    where += ` AND ac.tags ?| $${idx++}`;
    params.push(tags);
  }

  // Filtres dynamiques façon Phase 2 (segments)
  const ALLOWED_OPS = {
    eq: '=', neq: '!=', gt: '>', gte: '>=', lt: '<', lte: '<=',
    like: 'ILIKE', is_null: 'IS NULL', is_not_null: 'IS NOT NULL',
  };
  const ALLOWED_COLS = {
    'campaigns_count': 'ac.campaigns_count',
    'total_delivered': 'ac.total_delivered',
    'total_read': 'ac.total_read',
    'total_failed': 'ac.total_failed',
    'last_campaign_at': 'ac.last_campaign_at',
    'last_status': 'ac.last_status',
    'created_at': 'ac.created_at',
  };
  const dynConditions = [];
  for (const f of dynamic_filters) {
    const col = ALLOWED_COLS[f.field];
    const op = ALLOWED_OPS[f.operator];
    if (!col || !op) continue;
    if (op === 'IS NULL' || op === 'IS NOT NULL') {
      dynConditions.push(`${col} ${op}`);
    } else if (op === 'ILIKE') {
      params.push(`%${f.value}%`); dynConditions.push(`${col} ${op} $${idx++}`);
    } else {
      params.push(f.value); dynConditions.push(`${col} ${op} $${idx++}`);
    }
  }
  if (dynConditions.length > 0) {
    where += ` AND (${dynConditions.join(` ${logic} `)})`;
  }

  const sortMap = {
    recent: 'ac.last_campaign_at DESC NULLS LAST',
    oldest: 'ac.created_at ASC',
    most_campaigns: 'ac.campaigns_count DESC',
    least_campaigns: 'ac.campaigns_count ASC',
    name: 'ac.name ASC NULLS LAST',
    never_contacted: 'ac.campaigns_count ASC, ac.created_at ASC',
  };
  const orderBy = sortMap[sort] || sortMap.recent;

  const countRes = await query(`SELECT COUNT(*) FROM audience_contacts ac ${where}`, params);
  const total = parseInt(countRes.rows[0].count);

  const effectiveLimit = take_first_n ? Math.min(take_first_n, limit) : limit;

  const res = await query(
    `SELECT ac.* FROM audience_contacts ac
     ${where}
     ORDER BY ${orderBy}
     LIMIT $${idx} OFFSET $${idx + 1}`,
    [...params, effectiveLimit, take_first_n ? 0 : offset]
  );

  return {
    success: true,
    contacts: res.rows,
    pagination: {
      total, page: parseInt(page), limit: effectiveLimit,
      totalPages: Math.ceil(total / effectiveLimit),
    },
  };
}

async function getAudienceStats(clientId) {
  const res = await query(
    `SELECT
       COUNT(*) as total_contacts,
       COUNT(*) FILTER (WHERE is_opted_out = true) as opted_out_count,
       COUNT(*) FILTER (WHERE campaigns_count = 0) as never_contacted,
       COUNT(*) FILTER (WHERE last_campaign_at >= NOW() - INTERVAL '30 days') as active_30d,
       COALESCE(AVG(campaigns_count), 0) as avg_campaigns_per_contact,
       COALESCE(SUM(total_delivered), 0) as total_delivered_all,
       COALESCE(SUM(total_read), 0) as total_read_all
     FROM audience_contacts
     WHERE client_id = $1 AND is_active = true`,
    [clientId]
  );

  const bySource = await query(
    `SELECT source, COUNT(*) as count FROM audience_contacts
     WHERE client_id = $1 AND is_active = true GROUP BY source`,
    [clientId]
  );

  return { success: true, stats: res.rows[0], by_source: bySource.rows };
}

async function getContactDetail(clientId, contactId) {
  const res = await query(
    `SELECT * FROM audience_contacts WHERE id = $1 AND client_id = $2`,
    [contactId, clientId]
  );
  if (!res.rows[0]) throw { statusCode: 404, code: 'NOT_FOUND', message: 'Contact non trouvé' };

  const history = await query(
    `SELECT acc.*, c.name as campaign_name, c.template_name, c.status as campaign_status
     FROM audience_contact_campaigns acc
     JOIN campaigns c ON c.id = acc.campaign_id
     WHERE acc.audience_contact_id = $1
     ORDER BY acc.created_at DESC`,
    [contactId]
  );

  return { success: true, contact: res.rows[0], campaign_history: history.rows };
}

// ============================================================
// AJOUT / IMPORT DE CONTACTS
// ============================================================

/**
 * Ajouter/Mettre à jour un ou plusieurs contacts (upsert)
 */
async function upsertContacts(clientId, contacts, source = 'manual') {
  const db = await getClient();
  try {
    await db.query('BEGIN');
    let inserted = 0, updated = 0, invalid = 0;

    for (const c of contacts) {
      const phone = normalizePhone(c.phone_number || c.phone);
      if (!phone) { invalid++; continue; }

      const variables = c.variables || {};
      const variablesOrder = c.variables_order || c._ordered_values || Object.values(variables);

      const existing = await db.query(
        `SELECT id FROM audience_contacts WHERE client_id = $1 AND phone_number = $2`,
        [clientId, phone]
      );

      if (existing.rows.length > 0) {
        await db.query(
          `UPDATE audience_contacts SET
             name = COALESCE($1, name),
             email = COALESCE($2, email),
             variables = $3,
             variables_order = $4,
             is_active = true,
             updated_at = NOW()
           WHERE id = $5`,
          [c.name || null, c.email || null, JSON.stringify(variables), JSON.stringify(variablesOrder), existing.rows[0].id]
        );
        updated++;
      } else {
        await db.query(
          `INSERT INTO audience_contacts
             (id, client_id, phone_number, name, email, variables, variables_order, source)
           VALUES ($1,$2,$3,$4,$5,$6,$7,$8)`,
          [uuidv4(), clientId, phone, c.name || null, c.email || null,
           JSON.stringify(variables), JSON.stringify(variablesOrder), source]
        );
        inserted++;
      }
    }

    await db.query('COMMIT');
    return { success: true, inserted, updated, invalid, total: contacts.length };
  } catch (err) {
    await db.query('ROLLBACK');
    throw err;
  } finally {
    db.release();
  }
}

/**
 * Import CSV vers l'audience (réutilise le parsing existant)
 */
async function importAudienceFromCSV(clientId, fileBuffer) {
  const records = csv.parse(fileBuffer, { columns: true, skip_empty_lines: true, trim: true, bom: true });

  const reserved = ['phone_number','phone','telephone','numero','Téléphone','name','nom','prenom','Nom','Prénom','email','Email'];
  const contacts = records.map(row => {
    const phone = row.phone_number || row.phone || row.telephone || row.numero || row['Téléphone'];
    const name = row.name || row.nom || row.prenom || row['Nom'] || row['Prénom'];
    const email = row.email || row['Email'];
    const variables = {};
    const orderedValues = [];
    for (const [key, val] of Object.entries(row)) {
      if (!reserved.includes(key) && val) {
        variables[key] = val;
        orderedValues.push(val);
      }
    }
    return { phone_number: phone, name, email, variables, variables_order: orderedValues };
  });

  return upsertContacts(clientId, contacts, 'csv');
}

async function importAudienceFromExcel(clientId, fileBuffer) {
  const workbook = xlsx.read(fileBuffer, { type: 'buffer' });
  const sheet = workbook.Sheets[workbook.SheetNames[0]];
  const records = xlsx.utils.sheet_to_json(sheet);

  const reserved = ['phone_number','phone','telephone','Téléphone','name','nom','Nom','email','Email'];
  const contacts = records.map(row => {
    const phone = String(row.phone_number || row.phone || row.telephone || row['Téléphone'] || '');
    const name = row.name || row.nom || row['Nom'] || '';
    const email = row.email || row['Email'] || '';
    const variables = {};
    const orderedValues = [];
    for (const [k, v] of Object.entries(row)) {
      if (!reserved.includes(k) && v !== undefined && v !== '') {
        variables[String(k)] = String(v);
        orderedValues.push(String(v));
      }
    }
    return { phone_number: phone, name: String(name), email: String(email), variables, variables_order: orderedValues };
  });

  return upsertContacts(clientId, contacts, 'excel');
}

/**
 * Importer les contacts d'une campagne existante dans l'audience
 * (pour récupérer les contacts déjà envoyés avant ce module)
 */
async function importFromExistingCampaign(clientId, campaignId) {
  const campRes = await query(`SELECT id FROM campaigns WHERE id = $1 AND client_id = $2`, [campaignId, clientId]);
  if (!campRes.rows[0]) throw { statusCode: 404, message: 'Campagne non trouvée' };

  const contactsRes = await query(
    `SELECT phone_number, name, email, variables, variables_order FROM campaign_contacts WHERE campaign_id = $1`,
    [campaignId]
  );

  const contacts = contactsRes.rows.map(c => ({
    phone_number: c.phone_number, name: c.name, email: c.email,
    variables: c.variables || {}, variables_order: c.variables_order || [],
  }));

  return upsertContacts(clientId, contacts, 'campaign_import');
}

// ============================================================
// EXPORT
// ============================================================

async function exportAudienceToCSV(clientId, filters = {}) {
  // On transmet tous les filtres, y compris list_id, à getAudienceContacts
  const { contacts } = await getAudienceContacts(clientId, { ...filters, limit: 100000, page: 1 });

  const headers = ['phone_number', 'name', 'email', 'campaigns_count', 'last_status',
    'total_delivered', 'total_read', 'total_failed', 'last_campaign_at', 'tags'];

  const csvEscape = (v) => `"${String(v ?? '').replace(/"/g, '""')}"`;
  const rows = contacts.map(c => [
    c.phone_number, c.name || '', c.email || '', c.campaigns_count,
    c.last_status || '', c.total_delivered, c.total_read, c.total_failed,
    c.last_campaign_at ? new Date(c.last_campaign_at).toISOString() : '',
    (c.tags || []).join('|'),
  ]);

  const csvContent = '\uFEFF' + [headers.join(','), ...rows.map(r => r.map(csvEscape).join(','))].join('\n');
  return { success: true, csv: csvContent, count: contacts.length, filename: `audience_${Date.now()}.csv` };
}

// ============================================================
// SUPPRESSION / ARCHIVAGE
// ============================================================

async function deleteContacts(clientId, contactIds) {
  const res = await query(
    `UPDATE audience_contacts SET is_active = false, updated_at = NOW()
     WHERE client_id = $1 AND id = ANY($2) RETURNING id`,
    [clientId, contactIds]
  );
  return { success: true, deleted: res.rowCount };
}

async function deleteContactsByFilter(clientId, filters) {
  const { contacts } = await getAudienceContacts(clientId, { ...filters, limit: 100000, page: 1 });
  const ids = contacts.map(c => c.id);
  if (ids.length === 0) return { success: true, deleted: 0 };
  return deleteContacts(clientId, ids);
}

// ============================================================
// RENVOI — Cœur de la fonctionnalité demandée
// Deux modes : 1) Dupliquer la campagne (nouveau template/lien)
//              2) Réutiliser juste la liste pour une nouvelle campagne
// ============================================================

/**
 * MODE 1 — Renvoyer la MÊME campagne (même template) mais avec un nouveau
 * lien média et/ou aux contacts filtrés (sous-ensemble possible).
 * Crée une NOUVELLE campagne en clonant la config de l'ancienne.
 */
async function resendCampaignWithNewMedia(clientId, userId, sourceCampaignId, options = {}) {
  const { new_media_url, contact_filters = {}, name_suffix = ' (renvoi)', template_params_override = {} } = options;

  const db = await getClient();
  try {
    await db.query('BEGIN');

    const srcRes = await db.query(`SELECT * FROM campaigns WHERE id = $1 AND client_id = $2`, [sourceCampaignId, clientId]);
    if (!srcRes.rows[0]) throw { statusCode: 404, message: 'Campagne source non trouvée' };
    const src = srcRes.rows[0];

    // Récupère les contacts avec les filtres (y compris list_id si présent)
//    const { contacts } = await getAudienceContacts(clientId, { ...contact_filters, limit: contact_filters.limit || 100000, page: 1 });
  //  if (contacts.length === 0) throw { statusCode: 400, code: 'NO_CONTACTS', message: 'Aucun contact correspondant aux filtres' };

    const filters = {
  ...(contact_filters || {}),
  limit: contact_filters?.limit || 100000,
  page: 1,
};

// Sécurité : si aucun filtre de ciblage, refuser plutôt que tout envoyer
const hasTargeting =
  (filters.list_id) ||
  (Array.isArray(filters.contact_ids) && filters.contact_ids.length > 0) ||
  (filters.search) ||
  (filters.status) ||
  (filters.take_first_n) ||
  (filters.min_campaigns !== undefined) ||
  (filters.max_campaigns !== undefined) ||
  (filters.tags && filters.tags.length > 0) ||
  (Array.isArray(filters.dynamic_filters) && filters.dynamic_filters.length > 0);

if (!hasTargeting) {
  throw {
    statusCode: 400,
    code: 'TARGETING_REQUIRED',
    message: 'Sélectionnez des contacts, une liste, ou appliquez un filtre avant de renvoyer la campagne.',
  };
}

const { contacts } = await getAudienceContacts(clientId, filters);
if (contacts.length === 0) {
  throw { statusCode: 400, code: 'NO_CONTACTS', message: 'Aucun contact correspondant aux filtres' };
}

    let mergedDefaultParams = { ...(typeof src.template_params === 'string' ? JSON.parse(src.template_params) : src.template_params || {}), ...template_params_override };
    let mediaInfo = null;
    if (new_media_url) {
      mediaInfo = detectMediaType(new_media_url);
      if (!mediaInfo) throw { statusCode: 400, code: 'INVALID_MEDIA_URL', message: 'Lien média invalide. Fournissez une URL publique valide (http/https).' };
    }

    const newCampaignId = uuidv4();
    await db.query(
      `INSERT INTO campaigns (
        id, client_id, name, description, status, campaign_type, priority, category,
        template_name, template_language, template_params, phone_number,
        send_mode, batch_size, batch_interval_seconds, daily_limit, rate_per_minute,
        total_contacts, estimated_cost, tags, created_by, updated_by
      ) VALUES ($1,$2,$3,$4,'draft',$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19,$20,$20)`,
      [
        newCampaignId, clientId, `${src.name}${name_suffix}`, src.description,
        src.campaign_type, src.priority, src.category,
        src.template_name, src.template_language, JSON.stringify(mergedDefaultParams),
        src.phone_number, src.send_mode, src.batch_size, src.batch_interval_seconds,
        src.daily_limit, src.rate_per_minute, contacts.length,
        contacts.length * (src.estimated_cost && src.total_contacts ? src.estimated_cost / src.total_contacts : 0.005),
        src.tags, userId,
      ]
    );

    for (const c of contacts) {
      const vars = { ...(c.variables || {}) };
      let orderedValues = Array.isArray(c.variables_order) ? [...c.variables_order] : Object.values(vars);

      if (mediaInfo) {
        let replaced = false;
        for (const [k, v] of Object.entries(vars)) {
          if (typeof v === 'string' && detectMediaType(v)) {
            vars[k] = mediaInfo.url;
            orderedValues = orderedValues.map(ov => (ov === v ? mediaInfo.url : ov));
            replaced = true;
          }
        }
        if (!replaced) {
          vars.media_url = mediaInfo.url;
          orderedValues = [mediaInfo.url, ...orderedValues];
        }
      }

      await db.query(
        `INSERT INTO campaign_contacts (id, campaign_id, phone_number, name, email, variables, variables_order, status)
         VALUES ($1,$2,$3,$4,$5,$6,$7,'pending')
         ON CONFLICT (campaign_id, phone_number) DO NOTHING`,
        [uuidv4(), newCampaignId, c.phone_number, c.name, c.email, JSON.stringify(vars), JSON.stringify(orderedValues)]
      );
    }

    await db.query(
      `INSERT INTO campaign_logs (id, campaign_id, level, event, message, metadata)
       VALUES ($1,$2,'info','campaign.resent',$3,$4)`,
      [uuidv4(), newCampaignId, `Renvoi de la campagne "${src.name}" avec ${contacts.length} contact(s)`,
       JSON.stringify({ source_campaign_id: sourceCampaignId, new_media: mediaInfo?.url || null })]
    );

    await db.query('COMMIT');
    return { success: true, campaign_id: newCampaignId, contacts_count: contacts.length, media_detected: mediaInfo };
  } catch (err) {
    await db.query('ROLLBACK');
    throw err;
  } finally {
    db.release();
  }
}

/**
 * MODE 2 — Créer une campagne TOTALEMENT NOUVELLE (autre template, autre objet)
 * en réutilisant simplement la liste de contacts filtrée de l'audience.
 * Retourne la liste prête à injecter dans le payload de createCampaign().
 */
async function getAudienceContactsForNewCampaign(clientId, filters = {}) {
  const { contacts } = await getAudienceContacts(clientId, { ...filters, limit: filters.limit || 100000, page: 1 });
  return {
    success: true,
    count: contacts.length,
    contacts: contacts.map(c => ({
      phone_number: c.phone_number,
      name: c.name,
      email: c.email,
      variables: c.variables || {},
      variables_order: c.variables_order || [],
    })),
  };
}

// ============================================================
// SYNCHRONISATION — appelée après chaque campagne lancée/terminée
// pour garder l'audience à jour (nombre de campagnes, derniers statuts)
// ============================================================

async function syncCampaignContactsToAudience(campaignId) {
  try {
    const campRes = await query(`SELECT client_id, name FROM campaigns WHERE id = $1`, [campaignId]);
    if (!campRes.rows[0]) return;
    const clientId = campRes.rows[0].client_id;

    const contacts = await query(
      `SELECT * FROM campaign_contacts WHERE campaign_id = $1`,
      [campaignId]
    );

    for (const c of contacts.rows) {
      const phone = c.phone_number;

      const upsertRes = await query(
        `INSERT INTO audience_contacts (id, client_id, phone_number, name, email, variables, variables_order, source)
         VALUES ($1,$2,$3,$4,$5,$6,$7,'campaign_import')
         ON CONFLICT (client_id, phone_number) DO UPDATE SET
           name = COALESCE(audience_contacts.name, EXCLUDED.name),
           updated_at = NOW()
         RETURNING id`,
        [uuidv4(), clientId, phone, c.name, c.email, c.variables || {}, c.variables_order || []]
      );
      const audienceContactId = upsertRes.rows[0].id;

      await query(
        `INSERT INTO audience_contact_campaigns
           (id, audience_contact_id, campaign_id, campaign_contact_id, status, sent_at, delivered_at, read_at, failed_at)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)
         ON CONFLICT (audience_contact_id, campaign_id) DO UPDATE SET
           status = EXCLUDED.status, delivered_at = EXCLUDED.delivered_at,
           read_at = EXCLUDED.read_at, failed_at = EXCLUDED.failed_at`,
        [uuidv4(), audienceContactId, campaignId, c.id, c.status, c.sent_at, c.delivered_at, c.read_at, c.failed_at]
      );

      await query(
        `UPDATE audience_contacts SET
           campaigns_count = (SELECT COUNT(*) FROM audience_contact_campaigns WHERE audience_contact_id = $1),
           last_campaign_id = $2,
           last_campaign_at = NOW(),
           last_status = $3,
           total_delivered = (SELECT COUNT(*) FROM audience_contact_campaigns WHERE audience_contact_id = $1 AND status IN ('delivered','read')),
           total_read = (SELECT COUNT(*) FROM audience_contact_campaigns WHERE audience_contact_id = $1 AND status = 'read'),
           total_failed = (SELECT COUNT(*) FROM audience_contact_campaigns WHERE audience_contact_id = $1 AND status = 'failed')
         WHERE id = $1`,
        [audienceContactId, campaignId, c.status]
      );
    }
  } catch (err) {
    logger.error('[AUDIENCE SYNC] Erreur synchronisation:', err);
  }
}

// ============================================================
// GESTION DES MEMBRES D'UNE LISTE
// ============================================================

/**
 * Ajouter des contacts à une liste statique
 * @param {string} listId - ID de la liste
 * @param {string} clientId - ID du client
 * @param {string[]} contactIds - IDs des contacts à ajouter
 */
async function addContactsToList(listId, clientId, contactIds) {
  // Vérifier que la liste appartient au client
  const listRes = await query(
    'SELECT id FROM audience_lists WHERE id = $1 AND client_id = $2',
    [listId, clientId]
  );
  if (listRes.rows.length === 0) {
    throw { statusCode: 404, code: 'LIST_NOT_FOUND', message: 'Liste non trouvée' };
  }

  const db = await getClient();
  try {
    await db.query('BEGIN');
    let added = 0;
    for (const cid of contactIds) {
      const res = await db.query(
        `INSERT INTO audience_list_members (list_id, audience_contact_id)
         VALUES ($1, $2) ON CONFLICT DO NOTHING`,
        [listId, cid]
      );
      if (res.rowCount > 0) added++;
    }
    // Mettre à jour le compteur
    await db.query(
      `UPDATE audience_lists SET contact_count = (
        SELECT COUNT(*) FROM audience_list_members WHERE list_id = $1
      ) WHERE id = $1`,
      [listId]
    );
    await db.query('COMMIT');
    return { success: true, added };
  } catch (err) {
    await db.query('ROLLBACK');
    throw err;
  } finally {
    db.release();
  }
}

/**
 * Retirer des contacts d'une liste statique
 */
async function removeContactsFromList(listId, clientId, contactIds) {
  const listRes = await query(
    'SELECT id FROM audience_lists WHERE id = $1 AND client_id = $2',
    [listId, clientId]
  );
  if (listRes.rows.length === 0) {
    throw { statusCode: 404, code: 'LIST_NOT_FOUND', message: 'Liste non trouvée' };
  }

  const db = await getClient();
  try {
    await db.query('BEGIN');
    const res = await db.query(
      `DELETE FROM audience_list_members
       WHERE list_id = $1 AND audience_contact_id = ANY($2)`,
      [listId, contactIds]
    );
    await db.query(
      `UPDATE audience_lists SET contact_count = (
        SELECT COUNT(*) FROM audience_list_members WHERE list_id = $1
      ) WHERE id = $1`,
      [listId]
    );
    await db.query('COMMIT');
    return { success: true, removed: res.rowCount };
  } catch (err) {
    await db.query('ROLLBACK');
    throw err;
  } finally {
    db.release();
  }
}

/**
 * Supprimer une liste (et ses membres en cascade)
 */
async function deleteList(listId, clientId) {
  const listRes = await query(
    'SELECT id FROM audience_lists WHERE id = $1 AND client_id = $2',
    [listId, clientId]
  );
  if (listRes.rows.length === 0) {
    throw { statusCode: 404, code: 'LIST_NOT_FOUND', message: 'Liste non trouvée' };
  }
  await query('DELETE FROM audience_lists WHERE id = $1', [listId]);
  return { success: true };
}


// ============================================================
// LISTES (groupes statiques)
// ============================================================

async function createList(clientId, name, description, contactIds = []) {
  const db = await getClient();
  try {
    await db.query('BEGIN');
    const listId = uuidv4();
    await db.query(
      `INSERT INTO audience_lists (id, client_id, name, description, contact_count)
       VALUES ($1,$2,$3,$4,$5)`,
      [listId, clientId, name, description || null, contactIds.length]
    );
    for (const cid of contactIds) {
      await db.query(
        `INSERT INTO audience_list_members (list_id, audience_contact_id) VALUES ($1,$2) ON CONFLICT DO NOTHING`,
        [listId, cid]
      );
    }
    await db.query('COMMIT');
    return { success: true, list_id: listId };
  } catch (err) {
    await db.query('ROLLBACK');
    throw err;
  } finally {
    db.release();
  }
}

async function getLists(clientId) {
  const res = await query(`SELECT * FROM audience_lists WHERE client_id = $1 ORDER BY created_at DESC`, [clientId]);
  return { success: true, lists: res.rows };
}

module.exports = {
  getAudienceContacts, getAudienceStats, getContactDetail,
  upsertContacts, importAudienceFromCSV, importAudienceFromExcel, importFromExistingCampaign,
  exportAudienceToCSV, deleteContacts, deleteContactsByFilter,
  resendCampaignWithNewMedia, getAudienceContactsForNewCampaign,
  syncCampaignContactsToAudience, createList, getLists,
  detectMediaType, normalizePhone, addContactsToList,
  removeContactsFromList,
  deleteList,
};
