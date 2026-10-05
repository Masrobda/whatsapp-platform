// api/src/workers/bot-inactivity.cron.js
'use strict';

require('dotenv').config();
const logger = require('../utils/logger');
const chatbotService = require('../services/chatbot.service');
const watiService = require('../services/wati.service');
const sessionService = require('../services/session.service');

const CHATBOT_CLIENT_ID = process.env.CHATBOT_CLIENT_ID || 'ccd14b70-aa49-4906-8abc-5ff097e16107';
const TICK_MS = 60 * 1000; // scan chaque minute

async function tick() {
  try {
    const rows = await chatbotService.findInactiveConversations();
    for (const row of rows) {
      const lang = row.language || 'fr';
      const t = chatbotService.MESSAGES[lang] || chatbotService.MESSAGES.fr;
      const text = t.inactivityClose();

      try {
        // Vérifier si la session 24h est encore active
        const sessionActive = await sessionService.isSessionActive({
          clientId: CHATBOT_CLIENT_ID,
          phone: row.phone,
        });

        if (sessionActive) {
          await watiService.sendTextMessage(row.phone, text, row.bot_number);
          logger.info(`[BOT-INACTIVITY] Message envoyé à ${row.phone}`);
        } else {
          logger.info(`[BOT-INACTIVITY] Session 24h expirée pour ${row.phone}, clôture sans envoi`);
        }
      } catch (e) {
        logger.warn(`[BOT-INACTIVITY] Erreur envoi pour ${row.phone}:`, e.message);
      }

      // Clôturer la conversation (que l’envoi ait réussi ou non)
      await chatbotService.markClosed(row.phone);
      logger.info(`[BOT-INACTIVITY] Conversation clôturée : ${row.phone}`);
    }
  } catch (e) {
    logger.error('[BOT-INACTIVITY] Erreur globale :', e.message);
  }
}

logger.info('🚀 [BOT-INACTIVITY] cron 3 min démarré');
tick();
setInterval(tick, TICK_MS);
