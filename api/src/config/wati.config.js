// src/config/wati.config.js
module.exports = {
  // Configuration WATI
  wati: {
    baseURL: process.env.WATI_API_URL || 'https://live-server-xxxx.wati.io',
    apiKey: process.env.WATI_API_KEY,
    apiSecret: process.env.WATI_API_SECRET,
    webhookSecret: process.env.WATI_WEBHOOK_SECRET,
    timeout: 30000,
    retries: 3
  },
  
  // Configuration des règles
  rules: {
    // Délai minimum entre deux messages pour un même destinataire (2 semaines = 14 jours)
    messageCooldownDays: 14,
    // Activation du contrôle de cooldown
    enableCooldown: true
  },
  
  // Mode test
  testMode: process.env.NODE_ENV === 'test' || process.env.WATI_TEST_MODE === 'true'
};
