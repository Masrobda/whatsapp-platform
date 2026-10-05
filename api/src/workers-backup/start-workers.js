// src/workers/start-workers.js
const { query } = require('../config/database');
const { spawn } = require('child_process');
const logger = require('../utils/logger');

async function launchAllWorkers() {
  const res = await query('SELECT phone_number FROM whatsapp_numbers WHERE is_active = true');

  if (res.rows.length === 0) {
    logger.warn('Aucun numéro actif → pas de workers');
    return;
  }

  res.rows.forEach(({ phone_number }) => {
    const proc = spawn('node', ['src/workers/whatsapp-worker.js', `--phone=${phone_number}`], {
      detached: true,
      stdio: 'inherit'
    });

    proc.unref();
    logger.info(`Worker lancé pour ${phone_number} (PID ${proc.pid})`);
  });
}

launchAllWorkers().catch(err => {
  logger.error('Échec lancement workers', err);
  process.exit(1);
});
