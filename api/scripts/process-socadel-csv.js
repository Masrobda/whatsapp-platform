const fs = require('fs');
const path = require('path');
const { parse } = require('csv-parse');
const { query } = require('../src/config/database');

const INCOMING_DIR = '/var/socadel/incoming';
const ARCHIVE_DIR = '/var/socadel/archive';

async function processFiles() {
  if (!fs.existsSync(INCOMING_DIR)) return;

  const files = fs.readdirSync(INCOMING_DIR).filter(f => f.endsWith('.csv'));

  for (const file of files) {
    const filePath = path.join(INCOMING_DIR, file);
    
    // Ignorer les fichiers en cours de transfert
    const stats = fs.statSync(filePath);
    if (stats.size === 0) continue;

    console.log(`[SOCADEL] Traitement de : ${file}`);

    try {
      const parser = fs.createReadStream(filePath).pipe(
        parse({ columns: true, delimiter: ';', trim: true })
      );

      // Distinction du type de fichier
      if (file.startsWith('clients_actifs_oracle')) {
        for await (const record of parser) {
          await query(
            `INSERT INTO contracts (contract_number, client_name) 
             VALUES ($1, $2) 
             ON CONFLICT (contract_number) DO NOTHING`,
            [record.SERVICE_NO, record.NAMES]
          );
        }
        console.log(`[SOCADEL] ✅ Contrats importés depuis ${file}`);

      } else if (file.startsWith('factures_jour_mysql')) {
        for await (const record of parser) {
          await query(
            `INSERT INTO invoices_bot (contract_number, pdf_link, created_at) 
             VALUES ($1, $2, $3)`,
            [record.numero_contrat, record.lien_pdf, record.date_creation]
          );
        }
        console.log(`[SOCADEL] ✅ Factures importées depuis ${file}`);

      } else {
        console.log(`[SOCADEL] ⚠️ Fichier non reconnu ignoré : ${file}`);
        continue;
      }

      // Archiver le fichier une fois importé
      const archivePath = path.join(ARCHIVE_DIR, `${file}.${Date.now()}`);
      fs.renameSync(filePath, archivePath);
      console.log(`[SOCADEL] 📁 Fichier ${file} archivé.`);

    } catch (err) {
      console.error(`[SOCADEL] ❌ Erreur sur ${file}:`, err.message);
    }
  }
}

if (require.main === module) {
  processFiles().catch(console.error);
}
