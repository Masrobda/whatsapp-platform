// src/workers/campaign-dispatch.worker.js
// ============================================================
// WORKER DE DISPATCH DE CAMPAGNE — process PM2 indépendant.
//
// Remplace l'ancienne fonction processCampaignSend() qui tournait
// en boucle "while(true)" dans le process API (mortelle au moindre
// restart). Ici, le dispatch est un JOB BULLMQ :
//   - Survit aux redémarrages (Redis garde l'état du job).
//   - Reprend exactement où il s'est arrêté via un curseur (UUID),
//     pas un OFFSET (donc pas de dégradation de perf sur 100k+ lignes).
//   - Insère les contacts par LOT en une seule requête SQL multi-values
//     au lieu d'un aller-retour par contact.
//   - Pousse vers BullMQ (queue WATI) en parallèle contrôlé par lot.
//
// PM2: pm2 start src/workers/campaign-dispatch.worker.js --name "campaign-dispatch-worker"
// ============================================================

const { Worker } = require('bullmq');
const { redisConnection } = require('../config/redis');
const { query } = require('../config/database');
const { v4: uuidv4 } = require('uuid');
const logger = require('../utils/logger');
const { addMessageToQueue } = require('../services/queue.service');
const { canSendToRecipient } = require('../services/message.service');
const audienceService = require('../services/audience.service');

const QUEUE_NAME = 'campaign-dispatch';

// ============================================================
// CONFIGURATION
// ============================================================
const BATCH_SIZE = 500;            // contacts lus/traités par lot SQL
const PARALLEL_ENQUEUE = 25;       // contacts envoyés en parallèle vers BullMQ par mini-lot
const MAX_RUNTIME_MS = 4 * 60 * 1000; // 4 min : au-delà, le job se "ré-enfile" lui-même
                                       // pour éviter de dépasser le lockDuration BullMQ

const WORKER_CONFIG = {
  connection: redisConnection,
  concurrency: 3, // plusieurs campagnes peuvent être dispatchées en parallèle
  lockDuration: 5 * 60 * 1000, // 5 min, cohérent avec MAX_RUNTIME_MS + marge
  stalledInterval: 30000,
  maxStalledCount: 1,
};

// ============================================================
// UTILITAIRES
// ============================================================
function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Détecte un média (PDF/image/...) dans un objet de variables.
 * (Logique reprise telle quelle de campaign.service.js original)
 */
function detectMediaInValues(orderedValues) {
  let mediaUrl = null;
  const textValues = [];

  for (const val of orderedValues) {
    const isPdf =
      typeof val === 'string' &&
      val.toLowerCase().match(/\.(pdf)$/i) &&
      (val.startsWith('http://') || val.startsWith('https://'));

    if (isPdf && !mediaUrl) {
      mediaUrl = val;
    } else {
      textValues.push(val);
    }
  }

  const finalOrderedValues = mediaUrl ? [mediaUrl, ...textValues] : textValues;
  return { mediaUrl, finalOrderedValues };
}

