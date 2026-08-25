const { query, getClient } = require('../config/database');
const { generateInvoiceNumber, generateDisbursementNumber } = require('../utils/crypto');
const { sendTeamNotification } = require('./email.service');
const logger = require('../utils/logger');
const fs = require('fs').promises;
const path = require('path');
const { PDFDocument, rgb, StandardFonts } = require('pdf-lib');
const QRCode = require('qrcode');
const crypto = require('crypto');

/**
 * Nettoyer le texte pour l'encodage WinAnsi
 */
function cleanTextForPDF(text) {
  if (typeof text !== 'string') return '';
  return text
    .replace(/[\u00A0\u202F\u2009]/g, ' ')     // espaces problématiques
    .replace(/[\u2019\u2018]/g, "'")
    .replace(/[\u201C\u201D]/g, '"')
    .replace(/[\u2013]/g, '-')
    .replace(/[\u2014]/g, '--')
    .replace(/[\u2026]/g, '...')
    .replace(/[^\x00-\xFF]/g, '?')
    .trim();
}

/**
 * Vérifier si un fichier existe
 */
async function fileExists(filePath) {
  try {
    await fs.access(filePath);
    return true;
  } catch {
    return false;
  }
}

/**
 * Formater un nombre pour pdf-lib (format français)
 */
function formatNumberForPDF(number) {
  if (number === null || number === undefined) return '0,00';
  const formatted = new Intl.NumberFormat('fr-FR', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2
  }).format(number);
  return formatted.replace(/[\u00A0\u202F]/g, ' ');
}

/**
 * Formater une date pour pdf-lib
 */
function formatDateForPDF(date) {
  if (!date) return '';

  const d = new Date(date);
  return cleanTextForPDF(d.toLocaleDateString('fr-FR', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric'
  }));
}

/**
 * Formater une date complète
 */
function formatFullDateForPDF(date) {
  if (!date) return '';

  const d = new Date(date);
  return cleanTextForPDF(d.toLocaleDateString('fr-FR', {
    day: '2-digit',
    month: 'long',
    year: 'numeric'
  }));
}

/**
 * Convertir un nombre en lettres (français) - Version compatible WinAnsi
 */
function convertNumberToWords(num) {
  if (!num || num === 0) return 'ZERO';

  const units = ['', 'un', 'deux', 'trois', 'quatre', 'cinq', 'six', 'sept', 'huit', 'neuf'];
  const teens = ['dix', 'onze', 'douze', 'treize', 'quatorze', 'quinze', 'seize', 'dix-sept', 'dix-huit', 'dix-neuf'];
  const tens = ['', '', 'vingt', 'trente', 'quarante', 'cinquante', 'soixante', 'soixante-dix', 'quatre-vingt', 'quatre-vingt-dix'];

  let result = '';
  const integerPart = Math.floor(num);
  let remaining = integerPart;

  // Millions
  if (remaining >= 1000000) {
    const millions = Math.floor(remaining / 1000000);
    result += convertSmallNumber(millions) + ' million' + (millions > 1 ? 's' : '') + ' ';
    remaining = remaining % 1000000;
  }

  // Milliers
  if (remaining >= 1000) {
    const thousands = Math.floor(remaining / 1000);
    if (thousands === 1) {
      result += 'mille ';
    } else {
      result += convertSmallNumber(thousands) + ' mille ';
    }
    remaining = remaining % 1000;
  }

  // Centaines et dizaines
  if (remaining > 0) {
    result += convertSmallNumber(remaining);
  }

  // Ajouter les centimes si nécessaire
  const cents = Math.round((num - integerPart) * 100);
  if (cents > 0) {
    result += ' et ' + convertSmallNumber(cents) + ' centime' + (cents > 1 ? 's' : '');
  }

  return cleanTextForPDF(result.trim().toUpperCase());
}

function convertSmallNumber(num) {
  const units = ['', 'un', 'deux', 'trois', 'quatre', 'cinq', 'six', 'sept', 'huit', 'neuf'];
  const teens = ['dix', 'onze', 'douze', 'treize', 'quatorze', 'quinze', 'seize', 'dix-sept', 'dix-huit', 'dix-neuf'];
  const tens = ['', '', 'vingt', 'trente', 'quarante', 'cinquante', 'soixante', 'soixante-dix', 'quatre-vingt', 'quatre-vingt-dix'];

  if (num < 10) return units[num];
  if (num < 20) return teens[num - 10];
  if (num < 100) {
    const ten = Math.floor(num / 10);
    const unit = num % 10;
    if (unit === 0) return tens[ten];
    if (unit === 1 && ten !== 8 && ten !== 9) return tens[ten] + '-et-un';
    if (ten === 7 || ten === 9) {
      const base = ten === 7 ? 'soixante' : 'quatre-vingt';
      const remainder = ten === 7 ? unit + 10 : unit;
      if (remainder === 0) return base;
      if (remainder === 1) return base + '-et-un';
      return base + '-' + convertSmallNumber(remainder);
    }
    return tens[ten] + '-' + units[unit];
  }
  if (num < 200) return 'cent' + (num % 100 > 0 ? ' ' + convertSmallNumber(num % 100) : '');
  if (num < 1000) {
    const hundred = Math.floor(num / 100);
    const rest = num % 100;
    return units[hundred] + ' cent' + (hundred > 1 ? 's' : '') + (rest > 0 ? ' ' + convertSmallNumber(rest) : '');
  }
  return convertSmallNumber(Math.floor(num / 1000)) + ' mille' + (num % 1000 > 0 ? ' ' + convertSmallNumber(num % 1000) : '');
}

/**
 * Générer le QR code en image PNG
 */
async function generateQRCodeImage(text) {
  try {
    if (!text) {
      logger.warn('Texte vide pour QR code');
      return null;
    }

    const qrBuffer = await QRCode.toBuffer(cleanTextForPDF(text), {
      width: 120,
      margin: 1,
      color: {
        dark: '#1a5d1a',
        light: '#FFFFFF'
      }
    });
    return qrBuffer;
  } catch (error) {
    logger.warn('QR code non généré:', error.message);
    return null;
  }
}

/**
 * Dessiner du texte centré avec nettoyage automatique
 */
function drawCenteredText(page, text, y, size, font, color, width = 595.28) {
  const cleanedText = cleanTextForPDF(text);
  const textWidth = font.widthOfTextAtSize(cleanedText, size);
  const x = (width - textWidth) / 2;
  page.drawText(cleanedText, { x, y, size, font, color });
}

/**
 * Dessiner du texte aligné à droite avec nettoyage automatique
 */
function drawRightText(page, text, y, size, font, color, maxX = 545) {
  const cleanedText = cleanTextForPDF(text);
  const textWidth = font.widthOfTextAtSize(cleanedText, size);
  const x = maxX - textWidth;
  page.drawText(cleanedText, { x, y, size, font, color });
}

/**
 * Dessiner une ligne pointillée
 */
function drawDashedLine(page, start, end, dashArray = [5, 5], thickness = 1, color = rgb(0.8, 0.8, 0.8)) {
  page.drawLine({
    start,
    end,
    thickness,
    color,
    dashArray
  });
}

/**
 * Dessiner une ligne pleine
 */
function drawSolidLine(page, start, end, thickness = 1, color = rgb(0, 0, 0)) {
  page.drawLine({
    start,
    end,
    thickness,
    color
  });
}

/**
 * Générer la facture proforma avec pdf-lib (VERSION PROFESSIONNELLE AMÉLIORÉE)
 */

