// src/services/automation.service.js
// Moteur d'automatisation et Drip Campaigns
const { query, getClient } = require('../config/database');
const { v4: uuidv4 } = require('uuid');
const { addMessageToQueue } = require('./queue.service');
const { canSendToRecipient } = require('./message.service');
const logger = require('../utils/logger');

// ============================================================
// CRUD WORKFLOWS
// ============================================================

async function createWorkflow(clientId, userId, data) {
  const {
    name, description, trigger_type, trigger_config = {},
    steps = []
  } = data;

  if (!name?.trim()) throw { statusCode: 400, code: 'NAME_REQUIRED', message: 'Nom du workflow requis' };
  if (!trigger_type) throw { statusCode: 400, code: 'TRIGGER_REQUIRED', message: 'Type de déclencheur requis' };

  const db = await getClient();
  try {
    await db.query('BEGIN');

    const workflowId = uuidv4();

    const wfRes = await db.query(
      `INSERT INTO automation_workflows
         (id, client_id, name, description, trigger_type, trigger_config, status, created_by)
       VALUES ($1,$2,$3,$4,$5,$6,'draft',$7) RETURNING *`,
      [workflowId, clientId, name.trim(), description || null, trigger_type,
       JSON.stringify(trigger_config), userId]
    );

    // Créer les étapes si fournies
    const createdSteps = [];
    for (let i = 0; i < steps.length; i++) {
      const step = steps[i];
      const stepId = uuidv4();
      const stepRes = await db.query(
        `INSERT INTO automation_steps
           (id, workflow_id, step_order, step_type, name, config)
         VALUES ($1,$2,$3,$4,$5,$6) RETURNING *`,
        [stepId, workflowId, i + 1, step.step_type, step.name || `Étape ${i+1}`,
         JSON.stringify(step.config || {})]
      );
      createdSteps.push(stepRes.rows[0]);
    }

    // Lier les étapes (chaîne séquentielle par défaut)
    for (let i = 0; i < createdSteps.length - 1; i++) {
      await db.query(
        `UPDATE automation_steps SET next_step_default = $1 WHERE id = $2`,
        [createdSteps[i+1].id, createdSteps[i].id]
      );
    }

    await db.query('COMMIT');
    return { success: true, workflow: { ...wfRes.rows[0], steps: createdSteps } };
  } catch (err) {
    await db.query('ROLLBACK');
    throw err;
  } finally {
    db.release();
  }
}

async function getWorkflows(clientId, filters = {}) {
  const { page = 1, limit = 20, status, search } = filters;
  const offset = (page - 1) * limit;

  let where = 'WHERE w.client_id = $1';
  const params = [clientId];
  let idx = 2;

  if (status) { where += ` AND w.status = $${idx++}`; params.push(status); }
  if (search) { where += ` AND w.name ILIKE $${idx++}`; params.push(`%${search}%`); }

  const countRes = await query(`SELECT COUNT(*) FROM automation_workflows w ${where}`, params);
  const total = parseInt(countRes.rows[0].count);

  const res = await query(
    `SELECT w.*,
       (SELECT COUNT(*) FROM automation_steps WHERE workflow_id = w.id) as step_count,
       (SELECT COUNT(*) FROM automation_enrollments WHERE workflow_id = w.id AND status = 'active') as active_enrollments
     FROM automation_workflows w
     ${where}
     ORDER BY w.created_at DESC
     LIMIT $${idx} OFFSET $${idx+1}`,
    [...params, limit, offset]
  );

  return { success: true, workflows: res.rows, pagination: { total, page: parseInt(page), limit: parseInt(limit), totalPages: Math.ceil(total / limit) } };
}

async function getWorkflowById(workflowId, clientId) {
  const wf = await query(
    `SELECT * FROM automation_workflows WHERE id = $1 AND client_id = $2`,
    [workflowId, clientId]
  );
  if (!wf.rows[0]) throw { statusCode: 404, code: 'NOT_FOUND', message: 'Workflow non trouvé' };

  const steps = await query(
    `SELECT * FROM automation_steps WHERE workflow_id = $1 ORDER BY step_order`,
    [workflowId]
  );

  return { ...wf.rows[0], steps: steps.rows };
}

