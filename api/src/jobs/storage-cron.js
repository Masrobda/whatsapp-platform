const cron = require('node-cron');
const { query } = require('../config/database');
const logger = require('../utils/logger');

cron.schedule('0 0 * * *', async () => {
  try {
    await query(
      'UPDATE storage_spaces SET is_active = false WHERE expires_at < NOW() AND is_active = true'
    );
    logger.info('Espaces expirés désactivés');
  } catch (err) {
    logger.error('Erreur cron espaces', err);
  }
}, { timezone: 'Africa/Douala' });

module.exports = {};
