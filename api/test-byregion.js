'use strict';
require('dotenv').config();
const { query } = require('./src/config/database');

async function run() {
  const todayStr = new Date().toISOString().split('T')[0];
  const y = new Date(); y.setDate(y.getDate()-1);
  const ws = new Date(); ws.setDate(ws.getDate()-2);

  const todayStartStr    = `${todayStr} 00:00:00`;
  const weekStartStr     = ws.toISOString();
  const prevWeekStartStr = new Date(ws.getTime() - 7*86400000).toISOString();
  const prevWeekEndStr   = new Date(ws.getTime() - 1).toISOString();

  // ── Test A : byRegion SANS COUNT(DISTINCT) ──
  console.log('── Test A : byRegion sans COUNT(DISTINCT) ──');
  let t = Date.now();
  try {
    const r = await query(`
      SELECT
        COALESCE(region, 'N/A') AS dim,
        COUNT(*)::int AS total,
        COUNT(*) FILTER (WHERE check_status = 'OK')::int AS checked,
        COUNT(*) FILTER (WHERE COALESCE(check_date, updated_at) >= $1::timestamp)::int AS checked_today,
        COUNT(*) FILTER (WHERE COALESCE(check_date, updated_at) >= $2::timestamp)::int AS checked_week,
        COUNT(*) FILTER (WHERE COALESCE(check_date, updated_at) BETWEEN $3::timestamp AND $4::timestamp)::int AS checked_prev_week
      FROM socadel_contacts
      WHERE region IS NOT NULL AND region <> ''
      GROUP BY region
      ORDER BY checked DESC
    `, [todayStartStr, weekStartStr, prevWeekStartStr, prevWeekEndStr]);
    console.log(`   ✅ OK en ${Date.now()-t} ms — ${r.rows.length} lignes`);
  } catch (e) {
    console.error(`   ❌ Échec après ${Date.now()-t} ms :`, e.message);
  }

  // ── Test B : byRegion AVEC COUNT(DISTINCT) ──
  console.log('── Test B : byRegion avec COUNT(DISTINCT itineraires) ──');
  t = Date.now();
  try {
    const r = await query(`
      SELECT
        COALESCE(region, 'N/A') AS dim,
        COUNT(*)::int AS total,
        COUNT(DISTINCT itineraires) FILTER (WHERE itineraires IS NOT NULL)::int AS nb_itineraires
      FROM socadel_contacts
      WHERE region IS NOT NULL AND region <> ''
      GROUP BY region
      ORDER BY total DESC
    `, []);
    console.log(`   ✅ OK en ${Date.now()-t} ms — ${r.rows.length} lignes`);
  } catch (e) {
    console.error(`   ❌ Échec après ${Date.now()-t} ms :`, e.message);
  }

  // ── Test C : byRegion avec paramètres SANS CAST explicite ──
  console.log('── Test C : byRegion params sans ::timestamp ──');
  t = Date.now();
  try {
    const r = await query(`
      SELECT
        COALESCE(region, 'N/A') AS dim,
        COUNT(*)::int AS total,
        COUNT(*) FILTER (WHERE COALESCE(check_date, updated_at) >= $1)::int AS checked_today
      FROM socadel_contacts
      WHERE region IS NOT NULL AND region <> ''
      GROUP BY region
      ORDER BY total DESC
    `, [todayStartStr]);
    console.log(`   ✅ OK en ${Date.now()-t} ms — ${r.rows.length} lignes`);
  } catch (e) {
    console.error(`   ❌ Échec après ${Date.now()-t} ms :`, e.message);
  }

  process.exit(0);
}

run().catch(e => { console.error('❌ fatal :', e); process.exit(1); });
