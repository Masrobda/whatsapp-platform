const fs = require('fs-extra');
const path = require('path');
const { query } = require('../config/database');
const logger = require('../utils/logger');

const STORAGE_PATH = process.env.STORAGE_PATH || '/var/www/storage/clients';

async function cleanExpiredStorage() {
    logger.info('🧹 DÉMARRAGE DU NETTOYAGE : Recherche d\'espaces expirés depuis +7 jours...');

    try {
        // 1. Trouver les espaces expirés depuis plus de 7 jours
        const result = await query(`
            SELECT id 
            FROM storage_spaces 
            WHERE expires_at < NOW() - INTERVAL '7 days'
        `);

        if (result.rowCount === 0) {
            logger.info('✅ Aucun espace expiré à nettoyer.');
            return;
        }

        logger.info(`🔍 ${result.rowCount} espace(s) trouvé(s) pour suppression.`);

        for (const space of result.rows) {
            const spaceId = space.id;
            const folderPath = path.join(STORAGE_PATH, spaceId);

            // 2. Vérifier si le dossier existe sur le disque
            if (await fs.pathExists(folderPath)) {
                // On vide le contenu du dossier (ou on supprime le dossier complet)
                await fs.emptyDir(folderPath); 
                
                // Optionnel : On peut aussi supprimer le dossier lui-même
                // await fs.remove(folderPath);

                logger.info(`🗑️ Nettoyage effectué pour l'espace : ${spaceId}`);
            }
        }

        logger.info('✨ Opération de nettoyage terminée avec succès.');

    } catch (err) {
        logger.error('❌ ERREUR CRITIQUE lors du nettoyage automatique :', err);
    }
}

// Permet de lancer le script manuellement via : node src/cron/storage-cleaner.js
if (require.main === module) {
    cleanExpiredStorage().then(() => {
        process.exit(0);
    }).catch(err => {
        console.error(err);
        process.exit(1);
    });
}

module.exports = cleanExpiredStorage;
