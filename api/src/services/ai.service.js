// src/services/ai.service.js
// Score de qualité des contacts (IA) + Optimisation horaire (IA)
// Utilise l'API Anthropic Claude pour les analyses avancées
const { query, getClient } = require('../config/database');
const { v4: uuidv4 } = require('uuid');
const logger = require('../utils/logger');

const ANTHROPIC_API = 'https://api.anthropic.com/v1/messages';
const CLAUDE_MODEL  = 'claude-sonnet-4-20250514';

// ============================================================
// CLIENT ANTHROPIC
// ============================================================
async function callClaude(systemPrompt, userMessage, maxTokens = 1000) {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) throw new Error('ANTHROPIC_API_KEY non configurée');

  const res = await fetch(ANTHROPIC_API, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': apiKey,
      'anthropic-version': '2023-06-01'
    },
    body: JSON.stringify({
      model: CLAUDE_MODEL,
      max_tokens: maxTokens,
      system: systemPrompt,
      messages: [{ role: 'user', content: userMessage }]
    })
  });

  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(`Claude API error ${res.status}: ${err.error?.message || 'Unknown'}`);
  }

  const data = await res.json();
  return data.content?.[0]?.text || '';
}

// ============================================================
// SCORING DES CONTACTS
// ============================================================

/**
 * Calculer le score d'un contact depuis ses données historiques (mode statistique)
 */
function calculateStatisticalScore(metrics) {
  const {
    total_received = 0, total_delivered = 0, total_read = 0,
    total_replied = 0, total_failed = 0,
    days_since_last_interaction = 999, campaigns_count = 0
  } = metrics;

  if (total_received === 0) return { engagement_score: 30, deliverability_score: 50, quality_score: 40, churn_risk: 70, segment_label: 'new' };

  // Taux de livraison (0-100)
  const deliveryRate = total_received > 0 ? (total_delivered / total_received) * 100 : 0;

  // Taux de lecture (0-100)
  const readRate = total_delivered > 0 ? (total_read / total_delivered) * 100 : 0;

  // Taux de réponse (0-100)
  const replyRate = total_read > 0 ? (total_replied / total_read) * 100 : 0;

  // Score d'engagement (lecture + réponse = signal fort)
  const engagementScore = Math.round(
    readRate * 0.5 + replyRate * 0.3 + Math.min(campaigns_count * 2, 20)
  );

  // Score de délivrabilité
  const deliverabilityScore = Math.round(deliveryRate * 0.8 + (total_failed === 0 ? 20 : 0));

  // Pénalité d'inactivité
  const inactivityPenalty = Math.min(days_since_last_interaction * 0.5, 40);
  const qualityScore = Math.max(0, Math.round((engagementScore * 0.6 + deliverabilityScore * 0.4) - inactivityPenalty));

  // Risque de churn (0=faible risque, 100=très haut risque)
  const churnRisk = Math.min(100, Math.max(0,
    (days_since_last_interaction > 30 ? 40 : 0) +
    (readRate < 10 ? 30 : 0) +
    (total_failed > total_delivered * 0.3 ? 20 : 0) +
    (replyRate === 0 && total_read > 5 ? 10 : 0)
  ));

  // Segment RFM simplifié
  let segment_label = 'unknown';
  if (total_received === 0) segment_label = 'new';
  else if (engagementScore >= 70 && days_since_last_interaction < 14) segment_label = 'champion';
  else if (engagementScore >= 50 && days_since_last_interaction < 30) segment_label = 'loyal';
  else if (engagementScore >= 30 && days_since_last_interaction < 60) segment_label = 'promising';
  else if (days_since_last_interaction >= 60) segment_label = 'inactive';
  else if (churnRisk >= 50) segment_label = 'at_risk';
  else segment_label = 'promising';

  return {
    engagement_score: Math.min(100, engagementScore),
    deliverability_score: Math.min(100, deliverabilityScore),
    quality_score: Math.min(100, qualityScore),
    churn_risk: churnRisk,
    segment_label
  };
}

/**
 * Enrichir le score avec l'analyse IA Claude
 */
