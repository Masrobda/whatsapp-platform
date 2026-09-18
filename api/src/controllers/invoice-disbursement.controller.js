const { query } = require('../config/database');
const logger = require('../utils/logger');
const { PDFDocument, rgb, StandardFonts } = require('pdf-lib');
const QRCode = require('qrcode');
const fs = require('fs').promises;
const path = require('path');
const { consumeMessages } = require('./message-stock.controller');

async function getAllInvoiceDisbursements(request, reply) {
  try {
    const {
      page = 1,
      limit = 20,
      filter = 'all',
      order_id,
      client_id,
      start_date,
      end_date
    } = request.query;
    const offset = (page - 1) * limit;

    let sql = `

     SELECT
  i.id as invoice_id,
  i.invoice_number,
  i.total_amount as invoice_amount,
  i.status as invoice_status,
  i.invoice_type,
  i.created_at as invoice_created_at,
  i.pdf_path as invoice_pdf_path,
  i.qr_code_url,
  i.stamp_applied,
  o.id as order_id,
  o.order_code,
  o.quantity,
  o.total_amount as order_total_amount,
  o.status as order_status,
  o.selected_bsp_id,
  o.bsp_message_cost,
  o.estimated_purchase_cost,
  o.messages_to_purchase,
  o.financial_purpose,
  ds.id as disbursement_id,
  ds.slip_number as disbursement_slip_number,
  ds.amount as disbursement_amount,
  ds.purpose as disbursement_purpose,
  ds.messages_to_purchase as disbursement_messages,
  ds.purchase_cost as disbursement_purchase_cost,
  ds.status as disbursement_status,
  ds.receipt_path,
  ds.pdf_path as disbursement_pdf_path,
  ds.created_at as disbursement_created_at,
  ds.validated_at,
  ds.bsp_id as disbursement_bsp_id,
  bsp.name as bsp_name,
  bsp.message_cost as bsp_unit_cost,
  bsp.additional_charges as bsp_charges,
  bsp.id AS bsp_id_real,
  c.id as client_id,
  c.company_name,
  c.email as client_email
FROM invoices i
JOIN orders o ON i.order_id = o.id
JOIN clients c ON o.client_id = c.id
LEFT JOIN disbursement_slips ds ON o.id = ds.order_id
LEFT JOIN bsp_providers bsp ON o.selected_bsp_id = bsp.id
WHERE i.invoice_type = 'proforma'


    `;

    const whereConditions = [];
    const params = [];

    if (order_id) {
      whereConditions.push(`o.id = $${params.length + 1}`);
      params.push(order_id);
    }
    if (client_id) {
      whereConditions.push(`c.id = $${params.length + 1}`);
      params.push(client_id);
    }
    if (start_date) {
      whereConditions.push(`i.created_at >= $${params.length + 1}`);
      params.push(start_date);
    }
    if (end_date) {
      whereConditions.push(`i.created_at <= $${params.length + 1}`);
      params.push(end_date);
    }

    if (filter === 'pending') {
      whereConditions.push(`(ds.status IS NULL OR ds.status = 'pending')`);
    } else if (filter === 'with_receipts') {
      whereConditions.push(`ds.receipt_path IS NOT NULL`);
    } else if (filter === 'validated') {
      whereConditions.push(`ds.status IN ('approved', 'validated', 'disbursed')`);
    }

    if (whereConditions.length > 0) {
      sql += ` AND ${whereConditions.join(' AND ')}`;
    }

    const countSql = `
      SELECT COUNT(*) as total
      FROM invoices i
      JOIN orders o ON i.order_id = o.id
      JOIN clients c ON o.client_id = c.id
      LEFT JOIN disbursement_slips ds ON o.id = ds.order_id
      LEFT JOIN bsp_providers bsp ON o.selected_bsp_id = bsp.id
      WHERE i.invoice_type = 'proforma'
      ${whereConditions.length > 0 ? `AND ${whereConditions.join(' AND ')}` : ''}
    `;

    const countResult = await query(countSql, params);
    const total = parseInt(countResult.rows[0]?.total || 0);

    sql += ` ORDER BY i.created_at DESC LIMIT $${params.length + 1} OFFSET $${params.length + 2}`;
    const queryParams = [...params, limit, offset];

    const result = await query(sql, queryParams);

    const baseMediaUrl = process.env.MEDIA_BASE_URL || 'https://api.numericexport.com/media';
    const enriched = result.rows.map(row => {
      const getFileName = (filePath) => filePath ? filePath.split('/').pop() : null;
      return {
        ...row,
        invoice_pdf_url: row.invoice_pdf_path ? `${baseMediaUrl}/invoices/${getFileName(row.invoice_pdf_path)}` : null,
        disbursement_pdf_url: row.disbursement_pdf_path ? `${baseMediaUrl}/disbursements/${getFileName(row.disbursement_pdf_path)}` : null,
        receipt_url: row.receipt_path ? `${baseMediaUrl}/receipts/${getFileName(row.receipt_path)}` : null
      };
    });

    return reply.code(200).send({
      success: true,
      data: enriched,
      pagination: {
        page: Number(page),
        limit: Number(limit),
        total,
        totalPages: Math.ceil(total / limit)
      }
    });
  } catch (err) {
    console.error('❌ Erreur getAllInvoiceDisbursements:', err);
    return reply.code(500).send({ success: false, message: 'Erreur serveur' });
  }
}

