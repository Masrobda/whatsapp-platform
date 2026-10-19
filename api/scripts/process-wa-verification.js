// api/scripts/process-wa-verification.js
// Traite les données de vérification WhatsApp du service externe.
//
// Formats supportés :
//   A) Column1,Column2                    → phone,status
//   B) Column1,Column2,Column3            → phone,status,contract_number  ⭐ préféré
//
// Usage :
//   node scripts/process-wa-verification.js /chemin/vers/fichier.csv   ← import + traitement
//   WA_VERIFY_SKIP_IMPORT=1 node scripts/process-wa-verification.js    ← traitement seul
//   WA_VERIFY_DRY_RUN=1    node scripts/process-wa-verification.js /fichier.csv   ← simulation
'use strict';

require('dotenv').config();

const fs = require('fs');
const readline = require('readline');
const { query } = require('../src/config/database');
const { redis } = require('../src/config/redis');
const logger = require('../src/utils/logger');

// ═══════════════════════════════════════════════════════════════
// CONFIG
// ═══════════════════════════════════════════════════════════════
const CONFIG = {
  CSV_PATH:      process.argv[2] || process.env.WA_VERIFY_CSV || null,
  BATCH_SIZE:    parseInt(process.env.WA_VERIFY_BATCH || '500', 10),
  CHUNK_INSERT:  parseInt(process.env.WA_VERIFY_CHUNK || '1000', 10),
  DRY_RUN:       process.env.WA_VERIFY_DRY_RUN === '1',
  SKIP_IMPORT:   process.env.WA_VERIFY_SKIP_IMPORT === '1',
  MAX_CONTRACTS_PER_PHONE: 20,
};

// ═══════════════════════════════════════════════════════════════
// UTILS
// ═══════════════════════════════════════════════════════════════
function normalizePhone(p) {
  if (!p) return null;
  const digits = String(p).replace(/\D/g, '');
  if (digits.length === 9) return `+237${digits}`;
  if (digits.length === 12 && digits.startsWith('237')) return `+${digits}`;
  if (digits.length === 13 && digits.startsWith('237')) return `+${digits}`;
  return p.startsWith('+') ? p : `+${digits}`;
}

function digitsOf(p) {
  return String(p || '').replace(/\D/g, '');
}

function log(...args) {
  console.log(...args);
}

// ═══════════════════════════════════════════════════════════════
// ÉTAPE 1 — IMPORT CSV → STAGING
// ═══════════════════════════════════════════════════════════════
async function importCsv(csvPath) {
  if (!csvPath) return 0;
  if (!fs.existsSync(csvPath)) {
    throw new Error(`Fichier CSV introuvable : ${csvPath}`);
  }

  log(`📥 Import du CSV : ${csvPath}`);

  const rl = readline.createInterface({
    input: fs.createReadStream(csvPath),
    crlfDelay: Infinity,
  });

  let lineNum = 0;
  let parsed = 0;
  let inserted = 0;
  let skipped = 0;
  let withContract = 0;
  let buffer = [];

  for await (const line of rl) {
    lineNum++;

    if (!line.trim()) continue;

    // Ignore entête
    if (lineNum === 1 && /column|phone|numero|numéro|statut|status|contract/i.test(line)) {
      continue;
    }

    // Supporte séparateur : virgule, point-virgule, tabulation
    const parts = line.split(/[;,\t]/).map((s) => s.trim());
    if (parts.length < 2) { skipped++; continue; }

    const phone = normalizePhone(parts[0]);
    const status = String(parts[1]).toLowerCase().trim();
    // 3ᵉ colonne optionnelle : contract_number
    const contractNumber = parts[2] ? String(parts[2]).trim() : null;

    if (!phone || !['valid', 'invalid'].includes(status)) {
      skipped++;
      continue;
    }

    parsed++;
    if (contractNumber) withContract++;

    buffer.push({
      phone,
      status,
      contract_number: contractNumber || null,
    });

    if (buffer.length >= CONFIG.CHUNK_INSERT) {
      const n = await insertChunk(buffer);
      inserted += n;
      buffer = [];
      process.stdout.write(`\r  → ${inserted} insérés / ${parsed} parsés`);
    }
  }

  if (buffer.length) {
    const n = await insertChunk(buffer);
    inserted += n;
  }

  log(`\n  ✅ ${inserted} lignes importées (${skipped} ignorées)`);
  log(`     dont ${withContract} avec n° de contrat`);
  return inserted;
}

