// src/workers/automation.cron.js
// Cron job pour le traitement des étapes d'automatisation
// À lancer avec : node src/workers/automation.cron.js
// Ou intégrer dans PM2 : pm2 start src/workers/automation.cron.js --name "automation-cron"

const { processScheduledSteps } = require('../services/automation.service');
const logger = require('../utils/logger');

const INTERVAL_MS = 60 * 1000; // Toutes les 60 secondes

async function runCron() {
  try {
    const result = await processScheduledSteps();
    if (result.processed > 0) {
      logger.info(`[CRON] Automation: ${result.processed} étapes traitées`);
    }
  } catch (err) {
    logger.error('[CRON] Erreur automation:', err.message);
  }
}

// Premier run immédiat, puis toutes les minutes
runCron();
const interval = setInterval(runCron, INTERVAL_MS);
logger.info(`[CRON] Automation démarrée (intervalle: ${INTERVAL_MS/1000}s)`);

process.on('SIGTERM', () => {
  clearInterval(interval);
  logger.info('[CRON] Automation arrêtée');
  process.exit(0);
});

process.on('SIGINT', () => {
  clearInterval(interval);
  process.exit(0);
});

module.exports = { runCron };