async function getDisbursementDetails(request, reply) {
  try {
    const { id } = request.params;
    const result = await query(
      `SELECT
        ds.*,
        ds.messages_to_purchase,
        ds.purchase_cost,
        o.order_code,
        o.quantity as order_quantity,
        o.total_amount as order_amount,
        i.invoice_number,
        i.pdf_path as invoice_pdf_path,
        bsp.name as bsp_name,
        c.company_name,
        c.id as client_id,
        c.email as client_email
       FROM disbursement_slips ds
       JOIN orders o ON ds.order_id = o.id
       JOIN invoices i ON ds.invoice_id = i.id
       LEFT JOIN bsp_providers bsp ON ds.bsp_id = bsp.id
       JOIN clients c ON o.client_id = c.id
       WHERE ds.id = $1`,
      [id]
    );

    if (result.rowCount === 0) {
      return reply.code(404).send({ success: false, message: 'Décaissement non trouvé' });
    }

    const item = result.rows[0];
    const baseMedia = process.env.MEDIA_BASE_URL || 'https://api.numericexport.com/media';
    const getFileName = (filePath) => filePath ? filePath.split('/').pop() : null;

    return reply.send({
      success: true,
      data: {
        ...item,
        disbursement_pdf_url: item.pdf_path ? `${baseMedia}/disbursements/${getFileName(item.pdf_path)}` : null,
        receipt_url: item.receipt_path ? `${baseMedia}/receipts/${getFileName(item.receipt_path)}` : null
      }
    });
  } catch (err) {
    logger.error('Erreur getDisbursementDetails:', err);
    return reply.code(500).send({ success: false, message: 'Erreur serveur' });
  }
}

async function generateDisbursementSlip(request, reply) {
  try {
    const { orderId } = request.params;
    const { bsp_id, messages_to_purchase, purpose, purchase_cost = 0, notes = '' } = request.body;
    const userId = request.user.id;

    const orderRes = await query(
      `SELECT o.*, i.id as invoice_id, i.invoice_number
       FROM orders o
       JOIN invoices i ON o.id = i.order_id AND i.invoice_type = 'proforma'
       WHERE o.id = $1 AND o.status = 'invoice_generated'`,
      [orderId]
    );

    if (!orderRes.rowCount) {
      return reply.code(400).send({ success: false, message: 'Commande non prête' });
    }

    const order = orderRes.rows[0];
    const bspRes = await query('SELECT * FROM bsp_providers WHERE id = $1', [bsp_id]);
    if (!bspRes.rowCount) {
      return reply.code(400).send({ success: false, message: 'BSP non trouvé' });
    }
    const bsp = bspRes.rows[0];

    const existRes = await query('SELECT id FROM disbursement_slips WHERE order_id = $1', [orderId]);
    if (existRes.rowCount) {
      return reply.code(400).send({ success: false, message: 'Décaissement déjà créé' });
    }

    const now = new Date();
    const yearMonth = `${now.getFullYear()}${(now.getMonth() + 1).toString().padStart(2, '0')}`;
    const randomNum = Math.floor(Math.random() * 10000).toString().padStart(4, '0');
    const slipNumber = `DEC-${yearMonth}-${randomNum}`;

    const slipRes = await query(
      `INSERT INTO disbursement_slips (
        slip_number, order_id, invoice_id, bsp_id,
        amount, purpose, messages_to_purchase, purchase_cost,
        notes, status, created_by, created_at
      ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,'pending',$10,NOW())
      RETURNING id, slip_number, created_at`,
      [slipNumber, orderId, order.invoice_id, bsp_id, order.total_amount, purpose, messages_to_purchase || order.quantity, purchase_cost, notes, userId]
    );
    const slip = slipRes.rows[0];

    await query(
      `UPDATE orders
       SET selected_bsp_id = $1,
           messages_to_purchase = $2,
           estimated_purchase_cost = $3,
           financial_purpose = $4,
           updated_at = NOW()
       WHERE id = $5`,
      [bsp_id, messages_to_purchase || order.quantity, purchase_cost, purpose, orderId]
    );

    let pdfPath = null;
    let pdfRelativePath = null;
    try {
      pdfPath = await generateDisbursementPdf(slip, { ...order, bsp_name: bsp.name });
      pdfRelativePath = `disbursements/${path.basename(pdfPath)}`;
      await query('UPDATE disbursement_slips SET pdf_path = $1 WHERE id = $2', [pdfRelativePath, slip.id]);
    } catch (pdfErr) {
      console.error('PDF non généré (non bloquant):', pdfErr.message);
    }

    const baseMediaUrl = process.env.MEDIA_BASE_URL || 'https://api.numericexport.com/media';
    return reply.code(201).send({
      success: true,
      message: 'Fiche créée',
      data: {
        disbursement_id: slip.id,
        slip_number: slipNumber,
        pdf_path: pdfRelativePath,
        disbursement_pdf_url: pdfRelativePath ? `${baseMediaUrl}/${pdfRelativePath}` : null
      }
    });
  } catch (err) {
    console.error('❌ generateDisbursementSlip error:', err);
    return reply.code(500).send({ success: false, message: err.message });
  }
}