async function enrichScoreWithAI(phone, metrics, baseScore) {
  const systemPrompt = `Tu es un expert en marketing WhatsApp pour l'Afrique de l'Ouest.
Analyse les métriques d'engagement d'un contact et retourne UNIQUEMENT un JSON valide.
Ne retourne rien d'autre que le JSON, sans markdown ni commentaire.`;

  const userMessage = `Contact: ${phone}
Métriques:
- Messages reçus: ${metrics.total_received}
- Livrés: ${metrics.total_delivered} (${metrics.total_received > 0 ? ((metrics.total_delivered/metrics.total_received)*100).toFixed(0) : 0}%)
- Lus: ${metrics.total_read} (${metrics.total_delivered > 0 ? ((metrics.total_read/metrics.total_delivered)*100).toFixed(0) : 0}%)
- Réponses: ${metrics.total_replied}
- Échecs: ${metrics.total_failed}
- Dernière interaction: il y a ${metrics.days_since_last_interaction} jours
- Heure de lecture préférée: ${metrics.preferred_hour !== null ? metrics.preferred_hour + 'h' : 'inconnue'}
- Segment actuel: ${baseScore.segment_label}

Retourne ce JSON exact:
{
  "insights": ["insight 1", "insight 2", "insight 3"],
  "recommended_hour": <0-23 ou null>,
  "recommended_day": <"monday"|"tuesday"|"wednesday"|"thursday"|"friday"|"saturday"|"sunday" ou null>,
  "risk_factors": ["facteur 1"],
  "opportunities": ["opportunité 1"],
  "ai_score_adjustment": <-10 à +10>,
  "confidence": <0-100>
}`;

  try {
    const text = await callClaude(systemPrompt, userMessage, 500);
    const clean = text.replace(/```json|```/g, '').trim();
    return JSON.parse(clean);
  } catch (err) {
    logger.warn(`[AI SCORING] Erreur enrichissement ${phone}:`, err.message);
    return { insights: [], recommended_hour: metrics.preferred_hour, ai_score_adjustment: 0, confidence: 0 };
  }
}

/**
 * Calculer et sauvegarder le score d'un contact
 */
async function scoreContact(clientId, phone, useAI = false) {
  // Récupérer les métriques historiques
  const metricsRes = await query(
    `SELECT
       COUNT(*) as total_received,
       COUNT(CASE WHEN wa_status IN('delivered','read') THEN 1 END) as total_delivered,
       COUNT(CASE WHEN wa_status = 'read' THEN 1 END) as total_read,
       COUNT(CASE WHEN wa_status = 'failed' THEN 1 END) as total_failed,
       COUNT(DISTINCT campaign_id) as campaigns_count,
       EXTRACT(EPOCH FROM (NOW() - MAX(created_at))) / 86400 as days_since_last
     FROM messages
     WHERE client_id = $1 AND recipient_phone = $2`,
    [clientId, phone]
  );

  const repliesRes = await query(
    `SELECT COUNT(*) as total_replied FROM incoming_messages WHERE phone_number = $1`,
    [phone]
  );

  const readTimesRes = await query(
    `SELECT
       EXTRACT(HOUR FROM read_at) as hour,
       COUNT(*) as count
     FROM messages
     WHERE client_id = $1 AND recipient_phone = $2 AND read_at IS NOT NULL
     GROUP BY EXTRACT(HOUR FROM read_at)
     ORDER BY count DESC LIMIT 1`,
    [clientId, phone]
  );

  const m = metricsRes.rows[0];
  const metrics = {
    total_received: parseInt(m.total_received) || 0,
    total_delivered: parseInt(m.total_delivered) || 0,
    total_read: parseInt(m.total_read) || 0,
    total_replied: parseInt(repliesRes.rows[0]?.total_replied) || 0,
    total_failed: parseInt(m.total_failed) || 0,
    campaigns_count: parseInt(m.campaigns_count) || 0,
    days_since_last_interaction: Math.round(parseFloat(m.days_since_last) || 999),
    preferred_hour: readTimesRes.rows[0] ? parseInt(readTimesRes.rows[0].hour) : null,
  };

  const baseScore = calculateStatisticalScore(metrics);

  let aiEnrichment = null;
  let finalScore = { ...baseScore };

  if (useAI && metrics.total_received >= 3) {
    aiEnrichment = await enrichScoreWithAI(phone, metrics, baseScore);
    const adj = aiEnrichment.ai_score_adjustment || 0;
    finalScore.quality_score = Math.min(100, Math.max(0, baseScore.quality_score + adj));
    finalScore.engagement_score = Math.min(100, Math.max(0, baseScore.engagement_score + Math.round(adj * 0.5)));
  }

  // Upsert dans contact_scores
  const scoreId = uuidv4();
  await query(
    `INSERT INTO contact_scores (
       id, client_id, phone_number,
       engagement_score, deliverability_score, quality_score, churn_risk,
       total_received, total_delivered, total_read, total_replied, total_failed,
       preferred_hour, last_campaign_at, segment_label,
       last_computed_at, next_recompute_at, computation_metadata
     ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,NOW(),$14,NOW(),NOW() + INTERVAL '24 hours',$15)
     ON CONFLICT (client_id, phone_number) DO UPDATE SET
       engagement_score = $4, deliverability_score = $5, quality_score = $6, churn_risk = $7,
       total_received = $8, total_delivered = $9, total_read = $10, total_replied = $11, total_failed = $12,
       preferred_hour = $13, segment_label = $14,
       last_computed_at = NOW(), next_recompute_at = NOW() + INTERVAL '24 hours',
       computation_metadata = $15`,
    [
      scoreId, clientId, phone,
      finalScore.engagement_score, finalScore.deliverability_score,
      finalScore.quality_score, finalScore.churn_risk,
      metrics.total_received, metrics.total_delivered, metrics.total_read,
      metrics.total_replied, metrics.total_failed,
      metrics.preferred_hour, finalScore.segment_label,
      JSON.stringify({ ai_enrichment: aiEnrichment, metrics })
    ]
  );

  return { success: true, phone, score: finalScore, metrics, ai_enrichment: aiEnrichment };
}