// ============================================================
// CŒUR DU DISPATCH : traite un lot de contacts "pending"
// Retourne le nombre traité et le dernier id vu (curseur).
// ============================================================
async function dispatchBatch(campaign) {
  const {
    id: campaignId,
    client_id,
    phone_number,
    template_name,
    template_language,
    template_params,
    dispatch_cursor,
  } = campaign;

  // 1. Lire le lot via CURSOR (pas OFFSET) — perf constante même à 100k+
  const cursorClause = dispatch_cursor ? 'AND id > $3' : '';
  const params = dispatch_cursor
    ? [campaignId, BATCH_SIZE, dispatch_cursor]
    : [campaignId, BATCH_SIZE];

  const { rows: contacts } = await query(
    `SELECT id, phone_number, name, email, variables, variables_order, status
     FROM campaign_contacts
     WHERE campaign_id = $1 AND status = 'pending' ${cursorClause}
     ORDER BY id ASC
     LIMIT $2`,
    params
  );

  if (contacts.length === 0) {
    return { processed: 0, lastId: dispatch_cursor, done: true };
  }

  let defaultParams = {};
  try {
    defaultParams = typeof template_params === 'string' ? JSON.parse(template_params) : (template_params || {});
  } catch (e) {
    logger.error(`[DISPATCH] template_params invalide pour campagne ${campaignId}: ${e.message}`);
  }

  // 2. Préparer les inserts en mémoire (parsing JSON, normalisation)
  const preparedRows = [];

  for (const contact of contacts) {
    let contactVars = {};
    if (contact.variables) {
      try {
        contactVars = typeof contact.variables === 'string' ? JSON.parse(contact.variables) : contact.variables;
      } catch (e) {
        contactVars = {};
      }
    }

    let orderedValues = [];
    if (contact.variables_order) {
      try {
        orderedValues = typeof contact.variables_order === 'string'
          ? JSON.parse(contact.variables_order)
          : contact.variables_order;
      } catch (e) {
        orderedValues = [];
      }
    }
    if (!Array.isArray(orderedValues) || orderedValues.length === 0) {
      orderedValues = Object.values(contactVars);
    }

    const mergedParams = { ...defaultParams, ...contactVars };
    if (contact.name && !mergedParams.name) mergedParams.name = contact.name;

    const { mediaUrl, finalOrderedValues } = detectMediaInValues(orderedValues);

    if (mediaUrl) {
      for (const [key, val] of Object.entries(mergedParams)) {
        if (val === mediaUrl) {
          delete mergedParams[key];
          break;
        }
      }
    }

    preparedRows.push({
      contactId: contact.id,
      phone: contact.phone_number,
      messageId: uuidv4(),
      mergedParams,
      finalOrderedValues,
      mediaUrl,
    });
  }

  // 3. Vérifier canSendToRecipient en parallèle contrôlé (évite des requêtes séquentielles)
  const eligibility = await mapWithConcurrency(preparedRows, PARALLEL_ENQUEUE, async (row) => {
    const canSend = await canSendToRecipient(row.phone, client_id);
    return { ...row, canSend };
  });

  const toInsert = eligibility.filter((r) => r.canSend.canSend);
  const toSkip = eligibility.filter((r) => !r.canSend.canSend);

  // 4. Marquer les "skip" en masse (1 requête, groupés par raison)
  if (toSkip.length > 0) {
    const byReason = new Map();
    for (const r of toSkip) {
      const reason = r.canSend.reason || 'blocked';
      if (!byReason.has(reason)) byReason.set(reason, []);
      byReason.get(reason).push(r.contactId);
    }
    for (const [reason, ids] of byReason) {
      await query(
        `UPDATE campaign_contacts SET status = 'skipped', skip_reason = $1, updated_at = NOW()
         WHERE id = ANY($2::uuid[])`,
        [reason, ids]
      );
    }
  }

  if (toInsert.length === 0) {
    const lastId = contacts[contacts.length - 1].id;
    return { processed: contacts.length, lastId, done: false };
  }

  // 5. INSERT EN MASSE dans messages (1 requête multi-values pour tout le lot)
  const clientTable = `messages_client_${client_id.replace(/-/g, '_')}`;
  const msgValues = [];
  const msgParams = [];
  let pIdx = 1;

  for (const row of toInsert) {
    msgValues.push(
      `($${pIdx++},$${pIdx++},$${pIdx++},'template',$${pIdx++},$${pIdx++},$${pIdx++},'queued',NOW(),'whatsapp',$${pIdx++},$${pIdx++})`
    );
    msgParams.push(
      row.messageId,
      client_id,
      row.phone,
      template_name,
      template_language || 'fr',
      JSON.stringify(row.mergedParams),
      JSON.stringify({ campaign_id: campaignId, contact_id: row.contactId }),
      campaignId
    );
  }

  await query(
    `INSERT INTO messages (id, client_id, recipient_phone, message_type, template_name,
       template_language, template_params, wa_status, queued_at, channel, metadata, campaign_id)
     VALUES ${msgValues.join(',')}`,
    msgParams
  );

  // 6. INSERT EN MASSE dans la table client dédiée
  const clientValues = [];
  const clientParams = [];
  pIdx = 1;
  for (const row of toInsert) {
    clientValues.push(`($${pIdx++},$${pIdx++},'template',$${pIdx++},$${pIdx++},$${pIdx++},'queued',NOW())`);
    clientParams.push(
      row.messageId,
      row.phone,
      template_name,
      template_language || 'fr',
      JSON.stringify(row.mergedParams)
    );
  }

  await query(
    `INSERT INTO ${clientTable} (id, recipient_phone, message_type, template_name,
       template_language, template_params, wa_status, queued_at)
     VALUES ${clientValues.join(',')}`,
    clientParams
  );

  // 7. Index rapide pour le webhook (message_id_index) — en masse aussi
  //    Table optionnelle selon votre schéma exact ; échec non bloquant.
/**  const idxValues = [];
  const idxParams = [];
  pIdx = 1;
  for (const row of toInsert) {
    idxValues.push(`($${pIdx++},$${pIdx++},$${pIdx++})`);
    idxParams.push(row.messageId, campaignId, row.contactId);
  }
  try {
    await query(
      `INSERT INTO message_id_index (message_id, campaign_id, contact_id)
       VALUES ${idxValues.join(',')}
       ON CONFLICT (message_id) DO NOTHING`,
      idxParams
    );
  } catch (e) {
    logger.warn(`[DISPATCH] message_id_index insert ignoré: ${e.message}`);
  }*/

  // 8. Décrémenter le quota client en une seule requête
  await query(`UPDATE clients SET quota_remaining = quota_remaining - $1 WHERE id = $2`, [
    toInsert.length,
    client_id,
  ]);

  // 9. Pousser vers BullMQ (queue WATI) en parallèle contrôlé
  await mapWithConcurrency(toInsert, PARALLEL_ENQUEUE, async (row) => {
    const queueData = {
      phoneNumber: phone_number,
      messageId: row.messageId,
      client_id,
      recipient_phone: row.phone,
      message_type: 'template',
      template_name,
      template_language: template_language || 'fr',
      template_params: row.mergedParams,
      campaign_id: campaignId,
      campaign_contact_id: row.contactId,
      is_campaign: true,
      ordered_values: row.finalOrderedValues,
    };

    if (row.mediaUrl) {
      queueData.media_url = row.mediaUrl;
      queueData.invoice_data = {
        pdfUrl: row.mediaUrl,
        number: row.mergedParams.numero_facture || '001',
      };
    }

    try {
      await addMessageToQueue(queueData);
      await query(
        `UPDATE campaign_contacts SET status = 'queued', message_id = $1, wa_message_id = $1,
           queued_at = NOW(), updated_at = NOW() WHERE id = $2`,
        [row.messageId, row.contactId]
      );
    } catch (err) {
      logger.error(`[DISPATCH] Échec enqueue contact ${row.contactId}: ${err.message}`);
      await query(
        `UPDATE campaign_contacts SET status = 'failed', error_message = $1, failed_at = NOW(),
           updated_at = NOW() WHERE id = $2`,
        [err.message, row.contactId]
      );
    }
  });

  const lastId = contacts[contacts.length - 1].id;
  return { processed: contacts.length, lastId, done: false };
}