async function updateWorkflow(workflowId, clientId, userId, updates) {
  const allowed = ['name', 'description', 'trigger_type', 'trigger_config', 'status'];
  const sets = [];
  const vals = [workflowId, clientId];
  let idx = 3;

  for (const key of allowed) {
    if (updates[key] !== undefined) {
      sets.push(`${key} = $${idx++}`);
      vals.push(typeof updates[key] === 'object' ? JSON.stringify(updates[key]) : updates[key]);
    }
  }
  if (sets.length === 0) throw { statusCode: 400, message: 'Rien à mettre à jour' };
  sets.push('updated_at = NOW()');

  await query(
    `UPDATE automation_workflows SET ${sets.join(', ')} WHERE id = $1 AND client_id = $2`,
    vals
  );
  return { success: true, workflow: await getWorkflowById(workflowId, clientId) };
}

/**
 * Activer/désactiver un workflow
 */
async function toggleWorkflow(workflowId, clientId, activate) {
  const wf = await getWorkflowById(workflowId, clientId);
  if (activate && wf.steps.length === 0) {
    throw { statusCode: 400, code: 'NO_STEPS', message: 'Ajoutez au moins une étape avant d\'activer' };
  }

  const newStatus = activate ? 'active' : 'paused';
  await query(
    `UPDATE automation_workflows SET status = $1, is_active = $2, updated_at = NOW()
     WHERE id = $3`,
    [newStatus, activate, workflowId]
  );

  return { success: true, status: newStatus };
}

// ============================================================
// GESTION DES ÉTAPES
// ============================================================

async function addStep(workflowId, clientId, stepData) {
  await getWorkflowById(workflowId, clientId); // vérifie l'accès

  const { step_type, name, config = {}, position } = stepData;
  if (!step_type) throw { statusCode: 400, message: 'Type d\'étape requis' };

  // Déterminer l'ordre
  const maxRes = await query(
    `SELECT COALESCE(MAX(step_order), 0) as max_order FROM automation_steps WHERE workflow_id = $1`,
    [workflowId]
  );
  const stepOrder = position || (parseInt(maxRes.rows[0].max_order) + 1);

  const stepId = uuidv4();
  const res = await query(
    `INSERT INTO automation_steps (id, workflow_id, step_order, step_type, name, config)
     VALUES ($1,$2,$3,$4,$5,$6) RETURNING *`,
    [stepId, workflowId, stepOrder, step_type, name || `Étape ${stepOrder}`, JSON.stringify(config)]
  );

  return { success: true, step: res.rows[0] };
}

async function updateStep(stepId, workflowId, clientId, updates) {
  await getWorkflowById(workflowId, clientId);

  const allowed = ['name', 'config', 'step_order', 'next_step_yes', 'next_step_no', 'next_step_default'];
  const sets = [];
  const params = [stepId, workflowId]; // $1, $2 sont réservés
  let idx = 3; // les SETS commenceront à $3

  for (const key of allowed) {
    if (updates[key] !== undefined) {
      sets.push(`${key} = $${idx++}`);
      params.push(key === 'config' ? JSON.stringify(updates[key]) : updates[key]);
    }
  }
  if (!sets.length) throw { statusCode: 400, message: 'Rien à mettre à jour' };

  const res = await query(
    `UPDATE automation_steps SET ${sets.join(', ')} WHERE id = $1 AND workflow_id = $2 RETURNING *`,
    params
  );
  return { success: true, step: res.rows[0] };
}

async function deleteStep(stepId, workflowId, clientId) {
  await getWorkflowById(workflowId, clientId);
  await query(`DELETE FROM automation_steps WHERE id = $1 AND workflow_id = $2`, [stepId, workflowId]);
  return { success: true };
}

// ============================================================
// INSCRIPTIONS (ENROLLMENTS)
// ============================================================

/**
 * Inscrire un contact dans un workflow
 */
