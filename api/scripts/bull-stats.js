const { Queue } = require('bullmq');
const Redis = require('ioredis');

(async () => {
  const redis = new Redis({
    host: process.env.REDIS_HOST || 'localhost',
    port: parseInt(process.env.REDIS_PORT || '6379', 10),
    password: process.env.REDIS_PASSWORD || undefined,
    db: parseInt(process.env.REDIS_DB || '0', 10),
  });

  const keys = await redis.keys('bull:whatsapp-messages-*:meta');
  const queues = [...new Set(keys.map(k => k.split(':')[1]))];

  if (queues.length === 0) {
    console.log('Aucune queue BullMQ trouvée.');
    const allKeys = await redis.keys('bull:*:meta');
    console.log(`Autres queues présentes : ${allKeys.length}`);
    process.exit(0);
  }

  let totalWaiting = 0, totalActive = 0, totalDelayed = 0, totalFailed = 0;
  for (const qname of queues) {
    const q = new Queue(qname, { connection: redis });
    const [w, a, d, f] = await Promise.all([
      q.getWaitingCount(), q.getActiveCount(),
      q.getDelayedCount(), q.getFailedCount(),
    ]);
    const workerKeys = await redis.keys(`bull:${qname}:workers`);
    const hasWorker = workerKeys.length > 0;
    if (w + a + d + f > 0 || !hasWorker) {
      console.log(`${qname}: waiting=${w} active=${a} delayed=${d} failed=${f} worker=${hasWorker ? 'OUI' : 'NON ⚠️'}`);
    }
    totalWaiting += w; totalActive += a; totalDelayed += d; totalFailed += f;
  }
  console.log(`\nTOTAL: waiting=${totalWaiting} active=${totalActive} delayed=${totalDelayed} failed=${totalFailed}`);
  process.exit(0);
})();
