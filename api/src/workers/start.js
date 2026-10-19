// src/workers/start.js
require('dotenv').config();
const logger = require('../utils/logger');
const { scheduleCleanupTasks } = require('./cleanup.worker');

scheduleCleanupTasks();

logger.info(`
╔══════════════════════════════════════════════════╗
║           🔧 LEGACY WORKERS DÉMARRÉS            ║
║                                                  ║
║  🧹 Cleanup Worker: Planifié (2h00 / jour)       ║
║  ℹ️  Worker WhatsApp Universel → processus PM2   ║
║     indépendant "whatsapp-worker"                ║
╚══════════════════════════════════════════════════╝
`);

// Gestion d'arrêt propre
process.on('SIGTERM', () => {
  logger.info('SIGTERM → arrêt du cleanup worker...');
  // node-cron n'a pas de méthode close, on quitte simplement
  process.exit(0);
});

process.on('SIGINT', () => {
  logger.info('SIGINT → arrêt du cleanup worker...');
  process.exit(0);
});
