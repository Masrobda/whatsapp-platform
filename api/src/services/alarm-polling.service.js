// api/src/services/alarm-polling.service.js
const alarmVideoService = require('./alarm-video.service');
const hetuVehicleService = require('./hetu-vehicle.service');
const vehicleMappingService = require('./vehicle-mapping.service');
const { isVideoAlreadySent, markVideoAsSent } = require('./alarm-notification.service');
const { normalizePhoneNumber } = require('../utils/phone-validator');
const { addAlarmToQueue } = require('./alarm-queue.service'); // ← Nouvelle importation
const logger = require('../utils/logger');

const alarmLabels = {
  makeCalls: "faire des appels",
  fatigueDriving: "Conduite fatiguée",
  speedingAlarm: "Excès de vitesse",
  forwardCollision: "Collision frontale",
  laneDeparture: "Franchissement de ligne",
  pedestrianCollision: "Risque piéton",
  emergencyAlarm: "Alerte d'urgence"
};

function getAlarmLabel(type) {
  return alarmLabels[type] || type;
}

async function getPhoneForLicense(licenseNum) {
  try {
    return await vehicleMappingService.getPhoneByLicense(licenseNum);
  } catch (err) {
    logger.error(`[Polling] Erreur récupération téléphone pour ${licenseNum}:`, err.message);
    return null;
  }
}

async function getPlatesToMonitor() {
  try {
    const vehicles = await hetuVehicleService.listVehicles(null, null, 1);
    return vehicles.map(v => ({
      licenseNum: v.licenseNum,
      deviceNum: v.deviceNum,
      driverName: v.driverName
    }));
  } catch (err) {
    logger.error('[Polling] Erreur récupération véhicules:', err.message);
    return [];
  }
}

async function pollNewAlarms(clientId, alarmType = null, hoursBack = 24) {
  try {
    const plates = await getPlatesToMonitor();
    if (plates.length === 0) {
      logger.info('[Polling] Aucune plaque à surveiller');
      return;
    }

    const endTime = new Date();
    const startTime = new Date(endTime.getTime() - hoursBack * 60 * 60 * 1000);
    const startStr = startTime.toISOString().replace('T', ' ').slice(0, 19);
    const endStr = endTime.toISOString().replace('T', ' ').slice(0, 19);

    logger.info(`[Polling] ${plates.length} plaques, période ${startStr} - ${endStr}`);

    for (const plate of plates) {
      try {
        const result = await alarmVideoService.fetchAllVideos(plate.licenseNum, startStr, endStr, alarmType);
        const videos = result.data?.list || [];

        for (const video of videos) {
          if (video.uploadStatus !== 1) continue;

          const alreadySent = await isVideoAlreadySent(video.fileId, video.filePath);
          if (alreadySent) continue;

          let recipient = await getPhoneForLicense(plate.licenseNum);
          if (!recipient) {
            logger.warn(`[Polling] Aucun téléphone pour ${plate.licenseNum}`);
            continue;
          }
          recipient = normalizePhoneNumber(recipient);
          if (!recipient) {
            logger.warn(`[Polling] Numéro invalide pour ${plate.licenseNum}`);
            continue;
          }

          // Préparer les données pour le worker d'alarme
          const jobData = {
            licenseNum: plate.licenseNum,
            alarmType: video.alarmType || alarmType,
            fileId: video.fileId,
            filePath: video.filePath,
            startTime: video.fileTime,
            recipientPhone: recipient,
            clientId: clientId,
            alarmLabel: getAlarmLabel(video.alarmType || alarmType)
          };

          // Ajouter à la queue dédiée aux alarmes
          const queueResult = await addAlarmToQueue(jobData);

          if (queueResult.success) {
            // Marquer comme envoyé dans la table des notifications (pour éviter les doublons)
            await markVideoAsSent(
              video.fileId,
              video.filePath,
              plate.licenseNum,
              video.alarmType || alarmType,
              recipient,
              null // messageId sera rempli par le worker après envoi
            );
            logger.info(`[Polling] Vidéo ${video.fileId} mise en queue alarme`);
          } else {
            logger.error(`[Polling] Échec ajout queue pour ${plate.licenseNum} (fileId=${video.fileId})`);
          }
        }
      } catch (err) {
        logger.error(`[Polling] Erreur pour ${plate.licenseNum}:`, err.message);
      }
    }
  } catch (err) {
    logger.error('[Polling] Erreur globale:', err.message);
  }
}

module.exports = { pollNewAlarms, getPlatesToMonitor, getPhoneForLicense };
