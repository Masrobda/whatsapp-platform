const bcrypt = require('bcryptjs');
const crypto = require('crypto');

/**
 * Hash un mot de passe
 */
async function hashPassword(password) {
  const rounds = parseInt(process.env.BCRYPT_ROUNDS) || 10;
  return await bcrypt.hash(password, rounds);
}

/**
 * Compare un mot de passe avec son hash
 */
async function comparePassword(password, hash) {
  return await bcrypt.compare(password, hash);
}

/**
 * Génère un token API aléatoire
 */
function generateApiToken() {
  return 'nxt_' + crypto.randomBytes(32).toString('hex');
}

/**
 * Génère une instance API aléatoire
 */
function generateApiInstance() {
  return 'inst_' + crypto.randomBytes(16).toString('hex');
}

/**
 * Génère un token de réinitialisation de mot de passe
 */
function generateResetToken() {
  return crypto.randomBytes(32).toString('hex');
}

/**
 * Génère un code de commande unique
 */
function generateOrderCode() {
  const timestamp = Date.now().toString(36).toUpperCase();
  const random = crypto.randomBytes(3).toString('hex').toUpperCase();
  return `ORD-${timestamp}-${random}`;
}

/**
 * Génère un numéro de facture unique
 */
function generateInvoiceNumber(type = 'proforma') {
  const year = new Date().getFullYear();
  const month = String(new Date().getMonth() + 1).padStart(2, '0');
  const timestamp = Date.now().toString(36).toUpperCase();
  const prefix = type === 'proforma' ? 'PRO' : 'INV';
  return `${prefix}-${year}${month}-${timestamp}`;
}

/**
 * Génère un numéro de fiche de décaissement
 */
function generateDisbursementNumber() {
  const year = new Date().getFullYear();
  const timestamp = Date.now().toString(36).toUpperCase();
  return `DIS-${year}-${timestamp}`;
}

module.exports = {
  hashPassword,
  comparePassword,
  generateApiToken,
  generateApiInstance,
  generateResetToken,
  generateOrderCode,
  generateInvoiceNumber,
  generateDisbursementNumber,
};
