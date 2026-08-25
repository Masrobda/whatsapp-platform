const cron = require('node-cron');
const { processOrphanWebhooks } = require('./orphan-webhook.processor');
const logger = require('../utils/logger');

cron.schedule('*/5 * * * *', async () => {
  logger.info('🕒 Orphan webhook cron triggered');
  await processOrphanWebhooks();
});

logger.info('Orphan webhook cron started (every 5 minutes)');
