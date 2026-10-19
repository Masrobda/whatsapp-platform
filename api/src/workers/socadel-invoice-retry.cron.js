'use strict';

const logger = require('../utils/logger');
const { runInvoiceRetryJob } = require('../services/socadel-invoice-retry.service');

const INTERVAL_MS = parseInt(process.env.SOCADEL_INVOICE_RETRY_INTERVAL_MS || '300000', 10); // 5 min

async function tick() {
  try {
    const r = await runInvoiceRetryJob();
    if (r.enqueued || r.processed) {
      logger.info('[INVOICE-RETRY-CRON]', r);
    }
  } catch (e) {
    logger.error('[INVOICE-RETRY-CRON]', e.message);
  }
}

tick();
setInterval(tick, INTERVAL_MS);

logger.info(`[INVOICE-RETRY-CRON] started every ${INTERVAL_MS / 1000}s`);

process.on('SIGTERM', () => process.exit(0));
process.on('SIGINT', () => process.exit(0));
