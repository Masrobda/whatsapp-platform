// src/workers/whatsapp.worker.universal.js
// VERSION FINALE FUSIONNÉE :
//   - Logique d'envoi de la version serveur (fonctionne avec PDF)
//   - Optimisations performance (concurrency 50, parallel updates, etc.)
//   - Fix wati_local_id (correction critique webhook delivered/read)
//   - Logs détaillés pour diagnostic
const { Worker } = require('bullmq');
const { redisConnection } = require('../config/redis');
const { query } = require('../config/database');
const logger = require('../utils/logger');
const watiService = require('../services/wati.service');
const campaignWatiService = require('../services/campaign-wati.service');
const { canSendToRecipient, incrementClientStats } = require('../services/message.service');
const alarmVideoService = require('../services/alarm-video.service');
const { uploadAndConvertVideoFromStream } = require('../services/storage-upload.service');
const { normalizePhoneNumber } = require('../utils/phone-validator');
const sessionService = require('../services/session.service');

async function incrementCampaignSentCount(campaignId) {
  try {
    await query(
      `UPDATE campaigns SET sent_count = sent_count + 1, updated_at = NOW() WHERE id = $1`,
      [campaignId]
    );
  } catch (err) {
    logger.error(`[incrementCampaignSentCount] Erreur pour ${campaignId}:`, err.message);
  }
}

// ============================================================
// CONFIGURATION OPTIMISÉE POUR 50M MESSAGES/MOIS
// ============================================================
const WORKER_CONFIG = {
  connection: redisConnection,
  concurrency: 50,          // ↑ 15→50 : traitement parallèle massif
  lockDuration: 30000,      // ↓ 60s→30s : jobs rapides ~300ms
  stalledInterval: 15000,   // ↓ détection stall plus rapide
  maxStalledCount: 2,
  removeOnComplete: { age: 1800, count: 200 },  // libère Redis plus vite
  removeOnFail:    { age: 43200, count: 1000 },
  limiter: {
    max: 10,        // 80 msg/s max vers l'API WATI
    duration: 1000,
  },
};

// ============================================================
// STATS EN MÉMOIRE
// ============================================================
const workerStats = new Map();

function updateWorkerStats(queueName, success, duration) {
  if (!workerStats.has(queueName)) {
    workerStats.set(queueName, { total: 0, success: 0, failed: 0, avgDuration: 0 });
  }
  const stats = workerStats.get(queueName);
  stats.total++;
  if (success) stats.success++;
  else stats.failed++;
  stats.avgDuration = (stats.avgDuration * (stats.total - 1) + duration) / stats.total;
}

// ============================================================
// TRAITEMENT PRINCIPAL D'UN JOB
// ============================================================
async function processMessage(job) {
  const startTime = Date.now();
  const { messageId, client_id, recipient_phone, phoneNumber } = job.data;

  logger.info(`[WORKER] ▶ jobId=${job.id} messageId=${messageId} attempt=${job.attemptsMade + 1}`);
  logger.info(`[WORKER] type=${job.data.message_type} template=${job.data.template_name} hasInvoice=${!!job.data.invoice_data} isCampaign=${!!job.data.is_campaign}`);

  try {
    // ── 1. Vérification statut (sans FOR UPDATE SKIP LOCKED — inutile ici)
    const statusCheck = await query(
      `SELECT wa_status FROM messages WHERE id = $1`,
      [messageId]
    );

    if (statusCheck.rows.length === 0) {
      throw new Error(`Message ${messageId} non trouvé`);
    }

    const currentStatus = statusCheck.rows[0].wa_status;
    if (currentStatus !== 'queued') {
      logger.info(`[WORKER] ${messageId} déjà traité (${currentStatus}), skip`);
      return { success: true, skipped: true };
    }

    // ── 2. Vérification cooldown / opt-out
    const cooldownCheck = await canSendToRecipient(recipient_phone, client_id);
    if (!cooldownCheck.canSend) {
      logger.warn(`[WORKER] Bloqué: ${cooldownCheck.reason}`);
      await markMessageAsFailed(messageId, client_id, cooldownCheck.reason);
      return { success: false, fatal: true, reason: cooldownCheck.reason };
    }

    // ── 3. Envoi WATI (logique de la version serveur — préservée intacte)
    const result = await sendViaWati(job.data);

    if (!result?.success) {
      throw new Error(result?.error || 'Échec WATI sans détail');
    }

    // ── 4. Mise à jour BDD + stats (parallèle — optimisation)
    await markMessageAsSent(messageId, client_id, result);
    await incrementClientStats(phoneNumber, client_id);
    // Incrémenter sent_count de la campagne si c'est une campagne
if (job.data.is_campaign && job.data.campaign_id) {
  await incrementCampaignSentCount(job.data.campaign_id);
}
    const duration = Date.now() - startTime;
    logger.info(`[WORKER] ✅ ${messageId} en ${duration}ms | wati_local_id=${result.localMessageId}`);
    updateWorkerStats(job.queueName, true, duration);

    return { success: true, duration, localId: result.localMessageId };

  } catch (error) {
    const duration = Date.now() - startTime;
    logger.error(`[WORKER] ❌ ${messageId} en ${duration}ms: ${error.message}`);
    updateWorkerStats(job.queueName, false, duration);

    if (isFatalError(error)) {
      await markMessageAsFailed(messageId, client_id, error.message);
      return { success: false, fatal: true };
    }

    throw error; // BullMQ retente selon backoff
  }
}

