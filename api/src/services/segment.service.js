// src/services/segment.service.js
// Segments dynamiques avec filtres SQL
const { query, getClient } = require('../config/database');
const { v4: uuidv4 } = require('uuid');
const logger = require('../utils/logger');

// ============================================================
// OPÉRATEURS SUPPORTÉS POUR LES FILTRES DYNAMIQUES
// ============================================================
const ALLOWED_OPERATORS = {
  eq: '=', neq: '!=', gt: '>', gte: '>=', lt: '<', lte: '<=',
  like: 'ILIKE', nlike: 'NOT ILIKE', in: 'IN', nin: 'NOT IN',
  is_null: 'IS NULL', is_not_null: 'IS NOT NULL'
};

// Colonnes autorisées pour les filtres (sécurité anti-injection)
const ALLOWED_COLUMNS = {
  // Depuis campaign_contacts
  'contacts.phone_number': { table: 'cc', col: 'phone_number', type: 'text' },
  'contacts.name':         { table: 'cc', col: 'name', type: 'text' },
  'contacts.status':       { table: 'cc', col: 'status', type: 'text' },
  'contacts.source':       { table: 'cc', col: 'source', type: 'text' },
  'contacts.created_at':   { table: 'cc', col: 'created_at', type: 'date' },
  'contacts.sent_at':      { table: 'cc', col: 'sent_at', type: 'date' },
  'contacts.delivered_at': { table: 'cc', col: 'delivered_at', type: 'date' },
  'contacts.read_at':      { table: 'cc', col: 'read_at', type: 'date' },
  // Depuis incoming_messages
  'messages.is_stop':     { table: 'im', col: 'is_stop', type: 'boolean' },
  // Depuis opt_out_contacts
  'opt_out.opted_out':    { virtual: true, type: 'boolean' },
};

// ============================================================
// BUILDER DE REQUÊTE DYNAMIQUE
// ============================================================

/**
 * Construit une requête SQL sécurisée depuis un tableau de filtres
 * Format filtre: { field, operator, value, logic? }
 */
function buildDynamicQuery(clientId, filters = [], logic = 'AND') {
  if (!Array.isArray(filters) || filters.length === 0) {
    // Retourner tous les numéros connus du client
    return {
      sql: `
        SELECT DISTINCT cc.phone_number, cc.name, cc.variables
        FROM campaign_contacts cc
        JOIN campaigns c ON c.id = cc.campaign_id
        WHERE c.client_id = $1
        AND cc.phone_number NOT IN (
          SELECT phone_number FROM opt_out_contacts
        )
      `,
      params: [clientId]
    };
  }

  const conditions = [];
  const params = [clientId];
  let paramIdx = 2;

  const joins = new Set();

  for (const filter of filters) {
    const { field, operator, value, logic: filterLogic } = filter;

    if (!field || !operator) continue;
    if (!ALLOWED_OPERATORS[operator]) continue;

    const colDef = ALLOWED_COLUMNS[field];
    if (!colDef) continue;

    // Colonnes nécessitant des JOINs
    if (colDef.table === 'im') {
      joins.add(`LEFT JOIN incoming_messages im ON im.phone_number = cc.phone_number`);
    }

    let condition = '';

    if (colDef.virtual && field === 'opt_out.opted_out') {
      if (value === true || value === 'true') {
        condition = `cc.phone_number IN (SELECT phone_number FROM opt_out_contacts)`;
      } else {
        condition = `cc.phone_number NOT IN (SELECT phone_number FROM opt_out_contacts)`;
      }
    } else if (operator === 'is_null') {
      condition = `${colDef.table}.${colDef.col} IS NULL`;
    } else if (operator === 'is_not_null') {
      condition = `${colDef.table}.${colDef.col} IS NOT NULL`;
    } else if (operator === 'in' || operator === 'nin') {
      const vals = Array.isArray(value) ? value : [value];
      const placeholders = vals.map(() => `$${paramIdx++}`).join(', ');
      params.push(...vals);
      condition = `${colDef.table}.${colDef.col} ${ALLOWED_OPERATORS[operator]} (${placeholders})`;
    } else if (operator === 'like' || operator === 'nlike') {
      params.push(`%${value}%`);
      condition = `${colDef.table}.${colDef.col} ${ALLOWED_OPERATORS[operator]} $${paramIdx++}`;
    } else {
      params.push(value);
      condition = `${colDef.table}.${colDef.col} ${ALLOWED_OPERATORS[operator]} $${paramIdx++}`;
    }

    if (condition) conditions.push(condition);
  }

  const joinsSql = Array.from(joins).join('\n');
  const whereSql = conditions.length > 0
    ? `AND (${conditions.join(` ${logic} `)})`
    : '';

  const sql = `
    SELECT DISTINCT cc.phone_number, cc.name, cc.variables,
      MAX(cc.created_at) as last_campaign_at,
      COUNT(DISTINCT cc.campaign_id) as campaign_count
    FROM campaign_contacts cc
    JOIN campaigns c ON c.id = cc.campaign_id
    ${joinsSql}
    WHERE c.client_id = $1
    ${whereSql}
    AND cc.phone_number NOT IN (
      SELECT phone_number FROM opt_out_contacts
    )
    GROUP BY cc.phone_number, cc.name, cc.variables
    ORDER BY cc.phone_number
  `;

  return { sql, params };
}

