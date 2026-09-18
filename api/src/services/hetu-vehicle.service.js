// api/src/services/hetu-vehicle.service.js
const axios = require('axios');
const logger = require('../utils/logger');
const authService = require('./alarm-auth.service');

class HetuVehicleService {
  constructor() {
    this.baseURL = process.env.ALARM_API_BASE_URL || 'https://api.hetuv2x.com';
  }

  /**
   * Récupère la liste des véhicules (avec plaque, deviceNum, driverName, etc.)
   * @param {string} licenseNum - Filtre sur la plaque (optionnel)
   * @param {number} motorcadeId - Filtre sur la flotte (optionnel)
   * @param {number} onlineStatus - 1=en ligne, 0=hors ligne (optionnel)
   * @returns {Promise<Array>}
   */
  async listVehicles(licenseNum = null, motorcadeId = null, onlineStatus = null) {
    try {
      const headers = await authService.getHeaders();
      const payload = {};
      if (licenseNum) payload.licenseNum = licenseNum;
      if (motorcadeId) payload.motorcadeId = motorcadeId;
      if (onlineStatus !== null) payload.onlineStatus = onlineStatus;

      const response = await axios.post(
        `${this.baseURL}/vehicle-openapi/vehicle/list`,
        payload,
        { headers, timeout: 15000 }
      );

      if (response.data.code === 200 && response.data.data) {
        return response.data.data.map(v => ({
          vehicleId: v.vehicleId,
          licenseNum: v.licenseNum,
          deviceNum: v.deviceNum,
          driverName: v.driverName,
          companyName: v.companyName,
          onlineStatus: v.onlineStatus,
          status: v.status
        }));
      }
      throw new Error(`Erreur Hetu: ${response.data.message || 'Inconnue'}`);
    } catch (err) {
      logger.error('[HetuVehicle] listVehicles échec:', err.message);
      throw err;
    }
  }

  /**
   * Récupère le deviceNum pour une ou plusieurs plaques
   * @param {string|string[]} licenseNums - Une plaque ou un tableau de plaques
   * @returns {Promise<Array<{licenseNum: string, deviceNum: string}>>}
   */
  async getDeviceNumbers(licenseNums) {
    try {
      const headers = await authService.getHeaders();
      const licenseParam = Array.isArray(licenseNums) ? licenseNums.join(',') : licenseNums;
      const url = `${this.baseURL}/vehicle-openapi/vehicle/deviceNum?licenseNum=${encodeURIComponent(licenseParam)}`;
      const response = await axios.get(url, { headers, timeout: 10000 });

      if (response.data.code === 200 && response.data.data) {
        return response.data.data;
      }
      throw new Error(`Erreur Hetu: ${response.data.message || 'Inconnue'}`);
    } catch (err) {
      logger.error('[HetuVehicle] getDeviceNumbers échec:', err.message);
      throw err;
    }
  }
}

module.exports = new HetuVehicleService();