async function generateProformaPDF(invoice, orderData, verificationToken = null) {
  try {
    logger.info('🚀 Début génération PDF proforma professionnel');
    const invoicesDir = process.env.INVOICES_PATH || '/var/www/numericexport/media/invoices';
    await fs.mkdir(invoicesDir, { recursive: true });
    const fileName = `FACTURE_PROFORMA_${invoice.invoice_number}.pdf`;
    const pdfPath  = path.join(invoicesDir, fileName);

    const pdfDoc = await PDFDocument.create();

    // ── Polices ──
    const fontRegular = await pdfDoc.embedFont(StandardFonts.Helvetica);
    const fontBold    = await pdfDoc.embedFont(StandardFonts.HelveticaBold);
    const fontItalic  = await pdfDoc.embedFont(StandardFonts.HelveticaOblique);

    // ── Page A4 ──
    const page = pdfDoc.addPage([595.28, 841.89]);
    const { width, height } = page.getSize();

    // ── Palette couleurs (charte officielle) ──
    const brandGreen     = rgb(26/255,  93/255,  26/255);  // #1a5d1a
    const lightGreen     = rgb(224/255, 242/255, 233/255); // #e0f2e9
    const accentGreen    = rgb(15/255,  65/255,  15/255);  // #0f410f
    const limeGreen      = rgb(139/255, 195/255, 74/255);  // #8bc34a
    const white          = rgb(1, 1, 1);
    const black          = rgb(0, 0, 0);
    const grayUltraLight = rgb(0.98, 0.98, 0.98);
    const grayMedium     = rgb(0.60, 0.60, 0.60);
    const grayDark       = rgb(0.30, 0.30, 0.30);
    const borderGray     = rgb(0.85, 0.85, 0.85);

    const marginLeft   = 45;
    const marginRight  = 45;
    const contentWidth = width - marginLeft - marginRight;

    // ──────────────────────────────────────────────────────────────────────
    // BANDES DÉCORATIVES (haut + bas)
    // ──────────────────────────────────────────────────────────────────────
    page.drawRectangle({ x: 0, y: height - 8, width, height: 8, color: brandGreen });
    page.drawRectangle({ x: 0, y: 0,          width, height: 8, color: brandGreen });

     // ──────────────────────────────────────────────────────────────────────
// SECTION 1 — LOGO (gauche) + PROFORMA INVOICE (droite), même niveau
// ──────────────────────────────────────────────────────────────────────
const headerTopY = height - 18; // Y de départ après la bande verte (on garde tel quel)

// Logo (gauche)
const logoPath = '/var/www/numericexport/dashboard/public/logook34.png';
try {
  if (await fileExists(logoPath)) {
    const logoBytes = await fs.readFile(logoPath);
    const logoImage = await pdfDoc.embedPng(logoBytes);

    // Taille augmentée : +33% (120→160, 52→70) — ratio préservé
    page.drawImage(logoImage, {
      x: marginLeft,
      y: headerTopY - 70,          // ajusté pour centrer verticalement avec la nouvelle hauteur
      width: 160,                  // ← plus grand
      height: 70                   // ← plus grand
    });
  } else {
    // Fallback bloc logo — on l'agrandit aussi pour cohérence
    page.drawRectangle({
      x: marginLeft,
      y: headerTopY - 70,
      width: 160,
      height: 70,
      color: lightGreen,
      borderWidth: 2,
      borderColor: brandGreen
    });
    page.drawText('NEXT LTD', {
      x: marginLeft + 25,
      y: headerTopY - 40,
      size: 16,                    // un peu plus grand aussi
      font: fontBold,
      color: brandGreen
    });
  }
} catch (e) {
  logger.error('Erreur logo:', e);
} 

    // "PROFORMA INVOICE" (droite, même niveau Y)
    const titleX = width - marginRight - 230;
    page.drawText('PROFORMA INVOICE', {
      x: titleX, y: headerTopY - 8,
      size: 22, font: fontBold, color: accentGreen
    });

    // Ligne de soulignement sous le titre
    const underlineY = headerTopY - 22;
    page.drawLine({
      start: { x: titleX, y: underlineY },
      end:   { x: width - marginRight, y: underlineY },
      thickness: 2, color: brandGreen
    });

    // ── Info box (Date, N°, Représentant) — juste sous la ligne ──
    const infoBoxW = 230;
    const infoBoxH = 56;
    const infoBoxTopY = underlineY - 2;

    page.drawRectangle({
      x: titleX, y: infoBoxTopY - infoBoxH,
      width: infoBoxW, height: infoBoxH,
      color: grayUltraLight, borderWidth: 1, borderColor: borderGray
    });

    const infoItems = [
      { label: 'Date :',          value: formatDateForPDF(new Date(invoice.issue_date)) },
      { label: 'Proforma N° :',   value: invoice.invoice_number || '' },
      { label: 'Représentant :',  value: 'NEXT Team' }
    ];
    infoItems.forEach((item, i) => {
      const lineY = infoBoxTopY - 15 - (i * 16);
      page.drawText(cleanTextForPDF(item.label), {
        x: titleX + 10, y: lineY,
        size: 9, font: fontBold, color: grayDark
      });
      page.drawText(cleanTextForPDF(item.value), {
        x: titleX + 100, y: lineY,
        size: 9, font: fontRegular, color: black
      });
    });

    // Bas de la section header
    const headerBottomY = infoBoxTopY - infoBoxH;

    // ── Séparateur ──
    const sep1Y = headerBottomY - 14;
    page.drawLine({
      start: { x: marginLeft, y: sep1Y },
      end:   { x: width - marginRight, y: sep1Y },
      thickness: 1, color: borderGray
    });

    // ──────────────────────────────────────────────────────────────────────
    // SECTION 2 — FOURNISSEUR (gauche) + CLIENT (droite), même niveau
    // ──────────────────────────────────────────────────────────────────────
    const colW   = contentWidth * 0.47;
    const colGap = contentWidth * 0.06;
    const colRX  = marginLeft + colW + colGap;   // X colonne droite
    const scTopY = sep1Y - 14;                   // Y haut des deux blocs

    // ── Barre titre FOURNISSEUR ──
    page.drawRectangle({
      x: marginLeft, y: scTopY - 20,
      width: colW, height: 20, color: brandGreen
    });
    page.drawText('FOURNISSEUR :', {
      x: marginLeft + 8, y: scTopY - 14,
      size: 10, font: fontBold, color: white
    });

    // ── Barre titre CLIENT (même Y) ──
    page.drawRectangle({
      x: colRX, y: scTopY - 20,
      width: colW, height: 20, color: brandGreen
    });
    page.drawText('CLIENT :', {
      x: colRX + 8, y: scTopY - 14,
      size: 10, font: fontBold, color: white
    });

    // ── Infos fournisseur ──
    const supStartY = scTopY - 34;
    page.drawText('Numeric Export Technologies', {
      x: marginLeft + 8, y: supStartY,
      size: 10, font: fontBold, color: accentGreen
    });
    const supLines = [
      { text: 'RCM : CM-DLA-02-2026-B12-00012', bold: true  },
      { text: 'BP 15368 Douala, Cameroun',        bold: false },
      { text: 'Tel : (+237) 696 578 107 / 651 019 069', bold: true },
      { text: 'Email : team@numericexport.com',   bold: true  },
      { text: 'Web : www.numericexport.com',      bold: true  }
    ];
    supLines.forEach((line, i) => {
      page.drawText(cleanTextForPDF(line.text), {
        x: marginLeft + 8, y: supStartY - 13 - i * 13,
        size: 9, font: line.bold ? fontBold : fontRegular, color: grayDark
      });
    });

    // ── Infos client ──
    const cliStartY = scTopY - 34;
    page.drawText(cleanTextForPDF(orderData.company_name || 'Client'), {
      x: colRX + 8, y: cliStartY,
      size: 11, font: fontBold, color: accentGreen
    });
    const cliLines = [];
    if (orderData.address) cliLines.push({ text: orderData.address, bold: false });
    if (orderData.city || orderData.country) {
      const loc = `${orderData.city || ''}${orderData.city && orderData.country ? ', ' : ''}${orderData.country || ''}`;
      cliLines.push({ text: loc, bold: false });
    }
    if (orderData.phone) cliLines.push({ text: `Tel : ${orderData.phone}`, bold: true });
    if (orderData.email) cliLines.push({ text: `Email : ${orderData.email}`, bold: true });
    if (orderData.tax_id) cliLines.push({ text: `NIF : ${orderData.tax_id}`, bold: true });
    cliLines.forEach((line, i) => {
      page.drawText(cleanTextForPDF(line.text), {
        x: colRX + 8, y: cliStartY - 13 - i * 13,
        size: 9, font: line.bold ? fontBold : fontRegular, color: grayDark
      });
    });

    // Bas section fournisseur/client
    const maxLines = Math.max(supLines.length, cliLines.length + 1);
    const scBottomY = scTopY - 20 - 14 - maxLines * 13 - 14;

    // ──────────────────────────────────────────────────────────────────────
    // SECTION 3 — TABLEAU DES PRESTATIONS
    // ──────────────────────────────────────────────────────────────────────
    let tableY = scBottomY - 18;

    // Titre du tableau
    page.drawText('DÉTAIL DE LA PRESTATION', {
      x: marginLeft, y: tableY,
      size: 11, font: fontBold, color: accentGreen
    });
    page.drawLine({
      start: { x: marginLeft,       y: tableY - 4 },
      end:   { x: marginLeft + 175, y: tableY - 4 },
      thickness: 2, color: brandGreen
    });
    tableY -= 22;

    // Entête du tableau
    const tColW = [
      contentWidth * 0.44,
      contentWidth * 0.17,
      contentWidth * 0.18,
      contentWidth * 0.21
    ];
    const hdrH = 26;

    page.drawRectangle({
      x: marginLeft, y: tableY - hdrH,
      width: contentWidth, height: hdrH, color: brandGreen
    });

    const headers = ['DESCRIPTION', 'QUANTITÉ', 'PRIX UNITAIRE', 'MONTANT'];
    headers.forEach((h, i) => {
      const hx = marginLeft + tColW.slice(0, i).reduce((a, b) => a + b, 0) + 8;
      page.drawText(h, {
        x: hx, y: tableY - 17,
        size: 9, font: fontBold, color: white
      });
    });
    tableY -= hdrH + 1;

    // Ligne de données
    const rowH = 55;
    page.drawRectangle({
      x: marginLeft, y: tableY - rowH,
      width: contentWidth, height: rowH,
      color: grayUltraLight, borderWidth: 1, borderColor: borderGray
    });

    // Séparateurs verticaux
    let sepColX = marginLeft;
    for (let i = 0; i < 3; i++) {
      sepColX += tColW[i];
      page.drawLine({
        start: { x: sepColX, y: tableY },
        end:   { x: sepColX, y: tableY - rowH },
        thickness: 0.5, color: borderGray
      });
    }

    // Colonne Description
    page.drawText('Messages WhatsApp Business API', {
      x: marginLeft + 8, y: tableY - 17,
      size: 10, font: fontBold, color: black
    });
    page.drawText('Service de messagerie professionnelle', {
      x: marginLeft + 8, y: tableY - 30,
      size: 8, font: fontRegular, color: grayMedium
    });
    page.drawText('Plateforme NEXT LTD', {
      x: marginLeft + 8, y: tableY - 42,
      size: 8, font: fontRegular, color: grayMedium
    });

    // Colonne Quantité (centré)
    const qtyTxt = formatNumberForPDF(orderData.quantity || 0);
    const qtyW   = fontBold.widthOfTextAtSize(qtyTxt, 10);
    page.drawText(cleanTextForPDF(qtyTxt), {
      x: marginLeft + tColW[0] + (tColW[1] - qtyW) / 2,
      y: tableY - 27,
      size: 10, font: fontBold, color: black
    });

    // Colonne Prix unitaire
    const col2X = marginLeft + tColW[0] + tColW[1];
    page.drawText(cleanTextForPDF(formatNumberForPDF(orderData.unit_price || 0)), {
      x: col2X + 10, y: tableY - 22,
      size: 9, font: fontRegular, color: black
    });
    page.drawText('FCFA', {
      x: col2X + 10, y: tableY - 34,
      size: 8, font: fontRegular, color: grayMedium
    });

    // Colonne Montant
    const col3X = col2X + tColW[2];
    page.drawText(cleanTextForPDF(formatNumberForPDF(orderData.subtotal || 0)), {
      x: col3X + 10, y: tableY - 22,
      size: 10, font: fontBold, color: brandGreen
    });
    page.drawText('FCFA', {
      x: col3X + 10, y: tableY - 34,
      size: 8, font: fontRegular, color: grayMedium
    });

    tableY -= rowH;

    // ──────────────────────────────────────────────────────────────────────
    // SECTION 4 — TOTAUX
    // ──────────────────────────────────────────────────────────────────────
    const subtotal    = orderData.subtotal     || 0;
    const vatRate     = orderData.vat_rate     || 0;
    const vatAmount   = orderData.vat_amount   || 0;
    const totalAmount = orderData.total_amount || 0;

    const totW = 245;
    const totX = width - marginRight - totW;
    let   totY = tableY - 12;
    const totH = 92;

    page.drawRectangle({
      x: totX, y: totY - totH,
      width: totW, height: totH,
      color: grayUltraLight, borderWidth: 1, borderColor: borderGray
    });

    let tY = totY - 18;
    // Sous-total
    page.drawText('Sous-total HT :', {
      x: totX + 12, y: tY, size: 10, font: fontRegular, color: grayDark
    });
    drawRightText(page, `${formatNumberForPDF(subtotal)} FCFA`, tY, 10, fontRegular, black, width - marginRight - 12);
    tY -= 20;
    // TVA
    page.drawText(cleanTextForPDF(`TVA (${vatRate}%) :`), {
      x: totX + 12, y: tY, size: 10, font: fontRegular, color: grayDark
    });
    drawRightText(page, `${formatNumberForPDF(vatAmount)} FCFA`, tY, 10, fontRegular, black, width - marginRight - 12);
    tY -= 22;
    // Trait séparateur
    page.drawLine({
      start: { x: totX + 12, y: tY + 5 },
      end:   { x: width - marginRight - 12, y: tY + 5 },
      thickness: 1, color: brandGreen
    });
    tY -= 10;
    // Total TTC
    page.drawText('TOTAL TTC :', {
      x: totX + 12, y: tY, size: 12, font: fontBold, color: accentGreen
    });
    drawRightText(page, `${formatNumberForPDF(totalAmount)} FCFA`, tY, 12, fontBold, brandGreen, width - marginRight - 12);

    let currentY = totY - totH - 16;

    // ──────────────────────────────────────────────────────────────────────
    // SECTION 5 — MONTANT EN LETTRES (discret, italique, sans cadre)
    // ──────────────────────────────────────────────────────────────────────
    const amountInWords = convertNumberToWords(totalAmount);
    page.drawText('Arrêté à la somme de :', {
      x: marginLeft, y: currentY,
      size: 8, font: fontItalic, color: grayMedium
    });
    currentY -= 13;
    page.drawText(cleanTextForPDF(`${amountInWords} FRANCS CFA`), {
      x: marginLeft, y: currentY,
      size: 9, font: fontItalic, color: grayDark
    });
    currentY -= 20;

    // Séparateur mince
    page.drawLine({
      start: { x: marginLeft, y: currentY },
      end:   { x: width - marginRight, y: currentY },
      thickness: 0.5, color: borderGray
    });
    currentY -= 12;

    // ──────────────────────────────────────────────────────────────────────
    // SECTION 6 — CONDITIONS DE PAIEMENT (gauche) + VALIDATION (droite)
    // ──────────────────────────────────────────────────────────────────────
    const condW  = contentWidth * 0.52;
    const validX = marginLeft + condW + 20;
    const validW = (width - marginRight) - validX;

    // ── En-tête CONDITIONS ──
    page.drawRectangle({
      x: marginLeft, y: currentY - 18,
      width: 195, height: 18, color: lightGreen
    });
    page.drawText('CONDITIONS DE PAIEMENT', {
      x: marginLeft + 8, y: currentY - 13,
      size: 9, font: fontBold, color: brandGreen
    });

    // ── En-tête VALIDATION (même Y) ──
    page.drawRectangle({
      x: validX, y: currentY - 18,
      width: 100, height: 18, color: lightGreen
    });
    page.drawText('VALIDATION', {
      x: validX + 8, y: currentY - 13,
      size: 9, font: fontBold, color: brandGreen
    });

    currentY -= 26;

    // ── Groupes de conditions avec badges ──
    const condGroups = [
      {
        label: 'Paiement',
        items: [
          'Délai : 30 jours après dépôt de facture',
          'Mode : Virement bancaire ou espèces'
        ]
      },
      {
        label: 'Coordonnées bancaires',
        items: [
          'Banque : CCA BANK',
          'Compte : 10039 10038 00280436301 03'
        ]
      },
      {
        label: 'Livraison',
        items: [
          'Délai : 3 jours ouvrés',
          'Variation possible : +/- 30%'
        ]
      },
      {
        label: 'Validité',
        items: ['Cette proforma est valable 30 jours']
      }
    ];

    let condY = currentY;
    condGroups.forEach(group => {
      // Badge groupe (fond vert, texte blanc)
      const badgeW = fontBold.widthOfTextAtSize(group.label, 8) + 14;
      page.drawRectangle({
        x: marginLeft, y: condY - 13,
        width: badgeW, height: 13, color: brandGreen
      });
      page.drawText(group.label, {
        x: marginLeft + 7, y: condY - 9.5,
        size: 8, font: fontBold, color: white
      });
      condY -= 17;

      group.items.forEach(item => {
        // Petit carré lime comme puce
        page.drawRectangle({
          x: marginLeft + 5, y: condY - 5.5,
          width: 4, height: 4, color: limeGreen
        });
        page.drawText(cleanTextForPDF(item), {
          x: marginLeft + 16, y: condY - 5,
          size: 8, font: fontRegular, color: grayDark
        });
        condY -= 13;
      });
      condY -= 5; // espace inter-groupe
    });

    // ── Zone TAMPON + QR (côte à côte, droite) ──
    const stampSize = 88;
    const qrSz     = 88;
    const gap       = 14;
    // Centrer tampon+QR dans la zone validation
    const totalW = stampSize + gap + qrSz;
    const zoneW  = (width - marginRight) - validX;
    const startElemX = validX + Math.max(0, (zoneW - totalW) / 2);

    let validY = currentY; // même ligne de départ que les conditions

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
        // Fallback ellipse
        page.drawEllipse({
          x: startElemX + stampSize / 2,
          y: validY - stampSize / 2,
          xScale: stampSize / 2 - 2,
          yScale: stampSize / 2 - 2,
          borderWidth: 2, borderColor: brandGreen
        });
        page.drawText('CACHET', {
          x: startElemX + stampSize / 2 - 20,
          y: validY - stampSize / 2 - 5,
          size: 9, font: fontBold, color: grayMedium
        });
      }
    } catch (e) { logger.error('Erreur tampon:', e); }

    // Label + ligne sous le tampon
    page.drawLine({
      start: { x: startElemX + 6,            y: validY - stampSize - 7 },
      end:   { x: startElemX + stampSize - 6, y: validY - stampSize - 7 },
      thickness: 0.7, color: grayMedium
    });
    page.drawText('Le Directeur', {
      x: startElemX + stampSize / 2 - 27,
      y: validY - stampSize - 18,
      size: 8, font: fontRegular, color: grayDark
    });

    // QR Code
    const qrX = startElemX + stampSize + gap;
    let qrDrawn = false;
    if (verificationToken) {
      const baseApiUrl = process.env.API_BASE_URL || 'https://api.numericexport.com';
      const qrUrl = `${baseApiUrl}/api/v1/orders/invoices/${invoice.id}/verify?token=${verificationToken}`;
      logger.info(`[QR] URL : ${qrUrl}`);
      const qrImageBuffer = await generateQRCodeImage(qrUrl);
      if (qrImageBuffer) {
        try {
          const qrImage = await pdfDoc.embedPng(qrImageBuffer);
          page.drawImage(qrImage, {
            x: qrX, y: validY - qrSz,
            width: qrSz, height: qrSz
          });
          qrDrawn = true;
          // Label sous le QR
          page.drawText('Vérification en ligne', {
            x: qrX + qrSz / 2 - 38,
            y: validY - qrSz - 13,
            size: 7, font: fontRegular, color: grayMedium
          });
          logger.info('[QR] QR code ajouté');
        } catch (e) { logger.error('[QR] Erreur embed:', e); }
      } else {
        logger.warn('[QR] generateQRCodeImage a retourné null');
      }
    } else {
      logger.warn('[QR] Aucun verificationToken fourni');
    }

    // Placeholder QR si non généré
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

    // ──────────────────────────────────────────────────────────────────────
    // PIED DE PAGE — texte légal
    // ──────────────────────────────────────────────────────────────────────
    const footerLineY = 68;
    page.drawLine({
      start: { x: marginLeft,          y: footerLineY },
      end:   { x: width - marginRight, y: footerLineY },
      thickness: 1.5, color: brandGreen
    });

    const legalTexts = [
     'Cette facture proforma est valable 30 jours à compter de sa date d\'émission.',
      'Document non contractuel - Sous réserve de validation - NEXT LTD - RCM: CM-DLA-02-2026-B12-00012',
      'Pour toute question: team@numericexport.com | Tel: (+237) 696 578 107'

    ];
    legalTexts.forEach((txt, i) => {
      page.drawText(cleanTextForPDF(txt), {
        x: marginLeft,
        y: footerLineY - 12 - i * 10,
        size: 7, font: fontRegular, color: grayMedium
      });
    });

    // Copyright + date de génération
    page.drawText(
      cleanTextForPDF(`© ${new Date().getFullYear()} NEXT LTD — Tous droits réservés`),
      { x: marginLeft, y: 20, size: 7, font: fontRegular, color: grayMedium }
    );
    drawRightText(
      page, `Générée le ${formatDateForPDF(new Date())}`,
      20, 7, fontRegular, grayMedium, width - marginRight
    );

    // ── Sauvegarde ──
    const pdfBytes = await pdfDoc.save();
    await fs.writeFile(pdfPath, pdfBytes);

    logger.info(`✅ Facture proforma générée : ${pdfPath}`);
    return pdfPath;

  } catch (error) {
    logger.error('❌ Erreur generateProformaPDF:', error);
    throw error;
  }
}

