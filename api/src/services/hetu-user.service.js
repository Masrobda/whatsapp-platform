// api/src/services/hetu-user.service.js
const axios = require('axios');
const logger = require('../utils/logger');
const authService = require('./alarm-auth.service');

class HetuUserService {
  constructor() {
    this.baseURL = process.env.ALARM_API_BASE_URL || 'https://api.hetuv2x.com';
  }

  async getUserById(userId) {
    try {
      const headers = await authService.getHeaders();
      const url = `${this.baseURL}/vehicle-openapi/user/${userId}`;
      const response = await axios.get(url, { headers, timeout: 10000 });
      if (response.data.code === 200 && response.data.data) {
        return { ...response.data.data, userId };
      }
      throw new Error(`Erreur Hetu: ${response.data.message || 'Inconnue'}`);
    } catch (err) {
      logger.error(`[HetuUser] getUserById(${userId}) échec:`, err.message);
      throw err;
    }
  }

  async listUsers(companyId = null, username = null) {
    try {
      const headers = await authService.getHeaders();
      const payload = {};
      if (companyId) payload.companyId = companyId;
      if (username) payload.username = username;

      const response = await axios.post(
        `${this.baseURL}/vehicle-openapi/user/list`,
        payload,
        { headers, timeout: 10000 }
      );

      if (response.data.code === 200 && response.data.data) {
        return response.data.data.map(u => ({
          userId: u.userId,
          username: u.username,
          account: u.account,
          phone: u.phone || null,
          email: u.email || null,
          status: u.status,
          roleName: u.roleName,
          roleId: u.roleId,
          companyId: u.companyId
        }));
      }
      throw new Error(`Erreur Hetu: ${response.data.message || 'Inconnue'}`);
    } catch (err) {
      logger.error('[HetuUser] listUsers échec:', err.message);
      throw err;
    }
  }
}

module.exports = new HetuUserService();
