// webhook-test.js
const express = require('express');
const crypto  = require('crypto');
const app     = express();

app.use(express.json());

const WEBHOOK_SECRET = process.env.WEBHOOK_SECRET || 'f73656ee5f97417e8ebcd1c96c2ebec4cd3384a017504993bba20fafd4cd00da';

app.post('/webhook/numericexport', (req, res) => {
  // ① Réponse 200 immédiate
  res.sendStatus(200);

  // ② Traitement asynchrone (mais synchrone ici) – on capture les erreurs
  try {
    // ③ Vérification de la signature (si présente)
    const sig = req.headers['x-webhook-signature'];
    if (sig) {
      if (typeof sig === 'string' && sig.length === 64) {
        const expected = crypto
          .createHmac('sha256', WEBHOOK_SECRET)
          .update(JSON.stringify(req.body))
          .digest('hex');

        if (!crypto.timingSafeEqual(Buffer.from(sig, 'hex'), Buffer.from(expected, 'hex'))) {
          console.error('❌ Signature invalide — requête ignorée');
          return;
        }
      } else {
        console.warn('⚠️ Signature mal formée (longueur incorrecte) — ignorée');
      }
    } else {
      console.log('ℹ️ Aucune signature fournie (mode test)');
    }

    // ④ Extraction des données
    const { event, timestamp, data } = req.body;

    // ⑤ Parsing sécurisé du timestamp
    let dateObj;
    if (timestamp) {
      if (typeof timestamp === 'number') {
        dateObj = new Date(timestamp * 1000); // secondes → millisecondes
      } else if (typeof timestamp === 'string') {
        dateObj = new Date(timestamp); // ISO ou autre format
      } else {
        dateObj = new Date();
      }
    } else {
      dateObj = new Date();
    }

    // Si la date est invalide, on utilise l'heure courante
    if (isNaN(dateObj.getTime())) {
      dateObj = new Date();
    }

    console.log(`📨 Événement reçu : ${event} à ${dateObj.toISOString()}`);

    // ⑥ Traitement selon l'événement
    switch (event) {
      case 'message.sent':
        console.log(`✉️  Message envoyé à ${data.recipient} (ID: ${data.message_id})`);
        break;
      case 'message.delivered':
        console.log(`✅ Délivré à ${data.recipient} le ${data.delivered_at}`);
        break;
      case 'message.read':
        console.log(`👁️  Lu par ${data.recipient} le ${data.read_at}`);
        break;
      case 'message.failed':
        console.error(`❌ Échec pour ${data.recipient} (ID: ${data.message_id})`);
        break;
      case 'message.incoming':
        console.log(`💬 Réponse de ${data.from} : "${data.message}"`);
        break;
      case 'message.test':
        console.log(`🧪 Test reçu : ${data.message}`);
        break;
      default:
        console.log(`ℹ️  Événement inconnu : ${event}`);
    }
  } catch (err) {
    // Toute erreur est loggée mais ne perturbe pas la réponse (déjà envoyée)
    console.error('❌ Erreur lors du traitement :', err.message);
  }
});

const PORT = 3005;
app.listen(PORT, '0.0.0.0', () => {
  console.log(`🚀 Serveur webhook en écoute sur http://0.0.0.0:${PORT}/webhook/numericexport`);
});