/**
 * Générer la facture finale avec pdf-lib (CONSERVÉE TELLE QUELLE)
 */
async function generateFinalInvoicePDF(invoice, orderData, verificationToken = null) {
  try {
    logger.info('🚀 Début génération PDF facture finale');

    const invoicesDir = process.env.INVOICES_PATH || '/var/www/numericexport/media/invoices';
    await fs.mkdir(invoicesDir, { recursive: true });

    const fileName = `FACTURE_FINALE_${invoice.invoice_number}.pdf`;
    const pdfPath = path.join(invoicesDir, fileName);

    // Créer un nouveau document PDF
    const pdfDoc = await PDFDocument.create();

    // Ajouter des polices
    const fontRegular = await pdfDoc.embedFont(StandardFonts.Helvetica);
    const fontBold = await pdfDoc.embedFont(StandardFonts.HelveticaBold);

    // Créer une page A4
    const page = pdfDoc.addPage([595.28, 841.89]);
    const { width, height } = page.getSize();

    // ==================== DÉFINITION DES COULEURS ====================
    const primaryGreen = rgb(34/255, 197/255, 94/255);      // #22c55e - Vert vif
    const secondaryGreen = rgb(21/255, 128/255, 61/255);    // #15803d - Vert foncé
    const accentGreen = rgb(134/255, 239/255, 172/255);     // #86efac - Vert clair
    const lightGreen = rgb(220/255, 252/255, 231/255);      // #dcfce7 - Vert très clair
    const white = rgb(1, 1, 1);
    const black = rgb(0, 0, 0);
    const grayLight = rgb(0.95, 0.95, 0.95);
    const grayMedium = rgb(0.6, 0.6, 0.6);
    const grayDark = rgb(0.3, 0.3, 0.3);

    // ==================== VARIABLES DE POSITION ====================
    const marginLeft = 50;
    const marginRight = 50;
    const contentWidth = width - marginLeft - marginRight;
    let currentY = height - 50;

    // ==================== EN-TÊTE PRINCIPALE ====================
    // Logo / Nom entreprise côté gauche
    page.drawText(cleanTextForPDF('NEXT LTD'), {
      x: marginLeft,
      y: currentY,
      size: 28,
      font: fontBold,
      color: secondaryGreen
    });

    currentY -= 25;
    page.drawText(cleanTextForPDF('Numeric Export Technologies'), {
      x: marginLeft,
      y: currentY,
      size: 14,
      font: fontBold,
      color: primaryGreen
    });

    currentY -= 15;
    page.drawText(cleanTextForPDF('Société à responsabilité limitée'), {
      x: marginLeft,
      y: currentY,
      size: 10,
      font: fontRegular,
      color: grayDark
    });

    // Informations entreprise
    const companyInfo = [
      'RCCM: CM-DLA-02-2026-B12-00012',
      'BP 15368 Douala, Cameroun',
      'Tel: +237 696 578 107 | +237 651 019 069',
      'Email: team@numericexport.com',
      'Site: https://numericexport.com'
    ];

    currentY -= 25;
    companyInfo.forEach((info, index) => {
      page.drawText(cleanTextForPDF(info), {
        x: marginLeft,
        y: currentY - (index * 14),
        size: 9,
        font: fontRegular,
        color: grayMedium
      });
    });

    // Titre facture côté droit avec badge PAYÉ
    page.drawText(cleanTextForPDF('FACTURE FINALE'), {
      x: width - marginRight - 200,
      y: height - 50,
      size: 26,
      font: fontBold,
      color: secondaryGreen
    });

    // Badge PAYÉ
    page.drawRectangle({
      x: width - marginRight - 100,
      y: height - 85,
      width: 100,
      height: 30,
      color: rgb(0.9, 1, 0.9),
      borderRadius: 15,
      borderWidth: 2,
      borderColor: primaryGreen
    });

    page.drawText(cleanTextForPDF('✅ PAYÉ'), {
      x: width - marginRight - 85,
      y: height - 72,
      size: 14,
      font: fontBold,
      color: secondaryGreen
    });

    page.drawText(cleanTextForPDF(`N° ${invoice.invoice_number}`), {
      x: width - marginRight - 200,
      y: height - 110,
      size: 16,
      font: fontBold,
      color: secondaryGreen
    });

    // Informations facture
    currentY = height - 130;
    const invoiceInfo = [
      { label: "Date d'émission:", value: formatDateForPDF(new Date(invoice.issue_date)) },
      { label: 'Date de paiement:', value: formatDateForPDF(new Date()) },
      { label: 'Mode de paiement:', value: 'Virement bancaire' },
      { label: 'Référence:', value: orderData.order_code || 'N/A' }
    ];

    invoiceInfo.forEach((info, index) => {
      page.drawText(cleanTextForPDF(info.label), {
        x: width - marginRight - 200,
        y: currentY - (index * 18),
        size: 10,
        font: fontRegular,
        color: grayDark
      });

      drawRightText(page, info.value, currentY - (index * 18), 10, fontBold, grayDark, width - marginRight);
    });

    // ==================== LIGNE DE SÉPARATION ====================
    currentY = height - 210;
    page.drawLine({
      start: { x: marginLeft, y: currentY },
      end: { x: width - marginRight, y: currentY },
      thickness: 2,
      color: primaryGreen
    });

    currentY -= 20;

    // ==================== INFORMATIONS CLIENT ====================
    page.drawText(cleanTextForPDF('CLIENT'), {
      x: marginLeft,
      y: currentY,
      size: 14,
      font: fontBold,
      color: secondaryGreen
    });

    currentY -= 10;
    drawDashedLine(page,
      { x: marginLeft, y: currentY },
      { x: marginLeft + 100, y: currentY },
      [3, 3], 1, primaryGreen
    );

    currentY -= 25;
    page.drawText(cleanTextForPDF(orderData.company_name || orderData.email || 'Client'), {
      x: marginLeft,
      y: currentY,
      size: 16,
      font: fontBold,
      color: black
    });

    // Détails client
    currentY -= 20;
    const clientDetails = [
      { label: 'Email:', value: orderData.email },
      { label: 'Adresse:', value: orderData.address },
      { label: 'Ville/Pays:', value: `${orderData.city || ''}${orderData.city && orderData.country ? ', ' : ''}${orderData.country || ''}` },
      { label: 'ID Fiscal:', value: orderData.tax_id }
    ].filter(detail => detail.value);

    clientDetails.forEach((detail, index) => {
      page.drawText(cleanTextForPDF(`${detail.label} ${detail.value}`), {
        x: marginLeft,
        y: currentY - (index * 16),
        size: 11,
        font: fontRegular,
        color: grayDark
      });
    });

    // ==================== BADGE MESSAGES CRÉDITÉS ====================
    const badgeX = width - marginRight - 250;
    page.drawRectangle({
      x: badgeX,
      y: currentY + 40,
      width: 250,
      height: 60,
      color: lightGreen,
      borderRadius: 8,
      borderWidth: 2,
      borderColor: accentGreen
    });

    const badgeCenterX = badgeX + 125;
    drawCenteredText(page, '✅ MESSAGES CRÉDITÉS', currentY + 50, 14, fontBold, secondaryGreen, 250);
    
    page.drawText(cleanTextForPDF(`${orderData.quantity || 0} messages WhatsApp Business API`), {
      x: badgeX + 20,
      y: currentY + 30,
      size: 12,
      font: fontRegular,
      color: grayDark
    });

    page.drawText(cleanTextForPDF(`Commande: ${orderData.order_code || 'N/A'}`), {
      x: badgeX + 20,
      y: currentY + 15,
      size: 10,
      font: fontRegular,
      color: grayMedium
    });

    // ==================== TABLEAU DES ARTICLES ====================
    currentY -= 130;
    page.drawText(cleanTextForPDF('PRESTATIONS EFFECTUÉES'), {
      x: marginLeft,
      y: currentY,
      size: 14,
      font: fontBold,
      color: secondaryGreen
    });

    currentY -= 10;
    drawDashedLine(page,
      { x: marginLeft, y: currentY },
      { x: marginLeft + 180, y: currentY },
      [3, 3], 1, primaryGreen
    );

    currentY -= 30;

    // En-tête du tableau
    const tableHeaders = ['DESCRIPTION', 'QUANTITÉ', 'PRIX UNITAIRE HT', 'MONTANT HT'];
    const columnWidths = [contentWidth * 0.45, contentWidth * 0.15, contentWidth * 0.20, contentWidth * 0.20];
    const headerHeight = 30;

    // Fond en-tête
    page.drawRectangle({
      x: marginLeft,
      y: currentY - headerHeight,
      width: contentWidth,
      height: headerHeight,
      color: secondaryGreen,
      borderRadius: 4
    });

    // Textes en-tête
    let columnX = marginLeft;
    tableHeaders.forEach((header, index) => {
      page.drawText(cleanTextForPDF(header), {
        x: columnX + 10,
        y: currentY - 20,
        size: 11,
        font: fontBold,
        color: white
      });
      columnX += columnWidths[index];
    });

    // Ligne de l'article
    currentY -= 50;
    page.drawRectangle({
      x: marginLeft,
      y: currentY - 40,
      width: contentWidth,
      height: 40,
      color: rgb(0.98, 0.98, 0.98),
      borderRadius: 4,
      borderWidth: 1,
      borderColor: lightGreen
    });

    // Description
    page.drawText(cleanTextForPDF('Messages WhatsApp Business API'), {
      x: marginLeft + 15,
      y: currentY - 20,
      size: 12,
      font: fontBold,
      color: black
    });

    page.drawText(cleanTextForPDF('Service de messagerie professionnelle - Plateforme 360dialog'), {
      x: marginLeft + 15,
      y: currentY - 35,
      size: 9,
      font: fontRegular,
      color: grayMedium
    });

    // Quantité
    const quantity = orderData.quantity || 0;
    page.drawText(cleanTextForPDF(formatNumberForPDF(quantity)), {
      x: marginLeft + columnWidths[0] + 30,
      y: currentY - 27,
      size: 12,
      font: fontBold,
      color: black
    });

    // Prix unitaire
    const unitPrice = orderData.unit_price || 0;
    page.drawText(cleanTextForPDF(`${formatNumberForPDF(unitPrice)} FCFA`), {
      x: marginLeft + columnWidths[0] + columnWidths[1] + 20,
      y: currentY - 27,
      size: 12,
      font: fontBold,
      color: black
    });

    // Montant HT
    const subtotal = orderData.subtotal || 0;
    drawRightText(page, `${formatNumberForPDF(subtotal)} FCFA`, currentY - 27, 12, fontBold, black, width - marginRight - 10);

    // ==================== CALCUL DES TOTAUX ====================
    currentY -= 80;
    const totalsX = width - marginRight - 300;
    const totalsWidth = 300;

    // Cadre totaux avec fond
    page.drawRectangle({
      x: totalsX,
      y: currentY - 200,
      width: totalsWidth,
      height: 200,
      color: rgb(0.99, 0.99, 0.99),
      borderRadius: 8,
      borderWidth: 2,
      borderColor: accentGreen
    });

    page.drawText(cleanTextForPDF('RÉCAPITULATIF DU PAIEMENT'), {
      x: totalsX + 10,
      y: currentY - 20,
      size: 16,
      font: fontBold,
      color: secondaryGreen
    });

    // Ligne séparatrice
    page.drawLine({
      start: { x: totalsX + 10, y: currentY - 35 },
      end: { x: totalsX + totalsWidth - 20, y: currentY - 35 },
      thickness: 1,
      color: primaryGreen
    });

    let totalY = currentY - 60;
    const totals = [
      { label: 'Sous-total HT', value: subtotal },
      { label: `TVA (${orderData.vat_rate || 0}%)`, value: orderData.vat_amount || 0 },
      { label: 'TOTAL TTC', value: orderData.total_amount || 0 }
    ];

    totals.forEach((item, index) => {
      const isTotal = index === totals.length - 1;

      page.drawText(cleanTextForPDF(item.label), {
        x: totalsX + 20,
        y: totalY,
        size: isTotal ? 16 : 13,
        font: isTotal ? fontBold : fontRegular,
        color: isTotal ? secondaryGreen : grayDark
      });

      drawRightText(page, `${formatNumberForPDF(item.value)} FCFA`, totalY, isTotal ? 16 : 13, isTotal ? fontBold : fontRegular, isTotal ? secondaryGreen : grayDark, totalsX + totalsWidth - 20);

      if (!isTotal) {
        totalY -= 25;
        drawDashedLine(page,
          { x: totalsX + 20, y: totalY + 5 },
          { x: totalsX + totalsWidth - 20, y: totalY + 5 },
          [2, 2], 0.5, grayLight
        );
        totalY -= 20;
      }
    });

    // Montant en lettres
    totalY -= 30;
    const amountInWords = convertNumberToWords(orderData.total_amount || 0);
    page.drawText(cleanTextForPDF(`Montant en toutes lettres:`), {
      x: totalsX + 20,
      y: totalY,
      size: 9,
      font: fontBold,
      color: grayDark
    });
    
    totalY -= 12;
    page.drawText(cleanTextForPDF(`${amountInWords} FRANCS CFA`), {
      x: totalsX + 20,
      y: totalY,
      size: 9,
      font: fontRegular,
      color: grayDark
    });

    // Badge de confirmation
    totalY -= 40;
    page.drawRectangle({
      x: totalsX + 20,
      y: totalY - 40,
      width: totalsWidth - 40,
      height: 40,
      color: rgb(0.9, 1, 0.9),
      borderRadius: 6,
      borderWidth: 2,
      borderColor: primaryGreen
    });

    page.drawText(cleanTextForPDF('✅ PAIEMENT CONFIRMÉ - FACTURE ACQUITTÉE'), {
      x: totalsX + totalsWidth / 2 - 110,
      y: totalY - 20,
      size: 12,
      font: fontBold,
      color: secondaryGreen
    });

    // ==================== INFORMATIONS DE TRANSACTION ====================
    currentY = 350;
    page.drawText(cleanTextForPDF('DÉTAILS DE LA TRANSACTION'), {
      x: marginLeft,
      y: currentY,
      size: 12,
      font: fontBold,
      color: secondaryGreen
    });

    currentY -= 25;
    page.drawRectangle({
      x: marginLeft,
      y: currentY - 100,
      width: contentWidth,
      height: 100,
      borderWidth: 1,
      borderColor: lightGreen,
      borderRadius: 6,
      color: rgb(0.99, 0.99, 0.99)
    });

    const transactionDetails = [
      { label: 'Date de transaction:', value: formatDateForPDF(new Date()) },
      { label: 'Référence bancaire:', value: `TRX-${invoice.invoice_number}` },
      { label: 'Mode de paiement:', value: 'Virement bancaire' },
      { label: 'Statut:', value: 'Complète' },
      { label: 'Messages crédités:', value: `${quantity} unités` }
    ];

    let transactionY = currentY - 15;
    transactionDetails.forEach((detail, index) => {
      page.drawText(cleanTextForPDF(detail.label), {
        x: marginLeft + 20,
        y: transactionY - (index * 18),
        size: 10,
        font: fontRegular,
        color: grayMedium
      });

      page.drawText(cleanTextForPDF(detail.value), {
        x: marginLeft + 180,
        y: transactionY - (index * 18),
        size: 10,
        font: fontBold,
        color: detail.label === 'Statut:' ? primaryGreen : grayDark
      });
    });

    // ==================== QR CODE ET SIGNATURE ====================
    currentY = 240;

    // Générer QR code
    const baseApiUrl = process.env.API_BASE_URL || 'https://api.numericexport.com';
    let qrUrl;

    if (verificationToken) {
      const qrUrl = `${baseApiUrl}/api/v1/orders/invoices/${invoice.id}/verify?token=${verificationToken}`;
    } else {
      qrUrl = `${baseApiUrl}/api/v1/invoices/${invoice.id}`;
      logger.warn('Aucun token de vérification fourni -> QR sans token');
    }

    const qrImageBuffer = await generateQRCodeImage(qrUrl);
    if (qrImageBuffer) {
      const qrImage = await pdfDoc.embedPng(qrImageBuffer);

      page.drawText(cleanTextForPDF('CERTIFICAT NUMÉRIQUE'), {
        x: marginLeft + 100,
        y: currentY + 20,
        size: 11,
        font: fontBold,
        color: secondaryGreen
      });

      page.drawImage(qrImage, {
        x: marginLeft + 75,
        y: currentY - 100,
        width: 100,
        height: 100
      });

      page.drawText(cleanTextForPDF('Authentification numérique'), {
        x: marginLeft + 125,
        y: currentY - 115,
        size: 9,
        font: fontRegular,
        color: grayMedium
      });
    }

    // Signature
    page.drawText(cleanTextForPDF('POUR VALIDATION'), {
      x: width - marginRight - 150,
      y: currentY + 20,
      size: 11,
      font: fontBold,
      color: secondaryGreen
    });

    page.drawRectangle({
      x: width - marginRight - 125,
      y: currentY - 100,
      width: 100,
      height: 100,
      borderWidth: 2,
      borderColor: accentGreen,
      borderRadius: 4
    });

    page.drawText(cleanTextForPDF('Le Directeur'), {
      x: width - marginRight - 75,
      y: currentY - 40,
      size: 12,
      font: fontBold,
      color: grayDark
    });

    page.drawLine({
      start: { x: width - marginRight - 100, y: currentY - 55 },
      end: { x: width - marginRight - 50, y: currentY - 55 },
      thickness: 1,
      color: grayMedium
    });

    page.drawText(cleanTextForPDF('Signature et cachet'), {
      x: width - marginRight - 75,
      y: currentY - 70,
      size: 9,
      font: fontRegular,
      color: grayMedium
    });

    // ==================== MENTIONS LÉGALES ====================
    currentY = 120;
    page.drawLine({
      start: { x: marginLeft, y: currentY },
      end: { x: width - marginRight, y: currentY },
      thickness: 1,
      color: grayLight
    });

    currentY -= 20;
    page.drawText(cleanTextForPDF('ATTESTATION LÉGALE'), {
      x: marginLeft,
      y: currentY,
      size: 10,
      font: fontBold,
      color: secondaryGreen
    });

    currentY -= 15;
    const legalText = [
      '• Cette facture atteste du paiement complet des services mentionnés.',
      '• Les messages WhatsApp Business API ont été crédités sur le compte client.',
      '• Document légal valable comme preuve de paiement et de livraison.',
      '• Pour toute réclamation, contactez-nous dans les 30 jours suivant la date de facture.',
      '• Facture électronique - Équivalent à une facture originale signée.'
    ];

    legalText.forEach((text, index) => {
      page.drawText(cleanTextForPDF(text), {
        x: marginLeft + 10,
        y: currentY - (index * 12),
        size: 8,
        font: fontRegular,
        color: grayMedium
      });
    });

    // ==================== PIED DE PAGE ====================
    currentY = 50;
    page.drawLine({
      start: { x: marginLeft, y: currentY },
      end: { x: width - marginRight, y: currentY },
      thickness: 0.5,
      color: grayLight
    });

    // Colonnes du pied de page
    const footerColumns = [
      {
        title: 'COORDONNÉES',
        lines: [
          'BP 15368 Douala',
          'team@numericexport.com',
          '+237 696 578 107'
        ]
      },
      {
        title: 'SUPPORT CLIENT',
        lines: [
          'support@numericexport.com',
          '+237 651 019 069',
          'Lun-Ven: 8h-18h'
        ]
      },
      {
        title: 'INFORMATIONS',
        lines: [
          'RCCM: CM-DLA-02-2026-B12-00012',
          'Capital: 10.000.000 FCFA',
          'NIF: P1234567890'
        ]
      }
    ];

    const footerColWidth = contentWidth / 3;
    let footerX = marginLeft;

    footerColumns.forEach((column, colIndex) => {
      page.drawText(cleanTextForPDF(column.title), {
        x: footerX + 10,
        y: currentY - 15,
        size: 9,
        font: fontBold,
        color: secondaryGreen
      });

      column.lines.forEach((line, lineIndex) => {
        page.drawText(cleanTextForPDF(line), {
          x: footerX + 10,
          y: currentY - 30 - (lineIndex * 12),
          size: 8,
          font: fontRegular,
          color: grayMedium
        });
      });

      footerX += footerColWidth;
    });

    // Copyright
    drawCenteredText(page, `© ${new Date().getFullYear()} NEXT LTD - Facture finale générée le ${formatDateForPDF(new Date())}`, 20, 7, fontRegular, grayMedium, width);

    // ==================== SAUVEGARDE DU PDF ====================
    const pdfBytes = await pdfDoc.save();
    await fs.writeFile(pdfPath, pdfBytes);

    logger.info(`✅ Facture finale PDF générée avec succès: ${pdfPath}`);
    return pdfPath;

  } catch (error) {
    logger.error('❌ Erreur dans generateFinalInvoicePDF:', error);
    throw error;
  }
}

