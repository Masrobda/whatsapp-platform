const {
  createOrderHandler,
  getOrdersHandler,
  getOrderByIdHandler,
  validateBySecretaryHandler,
  validateByAuditorHandler,
  validateByFinancialHandler,
  generateProformaHandler,
  createDisbursementHandler,
  confirmPurchaseHandler,
  getInvoicesHandler,
} = require('../../controllers/order.controller');
const { authenticateJWT } = require('../../middlewares/auth.middleware');
const { requireRole, ROLES } = require('../../middlewares/role.middleware');
const fs = require('fs').promises;
const path = require('path');
const { query } = require('../../config/database');

/**
 * Routes de gestion des commandes
 * @param {import('fastify').FastifyInstance} fastify
 */
async function orderRoutes(fastify, options) {
  // ============================================
  // ROUTES CLIENT
  // ============================================

  // Créer une commande
  fastify.post('/', {
    preHandler: [authenticateJWT],
    schema: {
      description: 'Créer une nouvelle commande',
      tags: ['Orders'],
      security: [{ bearerAuth: [] }],
      body: {
        type: 'object',
        required: ['quantity'],
        properties: {
          quantity: { type: 'integer', minimum: 1 }
        }
      }
    }
  }, createOrderHandler);

  // Récupérer les commandes
  fastify.get('/', {
    preHandler: [authenticateJWT],
    schema: {
      description: 'Récupérer les commandes',
      tags: ['Orders'],
      security: [{ bearerAuth: [] }],
      querystring: {
        type: 'object',
        properties: {
          page: { type: 'integer', default: 1 },
          limit: { type: 'integer', default: 5 },
          status: { type: 'string' },
          client_id: { type: 'string' },
          start_date: { type: 'string', format: 'date' },
          end_date: { type: 'string', format: 'date' }
        }
      }
    }
  }, getOrdersHandler);

  // Récupérer une commande spécifique
  fastify.get('/:id', {
    preHandler: [authenticateJWT],
    schema: {
      description: 'Récupérer une commande spécifique',
      tags: ['Orders'],
      security: [{ bearerAuth: [] }],
      params: {
        type: 'object',
        properties: {
          id: { type: 'string', format: 'uuid' }
        }
      }
    }
  }, getOrderByIdHandler);

  // ============================================
  // ROUTES VALIDATION (Équipe interne)
  // ============================================

  // Validation secrétaire/commercial
  fastify.post('/:id/validate/secretary', {
    preHandler: [
      authenticateJWT,
      requireRole(ROLES.ADMIN, ROLES.SECRETARY, ROLES.COMMERCIAL)
    ],
    schema: {
      description: 'Valider une commande (secrétaire/commercial)',
      tags: ['Orders - Validation'],
      security: [{ bearerAuth: [] }],
      params: {
        type: 'object',
        properties: {
          id: { type: 'string', format: 'uuid' }
        }
      },
      body: {
        type: 'object',
        properties: {
          notes: { type: 'string' }
        }
      }
    }
  }, validateBySecretaryHandler);

  // Validation auditeur
  fastify.post('/:id/validate/auditor', {
    preHandler: [
      authenticateJWT,
      requireRole(ROLES.ADMIN, ROLES.AUDITOR)
    ],
    schema: {
      description: 'Valider une commande (auditeur)',
      tags: ['Orders - Validation'],
      security: [{ bearerAuth: [] }],
      params: {
        type: 'object',
        properties: {
          id: { type: 'string', format: 'uuid' }
        }
      }
    }
  }, validateByAuditorHandler);

  // Validation responsable financier (sans BSP)
  fastify.post('/:id/validate/financial', {
    preHandler: [
      authenticateJWT,
      requireRole(ROLES.ADMIN, ROLES.FINANCIAL_MANAGER)
    ],
    schema: {
      description: 'Valider une commande (responsable financier)',
      tags: ['Orders - Validation'],
      security: [{ bearerAuth: [] }],
      params: {
        type: 'object',
        properties: {
          id: { type: 'string', format: 'uuid' }
        }
      }
    }
  }, validateByFinancialHandler);

  // Validation responsable financier avec BSP - VERSION COMPLÈTE AVEC FACTURE
fastify.post('/:id/validate/financial-with-bsp', {
  preHandler: [
    authenticateJWT,
    requireRole(ROLES.ADMIN, ROLES.FINANCIAL_MANAGER)
  ],
  schema: {
    description: 'Valider une commande avec BSP et générer facture avec tampon',
    tags: ['Orders - Validation'],
    security: [{ bearerAuth: [] }],
    params: {
      type: 'object',
      properties: {
        id: { type: 'string', format: 'uuid' }
      }
    },
    body: {
      type: 'object',
      required: ['bsp_id', 'purpose'],
      properties: {
        bsp_id: { type: 'string', format: 'uuid' },
        messages_to_purchase: { type: 'integer' },
        custom_cost: { type: 'number' },
        purpose: { type: 'string' }
      }
    }
  }
}, async function validateByFinancialWithBSPHandler(request, reply) {
  const { id } = request.params;
  const userId = request.user.id;
  const data = request.body;

  console.log('🔧 Validation financière avec BSP appelée:', {
    orderId: id,
    userId,
    data
  });

  try {
    const { query } = require('../../config/database');

    // 1. Vérifier que la commande existe et est au bon statut
    const orderResult = await query('SELECT * FROM orders WHERE id = $1', [id]);

    if (orderResult.rowCount === 0) {
      return reply.code(404).send({
        success: false,
        code: 'ORDER_NOT_FOUND',
        message: 'Commande non trouvée'
      });
    }

    const order = orderResult.rows[0];

    // Vérifier le statut
    if (order.status !== 'validated_auditor') {
      return reply.code(400).send({
        success: false,
        code: 'INVALID_STATUS',
        message: `La commande doit être validée par l'auditeur. Statut actuel: ${order.status}`
      });
    }

    // 2. Vérifier que le BSP existe
    const bspResult = await query('SELECT * FROM bsp_providers WHERE id = $1', [data.bsp_id]);

    if (bspResult.rowCount === 0) {
      return reply.code(404).send({
        success: false,
        code: 'BSP_NOT_FOUND',
        message: 'Fournisseur BSP non trouvé'
      });
    }

    const bsp = bspResult.rows[0];

    // 3. Calculer le coût estimé
    const quantity = data.messages_to_purchase || order.quantity;
    const messageCost = data.custom_cost || bsp.message_cost;
    const additionalCharges = bsp.additional_charges || { fixed: 0, percent: 0 };

    console.log('💰 Calcul des coûts:', {
      quantity,
      messageCost,
      additionalCharges,
      bspName: bsp.name
    });

    let totalCost = messageCost * quantity;
    totalCost += additionalCharges.fixed || 0;
    totalCost += totalCost * ((additionalCharges.percent || 0) / 100);

    console.log('🧮 Coût total calculé:', totalCost);

    // 4. Mettre à jour la commande avec les infos BSP
    try {
      const updateResult = await query(
        `UPDATE orders
         SET status = 'validated_financial',
             selected_bsp_id = $1,
             bsp_message_cost = $2,
             bsp_additional_charges = $3::jsonb,
             estimated_purchase_cost = $4,
             messages_to_purchase = $5,
             financial_purpose = $6,
             validated_financial_at = NOW(),
             validated_financial_by = $7
         WHERE id = $8
         RETURNING id, status, estimated_purchase_cost`,
        [
          data.bsp_id,
          messageCost,
          JSON.stringify(additionalCharges),
          totalCost,
          quantity,
          data.purpose,
          userId,
          id
        ]
      );

      console.log('✅ Commande mise à jour:', updateResult.rows[0]);

    } catch (updateError) {
      console.error('❌ Erreur SQL UPDATE:', updateError);
      throw updateError;
    }

    // 5. VÉRIFIER SI UNE FACTURE EXISTE DÉJÀ
    let invoiceExists = false;
    let existingInvoice = null;

    try {
      const existingInvoiceResult = await query(
        'SELECT * FROM invoices WHERE order_id = $1 AND invoice_type = $2',
        [id, 'proforma']
      );

      if (existingInvoiceResult.rowCount > 0) {
        invoiceExists = true;
        existingInvoice = existingInvoiceResult.rows[0];
        console.log('📄 Facture existante trouvée:', existingInvoice.invoice_number);
      }
    } catch (checkError) {
      console.warn('⚠️ Erreur vérification facture existante:', checkError.message);
    }

    // 6. GÉNÉRER LA FACTURE SEULEMENT SI ELLE N'EXISTE PAS
    let invoiceGenerated = false;
    let invoiceData = null;

    if (!invoiceExists) {
      try {
        console.log('🔄 Début génération facture avec tampon...');
        const invoiceService = require('../../services/invoice.service');
        invoiceData = await invoiceService.generateProformaWithStamp(id, userId);
        invoiceGenerated = true;
        console.log('✅ Facture avec tampon générée:', invoiceData.invoice?.invoice_number);
        
      } catch (invoiceError) {
        console.error('❌ Erreur génération facture avec tampon:', invoiceError);
        
        // Fallback: Essayer la génération simple
        try {
          console.log('🔄 Tentative génération simple...');
          await invoiceService.generateProforma(id, userId);
          invoiceGenerated = true;
          console.log('✅ Facture simple générée (fallback)');
        } catch (fallbackError) {
          console.error('❌ Échec génération facture simple:', fallbackError);
        }
      }
    } else {
      console.log('✅ Facture existante déjà présente:', existingInvoice.invoice_number);
      invoiceGenerated = true;
    }

    // 6. Calculer la marge pour le retour
    const margin = order.total_amount - totalCost;
    const marginPercentage = order.total_amount > 0 ? (margin / order.total_amount) * 100 : 0;

    // 7. Créer un log d'audit
    try {
      await query(
        `INSERT INTO audit_logs (action, entity_type, entity_id, user_id, details, created_at)
         VALUES ($1, $2, $3, $4, $5, NOW())`,
        [
          'FINANCIAL_VALIDATION_WITH_BSP',
          'order',
          id,
          userId,
          JSON.stringify({
            bsp_id: data.bsp_id,
            bsp_name: bsp.name,
            message_cost: messageCost,
            estimated_cost: totalCost,
            margin: margin,
            margin_percentage: marginPercentage,
            quantity: quantity,
            purpose: data.purpose,
            invoice_generated: invoiceGenerated,
            invoice_number: invoiceData?.invoice?.invoice_number,
            with_stamp: invoiceData?.invoice?.stamp_applied || false
          })
        ]
      );
    } catch (auditError) {
      console.warn('⚠️ Log audit non créé:', auditError.message);
    }

    console.log('🎉 Validation financière avec BSP réussie');

    // 8. Préparer la réponse
    const responseData = {
      success: true,
      message: invoiceGenerated
        ? 'Validation financière avec BSP effectuée et facture générée avec tampon'
        : 'Validation financière avec BSP effectuée (facture non générée)',
      data: {
        order_id: id,
        bsp: bsp.name,
        order_amount: order.total_amount,
        estimated_cost: totalCost,
        margin: margin,
        margin_percentage: marginPercentage.toFixed(2),
        invoice_generated: invoiceGenerated,
        with_stamp: invoiceData?.invoice?.stamp_applied || false,
        with_qr_code: invoiceData?.invoice?.qr_code_url ? true : false,
        invoice_number: invoiceData?.invoice?.invoice_number,
        download_url: invoiceData?.download_url || null
      }
    };

    return reply.code(200).send(responseData);

  } catch (error) {
    console.error('❌ Erreur validation financière avec BSP:', error);
    console.error('❌ Stack trace:', error.stack);

    const errorMessage = process.env.NODE_ENV === 'development'
      ? `${error.message} - ${error.stack}`
      : 'Erreur lors de la validation avec BSP';

    return reply.code(500).send({
      success: false,
      code: 'INTERNAL_ERROR',
      message: errorMessage,
      details: process.env.NODE_ENV === 'development' ? {
        error: error.message,
        stack: error.stack
      } : undefined
    });
  }
});

  // Générer facture proforma avec tampon (route dédiée)
  fastify.post('/:id/proforma-with-stamp', {
    preHandler: [
      authenticateJWT,
      requireRole(ROLES.ADMIN, ROLES.FINANCIAL_MANAGER)
    ],
    schema: {
      description: 'Générer facture proforma avec tampon et QR code',
      tags: ['Orders - Invoices'],
      security: [{ bearerAuth: [] }],
      params: {
        type: 'object',
        properties: {
          id: { type: 'string', format: 'uuid' }
        }
      }
    }
  }, async function generateProformaWithStampHandler(request, reply) {
    const { id } = request.params;
    const userId = request.user.id;

    try {
      const invoiceService = require('../../services/invoice.service');
      const result = await invoiceService.generateProformaWithStamp(id, userId);

      return reply.code(201).send({
        success: true,
        message: 'Facture proforma avec tampon générée avec succès',
        invoice: result.invoice,
        download_url: result.download_url,
        qr_code_url: result.qr_code_url
      });
    } catch (error) {
      console.error('Erreur génération facture avec tampon:', error);
      return reply.code(500).send({
        success: false,
        code: 'INVOICE_GENERATION_ERROR',
        message: error.message
      });
    }
  });

  // Route pour générer la facture manuellement (si non générée automatiquement)
fastify.post('/:id/generate-invoice', {
  preHandler: [
    authenticateJWT,
    requireRole(ROLES.ADMIN, ROLES.FINANCIAL_MANAGER)
  ],
  schema: {
    description: 'Générer manuellement la facture proforma',
    tags: ['Orders - Invoices'],
    security: [{ bearerAuth: [] }],
    params: {
      type: 'object',
      properties: {
        id: { type: 'string', format: 'uuid' }
      }
    }
  }
}, async function generateInvoiceManuallyHandler(request, reply) {
  const { id } = request.params;
  const userId = request.user.id;

  try {
    // Vérifier si une facture existe déjà
    const { query } = require('../../config/database');
    const existingResult = await query(
      'SELECT * FROM invoices WHERE order_id = $1 AND invoice_type = $2',
      [id, 'proforma']
    );

    if (existingResult.rowCount > 0) {
      const existingInvoice = existingResult.rows[0];
      
      // Vérifier si le PDF existe
      const { fileExists } = require('../../services/invoice.service');
      const pdfExists = existingInvoice.pdf_path ? await fileExists(existingInvoice.pdf_path) : false;
      
      if (pdfExists) {
        return reply.code(400).send({
          success: false,
          code: 'INVOICE_ALREADY_EXISTS',
          message: 'Une facture proforma existe déjà pour cette commande',
          invoice: {
            id: existingInvoice.id,
            invoice_number: existingInvoice.invoice_number,
            pdf_path: existingInvoice.pdf_path,
            status: existingInvoice.status
          }
        });
      } else {
        // Le PDF n'existe pas, on peut le regénérer
        console.log('⚠️ Facture existe mais PDF manquant, régénération...');
      }
    }

    // Générer la facture
    const invoiceService = require('../../services/invoice.service');
    const result = await invoiceService.generateProforma(id, userId);

    return reply.code(201).send({
      success: true,
      message: 'Facture proforma générée avec succès',
      invoice: result.invoice
    });

  } catch (error) {
    console.error('❌ Erreur génération facture manuelle:', error);
    return reply.code(500).send({
      success: false,
      code: 'INVOICE_GENERATION_ERROR',
      message: error.message || 'Erreur lors de la génération de la facture'
    });
  }
});


// Route pour vérifier une facture (public - sans auth)
fastify.get('/invoices/:id/verify', {
  schema: {
    description: 'Vérifier une facture via QR code',
    tags: ['Invoices - Public'],
    params: {
      type: 'object',
      required: ['id'],
      properties: {
        id: { type: 'string', format: 'uuid' }
      }
    },
    querystring: {
      type: 'object',
      properties: {
        token: { type: 'string' }
      }
    }
  }
}, async (request, reply) => {
  const { id } = request.params;
  const { token } = request.query;
  
  try {
    const { query } = require('../../config/database');
    
    // Vérifier la facture et le token
    const invoiceResult = await query(
      `SELECT i.*, o.order_code, c.company_name, 
              o.quantity, o.total_amount, o.created_at as order_date
       FROM invoices i
       JOIN orders o ON i.order_id = o.id
       JOIN clients c ON o.client_id = c.id
       WHERE i.id = $1 AND i.verification_token = $2`,
      [id, token]
    );
    
    if (invoiceResult.rows.length === 0) {
  // Rediriger vers une page d'erreur ou retourner une réponse
  return reply.code(404).send(`
    <html>
      <head>
        <meta charset="UTF-8">
        <title>Facture non trouvée</title>
        <style>
          body { font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; max-width: 800px; margin: 0 auto; padding: 20px; background: #f5f5f5; }
          .error-container { background: white; border-radius: 15px; padding: 40px; text-align: center; box-shadow: 0 5px 15px rgba(0,0,0,0.1); margin-top: 50px; }
          .error-icon { font-size: 64px; margin-bottom: 20px; color: #dc3545; }
          h1 { color: #333; margin-bottom: 20px; }
          p { color: #666; line-height: 1.6; }
        </style>
      </head>
      <body>
        <div class="error-container">
          <div class="error-icon">❌</div>
          <h1>Facture non trouvée ou invalide</h1>
          <p>Cette facture n'existe pas ou le lien de vérification est invalide.</p>
          <p>Veuillez vérifier le lien ou contacter le service client.</p>
        </div>
      </body>
    </html>
  `);
}

const invoice = invoiceResult.rows[0];

// Retourner une page HTML avec les informations de la facture
const html = `
<!DOCTYPE html>
<html lang="fr">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Vérification Facture — NumericExport</title>
  <link rel="preconnect" href="https://fonts.googleapis.com">
  <link href="https://fonts.googleapis.com/css2?family=Cormorant+Garamond:wght@500;600;700&family=DM+Sans:ital,opsz,wght@0,9..40,300;0,9..40,400;0,9..40,500;0,9..40,600;1,9..40,400&display=swap" rel="stylesheet">
  <style>
    /* ── Brand tokens — charte officielle ── */
    :root {
      --green:     #2d7a3e;
      --green-lt:  #3a9950;
      --green-dk:  #1e5a2f;
      --lime:      #8bc34a;
      --lime-lt:   #aed581;
      --lime-dk:   #689f38;
      --blue:      #1976d2;
      --blue-lt:   #42a5f5;
      --blue-dk:   #0d47a1;
      --n-50:      #f8faf9;
      --n-100:     #f0f7f3;
      --n-200:     #e5ebe8;
      --n-300:     #cbd5d0;
      --n-400:     #9eada5;
      --n-500:     #6b7c74;
      --n-600:     #4a5852;
      --n-700:     #2f3935;
      --n-800:     #1a1f1d;
    }

    *, *::before, *::after { margin:0; padding:0; box-sizing:border-box; }

    body {
      font-family: 'DM Sans', sans-serif;
      -webkit-font-smoothing: antialiased;
      background: var(--n-50);
      min-height: 100vh;
      display: flex; align-items: center; justify-content: center;
      padding: 40px 20px;
      position: relative;
    }

    body::before {
      content: '';
      position: fixed; inset: 0;
      background:
        radial-gradient(ellipse 65% 55% at 5% 8%,  rgba(45,122,62,.07)  0%, transparent 55%),
        radial-gradient(ellipse 55% 50% at 95% 92%, rgba(139,195,74,.06) 0%, transparent 55%),
        radial-gradient(ellipse 50% 45% at 50% 50%, rgba(25,118,210,.03) 0%, transparent 60%);
      pointer-events: none; z-index: 0;
    }
    body::after {
      content: '';
      position: fixed; inset: 0;
      background-image:
        repeating-linear-gradient(0deg,  transparent, transparent 47px, rgba(45,122,62,.018) 48px),
        repeating-linear-gradient(90deg, transparent, transparent 47px, rgba(45,122,62,.018) 48px);
      pointer-events: none; z-index: 0;
    }

    .wrapper { position: relative; z-index: 1; width: 100%; max-width: 800px; }

    /* ── Card ── */
    .card {
      background: #fff;
      border-radius: 8px;
      border: 1px solid var(--n-200);
      box-shadow: 0 1px 3px rgba(0,0,0,.04), 0 8px 24px rgba(0,0,0,.07), 0 32px 56px rgba(0,0,0,.05);
      overflow: hidden;
      opacity: 0; transform: translateY(22px);
      animation: rise .65s cubic-bezier(.22,.61,.36,1) .08s forwards;
    }

    @keyframes rise { to { opacity:1; transform:translateY(0); } }

    /* Stripe */
    .stripe {
      height: 5px;
      background: linear-gradient(90deg, var(--green-dk) 0%, var(--green) 35%, var(--lime) 70%, var(--blue-lt) 100%);
    }

    /* ── Header ── */
    .header {
      padding: 36px 48px 32px;
      background: linear-gradient(135deg, var(--green-dk) 0%, var(--green) 65%, #2d7540 100%);
      position: relative; overflow: hidden;
    }
    .header::before {
      content:''; position:absolute; top:-70px; right:-70px;
      width:240px; height:240px;
      background: radial-gradient(circle, rgba(139,195,74,.11) 0%, transparent 70%);
      border-radius:50%; pointer-events:none;
    }
    .header::after {
      content:''; position:absolute; bottom:-50px; left:-50px;
      width:180px; height:180px;
      background: radial-gradient(circle, rgba(25,118,210,.09) 0%, transparent 70%);
      border-radius:50%; pointer-events:none;
    }

    /* Corner filets */
    .fc { position:absolute; width:22px; height:22px; border-style:solid; border-color:rgba(139,195,74,.3); }
    .fc-tl { top:14px; left:14px; border-width:2px 0 0 2px; }
    .fc-tr { top:14px; right:14px; border-width:2px 2px 0 0; }
    .fc-bl { bottom:14px; left:14px; border-width:0 0 2px 2px; }
    .fc-br { bottom:14px; right:14px; border-width:0 2px 2px 0; }

    .header-inner {
      position:relative; z-index:1;
      display:flex; align-items:center;
      justify-content:space-between; gap:24px;
    }

    .brand { display:flex; align-items:center; gap:16px; }

    .logo-wrap {
      width:58px; height:58px; border-radius:12px;
      background: rgba(255,255,255,.13);
      border: 1.5px solid rgba(255,255,255,.25);
      padding:8px; display:flex; align-items:center;
      justify-content:center; flex-shrink:0; overflow:hidden;
    }
    .logo-wrap img { width:100%; height:100%; object-fit:contain; }
    .logo-mono {
      font-family:'Cormorant Garamond',serif;
      font-size:20px; font-weight:700;
      color:var(--lime-lt); letter-spacing:.04em; display:none;
    }

    .brand-name {
      font-family:'Cormorant Garamond',serif;
      font-size:27px; font-weight:600;
      color:#fff; letter-spacing:.015em; line-height:1.15;
    }
    .brand-sub {
      font-size:11px; color:rgba(255,255,255,.5);
      letter-spacing:.12em; text-transform:uppercase;
      margin-top:3px; font-weight:300;
    }

    /* Seal */
    .seal {
      display:flex; align-items:center; gap:12px;
      background:rgba(255,255,255,.08);
      border:1px solid rgba(139,195,74,.28);
      border-radius:4px; padding:12px 18px;
      backdrop-filter:blur(6px); flex-shrink:0;
    }
    .seal-ring {
      width:38px; height:38px; border-radius:50%;
      border:1.5px solid rgba(139,195,74,.4);
      background:rgba(139,195,74,.1);
      display:flex; align-items:center; justify-content:center; flex-shrink:0;
    }
    .seal-ring svg { width:18px; height:18px; }
    .seal-lbl strong { display:block; font-size:13px; font-weight:600; color:var(--lime-lt); letter-spacing:.04em; }
    .seal-lbl span   { font-size:11px; color:rgba(255,255,255,.45); letter-spacing:.06em; }

    /* ── Invoice band ── */
    .inv-band {
      display:flex; align-items:center;
      justify-content:space-between; padding:15px 48px;
      background:var(--n-100); border-bottom:1px solid var(--n-200);
      flex-wrap:wrap; gap:12px;
    }
    .inv-meta-lbl { font-size:10px; letter-spacing:.14em; text-transform:uppercase; color:var(--n-500); font-weight:500; margin-bottom:2px; }
    .inv-number { font-family:'Cormorant Garamond',serif; font-size:23px; font-weight:600; color:var(--green-dk); letter-spacing:.03em; }
    .status-pill {
      display:inline-flex; align-items:center; gap:7px;
      padding:5px 14px; border-radius:100px;
      font-size:11px; font-weight:600;
      letter-spacing:.07em; text-transform:uppercase;
      background:rgba(139,195,74,.15);
      border:1px solid rgba(104,159,56,.3);
      color:var(--lime-dk);
    }
    .status-dot {
      width:7px; height:7px; border-radius:50%;
      background:var(--lime);
      box-shadow:0 0 0 3px rgba(139,195,74,.25);
      animation:pulse 2s ease infinite;
    }
    @keyframes pulse {
      0%,100% { box-shadow:0 0 0 3px rgba(139,195,74,.25); }
      50%      { box-shadow:0 0 0 5px rgba(139,195,74,.08); }
    }

    /* ── Body ── */
    .body { padding:44px 48px; }

    .sec-head { display:flex; align-items:center; gap:10px; margin-bottom:22px; }
    .sec-head-lbl { font-size:10px; letter-spacing:.16em; text-transform:uppercase; color:var(--n-500); font-weight:500; flex-shrink:0; }
    .sec-head-line { flex:1; height:1px; background:linear-gradient(90deg, var(--n-200) 0%, transparent 100%); }
    .sec-icon {
      width:28px; height:28px; background:var(--n-100);
      border:1px solid var(--n-200); border-radius:6px;
      display:flex; align-items:center; justify-content:center; flex-shrink:0;
    }
    .sec-icon svg { width:13px; height:13px; }

    /* Info grid */
    .info-grid {
      display:grid; grid-template-columns:repeat(3,1fr);
      border:1px solid var(--n-200); border-radius:6px;
      overflow:hidden; margin-bottom:32px;
      background:var(--n-200); gap:1px;
    }
    .ic { background:#fff; padding:20px 22px; transition:background .18s; }
    .ic:hover { background:var(--n-50); }
    .ic.s2 { grid-column:span 2; }

    .ic-lbl {
      font-size:10px; letter-spacing:.12em; text-transform:uppercase;
      color:var(--n-500); font-weight:500; margin-bottom:8px;
      display:flex; align-items:center; gap:6px;
    }
    .dot { width:5px; height:5px; border-radius:50%; flex-shrink:0; }
    .dot-g { background:var(--green); }
    .dot-l { background:var(--lime); }
    .dot-b { background:var(--blue); }

    .ic-val { font-size:16px; font-weight:600; color:var(--n-800); line-height:1.25; }
    .ic-val.serif { font-family:'Cormorant Garamond',serif; }
    .ic-val.big { font-size:26px; font-weight:700; color:var(--green-dk); }
    .ic-val.company { font-size:19px; color:var(--green); }
    .ic-val .unit { font-size:.52em; font-weight:500; color:var(--n-400); font-family:'DM Sans',sans-serif; }

    /* Token */
    .token-box {
      background:var(--green-dk); border-radius:6px;
      padding:18px 24px; display:flex; align-items:center;
      justify-content:space-between; gap:16px; margin-bottom:32px;
      position:relative; overflow:hidden;
    }
    .token-box::before {
      content:''; position:absolute; top:0; right:0;
      width:180px; height:100%;
      background:linear-gradient(90deg, transparent, rgba(139,195,74,.06));
      pointer-events:none;
    }
    .token-lbl { font-size:10px; color:rgba(255,255,255,.4); letter-spacing:.14em; text-transform:uppercase; margin-bottom:6px; font-weight:500; }
    .token-val { font-family:'DM Sans',monospace; font-size:13px; color:var(--lime-lt); letter-spacing:.08em; }
    .token-badge {
      flex-shrink:0; background:rgba(139,195,74,.12);
      border:1px solid rgba(139,195,74,.28); border-radius:3px;
      padding:6px 14px; font-size:11px; font-weight:600;
      color:var(--lime-lt); letter-spacing:.1em; text-transform:uppercase; white-space:nowrap;
    }

    /* Verify panel */
    .verify-panel {
      background:var(--n-100); border:1px solid var(--n-200);
      border-left:3px solid var(--green); border-radius:6px; padding:6px 0;
    }
    .vrow {
      display:flex; align-items:flex-start; gap:16px;
      padding:16px 24px; border-bottom:1px dashed var(--n-200);
      transition:background .15s;
    }
    .vrow:last-child { border-bottom:none; }
    .vrow:hover { background:rgba(255,255,255,.65); }

    .v-ico {
      width:36px; height:36px; flex-shrink:0; border-radius:8px;
      display:flex; align-items:center; justify-content:center;
    }
    .v-ico.g { background:var(--green); }
    .v-ico.l { background:var(--lime-dk); }
    .v-ico.b { background:var(--blue); }
    .v-ico svg { width:16px; height:16px; }

    .v-body strong { display:block; font-size:13px; font-weight:600; color:var(--n-800); margin-bottom:3px; }
    .v-body span   { font-size:12px; color:var(--n-500); line-height:1.5; }

    /* Footer */
    .footer {
      padding:22px 48px; border-top:1px solid var(--n-200);
      background:var(--n-50); display:flex; align-items:center;
      justify-content:space-between; gap:16px; flex-wrap:wrap;
    }
    .footer-copy { font-size:11px; color:var(--n-400); letter-spacing:.04em; line-height:1.7; }
    .footer-copy em { font-style:normal; color:var(--green); font-weight:500; }
    .footer-links { display:flex; gap:20px; }
    .footer-links a { font-size:11px; color:var(--n-400); text-decoration:none; letter-spacing:.06em; transition:color .18s; }
    .footer-links a:hover { color:var(--green); }

    @media (max-width: 680px) {
      .header { padding:26px 22px; }
      .header-inner { flex-direction:column; align-items:flex-start; }
      .inv-band { padding:14px 22px; }
      .body { padding:30px 22px; }
      .info-grid { grid-template-columns:1fr 1fr; }
      .ic.s2 { grid-column:span 2; }
      .footer { padding:18px 22px; flex-direction:column; align-items:flex-start; }
      .token-box { flex-direction:column; align-items:flex-start; }
    }
    @media (max-width: 440px) {
      .info-grid { grid-template-columns:1fr; }
      .ic.s2 { grid-column:span 1; }
      .seal { display:none; }
    }
  </style>
</head>
<body>
<div class="wrapper">
  <div class="card">

    <div class="stripe"></div>

    <!-- Header -->
    <div class="header">
      <div class="fc fc-tl"></div><div class="fc fc-tr"></div>
      <div class="fc fc-bl"></div><div class="fc fc-br"></div>

      <div class="header-inner">
        <div class="brand">
          <div class="logo-wrap">
            <img src="/assets/logook1.png" alt="NumericExport"
              onerror="this.style.display='none'; document.getElementById('lm').style.display='block';">
            <span class="logo-mono" id="lm">NE</span>
          </div>
          <div>
            <div class="brand-name">NumericExport</div>
            <div class="brand-sub">Solutions digitales professionnelles</div>
          </div>
        </div>

        <div class="seal">
          <div class="seal-ring">
            <svg viewBox="0 0 20 20" fill="none">
              <path d="M4 10.5l4.5 4.5 8-9" stroke="#aed581" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"/>
            </svg>
          </div>
          <div class="seal-lbl">
            <strong>Facture vérifiée</strong>
            <span>Document authentique</span>
          </div>
        </div>
      </div>
    </div>

    <!-- Invoice band -->
    <div class="inv-band">
      <div>
        <div class="inv-meta-lbl">Numéro de facture</div>
        <div class="inv-number">${invoice.invoice_number}</div>
      </div>
      <div class="status-pill">
        <span class="status-dot"></span>${invoice.status}
      </div>
    </div>

    <!-- Body -->
    <div class="body">

      <div class="sec-head">
        <div class="sec-icon">
          <svg viewBox="0 0 16 16" fill="none">
            <rect x="2" y="1" width="10" height="13" rx="1.5" stroke="#6b7c74" stroke-width="1.4"/>
            <path d="M5 5h6M5 8h6M5 11h4" stroke="#6b7c74" stroke-width="1.4" stroke-linecap="round"/>
          </svg>
        </div>
        <span class="sec-head-lbl">Informations de la facture</span>
        <div class="sec-head-line"></div>
      </div>

      <div class="info-grid">
        <div class="ic s2">
          <div class="ic-lbl"><span class="dot dot-g"></span>Client</div>
          <div class="ic-val serif company">${invoice.company_name}</div>
        </div>
        <div class="ic">
          <div class="ic-lbl"><span class="dot dot-l"></span>Code commande</div>
          <div class="ic-val">${invoice.order_code}</div>
        </div>
        <div class="ic">
          <div class="ic-lbl"><span class="dot dot-g"></span>Montant total</div>
          <div class="ic-val serif big">
            ${Number(invoice.total_amount).toFixed(2).replace(/\B(?=(\d{3})+(?!\d))/g, '\u202f')}
            <span class="unit"> FCFA</span>
          </div>
        </div>
        <div class="ic">
          <div class="ic-lbl"><span class="dot dot-l"></span>Quantité</div>
          <div class="ic-val">${invoice.quantity} <span style="font-size:.85em;font-weight:400;color:var(--n-400)">messages</span></div>
        </div>
        <div class="ic">
          <div class="ic-lbl"><span class="dot dot-b"></span>Date d'émission</div>
          <div class="ic-val">${new Date(invoice.issue_date).toLocaleDateString('fr-FR', { day:'2-digit', month:'long', year:'numeric' })}</div>
        </div>
      </div>

      <!-- Token -->
      <div class="token-box">
        <div>
          <div class="token-lbl">Identifiant de vérification</div>
          <div class="token-val">${token.substring(0, 24)}•••</div>
        </div>
        <div class="token-badge">Certifié ✓</div>
      </div>

      <!-- Verification -->
      <div class="sec-head" style="margin-bottom:16px">
        <div class="sec-icon">
          <svg viewBox="0 0 16 16" fill="none">
            <circle cx="8" cy="8" r="6" stroke="#6b7c74" stroke-width="1.4"/>
            <path d="M5 8.5l2 2 4-4" stroke="#6b7c74" stroke-width="1.4" stroke-linecap="round" stroke-linejoin="round"/>
          </svg>
        </div>
        <span class="sec-head-lbl">Résultat de vérification</span>
        <div class="sec-head-line"></div>
      </div>

      <div class="verify-panel">
        <div class="vrow">
          <div class="v-ico g">
            <svg viewBox="0 0 20 20" fill="none">
              <path d="M4 10.5l4.5 4.5 8-9" stroke="#fff" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
            </svg>
          </div>
          <div class="v-body">
            <strong>Vérification réussie</strong>
            <span>Cette facture est authentique et a été validée avec succès. Aucune anomalie détectée.</span>
          </div>
        </div>
        <div class="vrow">
          <div class="v-ico l">
            <svg viewBox="0 0 20 20" fill="none">
              <rect x="4" y="6" width="12" height="10" rx="1.5" stroke="#fff" stroke-width="1.7"/>
              <path d="M8 6V5a2 2 0 014 0v1" stroke="#fff" stroke-width="1.7"/>
              <circle cx="10" cy="11.5" r="1.5" fill="#fff"/>
            </svg>
          </div>
          <div class="v-body">
            <strong>Signature numérique</strong>
            <span>Intégrité du document confirmée — signé électroniquement par NumericExport.</span>
          </div>
        </div>
        <div class="vrow">
          <div class="v-ico b">
            <svg viewBox="0 0 20 20" fill="none">
              <circle cx="10" cy="10" r="7" stroke="#fff" stroke-width="1.7"/>
              <path d="M10 6.5v4l2.5 2" stroke="#fff" stroke-width="1.7" stroke-linecap="round"/>
            </svg>
          </div>
          <div class="v-body">
            <strong>Horodatage</strong>
            <span>${new Date().toLocaleDateString('fr-FR', { day:'2-digit', month:'long', year:'numeric', hour:'2-digit', minute:'2-digit' })}</span>
          </div>
        </div>
      </div>

    </div><!-- /body -->

    <!-- Footer -->
    <div class="footer">
      <div class="footer-copy">
        © ${new Date().getFullYear()} <em>NumericExport</em> · Document électroniquement certifié
      </div>
      <div class="footer-links">
        <a href="#">Confidentialité</a>
        <a href="#">Conditions</a>
        <a href="#">Support</a>
      </div>
    </div>

  </div>
</div>
</body>
</html>

`;

reply.type('text/html; charset=utf-8').send(html);

    
  } catch (error) {
    console.error('Erreur vérification facture:', error);
    return reply.code(500).send('Erreur lors de la vérification');
  }
});


  // Générer facture proforma (simple)
  fastify.post('/:id/proforma', {
    preHandler: [
      authenticateJWT,
      requireRole(ROLES.ADMIN, ROLES.FINANCIAL_MANAGER)
    ],
    schema: {
      description: 'Générer la facture proforma',
      tags: ['Orders - Invoices'],
      security: [{ bearerAuth: [] }],
      params: {
        type: 'object',
        properties: {
          id: { type: 'string', format: 'uuid' }
        }
      }
    }
  }, generateProformaHandler);

  // Créer fiche de décaissement
  fastify.post('/:id/disbursement', {
    preHandler: [
      authenticateJWT,
      requireRole(ROLES.ADMIN, ROLES.PURCHASE_MANAGER)
    ],
    schema: {
      description: 'Créer une fiche de décaissement',
      tags: ['Orders - Purchase'],
      security: [{ bearerAuth: [] }],
      params: {
        type: 'object',
        properties: {
          id: { type: 'string', format: 'uuid' }
        }
      },
      body: {
        type: 'object',
        required: ['amount', 'purchase_cost'],
        properties: {
          amount: { type: 'number' },
          purpose: { type: 'string' },
          messages_to_purchase: { type: 'integer' },
          purchase_cost: { type: 'number' }
        }
      }
    }
  }, createDisbursementHandler);

  // Confirmer l'achat
  fastify.post('/:id/confirm-purchase', {
    preHandler: [
      authenticateJWT,
      requireRole(ROLES.ADMIN, ROLES.PURCHASE_MANAGER)
    ],
    schema: {
      description: 'Confirmer l\'achat et créditer le compte client',
      tags: ['Orders - Purchase'],
      security: [{ bearerAuth: [] }],
      params: {
        type: 'object',
        properties: {
          id: { type: 'string', format: 'uuid' }
        }
      }
    }
  }, confirmPurchaseHandler);

// Vérifier le statut de la facture
fastify.get('/:id/invoice-status', {
  preHandler: [authenticateJWT],
  schema: {
    description: 'Vérifier le statut de la facture d\'une commande',
    tags: ['Orders - Invoices'],
    security: [{ bearerAuth: [] }],
    params: {
      type: 'object',
      properties: {
        id: { type: 'string', format: 'uuid' }
      }
    }
  }
}, async function checkInvoiceStatusHandler(request, reply) {
  const { id } = request.params;
  
  try {
    const { query } = require('../../config/database');
    
    // Vérifier si une facture existe
    const invoiceResult = await query(
      `SELECT i.*, o.status as order_status
       FROM invoices i
       JOIN orders o ON i.order_id = o.id
       WHERE i.order_id = $1 AND i.invoice_type = 'proforma'
       ORDER BY i.created_at DESC
       LIMIT 1`,
      [id]
    );
    
    if (invoiceResult.rowCount > 0) {
      const invoice = invoiceResult.rows[0];
      
      // Vérifier si le fichier PDF existe
      const { fileExists } = require('../../services/invoice.service');
      const pdfExists = invoice.pdf_path ? await fileExists(invoice.pdf_path) : false;
      
      return reply.code(200).send({
        success: true,
        invoice: {
          ...invoice,
          pdf_exists: pdfExists,
          pdf_url: invoice.pdf_path ? 
            `${process.env.API_BASE_URL || 'https://api.numericexport.com'}/api/v1/orders/invoices/${invoice.id}/download` : 
            null
        }
      });
    } else {
      return reply.code(200).send({
        success: true,
        invoice: null,
        order_status: await getOrderStatus(id)
      });
    }
    
  } catch (error) {
    console.error('Erreur vérification statut facture:', error);
    return reply.code(500).send({
      success: false,
      message: 'Erreur lors de la vérification'
    });
  }
});


// Régénérer une facture
fastify.post('/invoices/:id/regenerate', {
  preHandler: [
    authenticateJWT,
    requireRole(ROLES.ADMIN, ROLES.FINANCIAL_MANAGER)
  ],
  schema: {
    description: 'Régénérer une facture',
    tags: ['Invoices'],
    security: [{ bearerAuth: [] }],
    params: {
      type: 'object',
      required: ['id'],
      properties: {
        id: { type: 'string', format: 'uuid' }
      }
    }
  }
}, async (request, reply) => {
  const invoiceId = request.params.id;
  const userId = request.user.id;
  
  try {
    // Récupérer la facture
    const invoiceResult = await query(
      'SELECT * FROM invoices WHERE id = $1',
      [invoiceId]
    );
    
    if (invoiceResult.rows.length === 0) {
      return reply.code(404).send({
        success: false,
        message: 'Facture non trouvée'
      });
    }
    
    const invoice = invoiceResult.rows[0];
    
    // Régénérer la facture
    const invoiceService = require('../../services/invoice.service');
    
    let result;
    if (invoice.stamp_applied) {
      result = await invoiceService.generateProformaWithStamp(invoice.order_id, userId);
    } else {
      result = await invoiceService.generateProforma(invoice.order_id, userId);
    }
    
    return reply.code(200).send({
      success: true,
      message: 'Facture régénérée avec succès',
      invoice: result.invoice
    });
    
  } catch (error) {
    console.error('Erreur régénération:', error);
    return reply.code(500).send({
      success: false,
      message: 'Erreur lors de la régénération'
    });
  }
});



// Fonction helper pour obtenir le statut de la commande
async function getOrderStatus(orderId) {
  const { query } = require('../../config/database');
  const result = await query(
    'SELECT status FROM orders WHERE id = $1',
    [orderId]
  );
  return result.rowCount > 0 ? result.rows[0].status : null;
}

  // Récupérer fiche de décaissement
  fastify.get('/:id/disbursement', {
    preHandler: [authenticateJWT, requireRole(ROLES.ADMIN, ROLES.PURCHASE_MANAGER, ROLES.FINANCIAL_MANAGER)],
    schema: {
      description: 'Récupérer ou télécharger la fiche de décaissement',
      tags: ['Orders - Purchase'],
      security: [{ bearerAuth: [] }],
      params: { type: 'object', required: ['id'], properties: { id: { type: 'string', format: 'uuid' } } }
    }
  }, async (request, reply) => {
    const { id } = request.params;

    const result = await query(
      `SELECT ds.*, i.pdf_path as invoice_pdf
       FROM disbursement_slips ds
       JOIN invoices i ON ds.invoice_id = i.id
       WHERE ds.order_id = $1
       ORDER BY ds.created_at DESC
       LIMIT 1`,
      [id]
    );

    if (result.rowCount === 0) {
      return reply.code(404).send({ success: false, message: 'Aucune fiche de décaissement pour cette commande' });
    }

    const slip = result.rows[0];
    const baseUrl = process.env.MEDIA_BASE_URL || 'https://api.numericexport.com/media';
    const fileName = slip.pdf_path ? slip.pdf_path.split('/').pop() : `${slip.slip_number}.pdf`;
    const fileUrl = `${baseUrl}/disbursements/${fileName}`;

    return reply.send({
      success: true,
      disbursement_file_url: fileUrl,
      slip_number: slip.slip_number,
      created_at: slip.created_at,
      status: slip.status
    });
  });

  // ============================================
  // ROUTES FACTURES
  // ============================================

  // Récupérer les factures
  fastify.get('/invoices/list', {
    preHandler: [authenticateJWT],
    schema: {
      description: 'Récupérer les factures',
      tags: ['Invoices'],
      security: [{ bearerAuth: [] }],
      querystring: {
        type: 'object',
        properties: {
          page: { type: 'integer', default: 1 },
          limit: { type: 'integer', default: 5 },
          status: { type: 'string' },
          type: { type: 'string', enum: ['proforma', 'final'] },
          client_id: { type: 'string', format: 'uuid' }
        }
      }
    }
  }, getInvoicesHandler);

// Route publique pour les PDFs (sans auth)
fastify.get('/public/invoice/:filename', {
  schema: { description: 'Accès public aux factures' }
}, async (request, reply) => {
  const { filename } = request.params;
  const invoicesDir = process.env.INVOICES_PATH || '/var/www/numericexport/media/invoices';
  const filePath = path.join(invoicesDir, filename);
  
  // Sécurité : éviter les attaques path traversal
  if (!filePath.startsWith(invoicesDir)) {
    return reply.code(403).send({ error: 'Accès interdit' });
  }
  
  try {
    await fs.access(filePath);
    reply.type('application/pdf');
    reply.header('Content-Disposition', `inline; filename="${filename}"`);
    return reply.send(await fs.readFile(filePath));
  } catch {
    return reply.code(404).send({ error: 'Fichier non trouvé' });
  }
});

  // Télécharger une facture (PDF)
  fastify.get('/invoices/:id/download', {
    preHandler: [authenticateJWT],
    schema: {
      description: 'Télécharger la facture (PDF)',
      tags: ['Invoices'],
      security: [{ bearerAuth: [] }],
      params: {
        type: 'object',
        required: ['id'],
        properties: {
          id: { type: 'string', format: 'uuid' }
        }
      }
    }
  }, async (request, reply) => {
    const invoiceId = request.params.id;

    const result = await query(
      'SELECT pdf_path FROM invoices WHERE id = $1',
      [invoiceId]
    );

    if (result.rows.length === 0) {
      return reply.code(404).send({
        success: false,
        message: 'Facture non trouvée'
      });
    }

    const pdfPath = result.rows[0].pdf_path;

    // Vérifie que le fichier existe
    try {
      await fs.access(pdfPath);
    } catch {
      return reply.code(404).send({
        success: false,
        message: 'Fichier PDF non trouvé'
      });
    }

    // Envoie le PDF
    reply.type('application/pdf');
    reply.header('Content-Disposition', `attachment; filename="${path.basename(pdfPath)}"`);
    return reply.send(await fs.readFile(pdfPath));
  });
}

module.exports = orderRoutes;