// Vérifier si un fichier existe
async function fileExists(path) {
  try {
    await fs.access(path);
    return true;
  } catch {
    return false;
  }
}

// Nettoyer le texte pour le PDF (enlever les caractères problématiques)
function cleanTextForPDF(text) {
  if (!text) return '';
  return String(text).replace(/[^\x20-\x7E\u00C0-\u00FF\u0152\u0153]/g, '');
}

// Générer une image QR code
async function generateQRCodeImage(url) {
  try {
    return await QRCode.toBuffer(url, { width: 200, margin: 1 });
  } catch (err) {
    logger.error('Erreur génération QR code:', err);
    return null;
  }
}

async function generateDisbursementPdf(slip, order) {
  try {
    logger.info('🚀 Génération fiche de décaissement professionnelle');

    // ── Répertoire de sortie ──
    const dir = process.env.DISBURSEMENTS_PATH || '/var/www/numericexport/media/disbursements';
    await fs.mkdir(dir, { recursive: true });
    const fileName = `${slip.slip_number}.pdf`;
    const fullPath = path.join(dir, fileName);

    // ── Document ──
    const pdfDoc = await PDFDocument.create();
    const page   = pdfDoc.addPage([595.28, 841.89]);
    const { width, height } = page.getSize();

    // ── Polices ──
    const fontBold   = await pdfDoc.embedFont(StandardFonts.HelveticaBold);
    const fontReg    = await pdfDoc.embedFont(StandardFonts.Helvetica);
    const fontItalic = await pdfDoc.embedFont(StandardFonts.HelveticaOblique);

    // ── Palette (charte officielle) ──
    const brandGreen     = rgb(26/255,  93/255,  26/255);
    const accentGreen    = rgb(15/255,  65/255,  15/255);
    const lightGreen     = rgb(224/255, 242/255, 233/255);
    const limeGreen      = rgb(139/255, 195/255, 74/255);
    const white          = rgb(1, 1, 1);
    const black          = rgb(0, 0, 0);
    const grayUltraLight = rgb(0.97, 0.97, 0.97);
    const grayLight      = rgb(0.93, 0.93, 0.93);
    const grayMedium     = rgb(0.55, 0.55, 0.55);
    const grayDark       = rgb(0.28, 0.28, 0.28);
    const borderGray     = rgb(0.83, 0.83, 0.83);
    const blueAccent     = rgb(25/255, 118/255, 210/255);

    const mL = 45;
    const mR = 45;
    const cW = width - mL - mR; // content width = 505.28

    // ════════════════════════════════════════════════════════════════════
    // BANDES DÉCORATIVES
    // ════════════════════════════════════════════════════════════════════
    page.drawRectangle({ x: 0, y: height - 8, width, height: 8, color: brandGreen });
    page.drawRectangle({ x: 0, y: 0,          width, height: 8, color: brandGreen });

    // ════════════════════════════════════════════════════════════════════
    // SECTION 1 — LOGO (gauche) + TITRE (droite), même niveau
    // ════════════════════════════════════════════════════════════════════
    const headerTopY = height - 18;

    // Logo
    const logoPath = '/var/www/numericexport/dashboard/public/logook2.png';
    try {
      if (await fileExists(logoPath)) {
        const logoBytes = await fs.readFile(logoPath);
        const logoImage = await pdfDoc.embedPng(logoBytes);
        page.drawImage(logoImage, {
          x: mL, y: headerTopY - 52,
          width: 120, height: 52
        });
      } else {
        page.drawRectangle({
          x: mL, y: headerTopY - 52,
          width: 120, height: 52,
          color: lightGreen, borderWidth: 2, borderColor: brandGreen
        });
        page.drawText('NEXT LTD', {
          x: mL + 20, y: headerTopY - 30,
          size: 14, font: fontBold, color: brandGreen
        });
      }
    } catch (e) { logger.error('Erreur logo:', e); }

    // Titre principal (droite)
    const titleX = width - mR - 240;
    page.drawText('FICHE DE DÉCAISSEMENT', {
      x: titleX, y: headerTopY - 8,
      size: 20, font: fontBold, color: accentGreen
    });

    // Ligne de soulignement
    const underlineY = headerTopY - 22;
    page.drawLine({
      start: { x: titleX, y: underlineY },
      end:   { x: width - mR, y: underlineY },
      thickness: 2, color: brandGreen
    });

    // ── Info box (N°, Date, Statut) — juste sous la ligne ──
    const ibW = 240;
    const ibH = 56;
    const ibTopY = underlineY - 2;

    page.drawRectangle({
      x: titleX, y: ibTopY - ibH,
      width: ibW, height: ibH,
      color: grayUltraLight, borderWidth: 1, borderColor: borderGray
    });

    const slipStatus = slip.status || 'EN ATTENTE';
    const infoItems = [
      { label: 'N° Fiche :',  value: slip.slip_number || '—' },
      { label: 'Date :',      value: new Date().toLocaleDateString('fr-FR', { day: '2-digit', month: 'long', year: 'numeric' }) },
      { label: 'Statut :',   value: slipStatus }
    ];
    infoItems.forEach((item, i) => {
      const lineY = ibTopY - 14 - i * 16;
      page.drawText(cleanTextForPDF(item.label), {
        x: titleX + 10, y: lineY,
        size: 9, font: fontBold, color: grayDark
      });
      // Valeur statut en couleur
      const valColor = item.label === 'Statut :' ? brandGreen : black;
      page.drawText(cleanTextForPDF(item.value), {
        x: titleX + 100, y: lineY,
        size: 9, font: item.label === 'Statut :' ? fontBold : fontReg,
        color: valColor
      });
    });

    const headerBottomY = ibTopY - ibH;

    // Séparateur
    const sep1Y = headerBottomY - 14;
    page.drawLine({
      start: { x: mL, y: sep1Y },
      end:   { x: width - mR, y: sep1Y },
      thickness: 1, color: borderGray
    });

    // ════════════════════════════════════════════════════════════════════
    // SECTION 2 — INFOS COMMANDE (gauche) + INFOS DÉCAISSEMENT (droite)
    // ════════════════════════════════════════════════════════════════════
    const colW  = cW * 0.47;
    const colGap = cW * 0.06;
    const colRX  = mL + colW + colGap;
    const scTopY = sep1Y - 14;

    // ── Barre INFORMATIONS COMMANDE ──
    page.drawRectangle({
      x: mL, y: scTopY - 20,
      width: colW, height: 20, color: brandGreen
    });
    page.drawText('INFORMATIONS COMMANDE', {
      x: mL + 8, y: scTopY - 14,
      size: 9, font: fontBold, color: white
    });

    // ── Barre INFORMATIONS DÉCAISSEMENT ──
    page.drawRectangle({
      x: colRX, y: scTopY - 20,
      width: colW, height: 20, color: brandGreen
    });
    page.drawText('INFORMATIONS DÉCAISSEMENT', {
      x: colRX + 8, y: scTopY - 14,
      size: 9, font: fontBold, color: white
    });

    // ── Lignes COMMANDE ──
    const orderLines = [
      { label: 'Référence :',       value: order.order_code   || 'N/A' },
      { label: 'Client :',          value: order.company_name || 'N/A' },
      { label: 'Montant facturé :', value: `${(order.total_amount || 0).toLocaleString('fr-FR')} FCFA` },
      { label: 'Quantité :',        value: `${(order.quantity || 0).toLocaleString('fr-FR')} messages` },
      { label: 'Date commande :',   value: order.created_at ? new Date(order.created_at).toLocaleDateString('fr-FR') : '—' }
    ];

    // ── Lignes DÉCAISSEMENT ──
    const disburseLines = [
      { label: 'BSP :',              value: order.bsp_name           || 'Non spécifié' },
      { label: 'Messages à acheter :', value: `${(slip.messages_to_purchase || order.quantity || 0).toLocaleString('fr-FR')}` },
      { label: 'Coût estimé :',     value: `${(slip.purchase_cost || 0).toLocaleString('fr-FR')} FCFA` },
      { label: 'Marge :',           value: slip.margin_amount ? `${(slip.margin_amount).toLocaleString('fr-FR')} FCFA` : '—' },
      { label: 'Responsable :',     value: slip.responsible_name || 'NEXT Team' }
    ];

    const rowLineH = 16;

    orderLines.forEach((item, i) => {
      const rowY   = scTopY - 20 - 14 - i * rowLineH;
      const isAlt  = i % 2 === 0;
      // alternance légère
      page.drawRectangle({
        x: mL, y: rowY - rowLineH + 3,
        width: colW, height: rowLineH,
        color: isAlt ? grayUltraLight : white
      });
      page.drawText(cleanTextForPDF(item.label), {
        x: mL + 8, y: rowY - 2,
        size: 9, font: fontBold, color: grayDark
      });
      page.drawText(cleanTextForPDF(item.value), {
        x: mL + 130, y: rowY - 2,
        size: 9, font: fontReg, color: black
      });
    });

    disburseLines.forEach((item, i) => {
      const rowY  = scTopY - 20 - 14 - i * rowLineH;
      const isAlt = i % 2 === 0;
      page.drawRectangle({
        x: colRX, y: rowY - rowLineH + 3,
        width: colW, height: rowLineH,
        color: isAlt ? grayUltraLight : white
      });
      page.drawText(cleanTextForPDF(item.label), {
        x: colRX + 8, y: rowY - 2,
        size: 9, font: fontBold, color: grayDark
      });
      page.drawText(cleanTextForPDF(item.value), {
        x: colRX + 140, y: rowY - 2,
        size: 9, font: fontReg, color: black
      });
    });

    const maxLines  = Math.max(orderLines.length, disburseLines.length);
    const scBottomY = scTopY - 20 - 14 - maxLines * rowLineH - 10;

    // Séparateur
    page.drawLine({
      start: { x: mL, y: scBottomY },
      end:   { x: width - mR, y: scBottomY },
      thickness: 0.5, color: borderGray
    });

    // ════════════════════════════════════════════════════════════════════
    // SECTION 3 — RÉCAPITULATIF FINANCIER (boîte centrée)
    // ════════════════════════════════════════════════════════════════════
    let currentY = scBottomY - 14;

    const finBoxW = cW * 0.55;
    const finBoxX = mL + (cW - finBoxW) / 2;
    const finRows = [
      { label: 'Montant reçu du client :',  value: `${(order.total_amount || 0).toLocaleString('fr-FR')} FCFA`, bold: false },
      { label: 'Coût d\'achat BSP :',        value: `${(slip.purchase_cost || 0).toLocaleString('fr-FR')} FCFA`, bold: false },
      { label: 'Marge nette :',             value: slip.margin_amount ? `${(slip.margin_amount).toLocaleString('fr-FR')} FCFA` : '—', bold: true }
    ];
    const finHdrH  = 22;
    const finRowH  = 22;
    const finBoxH  = finHdrH + finRows.length * finRowH + 8;

    // Titre du bloc
    page.drawRectangle({
      x: finBoxX, y: currentY - finHdrH,
      width: finBoxW, height: finHdrH, color: brandGreen
    });
    page.drawText('RÉCAPITULATIF FINANCIER', {
      x: finBoxX + finBoxW / 2 - 75, y: currentY - 15,
      size: 10, font: fontBold, color: white
    });

    // Lignes du récap
    finRows.forEach((row, i) => {
      const ry       = currentY - finHdrH - i * finRowH;
      const isLast   = i === finRows.length - 1;
      page.drawRectangle({
        x: finBoxX, y: ry - finRowH,
        width: finBoxW, height: finRowH,
        color: isLast ? lightGreen : (i % 2 === 0 ? grayUltraLight : white),
        borderWidth: 1, borderColor: borderGray
      });
      page.drawText(cleanTextForPDF(row.label), {
        x: finBoxX + 12, y: ry - 14,
        size: 9, font: fontBold, color: isLast ? accentGreen : grayDark
      });
      // Valeur alignée à droite
      const valW = (row.bold ? fontBold : fontReg).widthOfTextAtSize(row.value, isLast ? 11 : 10);
      page.drawText(cleanTextForPDF(row.value), {
        x: finBoxX + finBoxW - valW - 12, y: ry - 14,
        size: isLast ? 11 : 10,
        font: row.bold ? fontBold : fontReg,
        color: isLast ? brandGreen : black
      });
    });

    currentY -= finHdrH + finRows.length * finRowH + 18;

    // ════════════════════════════════════════════════════════════════════
    // SECTION 4 — BUT DU DÉCAISSEMENT (si renseigné)
    // ════════════════════════════════════════════════════════════════════
    if (slip.purpose) {
      // Séparateur
      page.drawLine({
        start: { x: mL, y: currentY },
        end:   { x: width - mR, y: currentY },
        thickness: 0.5, color: borderGray
      });
      currentY -= 12;

      // Barre titre
      page.drawRectangle({
        x: mL, y: currentY - 18,
        width: 160, height: 18, color: lightGreen
      });
      page.drawText('BUT DU DÉCAISSEMENT', {
        x: mL + 8, y: currentY - 13,
        size: 9, font: fontBold, color: brandGreen
      });
      currentY -= 28;

      const purposeLines = slip.purpose.split('\n');
      purposeLines.forEach((line, i) => {
        page.drawText(cleanTextForPDF(line), {
          x: mL + 10, y: currentY - i * 13,
          size: 9, font: fontReg, color: grayDark
        });
      });
      currentY -= purposeLines.length * 13 + 12;
    }

    // ════════════════════════════════════════════════════════════════════
    // SECTION 5 — VALIDATION : CONDITIONS (gauche) + TAMPON & QR (droite)
    // ════════════════════════════════════════════════════════════════════
    page.drawLine({
      start: { x: mL, y: currentY },
      end:   { x: width - mR, y: currentY },
      thickness: 0.5, color: borderGray
    });
    currentY -= 12;

    const condW  = cW * 0.50;
    const validX = mL + condW + 20;

    // ── En-têtes côte à côte ──
    page.drawRectangle({
      x: mL, y: currentY - 18,
      width: 170, height: 18, color: lightGreen
    });
    page.drawText('CONDITIONS D\'APPROBATION', {
      x: mL + 8, y: currentY - 13,
      size: 9, font: fontBold, color: brandGreen
    });

    page.drawRectangle({
      x: validX, y: currentY - 18,
      width: 100, height: 18, color: lightGreen
    });
    page.drawText('VALIDATION', {
      x: validX + 8, y: currentY - 13,
      size: 9, font: fontBold, color: brandGreen
    });

    currentY -= 26;

    // ── Conditions avec badges ──
    const condGroups = [
      {
        label: 'Autorisation',
        items: [
          'Validé par le Directeur Général',
          'Signature obligatoire avant exécution'
        ]
      },
      {
        label: 'Exécution',
        items: [
          `BSP destinataire : ${order.bsp_name || 'À définir'}`,
          'Virement ou espèces selon accord'
        ]
      },
      {
        label: 'Délai',
        items: ['Exécution sous 24h après validation']
      }
    ];

    let condY = currentY;
    condGroups.forEach(group => {
      const badgeW = fontBold.widthOfTextAtSize(group.label, 8) + 14;
      page.drawRectangle({
        x: mL, y: condY - 13,
        width: badgeW, height: 13, color: brandGreen
      });
      page.drawText(group.label, {
        x: mL + 7, y: condY - 9.5,
        size: 8, font: fontBold, color: white
      });
      condY -= 17;

      group.items.forEach(item => {
        page.drawRectangle({
          x: mL + 5, y: condY - 5.5,
          width: 4, height: 4, color: limeGreen
        });
        page.drawText(cleanTextForPDF(item), {
          x: mL + 16, y: condY - 5,
          size: 8, font: fontReg, color: grayDark
        });
        condY -= 13;
      });
      condY -= 6;
    });

    // ── Tampon + QR côte à côte ──
    const stampSize = 88;
    const qrSz     = 88;
    const gap       = 14;
    const totalElemW = stampSize + gap + qrSz;
    const zoneW      = (width - mR) - validX;
    const startElemX = validX + Math.max(0, (zoneW - totalElemW) / 2);
    let validY = currentY;

    // Tampon
    const tamponPath = '/var/www/numericexport/assets/tampon.png';
    try {
      if (await fileExists(tamponPath)) {
        const tamponBytes = await fs.readFile(tamponPath);
        const tamponImage = await pdfDoc.embedPng(tamponBytes);
        page.drawImage(tamponImage, {
          x: startElemX, y: validY - stampSize,
          width: stampSize, height: stampSize
        });
      } else {
        page.drawEllipse({
          x: startElemX + stampSize / 2,
          y: validY - stampSize / 2,
          xScale: stampSize / 2 - 3,
          yScale: stampSize / 2 - 3,
          borderWidth: 2, borderColor: brandGreen
        });
        page.drawText('CACHET', {
          x: startElemX + stampSize / 2 - 20,
          y: validY - stampSize / 2 - 5,
          size: 9, font: fontBold, color: grayMedium
        });
      }
    } catch (e) { logger.error('Erreur tampon:', e); }

    // Ligne + libellé sous le tampon
    page.drawLine({
      start: { x: startElemX + 6,            y: validY - stampSize - 7 },
      end:   { x: startElemX + stampSize - 6, y: validY - stampSize - 7 },
      thickness: 0.7, color: grayMedium
    });
    page.drawText('Le Directeur Général', {
      x: startElemX + stampSize / 2 - 38,
      y: validY - stampSize - 18,
      size: 8, font: fontReg, color: grayDark
    });

    // QR Code de vérification
    const qrX = startElemX + stampSize + gap;
    let qrDrawn = false;

    if (slip.id || slip.slip_number) {
      try {
        const baseApiUrl = process.env.API_BASE_URL || 'https://api.numericexport.com';
        const qrUrl = `${baseApiUrl}/api/v1/disbursements/${slip.id || slip.slip_number}/verify`;
        const qrImageBuffer = await generateQRCodeImage(qrUrl);
        if (qrImageBuffer) {
          const qrImage = await pdfDoc.embedPng(qrImageBuffer);
          page.drawImage(qrImage, {
            x: qrX, y: validY - qrSz,
            width: qrSz, height: qrSz
          });
          qrDrawn = true;
          page.drawText('Vérification en ligne', {
            x: qrX + qrSz / 2 - 38,
            y: validY - qrSz - 13,
            size: 7, font: fontReg, color: grayMedium
          });
        }
      } catch (e) { logger.error('[QR] Erreur:', e); }
    }

    if (!qrDrawn) {
      page.drawRectangle({
        x: qrX, y: validY - qrSz,
        width: qrSz, height: qrSz,
        borderWidth: 1, borderColor: borderGray,
        color: grayUltraLight
      });
      page.drawText('QR CODE', {
        x: qrX + qrSz / 2 - 22,
        y: validY - qrSz / 2 - 5,
        size: 8, font: fontBold, color: grayMedium
      });
    }

    // ════════════════════════════════════════════════════════════════════
    // PIED DE PAGE — texte légal
    // ════════════════════════════════════════════════════════════════════
    const footerLineY = 68;
    page.drawLine({
      start: { x: mL, y: footerLineY },
      end:   { x: width - mR, y: footerLineY },
      thickness: 1.5, color: brandGreen
    });

    const legalTexts = [
      'Document interne — Usage exclusivement réservé aux équipes autorisées de NEXT LTD.',
      'Toute divulgation ou reproduction non autorisée est strictement interdite.',
      `Pour toute question : team@numericexport.com`
    ];
    legalTexts.forEach((txt, i) => {
      page.drawText(cleanTextForPDF(txt), {
        x: mL, y: footerLineY - 12 - i * 10,
        size: 7, font: fontReg, color: grayMedium
      });
    });

    page.drawText(
      cleanTextForPDF(`© ${new Date().getFullYear()} NEXT LTD — Numeric Export Technologies`),
      { x: mL, y: 20, size: 7, font: fontReg, color: grayMedium }
    );
    // Date de génération alignée à droite
    const genTxt = `Générée le ${new Date().toLocaleString('fr-FR')}`;
    const genW   = fontReg.widthOfTextAtSize(genTxt, 7);
    page.drawText(cleanTextForPDF(genTxt), {
      x: width - mR - genW, y: 20,
      size: 7, font: fontReg, color: grayMedium
    });

    // ── Sauvegarde ──
    const pdfBytes = await pdfDoc.save();
    await fs.writeFile(fullPath, pdfBytes);

    logger.info(`✅ Fiche de décaissement générée : ${fullPath}`);
    return fullPath;

  } catch (error) {
    logger.error('❌ Erreur generateDisbursementPdf:', error);
    throw error;
  }
}

