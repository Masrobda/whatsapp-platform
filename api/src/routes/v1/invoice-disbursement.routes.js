const {
  getAllInvoiceDisbursements,
  getDisbursementDetails,
  uploadReceipt,
  validateSupply,
  generateDisbursementSlip,
  verifyInvoice,
  downloadReceipt,
  getDisbursementStatistics
} = require('../../controllers/invoice-disbursement.controller');

const { authenticateJWT } = require('../../middlewares/auth.middleware');
const { requireRole, ROLES } = require('../../middlewares/role.middleware');
const multer = require('fastify-multer');
const fs = require('fs');
const path = require('path');

const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    const uploadPath = process.env.RECEIPTS_PATH || '/var/www/numericexport/media/receipts';
    if (!fs.existsSync(uploadPath)) fs.mkdirSync(uploadPath, { recursive: true });
    cb(null, uploadPath);
  },
  filename: (req, file, cb) => {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    const safeName = file.originalname.replace(/[^a-zA-Z0-9.-]/g, '_');
    cb(null, 'receipt-' + uniqueSuffix + '-' + safeName);
  }
});

const upload = multer({
  storage,
  limits: { fileSize: 10 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    const allowed = ['image/jpeg', 'image/png', 'image/heic', 'application/pdf', 'image/jpg'];
    cb(null, allowed.includes(file.mimetype));
  }
});

async function invoiceDisbursementRoutes(fastify, options) {
  fastify.get('/', {
    preHandler: [authenticateJWT, requireRole(ROLES.ADMIN, ROLES.FINANCIAL_MANAGER, ROLES.PURCHASE_MANAGER)]
  }, getAllInvoiceDisbursements);

  fastify.get('/disbursement/:id', {
    preHandler: [authenticateJWT, requireRole(ROLES.ADMIN, ROLES.FINANCIAL_MANAGER, ROLES.PURCHASE_MANAGER)]
  }, getDisbursementDetails);

  fastify.post('/order/:orderId/generate-slip', {
    preHandler: [authenticateJWT, requireRole(ROLES.ADMIN, ROLES.PURCHASE_MANAGER)]
  }, generateDisbursementSlip);

  fastify.post('/:disbursementId/upload-receipt', {
    preHandler: [authenticateJWT, requireRole(ROLES.ADMIN, ROLES.PURCHASE_MANAGER), upload.single('receipt')]
  }, uploadReceipt);

  fastify.post('/:disbursementId/validate-supply', {
    preHandler: [authenticateJWT, requireRole(ROLES.ADMIN, ROLES.PURCHASE_MANAGER)]
  }, validateSupply);

  fastify.get('/media/disbursements/:filename', async (request, reply) => {
    const { filename } = request.params;
    if (!filename.match(/^DEC-[0-9]{6}-[0-9]+\.pdf$/)) return reply.code(400).send({ message: 'Nom invalide' });
    const dir = process.env.DISBURSEMENTS_PATH || '/var/www/numericexport/media/disbursements';
    const filePath = path.join(dir, filename);
    try {
      await fs.promises.access(filePath);
      reply.header('Content-Type', 'application/pdf');
      reply.header('Content-Disposition', `inline; filename="${filename}"`);
      return reply.send(fs.createReadStream(filePath));
    } catch {
      return reply.code(404).send({ message: 'Fichier introuvable' });
    }
  });

  fastify.get('/media/receipts/:filename', async (request, reply) => {
    const { filename } = request.params;
    if (!filename.match(/^receipt-[0-9a-fA-F-]+-[0-9]+-[\w.-]+$/)) return reply.code(400).send({ message: 'Nom invalide' });
    const dir = process.env.RECEIPTS_PATH || '/var/www/numericexport/media/receipts';
    const filePath = path.join(dir, filename);
    try {
      await fs.access(filePath);
      const ext = path.extname(filename).toLowerCase();
      const mime = { '.pdf': 'application/pdf', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.png': 'image/png', '.heic': 'image/heic' };
      reply.header('Content-Type', mime[ext] || 'application/octet-stream');
      reply.header('Content-Disposition', `inline; filename="${filename}"`);
      return reply.send(fs.createReadStream(filePath));
    } catch {
      return reply.code(404).send({ message: 'Reçu introuvable' });
    }
  });

  fastify.get('/media/invoices/:filename', async (request, reply) => {
    const { filename } = request.params;
    if (!filename.match(/^[a-zA-Z0-9_-]+\.pdf$/)) return reply.code(400).send({ message: 'Nom invalide' });
    const dir = process.env.INVOICES_PATH || '/var/www/numericexport/media/invoices';
    const filePath = path.join(dir, filename);
    try {
      await fs.access(filePath);
      reply.header('Content-Type', 'application/pdf');
      reply.header('Content-Disposition', `inline; filename="${filename}"`);
      return reply.send(fs.createReadStream(filePath));
    } catch {
      return reply.code(404).send({ message: 'Facture introuvable' });
    }
  });

  fastify.get('/download/receipt/:disbursementId', {
    preHandler: [authenticateJWT, requireRole(ROLES.ADMIN, ROLES.FINANCIAL_MANAGER, ROLES.PURCHASE_MANAGER)]
  }, downloadReceipt);

  fastify.get('/verify/:invoiceId', verifyInvoice);

  fastify.get('/media/status', {
    preHandler: [authenticateJWT, requireRole(ROLES.ADMIN)]
  }, async (request, reply) => {
    const folders = {
      receipts: process.env.RECEIPTS_PATH || '/var/www/numericexport/media/receipts',
      disbursements: process.env.DISBURSEMENTS_PATH || '/var/www/numericexport/media/disbursements',
      invoices: process.env.INVOICES_PATH || '/var/www/numericexport/media/invoices'
    };
    const status = {};
    for (const [name, p] of Object.entries(folders)) {
      try {
        await fs.access(p);
        status[name] = { exists: true, files: (await fs.readdir(p)).length };
      } catch (e) {
        status[name] = { exists: false, error: e.message };
      }
    }
    return reply.send({ success: true, data: status });
  });

  fastify.get('/health', async () => ({
    success: true,
    timestamp: new Date().toISOString(),
    status: 'operational'
  }));
}

module.exports = invoiceDisbursementRoutes;