async function insertChunk(rows) {
  const values = [];
  const placeholders = rows.map((r, i) => {
    const b = i * 3;
    values.push(r.phone, r.status, r.contract_number);
    return `($${b + 1}, $${b + 2}, $${b + 3})`;
  });

  const res = await query(
    `INSERT INTO whatsapp_verification_imports (phone, status, contract_number)
     VALUES ${placeholders.join(',')}
     RETURNING id`,
    values
  );
  return res.rowCount;
}

// ═══════════════════════════════════════════════════════════════
// REQUÊTES DE MATCHING
// ═══════════════════════════════════════════════════════════════

/**
 * ⭐ NEW : match DIRECT par contract_number (colonne 3 du CSV)
 *    Utilise la table socadel_contacts pour récupérer les autres infos.
 */
async function findDirectByContract(contractNumbers) {
  const list = contractNumbers.filter(Boolean);
  if (!list.length) return [];

  const res = await query(
    `SELECT DISTINCT ON (service_no)
       service_no,
       noms,
       numero_telephone,
       check_status,
       statut
     FROM socadel_contacts
     WHERE service_no = ANY($1::text[])`,
    [list]
  );

  return res.rows;
}

/** Recherche classique par phone dans socadel_contacts */
async function findDirectValid(phones) {
  if (!phones.length) return [];
  const res = await query(
    `SELECT DISTINCT ON (service_no)
       service_no, noms, numero_telephone
     FROM socadel_contacts
     WHERE check_status = 'OK'
       AND statut = 'NON ABONNE'
       AND regexp_replace(COALESCE(numero_telephone, ''), '[^0-9]', '', 'g')
           = ANY(
             SELECT regexp_replace(v, '[^0-9]', '', 'g')
             FROM unnest($1::text[]) AS v
           )`,
    [phones]
  );
  return res.rows;
}

async function findDirectInvalid(phones) {
  if (!phones.length) return [];
  const res = await query(
    `SELECT DISTINCT ON (service_no)
       service_no, numero_telephone
     FROM socadel_contacts
     WHERE check_status = 'OK'
       AND statut = 'NON ABONNE'
       AND regexp_replace(COALESCE(numero_telephone, ''), '[^0-9]', '', 'g')
           = ANY(
             SELECT regexp_replace(v, '[^0-9]', '', 'g')
             FROM unnest($1::text[]) AS v
           )`,
    [phones]
  );
  return res.rows;
}

async function findDeepCpr(phones) {
  if (!phones.length) return [];
  const res = await query(
    `SELECT DISTINCT ON (cpr.contract_number)
       cpr.contract_number AS service_no,
       COALESCE(sc.noms, wvc.client_name, c.client_name, 'Client') AS noms,
       cpr.phone AS numero_telephone
     FROM client_phone_registry cpr
     LEFT JOIN socadel_contacts sc
       ON sc.service_no = cpr.contract_number
     LEFT JOIN whatsapp_valid_contacts wvc
       ON wvc.contract_number = cpr.contract_number
     LEFT JOIN contracts c
       ON c.contract_number = cpr.contract_number
     WHERE regexp_replace(COALESCE(cpr.phone, ''), '[^0-9]', '', 'g')
           = ANY(
             SELECT regexp_replace(v, '[^0-9]', '', 'g')
             FROM unnest($1::text[]) AS v
           )`,
    [phones]
  );
  return res.rows;
}

async function findDeepWcp(phones) {
  if (!phones.length) return [];
  const res = await query(
    `SELECT DISTINCT ON (wcp.contract_number)
       wcp.contract_number AS service_no,
       COALESCE(sc.noms, wvc.client_name, c.client_name, 'Client') AS noms,
       wcp.whatsapp_phone AS numero_telephone
     FROM whatsapp_contact_phones wcp
     LEFT JOIN socadel_contacts sc
       ON sc.service_no = wcp.contract_number
     LEFT JOIN whatsapp_valid_contacts wvc
       ON wvc.contract_number = wcp.contract_number
     LEFT JOIN contracts c
       ON c.contract_number = wcp.contract_number
     WHERE regexp_replace(COALESCE(wcp.whatsapp_phone, ''), '[^0-9]', '', 'g')
           = ANY(
             SELECT regexp_replace(v, '[^0-9]', '', 'g')
             FROM unnest($1::text[]) AS v
           )`,
    [phones]
  );
  return res.rows;
}