/* async function trySessionOrAutoReengage(data, recipient_phone, phoneNumber) {
  const sessionActive = await sessionService.isSessionActive({
    clientId: data.client_id,
    phone: recipient_phone,
  });
  if (sessionActive) return null; // fenêtre ouverte, envoi libre autorisé normalement

  console.log(`⏰ [SESSION] Fenêtre 24h expirée pour ${recipient_phone} — relance automatique par template`);
  const fallback = await sessionService.getDefaultReengagementTemplate(data.client_id);

  if (!fallback || !fallback.templateName) {
    throw new Error(`NO_REENGAGEMENT_TEMPLATE: aucun template de relance configuré pour le client ${data.client_id}`);
  }

  const templateResult = await watiService.sendTemplateMessage(
    recipient_phone,
    fallback.templateName,
    {},
    fallback.templateLanguage || 'fr',
    phoneNumber
  );

  if (!templateResult?.success) {
    throw new Error(templateResult?.error || 'Échec envoi template de relance automatique');
  }

  await sessionService.recordTemplateSent({ clientId: data.client_id, phone: recipient_phone });
  logger.info(`✅ [SESSION] Relance auto envoyée à ${recipient_phone} via template "${fallback.templateName}"`);

  return { ...templateResult, autoReengaged: true };
}*/

async function trySessionOrAutoReengage(data, recipient_phone, phoneNumber) {
  const sessionActive = await sessionService.isSessionActive({
    clientId: data.client_id,
    phone: recipient_phone,
  });
  if (sessionActive) return null;

  console.log(`⏰ [SESSION] Fenêtre 24h expirée pour ${recipient_phone} — relance automatique par template`);
  const fallback = await sessionService.getDefaultReengagementTemplate(data.client_id);

  if (!fallback || !fallback.templateName) {
    throw new Error(`NO_REENGAGEMENT_TEMPLATE: aucun template de relance configuré pour le client ${data.client_id}`);
  }

  // ── Récupérer le nom du contact depuis les données du message (si disponible) ──
  const contactName = data.contact_name || data.sender_name || 'Client';

  // ── Envoyer le template avec le paramètre "name" ──
  const templateResult = await watiService.sendTemplateMessage(
    recipient_phone,
    fallback.templateName,
    { name: contactName },   // ← correspond à {{name}} dans le template
    fallback.templateLanguage || 'fr',
    phoneNumber
  );

  if (!templateResult?.success) {
    throw new Error(templateResult?.error || 'Échec envoi template de relance automatique');
  }

  await sessionService.recordTemplateSent({ clientId: data.client_id, phone: recipient_phone });
  logger.info(`✅ [SESSION] Relance auto envoyée à ${recipient_phone} avec template "${fallback.templateName}" pour ${contactName}`);

  return { ...templateResult, autoReengaged: true };
}