async function enrollContact(workflowId, clientId, phone, name, variables = {}) {
  const wf = await getWorkflowById(workflowId, clientId);

  if (wf.status !== 'active') {
    throw { statusCode: 400, code: 'WORKFLOW_INACTIVE', message: 'Le workflow doit être actif' };
  }

  // Récupérer la première étape
  const firstStep = wf.steps.sort((a, b) => a.step_order - b.step_order)[0];
  if (!firstStep) throw { statusCode: 400, code: 'NO_STEPS', message: 'Aucune étape configurée' };

  const enrollmentId = uuidv4();
  try {
    await query(
      `INSERT INTO automation_enrollments
         (id, workflow_id, phone_number, contact_name, variables, current_step_id, status, next_action_at)
       VALUES ($1,$2,$3,$4,$5,$6,'active',NOW())
       ON CONFLICT (workflow_id, phone_number) DO UPDATE SET
         status = 'active', current_step_id = $6, next_action_at = NOW(), updated_at = NOW()
       RETURNING *`,
      [enrollmentId, workflowId, phone, name || null, JSON.stringify(variables), firstStep.id]
    );

    // Mettre à jour le compteur
    await query(
      `UPDATE automation_workflows SET total_enrolled = total_enrolled + 1 WHERE id = $1`,
      [workflowId]
    );

    logger.info(`[AUTOMATION] Contact ${phone} inscrit dans workflow ${workflowId}`);
    return { success: true, enrollmentId };
  } catch (err) {
    logger.error('Erreur inscription:', err);
    throw err;
  }
}

/**
 * Inscrire plusieurs contacts depuis un segment
 */
async function enrollSegment(workflowId, clientId, segmentId) {
  const { getSegmentContacts } = require('./segment.service');
  const contacts = await getSegmentContacts(segmentId, clientId);

  let enrolled = 0, failed = 0;
  for (const contact of contacts) {
    try {
      await enrollContact(workflowId, clientId, contact.phone_number, contact.name, contact.variables || {});
      enrolled++;
    } catch { failed++; }
  }

  return { success: true, enrolled, failed, total: contacts.length };
}

// ============================================================
// MOTEUR D'EXÉCUTION DES ÉTAPES
// ============================================================

/**
 * Traiter les enrollments en attente d'exécution
 * Appelé par un cron job toutes les minutes
 */
async function processScheduledSteps() {
  const pending = await query(
    `SELECT e.*, w.client_id, w.name as workflow_name
     FROM automation_enrollments e
     JOIN automation_workflows w ON w.id = e.workflow_id
     WHERE e.status IN ('active', 'waiting')
       AND e.next_action_at <= NOW()
       AND w.status = 'active'
     ORDER BY e.next_action_at ASC
     LIMIT 50
     FOR UPDATE SKIP LOCKED`
  );

  if (pending.rows.length === 0) return { processed: 0 };

  logger.info(`[AUTOMATION] Traitement de ${pending.rows.length} enrollments`);
  let processed = 0;

  for (const enrollment of pending.rows) {
    try {
      await executeStep(enrollment);
      processed++;
    } catch (err) {
      logger.error(`[AUTOMATION] Erreur enrollment ${enrollment.id}:`, err);
      await query(
        `UPDATE automation_enrollments SET status = 'failed', error_message = $1 WHERE id = $2`,
        [err.message, enrollment.id]
      );
    }
  }

  return { processed };
}

/**
 * Exécuter une étape pour un contact
 */