// ═══════════════════════════════════════════════════════════════
// TRAITEMENT D'UN BATCH VALID
// ═══════════════════════════════════════════════════════════════
async function handleValidBatch(validRows) {
  const phones = validRows.map((r) => r.phone);
  const contractsFromCsv = validRows
    .map((r) => r.contract_number)
    .filter(Boolean);

  const matchedPhones = new Set();
  const matchedContracts = new Set();
  let validCount = 0;
  let errorCount = 0;

  // ⭐ MATCH 0 : par contract_number direct (colonne 3 du CSV)
  if (contractsFromCsv.length) {
    const byContract = await findDirectByContract(contractsFromCsv);
    for (const c of byContract) {
      try {
        // On utilise le phone RÉEL du CSV (colonne 1) comme numéro WhatsApp
        const csvRow = validRows.find(
          (r) => r.contract_number === c.service_no
        );
        const phoneToUse = csvRow?.phone || c.numero_telephone;

        await markAsWhatsApp({
          contract_number: c.service_no,
          phone: phoneToUse,
          noms: c.noms,
          match_type: 'by_contract',
        });
        matchedPhones.add(digitsOf(phoneToUse));
        matchedContracts.add(c.service_no);
        validCount++;
      } catch (e) {
        errorCount++;
        logger.error(`[WA-VERIFY] valid by_contract ${c.service_no}: ${e.message}`);
      }
    }
  }

  // ── MATCH 1 : direct par phone (uniquement ceux pas encore matchés)
  const afterContract = phones.filter(
    (p) => !matchedPhones.has(digitsOf(p))
  );
  const directRes = await findDirectValid(afterContract);
  for (const c of directRes) {
    if (matchedContracts.has(c.service_no)) continue;
    try {
      await markAsWhatsApp({
        contract_number: c.service_no,
        phone: c.numero_telephone,
        noms: c.noms,
        match_type: 'direct',
      });
      matchedPhones.add(digitsOf(c.numero_telephone));
      matchedContracts.add(c.service_no);
      validCount++;
    } catch (e) {
      errorCount++;
      logger.error(`[WA-VERIFY] valid direct ${c.service_no}: ${e.message}`);
    }
  }

  // ── MATCH 2 : deep CPR
  const afterDirect = phones.filter((p) => !matchedPhones.has(digitsOf(p)));
  const deepRes = await findDeepCpr(afterDirect);
  for (const c of deepRes) {
    if (matchedContracts.has(c.service_no)) continue;
    try {
      await markAsWhatsApp({
        contract_number: c.service_no,
        phone: c.numero_telephone,
        noms: c.noms,
        match_type: 'deep_cpr',
      });
      matchedPhones.add(digitsOf(c.numero_telephone));
      matchedContracts.add(c.service_no);
      validCount++;
    } catch (e) {
      errorCount++;
      logger.error(`[WA-VERIFY] valid deep_cpr ${c.service_no}: ${e.message}`);
    }
  }

  // ── MATCH 3 : deep WCP
  const afterDeep = phones.filter((p) => !matchedPhones.has(digitsOf(p)));
  const wcpRes = await findDeepWcp(afterDeep);
  for (const c of wcpRes) {
    if (matchedContracts.has(c.service_no)) continue;
    try {
      await markAsWhatsApp({
        contract_number: c.service_no,
        phone: c.numero_telephone,
        noms: c.noms,
        match_type: 'deep_wcp',
      });
      matchedPhones.add(digitsOf(c.numero_telephone));
      matchedContracts.add(c.service_no);
      validCount++;
    } catch (e) {
      errorCount++;
      logger.error(`[WA-VERIFY] valid deep_wcp ${c.service_no}: ${e.message}`);
    }
  }

  // ── Marquage staging
  const matchedIds = validRows
    .filter((r) => {
      // Matché si son contrat a matché, OU si son phone a matché
      if (r.contract_number && matchedContracts.has(r.contract_number)) return true;
      return matchedPhones.has(digitsOf(r.phone));
    })
    .map((r) => r.id);
  const ignoredIds = validRows
    .filter((r) => {
      if (r.contract_number && matchedContracts.has(r.contract_number)) return false;
      return !matchedPhones.has(digitsOf(r.phone));
    })
    .map((r) => r.id);

  if (matchedIds.length) {
    await query(
      `UPDATE whatsapp_verification_imports
       SET process_status = 'processed', processed_at = NOW()
       WHERE id = ANY($1::bigint[])`,
      [matchedIds]
    );
  }
  if (ignoredIds.length) {
    await query(
      `UPDATE whatsapp_verification_imports
       SET process_status = 'ignored',
           process_error  = 'no_matching_contract',
           processed_at   = NOW()
       WHERE id = ANY($1::bigint[])`,
      [ignoredIds]
    );
  }

  return { validCount, errorCount, ignoredCount: ignoredIds.length };
}

