const { Queue } = require('bullmq');
const Redis = require('ioredis');
const fs = require('fs');

const QUEUE_PHONE = process.argv[2];
if (!QUEUE_PHONE) {
  console.error('Usage: node queue-extract-ids.js <phone_number>');
  process.exit(1);
}

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

  const total = await q.getWaitingCount();
  console.log(`Queue ${qname} : ${total} jobs en attente`);

  const ids = [];
  const CHUNK = 1000;

  for (let start = 0; start < total; start += CHUNK) {
    const jobs = await q.getWaiting(start, start + CHUNK - 1);
    for (const job of jobs) {
      if (job?.data?.messageId) ids.push(job.data.messageId);
    }
    console.log(`  lus ${Math.min(start + CHUNK, total)} / ${total}`);
  }

  const unique = [...new Set(ids)];
  console.log(`\nTotal messageIds uniques : ${unique.length}`);

  const outFile = `/tmp/queue-${norm}-message-ids.json`;
  fs.writeFileSync(outFile, JSON.stringify(unique, null, 2));
  console.log(`Écrit dans : ${outFile}`);

  process.exit(0);
})();