/**
 * Scorer plusieurs contacts en batch
 */
async function scoreCampaignContacts(clientId, campaignId, useAI = false, batchSize = 50) {
  const contacts = await query(
    `SELECT DISTINCT phone_number FROM campaign_contacts WHERE campaign_id = $1`,
    [campaignId]
  );

  let processed = 0, errors = 0;
  const total = contacts.rows.length;

  for (let i = 0; i < contacts.rows.length; i += batchSize) {
    const batch = contacts.rows.slice(i, i + batchSize);
    await Promise.allSettled(
      batch.map(async c => {
        try {
          await scoreContact(clientId, c.phone_number, useAI && i === 0); // IA seulement pour le 1er batch
          processed++;
        } catch { errors++; }
      })
    );
    // Pause entre batches
    await new Promise(r => setTimeout(r, 500));
  }

  return { success: true, total, processed, errors };
}

/**
 * Récupérer les scores d'un client
 */
async function getContactScores(clientId, filters = {}) {
  const { page = 1, limit = 50, segment, min_score, search, sort = 'quality_score' } = filters;
  const offset = (page - 1) * limit;

  const allowedSorts = ['quality_score','engagement_score','churn_risk','last_computed_at'];
  const safeSort = allowedSorts.includes(sort) ? sort : 'quality_score';

  let where = 'WHERE client_id = $1';
  const params = [clientId];
  let idx = 2;

  if (segment) { where += ` AND segment_label = $${idx++}`; params.push(segment); }
  if (min_score) { where += ` AND quality_score >= $${idx++}`; params.push(min_score); }
  if (search) { where += ` AND phone_number ILIKE $${idx++}`; params.push(`%${search}%`); }

  const countRes = await query(`SELECT COUNT(*) FROM contact_scores ${where}`, params);
  const total = parseInt(countRes.rows[0].count);

  const res = await query(
    `SELECT * FROM contact_scores ${where}
     ORDER BY ${safeSort} DESC
     LIMIT $${idx} OFFSET $${idx+1}`,
    [...params, limit, offset]
  );

  // Stats de distribution
  const distRes = await query(
    `SELECT segment_label, COUNT(*) as count,
       ROUND(AVG(quality_score),1) as avg_score,
       ROUND(AVG(churn_risk),1) as avg_churn
     FROM contact_scores WHERE client_id = $1 GROUP BY segment_label`,
    [clientId]
  );

  return {
    success: true,
    scores: res.rows,
    distribution: distRes.rows,
    pagination: { total, page: parseInt(page), limit: parseInt(limit), totalPages: Math.ceil(total / limit) }
  };
}

// ============================================================
// OPTIMISATION DES HORAIRES D'ENVOI (IA)
// ============================================================