// ═══════════════════════════════════════════════════════════════
// TRAITEMENT D'UN BATCH INVALID
// ═══════════════════════════════════════════════════════════════
async function handleInvalidBatch(invalidRows) {
  const phones = invalidRows.map((r) => r.phone);
  const contractsFromCsv = invalidRows
    .map((r) => r.contract_number)
    .filter(Boolean);

  const matchedPhones = new Set();
  const matchedContracts = new Set();
  let invalidCount = 0;
  let errorCount = 0;

  // ⭐ MATCH 0 : par contract_number direct
  if (contractsFromCsv.length) {
    const byContract = await findDirectByContract(contractsFromCsv);
    for (const c of byContract) {
      try {
        const csvRow = invalidRows.find(
          (r) => r.contract_number === c.service_no
        );
        const phoneToUse = csvRow?.phone || c.numero_telephone;

        await markAsInvalid({
          phone: phoneToUse,
          contract_number: c.service_no,
          reason: 'external_check:by_contract',
        });
        matchedPhones.add(digitsOf(phoneToUse));
        matchedContracts.add(c.service_no);
        invalidCount++;
      } catch (e) {
        errorCount++;
      }
    }
  }

  // ── MATCH 1 : direct par phone
  const afterContract = phones.filter(
    (p) => !matchedPhones.has(digitsOf(p))
  );
  const directRes = await findDirectInvalid(afterContract);
  for (const c of directRes) {
    if (matchedContracts.has(c.service_no)) continue;
    try {
      await markAsInvalid({
        phone: c.numero_telephone,
        contract_number: c.service_no,
        reason: 'external_check:direct',
      });
      matchedPhones.add(digitsOf(c.numero_telephone));
      matchedContracts.add(c.service_no);
      invalidCount++;
    } catch (e) {
      errorCount++;
    }
  }

  // ── MATCH 2 : deep CPR
  const afterDirect = phones.filter((p) => !matchedPhones.has(digitsOf(p)));
  const deepRes = await findDeepCpr(afterDirect);
  for (const c of deepRes) {
    if (matchedContracts.has(c.service_no)) continue;
    try {
      await markAsInvalid({
        phone: c.numero_telephone,
        contract_number: c.service_no,
        reason: 'external_check:deep_cpr',
      });
      matchedPhones.add(digitsOf(c.numero_telephone));
      matchedContracts.add(c.service_no);
      invalidCount++;
    } catch (e) {
      errorCount++;
    }
  }

  // ── Marquage staging
  const matchedIds = invalidRows
    .filter((r) => {
      if (r.contract_number && matchedContracts.has(r.contract_number)) return true;
      return matchedPhones.has(digitsOf(r.phone));
    })
    .map((r) => r.id);
  const ignoredIds = invalidRows
    .filter((r) => {
      if (r.contract_number && matchedContracts.has(r.contract_number)) return false;
      return !matchedPhones.has(digitsOf(r.phone));
    })
    .map((r) => r.id);

  if (matchedIds.length) {
    await query(
      `UPDATE whatsapp_verification_imports
       SET process_status = 'processed', processed_at = NOW()
       WHERE id = ANY($1::bigint[])`,
      [matchedIds]
    );
  }
  if (ignoredIds.length) {
    await query(
      `UPDATE whatsapp_verification_imports
       SET process_status = 'ignored',
           process_error  = 'no_matching_contract',
           processed_at   = NOW()
       WHERE id = ANY($1::bigint[])`,
      [ignoredIds]
    );
  }

  return { invalidCount, errorCount, ignoredCount: ignoredIds.length };
}

