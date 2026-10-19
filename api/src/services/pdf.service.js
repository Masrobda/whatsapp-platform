// api/src/services/pdf.service.js
'use strict';

const PDFDocument = require('pdfkit');
const fs = require('fs');
const path = require('path');

/**
 * Génère le bordereau PDF (sans Puppeteer)
 * @param {Array} rows
 * @param {string[]} itinerairesList
 * @returns {Promise<Buffer>}
 */
async function generateBordereauPDF(rows, itinerairesList) {
  const itemsPerPage = 40;

  // Grouper par itinéraire
  const byItinerary = {};
  for (const row of rows) {
    const key = row.itineraires || 'INCONNU';
    if (!byItinerary[key]) byItinerary[key] = [];
    byItinerary[key].push(row);
  }
  const itineraryKeys = Object.keys(byItinerary);

  // Logo local optionnel
  let logoPath = null;
  const candidates = [
    path.join(__dirname, '../../public/assets/socad.png'),
    path.join(__dirname, '../../public/socad.png'),
    '/var/www/numericexport/api/public/assets/socad.png',
    '/var/www/numericexport/api/public/socad.png'
  ];
  for (const p of candidates) {
    if (fs.existsSync(p)) {
      logoPath = p;
      break;
    }
  }

  // Nombre total de pages
  let totalPages = 0;
  for (const key of itineraryKeys) {
    totalPages += Math.ceil(byItinerary[key].length / itemsPerPage) || 1;
  }

  return new Promise((resolve, reject) => {
    try {
      const doc = new PDFDocument({
        size: 'A4',
        margins: { top: 30, bottom: 30, left: 30, right: 30 },
        bufferPages: true
      });

      const chunks = [];
      doc.on('data', (c) => chunks.push(c));
      doc.on('end', () => resolve(Buffer.concat(chunks)));
      doc.on('error', reject);

      const pageWidth = doc.page.width - 60; // marges
      const colWidths = {
        ref: pageWidth * 0.22,
        meter: pageWidth * 0.16,
        noms: pageWidth * 0.28,
        contrat: pageWidth * 0.18,
        rapport: pageWidth * 0.16
      };

      let currentPage = 0;

      for (const itKey of itineraryKeys) {
        const itRows = byItinerary[itKey];
        const totalClients = itRows.length;
        const pagesForIt = Math.ceil(totalClients / itemsPerPage) || 1;

        for (let p = 0; p < pagesForIt; p++) {
          if (currentPage > 0) doc.addPage();
          currentPage++;

          const start = p * itemsPerPage;
          const end = Math.min(start + itemsPerPage, totalClients);
          const pageRows = itRows.slice(start, end);

          // ── Header ──
          let y = 30;
          if (logoPath) {
            try {
              doc.image(logoPath, 30, y, { height: 36 });
            } catch (_) {}
          }
          doc
            .fontSize(11)
            .fillColor('#1a6fb5')
            .font('Helvetica-Bold')
            .text(`Page ${currentPage} / ${totalPages}`, 30, y + 10, {
              width: pageWidth,
              align: 'right'
            });

          // Ligne bleue
          y = 72;
          doc
            .moveTo(30, y)
            .lineTo(30 + pageWidth, y)
            .strokeColor('#1a6fb5')
            .lineWidth(2)
            .stroke();

          // Titre
          y = 82;
          doc
            .fontSize(13)
            .fillColor('#0f5a97')
            .font('Helvetica-Bold')
            .text('CAMPAGNE DE COLLECTE DE NUMÉRO WHATSAPP', 30, y, {
              width: pageWidth,
              align: 'center'
            });

          // Barre info
          y = 105;
          doc
            .rect(30, y, pageWidth, 22)
            .fillAndStroke('#e8f2fa', '#c7dcee');

          doc
            .fontSize(9)
            .fillColor('#0f5a97')
            .font('Helvetica-Bold')
            .text(`ITINÉRAIRE : n° ${itKey}`, 36, y + 6, { continued: false });

          doc
            .font('Helvetica')
            .fillColor('#1e293b')
            .text(`Total client itinéraire : ${totalClients}`, 30 + pageWidth * 0.38, y + 6, {
              width: pageWidth * 0.3
            });

          doc
            .font('Helvetica-Bold')
            .fillColor('#0f5a97')
            .text('OK / MRA : ________', 30 + pageWidth * 0.72, y + 6, {
              width: pageWidth * 0.28
            });

          // ── Table header ──
          y = 138;
          const headers = [
            { label: 'REF GEO', w: colWidths.ref },
            { label: 'METER NO', w: colWidths.meter },
            { label: 'NOMS', w: colWidths.noms },
            { label: 'CONTRAT', w: colWidths.contrat },
            { label: 'RAPPORT', w: colWidths.rapport }
          ];

          let x = 30;
          doc.rect(30, y, pageWidth, 18).fill('#1a6fb5');
          doc.fontSize(8).fillColor('#ffffff').font('Helvetica-Bold');
          for (const h of headers) {
            doc.text(h.label, x + 3, y + 5, { width: h.w - 6 });
            x += h.w;
          }

          // ── Rows ──
          y += 18;
          doc.font('Helvetica').fontSize(8).fillColor('#1e293b');

          for (let i = 0; i < pageRows.length; i++) {
            const row = pageRows[i];
            const rowH = 16;

            if (i % 2 === 0) {
              doc.rect(30, y, pageWidth, rowH).fill('#f8fafc');
            }

            // Bordures
            doc
              .rect(30, y, pageWidth, rowH)
              .strokeColor('#c7dcee')
              .lineWidth(0.5)
              .stroke();

            const vals = [
              str(row.ref_geo),
              str(row.meter_no),
              str(row.noms),
              str(row.service_no),
              str(row.rapport)
            ];

            x = 30;
            doc.fillColor('#1e293b');
            for (let c = 0; c < vals.length; c++) {
              doc.text(vals[c], x + 3, y + 4, {
                width: headers[c].w - 6,
                ellipsis: true,
                lineBreak: false
              });
              x += headers[c].w;
            }
            y += rowH;
          }

          // Footer
          doc
            .fontSize(7)
            .fillColor('#64748b')
            .text(
              'Socadel – Campagne de collecte de numéro WhatsApp',
              30,
              doc.page.height - 40,
              { width: pageWidth, align: 'center' }
            );
        }
      }

      doc.end();
    } catch (err) {
      reject(err);
    }
  });
}

function str(v) {
  return v == null ? '' : String(v);
}

module.exports = { generateBordereauPDF };