/**
 * Analyser les patterns de lecture d'un client et construire son profil horaire
 */
async function buildTimingProfile(clientId) {
  // Récupérer les timestamps de lecture
  const readData = await query(
    `SELECT
       EXTRACT(HOUR FROM read_at) as hour,
       EXTRACT(DOW FROM read_at) as dow,
       COUNT(*) as reads,
       AVG(EXTRACT(EPOCH FROM (read_at - sent_at))/60) as avg_read_delay_min
     FROM messages
     WHERE client_id = $1
       AND read_at IS NOT NULL
       AND sent_at IS NOT NULL
       AND read_at > sent_at
     GROUP BY EXTRACT(HOUR FROM read_at), EXTRACT(DOW FROM read_at)
     ORDER BY reads DESC`,
    [clientId]
  );

  if (readData.rows.length === 0) {
    // Profil par défaut Cameroun (pic matin + soir)
    return buildDefaultProfile(clientId);
  }

  // Construire la matrice horaire
  const hourlyScores = {};
  const dailyScores = {};
  let totalReads = 0;

  for (const row of readData.rows) {
    const h = parseInt(row.hour);
    const d = parseInt(row.dow);
    const count = parseInt(row.reads);
    totalReads += count;

    hourlyScores[h] = (hourlyScores[h] || 0) + count;
    dailyScores[d] = (dailyScores[d] || 0) + count;
  }

  // Normaliser en scores 0-100
  const maxHourly = Math.max(...Object.values(hourlyScores), 1);
  const maxDaily = Math.max(...Object.values(dailyScores), 1);

  const normalizedHourly = {};
  const normalizedDaily = {};

  for (let h = 0; h < 24; h++) {
    normalizedHourly[h] = Math.round(((hourlyScores[h] || 0) / maxHourly) * 100);
  }
  for (let d = 0; d < 7; d++) {
    normalizedDaily[d] = Math.round(((dailyScores[d] || 0) / maxDaily) * 100);
  }

  const bestHour = Object.entries(normalizedHourly).sort((a, b) => b[1] - a[1])[0];
  const bestDay = Object.entries(normalizedDaily).sort((a, b) => b[1] - a[1])[0];

  // Upsert profil
  await query(
    `INSERT INTO send_time_profiles (id, client_id, hourly_scores, daily_scores,
       best_hour, best_day_of_week, total_messages_analyzed, confidence_level)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8)
     ON CONFLICT (client_id, phone_number) DO UPDATE SET
       hourly_scores = $3, daily_scores = $4,
       best_hour = $5, best_day_of_week = $6,
       total_messages_analyzed = $7, confidence_level = $8,
       last_computed_at = NOW(), updated_at = NOW()`,
    [uuidv4(), clientId, JSON.stringify(normalizedHourly), JSON.stringify(normalizedDaily),
     parseInt(bestHour[0]), parseInt(bestDay[0]),
     totalReads, Math.min(Math.round(totalReads / 10), 100)]
  );

  return { hourly_scores: normalizedHourly, daily_scores: normalizedDaily,
    best_hour: parseInt(bestHour[0]), best_day: parseInt(bestDay[0]), total_analyzed: totalReads };
}

function buildDefaultProfile(clientId) {
  // Profil heuristique Cameroun (comportements typiques)
  const hourly = {};
  for (let h = 0; h < 24; h++) {
    if (h >= 7 && h <= 9) hourly[h] = 70 + Math.random() * 20;       // Matin
    else if (h >= 12 && h <= 13) hourly[h] = 60 + Math.random() * 20; // Midi
    else if (h >= 18 && h <= 21) hourly[h] = 80 + Math.random() * 20; // Soir
    else if (h >= 0 && h <= 5) hourly[h] = 5 + Math.random() * 10;    // Nuit
    else hourly[h] = 30 + Math.random() * 20;
  }
  const daily = { 0:75, 1:80, 2:75, 3:70, 4:85, 5:60, 6:50 }; // Lun-Ven meilleur

  return { hourly_scores: hourly, daily_scores: daily, best_hour: 19, best_day: 4, total_analyzed: 0 };
}

/**
 * Générer des recommandations IA pour le timing d'une campagne
 */
