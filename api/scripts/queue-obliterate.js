const { Queue } = require('bullmq');
const Redis = require('ioredis');

const QUEUE_PHONE = process.argv[2];
const CONFIRM     = process.argv[3]; // doit être "YES"

if (!QUEUE_PHONE || CONFIRM !== 'YES') {
  console.error('Usage: node queue-obliterate.js <phone_number> YES');
  console.error('⚠️  Supprime définitivement tous les jobs de la queue.');
  process.exit(1);
}

(async () => {
  const redis = new Redis({
    host: process.env.REDIS_HOST || 'localhost',
    port: parseInt(process.env.REDIS_PORT || '6379', 10),
    password: process.env.REDIS_PASSWORD || undefined,
    db: parseInt(process.env.REDIS_DB || '0', 10),
  });

  const norm = QUEUE_PHONE.replace(/\D/g, '');
  const qname = `whatsapp-messages-${norm}`;
  const q = new Queue(qname, { connection: redis });

  const [w, a, d, f] = await Promise.all([
    q.getWaitingCount(), q.getActiveCount(),
    q.getDelayedCount(), q.getFailedCount(),
  ]);
  const total = w + a + d + f;
  console.log(`Queue ${qname}: ${total} jobs au total`);
  console.log(`Suppression en cours…`);

  // obliterate({ force: true }) → efface toutes les clés Redis de cette queue
  await q.obliterate({ force: true });

  // Vérification : la clé meta doit avoir disparu
  const stillThere = await redis.exists(`bull:${qname}:meta`);
  console.log(`bull:${qname}:meta existe encore ? ${stillThere ? 'OUI ❌' : 'NON ✅'}`);

  // Nettoyage des clés résiduelles (parfois BullMQ laisse des hash)
  const leftovers = await redis.keys(`bull:${qname}:*`);
  if (leftovers.length > 0) {
    console.log(`Suppression de ${leftovers.length} clés résiduelles…`);
    await redis.del(...leftovers);
  }

  console.log(`✅ Queue ${qname} supprimée.`);
  process.exit(0);
})();
