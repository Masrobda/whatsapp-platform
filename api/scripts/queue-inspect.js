const { Queue } = require('bullmq');
const Redis = require('ioredis');
const { Pool } = require('pg');

const QUEUE_PHONE = process.argv[2];
if (!QUEUE_PHONE) {
  console.error('Usage: node queue-inspect.js <phone_number>');
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
  console.log(`Queue ${qname}: waiting=${w} active=${a} delayed=${d} failed=${f}`);
  console.log(`Total jobs à supprimer : ${w + a + d + f}`);

  // Échantillon : quels messageIds sont concernés ?
  const sample = await q.getWaiting(0, 4);
  console.log('\nÉchantillon de 5 jobs en attente :');
  for (const job of sample) {
    console.log(`  jobId=${job.id}`);
    console.log(`    messageId=${job.data.messageId}`);
    console.log(`    recipient=${job.data.recipient_phone}`);
    console.log(`    template=${job.data.template_name}`);
  }

  // Combien de factures en BDD référencent ces messageIds ?
  const pg = new Pool({
    connectionString: process.env.DATABASE_URL
      || 'postgres://nextltd_user@localhost/nextltd_db',
  });

  const ids = sample.map(j => j.data.messageId).filter(Boolean);
  if (ids.length > 0) {
    const { rows } = await pg.query(
      `SELECT id, numero_facture, whatsapp_status, whatsapp_message_id
         FROM mysql_invoices_all
        WHERE whatsapp_message_id = ANY($1::uuid[])`,
      [ids]
    );
    console.log(`\nFactures correspondantes en BDD (échantillon) : ${rows.length}`);
    for (const r of rows) {
      console.log(`  ${r.numero_facture} → ${r.whatsapp_status}`);
    }
  }

  process.exit(0);
})();