async function getTimingRecommendation(clientId, campaignId, options = {}) {
  const { category = 'general', audience_size = 0 } = options;

  // Récupérer ou construire le profil
  const profileRes = await query(
    `SELECT * FROM send_time_profiles WHERE client_id = $1 AND phone_number IS NULL LIMIT 1`,
    [clientId]
  );

  let profile;
  if (profileRes.rows.length === 0 || profileRes.rows[0].total_messages_analyzed < 10) {
    profile = await buildTimingProfile(clientId);
  } else {
    const p = profileRes.rows[0];
    profile = {
      hourly_scores: p.hourly_scores,
      daily_scores: p.daily_scores,
      best_hour: p.best_hour,
      best_day: p.best_day_of_week,
      total_analyzed: p.total_messages_analyzed,
      confidence: p.confidence_level
    };
  }

  // Top 3 créneaux
  const topSlots = Object.entries(profile.hourly_scores || {})
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5)
    .map(([h, score]) => ({ hour: parseInt(h), score: Math.round(score), label: `${h}h00` }));

  const dayNames = ['Lundi','Mardi','Mercredi','Jeudi','Vendredi','Samedi','Dimanche'];
  const topDays = Object.entries(profile.daily_scores || {})
    .sort((a, b) => b[1] - a[1])
    .slice(0, 3)
    .map(([d, score]) => ({ day: parseInt(d), score: Math.round(score), label: dayNames[parseInt(d)] || `Jour ${d}` }));

  // Enrichissement IA
  let aiInsights = [];
  try {
    const systemPrompt = `Tu es expert en stratégie de communication WhatsApp en Afrique Centrale.
Réponds UNIQUEMENT en JSON valide, sans markdown.`;

    const userMsg = `Profil d'engagement d'un client WhatsApp au Cameroun:
- Catégorie de campagne: ${category}
- Taille audience: ${audience_size} contacts
- Meilleure heure: ${profile.best_hour}h
- Top créneaux: ${topSlots.slice(0,3).map(s=>`${s.label}(${s.score}%)`).join(', ')}
- Meilleur jour: ${dayNames[profile.best_day] || 'Vendredi'}
- Données analysées: ${profile.total_analyzed} messages

Retourne:
{
  "best_time_summary": "phrase courte",
  "insights": ["insight 1", "insight 2", "insight 3"],
  "warnings": ["warning si applicable"],
  "predicted_delivery_rate": <50-98>,
  "predicted_read_rate": <20-80>,
  "alternative_slots": [{"hour": N, "reason": "explication courte"}]
}`;

    const text = await callClaude(systemPrompt, userMsg, 600);
    const parsed = JSON.parse(text.replace(/```json|```/g, '').trim());
    aiInsights = parsed;
  } catch (err) {
    logger.warn('[AI TIMING] Erreur IA:', err.message);
    aiInsights = {
      best_time_summary: `Envoi recommandé à ${profile.best_hour}h (${dayNames[profile.best_day]||'Vendredi'})`,
      insights: [`Pic de lecture observé à ${profile.best_hour}h`, 'Éviter les envois après 22h', 'Les weekends ont un taux de lecture réduit'],
      warnings: profile.total_analyzed < 50 ? ['Profil basé sur peu de données — recommandations heuristiques'] : [],
      predicted_delivery_rate: 88,
      predicted_read_rate: 52,
      alternative_slots: [{ hour: 8, reason: 'Pic matinal — ouverture des messages au réveil' }]
    };
  }

  // Sauvegarder la prédiction
  if (campaignId) {
    await query(
      `INSERT INTO campaign_timing_predictions (id, campaign_id, client_id,
         predicted_best_hour, predicted_best_day, predicted_delivery_rate,
         predicted_read_rate, confidence, recommendations)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)
       ON CONFLICT DO NOTHING`,
      [uuidv4(), campaignId, clientId, profile.best_hour,
       dayNames[profile.best_day] || 'Friday',
       aiInsights.predicted_delivery_rate || 88,
       aiInsights.predicted_read_rate || 52,
       profile.confidence || 60,
       JSON.stringify(aiInsights.insights || [])]
    );
  }

  return {
    success: true,
    profile: { best_hour: profile.best_hour, best_day: profile.best_day, total_analyzed: profile.total_analyzed },
    top_slots: topSlots,
    top_days: topDays,
    ai_insights: aiInsights,
    scheduled_at_suggestion: buildScheduledAtSuggestion(profile.best_hour, profile.best_day)
  };
}

