const { query } = require('../config/database');
const logger = require('../utils/logger');
const cron = require('node-cron');

/**
 * Nettoyer les messages de plus de 90 jours
 */
async function cleanupOldMessages() {
  try {
    logger.info('Début du nettoyage des anciens messages...');

    const result = await query(
      `DELETE FROM messages
       WHERE delete_after < CURRENT_TIMESTAMP
       RETURNING id`,
      []
    );

    const deletedCount = result.rowCount;

    if (deletedCount > 0) {
      logger.info(`${deletedCount} messages supprimés (> 90 jours)`);
      await query(
        `INSERT INTO audit_logs (action, entity_type, new_values)
         VALUES ($1, $2, $3)`,
        ['MESSAGES_CLEANUP', 'message', JSON.stringify({ deleted_count: deletedCount })]
      );
    } else {
      logger.info('Aucun message à supprimer');
    }

    return { success: true, deletedCount };

  } catch (error) {
    logger.error('Erreur nettoyage messages:', error);
    return { success: false, error: error.message };
  }
}

/**
 * Nettoyer les sessions expirées de réinitialisation de mot de passe
 */
async function cleanupExpiredPasswordResets() {
  try {
    const result = await query(
      `DELETE FROM password_resets
       WHERE expires_at < CURRENT_TIMESTAMP OR used = true`,
      []
    );

    if (result.rowCount > 0) {
      logger.info(`${result.rowCount} tokens de réinitialisation supprimés`);
    }

    return { success: true, deletedCount: result.rowCount };

  } catch (error) {
    logger.error('Erreur nettoyage password resets:', error);
    return { success: false, error: error.message };
  }
}

/**
 * Nettoyer les liens d'invitation expirés
 */
async function cleanupExpiredInvitations() {
  try {
    const result = await query(
      `DELETE FROM invitation_links
       WHERE expires_at < CURRENT_TIMESTAMP`,
      []
    );

    if (result.rowCount > 0) {
      logger.info(`${result.rowCount} invitations expirées supprimées`);
    }

    return { success: true, deletedCount: result.rowCount };

  } catch (error) {
    logger.error('Erreur nettoyage invitations:', error);
    return { success: false, error: error.message };
  }
}

/**
 * Nettoyer les anciens logs d'audit (> 1 an)
 */
async function cleanupOldAuditLogs() {
  try {
    const result = await query(
      `DELETE FROM audit_logs
       WHERE created_at < CURRENT_TIMESTAMP - INTERVAL '1 year'`,
      []
    );

    if (result.rowCount > 0) {
      logger.info(`${result.rowCount} logs d'audit supprimés (> 1 an)`);
    }

    return { success: true, deletedCount: result.rowCount };

  } catch (error) {
    logger.error('Erreur nettoyage audit logs:', error);
    return { success: false, error: error.message };
  }
}

/**
 * Réinitialiser les quotas d'essai expirés
 */
async function resetExpiredTrials() {
  try {
    const result = await query(
      `UPDATE clients
       SET quota_remaining = 0
       WHERE trial_expires_at < CURRENT_TIMESTAMP
       AND quota_remaining > 0
       AND quota_total = ${process.env.TRIAL_MESSAGES || 25}
       RETURNING id, email`,
      []
    );

    if (result.rowCount > 0) {
      logger.info(`${result.rowCount} essais expirés réinitialisés`);
      result.rows.forEach(client => {
        logger.info(`Essai expiré pour: ${client.email}`);
      });
    }

    return { success: true, resetCount: result.rowCount };

  } catch (error) {
    logger.error('Erreur réinitialisation essais:', error);
    return { success: false, error: error.message };
  }
}

/**
 * Nettoyer l'index message_id (fonction stockée)
 */
async function cleanupMessageIdIndex() {
  try {
    logger.info('Nettoyage de l\'index message_id...');
    await query('SELECT cleanup_message_id_index();');
    logger.info('✅ Index message_id nettoyé avec succès');
    return { success: true };
  } catch (error) {
    logger.error('Erreur lors du nettoyage de l\'index message_id:', error);
    return { success: false, error: error.message };
  }
}

/**
 * Gérer les partitions de la table messages
 * Supprime les partitions de plus de 12 mois et crée les partitions futures
 */
async function cleanupPartitions() {
  try {
    logger.info('Gestion des partitions de la table messages...');
    await query('SELECT manage_messages_partitions();');
    logger.info('✅ Partitions gérées avec succès');
    return { success: true };
  } catch (error) {
    logger.error('Erreur lors de la gestion des partitions:', error);
    return { success: false, error: error.message };
  }
}

