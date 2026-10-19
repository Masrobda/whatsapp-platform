// api/src/workers/socadel-invoice-report.cron.js
'use strict';

const fs = require('fs');
const logger = require('../utils/logger');
const {
  sendInvoiceReportEmail,
  buildReportData,
  buildReportHtml,
} = require('../services/socadel-invoice-report.service');

const HOUR_UTC = parseInt(process.env.SOCADEL_INVOICE_REPORT_HOUR_UTC || '6', 10); // 06h UTC = 07h Douala
const WATCHDOG_MS = parseInt(process.env.SOCADEL_INVOICE_REPORT_WATCHDOG_MS || '300000', 10);

async function runOnce() {
  logger.info('[SOCADEL-INVOICE] Début génération…');
  const result = await sendInvoiceReportEmail();
  logger.info('[SOCADEL-INVOICE] Terminé OK ' + JSON.stringify(result));
  return result;
}

async function runDry() {
  logger.info('[SOCADEL-INVOICE] Mode DRY (aucun email envoyé)');
  const data = await buildReportData();
  const emailHtml = buildReportHtml(data);
  const fullHtml = buildReportHtml(data, { full: true });
  fs.writeFileSync('/tmp/socadel-invoice-report-email.html', emailHtml, 'utf8');
  fs.writeFileSync('/tmp/socadel-invoice-report-full.html', fullHtml, 'utf8');
  const res = {
    cycle: `${data.cycle}/${data.annee}`,
    email_html: '/tmp/socadel-invoice-report-email.html',
    email_bytes: emailHtml.length,
    full_html: '/tmp/socadel-invoice-report-full.html',
    full_bytes: fullHtml.length,
    total: data.global.total,
    distribuees: data.global.distribuees,
  };
  logger.info('[SOCADEL-INVOICE] DRY OK ' + JSON.stringify(res));
  return res;
}

if (process.env.REPORT_RUN_NOW === '1') {
  process.on('unhandledRejection', (e) => console.error('[SOCADEL-INVOICE] unhandledRejection', e));
  process.on('uncaughtException', (e) => {
    console.error('[SOCADEL-INVOICE] uncaughtException', e);
    process.exit(1);
  });
  setTimeout(() => {
    console.error(`[SOCADEL-INVOICE] WATCHDOG: aucune fin après ${WATCHDOG_MS}ms → arrêt forcé`);
    process.exit(2);
  }, WATCHDOG_MS).unref();

  const job = process.env.REPORT_DRY === '1' ? runDry : runOnce;
  job()
    .then((r) => {
      console.error('[SOCADEL-INVOICE] OK ' + JSON.stringify(r));
      process.exitCode = 0;
    })
    .catch((err) => {
      logger.error('[SOCADEL-INVOICE] ÉCHEC: ' + (err && err.message));
      console.error(err);
      process.exitCode = 1;
    })
    .finally(() => setTimeout(() => process.exit(process.exitCode ?? 0), 3000).unref());
} else {
  let running = false;
  let lastRunDay = null;
  setInterval(async () => {
    const now = new Date();
    if (now.getUTCHours() !== HOUR_UTC || now.getUTCMinutes() > 5) return;
    const day = now.toISOString().slice(0, 10);
    if (running || lastRunDay === day) return;
    running = true;
    try {
      await runOnce();
      lastRunDay = day;
    } catch (err) {
      logger.error('[SOCADEL-INVOICE] Échec cron (nouvelle tentative à la minute suivante): ' + err.message);
    } finally {
      running = false;
    }
  }, 60 * 1000);
  logger.info('[SOCADEL-INVOICE] Cron démarré UTC hour=' + HOUR_UTC);
}
