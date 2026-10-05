require('dotenv').config();
const { query } = require('./src/config/database');
const { generateProforma } = require('./src/services/invoice.service');

async function quickTest() {
  try {
    console.log('🔍 Recherche d\'une commande...');
    
    // Option 1: Chercher une commande déjà validée
    let orders = await query(`
      SELECT id::text as uuid, order_code, status
      FROM orders 
      WHERE status = 'validated_financial'
      LIMIT 1
    `);
    
    // Option 2: Si aucune, prendre la dernière commande
    if (orders.rows.length === 0) {
      orders = await query(`
        SELECT id::text as uuid, order_code, status
        FROM orders 
        ORDER BY created_at DESC
        LIMIT 1
      `);
      
      if (orders.rows.length === 0) {
        console.log('❌ Aucune commande trouvée');
        return;
      }
      
      // Mettre à jour le statut
      await query(
        'UPDATE orders SET status = $1 WHERE id = $2',
        ['validated_financial', orders.rows[0].uuid]
      );
      console.log('✅ Statut mis à jour');
    }
    
    const order = orders.rows[0];
    console.log(`📋 Commande: ${order.order_code} (${order.status})`);
    console.log(`🔑 UUID: ${order.uuid}`);
    
    // Trouver un utilisateur
    const users = await query(`
      SELECT id, email
      FROM users
      WHERE role IN ('financial_manager', 'admin')
      LIMIT 1
    `);
    
    const userId = users.rows[0]?.id || 1;
    console.log(`👤 Utilisateur ID: ${userId}`);
    
    console.log('\n🖨️ Génération de la facture...');
    const result = await generateProforma(order.uuid, userId);
    
    console.log('\n🎉 SUCCÈS!');
    console.log(`Facture: ${result.invoice.invoice_number}`);
    console.log(`PDF: ${result.invoice.pdf_path}`);
    
  } catch (error) {
    console.error('💥 ERREUR:', error.message);
    if (error.code) console.error('Code PostgreSQL:', error.code);
  }
}

quickTest();