// ═══════════════════════════════════════════════════════════════
// ÉTAPE 2 — TRAITEMENT DES LIGNES EN ATTENTE
// ═══════════════════════════════════════════════════════════════
async function processStaging() {
  log('\n⚙️  Traitement des imports en attente...');

  let total = 0;
  let valid = 0;
  let invalid = 0;
  let ignored = 0;
  let errors = 0;
  let iteration = 0;

  while (true) {
    iteration++;

    const batch = await query(
      `SELECT id, phone, status, contract_number
       FROM whatsapp_verification_imports
       WHERE process_status = 'pending'
       ORDER BY id
       LIMIT $1`,
      [CONFIG.BATCH_SIZE]
    );

    if (!batch.rows.length) break;

    const ids = batch.rows.map((r) => r.id);
    total += batch.rows.length;

    const validRows   = batch.rows.filter((r) => r.status === 'valid');
    const invalidRows = batch.rows.filter((r) => r.status === 'invalid');

    if (!CONFIG.DRY_RUN) {
      if (validRows.length) {
        const r = await handleValidBatch(validRows);
        valid   += r.validCount;
        errors  += r.errorCount;
        ignored += r.ignoredCount;
      }

      if (invalidRows.length) {
        const r = await handleInvalidBatch(invalidRows);
        invalid += r.invalidCount;
        errors  += r.errorCount;
        ignored += r.ignoredCount;
      }
    } else {
      valid   += validRows.length;
      invalid += invalidRows.length;
      await query(
        `UPDATE whatsapp_verification_imports
         SET process_status = 'processed', processed_at = NOW()
         WHERE id = ANY($1::bigint[])`,
        [ids]
      );
    }

    process.stdout.write(
      `\r  → ${total} traités · ✅ ${valid} · ❌ ${invalid} · ⏭  ${ignored} · ⚠️  ${errors}`
    );
  }

  console.log('');
  log(
    `\n  ✅ ${total} lignes · ${valid} valides · ${invalid} invalides · ${ignored} ignorés · ${errors} erreurs`
  );
  return { total, processed: total, valid, invalid, ignored, errors };
}

// ═══════════════════════════════════════════════════════════════
// MISE À JOUR EN BASE
// ═══════════════════════════════════════════════════════════════
async function markAsWhatsApp({ contract_number, phone, noms, match_type = 'direct' }) {
  const clientName = (noms || 'Client').trim() || 'Client';

  await query(
    `INSERT INTO contracts (contract_number, client_name)
     VALUES ($1, $2)
     ON CONFLICT (contract_number) DO NOTHING`,
    [contract_number, clientName]
  );

  await query(
    `INSERT INTO whatsapp_valid_contacts
       (contract_number, client_name, whatsapp_phone, activated_at)
     VALUES ($1, $2, $3, NOW())
     ON CONFLICT (contract_number) DO UPDATE
       SET whatsapp_phone = EXCLUDED.whatsapp_phone,
           updated_at     = NOW()`,
    [contract_number, clientName, phone]
  );

  await query(
    `INSERT INTO whatsapp_contact_phones
       (contract_number, whatsapp_phone, source, is_primary, collected_by_type)
     VALUES ($1, $2, 'external_wa_check', false, 'system')
     ON CONFLICT (contract_number, whatsapp_phone) DO NOTHING`,
    [contract_number, phone]
  ).catch(() => {});

  await query(
    `UPDATE socadel_contacts
     SET statut       = 'ABONNE',
         api_status   = 'OK',
         api_date     = CASE
                          WHEN api_status = 'OK' AND api_date IS NOT NULL THEN api_date
                          ELSE NOW()
                        END,
         activated_at = COALESCE(activated_at, NOW()),
         updated_at   = NOW()
     WHERE service_no = $1`,
    [contract_number]
  );

  await query(
    `DELETE FROM socadel_invoice_retry_queue
     WHERE contract_number = $1
       AND status IN ('pending', 'processing')`,
    [contract_number]
  ).catch(() => {});

  try {
    const keys = await redis.keys('socadel:stats*');
    if (keys.length) await redis.del(...keys);
  } catch (_) {}

  console.log(` [${match_type}] ✅ ${contract_number} · ${phone}`);
}

