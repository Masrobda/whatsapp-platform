// Dans src/utils/pdfGenerator.js
const PDFDocument = require('pdfkit');
const fs = require('fs');
const path = require('path');

async function generateDisbursementPdf(disbursement, order) {
  return new Promise((resolve, reject) => {
    try {
      // Créer le dossier de sortie
      const uploadPath = process.env.PDF_PATH || '/var/www/numericexport/media/disbursements';
      if (!fs.existsSync(uploadPath)) {
        fs.mkdirSync(uploadPath, { recursive: true });
      }

      const fileName = `disbursement-${disbursement.slip_number}-${Date.now()}.pdf`;
      const filePath = path.join(uploadPath, fileName);

      // Pour l'instant, retournez juste un chemin fictif
      // Vous implémenterez la génération PDF plus tard
      resolve(filePath);
      
      // OU version simple immédiate :
      const doc = new PDFDocument();
      const stream = fs.createWriteStream(filePath);
      
      doc.pipe(stream);
      
      // En-tête
      doc.fontSize(20).text('FICHE DE DÉCAISSEMENT', { align: 'center' });
      doc.moveDown();
      
      // Détails
      doc.fontSize(12).text(`Numéro: ${disbursement.slip_number}`);
      doc.text(`Commande: ${order.order_code}`);
      doc.text(`Date: ${new Date().toLocaleDateString()}`);
      doc.text(`Montant: ${order.total_amount} XOF`);
      doc.text(`Fournisseur BSP: ${disbursement.bsp_id}`);
      doc.text(`Messages: ${disbursement.messages_to_purchase}`);
      doc.text(`Libellé: ${disbursement.purpose}`);
      
      doc.end();
      
      stream.on('finish', () => {
        resolve(filePath);
      });
      
      stream.on('error', reject);
      
    } catch (error) {
      reject(error);
    }
  });
}

module.exports = { generateDisbursementPdf };
