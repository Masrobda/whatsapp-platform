// src/workers/campaign.cron.js
// Cron job pour le lancement des campagnes planifiées
// PM2: pm2 start src/workers/campaign.cron.js --name "campaign-cron"

const { query } = require('../config/database');
const { launchCampaign } = require('../services/campaign.service');
const logger = require('../utils/logger');

const INTERVAL_MS = 60 * 1000; // Toutes les 60 secondes

async function processScheduledCampaigns() {
  try {
    // Récupérer les campagnes planifiées dont la date est passée
    const campaigns = await query(
      `SELECT id, client_id, created_by
       FROM campaigns 
       WHERE status = 'scheduled' 
         AND scheduled_at IS NOT NULL 
         AND scheduled_at <= NOW()`,
      []
    );

    if (campaigns.rows.length === 0) {
      return { processed: 0 };
    }

    let processed = 0;
    for (const campaign of campaigns.rows) {
      try {
        logger.info(`[CRON] Lancement campagne planifiée: ${campaign.id}`);
        await launchCampaign(campaign.id, campaign.client_id, campaign.created_by);
        processed++;
        logger.info(`[CRON] Campagne ${campaign.id} lancée avec succès`);
      } catch (err) {
        logger.error(`[CRON] Erreur lancement campagne ${campaign.id}:`, err.message);
      }
    }

    return { processed };
  } catch (error) {
    logger.error('[CRON] Erreur traitement campagnes planifiées:', error);
    return { processed: 0, error: error.message };
  }
}

async function runCron() {
  try {
    const result = await processScheduledCampaigns();
    if (result.processed > 0) {
      logger.info(`[CRON] Campagnes planifiées: ${result.processed} campagne(s) lancée(s)`);
    }
  } catch (err) {
    logger.error('[CRON] Erreur:', err.message);
  }
}

// Premier run immédiat, puis toutes les minutes
runCron();
const interval = setInterval(runCron, INTERVAL_MS);
logger.info(`[CRON] Campagnes planifiées démarré (intervalle: ${INTERVAL_MS/1000}s)`);

process.on('SIGTERM', () => {
  clearInterval(interval);
  logger.info('[CRON] Campagnes planifiées arrêté');
  process.exit(0);
});

process.on('SIGINT', () => {
  clearInterval(interval);
  process.exit(0);
});

module.exports = { runCron, processScheduledCampaigns };
