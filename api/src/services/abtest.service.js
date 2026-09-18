// src/services/abtest.service.js
// A/B Testing automatique avec sélection du gagnant par significance statistique
const { query, getClient } = require('../config/database');
const { v4: uuidv4 } = require('uuid');
const { addMessageToQueue } = require('./queue.service');
const { canSendToRecipient } = require('./message.service');
const logger = require('../utils/logger');

// ============================================================
// STATISTIQUES — TEST Z POUR DEUX PROPORTIONS
// ============================================================

/**
 * Test Z bilatéral pour comparer deux proportions
 * H0: p1 = p2  (pas de différence)
 * H1: p1 ≠ p2
 * Retourne le niveau de confiance en %
 */
function calculateStatisticalSignificance(successA, totalA, successB, totalB) {
  if (totalA < 10 || totalB < 10) return { significant: false, confidence: 0, pValue: 1 };

  const pA = successA / totalA;
  const pB = successB / totalB;
  const pPool = (successA + successB) / (totalA + totalB);

  if (pPool === 0 || pPool === 1) return { significant: false, confidence: 0, pValue: 1 };

  const se = Math.sqrt(pPool * (1 - pPool) * (1 / totalA + 1 / totalB));
  if (se === 0) return { significant: false, confidence: 0, pValue: 1 };

  const z = Math.abs((pA - pB) / se);

  // Approximation de la fonction de distribution normale cumulative
  const phi = (x) => {
    const t = 1 / (1 + 0.2316419 * Math.abs(x));
    const d = 0.3989423 * Math.exp(-x * x / 2);
    const p = d * t * (0.3193815 + t * (-0.3565638 + t * (1.7814779 + t * (-1.8212560 + t * 1.3302744))));
    return x > 0 ? 1 - p : p;
  };

  const pValue = 2 * (1 - phi(z));
  const confidence = (1 - pValue) * 100;

  return {
    significant: confidence >= 95,
    confidence: Math.min(confidence, 99.99),
    pValue,
    zScore: z,
    rateA: (pA * 100).toFixed(2),
    rateB: (pB * 100).toFixed(2),
    lift: pA > 0 ? (((pB - pA) / pA) * 100).toFixed(1) : 0,
  };
}

/**
 * Calcule le score composite d'une variante selon le critère
 */
function calculateVariantScore(variant, criteria) {
  const weights = { delivery_rate: 0.4, read_rate: 0.4, reply_rate: 0.2 };
  switch (criteria) {
    case 'read_rate':
      return variant.read_rate * weights.read_rate +
             variant.delivery_rate * weights.delivery_rate +
             variant.reply_rate * weights.reply_rate;
    case 'reply_rate':
      return variant.reply_rate * 0.6 + variant.read_rate * 0.3 + variant.delivery_rate * 0.1;
    case 'delivery_rate':
    default:
      return variant.delivery_rate * 0.6 + variant.read_rate * 0.3 + variant.reply_rate * 0.1;
  }
}

// ============================================================
// CRUD A/B TESTS
// ============================================================

