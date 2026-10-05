// api/src/workers/socadel-sync.cron.js
'use strict';

require('dotenv').config();
const logger = require('../utils/logger');
const { runBatchSync } = require('../services/socadel-sync.service');

const INTERVAL_MS = 15 * 60 * 1000; // 15 minutes
let running = false;

async function tick() {
  if (running) {
    logger.warn('[SOCADEL-CRON] Sync déjà en cours — skip');
    return;
  }
  running = true;
  try {
    const stats = await runBatchSync();
    logger.info('[SOCADEL-CRON] OK', stats);
  } catch (e) {
    logger.error('[SOCADEL-CRON] Erreur:', e.message);
  } finally {
    running = false;
  }
}

logger.info('🚀 [SOCADEL-CRON] Démarré — sync toutes les 15 min');
tick(); // premier passage au boot
setInterval(tick, INTERVAL_MS);

process.on('SIGTERM', () => {
  logger.info('[SOCADEL-CRON] Arrêt SIGTERM');
  process.exit(0);
});
process.on('SIGINT', () => {
  logger.info('[SOCADEL-CRON] Arrêt SIGINT');
  process.exit(0);
});
