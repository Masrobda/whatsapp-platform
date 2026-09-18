// api/src/services/alarm-notification.service.js
const { query } = require('../config/database');
const logger = require('../utils/logger');

/**
 * Vérifie si une vidéo d'alarme a déjà été envoyée.
 *
 * fileId peut être null : vehicleAlarmFile (WebSocket Hetu) ne fournit jamais
 * de fileId, seulement fileName/filePath. Dans ce cas la déduplication repose
 * uniquement sur file_path (qui est toujours unique par fichier).
 *
 * @param {number|string|null} fileId - ID du fichier chez Hetu (peut être null)
 * @param {string} filePath - Chemin complet du fichier
 * @returns {Promise<boolean>}
 */
async function isVideoAlreadySent(fileId, filePath) {
  try {
    const result = await query(
      `SELECT id FROM alarm_notifications WHERE (file_id = $1 AND file_id IS NOT NULL) OR file_path = $2 LIMIT 1`,
      [fileId, filePath]
    );
    return result.rowCount > 0;
  } catch (err) {
    logger.error('[AlarmNotification] Erreur vérification doublon:', err.message);
    return false; // En cas d'erreur, on considère que ce n'est pas un doublon pour ne pas bloquer
  }
}

/**
 * Enregistre l'envoi d'une vidéo d'alarme.
 * fileId peut être null (colonne file_id désormais nullable en base, voir
 * migration : ALTER TABLE alarm_notifications ALTER COLUMN file_id DROP NOT NULL).
 *
 * @param {number|string|null} fileId - ID du fichier chez Hetu (peut être null)
 * @param {string} filePath - Chemin complet du fichier
 * @param {string} licenseNum - Plaque d'immatriculation
 * @param {string} alarmType - Type d'alarme
 * @param {string} recipientPhone - Numéro de téléphone du destinataire
 * @param {string} messageId - ID du message WhatsApp (optionnel)
 */
async function markVideoAsSent(fileId, filePath, licenseNum, alarmType, recipientPhone, messageId = null) {
  try {
    await query(
      `INSERT INTO alarm_notifications (file_id, file_path, license_num, alarm_type, recipient_phone, message_id)
       VALUES ($1, $2, $3, $4, $5, $6)`,
      [fileId ?? null, filePath, licenseNum, alarmType, recipientPhone, messageId]
    );
    logger.info(`[AlarmNotification] Enregistré: fileId=${fileId ?? 'null'}, recipient=${recipientPhone}`);
  } catch (err) {
    logger.error('[AlarmNotification] Erreur enregistrement:', err.message);
    throw err;
  }
}

module.exports = { isVideoAlreadySent, markVideoAsSent };