// ============================================================
// CRUD SEGMENTS
// ============================================================

async function createSegment(clientId, userId, data) {
  const db = await getClient();
  try {
    await db.query('BEGIN');

    const { name, description, type = 'static', filters = [], logic = 'AND', refresh_interval_hours = 24 } = data;

    if (!name?.trim()) throw { statusCode: 400, code: 'NAME_REQUIRED', message: 'Nom du segment requis' };

    const segmentId = uuidv4();

    // Calculer le preview de la requête
    const { sql: queryPreview } = buildDynamicQuery(clientId, filters, logic);

    // Calculer le nb initial de contacts
    let contactCount = 0;
    if (type === 'dynamic' && filters.length > 0) {
      const { sql, params } = buildDynamicQuery(clientId, filters, logic);
      const countSql = `SELECT COUNT(*) as count FROM (${sql}) sub`;
      const countRes = await db.query(countSql, params);
      contactCount = parseInt(countRes.rows[0].count);
    }

    const result = await db.query(
      `INSERT INTO campaign_segments (
        id, client_id, name, description, type, filters,
        contact_count, last_computed_at, refresh_interval_hours,
        query_preview, is_active, created_by
      ) VALUES ($1,$2,$3,$4,$5,$6,$7,NOW(),$8,$9,true,$10)
      RETURNING *`,
      [
        segmentId, clientId, name.trim(), description || null, type,
        JSON.stringify({ filters, logic }),
        contactCount, refresh_interval_hours,
        queryPreview.substring(0, 500), userId
      ]
    );

    await db.query('COMMIT');
    logger.info(`Segment créé: ${segmentId}`);
    return { success: true, segment: result.rows[0] };
  } catch (err) {
    await db.query('ROLLBACK');
    throw err;
  } finally {
    db.release();
  }
}

async function getSegments(clientId, filters = {}) {
  const { page = 1, limit = 20, search, type } = filters;
  const offset = (page - 1) * limit;

  let where = 'WHERE s.client_id = $1 AND s.is_active = true';
  const params = [clientId];
  let idx = 2;

  if (search) { 
    where += ` AND s.name ILIKE $${idx++}`; 
    params.push(`%${search}%`); 
  }
  if (type) { 
    where += ` AND s.type = $${idx++}`; 
    params.push(type); 
  }

  const countRes = await query(`SELECT COUNT(*) FROM campaign_segments s ${where}`, params);
  const total = parseInt(countRes.rows[0].count);

  const res = await query(
    `SELECT s.*,
       COALESCE(u.email, 'Système') as created_by_email
     FROM campaign_segments s
     LEFT JOIN clients u ON s.created_by = u.id
     ${where}
     ORDER BY s.created_at DESC
     LIMIT $${idx} OFFSET $${idx+1}`,
    [...params, limit, offset]
  );

  return {
    success: true,
    segments: res.rows,
    pagination: { 
      total, 
      page: parseInt(page), 
      limit: parseInt(limit), 
      totalPages: Math.ceil(total / limit) 
    }
  };
}

async function getSegmentById(segmentId, clientId) {
  const res = await query(
    `SELECT * FROM campaign_segments WHERE id = $1 AND client_id = $2`,
    [segmentId, clientId]
  );
  if (!res.rows[0]) throw { statusCode: 404, code: 'NOT_FOUND', message: 'Segment non trouvé' };
  return res.rows[0];
}

async function updateSegment(segmentId, clientId, userId, data) {
  const segment = await getSegmentById(segmentId, clientId);
  const { name, description, filters, logic, refresh_interval_hours } = data;

  const updates = {};
  if (name) updates.name = name.trim();
  if (description !== undefined) updates.description = description;
  if (filters !== undefined) updates.filters = JSON.stringify({ filters, logic: logic || 'AND' });
  if (refresh_interval_hours) updates.refresh_interval_hours = refresh_interval_hours;

  const sets = Object.entries(updates).map(([k], i) => `${k} = $${i + 2}`);
  sets.push(`updated_at = NOW()`);

  await query(
    `UPDATE campaign_segments SET ${sets.join(', ')} WHERE id = $1`,
    [segmentId, ...Object.values(updates)]
  );

  // Recalculer si dynamique
  if (segment.type === 'dynamic' && filters) {
    await refreshSegmentCount(segmentId, clientId);
  }

  return { success: true, segment: await getSegmentById(segmentId, clientId) };
}

async function deleteSegment(segmentId, clientId) {
  await query(
    `UPDATE campaign_segments SET is_active = false WHERE id = $1 AND client_id = $2`,
    [segmentId, clientId]
  );
  return { success: true };
}

/**
 * Calculer/rafraîchir le compte de contacts d'un segment dynamique
 */