async function createABTest(clientId, userId, data) {
  const {
    campaign_id, name, description, test_type = 'template',
    winner_criteria = 'read_rate', winner_threshold = 95,
    min_sample_size = 100, auto_select_winner = true,
    test_duration_hours = 24, traffic_split, variants = []
  } = data;

  if (!name?.trim()) throw { statusCode: 400, code: 'NAME_REQUIRED', message: 'Nom du test requis' };
  if (variants.length < 2) throw { statusCode: 400, code: 'MIN_VARIANTS', message: 'Au moins 2 variantes requises' };

  // Vérifier que le split totalise 100
  const totalSplit = Object.values(traffic_split || {}).reduce((a, b) => a + b, 0);
  if (traffic_split && Math.abs(totalSplit - 100) > 0.1) {
    throw { statusCode: 400, code: 'INVALID_SPLIT', message: 'Le trafic doit totaliser 100%' };
  }

  const db = await getClient();
  try {
    await db.query('BEGIN');

    const testId = uuidv4();
    const defaultSplit = {};
    variants.forEach((v, i) => { defaultSplit[v.variant_name || String.fromCharCode(65 + i)] = Math.floor(100 / variants.length); });

    const testRes = await db.query(
      `INSERT INTO ab_tests (
        id, client_id, campaign_id, name, description, test_type,
        winner_criteria, winner_threshold, min_sample_size,
        auto_select_winner, test_duration_hours, traffic_split, created_by
      ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13) RETURNING *`,
      [testId, clientId, campaign_id || null, name.trim(), description || null,
       test_type, winner_criteria, winner_threshold, min_sample_size,
       auto_select_winner, test_duration_hours,
       JSON.stringify(traffic_split || defaultSplit), userId]
    );

    const createdVariants = [];
    for (let i = 0; i < variants.length; i++) {
      const v = variants[i];
      const variantName = v.variant_name || String.fromCharCode(65 + i);
      const varRes = await db.query(
        `INSERT INTO ab_test_variants (
          id, test_id, variant_name, label, description,
          template_name, template_params, send_hour, phone_number, message_content
        ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10) RETURNING *`,
        [uuidv4(), testId, variantName, v.label || `Variante ${variantName}`,
         v.description || null, v.template_name || null,
         JSON.stringify(v.template_params || {}), v.send_hour || null,
         v.phone_number || null, v.message_content || null]
      );
      createdVariants.push(varRes.rows[0]);
    }

    await db.query('COMMIT');
    logger.info(`[AB TEST] Créé: ${testId} par ${userId}`);

    return { success: true, test: { ...testRes.rows[0], variants: createdVariants } };
  } catch (err) {
    await db.query('ROLLBACK');
    throw err;
  } finally {
    db.release();
  }
}

async function getABTests(clientId, filters = {}) {
  const { page = 1, limit = 20, status, campaign_id } = filters;
  const offset = (page - 1) * limit;

  let where = 'WHERE t.client_id = $1';
  const params = [clientId];
  let idx = 2;

  if (status) { where += ` AND t.status = $${idx++}`; params.push(status); }
  if (campaign_id) { where += ` AND t.campaign_id = $${idx++}`; params.push(campaign_id); }

  const countRes = await query(`SELECT COUNT(*) FROM ab_tests t ${where}`, params);
  const total = parseInt(countRes.rows[0].count);

  const res = await query(
    `SELECT t.*,
       (SELECT json_agg(v ORDER BY v.variant_name) FROM ab_test_variants v WHERE v.test_id = t.id) as variants
     FROM ab_tests t
     ${where}
     ORDER BY t.created_at DESC
     LIMIT $${idx} OFFSET $${idx+1}`,
    [...params, limit, offset]
  );

  return {
    success: true,
    tests: res.rows,
    pagination: { total, page: parseInt(page), limit: parseInt(limit), totalPages: Math.ceil(total / limit) }
  };
}

async function getABTestById(testId, clientId) {
  const res = await query(
    `SELECT t.*,
       (SELECT json_agg(v ORDER BY v.variant_name) FROM ab_test_variants v WHERE v.test_id = t.id) as variants
     FROM ab_tests t WHERE t.id = $1 AND t.client_id = $2`,
    [testId, clientId]
  );
  if (!res.rows[0]) throw { statusCode: 404, code: 'NOT_FOUND', message: 'Test A/B non trouvé' };
  return res.rows[0];
}

// ============================================================
// LANCEMENT DU TEST
// ============================================================

