// api/src/services/hetu-alarm-detail.service.js
const axios = require('axios');
const logger = require('../utils/logger');
const authService = require('./alarm-auth.service');

class HetuAlarmDetailService {
  constructor() {
    this.baseURL = process.env.ALARM_API_BASE_URL || 'https://api.hetuv2x.com';
  }

  /**
   * Récupère les détails complets d'une alarme via l'API REST /commonAlarm/list
   * @param {string} licenseNum - Plaque d'immatriculation
   * @param {string} alarmNo - Numéro d'alarme
   * @param {string} startTime - Heure de début de l'alarme (format 'yyyy-MM-dd HH:mm:ss')
   * @param {string} endTime - Heure de fin (optionnel, on peut prendre startTime + 1 minute)
   * @returns {Promise<Object|null>} - Les données de l'alarme ou null si non trouvée
   */
  async getAlarmDetails(licenseNum, alarmNo, startTime, endTime = null) {
    try {
      const headers = await authService.getHeaders();
      
      // Élargir la plage horaire à ±15 minutes pour être sûr de trouver l'alarme
      const start = new Date(startTime);
      const end = endTime ? new Date(endTime) : new Date(start.getTime() + 60000);
      const startSearch = new Date(start.getTime() - 15 * 60 * 1000);
      const endSearch = new Date(end.getTime() + 15 * 60 * 1000);
      
      const startStr = startSearch.toISOString().replace('T', ' ').slice(0, 19);
      const endStr = endSearch.toISOString().replace('T', ' ').slice(0, 19);
      
      let url = `${this.baseURL}/vehicle-openapi/alarm/commonAlarm/list?licenseNum=${encodeURIComponent(licenseNum)}`;
      url += `&startTime=${encodeURIComponent(startStr)}`;
      url += `&endTime=${encodeURIComponent(endStr)}`;
      url += `&solveStatus=0`; // inclure les alarmes non traitées
      // On pourrait ajouter alarmType si besoin, mais on filtre après

      logger.info(`[HetuAlarmDetail] Requête REST: ${url}`);
      const response = await axios.get(url, { headers, timeout: 10000 });

      if (response.data.code !== 200) {
        logger.warn(`[HetuAlarmDetail] Code erreur: ${response.data.code}, message: ${response.data.message}`);
        return null;
      }

      let alarms = response.data.data;
      if (!Array.isArray(alarms)) {
        alarms = [alarms];
      }

      logger.info(`[HetuAlarmDetail] ${alarms.length} alarme(s) trouvée(s) dans la plage`);

      // Filtrer par alarmNo si fourni
      if (alarmNo) {
        alarms = alarms.filter(a => a.alarmNo === alarmNo);
        if (alarms.length === 0) {
          logger.warn(`[HetuAlarmDetail] Aucune alarme avec alarmNo=${alarmNo} trouvée dans la plage`);
          // Afficher les alarmNos trouvés pour déboguer
          const allAlarmNos = response.data.data.map(a => a.alarmNo).join(', ');
          logger.info(`[HetuAlarmDetail] AlarmNos trouvés: ${allAlarmNos}`);
          return null;
        }
      }

      const alarm = alarms[0];
      logger.info(`[HetuAlarmDetail] Alarme trouvée: alarmNo=${alarm.alarmNo}, startTime=${alarm.startTime}, alarmSpeed=${alarm.alarmSpeed}, location=${alarm.location}`);
      return alarm;

    } catch (err) {
      logger.error(`[HetuAlarmDetail] Erreur pour licenseNum=${licenseNum}, alarmNo=${alarmNo}:`, err.message);
      if (err.response) {
        logger.error(`[HetuAlarmDetail] Status: ${err.response.status}, Data:`, err.response.data);
      }
      return null;
    }
  }
}

module.exports = new HetuAlarmDetailService();
