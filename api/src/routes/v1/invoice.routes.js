const express = require('express');
const router = express.Router();
const invoiceService = require('../services/invoice.service');
const auth = require('../middleware/auth');
const logger = require('../utils/logger');

// Route pour créer une fiche de décaissement
router.post('/:orderId/disbursement', auth(), async (req, res) => {
  try {
    const result = await invoiceService.createDisbursementSlip(
      req.params.orderId,
      req.user.id,
      req.body
    );
    res.json(result);
  } catch (error) {
    logger.error('Erreur création décaissement:', error);
    res.status(error.statusCode || 500).json({
      success: false,
      error: error.code || 'INTERNAL_ERROR',
      message: error.message || 'Erreur serveur'
    });
  }
});

// Route pour récupérer la fiche de décaissement
router.get('/:orderId/disbursement', auth(), async (req, res) => {
  try {
    const result = await invoiceService.getDisbursementSlip(req.params.orderId);
    res.json(result);
  } catch (error) {
    logger.error('Erreur récupération décaissement:', error);
    res.status(error.statusCode || 500).json({
      success: false,
      error: error.code || 'INTERNAL_ERROR',
      message: error.message || 'Erreur serveur'
    });
  }
});

// Route pour télécharger directement le PDF
router.get('/:orderId/disbursement/pdf', auth(), async (req, res) => {
  try {
    const result = await invoiceService.getDisbursementSlip(req.params.orderId);
    
    if (!result.disbursement.pdf_path) {
      return res.status(404).json({
        success: false,
        message: 'Fiche de décaissement non disponible'
      });
    }

    // Construire le chemin complet
    const pdfPath = path.join(
      process.env.DISBURSEMENTS_PATH || '/var/www/numericexport/media/disbursements',
      path.basename(result.disbursement.pdf_path)
    );

    // Vérifier si le fichier existe
    if (!fs.existsSync(pdfPath)) {
      return res.status(404).json({
        success: false,
        message: 'Fichier PDF non trouvé'
      });
    }

    // Envoyer le fichier
    res.download(pdfPath, `decaissement-${result.disbursement.order_code || req.params.orderId}.pdf`);

  } catch (error) {
    logger.error('Erreur téléchargement PDF:', error);
    res.status(error.statusCode || 500).json({
      success: false,
      error: error.code || 'INTERNAL_ERROR',
      message: error.message || 'Erreur serveur'
    });
  }
});

module.exports = router;