/**
 * Générer la facture proforma
 */
async function generateProforma(orderId, userId) {
  const client = await getClient();
  try {
    await client.query('BEGIN');

    // Récupérer la commande
    const orderResult = await client.query(
      `SELECT o.*, c.company_name, c.email, c.address, c.city, c.country, c.tax_id, c.phone
       FROM orders o
       JOIN clients c ON o.client_id = c.id
       WHERE o.id = $1`,
      [orderId]
    );

    if (orderResult.rows.length === 0) {
      throw {
        statusCode: 404,
        code: 'ORDER_NOT_FOUND',
        message: 'Commande non trouvée'
      };
    }

    const order = orderResult.rows[0];

    if (order.status !== 'validated_financial') {
      throw {
        statusCode: 400,
        code: 'INVALID_STATUS',
        message: 'La commande doit être validée par le responsable financier'
      };
    }

    // Vérifier si une proforma n'existe pas déjà
    const existingInvoice = await client.query(
      'SELECT id FROM invoices WHERE order_id = $1 AND invoice_type = $2',
      [orderId, 'proforma']
    );

    if (existingInvoice.rows.length > 0) {
      throw {
        statusCode: 400,
        code: 'PROFORMA_EXISTS',
        message: 'Une facture proforma existe déjà pour cette commande'
      };
    }

    // Générer le numéro de facture
    const invoiceNumber = generateInvoiceNumber('proforma');

    // Créer la facture proforma
    const invoiceResult = await client.query(
      `INSERT INTO invoices (
        invoice_number, order_id, client_id, invoice_type,
        subtotal, vat_amount, total_amount, status,
        issue_date, created_by, due_date
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, NOW() + INTERVAL '30 days')
      RETURNING *`,
      [
        invoiceNumber,
        orderId,
        order.client_id,
        'proforma',
        order.subtotal || 0,
        order.vat_amount || 0,
        order.total_amount || 0,
        'proforma_generated',
        new Date(),
        userId
      ]
    );

    const invoice = invoiceResult.rows[0];

    // Générer le PDF proforma avec la nouvelle structure
    const pdfPath = await generateProformaPDF(invoice, order, null);

    // Mettre à jour le chemin du PDF
    await client.query(
      'UPDATE invoices SET pdf_path = $1 WHERE id = $2',
      [pdfPath, invoice.id]
    );

    // Mettre à jour le statut de la commande
    await client.query(
      'UPDATE orders SET status = $1 WHERE id = $2',
      ['invoice_generated', orderId]
    );

    // Log d'audit
    await client.query(
      `INSERT INTO audit_logs (user_id, action, entity_type, entity_id, new_values)
       VALUES ($1, $2, $3, $4, $5)`,
      [
        userId,
        'PROFORMA_GENERATED',
        'invoice',
        invoice.id,
        JSON.stringify({ invoice_number: invoiceNumber })
      ]
    );

    await client.query('COMMIT');

    // Notification à l'équipe
    sendTeamNotification(
      'Facture proforma générée',
      `
      <h2>Facture proforma générée</h2>
      <p><strong>Numéro facture:</strong> ${invoiceNumber}</p>
      <p><strong>Commande:</strong> ${order.order_code}</p>
      <p><strong>Montant:</strong> ${Number(order.total_amount || 0).toFixed(2)} FCFA</p>
      <p><strong>Prochaine étape:</strong> Validation responsable achats</p>
      `
    ).catch(err => logger.error('Erreur notification:', err));

    logger.info('Facture proforma générée:', invoiceNumber);

    return {
      success: true,
      message: 'Facture proforma générée avec succès',
      invoice: {
        id: invoice.id,
        invoice_number: invoice.invoice_number,
        pdf_path: pdfPath
      }
    };
  } catch (error) {
    await client.query('ROLLBACK');
    logger.error('Erreur génération proforma:', error);
    throw error;
  } finally {
    client.release();
  }
}

