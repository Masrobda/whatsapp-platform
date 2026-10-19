const { Queue } = require('bullmq');
const Redis = require('ioredis');
const { Pool } = require('pg');

(async () => {
  const redis = new Redis({
    host: process.env.REDIS_HOST || 'localhost',
    port: parseInt(process.env.REDIS_PORT || '6379', 10),
    password: process.env.REDIS_PASSWORD || undefined,
    db: parseInt(process.env.REDIS_DB || '0', 10),
  });

  const pg = new Pool({
    connectionString: process.env.DATABASE_URL
      || 'postgres://nextltd_user@localhost/nextltd_db',
  });
  const { rows } = await pg.query(
    `SELECT phone_number FROM whatsapp_numbers WHERE is_active = true`
  );
  const active = new Set(rows.map(r => r.phone_number.replace(/\D/g, '')));

  const keys = await redis.keys('bull:whatsapp-messages-*:meta');
  const queues = [...new Set(keys.map(k => k.split(':')[1]))];

  for (const qname of queues) {
    const num = qname.replace('whatsapp-messages-', '');
    if (active.has(num)) {
      console.log(`✓ GARDÉE ${qname} (numéro actif)`);
      continue;
    }

    const q = new Queue(qname, { connection: redis });
    const [w, a, d, f] = await Promise.all([
      q.getWaitingCount(), q.getActiveCount(),
      q.getDelayedCount(), q.getFailedCount(),
    ]);
    const total = w + a + d + f;
    if (total === 0) {
      console.log(`· ${qname} déjà vide`);
      continue;
    }

    console.log(`✗ ORPHELINE ${qname}: ${total} jobs → suppression`);
    await q.obliterate({ force: true });

    const leftovers = await redis.keys(`bull:${qname}:*`);
    if (leftovers.length > 0) await redis.del(...leftovers);
  }

  process.exit(0);
})();
