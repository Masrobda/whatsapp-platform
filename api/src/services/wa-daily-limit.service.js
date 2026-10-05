// api/src/services/wa-daily-limit.service.js
'use strict';

const { redis } = require('../config/redis');
const logger = require('../utils/logger');

/**
 * Limites journalières par numéro.
 * On compte UNIQUEMENT les envois WATI réussis (INCR après succès).
 *
 * Env :
 *   WA_DAILY_LIMITS=+237688356291:9000,+237688359040:5000
 *   SOCADEL_INVOICE_DAILY_LIMIT=9000
 *   SOCADEL_QUICK_REGISTER_INVOICE_NUMBER=+237688356291
 *
 * Timezone : Africa/Douala
 */

function normalize(phone) {
  if (!phone) return '';
  let d = String(phone).replace(/\D/g, '');
  if (d.startsWith('237') && d.length >= 12) return `+${d}`;
  if (d.length === 9) return `+237${d}`;
  if (String(phone).startsWith('+')) return `+${d}`;
  return d ? `+${d}` : '';
}

function getLimitForPhone(phone) {
  const n = normalize(phone);
  if (!n) return null;

  const map = process.env.WA_DAILY_LIMITS || '';
  for (const part of map.split(',')) {
    const [p, lim] = part.split(':').map((s) => (s || '').trim());
    if (p && normalize(p) === n) {
      const v = parseInt(lim, 10);
      return Number.isFinite(v) && v > 0 ? v : null;
    }
  }

  const single =
    process.env[`WA_DAILY_LIMIT_${n}`] ||
    process.env[`WA_DAILY_LIMIT_${n.replace('+', '')}`];
  if (single) {
    const v = parseInt(single, 10);
    return Number.isFinite(v) && v > 0 ? v : null;
  }

  const defPhone = normalize(
    process.env.SOCADEL_QUICK_REGISTER_INVOICE_NUMBER || '+237688356291'
  );
  if (n === defPhone) {
    const v = parseInt(process.env.SOCADEL_INVOICE_DAILY_LIMIT || '54000', 10);
    return Number.isFinite(v) && v > 0 ? v : 54000;
  }

  return null;
}

function todayKeyDouala() {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Africa/Douala',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(new Date());
}

function cacheKey(phone) {
  return `wa:daily_ok:${normalize(phone)}:${todayKeyDouala()}`;
}

function ttlSeconds() {
  return 36 * 3600;
}

/**
 * Vérifie s'il reste de la place AUJOURD'HUI (lecture seule, pas d'INCR).
 */
async function canSendToday(phone) {
  const limit = getLimitForPhone(phone);
  if (limit == null) {
    return { ok: true, used: 0, limit: null, unlimited: true };
  }

  const key = cacheKey(phone);
  try {
    const used = parseInt((await redis.get(key)) || '0', 10);
    if (used >= limit) {
      return { ok: false, reason: 'LIMIT_REACHED', used, limit };
    }
    return { ok: true, used, limit };
  } catch (err) {
    logger.warn(`[WA-DAILY-LIMIT] Redis indisponible: ${err.message}`);
    return { ok: true, used: 0, limit, degraded: true };
  }
}

/**
 * À appeler UNIQUEMENT après un succès WATI confirmé.
 */
async function recordSuccessfulSend(phone) {
  const limit = getLimitForPhone(phone);
  if (limit == null) return { used: 0, limit: null };

  const key = cacheKey(phone);
  try {
    const used = await redis.incr(key);
    if (used === 1) {
      await redis.expire(key, ttlSeconds());
    }
    if (used > limit) {
      logger.warn(
        `[WA-DAILY-LIMIT] Légèrement au-dessus de la limite: ${used}/${limit} (${normalize(phone)})`
      );
    }
    return { used, limit };
  } catch (err) {
    logger.warn(`[WA-DAILY-LIMIT] record fail: ${err.message}`);
    return { used: 0, limit };
  }
}

async function getDailyUsage(phone) {
  const limit = getLimitForPhone(phone);
  if (limit == null) return { used: 0, limit: null, remaining: null };
  try {
    const used = parseInt((await redis.get(cacheKey(phone))) || '0', 10);
    return { used, limit, remaining: Math.max(0, limit - used) };
  } catch (_) {
    return { used: 0, limit, remaining: limit };
  }
}

// Compat anciennes signatures (évite de casser d'autres fichiers)
async function tryReserveDailySlot(phone) {
  return canSendToday(phone);
}

async function releaseDailySlot(_phone) {
  // Plus utilisé : on n'INCR plus avant l'envoi
}

module.exports = {
  canSendToday,
  recordSuccessfulSend,
  getDailyUsage,
  getLimitForPhone,
  normalize,
  tryReserveDailySlot,
  releaseDailySlot,
};