/**
 * Générer la facture proforma avec tampon et QR code
 */
async function generateProformaWithStamp(orderId, userId) {
  const client = await getClient();
  try {
    await client.query('BEGIN');

    logger.info('📋 Début génération facture avec tampon pour commande:', orderId);

    // Récupérer les informations de la commande
    const orderResult = await client.query(
      `SELECT o.*, c.company_name, c.email as client_email, c.address as client_address,
              c.city, c.country, c.tax_id, c.phone
       FROM orders o
       JOIN clients c ON o.client_id = c.id
       WHERE o.id = $1`,
      [orderId]
    );

    if (orderResult.rows.length === 0) {
      throw {
        statusCode: 404,
        code: 'ORDER_NOT_FOUND',
        message: 'Commande non trouvée'
      };
    }

    const order = orderResult.rows[0];

    // Vérifier le statut
    if (order.status !== 'validated_financial' && order.status !== 'invoice_generated') {
      throw {
        statusCode: 400,
        code: 'INVALID_STATUS',
        message: `Statut invalide: ${order.status}. Doit être 'validated_financial' ou 'invoice_generated'`
      };
    }

    // Vérifier si une facture existe déjà
    const existingInvoice = await client.query(
      'SELECT * FROM invoices WHERE order_id = $1 AND invoice_type = $2',
      [orderId, 'proforma']
    );

    let invoice;
    if (existingInvoice.rows.length > 0) {
      invoice = existingInvoice.rows[0];
      logger.info('📄 Facture existante trouvée:', invoice.invoice_number);
    } else {
      // Créer une nouvelle facture proforma
      const invoiceNumber = generateInvoiceNumber('proforma');
      logger.info('🆕 Création nouvelle facture:', invoiceNumber);

      const newInvoice = await client.query(
        `INSERT INTO invoices (
          invoice_number, order_id, client_id, invoice_type,
          subtotal, vat_amount, total_amount, status,
          issue_date, created_by, due_date
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, NOW() + INTERVAL '30 days')
        RETURNING *`,
        [
          invoiceNumber,
          orderId,
          order.client_id,
          'proforma',
          order.subtotal || 0,
          order.vat_amount || 0,
          order.total_amount || 0,
          'proforma_generated',
          new Date(),
          userId
        ]
      );

      invoice = newInvoice.rows[0];
      logger.info('✅ Nouvelle facture créée avec statut:', invoice.status);
    }

    // Générer le QR code
    logger.info('🔐 Génération QR code...');
    const verificationToken = crypto.randomBytes(32).toString('hex');

    // Générer le PDF avec tampon (nouvelle structure)
    logger.info('🖨️  Génération PDF proforma...');
    const pdfPath = await generateProformaPDF(invoice, order, verificationToken);

    // Construire l'URL du QR code
    const qrUrl = `${process.env.API_BASE_URL || 'https://api.numericexport.com'}/api/v1/orders/invoices/${invoice.id}/verify?token=${verificationToken}`;

    // Mettre à jour l'invoice avec le token et chemin PDF
    await client.query(
      `UPDATE invoices
       SET verification_token = $1,
           qr_code_url = $2,
           stamp_applied = true,
           pdf_path = $3,
           stamp_applied_at = NOW(),
           updated_at = NOW()
       WHERE id = $4`,
      [verificationToken, qrUrl, pdfPath, invoice.id]
    );

    // Mettre à jour le statut de la commande
    await client.query(
      `UPDATE orders
       SET status = 'invoice_generated',
           invoice_generated_at = NOW(),
           updated_at = NOW()
       WHERE id = $1`,
      [orderId]
    );

    // Créer un log d'audit
    await client.query(
      `INSERT INTO audit_logs (user_id, action, entity_type, entity_id, details, created_at)
       VALUES ($1, $2, $3, $4, $5, NOW())`,
      [
        userId,
        'PROFORMA_GENERATED_WITH_STAMP',
        'invoice',
        invoice.id,
        JSON.stringify({
          invoice_number: invoice.invoice_number,
          with_stamp: true,
          pdf_generated: !!pdfPath
        })
      ]
    );

    await client.query('COMMIT');

    // Envoyer notification
    sendTeamNotification(
      'Facture proforma avec tampon générée',
      `
      <h2>✅ Facture proforma avec tampon générée</h2>
      <p><strong>Numéro facture:</strong> ${invoice.invoice_number}</p>
      <p><strong>Commande:</strong> ${order.order_code}</p>
      <p><strong>Client:</strong> ${order.company_name}</p>
      <p><strong>Montant:</strong> ${Number(order.total_amount || 0).toFixed(2)} FCFA</p>
      <p><strong>Tampon et QR code:</strong> Ajoutés</p>
      `
    ).catch(err => logger.error('Erreur notification:', err));

    logger.info('🎉 Facture avec tampon générée avec succès');

    // Construire l'URL de téléchargement
    const baseUrl = process.env.API_BASE_URL || 'https://api.numericexport.com';
    const downloadUrl = pdfPath ? `${baseUrl}/api/v1/invoices/${invoice.id}/download` : null;

    return {
      success: true,
      message: 'Facture proforma générée avec succès',
      invoice: {
        ...invoice,
        pdf_path: pdfPath,
        qr_code_url: qrUrl,
        stamp_applied: true,
        verification_token: verificationToken
      },
      download_url: downloadUrl,
      qr_code_url: qrUrl
    };

  } catch (error) {
    await client.query('ROLLBACK');
    logger.error('❌ Erreur génération proforma avec tampon:', error);
    throw error;
  } finally {
    client.release();
  }
}