// ============================================================
// ROUTAGE DE L'ENVOI — LOGIQUE SERVEUR PRÉSERVÉE INTACTE
// (fonctionne avec PDF individuel + campagne + template standard)
// ============================================================
async function sendViaWati(data) {
  console.log("=== [WORKER] DONNÉES REÇUES ===");
  console.log("message_type:", data.message_type);
  console.log("template_name:", data.template_name);
  console.log("is_campaign:", data.is_campaign);
  console.log("has_invoice_data:", !!data.invoice_data);
  console.log("has_ordered_values:", !!(data.ordered_values && data.ordered_values.length));

  const recipient_phone   = data.recipient_phone  || data.recipientPhone;
  const message_type      = data.message_type     || data.messageType;
  const template_name     = data.template_name    || data.templateName;
  const template_language = data.template_language || data.templateLanguage || 'fr';
  const phoneNumber       = data.phoneNumber      || data.phone_number;

  let result;

  switch (message_type) {

    case 'template':

      // ── PRIORITÉ 1 : Campagne avec ordre préservé (toujours avant invoice_data)
      if (data.is_campaign && data.ordered_values) {
        const mediaUrl = data.media_url || data.mediaUrl || null;
        console.log(`📋 [CAMPAGNE] Envoi avec ordre préservé (${data.ordered_values.length} valeurs)${mediaUrl ? ', média: ' + mediaUrl : ''}`);
        result = await campaignWatiService.sendCampaignTemplateMessage(
          recipient_phone,
          template_name,
          data.ordered_values,
          template_language,
          phoneNumber,
          mediaUrl
        );
        break;
      }

      // ── PRIORITÉ 2 : Message individuel avec PDF (invoice_data)
      if (data.invoice_data) {
        const pdfUrl = data.invoice_data.pdfUrl || data.invoice_data.url || '';
        console.log(`📄 [PDF INDIVIDUEL] sendInvoiceWithPDF | pdfUrl=${pdfUrl}`);

        if (!pdfUrl || !pdfUrl.startsWith('http')) {
          throw new Error(`URL du PDF invalide : "${pdfUrl}"`);
        }

        result = await watiService.sendInvoiceWithPDF(
          recipient_phone,
          template_name,
          data.template_params || {},
          data.invoice_data,
          phoneNumber
        );
        break;
      }

      // ── PRIORITÉ 3 : Template standard
      console.log(`📤 [TEMPLATE STANDARD] sendTemplateMessage`);
      result = await watiService.sendTemplateMessage(
        recipient_phone,
        template_name,
        data.template_params || {},
        template_language,
        phoneNumber
      );
      break;

      case 'text': {
  const reengaged = await trySessionOrAutoReengage(data, recipient_phone, phoneNumber);
  if (reengaged) { result = reengaged; break; }
  result = await watiService.sendTextMessage(
    recipient_phone,
    data.message_content || data.text,
    phoneNumber
  );
  break;
}

case 'media': {
  const reengaged = await trySessionOrAutoReengage(data, recipient_phone, phoneNumber);
  if (reengaged) { result = reengaged; break; }
  result = await watiService.sendMediaMessage(
    recipient_phone,
    data.media_url,
    data.media_type || 'document',
    data.caption || '',
    phoneNumber
  );
  break;
}

    default:
      throw new Error(`INVALID_MESSAGE_TYPE: type inconnu "${message_type}"`);
  }

  console.log(`[sendViaWati] Résultat: success=${result?.success} localId=${result?.localMessageId} error=${result?.error || 'N/A'}`);
  return result;
}

