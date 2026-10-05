// ============================================================
// debug-rapport-collecte.js
// Script de diagnostic — à lancer UNE FOIS pour identifier le problème
// Usage : node debug-rapport-collecte.js
// ============================================================
'use strict';

require('dotenv').config({ path: require('path').join(__dirname, '../../.env') });
const fs   = require('fs');
const path = require('path');

console.log('');
console.log('══════════════════════════════════════════════════════');
console.log('  DIAGNOSTIC RAPPORT COLLECTE WHATSAPP — SOCADEL');
console.log('══════════════════════════════════════════════════════');

// ── 1. Vérification variables .env ────────────────────────
console.log('\n── Étape 1 : Variables d\'environnement ──');
const requiredEnv = ['SMTP_HOST', 'SMTP_PORT', 'SMTP_USER', 'SMTP_PASSWORD', 'SMTP_SECURE'];
let envOk = true;
for (const key of requiredEnv) {
  const val = process.env[key];
  if (!val) {
    console.error(`  ❌ MANQUANT : ${key}`);
    envOk = false;
  } else {
    // Masquer le mot de passe
    const display = key === 'SMTP_PASSWORD' ? '*'.repeat(val.length) : val;
    console.log(`  ✅ ${key} = ${display}`);
  }
}
if (!envOk) {
  console.error('\n❌ Variables .env manquantes — corriger avant de continuer.');
  console.error('   Chemin .env attendu : /var/www/numericexport/api/.env');
  process.exit(1);
}

// ── 2. Test connexion PostgreSQL ──────────────────────────
console.log('\n── Étape 2 : Connexion PostgreSQL ──');
async function testDB() {
  try {
    const { query } = require('./src/config/database');
    const res = await query('SELECT COUNT(*)::int AS total FROM socadel_contacts LIMIT 1');
    console.log('  ✅ PostgreSQL OK — socadel_contacts:', res.rows[0]?.total, 'lignes');
    return true;
  } catch (err) {
    console.error('  ❌ PostgreSQL KO :', err.message);
    return false;
  }
}

// ── 3. Test SMTP ──────────────────────────────────────────
console.log('\n── Étape 3 : Test SMTP ──');
async function testSMTP() {
  const nodemailer = require('nodemailer');
  const transporter = nodemailer.createTransport({
    host:   process.env.SMTP_HOST,
    port:   parseInt(process.env.SMTP_PORT, 10),
    secure: process.env.SMTP_SECURE === 'true',
    auth: {
      user: process.env.SMTP_USER,
      pass: process.env.SMTP_PASSWORD,
    },
    // Timeout généreux
    connectionTimeout: 15000,
    greetingTimeout:   10000,
    socketTimeout:     30000,
    debug: true,
    logger: true,
  });

  console.log(`  Tentative connexion SMTP ${process.env.SMTP_HOST}:${process.env.SMTP_PORT} ...`);
  try {
    await transporter.verify();
    console.log('  ✅ SMTP vérifié — connexion OK');
    return { ok: true, transporter };
  } catch (err) {
    console.error('  ❌ SMTP KO :', err.message);
    console.error('  code :', err.code);
    console.error('  ─────────────────────────────────────────────');
    console.error('  Solutions possibles :');
    if (err.code === 'ECONNREFUSED') {
      console.error('    → Mauvais host/port ou service SMTP non démarré');
    } else if (err.code === 'ETIMEDOUT') {
      console.error('    → Firewall bloquant le port', process.env.SMTP_PORT);
      console.error('    → Tester : telnet', process.env.SMTP_HOST, process.env.SMTP_PORT);
    } else if (err.message.includes('Invalid login') || err.message.includes('535')) {
      console.error('    → Mauvais identifiants SMTP_USER / SMTP_PASSWORD');
      console.error('    → Si Gmail : activer "Mot de passe d\'application" dans le compte Google');
    } else if (err.message.includes('certificate') || err.message.includes('SSL')) {
      console.error('    → Problème SSL/TLS — essayer SMTP_SECURE=false ou changer de port');
    }
    return { ok: false, transporter };
  }
}

