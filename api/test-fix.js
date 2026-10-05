const { query } = require('./src/config/database');
const invoiceService = require('./src/services/invoice.service');

async function testInvoiceGeneration() {
  console.log('🔍 Test de génération de facture...');
  
  // 1. Trouver une commande avec statut validated_financial
  const orderResult = await query(
    `SELECT id::text as uuid FROM orders WHERE status = 'validated_financial' LIMIT 1`
  );
  
  if (orderResult.rows.length === 0) {
    console.log('❌ Aucune commande avec statut validated_financial trouvée');
    return;
  }
  
  const orderId = orderResult.rows[0].uuid;
  console.log('📋 Commande trouvée:', orderId);
  
  // 2. Vérifier si une facture existe déjà
  const invoiceResult = await query(
    'SELECT * FROM invoices WHERE order_id = $1 AND invoice_type = $2',
    [orderId, 'proforma']
  );
  
  if (invoiceResult.rows.length > 0) {
    console.log('⚠️ Facture existe déjà:', invoiceResult.rows[0].invoice_number);
    console.log('PDF path:', invoiceResult.rows[0].pdf_path);
  } else {
    console.log('✅ Pas de facture existante, peut générer');
  }
  
  // 3. Trouver un utilisateur financier
  const userResult = await query(
    `SELECT id FROM users WHERE role IN ('financial_manager', 'admin') LIMIT 1`
  );
  
  if (userResult.rows.length === 0) {
    console.log('❌ Aucun utilisateur financier trouvé');
    return;
  }
  
  const userId = userResult.rows[0].id;
  console.log('👤 Utilisateur ID:', userId);
  
  // 4. Essayer de générer la facture
  try {
    console.log('🖨️ Tentative génération facture...');
    const result = await invoiceService.generateProforma(orderId, userId);
    console.log('🎉 SUCCÈS!');
    console.log('Facture:', result.invoice.invoice_number);
    console.log('PDF:', result.invoice.pdf_path);
  } catch (error) {
    console.error('❌ ERREUR:', error.message);
    console.error('Détails:', error);
  }
}

testInvoiceGeneration();
