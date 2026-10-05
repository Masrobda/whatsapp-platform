const { query } = require('../config/database');
const { v4: uuidv4 } = require('uuid');
const path = require('path');
const fs = require('fs');
const { spawn } = require('child_process');
const logger = require('../utils/logger');

const REPORTS_DIR = process.env.REPORTS_DIR || '/tmp/reports';
const REPORTS_URL_BASE = process.env.REPORTS_URL_BASE || 'https://api.numericexport.com/reports';

if (!fs.existsSync(REPORTS_DIR)) fs.mkdirSync(REPORTS_DIR, { recursive: true });

async function generateCampaignPDF(campaignId, clientId, userId, options = {}) {
  const exportId = uuidv4();
  try {
    logger.info(`[EXPORT CREATE] Campagne ${campaignId}, exportId=${exportId}`);
    await query(
      `INSERT INTO campaign_exports
         (id, client_id, campaign_id, export_type, status, filters, requested_by)
       VALUES ($1, $2, $3, 'pdf', 'pending', $4, NULL)`,
      [exportId, clientId, campaignId, JSON.stringify(options || {})]
    );

    setImmediate(() => {
      generatePDFAsync(exportId, campaignId, clientId, options)
        .catch(async (err) => {
          logger.error(`❌ CRASH generatePDFAsync ${exportId}:`, err.message);
          await query(
            `UPDATE campaign_exports SET status = 'failed', error_message = $1 WHERE id = $2`,
            [err.message.substring(0, 500), exportId]
          );
        });
    });

    return { success: true, exportId, status: 'pending', message: 'Génération en cours...' };
  } catch (error) {
    logger.error('❌ Erreur création export:', error);
    throw error;
  }
}

async function generatePDFAsync(exportId, campaignId, clientId, options) {
  const startTime = Date.now();
  try {
    logger.info(`[REPORT START] ${exportId} - Campagne ${campaignId}`);
    await query(`UPDATE campaign_exports SET status = 'processing', started_at = NOW() WHERE id = $1`, [exportId]);

    const [campaignRes, contactsRes, dailyRes] = await Promise.all([
      query(`SELECT * FROM campaigns WHERE id = $1`, [campaignId]),
      query(`SELECT phone_number, name, status, sent_at, delivered_at, read_at, failed_at
             FROM campaign_contacts WHERE campaign_id = $1 LIMIT 300`, [campaignId]),
      query(`SELECT stat_date, sent, delivered, read, failed
             FROM campaign_stats_daily WHERE campaign_id = $1 ORDER BY stat_date DESC LIMIT 30`, [campaignId])
    ]);

    if (!campaignRes.rows[0]) throw new Error(`Campagne ${campaignId} non trouvée`);

    const reportData = {
      campaign: campaignRes.rows[0],
      contacts: contactsRes.rows,
      daily_stats: dailyRes.rows.reverse(),
      exported_by: 'Client',
      generated_at: new Date().toISOString()
    };

    const filename = `campaign_${campaignId.substring(0,8)}_${Date.now()}.pdf`;
    const outputPath = path.join(REPORTS_DIR, filename);
    const wrapperPath = '/var/www/numericexport/api/report_wrapper.sh';

    if (!fs.existsSync(wrapperPath)) throw new Error(`Wrapper introuvable: ${wrapperPath}`);

    const pythonProcess = spawn(wrapperPath, ['--output', outputPath], {
      env: { ...process.env, PATH: '/usr/local/sbin:/usr/local/bin:/usr/sbin:/usr/bin:/sbin:/bin' }
    });

    let stdout = '', stderr = '';
    pythonProcess.stdout.on('data', (data) => { stdout += data.toString(); });
    pythonProcess.stderr.on('data', (data) => { stderr += data.toString(); });

    pythonProcess.stdin.write(JSON.stringify(reportData));
    pythonProcess.stdin.end();

    const exitCode = await new Promise((resolve) => {
      pythonProcess.on('close', resolve);
      pythonProcess.on('error', (err) => resolve(-1));
    });

    if (exitCode !== 0) {
      throw new Error(`Processus Python terminé avec code ${exitCode}\nstderr: ${stderr}\nstdout: ${stdout}`);
    }

    if (!fs.existsSync(outputPath)) throw new Error(`PDF non créé : ${outputPath}`);

    const stats = fs.statSync(outputPath);
    const fileUrl = `${REPORTS_URL_BASE}/${filename}`;

    await query(
      `UPDATE campaign_exports SET status = 'ready', file_url = $1, file_size = $2, completed_at = NOW() WHERE id = $3`,
      [fileUrl, stats.size, exportId]
    );

    logger.info(`✅ PDF GÉNÉRÉ : ${filename} (${stats.size} bytes) en ${Date.now() - startTime}ms`);
    return { success: true };
  } catch (err) {
    logger.error(`❌ ÉCHEC PDF ${exportId}:`, err.message);
    await query(
      `UPDATE campaign_exports SET status = 'failed', error_message = $1, completed_at = NOW() WHERE id = $2`,
      [err.message.substring(0, 800), exportId]
    );
    throw err;
  }
}