async function executeStep(enrollment) {
  if (!enrollment.current_step_id) {
    await completeEnrollment(enrollment.id, enrollment.workflow_id);
    return;
  }

  const stepRes = await query(
    `SELECT * FROM automation_steps WHERE id = $1`,
    [enrollment.current_step_id]
  );
  if (!stepRes.rows[0]) {
    await completeEnrollment(enrollment.id, enrollment.workflow_id);
    return;
  }

  const step = stepRes.rows[0];
  const config = step.config || {};

  logger.info(`[AUTOMATION] Exec step "${step.step_type}" pour ${enrollment.phone_number}`);

  let nextStepId = step.next_step_default;
  let nextActionAt = new Date();

  switch (step.step_type) {

    case 'send_message': {
      // Vérifier opt-out/cooldown
      const canSend = await canSendToRecipient(enrollment.phone_number, enrollment.client_id);
      if (!canSend.canSend) {
        await logStep(enrollment.id, enrollment.workflow_id, step.id, 'skipped',
          `Bloqué: ${canSend.reason}`, enrollment.phone_number);
        nextStepId = step.next_step_default;
        break;
      }

      // Fusionner les variables
      const vars = { ...enrollment.variables, name: enrollment.contact_name };
      const templateParams = { ...(config.template_params || {}), ...vars };

      // Créer et envoyer le message
      const messageId = uuidv4();
      await query(
        `INSERT INTO messages
           (id, client_id, recipient_phone, message_type, template_name, template_language,
            template_params, wa_status, queued_at, channel, metadata)
         VALUES ($1,$2,$3,'template',$4,$5,$6,'queued',NOW(),'whatsapp',$7)`,
        [
          messageId, enrollment.client_id, enrollment.phone_number,
          config.template_name, config.template_language || 'fr',
          JSON.stringify(templateParams),
          JSON.stringify({ workflow_id: enrollment.workflow_id, enrollment_id: enrollment.id, step_id: step.id })
        ]
      );

      const clientTable = `messages_client_${enrollment.client_id.replace(/-/g, '_')}`;
      await query(
        `INSERT INTO ${clientTable}
           (id, recipient_phone, message_type, template_name, template_language, template_params, wa_status, queued_at)
         VALUES ($1,$2,'template',$3,$4,$5,'queued',NOW())`,
        [messageId, enrollment.phone_number, config.template_name, config.template_language || 'fr', JSON.stringify(templateParams)]
      );

      await query(`UPDATE clients SET quota_remaining = quota_remaining - 1 WHERE id = $1`, [enrollment.client_id]);

      await addMessageToQueue({
        phoneNumber: config.phone_number,
        messageId,
        client_id: enrollment.client_id,
        recipient_phone: enrollment.phone_number,
        message_type: 'template',
        template_name: config.template_name,
        template_language: config.template_language || 'fr',
        template_params: templateParams
      });

      await logStep(enrollment.id, enrollment.workflow_id, step.id, 'success',
        `Message envoyé: ${config.template_name}`, enrollment.phone_number, messageId);

      nextStepId = step.next_step_default;
      break;
    }

    case 'wait_delay': {
      const delay = config.delay_value || 1;
      const unit = config.delay_unit || 'days';
      const delayMs = {
        minutes: delay * 60 * 1000,
        hours: delay * 3600 * 1000,
        days: delay * 86400 * 1000,
        weeks: delay * 7 * 86400 * 1000
      }[unit] || delay * 86400 * 1000;

      nextActionAt = new Date(Date.now() + delayMs);
      await logStep(enrollment.id, enrollment.workflow_id, step.id, 'waiting',
        `Attente de ${delay} ${unit}`, enrollment.phone_number);

      await query(
        `UPDATE automation_enrollments
         SET status = 'waiting', next_action_at = $1, current_step_id = $2,
             steps_completed = steps_completed + 1
         WHERE id = $3`,
        [nextActionAt, step.next_step_default, enrollment.id]
      );
      return; // On arrête ici, le cron reprendra plus tard
    }

    case 'condition': {
      const conditionMet = await evaluateCondition(config, enrollment);
      nextStepId = conditionMet ? step.next_step_yes : step.next_step_no;

      await logStep(enrollment.id, enrollment.workflow_id, step.id, 'success',
        `Condition: ${conditionMet ? 'OUI' : 'NON'}`, enrollment.phone_number);
      break;
    }

    case 'add_tag': {
      // Stocker dans metadata du contact
      logger.info(`[AUTOMATION] Tag ajouté: ${config.tag} pour ${enrollment.phone_number}`);
      await logStep(enrollment.id, enrollment.workflow_id, step.id, 'success',
        `Tag ajouté: ${config.tag}`, enrollment.phone_number);
      nextStepId = step.next_step_default;
      break;
    }

    case 'webhook': {
      try {
        const axios = require('axios');
        await axios.post(config.url, {
          event: 'automation.step',
          workflow_id: enrollment.workflow_id,
          phone: enrollment.phone_number,
          variables: enrollment.variables,
          step: step.name
        }, { timeout: 10000 });
        await logStep(enrollment.id, enrollment.workflow_id, step.id, 'success', `Webhook: ${config.url}`, enrollment.phone_number);
      } catch (err) {
        await logStep(enrollment.id, enrollment.workflow_id, step.id, 'failed', `Webhook échoué: ${err.message}`, enrollment.phone_number);
      }
      nextStepId = step.next_step_default;
      break;
    }

    case 'stop': {
      await completeEnrollment(enrollment.id, enrollment.workflow_id);
      await logStep(enrollment.id, enrollment.workflow_id, step.id, 'success', 'Workflow terminé', enrollment.phone_number);
      return;
    }

    default:
      nextStepId = step.next_step_default;
  }

  // Passer à l'étape suivante
  if (nextStepId) {
    await query(
      `UPDATE automation_enrollments
       SET current_step_id = $1, status = 'active', next_action_at = NOW(),
           steps_completed = steps_completed + 1
       WHERE id = $2`,
      [nextStepId, enrollment.id]
    );
    // Exécuter immédiatement l'étape suivante si ce n'est pas une attente
    const nextEnrollment = { ...enrollment, current_step_id: nextStepId };
    await executeStep(nextEnrollment);
  } else {
    await completeEnrollment(enrollment.id, enrollment.workflow_id);
  }
}

