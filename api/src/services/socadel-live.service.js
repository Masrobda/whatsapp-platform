'use strict';

const { query } = require('../config/database');

const SORTABLE = new Set([
  'check_date', 'activated_at', 'api_date', 'updated_at',
  'region', 'division', 'agence', 'mrc', 'service_no', 'noms', 'statut'
]);

function buildFilters(q = {}) {
  const where = [];
  const params = [];
  const add = (sql, val) => {
    params.push(val);
    where.push(sql.replace('?', `$${params.length}`));
  };

  if (q.region) add(`region = ?`, q.region);
  if (q.division) add(`division = ?`, q.division);
  if (q.agence) add(`agence = ?`, q.agence);
  if (q.mrc) add(`mrc = ?`, q.mrc);
  if (q.itineraires) add(`itineraires = ?`, q.itineraires);
  if (q.service_no) add(`service_no ILIKE ?`, `%${q.service_no}%`);
  if (q.meter_no) add(`meter_no ILIKE ?`, `%${q.meter_no}%`);
  if (q.noms) add(`noms ILIKE ?`, `%${q.noms}%`);

  // ABONNE / NON ABONNE
  if (q.statut === 'ABONNE') where.push(`statut = 'ABONNE'`);
  if (q.statut === 'NON ABONNE') where.push(`(statut IS NULL OR statut <> 'ABONNE')`);

  if (q.check_status === 'OK') where.push(`check_status = 'OK'`);
  if (q.check_status === 'NULL') where.push(`(check_status IS NULL OR check_status = '')`);

  if (q.api_status === 'OK' || q.api_status === 'NOK') add(`api_status = ?`, q.api_status);

  if (q.responsable) add(`UPPER(responsable) = UPPER(?)`, q.responsable);

  // abonné / collecté par
  if (q.collected_by === 'releveur') where.push(`LOWER(collected_by_type) = 'releveur'`);
  if (q.collected_by === 'agent') {
    where.push(`LOWER(COALESCE(collected_by_type,'')) IN ('agent_socadel','agent')`);
  }
  if (q.collected_by === 'terrain') {
    where.push(`(
      LOWER(COALESCE(collected_by_type,'')) = 'releveur'
      OR UPPER(COALESCE(responsable,'')) = 'TERRAIN'
    )`);
  }
  if (q.collected_by === 'autres') {
    where.push(`(
      (collected_by_type IS NULL OR collected_by_type = '')
      AND UPPER(COALESCE(responsable,'')) <> 'TERRAIN'
    )`);
  }

  // Périodes (check)
  if (q.check_from) add(`check_date >= ?::timestamptz`, q.check_from);
  if (q.check_to) add(`check_date < (?::date + INTERVAL '1 day')`, q.check_to);

  // Périodes (abonnement)
  if (q.activated_from) add(`activated_at >= ?::timestamptz`, q.activated_from);
  if (q.activated_to) add(`activated_at < (?::date + INTERVAL '1 day')`, q.activated_to);

  // Périodes (MAJ)
  if (q.updated_from) add(`updated_at >= ?::timestamptz`, q.updated_from);
  if (q.updated_to) add(`updated_at < (?::date + INTERVAL '1 day')`, q.updated_to);

  if (q.has_gps === '1') where.push(`gps_lat IS NOT NULL`);
  if (q.has_gps === '0') where.push(`gps_lat IS NULL`);

  const whereSql = where.length ? `WHERE ${where.join(' AND ')}` : '';
  return { whereSql, params };
}

async function getFilterOptions() {
  const r = await query(`
    SELECT
      ARRAY(SELECT DISTINCT region FROM socadel_contacts WHERE region IS NOT NULL AND region <> '' ORDER BY 1) AS regions,
      ARRAY(SELECT DISTINCT division FROM socadel_contacts WHERE division IS NOT NULL AND division <> '' ORDER BY 1) AS divisions,
      ARRAY(SELECT DISTINCT agence FROM socadel_contacts WHERE agence IS NOT NULL AND agence <> '' ORDER BY 1) AS agences,
      ARRAY(SELECT DISTINCT mrc FROM socadel_contacts WHERE mrc IS NOT NULL AND mrc <> '' ORDER BY 1) AS mrcs
  `);
  return r.rows[0] || { regions: [], divisions: [], agences: [], mrcs: [] };
}