/**
 * Confirmer l'achat et générer la facture finale
 */
async function confirmPurchase(orderId, userId) {
  const client = await getClient();

  try {
    await client.query('BEGIN');

    // Récupérer la commande et le client
    const orderResult = await client.query(
      `SELECT o.*, c.quota_remaining, c.company_name, c.email, c.address, c.city, c.country, c.tax_id, c.phone
       FROM orders o
       JOIN clients c ON o.client_id = c.id
       WHERE o.id = $1`,
      [orderId]
    );

    if (orderResult.rows.length === 0) {
      throw {
        statusCode: 404,
        code: 'ORDER_NOT_FOUND',
        message: 'Commande non trouvée'
      };
    }

    const order = orderResult.rows[0];

    // Vérifier s'il y a une proforma
    const proformaResult = await client.query(
      'SELECT * FROM invoices WHERE order_id = $1 AND invoice_type = $2',
      [orderId, 'proforma']
    );

    // Générer la facture finale
    const finalInvoiceNumber = generateInvoiceNumber('final');

    const finalInvoice = await client.query(
      `INSERT INTO invoices (
        invoice_number, order_id, client_id, invoice_type,
        subtotal, vat_amount, total_amount, status,
        issue_date, created_by, due_date
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, NOW() + INTERVAL '30 days')
      RETURNING *`,
      [
        finalInvoiceNumber,
        orderId,
        order.client_id,
        'final',
        order.subtotal || 0,
        order.vat_amount || 0,
        order.total_amount || 0,
        'final_generated',
        new Date(),
        userId
      ]
    );

    const invoice = finalInvoice.rows[0];

    // Générer le PDF de la facture finale
    const pdfPath = await generateFinalInvoicePDF(invoice, order, invoice.verification_token || null);

    // Mettre à jour le chemin du PDF
    await client.query(
      'UPDATE invoices SET pdf_path = $1 WHERE id = $2',
      [pdfPath, invoice.id]
    );

    // Créditer le compte client
    await client.query(
      `UPDATE clients
       SET quota_total = COALESCE(quota_total, 0) + $1,
           quota_remaining = COALESCE(quota_remaining, 0) + $1
       WHERE id = $2`,
      [order.quantity || 0, order.client_id]
    );

    // Mettre à jour la commande
    await client.query(
      `UPDATE orders
       SET status = $1,
           purchase_confirmed_by = $2,
           purchase_confirmed_at = CURRENT_TIMESTAMP
       WHERE id = $3`,
      ['purchase_completed', userId, orderId]
    );

    // Log d'audit
    await client.query(
      `INSERT INTO audit_logs (user_id, action, entity_type, entity_id, new_values)
       VALUES ($1, $2, $3, $4, $5)`,
      [
        userId,
        'PURCHASE_CONFIRMED',
        'order',
        orderId,
        JSON.stringify({
          messages_added: order.quantity || 0,
          final_invoice: finalInvoiceNumber
        })
      ]
    );

    await client.query('COMMIT');

    // Notification au client et à l'équipe
    sendTeamNotification(
      'Commande complétée - Facture finale générée',
      `
      <h2>✅ Commande complétée</h2>
      <p><strong>Client:</strong> ${order.company_name || order.email}</p>
      <p><strong>Commande:</strong> ${order.order_code}</p>
      <p><strong>Messages ajoutés:</strong> ${order.quantity || 0}</p>
      <p><strong>Facture finale:</strong> ${finalInvoiceNumber}</p>
      <p><strong>Montant:</strong> ${Number(order.total_amount || 0).toFixed(2)} FCFA</p>
      <p><strong>PDF généré:</strong> ${pdfPath ? 'Oui' : 'Non'}</p>
      `
    ).catch(err => logger.error('Erreur notification:', err));

    logger.info('Achat confirmé et compte crédité:', order.order_code);

    return {
      success: true,
      message: `Achat confirmé. ${order.quantity || 0} messages ajoutés au compte client.`,
      invoice: {
        id: invoice.id,
        invoice_number: finalInvoiceNumber,
        pdf_path: pdfPath
      }
    };

  } catch (error) {
    await client.query('ROLLBACK');
    logger.error('Erreur confirmation achat:', error);
    throw error;
  } finally {
    client.release();
  }
}