async function evaluateCondition(config, enrollment) {
  const { field, operator, value } = config;

  if (field === 'last_message_status') {
    const res = await query(
      `SELECT wa_status FROM messages
       WHERE client_id = $1 AND recipient_phone = $2
       ORDER BY created_at DESC LIMIT 1`,
      [enrollment.client_id, enrollment.phone_number]
    );
    if (!res.rows[0]) return false;
    const status = res.rows[0].wa_status;
    if (operator === 'eq') return status === value;
    if (operator === 'in') return Array.isArray(value) && value.includes(status);
  }

  if (field === 'replied') {
    const res = await query(
      `SELECT 1 FROM incoming_messages WHERE phone_number = $1 LIMIT 1`,
      [enrollment.phone_number]
    );
    return res.rows.length > 0;
  }

  return false;
}

async function completeEnrollment(enrollmentId, workflowId) {
  await query(
    `UPDATE automation_enrollments
     SET status = 'completed', completed_at = NOW(), next_action_at = NULL
     WHERE id = $1`,
    [enrollmentId]
  );
  await query(
    `UPDATE automation_workflows SET total_completed = total_completed + 1 WHERE id = $1`,
    [workflowId]
  );
}

async function logStep(enrollmentId, workflowId, stepId, result, message, phone, messageId = null) {
  await query(
    `INSERT INTO automation_execution_logs
       (id, enrollment_id, workflow_id, step_id, phone_number, result, message_id, metadata)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8)`,
    [uuidv4(), enrollmentId, workflowId, stepId, phone, result, messageId,
     JSON.stringify({ message })]
  );
}

async function getWorkflowStats(workflowId, clientId) {
  await getWorkflowById(workflowId, clientId);

  const enrollStats = await query(
    `SELECT status, COUNT(*) as count
     FROM automation_enrollments WHERE workflow_id = $1
     GROUP BY status`,
    [workflowId]
  );

  const stepStats = await query(
    `SELECT s.name, s.step_type, el.result, COUNT(*) as count
     FROM automation_execution_logs el
     JOIN automation_steps s ON s.id = el.step_id
     WHERE el.workflow_id = $1
     GROUP BY s.name, s.step_type, el.result
     ORDER BY s.step_order`,
    [workflowId]
  );

  const recent = await query(
    `SELECT el.*, e.phone_number, e.contact_name, s.name as step_name
     FROM automation_execution_logs el
     JOIN automation_enrollments e ON e.id = el.enrollment_id
     LEFT JOIN automation_steps s ON s.id = el.step_id
     WHERE el.workflow_id = $1
     ORDER BY el.executed_at DESC LIMIT 20`,
    [workflowId]
  );

  const statusMap = {};
  for (const r of enrollStats.rows) statusMap[r.status] = parseInt(r.count);

  return { success: true, enrollment_stats: statusMap, step_stats: stepStats.rows, recent_executions: recent.rows };
}

/**
 * Déclencher automatiquement les workflows liés à une campagne
 * Appelé depuis le webhook WATI lors d'une mise à jour de statut
 
async function triggerWorkflowFromCampaign(campaignId, phone, status) {
  try {
    const triggers = await query(
      `SELECT cwt.*, aw.client_id
       FROM campaign_workflow_triggers cwt
       JOIN automation_workflows aw ON aw.id = cwt.workflow_id
       WHERE cwt.campaign_id = $1
         AND cwt.trigger_on = $2
         AND aw.status = 'active'`,
      [campaignId, status]
    );

    for (const trigger of triggers.rows) {
      try {
        await enrollContact(trigger.workflow_id, trigger.client_id, phone, null, {});
      } catch (err) {
        logger.warn(`[AUTOMATION] Impossible d'inscrire ${phone} dans workflow ${trigger.workflow_id}:`, err.message);
      }
    }
  } catch (err) {
    logger.error('[AUTOMATION] triggerWorkflowFromCampaign:', err);
  }
}
*/