async function uploadReceipt(request, reply) {
  try {
    const { disbursementId } = request.params;
    const file = request.file;
    if (!file) return reply.code(400).send({ success: false, message: 'Aucun fichier' });

    const disbursementResult = await query('SELECT * FROM disbursement_slips WHERE id = $1', [disbursementId]);
    if (!disbursementResult.rowCount) return reply.code(404).send({ success: false, message: 'Décaissement non trouvé' });

    const disbursement = disbursementResult.rows[0];
    const receiptsDir = process.env.RECEIPTS_PATH || '/var/www/numericexport/media/receipts';
    await fs.mkdir(receiptsDir, { recursive: true });

    const fileExt = path.extname(file.originalname || '.pdf');
    const safeFileName = `receipt-${disbursementId}-${Date.now()}${fileExt}`;
    const newPath = path.join(receiptsDir, safeFileName);

    if (file.path) await fs.rename(file.path, newPath);
    else if (file.buffer) await fs.writeFile(newPath, file.buffer);
    else return reply.code(400).send({ success: false, message: 'Format non supporté' });

    const relativePath = `receipts/${safeFileName}`;
    await query('UPDATE disbursement_slips SET receipt_path = $1 WHERE id = $2', [relativePath, disbursementId]);

    const baseMediaUrl = process.env.MEDIA_BASE_URL || 'https://api.numericexport.com/media';
    return reply.code(200).send({
      success: true,
      message: 'Reçu uploadé',
      data: {
        receipt_path: relativePath,
        receipt_url: `${baseMediaUrl}/${relativePath}`
      }
    });
  } catch (error) {
    console.error('❌ uploadReceipt error:', error);
    return reply.code(500).send({ success: false, message: error.message });
  }
}