async function refreshSegmentCount(segmentId, clientId) {
  const segment = await getSegmentById(segmentId, clientId);

  if (segment.type !== 'dynamic') {
    // Segment statique: compter depuis segment_contacts
    const res = await query(
      `SELECT COUNT(*) FROM segment_contacts WHERE segment_id = $1`,
      [segmentId]
    );
    await query(
      `UPDATE campaign_segments SET contact_count = $1, last_computed_at = NOW() WHERE id = $2`,
      [parseInt(res.rows[0].count), segmentId]
    );
    return { count: parseInt(res.rows[0].count) };
  }

  // Segment dynamique: exécuter la requête de filtres
  const filtersConfig = segment.filters || {};
  const filters = filtersConfig.filters || [];
  const logic = filtersConfig.logic || 'AND';

  const { sql, params } = buildDynamicQuery(clientId, filters, logic);
  const countSql = `SELECT COUNT(*) as count FROM (${sql}) sub`;

  try {
    const res = await query(countSql, params);
    const count = parseInt(res.rows[0].count);

    await query(
      `UPDATE campaign_segments SET contact_count = $1, last_computed_at = NOW() WHERE id = $2`,
      [count, segmentId]
    );
    return { count };
  } catch (err) {
    logger.error(`Erreur calcul segment ${segmentId}:`, err);
    throw { statusCode: 400, code: 'FILTER_ERROR', message: `Erreur dans les filtres: ${err.message}` };
  }
}

/**
 * Récupérer les contacts d'un segment (pour import dans campagne)
 */
async function getSegmentContacts(segmentId, clientId, limit = 10000) {
  const segment = await getSegmentById(segmentId, clientId);

  if (segment.type === 'static') {
    const res = await query(
      `SELECT phone_number, name, variables FROM segment_contacts
       WHERE segment_id = $1 LIMIT $2`,
      [segmentId, limit]
    );
    return res.rows;
  }

  // Dynamique
  const filtersConfig = segment.filters || {};
  const filters = filtersConfig.filters || [];
  const logic = filtersConfig.logic || 'AND';

  const { sql, params } = buildDynamicQuery(clientId, filters, logic);
  const res = await query(`${sql} LIMIT ${parseInt(limit)}`, params);
  return res.rows;
}

/**
 * Ajouter des contacts à un segment statique
 */
async function addContactsToSegment(segmentId, clientId, contacts) {
  const segment = await getSegmentById(segmentId, clientId);
  if (segment.type !== 'static') {
    throw { statusCode: 400, code: 'DYNAMIC_SEGMENT', message: 'Impossible d\'ajouter manuellement à un segment dynamique' };
  }

  const db = await getClient();
  try {
    await db.query('BEGIN');

    let inserted = 0;
    for (const contact of contacts) {
      const phone = contact.phone_number || contact.phone;
      if (!phone) continue;
      try {
        await db.query(
          `INSERT INTO segment_contacts (id, segment_id, phone_number, name, variables)
           VALUES ($1,$2,$3,$4,$5) ON CONFLICT (segment_id, phone_number) DO NOTHING`,
          [uuidv4(), segmentId, phone, contact.name || null, JSON.stringify(contact.variables || {})]
        );
        inserted++;
      } catch {}
    }

    // Mettre à jour le count
    await db.query(
      `UPDATE campaign_segments SET
         contact_count = (SELECT COUNT(*) FROM segment_contacts WHERE segment_id = $1),
         last_computed_at = NOW()
       WHERE id = $1`,
      [segmentId]
    );

    await db.query('COMMIT');
    return { success: true, inserted };
  } catch (err) {
    await db.query('ROLLBACK');
    throw err;
  } finally {
    db.release();
  }
}

/**
 * Prévisualiser les contacts d'un segment avant création
 */
async function previewSegment(clientId, filters = [], logic = 'AND', limit = 10) {
  const { sql, params } = buildDynamicQuery(clientId, filters, logic);

  try {
    const [countRes, previewRes] = await Promise.all([
      query(`SELECT COUNT(*) as count FROM (${sql}) sub`, params),
      query(`${sql} LIMIT ${parseInt(limit)}`, params)
    ]);

    return {
      success: true,
      count: parseInt(countRes.rows[0].count),
      preview: previewRes.rows,
      filters_applied: filters.length
    };
  } catch (err) {
    throw { statusCode: 400, code: 'FILTER_ERROR', message: `Erreur filtres: ${err.message}` };
  }
}

/**
 * Importer des contacts dans un segment statique depuis CSV buffer
 */
async function importContactsToSegment(segmentId, clientId, contacts) {
  return addContactsToSegment(segmentId, clientId, contacts);
}

module.exports = {
  createSegment, getSegments, getSegmentById, updateSegment,
  deleteSegment, refreshSegmentCount, getSegmentContacts,
  addContactsToSegment, previewSegment, importContactsToSegment,
  buildDynamicQuery, ALLOWED_COLUMNS, ALLOWED_OPERATORS
};