async function launchABTest(testId, clientId, userId, contacts) {
  const db = await getClient();
  try {
    await db.query('BEGIN');

    const test = await getABTestById(testId, clientId);
    if (test.status !== 'draft') {
      throw { statusCode: 400, code: 'INVALID_STATUS', message: 'Le test doit être en brouillon pour être lancé' };
    }
    if (!test.variants || test.variants.length < 2) {
      throw { statusCode: 400, code: 'NO_VARIANTS', message: 'Au moins 2 variantes requises' };
    }
    if (contacts.length < test.min_sample_size) {
      throw { statusCode: 400, code: 'INSUFFICIENT_CONTACTS',
        message: `Minimum ${test.min_sample_size} contacts requis (fournis: ${contacts.length})` };
    }

    // Mélanger les contacts (Fisher-Yates shuffle)
    const shuffled = [...contacts];
    for (let i = shuffled.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
    }

    // Répartir selon traffic_split
    const split = test.traffic_split || {};
    const variants = test.variants;
    const totalSplit = Object.values(split).reduce((a, b) => a + b, 0);
    let startIdx = 0;

    const assignments = [];
    for (const variant of variants) {
      const splitPct = (split[variant.variant_name] || (100 / variants.length)) / totalSplit;
      const count = Math.round(shuffled.length * splitPct);
      const variantContacts = shuffled.slice(startIdx, startIdx + count);
      startIdx += count;

      for (const contact of variantContacts) {
        assignments.push({
          testId, variantId: variant.id, variantName: variant.variant_name,
          phone: contact.phone_number || contact.phone,
          name: contact.name, variables: contact.variables || {}
        });
      }

      // Mettre à jour le count de la variante
      await db.query(
        `UPDATE ab_test_variants SET contacts_assigned = $1 WHERE id = $2`,
        [variantContacts.length, variant.id]
      );
    }

    // Insérer les affectations
    for (const asgn of assignments) {
      await db.query(
        `INSERT INTO ab_test_assignments (id, test_id, variant_id, phone_number, assigned_at)
         VALUES ($1,$2,$3,$4,NOW()) ON CONFLICT (test_id, phone_number) DO NOTHING`,
        [uuidv4(), asgn.testId, asgn.variantId, asgn.phone]
      );
    }

    // Passer en running
    await db.query(
      `UPDATE ab_tests SET status = 'running', started_at = NOW() WHERE id = $1`,
      [testId]
    );

    await db.query('COMMIT');
    logger.info(`[AB TEST] Lancé: ${testId} — ${assignments.length} contacts assignés`);

    // Envoyer les messages en arrière-plan
    sendABTestMessages(test, assignments, clientId).catch(err =>
      logger.error(`[AB TEST] Erreur envoi ${testId}:`, err)
    );

    // Programmer l'évaluation du gagnant
    if (test.auto_select_winner) {
      setTimeout(() => evaluateWinner(testId, clientId), test.test_duration_hours * 3600 * 1000);
    }

    return { success: true, assignments_count: assignments.length, status: 'running' };
  } catch (err) {
    await db.query('ROLLBACK');
    throw err;
  } finally {
    db.release();
  }
}

async function sendABTestMessages(test, assignments, clientId) {
  for (const asgn of assignments) {
    try {
      const variant = test.variants.find(v => v.id === asgn.variantId);
      if (!variant) continue;

      const canSend = await canSendToRecipient(asgn.phone, clientId);
      if (!canSend.canSend) continue;

      const messageId = uuidv4();
      const mergedParams = { ...(variant.template_params || {}), name: asgn.name, ...asgn.variables };

      await query(
        `INSERT INTO messages (id, client_id, recipient_phone, message_type, template_name,
           template_language, template_params, wa_status, queued_at, channel, metadata)
         VALUES ($1,$2,$3,'template',$4,'fr',$5,'queued',NOW(),'whatsapp',$6)`,
        [messageId, clientId, asgn.phone, variant.template_name,
         JSON.stringify(mergedParams), JSON.stringify({ ab_test_id: test.id, variant_name: asgn.variantName })]
      );

      const clientTable = `messages_client_${clientId.replace(/-/g,'_')}`;
      await query(
        `INSERT INTO ${clientTable} (id, recipient_phone, message_type, template_name,
           template_language, template_params, wa_status, queued_at)
         VALUES ($1,$2,'template',$3,'fr',$4,'queued',NOW())`,
        [messageId, asgn.phone, variant.template_name, JSON.stringify(mergedParams)]
      );

      await query(`UPDATE ab_test_assignments SET message_id = $1 WHERE test_id = $2 AND phone_number = $3`,
        [messageId, test.id, asgn.phone]);

      await addMessageToQueue({
        phoneNumber: variant.phone_number || '+237689588347',
        messageId, client_id: clientId,
        recipient_phone: asgn.phone,
        message_type: 'template',
        template_name: variant.template_name,
        template_language: 'fr',
        template_params: mergedParams,
      });

      // Délai entre envois pour respecter le rate limit
      await new Promise(r => setTimeout(r, 2000));
    } catch (err) {
      logger.error(`[AB TEST] Erreur envoi ${asgn.phone}:`, err.message);
    }
  }
}