/**
 * Créer une fiche de décaissement
 */
async function createDisbursementSlip(orderId, userId, disbursementData) {
  const client = await getClient();

  try {
    await client.query('BEGIN');

    // Récupérer la facture proforma
    const invoiceResult = await client.query(
      `SELECT i.*, o.quantity, o.total_amount
       FROM invoices i
       JOIN orders o ON i.order_id = o.id
       WHERE i.order_id = $1 AND i.invoice_type = $2`,
      [orderId, 'proforma']
    );

    if (invoiceResult.rows.length === 0) {
      throw {
        statusCode: 404,
        code: 'PROFORMA_NOT_FOUND',
        message: 'Facture proforma non trouvée'
      };
    }

    const invoice = invoiceResult.rows[0];

    // Générer le numéro de fiche
    const slipNumber = generateDisbursementNumber();

    // Créer la fiche de décaissement
    const slipResult = await client.query(
      `INSERT INTO disbursement_slips (
        slip_number, invoice_id, order_id, amount, purpose,
        messages_to_purchase, purchase_cost, status, created_by
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
      RETURNING *`,
      [
        slipNumber,
        invoice.id,
        orderId,
        disbursementData.amount || 0,
        disbursementData.purpose || 'Achat messages WhatsApp 360dialog',
        disbursementData.messages_to_purchase || invoice.quantity || 0,
        disbursementData.purchase_cost || 0,
        'pending',
        userId
      ]
    );

    const slip = slipResult.rows[0];

    // Log d'audit
    await client.query(
      `INSERT INTO audit_logs (user_id, action, entity_type, entity_id, new_values)
       VALUES ($1, $2, $3, $4, $5)`,
      [
        userId,
        'DISBURSEMENT_SLIP_CREATED',
        'disbursement_slip',
        slip.id,
        JSON.stringify({ slip_number: slipNumber, amount: disbursementData.amount || 0 })
      ]
    );

    // Récupérer les données complètes pour le PDF
    const orderResult = await client.query(
      `SELECT * FROM orders WHERE id = $1`,
      [orderId]
    );
    const order = orderResult.rows[0];

    // Générer un PDF simple pour l'instant
    const disbursementsDir = process.env.DISBURSEMENTS_PATH || '/var/www/numericexport/media/disbursements';
    await fs.mkdir(disbursementsDir, { recursive: true });

    const fileName = `DECAISSEMENT_${slip.slip_number}_${new Date().toISOString().split('T')[0]}.pdf`;
    const pdfPath = path.join(disbursementsDir, fileName);
    const pdfRelativePath = `disbursements/${fileName}`;

    // Créer un PDF simple
    const pdfDoc = await PDFDocument.create();
    const page = pdfDoc.addPage([595.28, 841.89]);
    const { width, height } = page.getSize();

    const fontRegular = await pdfDoc.embedFont(StandardFonts.Helvetica);
    const fontBold = await pdfDoc.embedFont(StandardFonts.HelveticaBold);

    page.drawText(cleanTextForPDF('FICHE DE DÉCAISSEMENT'), {
      x: 50,
      y: height - 50,
      size: 24,
      font: fontBold,
      color: rgb(45/255, 80/255, 22/255)
    });

    page.drawText(cleanTextForPDF(`Numéro: ${slip.slip_number}`), {
      x: 50,
      y: height - 100,
      size: 16,
      font: fontBold
    });

    page.drawText(cleanTextForPDF(`Montant: ${disbursementData.amount || 0} FCFA`), {
      x: 50,
      y: height - 130,
      size: 14,
      font: fontRegular
    });

    page.drawText(cleanTextForPDF(`Objet: ${disbursementData.purpose || 'Achat messages WhatsApp 360dialog'}`), {
      x: 50,
      y: height - 160,
      size: 12,
      font: fontRegular
    });

    page.drawText(cleanTextForPDF(`Commandé par: ${userId}`), {
      x: 50,
      y: height - 190,
      size: 12,
      font: fontRegular
    });

    page.drawText(cleanTextForPDF(`Date: ${formatDateForPDF(new Date())}`), {
      x: 50,
      y: height - 220,
      size: 12,
      font: fontRegular
    });

    const pdfBytes = await pdfDoc.save();
    await fs.writeFile(pdfPath, pdfBytes);

    // Mettre à jour pdf_path dans disbursement_slips
    await client.query(
      `UPDATE disbursement_slips SET pdf_path = $1 WHERE id = $2`,
      [pdfRelativePath, slip.id]
    );

    await client.query('COMMIT');

    logger.info('Fiche de décaissement créée:', slipNumber);
    logger.info('PDF décaissement généré et enregistré:', pdfRelativePath);

    return {
      success: true,
      message: 'Fiche de décaissement créée avec succès',
      slip
    };

  } catch (error) {
    await client.query('ROLLBACK');
    logger.error('Erreur création fiche décaissement:', error);
    throw error;
  } finally {
    client.release();
  }
}