/**
 * Récupérer les logs d’un workflow avec pagination
 */
async function getWorkflowLogs(workflowId, { page = 1, limit = 50, result = null, phone = null }) {
  const offset = (page - 1) * limit;
  let where = 'WHERE l.workflow_id = $1';
  const params = [workflowId];
  let idx = 2;

  if (result) {
    where += ` AND l.result = $${idx++}`;
    params.push(result);
  }
  if (phone) {
    where += ` AND l.phone_number ILIKE $${idx++}`;
    params.push(`%${phone}%`);
  }

  const countRes = await query(
    `SELECT COUNT(*) FROM automation_execution_logs l ${where}`,
    params
  );
  const total = parseInt(countRes.rows[0].count);

  const logsRes = await query(
    `SELECT l.id, l.enrollment_id, l.workflow_id, l.step_id, l.step_type,
            l.phone_number, l.result, l.message_id, l.metadata, l.executed_at,
            e.contact_name
     FROM automation_execution_logs l
     LEFT JOIN automation_enrollments e ON l.enrollment_id = e.id
     ${where}
     ORDER BY l.executed_at DESC
     LIMIT $${idx} OFFSET $${idx+1}`,
    [...params, limit, offset]
  );

  return { success: true, logs: logsRes.rows, pagination: { total, page, limit, totalPages: Math.ceil(total / limit) } };
}

/**
 * Exporter les logs au format CSV
 */
async function exportWorkflowLogsCSV(workflowId, clientId, filters = {}) {
  await getWorkflowById(workflowId, clientId);
  const { result, phone } = filters;
  let where = 'WHERE l.workflow_id = $1';
  const params = [workflowId];
  if (result) {
    where += ` AND l.result = $2`;
    params.push(result);
  }
  if (phone) {
    where += ` AND l.phone_number ILIKE $${params.length+1}`;
    params.push(`%${phone}%`);
  }

  const rows = await query(
    `SELECT l.executed_at, l.phone_number, l.step_id, l.result,
            l.metadata->>'message' as message,
            l.message_id, e.contact_name
     FROM automation_execution_logs l
     LEFT JOIN automation_enrollments e ON l.enrollment_id = e.id
     ${where}
     ORDER BY l.executed_at ASC`,
    params
  );

  const csvRows = [
    ['Date', 'Téléphone', 'Contact', 'Étape ID', 'Résultat', 'Message', 'Message ID']
  ];
  for (const r of rows.rows) {
    csvRows.push([
      r.executed_at.toISOString(),
      r.phone_number,
      r.contact_name || '',
      r.step_id,
      r.result,
      (r.message || '').replace(/,/g, ';'),
      r.message_id || ''
    ]);
  }
  return csvRows.map(row => row.join(',')).join('\n');
}

async function triggerWorkflowFromCampaign(campaignId, phone, status) {
  logger.info(`🔔 [TRIGGER] status=${status}, phone=${phone}`);
  const workflows = await query(
    `SELECT id, client_id FROM automation_workflows
     WHERE trigger_type = $1 AND status = 'active'`,
    [`campaign_${status}`]
  );
  logger.info(`🔔 [TRIGGER] ${workflows.rows.length} workflow(s) trouvé(s)`);
  for (const wf of workflows.rows) {
    try {
      await enrollContact(wf.id, wf.client_id, phone, null, {});
      logger.info(`✅ Inscrit ${phone} dans workflow ${wf.id}`);
    } catch (err) {
      logger.warn(`❌ Échec inscription ${phone} dans workflow ${wf.id}:`, err.message);
    }
  }
}

module.exports = {
  createWorkflow, getWorkflows, getWorkflowById, updateWorkflow,
  toggleWorkflow, addStep, updateStep, deleteStep,
  enrollContact, enrollSegment,
  processScheduledSteps, getWorkflowStats,
  triggerWorkflowFromCampaign, getWorkflowLogs,
  exportWorkflowLogsCSV
};