// ============================================================
// ÉVALUATION AUTOMATIQUE DU GAGNANT
// ============================================================

async function evaluateWinner(testId, clientId) {
  try {
    const test = await getABTestById(testId, clientId);
    if (test.status !== 'running') return;

    // Récupérer les stats fraîches depuis les messages
    await refreshVariantStats(testId);
    const freshTest = await getABTestById(testId, clientId);

    if (!freshTest.variants || freshTest.variants.length < 2) return;

    // Trier les variantes par score
    const sorted = [...freshTest.variants].sort((a, b) => {
      const scoreA = calculateVariantScore(a, freshTest.winner_criteria);
      const scoreB = calculateVariantScore(b, freshTest.winner_criteria);
      return scoreB - scoreA;
    });

    const best = sorted[0];
    const second = sorted[1];

    // Test de significativité statistique
    const successKey = { read_rate: 'read_count', reply_rate: 'reply_count', delivery_rate: 'delivered_count' }[freshTest.winner_criteria] || 'delivered_count';
    const totalKey = 'sent_count';

    const stats = calculateStatisticalSignificance(
      best[successKey] || 0, best[totalKey] || 1,
      second[successKey] || 0, second[totalKey] || 1
    );

    // Sauvegarder un snapshot
    for (const v of freshTest.variants) {
      await query(
        `INSERT INTO ab_test_snapshots (id, test_id, variant_id, delivery_rate, read_rate, reply_rate, confidence, sample_size)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8)`,
        [uuidv4(), testId, v.id, v.delivery_rate||0, v.read_rate||0, v.reply_rate||0, stats.confidence||0, v.sent_count||0]
      );
    }

    const hasEnoughData = best.sent_count >= freshTest.min_sample_size;

    if (hasEnoughData && stats.confidence >= freshTest.winner_threshold) {
      // Gagnant trouvé avec signifiance statistique
      await query(
        `UPDATE ab_test_variants SET is_winner = true, score = $1 WHERE id = $2`,
        [calculateVariantScore(best, freshTest.winner_criteria), best.id]
      );

      await query(
        `UPDATE ab_tests SET
           status = 'completed',
           winner_variant = $1,
           winner_selected_at = NOW(),
           winner_confidence = $2,
           statistical_significance = true,
           completed_at = NOW()
         WHERE id = $3`,
        [best.variant_name, stats.confidence, testId]
      );

      logger.info(`[AB TEST] Gagnant: Variante ${best.variant_name} (confiance: ${stats.confidence.toFixed(1)}%)`);
      return { winner: best.variant_name, confidence: stats.confidence, significant: true };
    } else {
      // Pas encore assez de données — reprogrammer dans 6h
      logger.info(`[AB TEST] Pas encore significatif (confiance: ${stats.confidence?.toFixed(1)}%) — nouveau check dans 6h`);
      setTimeout(() => evaluateWinner(testId, clientId), 6 * 3600 * 1000);
      return { winner: null, confidence: stats.confidence, significant: false };
    }
  } catch (err) {
    logger.error(`[AB TEST] Erreur évaluation ${testId}:`, err);
  }
}

/**
 * Rafraîchir les stats des variantes depuis les messages réels
 */
