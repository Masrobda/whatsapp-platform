const path = require('path');
// Charger les variables d'environnement depuis le fichier .env de l'API
require('dotenv').config({ path: path.join(__dirname, '../.env') });

const fs = require('fs');
const { parse } = require('csv-parse');
const { query } = require('../src/config/database');
const logger = require('../src/utils/logger');

const INCOMING_DIR = '/var/socadel/incoming';
const ARCHIVE_DIR = '/var/socadel/archive';
const LOG_FILE = '/var/log/socadel-import.log';

// Fonction de log personnalisée (console + fichier)
function log(msg) {
  const timestamp = new Date().toISOString();
  const line = `[${timestamp}] ${msg}`;
  console.log(line);
  try {
    fs.appendFileSync(LOG_FILE, line + '\n', { flag: 'a' });
  } catch (e) {
    // Fallback si écriture fichier impossible
  }
}

async function processFiles() {
  if (!fs.existsSync(INCOMING_DIR)) {
    log(`⚠️ Dossier ${INCOMING_DIR} inexistant`);
    return;
  }

  // Créer le dossier d'archive s'il n'existe pas
  if (!fs.existsSync(ARCHIVE_DIR)) {
    fs.mkdirSync(ARCHIVE_DIR, { recursive: true });
  }

  const files = fs.readdirSync(INCOMING_DIR).filter(f => f.endsWith('.csv'));

  if (files.length === 0) {
    return;
  }

  for (const file of files) {
    const filePath = path.join(INCOMING_DIR, file);
    const stats = fs.statSync(filePath);

    // Ignorer les fichiers vides (taille = 0)
    if (stats.size === 0) {
      log(`⚠️ Fichier vide ignoré : ${file}`);
      continue;
    }

    log(`📥 Traitement de : ${file} (${(stats.size / 1024).toFixed(1)} Ko)`);

    try {
      const parser = fs.createReadStream(filePath).pipe(
        parse({
          columns: true,
          delimiter: ';',
          trim: true,
          bom: true, // 👈 SUPPRIME AUTOMATIQUEMENT LE BOM UTF-8 (\xEF\xBB\xBF) DE EXCEL/PHP
          skip_empty_lines: true,
          relax_quotes: true,
          relax_column_count: true
        })
      );

      let insertedCount = 0;

      // Déterminer le type selon le nom du fichier
      const isFactures = file.startsWith('factures_jour_mysql');
      const isClients = file.startsWith('clients_actifs_oracle');

      if (!isFactures && !isClients) {
        log(`⚠️ Fichier non reconnu (ignoré) : ${file}`);
        archiveFile(filePath, file);
        continue;
      }

      // Traiter ligne par ligne
      for await (const record of parser) {
        if (isFactures) {
          // Extraction robuste des champs (prend en compte d'éventuelles clés alternatives)
          const numero_facture = record.numero_facture || record.num_facture || record.facture_number;
          const numero_contrat = record.numero_contrat || record.contrat || record.SERVICE_NO;
          const montant = record.montant;
          const lien_pdf = record.lien_pdf;
          const date_creation = record.date_creation || null;

          if (!numero_facture || !numero_contrat || !montant || !lien_pdf) {
            log(`⚠️ Ligne ignorée (champs manquants) : ${JSON.stringify(record)}`);
            continue;
          }

          // Insertion avec la date du CSV si elle existe, sinon NOW()
          await query(
            `INSERT INTO invoices_bot (numero_facture, numero_contrat, montant, lien_pdf, date_creation)
             VALUES ($1, $2, $3, $4, COALESCE($5::TIMESTAMP, NOW()))
             ON CONFLICT (numero_facture) DO NOTHING`,
            [numero_facture, numero_contrat, montant, lien_pdf, date_creation]
          );
          insertedCount++;

        } else if (isClients) {
          const contract = record.SERVICE_NO || record.contract_number || record.contrat;
          const name = record.NAMES || record.client_name || record.nom;

          if (!contract || !name) {
            log(`⚠️ Ligne ignorée (contrat ou nom manquant) : ${JSON.stringify(record)}`);
            continue;
          }

          await query(
            `INSERT INTO contracts (contract_number, client_name)
             VALUES ($1, $2)
             ON CONFLICT (contract_number) DO NOTHING`,
            [contract, name]
          );
          insertedCount++;
        }
      }

      log(`✅ ${insertedCount} lignes insérées depuis ${file}`);

      // Archiver le fichier après traitement réussi
      archiveFile(filePath, file);

    } catch (err) {
      log(`❌ Erreur sur ${file} : ${err.message}`);
      const errorDir = path.join(INCOMING_DIR, 'error');
      if (!fs.existsSync(errorDir)) fs.mkdirSync(errorDir, { recursive: true });
      fs.renameSync(filePath, path.join(errorDir, file));
      log(`📁 Fichier déplacé dans ${errorDir}`);
    }
  }
}

function archiveFile(filePath, fileName) {
  const timestamp = Date.now();
  const archivePath = path.join(ARCHIVE_DIR, `${fileName}.${timestamp}`);
  fs.renameSync(filePath, archivePath);
  log(`📁 Fichier archivé : ${archivePath}`);
}

// Exécution si appelé directement
if (require.main === module) {
  processFiles()
    .then(() => process.exit(0))
    .catch((err) => {
      log(`💥 Erreur fatale : ${err.message}`);
      process.exit(1);
    });
}

module.exports = { processFiles };
