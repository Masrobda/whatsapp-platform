require('dotenv').config();
const { query } = require('./src/config/database');
const {
  enqueueMissingInvoices,
  processRetryBatch
} = require('./src/services/socadel-invoice-retry.service');

(async () => {
  try {
    // ── 1) Récupère dynamiquement tous les contrats en 'failed' ──
    const failedRes = await query(
      `SELECT DISTINCT contract_number
       FROM socadel_invoice_retry_queue
       WHERE status = 'failed'`
    );
    const CONTRACTS = failedRes.rows.map((r) => r.contract_number);

    console.log(`Contrats en 'failed' : ${CONTRACTS.length}`);

    if (CONTRACTS.length === 0) {
      console.log('Rien à retraiter. Sortie.');
      process.exit(0);
    }

    // ── 2) Nettoie whatsapp_valid_contacts (au cas où) ──
/*    const delWac = await query(
      `DELETE FROM whatsapp_valid_contacts w
       USING socadel_contacts sc
       WHERE w.contract_number = sc.service_no
         AND sc.service_no     = ANY($1::text[])
         AND sc.check_status   = 'OK'
         AND regexp_replace(COALESCE(w.whatsapp_phone,''),    '[^0-9]', '', 'g')
           = regexp_replace(COALESCE(sc.numero_telephone,''), '[^0-9]', '', 'g')`,
      [CONTRACTS]
    );
    console.log('whatsapp_valid_contacts supprimés :', delWac.rowCount);*/

    // ── 3) Supprime les lignes 'failed' de la queue ──
    const delQueue = await query(
      `DELETE FROM socadel_invoice_retry_queue
       WHERE status = 'failed'
         AND contract_number = ANY($1::text[])`,
      [CONTRACTS]
    );
    console.log('queue supprimée :', delQueue.rowCount);

    // ── 4) Ré-enqueue via le service ──
    const enq = await enqueueMissingInvoices();
    console.log('[enqueue]', enq);

    // ── 5) Traitement par lots ──
    //    BATCH = 40 par défaut, donc pour 99 contrats = ~3 itérations.
    //    On plafonne à 50 itérations pour ne pas boucler à l'infini.
    let loops = 0;
    const MAX_LOOPS = 50;
    while (loops < MAX_LOOPS) {
      loops++;
      const proc = await processRetryBatch();
      console.log(`[process #${loops}]`, proc);
      if (proc.processed === 0) break;
    }

    // ── 6) Rapport final ──
    const finalRes = await query(
      `SELECT status, COUNT(*)::int AS n
       FROM socadel_invoice_retry_queue
       GROUP BY status
       ORDER BY status`
    );
    console.log('\n═══ État final de la queue ═══');
    for (const r of finalRes.rows) {
      console.log(`  ${r.status.padEnd(12)} : ${r.n}`);
    }

    process.exit(0);
  } catch (e) {
    console.error('ERREUR:', e);
    process.exit(1);
  }
})();