/**
 * Nettoyer les logs de webhooks de plus de X jours
 * Par défaut 60 jours, modifiable via WEBHOOK_LOG_RETENTION_DAYS
 */
async function cleanupWebhookLogs() {
  const retentionDays = parseInt(process.env.WEBHOOK_LOG_RETENTION_DAYS) || 60;
  try {
    const result = await query(
      `DELETE FROM webhook_logs
       WHERE created_at < NOW() - INTERVAL '${retentionDays} days'`,
      []
    );

    if (result.rowCount > 0) {
      logger.info(`${result.rowCount} webhook logs supprimés (> ${retentionDays} jours)`);
    } else {
      logger.info('Aucun webhook log à supprimer');
    }

    return { success: true, deletedCount: result.rowCount };

  } catch (error) {
    logger.error('Erreur nettoyage webhook logs:', error);
    return { success: false, error: error.message };
  }
}

/**
 * Supprimer les sessions WhatsApp expirées
 */
async function cleanupExpiredSessions() {
  try {
    const result = await query(
      `DELETE FROM whatsapp_sessions
       WHERE status = 'expired' AND client_id <> 'ccd14b70-aa49-4906-8abc-5ff097e16107'`,
      []
    );

    if (result.rowCount > 0) {
      logger.info(`${result.rowCount} sessions WhatsApp expirées supprimées`);
    } else {
      logger.info('Aucune session WhatsApp expirée à supprimer');
    }

    return { success: true, deletedCount: result.rowCount };

  } catch (error) {
    logger.error('Erreur nettoyage sessions WhatsApp:', error);
    return { success: false, error: error.message };
  }
}


/**
 * Tâche de nettoyage complète
 */
async function runCleanupTasks() {
  logger.info('='.repeat(50));
  logger.info('Exécution des tâches de nettoyage planifiées');
  logger.info('='.repeat(50));

  const results = await Promise.allSettled([
    cleanupOldMessages(),
    cleanupExpiredPasswordResets(),
    cleanupExpiredInvitations(),
    cleanupOldAuditLogs(),
    resetExpiredTrials(),
    cleanupMessageIdIndex(),
    cleanupPartitions(),
    cleanupWebhookLogs(),
    cleanupExpiredSessions(),
  ]);

  const taskNames = [
    'Messages anciens',
    'Tokens réinitialisation',
    'Invitations expirées',
    'Logs d\'audit',
    'Essais expirés',
    'Index message_id',
    'Partitions messages',
    'Webhook logs',
    'Sessions WhatsApp expirées'
  ];

  results.forEach((result, index) => {
    if (result.status === 'fulfilled') {
      logger.info(`✅ ${taskNames[index]}: ${JSON.stringify(result.value)}`);
    } else {
      logger.error(`❌ ${taskNames[index]}: ${result.reason}`);
    }
  });

  logger.info('='.repeat(50));
  logger.info('Tâches de nettoyage terminées');
  logger.info('='.repeat(50));
}

/**
 * Planifier les tâches de nettoyage
 * Cron: Tous les jours à 2h du matin
 */
function scheduleCleanupTasks() {
  cron.schedule('0 2 * * *', async () => {
    await runCleanupTasks();
  });

  logger.info('✅ Tâches de nettoyage planifiées (tous les jours à 2h00)');

  // Nettoyage des sessions expirées à 3h (heure différente)
  cron.schedule('0 3 * * *', async () => {
    logger.info('Exécution du nettoyage des sessions WhatsApp expirées (3h)');
    await cleanupExpiredSessions();
  });
  logger.info('✅ Nettoyage des sessions WhatsApp expirées planifié (tous les jours à 3h00)');

  setTimeout(() => {
    logger.info('Exécution initiale du nettoyage...');
    runCleanupTasks();
    cleanupExpiredSessions();
  }, 60000);
}

// Démarrer la planification si ce fichier est exécuté directement
if (require.main === module) {
  scheduleCleanupTasks();

  process.on('SIGTERM', () => {
    logger.info('SIGTERM reçu, arrêt du worker de nettoyage...');
    process.exit(0);
  });

  process.on('SIGINT', () => {
    logger.info('SIGINT reçu, arrêt du worker de nettoyage...');
    process.exit(0);
  });
}

module.exports = {
  cleanupOldMessages,
  cleanupExpiredPasswordResets,
  cleanupExpiredInvitations,
  cleanupOldAuditLogs,
  resetExpiredTrials,
  cleanupMessageIdIndex,
  cleanupPartitions,
  cleanupWebhookLogs,
  cleanupExpiredSessions,
  runCleanupTasks,
  scheduleCleanupTasks,
};