async function searchLive(queryParams = {}) {
  const page = Math.max(1, parseInt(queryParams.page, 10) || 1);
  const limit = Math.min(200, Math.max(10, parseInt(queryParams.limit, 10) || 50));
  const offset = (page - 1) * limit;

  let sort = String(queryParams.sort || 'check_date');
  if (!SORTABLE.has(sort)) sort = 'check_date';
  const order = String(queryParams.order || 'desc').toLowerCase() === 'asc' ? 'ASC' : 'DESC';

  const { whereSql, params } = buildFilters(queryParams);

  const countRes = await query(
    `SELECT COUNT(*)::bigint AS total FROM v_socadel_collecte_live ${whereSql}`,
    params
  );
  const total = parseInt(countRes.rows[0].total, 10);

  const dataRes = await query(
    `SELECT * FROM v_socadel_collecte_live
     ${whereSql}
     ORDER BY ${sort} ${order} NULLS LAST
     LIMIT $${params.length + 1} OFFSET $${params.length + 2}`,
    [...params, limit, offset]
  );

  // KPIs sur le filtre (live)
  const kpiRes = await query(
    `SELECT
       COUNT(*)::bigint AS total,
       COUNT(*) FILTER (WHERE statut = 'ABONNE')::bigint AS abonnes,
       COUNT(*) FILTER (WHERE check_status = 'OK')::bigint AS checks,
       COUNT(*) FILTER (WHERE api_status = 'OK')::bigint AS api_ok,
       COUNT(*) FILTER (WHERE UPPER(COALESCE(responsable,'')) = 'TERRAIN')::bigint AS terrain
     FROM v_socadel_collecte_live ${whereSql}`,
    params
  );

  return {
    data: dataRes.rows,
    pagination: {
      page,
      limit,
      total,
      pages: Math.ceil(total / limit) || 1,
    },
    kpis: kpiRes.rows[0],
  };
}

/** Stream CSV de TOUTES les lignes du filtre (pas de limite page) */
async function* exportCsvStream(queryParams = {}) {
  const { whereSql, params } = buildFilters(queryParams);
  const headers = [
    'region', 'division', 'agence', 'mrc', 'itineraires', 'ref_geo',
    'service_no', 'meter_no', 'noms', 'numero_telephone',
    'check_status', 'check_date', 'rapport', 'identite',
    'api_status', 'api_date', 'statut', 'activated_at', 'responsable',
    'collected_by_type', 'collected_by_label', 'abonne_par_label',
    'gps_lat', 'gps_lng', 'gps_accuracy', 'gps_captured_at', 'updated_at'
  ];

  const esc = (v) => {
    if (v == null) return '';
    const s = v instanceof Date ? v.toISOString() : String(v);
    if (/[",\n\r]/.test(s)) return `"${s.replace(/"/g, '""')}"`;
    return s;
  };

  yield headers.join(',') + '\n';

  // Curseur par lots pour ne pas saturer la RAM
  let lastId = null;
  const batch = 2000;

  for (;;) {
    const p = [...params];
    let sql = `
      SELECT ${headers.join(', ')}, id
      FROM v_socadel_collecte_live
      ${whereSql}
      ${whereSql ? 'AND' : 'WHERE'} ($${p.length + 1}::uuid IS NULL OR id > $${p.length + 1})
      ORDER BY id ASC
      LIMIT ${batch}
    `;
    p.push(lastId);

    const res = await query(sql, p);
    if (!res.rows.length) break;

    for (const row of res.rows) {
      yield headers.map((h) => esc(row[h])).join(',') + '\n';
      lastId = row.id;
    }
    if (res.rows.length < batch) break;
  }
}

module.exports = {
  buildFilters,
  getFilterOptions,
  searchLive,
  exportCsvStream,
};