async function generateCampaignCSV(campaignId, clientId, filters = {}) {
  const { status, start_date, end_date } = filters;
  const campRes = await query(`SELECT name FROM campaigns WHERE id = $1 AND client_id = $2`, [campaignId, clientId]);
  if (!campRes.rows[0]) throw { statusCode: 404, message: 'Campagne non trouvée' };

  let where = 'WHERE campaign_id = $1';
  const params = [campaignId];
  let idx = 2;
  if (status) { where += ` AND status = $${idx++}`; params.push(status); }
  if (start_date) { where += ` AND created_at >= $${idx++}`; params.push(start_date); }
  if (end_date) { where += ` AND created_at <= $${idx++}`; params.push(end_date); }

  const res = await query(
    `SELECT phone_number, name, status, variables, queued_at, sent_at, delivered_at, read_at, failed_at, wa_message_id, error_message, skip_reason
     FROM campaign_contacts ${where} ORDER BY created_at ASC LIMIT 50000`, params
  );

  const headers = ['Téléphone', 'Nom', 'Statut', 'Variables', 'Mis en file', 'Envoyé', 'Livré', 'Lu', 'Échoué', 'ID Message WA', 'Erreur', 'Raison ignoré'];
  const fmt = (d) => d ? new Date(d).toLocaleString('fr-FR') : '';
  const csvEscape = (v) => `"${String(v || '').replace(/"/g, '""')}"`;

  const rows = res.rows.map(r => [
    r.phone_number, r.name || '', r.status, r.variables ? JSON.stringify(r.variables) : '',
    fmt(r.queued_at), fmt(r.sent_at), fmt(r.delivered_at), fmt(r.read_at), fmt(r.failed_at),
    r.wa_message_id || '', r.error_message || '', r.skip_reason || ''
  ]);

  const csv = [headers.map(csvEscape).join(','), ...rows.map(row => row.map(csvEscape).join(','))].join('\n');
  return { success: true, csv, filename: `campagne_${campRes.rows[0].name.replace(/\s+/g, '_')}_${Date.now()}.csv`, count: rows.length };
}

async function getExportStatus(exportId, clientId) {
  const res = await query(`SELECT * FROM campaign_exports WHERE id = $1 AND client_id = $2`, [exportId, clientId]);
  if (!res.rows[0]) throw { statusCode: 404, message: 'Export non trouvé' };
  return { success: true, export: res.rows[0] };
}

async function listExports(clientId, campaignId = null) {
  let where = 'WHERE client_id = $1';
  const params = [clientId];
  if (campaignId) { where += ' AND campaign_id = $2'; params.push(campaignId); }
  const res = await query(`SELECT * FROM campaign_exports ${where} ORDER BY created_at DESC LIMIT 20`, params);
  return { success: true, exports: res.rows };
}

function getReportFilePath(filename) {
  const safe = path.basename(filename);
  if (!safe.endsWith('.pdf') && !safe.endsWith('.csv')) throw { statusCode: 400, message: 'Type de fichier invalide' };
  const fullPath = path.join(REPORTS_DIR, safe);
  if (!fs.existsSync(fullPath)) throw { statusCode: 404, message: 'Fichier non trouvé ou expiré' };
  return fullPath;
}

module.exports = {
  generateCampaignPDF,
  generateCampaignCSV,
  getExportStatus,
  listExports,
  getReportFilePath
};
