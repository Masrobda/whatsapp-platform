// api/retry-stuck-invoices.js
require('dotenv').config();

const { confirmSocadelSubscriptionFromDelivery } = require('./src/services/socadel-subscription-confirm.service');
const { query } = require('./src/config/database');

(async () => {
  try {
    // Récupère les pending 'sent'/'delivered' dont le contrat a été
    // récemment inséré dans contracts (les 24 orphelins)
    const r = await query(`
      SELECT DISTINCT ON (p.contract_number)
        p.contract_number,
        p.wati_local_id,
        p.status
      FROM socadel_invoice_pending p
      WHERE p.contract_number IN (
        SELECT contract_number
        FROM contracts
        WHERE created_at > NOW() - INTERVAL '30 minutes'
      )
        AND p.status IN ('sent', 'delivered')
      ORDER BY p.contract_number, p.created_at DESC
    `);

    console.log(`Contrats à rattraper : ${r.rows.length}`);

    let totalMatched = 0;
    for (const row of r.rows) {
      const res = await confirmSocadelSubscriptionFromDelivery({
        watiLocalId: row.wati_local_id,
        status: 'delivered',
      });
      console.log(`  ${row.contract_number} (${row.status}) → matched=${res.matched}`);
      totalMatched += res.matched;
    }

    console.log(`\n✅ Total matched : ${totalMatched}`);
    process.exit(0);
  } catch (err) {
    console.error('❌ Erreur:', err);
    process.exit(1);
  }
})();