// ── 4. Test envoi email de diagnostic ────────────────────
async function testSendEmail(transporter) {
  const TO = process.env.SMTP_USER; // Envoyer à soi-même pour le test
  console.log(`\n── Étape 4 : Envoi email test à ${TO} ──`);
  try {
    const info = await transporter.sendMail({
      from:    `"Test SOCADEL" <${process.env.SMTP_USER}>`,
      to:      TO,
      subject: '⚡ Test SMTP — Rapport Collecte SOCADEL',
      html:    '<h2>Test SMTP OK</h2><p>Si vous recevez ceci, le serveur SMTP fonctionne correctement.</p>',
    });
    console.log('  ✅ Email test envoyé !');
    console.log('  messageId :', info.messageId);
    console.log('  response  :', info.response);
    console.log('  accepted  :', JSON.stringify(info.accepted));
    console.log('  rejected  :', JSON.stringify(info.rejected));
    return true;
  } catch (err) {
    console.error('  ❌ Échec envoi :', err.message);
    console.error('  code     :', err.code);
    console.error('  response :', err.response);
    return false;
  }
}

// ── 5. Test génération HTML ───────────────────────────────
async function testHTML() {
  console.log('\n── Étape 5 : Test génération HTML ──');
  try {
    const { fetchAllData, buildHtml } = require('./src/services/rapport-collecte.service');
    console.log('  Collecte des données...');
    const data = await fetchAllData();
    console.log('  ✅ fetchAllData OK — global.total:', data.global?.total);

    console.log('  Génération HTML...');
    const html = buildHtml(data);
    console.log('  ✅ buildHtml OK —', html.length.toLocaleString('fr-FR'), 'caractères');

    // Sauvegarde HTML dans /tmp
    const fpath = `/tmp/rapport_collecte_diagnostic_${Date.now()}.html`;
    fs.writeFileSync(fpath, html, 'utf8');
    console.log('  📄 HTML sauvegardé :', fpath);
    console.log('  → Ouvrir ce fichier dans un navigateur pour vérifier le rendu');
    return { ok: true, html, fpath };
  } catch (err) {
    console.error('  ❌ Erreur :', err.message);
    console.error(err.stack);
    return { ok: false };
  }
}

// ── MAIN ──────────────────────────────────────────────────
async function main() {
  const dbOk   = await testDB();
  const smtp   = await testSMTP();
  const htmlRes= await testHTML();

  let emailOk = false;
  if (smtp.ok) {
    emailOk = await testSendEmail(smtp.transporter);
  } else {
    console.log('\n── Étape 4 : Test email ──');
    console.log('  ⏭️  Skippé (SMTP non fonctionnel)');
  }

  // ── Résumé ──
  console.log('');
  console.log('══════════════════════════════════════════════════════');
  console.log('  RÉSUMÉ DIAGNOSTIC');
  console.log('══════════════════════════════════════════════════════');
  console.log(`  PostgreSQL    : ${dbOk    ? '✅ OK' : '❌ KO'}`);
  console.log(`  SMTP verify   : ${smtp.ok ? '✅ OK' : '❌ KO'}`);
  console.log(`  HTML buildHtml: ${htmlRes.ok ? '✅ OK — ' + htmlRes.fpath : '❌ KO'}`);
  console.log(`  Email test    : ${emailOk ? '✅ Envoyé' : '❌ Échoué ou skippé'}`);
  console.log('');

  if (!smtp.ok) {
    console.log('  ACTION REQUISE : corriger la config SMTP dans .env');
    console.log('  ─────────────────────────────────────────────────');
    console.log('  Exemple .env pour Gmail (app password) :');
    console.log('    SMTP_HOST=smtp.gmail.com');
    console.log('    SMTP_PORT=587');
    console.log('    SMTP_SECURE=false');
    console.log('    SMTP_USER=votre@gmail.com');
    console.log('    SMTP_PASSWORD=xxxx xxxx xxxx xxxx  ← mot de passe d\'application');
    console.log('');
    console.log('  Exemple .env pour serveur interne :');
    console.log('    SMTP_HOST=mail.camlight.cm (ou IP)');
    console.log('    SMTP_PORT=25  (ou 465 ou 587)');
    console.log('    SMTP_SECURE=false');
    console.log('    SMTP_USER=noreply@camlight.cm');
    console.log('    SMTP_PASSWORD=motdepasse');
  }
  console.log('══════════════════════════════════════════════════════');
}

main()
  .then(() => process.exit(0))
  .catch(err => {
    console.error('Erreur non gérée :', err);
    process.exit(1);
  });