/**
 * Exécute une fonction async sur une liste, avec N exécutions en parallèle max.
 * Évite de saturer la DB/Redis avec des centaines de requêtes simultanées d'un coup.
 */
async function mapWithConcurrency(items, concurrency, fn) {
  const results = new Array(items.length);
  let index = 0;

  async function worker() {
    while (index < items.length) {
      const current = index++;
      results[current] = await fn(items[current]);
    }
  }

  await Promise.all(Array.from({ length: Math.min(concurrency, items.length) }, worker));
  return results;
}

// ============================================================
// PROCESSEUR DU JOB BULLMQ
// ============================================================
async function processCampaignDispatch(job) {
  const { campaignId } = job.data;
  const startTime = Date.now();

  logger.info(`[DISPATCH-WORKER] ▶ Démarrage dispatch campagne ${campaignId} (job ${job.id}, attempt ${job.attemptsMade + 1})`);

  let totalProcessed = 0;

  while (true) {
    // Checkpoint : relire le statut à chaque itération pour réagir à pause/cancel
    const { rows } = await query(
      `SELECT id, client_id, phone_number, template_name, template_language, template_params,
              status, dispatch_cursor, batch_interval_seconds, total_contacts
       FROM campaigns WHERE id = $1`,
      [campaignId]
    );

    if (rows.length === 0) {
      logger.warn(`[DISPATCH-WORKER] Campagne ${campaignId} introuvable, abandon`);
      return { success: false, reason: 'NOT_FOUND' };
    }

    const campaign = rows[0];

    if (campaign.status !== 'running') {
      logger.info(`[DISPATCH-WORKER] Campagne ${campaignId} non 'running' (${campaign.status}), arrêt du dispatch`);
      await query(`UPDATE campaigns SET dispatch_status = 'idle', dispatch_updated_at = NOW() WHERE id = $1`, [campaignId]);
      return { success: true, stopped: true, status: campaign.status, totalProcessed };
    }

    // Limite de durée par exécution de job : on relance un nouveau job pour
    // continuer, plutôt que de risquer un lock BullMQ expiré sur une très
    // longue campagne (100k+ contacts). Le curseur garantit la continuité.
    if (Date.now() - startTime > MAX_RUNTIME_MS) {
      logger.info(`[DISPATCH-WORKER] Limite de temps atteinte pour ${campaignId}, ré-enfilage pour continuer`);
      await job.queue.add('dispatch-campaign', { campaignId }, { jobId: `dispatch-${campaignId}-${Date.now()}` });
      return { success: true, continued: true, totalProcessed };
    }

    const { processed, lastId, done } = await dispatchBatch(campaign);

    if (processed === 0 && done) {
  const { rows: remaining } = await query(
    `SELECT COUNT(*) AS count FROM campaign_contacts WHERE campaign_id = $1 AND status = 'pending'`,
    [campaignId]
  );

  if (parseInt(remaining[0].count, 10) === 0) {
    await query(
      `UPDATE campaigns
       SET status = 'completed', completed_at = NOW(), dispatch_status = 'done',
           dispatch_updated_at = NOW(), updated_at = NOW()
       WHERE id = $1`,
      [campaignId]
    );

    try {
      await audienceService.syncCampaignContactsToAudience(campaignId);
      logger.info(`[DISPATCH-WORKER] Audience synchronisée pour campagne ${campaignId}`);
    } catch (syncErr) {
      logger.error(`[DISPATCH-WORKER] Erreur sync audience ${campaignId}: ${syncErr.message}`);
    }

    logger.info(`[DISPATCH-WORKER] ✅ Campagne ${campaignId} terminée — ${totalProcessed} contacts dispatchés au total`);
    return { success: true, completed: true, totalProcessed };
  }

  logger.warn(`[DISPATCH-WORKER] ${campaignId}: 0 traité mais ${remaining[0].count} pending restants — vérifier le curseur`);
  return { success: true, totalProcessed, warning: 'CURSOR_MISMATCH' };
}
 
    totalProcessed += processed;

    // Checkpoint persistant : on sait exactement reprendre ici si interruption
    await query(
      `UPDATE campaigns
       SET dispatch_cursor = $1, dispatch_status = 'dispatching', dispatch_updated_at = NOW()
       WHERE id = $2`,
      [lastId, campaignId]
    );

    await job.updateProgress({ processed: totalProcessed, lastId });
    logger.info(`[DISPATCH-WORKER] Campagne ${campaignId}: lot traité (${processed}), total=${totalProcessed}, curseur=${lastId}`);

    // Respecter batch_interval_seconds si défini par l'utilisateur (throttling volontaire),
    // plafonné à 5s pour ne jamais bloquer le worker trop longtemps sur un seul job.
    if (campaign.batch_interval_seconds > 0) {
      await sleep(Math.min(campaign.batch_interval_seconds * 1000, 5000));
    }
  }
}

// ============================================================
// DÉMARRAGE DU WORKER
// ============================================================
const worker = new Worker(QUEUE_NAME, processCampaignDispatch, WORKER_CONFIG);

worker.on('completed', (job, result) => {
  logger.info(`[DISPATCH-WORKER] ✅ Job ${job.id} terminé: ${JSON.stringify(result)}`);
});

worker.on('failed', (job, err) => {
  logger.error(`[DISPATCH-WORKER] ❌ Job ${job?.id} échoué (attempt ${job?.attemptsMade}): ${err.message}`);
});

worker.on('error', (err) => {
  logger.error(`[DISPATCH-WORKER] 🔥 Erreur worker: ${err.message}`);
});

logger.info('[DISPATCH-WORKER] Worker de dispatch de campagne démarré');

async function shutdown(signal) {
  logger.info(`[DISPATCH-WORKER] 🛑 [${signal}] Arrêt gracieux...`);
  await worker.close();
  process.exit(0);
}

process.on('SIGTERM', () => shutdown('SIGTERM'));
process.on('SIGINT', () => shutdown('SIGINT'));

module.exports = { processCampaignDispatch, worker };