/**
 * Récupérer les factures d'un client
 */
async function getClientInvoices(clientId, filters = {}) {
  const client = await getClient();
  try {
    const { page = 1, limit = 5, status, type } = filters;
    const offset = (page - 1) * limit;

    let whereClause = 'WHERE i.client_id = $1';
    const params = [clientId];
    let paramIndex = 2;

    if (status) {
      whereClause += ` AND i.status = $${paramIndex}`;
      params.push(status);
      paramIndex++;
    }
    if (type) {
      whereClause += ` AND i.invoice_type = $${paramIndex}`;
      params.push(type);
      paramIndex++;
    }

    // Compter le total avec alias
    const countResult = await client.query(
      `SELECT COUNT(*) FROM invoices i ${whereClause}`,
      params
    );
    const total = parseInt(countResult.rows[0].count);

    // Récupérer les factures
    const invoicesResult = await client.query(
      `SELECT
        i.*,
        o.order_code, o.quantity
       FROM invoices i
       JOIN orders o ON i.order_id = o.id
       ${whereClause}
       ORDER BY i.created_at DESC
       LIMIT $${paramIndex} OFFSET $${paramIndex + 1}`,
      [...params, limit, offset]
    );

    return {
      success: true,
      invoices: invoicesResult.rows,
      pagination: {
        total,
        page: parseInt(page),
        limit: parseInt(limit),
        totalPages: Math.ceil(total / limit)
      }
    };
  } catch (error) {
    logger.error('Erreur récupération factures client:', error);
    throw error;
  } finally {
    client.release();
  }
}

/**
 * Récupérer les factures (pour les administrateurs)
 */
async function getInvoices(filters = {}) {
  const client = await getClient();
  try {
    const { page = 1, limit = 10, status, type, client_id } = filters;
    const offset = (page - 1) * limit;

    let whereClause = 'WHERE 1=1';
    const params = [];
    let paramIndex = 1;

    if (client_id) {
      whereClause += ` AND i.client_id = $${paramIndex}`;
      params.push(client_id);
      paramIndex++;
    }
    if (status) {
      whereClause += ` AND i.status = $${paramIndex}`;
      params.push(status);
      paramIndex++;
    }
    if (type) {
      whereClause += ` AND i.invoice_type = $${paramIndex}`;
      params.push(type);
      paramIndex++;
    }

    // Compter le total
    const countResult = await client.query(
      `SELECT COUNT(*) FROM invoices i ${whereClause}`,
      params
    );
    const total = parseInt(countResult.rows[0].count);

    // Récupérer les factures avec jointures + infos client/commande
    const invoicesResult = await client.query(
      `SELECT
        i.*,
        o.order_code,
        c.company_name,
        c.email as client_email
       FROM invoices i
       JOIN orders o ON i.order_id = o.id
       JOIN clients c ON i.client_id = c.id
       ${whereClause}
       ORDER BY i.created_at DESC
       LIMIT $${paramIndex} OFFSET $${paramIndex + 1}`,
      [...params, limit, offset]
    );

    return {
      success: true,
      invoices: invoicesResult.rows,
      pagination: {
        total,
        page: parseInt(page),
        limit: parseInt(limit),
        totalPages: Math.ceil(total / limit)
      }
    };
  } catch (error) {
    logger.error('Erreur récupération factures:', error);
    throw error;
  } finally {
    client.release();
  }
}

/**
 * Récupérer une fiche de décaissement
 */
async function getDisbursementSlip(orderId) {
  const client = await getClient();

  try {
    // Récupérer la fiche de décaissement avec ses informations
    const result = await client.query(
      `SELECT
        ds.*,
        o.order_code,
        c.company_name,
        c.email as client_email,
        i.invoice_number as proforma_invoice_number
       FROM disbursement_slips ds
       LEFT JOIN orders o ON ds.order_id = o.id
       LEFT JOIN clients c ON o.client_id = c.id
       LEFT JOIN invoices i ON ds.invoice_id = i.id
       WHERE ds.order_id = $1`,
      [orderId]
    );

    if (result.rows.length === 0) {
      throw {
        statusCode: 404,
        code: 'DISBURSEMENT_NOT_FOUND',
        message: 'Fiche de décaissement non trouvée'
      };
    }

    const slip = result.rows[0];

    // Construire l'URL complète du PDF
    const pdfUrl = slip.pdf_path
      ? `${process.env.API_BASE_URL || 'https://api.numericexport.com'}/media/${slip.pdf_path}`
      : null;

    return {
      success: true,
      disbursement: {
        ...slip,
        pdf_url: pdfUrl
      }
    };

  } catch (error) {
    logger.error('Erreur récupération fiche décaissement:', error);
    throw error;
  } finally {
    client.release();
  }
}



// ==================== EXPORT DES FONCTIONS ====================

module.exports = {
  generateProforma,
  generateProformaWithStamp,
  generateProformaPDF,
  generateFinalInvoicePDF,
  createDisbursementSlip,
  confirmPurchase,
  getClientInvoices,
  getDisbursementSlip,
  getInvoices,
  fileExists,
  convertNumberToWords,
  formatNumberForPDF,
  formatDateForPDF,
  formatFullDateForPDF,
  cleanTextForPDF,
  drawCenteredText,
  drawRightText,
  drawDashedLine,
  drawSolidLine
};
