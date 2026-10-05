require('dotenv').config();
const { generateProforma, generateProformaPDF } = require('./src/services/invoice.service');

async function testInvoiceGeneration() {
  try {
    console.log('🚀 Début test génération facture...');
    
    // Remplacez par un ID de commande réel
    const orderId = 123; // À remplacer par un ID réel
    const userId = 1; // ID utilisateur financier
    
    console.log(`Génération pour commande ${orderId}...`);
    
    const result = await generateProforma(orderId, userId);
    
    console.log('✅ Succès!', JSON.stringify(result, null, 2));
    
    // Testez aussi directement la génération PDF
    console.log('\n🔍 Test génération PDF directe...');
    
    // Vous aurez besoin de créer un objet invoice fictif
    const mockInvoice = {
      id: 999,
      invoice_number: 'INV-PROFORMA-2026-001',
      issue_date: new Date(),
      due_date: new Date(Date.now() + 30*24*60*60*1000)
    };
    
    const mockOrder = {
      company_name: 'Test Client SA',
      email: 'test@client.com',
      address: '123 Rue Test',
      city: 'Douala',
      country: 'Cameroun',
      tax_id: 'T123456789',
      order_code: 'CMD-2026-001',
      unit_price: 1000,
      subtotal: 10000,
      vat_amount: 1900,
      total_amount: 11900,
      vat_rate: 19,
      quantity: 10
    };
    
    const pdfPath = await generateProformaPDF(mockInvoice, mockOrder);
    console.log(`✅ PDF généré: ${pdfPath}`);
    
  } catch (error) {
    console.error('❌ Erreur:', error);
    console.error('Stack:', error.stack);
  }
}

testInvoiceGeneration();
