// src/scripts/setup-wati-webhook.js
const axios = require('axios');
require('dotenv').config();

async function setupWatiWebhook() {
  const apiKey = process.env.WATI_API_KEY;
  
  // ⚠️ IMPORTANT: Utiliser la même URL que votre route
  // Votre route est '/api/v1/webhooks/wati' (dans webhook.routes.js)
  const webhookUrl = `${process.env.APP_URL || 'https://api.numericexport.com'}/api/v1/webhooks/wati`;
  
  console.log('🔧 Configuration du webhook WATI...');
  console.log('📡 URL du webhook:', webhookUrl);
  console.log('🔑 API Key:', apiKey ? apiKey.substring(0, 20) + '...' : 'MANQUANTE');
  
  if (!apiKey) {
    console.error('❌ Erreur: WATI_API_KEY non définie dans .env');
    process.exit(1);
  }
  
  const options = {
    method: 'POST',
    url: 'https://live-mt-server.wati.io/10141984/api/v2/webhookEndpoints',
    headers: {
      'accept': 'application/json',
      'content-type': 'application/json',
      'Authorization': `Bearer ${apiKey}`
    },
    data: {
      url: webhookUrl,
      description: 'Webhook pour les statuts des messages et messages entrants - NextLTD',
      events: [
        'sentMessageSENT_v2',      // Message envoyé
        'sentMessageDELIVERED_v2',  // Message délivré
        'sentMessageREAD_v2',       // Message lu
        'sentMessageFAILED_v2',     // Message échoué
        'message'                   // Message entrant
      ],
      is_active: true,
      secret: process.env.WATI_WEBHOOK_SECRET || 'your-secret-key-change-me'
    }
  };
  
  try {
    console.log('\n📤 Envoi de la requête à WATI...');
    const response = await axios(options);
    console.log('\n✅ Webhook configuré avec succès sur WATI!');
    console.log('📋 Réponse:', JSON.stringify(response.data, null, 2));
    
    // Optionnel: Lister les webhooks existants
    console.log('\n🔍 Récupération de la liste des webhooks...');
    const listResponse = await axios({
      method: 'GET',
      url: 'https://live-mt-server.wati.io/10141984/api/v2/webhookEndpoints',
      headers: {
        'accept': 'application/json',
        'Authorization': `Bearer ${apiKey}`
      }
    });
    
    console.log(`📊 Total webhooks configurés: ${listResponse.data.length || 0}`);
    
  } catch (error) {
    console.error('\n❌ Erreur lors de la configuration:');
    if (error.response) {
      console.error('Status:', error.response.status);
      console.error('Data:', JSON.stringify(error.response.data, null, 2));
    } else if (error.request) {
      console.error('Pas de réponse de WATI');
      console.error('Message:', error.message);
    } else {
      console.error('Erreur:', error.message);
    }
    
    console.log('\n💡 Suggestions:');
    console.log('1. Vérifiez que votre API Key WATI est valide');
    console.log('2. Vérifiez que votre serveur est accessible depuis Internet');
    console.log('3. Si vous êtes en local, utilisez ngrok: ngrok http 3001');
    console.log(`4. Puis définissez APP_URL=https://votre-ngrok.ngrok.io`);
  }
}

// Exécution
setupWatiWebhook();
