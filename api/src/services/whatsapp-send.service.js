// api/src/services/whatsapp-send.service.js
const watiService = require('./wati.service');

/**
 * Envoie un template WhatsApp avec média (vidéo ou image) et tous les détails
 * @param {string} recipientPhone - Destinataire
 * @param {string} mediaUrl - URL du média (vidéo ou image)
 * @param {string} alarmLabel - Libellé de l'alarme
 * @param {string} licensePlate - Plaque du véhicule
 * @param {string} dateTime - Date/heure
 * @param {string} channelNumber - Numéro WhatsApp expéditeur
 * @param {object} extraParams - Paramètres supplémentaires (doit contenir les clés 5,6,7,8,9)
 * @returns {Promise<Object>}
 */
async function sendAlarmTemplate(recipientPhone, mediaUrl, alarmLabel, licensePlate, dateTime, channelNumber, extraParams = {}) {
  // Construction des paramètres de base (1 à 4)
  const templateParams = {
    "1": mediaUrl,
    "2": alarmLabel,
    "3": licensePlate,
    "4": dateTime
  };

  // Fusion avec les paramètres supplémentaires (5 à 9)
  for (const [key, value] of Object.entries(extraParams)) {
    templateParams[key] = value;
  }

  // Déterminer le nom du template selon le type de média
  let templateName = 'next_alarm_video_02';
  if (mediaUrl && mediaUrl.match(/\.(jpg|jpeg|png|gif)$/i)) {
    templateName = 'next_alarm_image_01';
  } else if (mediaUrl && mediaUrl.match(/\.mp4$/i)) {
    templateName = 'next_alarm_video_02';
  }

  return await watiService.sendTemplateMessage(
    recipientPhone,
    templateName,
    templateParams,
    'fr',
    channelNumber
  );
}

module.exports = { sendAlarmTemplate };