// VALIDATION SIMPLIFIÉE : crédit immédiat, sans blocage
 
async function validateSupply(request, reply) {
  try {
    const { disbursementId } = request.params;
    const { notes = '' } = request.body;
    const userId = request.user.id;

    // Récupérer le décaissement avec les infos commande
    const dsRes = await query(
      `SELECT ds.*, o.client_id, o.quantity, o.order_code, c.company_name
       FROM disbursement_slips ds
       JOIN orders o ON ds.order_id = o.id
       LEFT JOIN clients c ON o.client_id = c.id
       WHERE ds.id = $1`,
      [disbursementId]
    );

    if (!dsRes.rowCount) {
      return reply.code(404).send({ 
        success: false, 
        message: 'Décaissement non trouvé' 
      });
    }

    const ds = dsRes.rows[0];

    // Vérifier si déjà validé
    if (ds.status === 'approved') {
      return reply.code(400).send({ 
        success: false, 
        message: 'Ce décaissement a déjà été validé' 
      });
    }

    // Nombre de messages à consommer
    const qty = ds.messages_to_purchase || ds.quantity || 0;
    
    if (qty <= 0) {
      return reply.code(400).send({
        success: false,
        message: 'Quantité de messages invalide'
      });
    }

    // 🔴 ÉTAPE CRITIQUE : Vérifier le stock disponible
    const stockCheck = await query(`
      SELECT COALESCE(SUM(
        CASE 
          WHEN type = 'purchase' AND status = 'completed' THEN messages_count
          WHEN type = 'consumption' AND status = 'completed' THEN messages_count
          ELSE 0
        END
      ), 0) as available
      FROM message_transactions
    `);

    const available = parseInt(stockCheck.rows[0].available) || 0;

    // ❌ STOCK INSUFFISANT → ON REJETTE LA VALIDATION
    if (available < qty) {
      console.warn(`⚠️ Tentative de validation avec stock insuffisant: besoin ${qty}, disponible ${available}`);
      
      return reply.code(400).send({
        success: false,
        code: 'INSUFFICIENT_STOCK',
        message: `Stock de messages insuffisant pour valider cette commande.`,
        data: {
          required: qty,
          available: available,
          missing: qty - available,
          order_code: ds.order_code,
          company_name: ds.company_name
        },
        suggestion: 'Veuillez contacter le responsable des achats pour un réapprovisionnement.'
      });
    }

    // ✅ STOCK SUFFISANT → On procède à la validation
    await query('BEGIN');

    try {
      // 1. Mettre à jour le décaissement
      await query(
        `UPDATE disbursement_slips
         SET status = 'approved',
             validated_at = NOW(),
             approved_by = $1,
             notes = CASE 
               WHEN notes IS NULL OR notes = '' THEN $2
               ELSE notes || E'\n' || $2
             END
         WHERE id = $3`,
        [userId, notes, disbursementId]
      );

      // 2. Mettre à jour la commande
      await query(
        `UPDATE orders
         SET status = 'purchase_completed',
             purchase_confirmed_at = NOW(),
             purchase_confirmed_by = $1
         WHERE id = $2`,
        [userId, ds.order_id]
      );

      // 3. Créditer le quota client
      if (qty > 0) {
        await query(
          `UPDATE clients
           SET quota_total = COALESCE(quota_total, 0) + $1,
               quota_remaining = COALESCE(quota_remaining, 0) + $1,
               updated_at = NOW()
           WHERE id = $2`,
          [qty, ds.client_id]
        );
      }

      // 4. CONSOMMER LES MESSAGES DU STOCK
      await consumeMessages(
        ds.order_id,
        qty,
        ds.selected_bsp_id || null,
        userId
      );

      await query('COMMIT');

      // Nouveau stock après consommation
      const newStock = available - qty;

      return reply.send({
        success: true,
        message: `✅ Commande validée avec succès ! ${qty} messages crédités au client.`,
        data: {
          disbursement_id: disbursementId,
          order_code: ds.order_code,
          company_name: ds.company_name,
          quantity_credited: qty,
          stock_before: available,
          stock_after: newStock,
          alert_threshold: newStock < 1000 ? '⚠️ Stock bas, pensez à réapprovisionner' : null
        }
      });

    } catch (innerErr) {
      await query('ROLLBACK');
      throw innerErr;
    }

  } catch (err) {
    console.error('❌ validateSupply error:', err);
    return reply.code(500).send({
      success: false,
      message: err.message || 'Erreur lors de la validation du décaissement'
    });
  }
}