// ============================================================
// MISE À JOUR BDD APRÈS SUCCÈS
// ============================================================
/**
 * CORRECTION CRITIQUE :
 *
 * WATI retourne à l'envoi :
 *   local_message_id = "52854d8b-..."  ← UUID interne WATI
 *   (PAS de wamid à ce stade)
 *
 * Webhook WATI arrive ensuite avec :
 *   localMessageId    = "52854d8b-..."     ← même UUID → recherche par wati_local_id
 *   whatsappMessageId = "wamid.HBgL..."   ← vrai wamid WhatsApp
 *
 * DONC :
 *   wati_local_id ← local_message_id  (clé de recherche pour le webhook)
 *   wa_message_id ← NE PAS écraser ici (sera mis à jour par le webhook)
 *
 * Les deux UPDATE tournent en PARALLÈLE → gain ~50% latence BDD
 */
async function markMessageAsSent(messageId, clientId, sendResult) {
  const watiLocalId = sendResult.localMessageId || null;
  const waMessageId = sendResult.watiMessageId  || null;
  const clientTable = `messages_client_${clientId.replace(/-/g, '_')}`;

  console.log(`📝 [markMessageAsSent] messageId=${messageId} wati_local_id=${watiLocalId} wa_message_id=${waMessageId}`);

  if (!watiLocalId) {
    console.error(`❌ Pas de localMessageId pour ${messageId} — wati_local_id ne sera pas sauvegardé`);
  }

  // Deux UPDATE en PARALLÈLE
  const [r1] = await Promise.all([
    query(
      `UPDATE messages
       SET wati_local_id = $1,
           wa_message_id = CASE
             WHEN $2::text IS NOT NULL AND $2::text <> ''
             THEN $2::text
             ELSE wa_message_id
           END,
           wa_status = 'sent',
           sent_at   = NOW()
       WHERE id = $3 AND created_at >= NOW() - INTERVAL '7 days'`,
      [watiLocalId, waMessageId, messageId]
    ),
    query(
      `UPDATE ${clientTable}
       SET wati_local_id = $1,
           wa_message_id = CASE
             WHEN $2::text IS NOT NULL AND $2::text <> ''
             THEN $2::text
             ELSE wa_message_id
           END,
           wa_status = 'sent',
           sent_at   = NOW()
       WHERE id = $3 AND created_at >= NOW() - INTERVAL '7 days'`,
      [watiLocalId, waMessageId, messageId]
    ),
  ]);

  if (r1.rowCount === 0) {
    logger.warn(`[markMessageAsSent] ⚠️ Aucune ligne modifiée pour ${messageId} — vérifiez la partition PostgreSQL`);
  } else {
    console.log(`✅ [markMessageAsSent] wati_local_id=${watiLocalId} sauvegardé`);
  }
}

// ============================================================
// MISE À JOUR BDD APRÈS ÉCHEC (PARALLÈLE)
// ============================================================
async function markMessageAsFailed(messageId, clientId, errorMessage) {
  console.log(`❌ Message ${messageId} échoué: ${errorMessage}`);

  if (!clientId) {
    logger.error(`[markMessageAsFailed] clientId manquant pour ${messageId}`);
    return;
  }

  const clientTable = `messages_client_${clientId.replace(/-/g, '_')}`;
  const truncatedError = String(errorMessage || '').slice(0, 500);

  await Promise.all([
    query(
      `UPDATE messages
       SET wa_status        = 'failed',
           wa_error_message = $1,
           failed_at        = NOW()
       WHERE id = $2 AND wa_status = 'queued'`,
      [truncatedError, messageId]
    ),
    query(
      `UPDATE ${clientTable}
       SET wa_status        = 'failed',
           wa_error_message = $1,
           failed_at        = NOW()
       WHERE id = $2`,
      [truncatedError, messageId]
    ),
  ]).catch(err => logger.error(`[markMessageAsFailed] Erreur BDD: ${err.message}`));
}

// ============================================================
// ERREURS FATALES (ne pas retenter)
// ============================================================
function isFatalError(error) {
  const fatalPatterns = [
    'COOLDOWN_ACTIVE',
    'INVALID_MESSAGE_TYPE',
    'CLIENT_NOT_FOUND',
    'INSUFFICIENT_QUOTA',
    'template non trouvé',
    'URL du PDF invalide',
    'Client inactif',
    'Quota insuffisant',
    'NO_REENGAGEMENT_TEMPLATE', 
 ];
  return fatalPatterns.some(pattern => error.message.includes(pattern));
}

