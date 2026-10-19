// api/src/utils/phone-validator.js
const logger = require('../utils/logger');

/**
 * Normalise un numéro de téléphone au format international (+2376XXXXXXXX)
 * - Supprime les espaces, points, tirets
 * - S'assure qu'il commence par +2376
 * - Vérifie que la longueur totale est de 13 caractères (y compris le +)
 * @param {string} phone - Numéro brut
 * @returns {string|null} - Numéro formaté ou null si invalide
 */
function normalizePhoneNumber(phone) {
  if (!phone) return null;

  // Nettoyer : enlever tous les caractères non numériques sauf le +
  let cleaned = phone.replace(/[^0-9+]/g, '');

  // Si le numéro ne commence pas par +, on ajoute le préfixe +237
  if (!cleaned.startsWith('+')) {
    // Si le numéro commence par 237 (sans +), on ajoute le +
    if (cleaned.startsWith('237')) {
      cleaned = '+' + cleaned;
    } else {
      // Sinon on ajoute +237 par défaut (pour les numéros locaux commençant par 6 par exemple)
      cleaned = '+237' + cleaned;
    }
  }

  // Vérifier le préfixe +2376
  if (!cleaned.startsWith('+2376')) {
    // Si le numéro est +237 mais le 6ème chiffre est manquant, on l'ajoute
    if (cleaned.startsWith('+237') && cleaned.length === 12) {
      cleaned = cleaned.slice(0, 5) + '6' + cleaned.slice(5);
    } else {
      logger.warn(`Numéro de téléphone invalide (doit commencer par +2376): ${phone}`);
      return null;
    }
  }

  // Vérifier la longueur totale (13 caractères avec le +)
  if (cleaned.length !== 13) {
    logger.warn(`Numéro de téléphone invalide (longueur ${cleaned.length}, attendu 13): ${phone}`);
    return null;
  }

  return cleaned;
}

module.exports = { normalizePhoneNumber };
