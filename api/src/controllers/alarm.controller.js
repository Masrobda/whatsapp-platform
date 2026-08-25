// api/src/controllers/alarm.controller.js
const alarmVideoService = require('../services/alarm-video.service');
const { uploadAndConvertVideoFromStream } = require('../services/storage-upload.service');
const { sendAlarmTemplate } = require('../services/whatsapp-send.service');
const hetuUserService = require('../services/hetu-user.service');
const logger = require('../utils/logger');
const { isVideoAlreadySent, markVideoAsSent } = require('../services/alarm-notification.service');
const { normalizePhoneNumber } = require('../utils/phone-validator');
const hetuWebSocketService = require('../services/hetu-websocket.service');

const alarmLabels = {
  emergencyAlarm: "Alerte d'urgence détectée",
  speedingAlarm: "Excès de vitesse détectée",
  fatigueDrivingAlarm: "Conduite fatiguée détectée",
  forwardCollision: "Collision frontale détectée",
  laneDeparture: "Franchissement de ligne détectée",
  pedestrianCollision: "Risque piéton détectée",
  makeCalls: "Appel au volant détectée",
};

function getAlarmLabel(type) {
  return alarmLabels[type] || `⚠️ Alarme ${type}`;
}

async function sendAlarmVideo(request, reply) {
  try {
    const userId = request.user?.id;
    if (!userId) {
      return reply.status(401).send({ success: false, message: "Utilisateur non authentifié" });
    }

    const {
      licenseNum,
      alarmType,
      startTime,
      endTime,
      recipientPhone,
      driverId,
      channelNum,
      phoneNumber
    } = request.body;

    // Validation
    if (!licenseNum || !alarmType || !startTime || !endTime) {
      return reply.status(400).send({
        success: false,
        message: "Paramètres manquants : licenseNum, alarmType, startTime, endTime"
      });
    }

    // Déterminer le destinataire
    let finalRecipient = null;
    if (recipientPhone) {
      finalRecipient = normalizePhoneNumber(recipientPhone);
    } else if (driverId) {
      try {
        const userInfo = await hetuUserService.getUserById(driverId);
        if (userInfo.phone) {
          finalRecipient = normalizePhoneNumber(userInfo.phone);
          logger.info(`[Alarm] Téléphone récupéré pour driverId ${driverId}: ${finalRecipient}`);
        }
      } catch (err) {
        logger.error(`[Alarm] Échec récupération téléphone driverId ${driverId}:`, err.message);
      }
    }

    if (!finalRecipient) {
      return reply.status(400).send({
        success: false,
        message: "Aucun destinataire valide. Fournissez recipientPhone ou driverId avec téléphone valide."
      });
    }

    // 1. Récupérer la vidéo depuis Hetu
    logger.info(`[Alarm] Recherche vidéo: ${licenseNum} / ${alarmType} de ${startTime} à ${endTime}`);
    const { stream, originalName, startTime: videoTime, fileId, filePath } = await alarmVideoService.fetchFirstAlarmVideo(
      licenseNum, alarmType, startTime, endTime, channelNum
    );

    // Vérifier si déjà envoyée (doublon)
    const alreadySent = await isVideoAlreadySent(fileId, filePath);
    if (alreadySent) {
      return reply.status(200).send({
        success: true,
        message: "Vidéo déjà envoyée précédemment",
        skipped: true
      });
    }

    // 2. Upload et conversion
    const uploadResult = await uploadAndConvertVideoFromStream(stream, originalName, userId, licenseNum);
    if (!uploadResult.success) {
      throw new Error(`Upload échoué: ${uploadResult.error}`);
    }

    // 3. Envoi WhatsApp
    const alarmLabel = getAlarmLabel(alarmType);
    const dateTimeStr = videoTime ? videoTime.replace(' ', ' à ') : new Date().toLocaleString();
    const channelNumber = phoneNumber || request.user.phoneNumber || process.env.DEFAULT_WHATSAPP_NUMBER;

    const sendResult = await sendAlarmTemplate(
      finalRecipient,
      uploadResult.publicUrl,
      alarmLabel,
      licenseNum,
      dateTimeStr,
      channelNumber
    );
    if (!sendResult.success) {
      throw new Error(`WhatsApp échoué: ${sendResult.error}`);
    }

    // 4. Enregistrer comme envoyé
    await markVideoAsSent(fileId, filePath, licenseNum, alarmType, finalRecipient, sendResult.localMessageId);

    return reply.send({
      success: true,
      message: "Vidéo d'alarme envoyée avec succès",
      video: { url: uploadResult.publicUrl, size: uploadResult.size },
      recipient: finalRecipient,
      whatsapp: sendResult
    });

  } catch (error) {
    logger.error(`[AlarmController] ${error.message}`);
    return reply.status(500).send({
      success: false,
      message: "Erreur lors de l'envoi de la vidéo d'alarme",
      error: error.message
    });
  }
}

/**
 * Route de test pour simuler une alarme WebSocket
 * Body attendu (exemple) :
 * {
 *   "licenseNum": "LT404NK",
 *   "alarmType": "fatigueDrivingAlarm",
 *   "startTime": "2026-06-26 14:15:00",
 *   "location": "Douala, Cameroun",
 *   "latitude": 4.0511,
 *   "longitude": 9.7679,
 *   "speed": 82,
 *   "driverName": "Jean Pierre",
 *   "motorcadeName": "Flotte 003"
 * }
 */
async function testWebSocketAlarm(request, reply) {
  try {
    console.log('[TEST] testWebSocketAlarm appelée'); // <-- log de test
    const payload = request.body;
    console.log('[TEST] Payload reçu:', JSON.stringify(payload, null, 2));
    if (!payload.licenseNum) {
      return reply.status(400).send({ success: false, message: 'licenseNum est requis' });
    }

    await hetuWebSocketService.handleAlarm(payload);
    console.log('[TEST] handleAlarm terminée sans erreur');
    return reply.send({
      success: true,
      message: 'Alarme simulée envoyée avec succès. Le message WhatsApp devrait arriver dans quelques instants.'
    });
  } catch (err) {
    console.error('[TEST] Erreur:', err.message);
    return reply.status(500).send({
      success: false,
      message: 'Erreur lors de la simulation',
      error: err.message
    });
  }
}

module.exports = { sendAlarmVideo, testWebSocketAlarm };
