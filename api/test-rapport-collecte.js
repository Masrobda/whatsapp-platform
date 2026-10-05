// ============================================================
// test-rapport-collecte.js
// À lancer depuis /var/www/numericexport/api/
// node test-rapport-collecte.js
// ============================================================
'use strict';

require('dotenv').config(); // .env à la racine du projet

const fs   = require('fs');
const path = require('path');

async function main() {
  console.log('\n══════════════════════════════════════════');
  console.log('  TEST RAPPORT COLLECTE');
  console.log('══════════════════════════════════════════');
  console.log('SMTP_USER  :', process.env.SMTP_USER  || '❌ MANQUANT');
  console.log('SMTP_HOST  :', process.env.SMTP_HOST  || '❌ MANQUANT');
  console.log('SMTP_PORT  :', process.env.SMTP_PORT  || '❌ MANQUANT');

  // ── Étape 1 : données ────────────────────────────────────
  console.log('\n── 1. fetchAllData ──');
  const { fetchAllData, buildHtml } = require('./src/services/rapport-collecte.service');
  let data;
  try {
    data = await fetchAllData();
    console.log('✅ OK — total:', data.global?.total,
                '| checked:', data.global?.checked,
                '| abonne:', data.global?.abonne);
  } catch (err) {
    console.error('❌', err.message);
    console.error(err.stack);
    process.exit(1);
  }

  // ── Étape 2 : HTML ───────────────────────────────────────
  console.log('\n── 2. buildHtml ──');
  let html;
  try {
    html = buildHtml(data);
    console.log('✅ OK —', html.length.toLocaleString('fr-FR'), 'chars');

    // Sauvegarde immédiate
    const out = '/tmp/rapport_collecte_test.html';
    fs.writeFileSync(out, html, 'utf8');
    console.log('📄 Sauvegardé :', out);
  } catch (err) {
    console.error('❌', err.message);
    console.error(err.stack);
    process.exit(1);
  }

  // ── Étape 3 : email ──────────────────────────────────────
  console.log('\n── 3. Envoi email ──');
  const emailService = require('./src/services/email.service');
  const TO = process.env.RAPPORT_COLLECTE_EMAILS || 'patrick.tondjou@camlight.cm';
  const dateLabel = new Date().toLocaleDateString('fr-FR', {
    day: '2-digit', month: 'long', year: 'numeric',
  });

  try {
    const info = await emailService.transporter.sendMail({
      from:    `"Collecte SOCADEL" <${process.env.SMTP_USER}>`,
      to:      TO,
      subject: `⚡ TEST — Rapport Collecte WhatsApp — ${dateLabel}`,
      html,
    });
    console.log('✅ Email envoyé !');
    console.log('   messageId :', info.messageId);
    console.log('   response  :', info.response);
    console.log('   accepted  :', JSON.stringify(info.accepted));
  } catch (err) {
    console.error('❌ Échec email :', err.message);
    console.error('   code     :', err.code);
    console.error('   response :', err.response);
    console.error('\n→ Le HTML est quand même dans /tmp/rapport_collecte_test.html');
  }

  console.log('\n══════════════════════════════════════════');
  process.exit(0);
}

main().catch(err => {
  console.error('Erreur non gérée :', err);
  process.exit(1);
});
