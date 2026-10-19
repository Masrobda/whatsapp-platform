// src/jobs/whatsapp-daily-update.js
const cron = require('node-cron');
const { query } = require('../config/database');
const axios = require('axios');
const logger = require('../utils/logger');
const { sendTeamNotification } = require('../services/email.service');

async function updateWhatsappNumbersDaily() {
  try {
    logger.info('Début job quotidien WhatsApp');

    const numbers = await query('SELECT id, phone_number, waba_id FROM whatsapp_numbers WHERE is_active = true');

    for (const num of numbers.rows) {
      try {
        // 1. Reset compteur 24h (tous les jours à minuit)
        await query(
          `UPDATE whatsapp_numbers 
           SET messages_sent_24h = 0,
               last_message_count_reset = NOW()
           WHERE id = $1`,
          [num.id]
        );

        // 2. Récupérer quality rating + tier via API Meta (exemple 360dialog ou direct Meta)
        // Adaptez selon votre BSP
        const metaRes = await axios.get(`https://graph.facebook.com/v20.0/${num.waba_id}`, {
          params: { access_token: process.env.META_ACCESS_TOKEN },
        });

        const quality = metaRes.data?.quality_rating || 'UNKNOWN';
        const tier = metaRes.data?.on_behalf_of_business_info?.current_tier || 'Tier 1';

        await query(
          `UPDATE whatsapp_numbers 
           SET quality_rating = $1,
               tier_current = $2,
               last_quality_check = NOW()
           WHERE id = $3`,
          [quality, tier, num.id]
        );

        // 3. Alerte si downgrade ou RED
        if (quality === 'RED' || tier.includes('downgrade')) {
          await sendTeamNotification(
            '⚠️ ALERTE WHATSAPP',
            `Numéro ${num.phone_number} → Quality: ${quality} | Tier: ${tier}`
          );
          logger.warn(`ALERTE: Numéro ${num.phone_number} en danger`, { quality, tier });
        }

      } catch (err) {
        logger.error(`Erreur mise à jour numéro ${num.phone_number}`, err);
      }
    }

    logger.info('Job quotidien WhatsApp terminé');
  } catch (err) {
    logger.error('Erreur globale job WhatsApp quotidien', err);
  }
}

// Planification : tous les jours à 00:05
cron.schedule('5 0 * * *', updateWhatsappNumbersDaily, {
  timezone: 'Africa/Douala',
});

logger.info('Job quotidien WhatsApp planifié (00:05)');

module.exports = { updateWhatsappNumbersDaily };
