require('dotenv').config({ path: '/var/www/numericexport/api/.env' });

const cron = require('node-cron');
const { pollNewAlarms } = require('../services/alarm-polling.service');
const logger = require('../utils/logger');

const CLIENT_ID = process.env.SYSTEM_CLIENT_ID || '76b922a9-9109-4d80-9c9c-2eb29a5d53a7';
const ALARM_TYPE = process.env.ALARM_POLLING_TYPE || null;
const POLLING_INTERVAL = process.env.ALARM_POLLING_INTERVAL || '*/5 * * * *';
const HOURS_BACK = parseInt(process.env.ALARM_POLLING_HOURS_BACK) || 72;

logger.info(`[AlarmPolling] Démarré. ClientId: ${CLIENT_ID}, Intervalle: ${POLLING_INTERVAL}, Heures: ${HOURS_BACK}`);

cron.schedule(POLLING_INTERVAL, async () => {
  logger.info('[AlarmPolling] Début du cycle...');
  try {
    await pollNewAlarms(CLIENT_ID, ALARM_TYPE, HOURS_BACK);
  } catch (err) {
    logger.error('[AlarmPolling] Erreur:', err.message);
  }
  logger.info('[AlarmPolling] Cycle terminé.');
}, {
  timezone: "Africa/Douala"
});

logger.info('[AlarmPolling] Cron planifié avec succès.');
