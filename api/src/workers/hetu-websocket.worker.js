// api/src/workers/hetu-websocket.worker.js
require('dotenv').config({ path: '/var/www/numericexport/api/.env' });

const hetuWebSocketService = require('../services/hetu-websocket.service');
const logger = require('../utils/logger');

logger.info('[HetuWS Worker] 🚀 Démarrage du worker WebSocket...');
const username = process.env.HETU_WEBSOCKET_USERNAME || 'RcmTest003';
logger.info(`[HetuWS Worker] 👤 Username: ${username}`);
logger.info(`[HetuWS Worker] 🌐 URL: ${process.env.HETU_WEBSOCKET_URL || 'ws://api.hetuv2x.com:20007'}`);

try {
  // Démarrer la connexion (asynchrone, mais on n'attend pas la fin)
  hetuWebSocketService.connect(username, 'fr-FR');
  logger.info('[HetuWS Worker] ✅ Connexion initiée avec succès.');
} catch (err) {
  logger.error(`[HetuWS Worker] ❌ Erreur lors de la connexion: ${err.message}`);
  console.error(err);
}

// Gestion des signaux d'arrêt
process.on('SIGTERM', () => {
  logger.info('[HetuWS Worker] SIGTERM reçu, fermeture...');
  process.exit(0);
});

process.on('SIGINT', () => {
  logger.info('[HetuWS Worker] SIGINT reçu, fermeture...');
  process.exit(0);
});
