// api/src/workers/socadel-daily-report.cron.js
'use strict';

const fs = require('fs');
const logger = require('../utils/logger');
const {
  sendDailyReportEmail,
  buildReportData,
  buildReportHtml,
} = require('../services/socadel-daily-report.service');

const HOUR_UTC = parseInt(process.env.SOCADEL_REPORT_HOUR_UTC || '6', 10); // 06h UTC = 07h Douala
const WATCHDOG_MS = parseInt(process.env.SOCADEL_REPORT_WATCHDOG_MS || '300000', 10);

async function runOnce() {
  logger.info('[SOCADEL-REPORT] Début génération…');
  const result = await sendDailyReportEmail();
  logger.info('[SOCADEL-REPORT] Terminé OK ' + JSON.stringify(result));
  return result;
}

async function runDry() {
  logger.info('[SOCADEL-REPORT] Mode DRY (aucun email envoyé)');
  const data = await buildReportData();
  const emailHtml = buildReportHtml(data);
  const fullHtml = buildReportHtml(data, { full: true });
  fs.writeFileSync('/tmp/socadel-report-email.html', emailHtml, 'utf8');
  fs.writeFileSync('/tmp/socadel-report.html', fullHtml, 'utf8');
  const res = {
    email_html: '/tmp/socadel-report-email.html',
    email_bytes: emailHtml.length,
    full_html: '/tmp/socadel-report.html',
    full_bytes: fullHtml.length,
    total: data.global.total,
    agences: data.byAgence.length,
  };
  logger.info('[SOCADEL-REPORT] DRY OK ' + JSON.stringify(res));
  return res;
}

if (process.env.REPORT_RUN_NOW === '1') {
  // ── Exécution manuelle (SSH / PM2) ──
  process.on('exit', (code) => console.error(`[SOCADEL-REPORT] process exit code=${code}`));
  process.on('unhandledRejection', (e) => console.error('[SOCADEL-REPORT] unhandledRejection', e));
  process.on('uncaughtException', (e) => {
    console.error('[SOCADEL-REPORT] uncaughtException', e);
    process.exit(1);
  });

  // Garde-fou : si quelque chose se bloque, on sort avec un message clair
  setTimeout(() => {
    console.error(`[SOCADEL-REPORT] WATCHDOG: aucune fin après ${WATCHDOG_MS}ms → arrêt forcé`);
    process.exit(2);
  }, WATCHDOG_MS).unref();

  const job = process.env.REPORT_DRY === '1' ? runDry : runOnce;
  job()
    .then((r) => {
      console.error('[SOCADEL-REPORT] OK ' + JSON.stringify(r));
      process.exitCode = 0;
    })
    .catch((err) => {
      logger.error('[SOCADEL-REPORT] ÉCHEC: ' + (err && err.message));
      console.error(err);
      process.exitCode = 1;
    })
    .finally(() => {
      // laisse 3 s à winston/SMTP/PG pour flusher, puis sortie propre
      setTimeout(() => process.exit(process.exitCode ?? 0), 3000).unref();
    });
} else {
  // ── Mode planifié ──
  let running = false;
  let lastRunDay = null;

  setInterval(async () => {
    const now = new Date();
    if (now.getUTCHours() !== HOUR_UTC || now.getUTCMinutes() > 5) return;

    const day = now.toISOString().slice(0, 10);
    if (running || lastRunDay === day) return; // 1 seul envoi par jour (avant : jusqu'à 6 mails)

    running = true;
    try {
      await runOnce();
      lastRunDay = day;
    } catch (err) {
      logger.error('[SOCADEL-REPORT] Échec cron (nouvelle tentative à la minute suivante): ' + err.message);
    } finally {
      running = false;
    }
  }, 60 * 1000);

  logger.info('[SOCADEL-REPORT] Cron démarré UTC hour=' + HOUR_UTC);
}