async function markAsInvalid({ phone, contract_number, reason }) {
  await query(
    `INSERT INTO whatsapp_invalid_contacts
       (phone, contract_number, reason, checked_by, checked_at)
     VALUES ($1, $2, $3, 'external_check', NOW())
     ON CONFLICT (phone) DO UPDATE
       SET reason     = EXCLUDED.reason,
           checked_at = NOW()`,
    [phone, contract_number, reason || 'not_whatsapp']
  );

  await query(
    `UPDATE socadel_invoice_pending
     SET status     = 'failed',
         failed_at  = COALESCE(failed_at, NOW()),
         last_error = COALESCE($2, 'Numéro non WhatsApp (vérifié)'),
         updated_at = NOW()
     WHERE contract_number = $1
       AND status IN ('sent', 'pending')`,
    [contract_number, reason || 'Numéro non WhatsApp (vérifié)']
  ).catch(() => {});

  await query(
    `DELETE FROM socadel_invoice_retry_queue
     WHERE contract_number = $1
       AND status IN ('pending', 'processing')`,
    [contract_number]
  ).catch(() => {});

  try {
    const keys = await redis.keys('socadel:stats*');
    if (keys.length) await redis.del(...keys);
  } catch (_) {}
}

// ═══════════════════════════════════════════════════════════════
// RUN
// ═══════════════════════════════════════════════════════════════
async function run() {
  const t0 = Date.now();

  log('═══════════════════════════════════════════════════════');
  log('  Vérification WhatsApp — traitement import externe');
  log('═══════════════════════════════════════════════════════');
  log(`Mode         : ${CONFIG.DRY_RUN ? '🧪 DRY-RUN' : '🔴 LIVE'}`);
  log(`CSV          : ${CONFIG.CSV_PATH || '(aucun)'}`);
  log(`Skip import  : ${CONFIG.SKIP_IMPORT}`);
  log('');

  try {
    if (!CONFIG.SKIP_IMPORT && CONFIG.CSV_PATH) {
      await importCsv(CONFIG.CSV_PATH);
    } else if (CONFIG.SKIP_IMPORT) {
      log('⏭  Import sauté (WA_VERIFY_SKIP_IMPORT=1)');
    } else {
      log('⚠️  Aucun CSV fourni → traitement des imports en attente uniquement');
    }

    const result = await processStaging();

    const remaining = await query(
      `SELECT
         COUNT(*) FILTER (WHERE process_status = 'pending')   AS pending,
         COUNT(*) FILTER (WHERE process_status = 'processed') AS processed,
         COUNT(*) FILTER (WHERE process_status = 'ignored')   AS ignored,
         COUNT(*) FILTER (WHERE process_status = 'error')     AS errors
       FROM whatsapp_verification_imports`
    );

    const dt = ((Date.now() - t0) / 1000).toFixed(1);
    log('\n═══════════════════════════════════════════════════════');
    log('  RÉSULTAT');
    log('═══════════════════════════════════════════════════════');
    log(`  Traités     : ${result.processed}`);
    log(`  ✅ Valides   : ${result.valid}`);
    log(`  ❌ Invalides : ${result.invalid}`);
    log(`  ⏭  Ignorés   : ${result.ignored}`);
    log(`  ⚠️  Erreurs   : ${result.errors}`);
    log(`  Durée       : ${dt}s`);
    log('');
    log('  État global de la table de staging :');
    log(`    pending   : ${remaining.rows[0].pending}`);
    log(`    processed : ${remaining.rows[0].processed}`);
    log(`    ignored   : ${remaining.rows[0].ignored}`);
    log(`    errors    : ${remaining.rows[0].errors}`);
    log('═══════════════════════════════════════════════════════');

    process.exit(0);
  } catch (err) {
    console.error('💥 ERREUR FATALE:', err);
    process.exit(1);
  }
}

run();
