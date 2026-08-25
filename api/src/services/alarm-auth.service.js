// api/src/services/alarm-auth.service.js
require('dotenv').config({ path: '/var/www/numericexport/api/.env' });

const axios = require('axios');
const logger = require('../utils/logger');

class AlarmAuthService {
  constructor() {
    this.baseURL = process.env.ALARM_API_BASE_URL || 'https://api.hetuv2x.com';
    this.appCid = process.env.ALARM_APP_CID;
    this.appSecret = process.env.ALARM_APP_SECRET;
    this.cachedToken = null;
    this.tokenExpiry = 0;

    if (!this.appCid || !this.appSecret) {
      logger.error('[AlarmAuth] ❌ CRITICAL: ALARM_APP_CID ou ALARM_APP_SECRET non définis !');
    } else {
      logger.info('[AlarmAuth] ✅ Credentials chargés');
    }
  }

  async getToken() {
    const now = Date.now();
    if (this.cachedToken && now < this.tokenExpiry - 10 * 60 * 1000) {
      logger.info(`[AlarmAuth] Token valide, expire dans ${Math.round((this.tokenExpiry - now) / 1000)}s`);
      return this.cachedToken;
    }

    logger.info('[AlarmAuth] Obtention nouveau token...');
    try {
      if (!this.appCid || !this.appSecret) {
        throw new Error('ALARM_APP_CID ou ALARM_APP_SECRET manquant');
      }

      const response = await axios.post(
        `${this.baseURL}/vehicle-openapi/sys/login`,
        { appCid: this.appCid, appSecret: this.appSecret },
        { headers: { 'Content-Type': 'application/json' }, timeout: 10000 }
      );

      if (response.data.code !== 200) {
        throw new Error(`Login failed: ${response.data.message}`);
      }

      const { Authorization, expiresIn } = response.data.data;
      if (!Authorization) throw new Error('No authorization token');

      this.cachedToken = Authorization;
      this.tokenExpiry = now + (expiresIn || 7200) * 1000;
      logger.info(`[AlarmAuth] Nouveau token obtenu, expire dans ${expiresIn}s`);
      return this.cachedToken;
    } catch (err) {
      this.cachedToken = null;
      this.tokenExpiry = 0;
      logger.error('[AlarmAuth] Erreur getToken:', err.message);
      throw new Error(`Impossible d'obtenir le token: ${err.message}`);
    }
  }

  async getHeaders() {
    const token = await this.getToken();
    return {
      'Authorization': token,
      'Content-Type': 'application/json',
      'Accept-Language': 'fr-FR'
    };
  }

  forceRefresh() {
    logger.warn('[AlarmAuth] Force refresh token');
    this.cachedToken = null;
    this.tokenExpiry = 0;
  }
}

module.exports = new AlarmAuthService();
