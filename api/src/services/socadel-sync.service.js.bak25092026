// api/src/services/socadel-sync.service.js
'use strict';

const { query } = require('../config/database');
const { redis } = require('../config/redis');
const logger = require('../utils/logger');

const CACHE_STATS_KEY = 'socadel:stats';

/**
 * Synchronisation set-based socadel_contacts ↔ whatsapp_valid_contacts
 * - api_date figée si déjà OK
 * - activated_at : première valeur conservée
 * - responsable recalculé (MRA + dates + match téléphone)
 */
async function runBatchSync() {
  const start = Date.now();

  const result = await query(`
    WITH matched AS (
      SELECT
        sc.id,
        w.whatsapp_phone,
        w.client_name,
        w.activated_at,
        CASE WHEN w.contract_number IS NOT NULL THEN 'ABONNE' ELSE 'NON ABONNE' END AS new_statut,
        CASE WHEN w.contract_number IS NOT NULL THEN 'OK' ELSE 'NOK' END AS new_api_status
      FROM socadel_contacts sc
      LEFT JOIN whatsapp_valid_contacts w
        ON w.contract_number = sc.service_no
    ),
    updated AS (
      UPDATE socadel_contacts sc
      SET
        numero_telephone = COALESCE(sc.numero_telephone, m.whatsapp_phone),
        noms             = COALESCE(m.client_name, sc.noms),
        api_status       = m.new_api_status,
        api_date         = CASE
                             WHEN sc.api_status = 'OK' AND sc.api_date IS NOT NULL
                               THEN sc.api_date
                             ELSE NOW()
                           END,
        statut           = m.new_statut,
        activated_at     = COALESCE(sc.activated_at, m.activated_at),
        responsable      = CASE
          WHEN sc.check_status = 'OK'
           AND m.new_statut = 'ABONNE'
           AND COALESCE(sc.activated_at, m.activated_at) IS NOT NULL
           AND sc.check_date IS NOT NULL
           AND COALESCE(sc.activated_at, m.activated_at) >= sc.check_date
           AND UPPER(COALESCE(sc.rapport, 'OK')) = 'MRA'
           AND sc.numero_telephone IS NOT NULL
           AND m.whatsapp_phone IS NOT NULL
           AND regexp_replace(sc.numero_telephone, '[^0-9+]', '', 'g')
             = regexp_replace(m.whatsapp_phone, '[^0-9+]', '', 'g')
          THEN 'TERRAIN'
          ELSE COALESCE(sc.responsable, 'AUTRES')
        END,
        updated_at = NOW()
      FROM matched m
      WHERE sc.id = m.id
      RETURNING sc.id, sc.statut
    )
    SELECT
      COUNT(*)::int AS updated,
      COUNT(*) FILTER (WHERE statut = 'ABONNE')::int AS abonne,
      COUNT(*) FILTER (WHERE statut = 'NON ABONNE')::int AS non_abonne
    FROM updated
  `);

  const stats = result.rows[0] || { updated: 0, abonne: 0, non_abonne: 0 };

  try {
    // Invalide le cache exact + motif éventuel
    const keys = await redis.keys('socadel:stats*');
    if (keys.length > 0) await redis.del(...keys);
  } catch (e) {
    logger.warn('[socadel-sync] cache invalidate:', e.message);
  }

  logger.info('[socadel-sync] terminé', {
    ...stats,
    durationMs: Date.now() - start
  });

  return stats;
}

module.exports = { runBatchSync };
