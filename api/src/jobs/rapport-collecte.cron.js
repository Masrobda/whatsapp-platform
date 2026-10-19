// ============================================================
// src/jobs/rapport-collecte.cron.js
// ============================================================
'use strict';

// Charger .env depuis la racine du projet (2 niveaux au-dessus de src/jobs/)
require('dotenv').config({ path: require('path').resolve(__dirname, '../../.env') });

const fs   = require('fs');
const path = require('path');
const { fetchAllData, buildHtml } = require('../services/rapport-collecte.service');
const emailService = require('../services/email.service');

const DESTINATAIRES = (process.env.RAPPORT_COLLECTE_EMAILS || 'patrick.tondjou@camlight.cm')
  .split(',').map(s => s.trim()).filter(Boolean);

// Sauvegarde HTML dans /tmp (toujours accessible)
function saveHtml(html) {
  const dirs = ['/tmp/rapports_socadel', '/tmp'];
  for (const dir of dirs) {
    try {
      if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
      const stamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
      const fpath = path.join(dir, `rapport_collecte_${stamp}.html`);
      fs.writeFileSync(fpath, html, 'utf8');
      console.log(`[cron] 📄 HTML sauvegardé : ${fpath}`);
      return fpath;
    } catch (e) {
      console.warn(`[cron] ⚠️  Écriture dans ${dir} impossible :`, e.message);
    }
  }
  return null;
}

async function run() {
  const t0 = Date.now();
  console.log('');
  console.log('══════════════════════════════════════════════════════');
  console.log(`[cron] Démarrage — ${new Date().toLocaleString('fr-FR')}`);
  console.log(`[cron] SMTP_USER = ${process.env.SMTP_USER || '⚠️  non défini'}`);
  console.log(`[cron] Destinataires : ${DESTINATAIRES.join(', ')}`);
  console.log('══════════════════════════════════════════════════════');

  // ── 1. Données ──────────────────────────────────────────
  console.log('\n[cron] ── 1. Collecte des données ──');
  let data;
  try {
    data = await fetchAllData();
    console.log(`[cron] ✅ OK — total=${data.global?.total} checked=${data.global?.checked} abonne=${data.global?.abonne}`);
  } catch (err) {
    console.error('[cron] ❌ fetchAllData :', err.message, '\n', err.stack);
    process.exit(1);
  }

  // ── 2. HTML ─────────────────────────────────────────────
  console.log('\n[cron] ── 2. Génération HTML ──');
  let html;
  try {
    html = buildHtml(data);
    if (!html || html.length < 500) throw new Error(`HTML trop court (${(html||'').length} chars)`);
    console.log(`[cron] ✅ OK — ${html.length.toLocaleString('fr-FR')} caractères`);
  } catch (err) {
    console.error('[cron] ❌ buildHtml :', err.message, '\n', err.stack);
    process.exit(1);
  }

  // ── 3. Sauvegarde HTML ──────────────────────────────────
  console.log('\n[cron] ── 3. Sauvegarde HTML ──');
  const savedPath = saveHtml(html);

  // ── 4. Envoi email ──────────────────────────────────────
  console.log('\n[cron] ── 4. Envoi email ──');
  const dateLabel = new Date(data.today).toLocaleDateString('fr-FR', {
    day: '2-digit', month: 'long', year: 'numeric',
  });
  const sujet = `⚡ SOCADEL — Rapport Collecte WhatsApp — ${dateLabel}`;
  console.log(`[cron] Sujet : ${sujet}`);

  const results = [];
  for (const to of DESTINATAIRES) {
    console.log(`[cron]   → ${to} ...`);
    try {
      const info = await emailService.transporter.sendMail({
        from:    `"Campagne Collecte SOCADEL" <${process.env.SMTP_USER}>`,
        to,
        subject: sujet,
        html,
      });
      console.log(`[cron]   ✅ Envoyé — messageId: ${info.messageId}`);
      console.log(`[cron]      response : ${info.response}`);
      console.log(`[cron]      accepted : ${JSON.stringify(info.accepted)}`);
      if (info.rejected?.length) console.warn(`[cron]      rejected : ${JSON.stringify(info.rejected)}`);
      results.push({ to, sent: true });
    } catch (err) {
      console.error(`[cron]   ❌ Échec → ${to}`);
      console.error(`[cron]      code     : ${err.code}`);
      console.error(`[cron]      response : ${err.response}`);
      console.error(`[cron]      message  : ${err.message}`);
      results.push({ to, sent: false, error: err.message });
    }
  }

  // ── Résumé ──────────────────────────────────────────────
  const ok  = results.filter(r => r.sent).length;
  const ko  = results.filter(r => !r.sent).length;
  const dur = ((Date.now() - t0) / 1000).toFixed(1);

  console.log('');
  console.log('══════════════════════════════════════════════════════');
  console.log(`[cron] TERMINÉ en ${dur}s`);
  console.log(`[cron]   HTML  : ${savedPath || '⚠️  non sauvegardé'}`);
  console.log(`[cron]   Email : ${ok} envoyé(s) / ${ko} échoué(s)`);
  for (const r of results) {
    console.log(`[cron]   ${r.sent ? '✅' : '❌'} ${r.to}${r.error ? ' — ' + r.error : ''}`);
  }
  console.log('══════════════════════════════════════════════════════');

  process.exit(ko > 0 ? 1 : 0);
}

run().catch(err => {
  console.error('[cron] ❌ Erreur non gérée :', err.message);
  console.error(err.stack);
  process.exit(1);
});
