// src/cron/clean-old-messages.js
const { query } = require('../config/database');
const logger = require('../utils/logger');

async function cleanOldMessages() {
  try {
    logger.info('🧹 [CRON] Démarrage nettoyage messages anciens (delete_after < NOW())');

    // DELETE sur la table globale partitionnée
    const globalResult = await query(`
      DELETE FROM messages 
      WHERE delete_after < NOW()
    `);

    const globalDeleted = globalResult.rowCount; // nombre de lignes supprimées

    logger.info(`[GLOBAL] ${globalDeleted} messages supprimés de la table messages`);

    // Optionnel : nettoyage des tables clients (décommente si tu veux)
    
    const clients = await query('SELECT id FROM clients');
    let totalClientDeleted = 0;

    for (const client of clients.rows) {
      const tableName = `messages_client_${client.id.replace(/-/g, '_')}`;
      
      const exists = await query(`
        SELECT EXISTS (
          SELECT FROM information_schema.tables 
          WHERE table_schema = 'public' AND table_name = $1
        )
      `, [tableName]);

      if (exists.rows[0].exists) {
        const clientResult = await query(`
          DELETE FROM ${tableName} 
          WHERE delete_after < NOW()
        `);

        const clientDeleted = clientResult.rowCount;
        totalClientDeleted += clientDeleted;

        if (clientDeleted > 0) {
          logger.info(`[CLIENT ${client.id}] ${clientDeleted} messages supprimés de ${tableName}`);
        }
      }
    }
    logger.info(`[CLIENTS TOTAL] ${totalClientDeleted} messages supprimés dans tables clients`);
    

    logger.info('✨ [CRON] Nettoyage terminé avec succès');
  } catch (err) {
    logger.error('❌ [CRON] Erreur nettoyage messages :', err.message);
    logger.error('Stack:', err.stack);
  }
}

if (require.main === module) {
  cleanOldMessages()
    .then(() => process.exit(0))
    .catch(err => {
      console.error(err);
      process.exit(1);
    });
}

module.exports = cleanOldMessages;