async function verifyInvoice(request, reply) {
  try {
    const { invoiceId } = request.params;
    const { token } = request.query;

    const result = await query(
      `SELECT i.*, o.order_code, o.quantity, o.total_amount, c.company_name, c.email
       FROM invoices i
       JOIN orders o ON i.order_id = o.id
       JOIN clients c ON o.client_id = c.id
       WHERE i.id = $1 AND i.verification_token = $2 AND i.stamp_applied = true`,
      [invoiceId, token]
    );

    if (!result.rowCount) return reply.code(404).send({ valid: false, message: 'Facture non vérifiable' });

    const invoice = result.rows[0];
    return reply.code(200).send({
      valid: true,
      invoice: {
        invoice_number: invoice.invoice_number,
        amount: invoice.total_amount,
        order_code: invoice.order_code,
        company_name: invoice.company_name
      }
    });
  } catch (err) {
    return reply.code(500).send({ valid: false, message: 'Erreur serveur' });
  }
}

async function downloadReceipt(request, reply) {
  try {
    const { disbursementId } = request.params;
    const result = await query('SELECT receipt_path FROM disbursement_slips WHERE id = $1', [disbursementId]);

    if (!result.rowCount || !result.rows[0].receipt_path) {
      return reply.code(404).send({ success: false, message: 'Reçu non trouvé' });
    }

    let receiptPath = result.rows[0].receipt_path;
    if (!path.isAbsolute(receiptPath)) {
      receiptPath = path.join(process.env.RECEIPTS_PATH || '/var/www/numericexport/media/receipts', path.basename(receiptPath));
    }

    await fs.access(receiptPath);

    const ext = path.extname(receiptPath).toLowerCase();
    const mimeTypes = { '.pdf': 'application/pdf', '.jpg': 'image/jpeg', '.png': 'image/png', '.heic': 'image/heic' };
    const contentType = mimeTypes[ext] || 'application/octet-stream';

    reply.header('Content-Type', contentType);
    reply.header('Content-Disposition', `inline; filename="receipt-${disbursementId}${ext}"`);
    return reply.send(fs.createReadStream(receiptPath));
  } catch (err) {
    return reply.code(500).send({ success: false, message: 'Erreur téléchargement' });
  }
}

async function getDisbursementStatistics(request, reply) {
  try {
    const { start_date, end_date } = request.query;
    let sql = `
      SELECT
        COUNT(*) as total_disbursements,
        SUM(CASE WHEN status = 'pending' THEN 1 ELSE 0 END) as pending,
        SUM(CASE WHEN status = 'approved' THEN 1 ELSE 0 END) as approved,
        SUM(amount) as total_amount,
        SUM(messages_to_purchase) as total_messages
      FROM disbursement_slips
      WHERE 1=1
    `;
    const params = [];
    if (start_date) {
      sql += ` AND created_at >= $1`;
      params.push(start_date);
    }
    if (end_date) {
      sql += ` AND created_at <= $${params.length + 1}`;
      params.push(end_date);
    }
    const result = await query(sql, params);
    return reply.send({ success: true, data: result.rows[0] });
  } catch (err) {
    return reply.code(500).send({ success: false, message: 'Erreur statistiques' });
  }
}

module.exports = {
  getAllInvoiceDisbursements,
  getDisbursementDetails,
  generateDisbursementSlip,
  uploadReceipt,
  validateSupply,
  verifyInvoice,
  downloadReceipt,
  getDisbursementStatistics
};
