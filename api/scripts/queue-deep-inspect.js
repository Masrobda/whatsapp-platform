const { Queue } = require('bullmq');
const Redis = require('ioredis');

const QUEUE_PHONE = process.argv[2];
if (!QUEUE_PHONE) { console.error('Usage: node queue-deep-inspect.js <phone>'); process.exit(1); }

(async () => {
  const redis = new Redis({
    host: process.env.REDIS_HOST || 'localhost',
    port: parseInt(process.env.REDIS_PORT || '6379', 10),
    password: process.env.REDIS_PASSWORD || undefined,
    db: parseInt(process.env.REDIS_DB || '0', 10),
  });

  const norm  = QUEUE_PHONE.replace(/\D/g, '');
  const qname = `whatsapp-messages-${norm}`;
  const q     = new Queue(qname, { connection: redis });

  const counts = await q.getJobCounts(
    'wait', 'active', 'delayed', 'failed', 'completed', 'paused', 'waiting-children', 'prioritized'
  );
  console.log(`\n=== ${qname} ===`);
  console.log(JSON.stringify(counts, null, 2));

  // Compte brut dans Redis (sans passer par BullMQ)
  const raw = await Promise.all([
    redis.llen(`bull:${qname}:wait`),
    redis.llen(`bull:${qname}:active`),
    redis.zcard(`bull:${qname}:delayed`),
    redis.zcard(`bull:${qname}:failed`),
    redis.zcard(`bull:${qname}:completed`),
  ]);
  console.log(`\nRaw Redis [wait, active, delayed, failed, completed]:`, raw);

  // Échantillon de jobs dans chaque état non vide
  for (const state of ['failed', 'completed', 'active']) {
    const jobs = await q.getJobs([state], 0, 2);
    if (jobs.length > 0) {
      console.log(`\n--- 3 premiers jobs '${state}' ---`);
      for (const j of jobs) {
        console.log(`  jobId=${j.id} messageId=${j.data?.messageId} recipient=${j.data?.recipient_phone}`);
      }
    }
  }

  // Toutes les clés Redis restantes
  const allKeys = await redis.keys(`bull:${qname}:*`);
  console.log(`\nClés Redis restantes : ${allKeys.length}`);
  for (const k of allKeys.slice(0, 20)) console.log(`  ${k}`);

  process.exit(0);
})();