async function refreshVariantStats(testId) {
  const variants = await query(
    `SELECT v.*,
       COUNT(DISTINCT m.id) as sent_real,
       COUNT(DISTINCT CASE WHEN m.wa_status IN('delivered','read') THEN m.id END) as delivered_real,
       COUNT(DISTINCT CASE WHEN m.wa_status = 'read' THEN m.id END) as read_real,
       COUNT(DISTINCT CASE WHEN m.wa_status = 'failed' THEN m.id END) as failed_real
     FROM ab_test_variants v
     LEFT JOIN ab_test_assignments a ON a.variant_id = v.id
     LEFT JOIN messages m ON m.id = a.message_id
     WHERE v.test_id = $1
     GROUP BY v.id`,
    [testId]
  );

  for (const v of variants.rows) {
    const sent = parseInt(v.sent_real) || 0;
    const delivered = parseInt(v.delivered_real) || 0;
    const read = parseInt(v.read_real) || 0;
    const failed = parseInt(v.failed_real) || 0;

    const deliveryRate = sent > 0 ? (delivered / sent) * 100 : 0;
    const readRate = delivered > 0 ? (read / delivered) * 100 : 0;

    await query(
      `UPDATE ab_test_variants SET
         sent_count = $1, delivered_count = $2, read_count = $3, failed_count = $4,
         delivery_rate = $5, read_rate = $6
       WHERE id = $7`,
      [sent, delivered, read, failed, deliveryRate.toFixed(2), readRate.toFixed(2), v.id]
    );
  }
}

async function getABTestResults(testId, clientId) {
  await refreshVariantStats(testId);
  const test = await getABTestById(testId, clientId);

  if (!test.variants || test.variants.length < 2) {
    return { success: true, test, analysis: null };
  }

  const v = test.variants;
  const varA = v.find(x => x.variant_name === 'A') || v[0];
  const varB = v.find(x => x.variant_name === 'B') || v[1];

  const successKey = { read_rate: 'read_count', reply_rate: 'reply_count', delivery_rate: 'delivered_count' }[test.winner_criteria] || 'delivered_count';
  const stats = calculateStatisticalSignificance(
    varA[successKey]||0, varA.sent_count||1,
    varB[successKey]||0, varB.sent_count||1
  );

  // Snapshots historiques
  const snapshots = await query(
    `SELECT s.*, v.variant_name FROM ab_test_snapshots s
     JOIN ab_test_variants v ON v.id = s.variant_id
     WHERE s.test_id = $1 ORDER BY s.snapshot_at ASC`,
    [testId]
  );

  const variantScores = v.map(variant => ({
    ...variant,
    computed_score: calculateVariantScore(variant, test.winner_criteria)
  })).sort((a, b) => b.computed_score - a.computed_score);

  return {
    success: true,
    test,
    analysis: {
      statistical_test: stats,
      variant_ranking: variantScores,
      recommendation: stats.significant
        ? `La variante ${variantScores[0].variant_name} est statistiquement gagnante avec ${stats.confidence.toFixed(1)}% de confiance.`
        : `Pas encore significatif — ${Math.max(0, (test.min_sample_size || 100) - Math.min(...v.map(x=>x.sent_count||0)))} messages supplémentaires recommandés.`,
      can_declare_winner: stats.significant && stats.confidence >= (test.winner_threshold || 95),
    },
    snapshots: snapshots.rows
  };
}

async function forceSelectWinner(testId, clientId, variantName) {
  const test = await getABTestById(testId, clientId);
  const variant = test.variants?.find(v => v.variant_name === variantName);
  if (!variant) throw { statusCode: 400, message: `Variante ${variantName} non trouvée` };

  await query(`UPDATE ab_test_variants SET is_winner = false WHERE test_id = $1`, [testId]);
  await query(`UPDATE ab_test_variants SET is_winner = true WHERE id = $1`, [variant.id]);
  await query(
    `UPDATE ab_tests SET status='completed', winner_variant=$1, winner_selected_at=NOW(), completed_at=NOW() WHERE id=$2`,
    [variantName, testId]
  );

  return { success: true, winner: variantName };
}

module.exports = {
  createABTest, getABTests, getABTestById, launchABTest,
  evaluateWinner, refreshVariantStats, getABTestResults,
  forceSelectWinner, calculateStatisticalSignificance
};