// ============================================================
// GESTION DU CYCLE DE VIE DES WORKERS (un par numéro WhatsApp)
// ============================================================
const workers = new Map();
let statsInterval   = null;
let refreshInterval = null;

async function initWorkers() {
  try {
    const result = await query(
      `SELECT phone_number FROM whatsapp_numbers WHERE is_active = true`
    );

    const activePhones = result.rows.map(r => r.phone_number);

    for (const phone of activePhones) {
      const normalizedPhone = phone.replace(/[^0-9]/g, '');
      const queueName = `whatsapp-messages-${normalizedPhone}`;

      if (workers.has(queueName)) continue; // déjà démarré

      logger.info(`🚀 Démarrage worker: ${queueName}`);

      const worker = new Worker(queueName, processMessage, WORKER_CONFIG);

      worker.on('completed', (job, returnValue) => {
        if (returnValue?.skipped) {
          logger.debug(`⏭ Job ${job.id} ignoré (déjà traité)`);
        } else {
          logger.info(`✅ Job ${job.id} terminé | localId=${returnValue?.localId || 'N/A'}`);
        }
      });

      worker.on('failed', (job, err) => {
        if (!job) return;
        logger.error(`❌ Job ${job.id} échoué (attempt ${job.attemptsMade}/${job.opts?.attempts}): ${err?.message}`);
      });

      worker.on('stalled', (jobId) => {
        logger.warn(`⚠️ Job stalled: ${jobId}`);
      });

      worker.on('error', (err) => {
        logger.error(`🔥 Worker error [${queueName}]: ${err.message}`);
      });

      workers.set(queueName, worker);
    }

    // Fermer les workers pour les numéros désactivés
    for (const [queueName, worker] of workers) {
      const phone = queueName.replace('whatsapp-messages-', '');
      const stillActive = activePhones.some(p => p.replace(/[^0-9]/g, '') === phone);
      if (!stillActive) {
        logger.info(`🛑 Fermeture worker inactif: ${queueName}`);
        await worker.close();
        workers.delete(queueName);
      }
    }

    if (!statsInterval) startStatsReporting();

    logger.info(`📊 ${workers.size} workers actifs | ${activePhones.length} numéros`);

  } catch (error) {
    logger.error('❌ Erreur initWorkers:', error.message);
  }
}

// ============================================================
// REPORTING STATS (toutes les minutes)
// ============================================================
function startStatsReporting() {
  statsInterval = setInterval(() => {
    if (workerStats.size === 0) return;
    logger.info('📈 STATS WORKERS:');
    for (const [name, stats] of workerStats) {
      const successRate = stats.total > 0
        ? (stats.success / stats.total * 100).toFixed(1)
        : 0;
      logger.info(
        `   ${name}: ${stats.total} jobs | Succès: ${successRate}% | Avg: ${stats.avgDuration.toFixed(0)}ms | Failed: ${stats.failed}`
      );
    }
  }, 60000);
}

// ============================================================
// DÉMARRAGE + REFRESH TOUTES LES 5 MINUTES
// ============================================================
initWorkers();
refreshInterval = setInterval(initWorkers, 300000);

// ============================================================
// ARRÊT GRACIEUX
// ============================================================
async function shutdown(signal) {
  logger.info(`🛑 [${signal}] Arrêt gracieux...`);
  if (statsInterval)   clearInterval(statsInterval);
  if (refreshInterval) clearInterval(refreshInterval);

  const closePromises = [];
  for (const [name, worker] of workers) {
    logger.info(`   Fermeture: ${name}`);
    closePromises.push(worker.close());
  }
  await Promise.allSettled(closePromises);
  logger.info('✅ Tous les workers fermés.');
  process.exit(0);
}

process.on('SIGTERM', () => shutdown('SIGTERM'));
process.on('SIGINT',  () => shutdown('SIGINT'));

module.exports = { processMessage, initWorkers };
