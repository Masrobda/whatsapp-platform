// src/services/storage-cleaner.service.js
const { query } = require('../config/database');
const logger = require('../utils/logger');
const fs = require('fs-extra');
const path = require('path');

const STORAGE_PATH = process.env.STORAGE_PATH || '/var/www/storage/clients';

class StorageCleanerService {
    
    async checkExpiredSpaces() {
        try {
            logger.info('🔍 Vérification des espaces expirés...');

            // Espaces expirés depuis plus de 7 jours
            const expiredSpaces = await query(
                `SELECT id, client_id, storage_path, size_limit_bytes, expires_at, deleted_at
                 FROM storage_spaces
                 WHERE (expires_at < now() - interval '7 days' OR deleted_at < now())
                   AND deleted_at IS NULL`
            );

            logger.info(`${expiredSpaces.rowCount} espaces à purger`);

            for (const space of expiredSpaces.rows) {
                await this.purgeSpace(space);
            }

            // Espaces qui expirent bientôt (notification)
            const expiringSoon = await query(
                `SELECT s.*, c.email, c.company_name
                 FROM storage_spaces s
                 JOIN clients c ON s.client_id = c.id
                 WHERE s.expires_at BETWEEN now() AND now() + interval '7 days'
                   AND s.deleted_at IS NULL
                   AND s.is_active = true`
            );

            for (const space of expiringSoon.rows) {
                await this.sendExpirationWarning(space);
            }

        } catch (err) {
            logger.error('Erreur cleaner:', err);
        }
    }

    async purgeSpace(space) {
        try {
            logger.info(`🗑️ Purge de l'espace ${space.id}`);

            // Marquer comme supprimé
            await query(
                `UPDATE storage_spaces 
                 SET deleted_at = now(),
                     is_active = false
                 WHERE id = $1`,
                [space.id]
            );

            // Supprimer les fichiers physiquement
            const spacePath = path.join(STORAGE_PATH, space.id);
            if (await fs.pathExists(spacePath)) {
                await fs.remove(spacePath);
                logger.info(`📁 Dossier supprimé: ${spacePath}`);
            }

            // Journaliser
            await query(
                `INSERT INTO system_logs (event_type, description, metadata)
                 VALUES ($1, $2, $3)`,
                [
                    'storage_purge',
                    `Espace ${space.id} purgé après expiration`,
                    JSON.stringify({
                        client_id: space.client_id,
                        size_limit: space.size_limit_bytes,
                        expires_at: space.expires_at
                    })
                ]
            );

        } catch (err) {
            logger.error(`Erreur purge espace ${space.id}:`, err);
        }
    }

    async sendExpirationWarning(space) {
        try {
            const daysLeft = Math.ceil((new Date(space.expires_at) - new Date()) / (1000 * 60 * 60 * 24));
            
            logger.info(`⚠️ Rappel expiration pour ${space.id}: ${daysLeft} jours restants`);

            // Log pour notification (à implémenter avec système de notifications)
            await query(
                `INSERT INTO notifications (user_id, type, title, message, metadata)
                 VALUES ($1, $2, $3, $4, $5)`,
                [
                    space.client_id,
                    'expiration_warning',
                    `Votre abonnement expire dans ${daysLeft} jours`,
                    `Votre espace de stockage arrivera à expiration le ${new Date(space.expires_at).toLocaleDateString('fr-FR')}. Pensez à renouveler pour conserver vos données.`,
                    JSON.stringify({
                        space_id: space.id,
                        expires_at: space.expires_at,
                        days_left: daysLeft
                    })
                ]
            );

        } catch (err) {
            logger.error('Erreur envoi avertissement:', err);
        }
    }

    async startCleaner() {
        // Exécuter toutes les heures
        setInterval(() => {
            this.checkExpiredSpaces();
        }, 60 * 60 * 1000);

        // Première exécution immédiate
        this.checkExpiredSpaces();

        logger.info('🧹 Storage cleaner démarré');
    }
}

module.exports = new StorageCleanerService();
