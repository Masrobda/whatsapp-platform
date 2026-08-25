// scripts/generate-bot-qrcode.js
//
// Génère un QR code pointant vers le lien WhatsApp du chatbot, à afficher
// en agence. Le lien pré-remplit automatiquement le message "Bonjour" —
// le client n'a qu'à appuyer sur envoyer dans WhatsApp.
//
// Installation : npm install qrcode --save
// Utilisation  : node scripts/generate-bot-qrcode.js

const QRCode = require('qrcode');
const path = require('path');

const BOT_NUMBER = '237688359040'; // sans le "+"
const PREFILLED_TEXT = 'Bonjour';
const LINK = `https://wa.me/${BOT_NUMBER}?text=${encodeURIComponent(PREFILLED_TEXT)}`;

async function main() {
  const outputPath = path.join(__dirname, '..', 'public', 'bot-qrcode.png');

  await QRCode.toFile(outputPath, LINK, {
    width: 800,
    margin: 2,
    color: {
      dark: '#1e5a2f',  // vert foncé de la charte
      light: '#ffffff',
    },
  });

  console.log(`✅ QR code généré : ${outputPath}`);
  console.log(`🔗 Lien WhatsApp : ${LINK}`);
  console.log(`📍 Accessible ensuite via : https://api.numericexport.com/assets/bot-qrcode.png`);
}

main().catch((err) => {
  console.error('❌ Erreur génération QR code:', err.message);
  process.exit(1);
});
