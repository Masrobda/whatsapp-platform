const { PDFDocument, rgb, StandardFonts } = require('pdf-lib');
const fs = require('fs').promises;

async function generateSimpleInvoicePDF(order, invoice, outputPath) {
  try {
    console.log('📄 Génération PDF simple avec pdf-lib...');
    console.log('📊 Données order:', { total: order.total_amount, company: order.company_name });
    console.log('📊 Données invoice:', { number: invoice.invoice_number });
    
    // Créer un nouveau document PDF
    const pdfDoc = await PDFDocument.create();
    const page = pdfDoc.addPage([595.28, 841.89]); // A4
    
    // Polices
    const font = await pdfDoc.embedFont(StandardFonts.Helvetica);
    const fontBold = await pdfDoc.embedFont(StandardFonts.HelveticaBold);
    
    // Couleurs
    const primaryColor = rgb(45/255, 80/255, 22/255); // #2d5016
    
    // En-tête
    page.drawText('NEXT LTD - Numeric Export', {
      x: 50,
      y: 770,
      size: 20,
      font: fontBold,
      color: primaryColor
    });
    
    // Titre
    page.drawText('FACTURE PROFORMA', {
      x: 50,
      y: 720,
      size: 16,
      font: fontBold
    });
    
    // Numéro facture
    page.drawText(`N°: ${invoice.invoice_number || 'N/A'}`, {
      x: 400,
      y: 720,
      size: 12,
      font: font
    });
    
    // Client
    page.drawText(`Client: ${order.company_name || 'Non spécifié'}`, {
      x: 50,
      y: 680,
      size: 12,
      font: font
    });
    
    // Détails
    const yStart = 650;
    page.drawText(`Quantité messages: ${order.quantity || 0}`, {
      x: 50,
      y: yStart,
      size: 11,
      font: font
    });
    
    page.drawText(`Prix unitaire: ${Number(order.unit_price || 0).toFixed(2)} FCFA`, {
      x: 50,
      y: yStart - 20,
      size: 11,
      font: font
    });
    
    page.drawText(`Sous-total: ${Number(order.subtotal || 0).toFixed(2)} FCFA`, {
      x: 50,
      y: yStart - 40,
      size: 11,
      font: font
    });
    
    page.drawText(`TVA (${order.vat_rate || 0}%): ${Number(order.vat_amount || 0).toFixed(2)} FCFA`, {
      x: 50,
      y: yStart - 60,
      size: 11,
      font: font
    });
    
    // TOTAL
    page.drawText('TOTAL TTC:', {
      x: 50,
      y: yStart - 90,
      size: 14,
      font: fontBold
    });
    
    page.drawText(`${Number(order.total_amount || 0).toFixed(2)} FCFA`, {
      x: 150,
      y: yStart - 90,
      size: 14,
      font: fontBold,
      color: primaryColor
    });
    
    // Pied de page
    page.drawText('Document généré automatiquement', {
      x: 50,
      y: 100,
      size: 9,
      font: font,
      color: rgb(0.5, 0.5, 0.5)
    });
    
    page.drawText(new Date().toLocaleString('fr-FR'), {
      x: 400,
      y: 100,
      size: 9,
      font: font,
      color: rgb(0.5, 0.5, 0.5)
    });
    
    // Sauvegarder
    const pdfBytes = await pdfDoc.save();
    await fs.writeFile(outputPath, pdfBytes);
    
    const stats = await fs.stat(outputPath);
    console.log(`✅ PDF généré: ${outputPath}`);
    console.log(`📊 Taille: ${stats.size} bytes`);
    
    return outputPath;
    
  } catch (error) {
    console.error('❌ Erreur pdf-lib:', error);
    throw error;
  }
}

module.exports = { generateSimpleInvoicePDF };