function buildScheduledAtSuggestion(bestHour, bestDay) {
  const now = new Date();
  const dowMap = [1, 2, 3, 4, 5, 6, 0]; // Lun=1...Sam=6, Dim=0 en JS
  const targetDow = dowMap[bestDay] !== undefined ? dowMap[bestDay] : 5;

  let daysAhead = (targetDow - now.getDay() + 7) % 7;
  if (daysAhead === 0 && now.getHours() >= bestHour) daysAhead = 7;
  if (daysAhead === 0 && now.getHours() < bestHour) daysAhead = 0;

  const target = new Date(now);
  target.setDate(target.getDate() + daysAhead);
  target.setHours(bestHour, 0, 0, 0);

  return target.toISOString();
}

/**
 * Analyse globale IA d'une campagne (rapport d'insights)
 */
async function analyzeCampaignWithAI(clientId, campaignId) {
  const campRes = await query(
    `SELECT c.*,
       ROUND((c.delivered_count::numeric/NULLIF(c.sent_count,0))*100,1) as delivery_rate,
       ROUND((c.read_count::numeric/NULLIF(c.delivered_count,0))*100,1) as read_rate
     FROM campaigns c WHERE c.id = $1 AND c.client_id = $2`,
    [campaignId, clientId]
  );
  if (!campRes.rows[0]) throw { statusCode: 404, message: 'Campagne non trouvée' };

  const camp = campRes.rows[0];

  const systemPrompt = `Tu es un expert analyste en campagnes WhatsApp B2B en Afrique Centrale (Cameroun).
Tu fournis des analyses actionnables et précises.
Réponds UNIQUEMENT en JSON valide, sans markdown ni commentaire.`;

  const userMsg = `Analyse cette campagne WhatsApp:
Nom: ${camp.name}
Catégorie: ${camp.category || 'Non spécifiée'}
Type: ${camp.campaign_type}
Contacts ciblés: ${camp.total_contacts}
Envoyés: ${camp.sent_count}
Livrés: ${camp.delivered_count} (${camp.delivery_rate || 0}%)
Lus: ${camp.read_count} (${camp.read_rate || 0}%)
Échecs: ${camp.failed_count}
Coût réel: $${camp.actual_cost || 0}
Statut: ${camp.status}

Retourne:
{
  "overall_grade": "A"|"B"|"C"|"D"|"F",
  "performance_summary": "résumé 1-2 phrases",
  "strengths": ["force 1", "force 2"],
  "weaknesses": ["faiblesse 1", "faiblesse 2"],
  "action_items": [
    {"priority": "high"|"medium"|"low", "action": "action concrète", "expected_impact": "impact attendu"}
  ],
  "benchmark_comparison": {
    "delivery_rate_industry_avg": 89,
    "read_rate_industry_avg": 55,
    "your_position": "above"|"below"|"at"
  },
  "next_campaign_recommendations": ["recommandation 1", "recommandation 2"]
}`;

  try {
    const text = await callClaude(systemPrompt, userMsg, 800);
    const analysis = JSON.parse(text.replace(/```json|```/g, '').trim());
    return { success: true, campaign: camp, analysis };
  } catch (err) {
    logger.error('[AI ANALYZE] Erreur:', err.message);
    return {
      success: true,
      campaign: camp,
      analysis: {
        overall_grade: (camp.read_rate||0) >= 50 ? 'B' : (camp.delivery_rate||0) >= 85 ? 'C' : 'D',
        performance_summary: `Campagne "${camp.name}" avec ${camp.delivery_rate||0}% de livraison et ${camp.read_rate||0}% de lecture.`,
        strengths: ['Taux de livraison', 'Volume d\'envoi'],
        weaknesses: camp.read_rate < 40 ? ['Taux de lecture faible'] : [],
        action_items: [{ priority: 'high', action: 'Tester différents horaires d\'envoi', expected_impact: '+10-15% de lectures' }],
        benchmark_comparison: { delivery_rate_industry_avg: 89, read_rate_industry_avg: 55, your_position: 'at' },
        next_campaign_recommendations: ['Optimiser l\'heure d\'envoi', 'A/B tester 2 templates']
      }
    };
  }
}

module.exports = {
  scoreContact, scoreCampaignContacts, getContactScores,
  buildTimingProfile, getTimingRecommendation,
  analyzeCampaignWithAI, calculateStatisticalScore
};
