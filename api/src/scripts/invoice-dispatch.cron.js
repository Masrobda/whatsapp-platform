// /var/www/numericexport/api/src/scripts/invoice-dispatch.cron.js
require('dotenv').config();
const {
  dispatchPendingInvoices,
  requeueStaleProcessing,
  getInvoiceStats,
} = require('../services/invoice-dispatch.service');
const logger = require('../utils/logger');

const CLIENT_ID = process.env.INVOICE_CLIENT_ID;

// Arrêt propre si le cron reçoit SIGTERM (ex: redémarrage)
let shuttingDown = false;
process.on('SIGTERM', () => { shuttingDown = true; logger.warn('[CRON] SIGTERM reçu'); });
process.on('SIGINT',  () => { shuttingDown = true; logger.warn('[CRON] SIGINT reçu');  });

(async () => {
  const t0 = Date.now();
  try {
    if (!CLIENT_ID) throw new Error('INVOICE_CLIENT_ID non défini dans .env');

    await requeueStaleProcessing();
    const summary = await dispatchPendingInvoices(CLIENT_ID);

    const stats = await getInvoiceStats();
    logger.info(`[CRON-INVOICE] résumé: ${JSON.stringify(summary)}`);
    logger.info(`[CRON-INVOICE] état global: ${JSON.stringify(stats)}`);
    logger.info(`[CRON-INVOICE] durée totale: ${Date.now() - t0}ms`);

    process.exit(0);
  } catch (err) {
    logger.error('[CRON-INVOICE] Erreur:', err.message);
    logger.error(err.stack);
    process.exit(1);
  }
})();
