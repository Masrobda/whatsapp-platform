// src/workers/sync-contacts.worker.js
const { query } = require('../config/database');
const axios = require('axios');
const logger = require('../utils/logger');

const REMOTE_SYNC_URL = 'https://factures.camlight.cm/api/receive_valid_contacts.php';
const API_KEY = process.env.INTERNAL_API_KEY;

async function syncContacts() {
  logger.info('[SYNC] Démarrage synchronisation');
  
  // Récupérer les contacts validés depuis 24h
  const contacts = await query(`
    SELECT contract_number, whatsapp_phone
    FROM whatsapp_valid_contacts
    WHERE activated_at >= NOW() - INTERVAL '10 day'
  `);

  console.log(`[SYNC] ${contacts.length} contacts récupérés`);

  if (contacts.length === 0) {
    logger.info('[SYNC] Aucun nouveau contact');
    return;
  }

  try {
    const response = await axios.post(REMOTE_SYNC_URL, {
      contacts: contacts.map(c => ({
        contract_number: c.contract_number,
        whatsapp_phone: c.whatsapp_phone
      }))
    }, {
      headers: { 'X-API-Key': API_KEY },
      timeout: 30000,
    });

    logger.info(`[SYNC] ${response.data.updated || 0} contacts synchronisés`);
  } catch (err) {
    logger.error('[SYNC] Erreur:', err.message);
  }
}

if (require.main === module) {
  syncContacts().then(() => process.exit(0)).catch(() => process.exit(1));
}

module.exports = { syncContacts };
