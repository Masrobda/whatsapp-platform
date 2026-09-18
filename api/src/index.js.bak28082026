// src/index.js
require('dotenv').config();
const fastify = require('fastify');
const cors = require('@fastify/cors');
const helmet = require('@fastify/helmet');
const rateLimit = require('@fastify/rate-limit');
const multipart = require('@fastify/multipart');
const logger = require('./utils/logger');
const v1Routes = require('./routes/v1');
const fastifyStatic = require('@fastify/static');
const path = require('path');
require('./jobs/storage-cron');
const { initSocket } = require('./socket'); // ← Correction: './socket' au lieu de './src/socket'

// Liste des origines autorisées (ajoute-les dans .env si besoin)
const allowedOrigins = new Set(
  [
    process.env.DASHBOARD_URL,
    process.env.VITRINE_URL,
    'https://dashboard.numericexport.com',
    'https://numericexport.com',
    'https://numericexport.cloud',
    'http://localhost:3000',
    'http://localhost:3001',
    'http://localhost:3003',
  ].filter(Boolean).map(o => o?.replace(/\/$/, ''))
);

// Initialisation UNIQUE de l'instance
const app = fastify({
  logger: false,
  trustProxy: true,
  requestTimeout: 30000,
  bodyLimit: 100 * 1024 * 1024, // Augmenté à 100 Mo pour les uploads
  routerOptions: {
    maxParamLength: 512
  }
});

// Route de génération PDF directe (sans préfixe)
app.post('/export-pdf/:campaignId', { preHandler: [require('./middlewares/auth.middleware').authenticateJWT] }, async (req, reply) => {
  const reportService = require('./services/report.service');
  try {
    const clientId = req.user.role === 'admin' ? (req.body.clientId || req.user.id) : req.user.id;
    const result = await reportService.generateCampaignPDF(req.params.campaignId, clientId, req.user.id, req.body);
    return reply.send(result);
  } catch (e) {
    req.log.error(e);
    return reply.code(e.statusCode || 500).send({ success: false, message: e.message });
  }
});

// Servir les fichiers statiques du dossier public à la racine
app.register(require('@fastify/static'), {
  root: path.join(__dirname, '..', 'public'),  // ← ajoute '..' pour sortir de /src
  prefix: '/assets/',
  decorateReply: false,
  wildcard: true,
  setHeaders: (res, filePath) => {
    if (filePath.endsWith('.png')) {
      res.setHeader('Content-Type', 'image/png');
      res.setHeader('Cache-Control', 'public, max-age=86400');
    }
  }
});

// ====================================================
// ENREGISTREMENT DES PLUGINS D'AUTHENTIFICATION
// ====================================================
// IMPORTANT: Enregistrer JWT et Auth avant CORS et autres plugins
app.register(require('@fastify/jwt'), {
  secret: process.env.JWT_SECRET || 'votre-secret-jwt-tres-securise'
});

// Plugin d'authentification personnalisé
app.register(require('./plugins/auth'));
app.register(require('./plugins/db'));
// ====================================================

// Enregistrement du plugin Multipart
app.register(multipart, {
  limits: {
    fileSize: 100 * 1024 * 1024 // 100MB
  }
});

// CORS - Configuration améliorée pour gérer OPTIONS et credentials
app.register(cors, {
  origin: (origin, callback) => {
    if (!origin) return callback(null, true);

    const normalized = origin.replace(/\/$/, '');
    if (allowedOrigins.has(normalized)) {
      callback(null, true);
    } else {
      logger.warn(`CORS blocked for origin: ${origin}`);
      callback(new Error('Not allowed by CORS'));
    }
  },
  methods: ['GET', 'HEAD', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'Accept', 'Origin', 'x-requested-with'],
  exposedHeaders: ['Content-Disposition'],
  credentials: true,
  preflightContinue: false,
  optionsSuccessStatus: 204
});

// Helmet - Configuration unique
app.register(helmet, {
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      styleSrc: ["'self'", "'unsafe-inline'"],
      scriptSrc: ["'self'"],
      imgSrc: ["'self'", "data:", "https:"],
      frameSrc: ["'self'", "blob:"],
      connectSrc: ["'self'", "https:"]
    }
  },
  crossOriginEmbedderPolicy: false,
  crossOriginOpenerPolicy: false,
  crossOriginResourcePolicy: { policy: "cross-origin" }
});

// Rate limiting global
app.register(rateLimit, {
  max: parseInt(process.env.RATE_LIMIT_MAX) || 100,
  timeWindow: 60000,
});


// Hook global pour CORS sur /media/* (crucial pour preflight HEAD/GET)
app.addHook('onRequest', async (request, reply) => {
  if (request.url.startsWith('/media/') || request.url.startsWith('/api/v1/invoice-disbursements/media/')) {
    const origin = request.headers.origin;
    if (origin) {
      // Autorise dynamiquement l'origine (plus souple que le Set strict)
      reply.header('Access-Control-Allow-Origin', origin);
      reply.header('Access-Control-Allow-Credentials', 'true');
      reply.header('Access-Control-Allow-Methods', 'GET, HEAD, OPTIONS');
      reply.header('Access-Control-Allow-Headers', 'Origin, X-Requested-With, Content-Type, Accept, Authorization');
      reply.header('Access-Control-Expose-Headers', 'Content-Disposition');
    }

    // Répondre immédiatement aux OPTIONS (preflight)
    if (request.method === 'OPTIONS') {
      reply.code(204).send();
      return;
    }
  }
});

// Routes principales
app.register(v1Routes, { prefix: '/api/v1' });

const watiWebhookController = require('./controllers/webhook/wati.webhook.controller');
app.post('/webhook/numericexport', watiWebhookController.handleWebhook.bind(watiWebhookController));


// Route API pour le logo (accessible via https://api.numericexport.com/api/logo.png)
app.get('/api/logo.png', async (request, reply) => {
  const fs = require('fs').promises;
  const path = require('path');

  try {
    const logoPath = '/var/www/numericexport/api/public/logo.png';
    const logoBuffer = await fs.readFile(logoPath);

    return reply
      .header('Content-Type', 'image/png')
      .header('Cache-Control', 'public, max-age=86400')
      .header('Access-Control-Allow-Origin', '*')
      .send(logoBuffer);
  } catch (error) {
    logger.error('Erreur chargement logo:', error);

    // Fallback: logo SVG simple
    const fallbackSVG = `<svg width="180" height="60" xmlns="http://www.w3.org/2000/svg">
      <rect width="180" height="60" rx="12" fill="#1e40af"/>
      <text x="90" y="35" text-anchor="middle" fill="white" font-family="Arial" font-size="20">NEXT LTD</text>
    </svg>`;

    return reply
      .header('Content-Type', 'image/svg+xml')
      .header('Cache-Control', 'public, max-age=3600')
      .header('Access-Control-Allow-Origin', '*')
      .send(fallbackSVG);
  }
});

// tracking des clics sur le lien wa.me
app.get('/go/bot', async (request, reply) => {
  const { query } = require('./config/database');
  query(
    `INSERT INTO bot_link_clicks (ip, user_agent, clicked_at) VALUES ($1, $2, NOW())`,
    [request.ip, request.headers['user-agent']]
  ).catch(() => {});

  const link = `https://wa.me/237688359040?text=${encodeURIComponent('Bonjour')}`;
  return reply.code(302).header('Location', link).send();
});

// ── SERVIR LES IMAGES STATIQUES (contournement de fastify-static) ──
app.get('/assets/:file', async (request, reply) => {
  const { file } = request.params;
  const fs = require('fs').promises;
  const path = require('path');
  const filePath = path.resolve(__dirname, '../public/assets', file);

  try {
    await fs.access(filePath);
    const data = await fs.readFile(filePath);
    const ext = path.extname(file).toLowerCase();
    const contentType = {
      '.png': 'image/png',
      '.jpg': 'image/jpeg',
      '.jpeg': 'image/jpeg',
      '.svg': 'image/svg+xml',
      '.ico': 'image/x-icon',
    }[ext] || 'application/octet-stream';

    reply.header('Content-Type', contentType);
    reply.header('Cache-Control', 'public, max-age=86400');
    return reply.send(data);
  } catch {
    return reply.code(404).send('File not found');
  }
});

// ── PAIEMENT FACTURE : point d'entrée unique (compatible WhatsApp) ──
app.get('/p/:id', async (request, reply) => {
  const factureId = request.params.id;  // correspond à {{5}}
  if (!factureId) {
    return reply.code(400).send('Identifiant manquant');
  }

  // 1. Récupérer les détails de la facture depuis le serveur distant
  let factureData;
  try {
    const axios = require('axios');
    const response = await axios.get('https://factures.camlight.cm/api/get_invoice.php', {
      params: { numero_facture: factureId },
      timeout: 5000,
    });
    if (response.data.success) {
      factureData = response.data.data;
    } else {
      return reply.code(404).send('Facture non trouvée');
    }
  } catch (error) {
    console.error('Erreur appel get_invoice.php:', error.message);
    return reply.code(500).send('Erreur serveur');
  }

  const { numero_contrat, numero_facture, client_name, montant } = factureData;

  // 2. Tracker le clic
  const { query } = require('./config/database');
  const ip = request.ip;
  const userAgent = request.headers['user-agent'] || '';
  query(
    `INSERT INTO bot_link_clicks (ip, user_agent, type, metadata, clicked_at)
     VALUES ($1, $2, 'pay', $3, NOW())`,
    [ip, userAgent, JSON.stringify({ numeroFacture: factureId, contrat: numero_contrat })]
  ).catch(() => {});

  // 3. Afficher la page de choix opérateur
  const html = `
<!DOCTYPE html>
<html lang="fr">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, viewport-fit=cover">
    <meta name="theme-color" content="#1a6fb5">
    <title>Socad'el — Paiement de facture</title>
    <style>
        :root {
            --primary: #1a6fb5;
            --primary-dark: #0f5a97;
            --primary-light: #e8f2fa;
            --text-dark: #1a2b3c;
            --text-muted: #64748b;
            --border: #e2e8f0;
        }

        * { box-sizing: border-box; margin: 0; padding: 0; -webkit-tap-highlight-color: transparent; }

        html { -webkit-text-size-adjust: 100%; }

        body {
            font-family: 'Segoe UI', -apple-system, BlinkMacSystemFont, Arial, sans-serif;
            background: linear-gradient(160deg, #f0f5fa 0%, #dceafa 100%);
            min-height: 100vh;
            min-height: 100dvh;
            display: flex;
            align-items: center;
            justify-content: center;
            padding: clamp(12px, 4vw, 24px);
        }

        .card {
            background: #ffffff;
            border-radius: 20px;
            max-width: 460px;
            width: 100%;
            box-shadow: 0 20px 50px rgba(15, 90, 151, 0.15), 0 4px 12px rgba(15, 90, 151, 0.08);
            overflow: hidden;
        }

        .accent-bar {
            height: 4px;
            background: linear-gradient(90deg, var(--primary), var(--primary-dark));
        }

        .header {
            padding: clamp(20px, 5vw, 32px) clamp(16px, 5vw, 24px) clamp(14px, 3vw, 20px);
            text-align: center;
            border-bottom: 1px solid var(--border);
        }

        .header img {
            max-height: clamp(40px, 10vw, 52px);
            max-width: 80%;
            object-fit: contain;
        }

        .subtitle {
            margin-top: 12px;
            font-size: clamp(11px, 3vw, 13px);
            font-weight: 600;
            letter-spacing: 0.6px;
            text-transform: uppercase;
            color: var(--text-muted);
        }

        .body {
            padding: clamp(18px, 5vw, 28px) clamp(16px, 5vw, 24px) clamp(16px, 4vw, 24px);
        }

        .facture-box {
            background: var(--primary-light);
            border-radius: 14px;
            padding: clamp(14px, 4vw, 18px) clamp(14px, 4vw, 20px);
            margin-bottom: clamp(18px, 5vw, 26px);
        }

        .facture-row {
            display: flex;
            justify-content: space-between;
            align-items: center;
            gap: 10px;
            padding: 7px 0;
            font-size: clamp(12.5px, 3.2vw, 14px);
        }

        .facture-row:not(:last-child) {
            border-bottom: 1px dashed #c7dcee;
        }

        .facture-row .label {
            color: var(--text-muted);
            font-weight: 500;
            white-space: nowrap;
        }

        .facture-row .value {
            color: var(--text-dark);
            font-weight: 600;
            text-align: right;
            word-break: break-word;
        }

        .montant .value {
            color: var(--primary-dark);
            font-size: clamp(16px, 4.5vw, 19px);
            font-weight: 700;
        }

        .section-title {
            font-size: clamp(13px, 3.5vw, 14px);
            font-weight: 600;
            color: var(--text-dark);
            margin-bottom: 14px;
            text-align: center;
        }

        .btn {
            display: flex;
            align-items: center;
            gap: clamp(10px, 3vw, 14px);
            width: 100%;
            padding: clamp(13px, 3.5vw, 15px) clamp(14px, 4vw, 18px);
            margin-bottom: 12px;
            font-size: clamp(13.5px, 3.5vw, 15px);
            font-weight: 600;
            border-radius: 12px;
            text-decoration: none;
            min-height: 56px;
            transition: transform 0.15s ease, box-shadow 0.15s ease;
        }

        .btn:active { transform: scale(0.98); }

        .badge {
            display: flex;
            align-items: center;
            justify-content: center;
            width: clamp(34px, 9vw, 38px);
            height: clamp(34px, 9vw, 38px);
            border-radius: 10px;
            font-size: clamp(11.5px, 3vw, 13px);
            font-weight: 800;
            flex-shrink: 0;
        }

        .orange {
            background: #fff4e8;
            color: #b35400;
            border: 1px solid #ffd9ad;
        }
        .orange .badge {
            background: #ff6600;
            color: #ffffff;
        }

        .mtn {
            background: #fffbe6;
            color: #4a4300;
            border: 1px solid #ffe999;
        }
        .mtn .badge {
            background: #ffcc00;
            color: #1a1a1a;
        }

        .btn-text {
            flex: 1;
            text-align: left;
            min-width: 0;
        }

        .btn-text small {
            display: block;
            font-weight: 400;
            font-size: clamp(10px, 2.6vw, 11px);
            opacity: 0.75;
            white-space: normal;
        }

        .chevron {
            opacity: 0.5;
            font-size: 18px;
            flex-shrink: 0;
        }

        .info {
            margin-top: 18px;
            padding: clamp(10px, 3vw, 12px) clamp(12px, 3.5vw, 14px);
            background: var(--primary-light);
            border-radius: 10px;
            font-size: clamp(11.5px, 3vw, 12.5px);
            color: var(--primary-dark);
            text-align: center;
            line-height: 1.5;
        }

        .footer {
            text-align: center;
            padding: 16px;
            font-size: 11px;
            color: var(--text-muted);
            border-top: 1px solid var(--border);
        }

        /* Petits smartphones (< 360px) */
        @media (max-width: 360px) {
            .btn-text small { display: none; }
            .facture-row .label { font-size: 12px; }
        }

        /* Tablettes et plus : légèrement plus d'air, carte un peu plus large */
        @media (min-width: 700px) {
            .card { max-width: 500px; }
        }

        /* Mode paysage sur mobile : réduire les marges verticales */
        @media (max-height: 500px) and (orientation: landscape) {
            body { align-items: flex-start; padding-top: 16px; padding-bottom: 16px; }
            .header { padding-top: 16px; padding-bottom: 12px; }
        }
    </style>
</head>
<body>
    <div class="card">
        <div class="accent-bar"></div>
        <div class="header">
            <img src="/assets/socad.png" alt="Socad'el">
            <div class="subtitle">Paiement de facture en ligne</div>
        </div>
        <div class="body">
            <div class="facture-box">
                <div class="facture-row">
                    <span class="label">Facture</span>
                    <span class="value">${numero_facture}</span>
                </div>
                <div class="facture-row">
                    <span class="label">Contrat</span>
                    <span class="value">${numero_contrat}</span>
                </div>
                ${client_name ? `
                <div class="facture-row">
                    <span class="label">Client</span>
                    <span class="value">${client_name}</span>
                </div>` : ''}
                ${montant ? `
                <div class="facture-row montant">
                    <span class="label">Montant</span>
                    <span class="value">${Number(montant).toLocaleString()} FCFA</span>
                </div>` : ''}
            </div>

            <p class="section-title">Choisissez votre opérateur pour payer</p>

             <a href="/pay/ussd?numero=${numero_facture}&contrat=${numero_contrat}&method=orange" class="btn orange">
    <img src="/assets/orange.png" width="28" height="28" alt="Orange Money" style="flex-shrink:0; border-radius:50%;">
    <span class="btn-text">Orange Money<small>Paiement instantané par USSD</small></span>
    <span class="chevron">›</span>
</a>
<a href="/pay/ussd?numero=${numero_facture}&contrat=${numero_contrat}&method=mtn" class="btn mtn">
    <img src="/assets/mtn.png" width="28" height="28" alt="MTN Mobile Money" style="flex-shrink:0; border-radius:50%;">
    <span class="btn-text">MTN Mobile Money<small>Paiement instantané par USSD</small></span>
    <span class="chevron">›</span>
</a>

            <div class="info">
                💡 En cliquant, votre application téléphone s'ouvrira avec le code de paiement pré-rempli.
            </div>
        </div>
        <div class="footer">
            © ${new Date().getFullYear()} Socad'el — Société Camerounaise d'Electricité
        </div>
    </div>
</body>
</html>
  `;
  reply.type('text/html').send(html);
});

// ── REDIRECTION VERS USSD (appelée depuis la page HTML) ──
app.get('/pay/ussd', async (request, reply) => {
  const { numero, contrat, method } = request.query;
  if (!numero || !contrat || !method) {
    return reply.code(400).send('Paramètres manquants');
  }

  let rawCode, telLink;

  if (method === 'orange') {
    // Orange Cameroun : #150*3*1*2*<numero>*1#
    rawCode = `#150*3*1*2*${numero}*1#`;
    // Encoder le # pour l'URL
    telLink = `tel:${rawCode.replace(/#/g, '%23')}`;
  } else if (method === 'mtn') {
    // MTN Cameroun : *126*2*1*1*<contrat>#
    rawCode = `*126*2*1*1*${contrat}#`;
    telLink = `tel:${rawCode.replace(/#/g, '%23')}`;
  } else {
    return reply.code(400).send('Méthode invalide');
  }

  // Page de redirection avec logo
  const html = `
<!DOCTYPE html>
<html lang="fr">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Redirection paiement Socad'el</title>
    <style>
        body { font-family: sans-serif; text-align: center; padding: 30px; background: #f5f9ff; }
        .loader { border: 4px solid #e2e8f0; border-top-color: #1a6fb5; border-radius: 50%; width: 40px; height: 40px; animation: spin 0.8s linear infinite; margin: 20px auto; }
        @keyframes spin { to { transform: rotate(360deg); } }
        a { color: #1a6fb5; font-weight: bold; }
        .logo { max-height: 60px; margin-bottom: 20px; }
    </style>
    <script>
        // Ouverture automatique de l'application téléphone
        window.location.href = '${telLink}';
    </script>
</head>
<body>
    <img src="/assets/socad.png" alt="Socad'el" class="logo">
    <h1>Redirection vers le paiement</h1>
    <div class="loader"></div>
    <p>Votre application téléphone va s'ouvrir automatiquement.</p>
    <p>Si rien ne se passe, <a href="${telLink}">cliquez ici</a>.</p>
    <p style="color:#64748b; font-size:0.9rem; margin-top:30px;">Code USSD : ${rawCode}</p>
</body>
</html>
  `;
  reply.type('text/html').send(html);
});

// Route racine
app.get('/', async () => ({
  success: true,
  message: 'NEXT LTD API v1.0',
  timestamp: new Date().toISOString(),
}));

// Servir les fichiers statiques du dossier media
app.register(require('@fastify/static'), {
  root: path.join(__dirname, '..', 'media'),
  prefix: '/media/',
  list: false,
  setHeaders: (res, path) => {
    if (path.endsWith('.pdf')) {
      res.setHeader('Content-Type', 'application/pdf');
      res.setHeader('Content-Disposition', 'inline');
      res.setHeader('Access-Control-Allow-Origin', '*'); // ou origin dynamique si besoin
      res.setHeader('Access-Control-Allow-Credentials', 'true');
    }
  },
  decorateReply: false
});

// Rate limiting spécifique pour /media/*
app.register(require('@fastify/rate-limit'), {
  max: 100,
  timeWindow: '1 minute',
  allowList: [],
  hook: 'onRequest',
  routeInfo: { url: '/media/*' }
}, { prefix: '/media' });

// 404 Handler
app.setNotFoundHandler((req, reply) => {
  reply.code(404).send({
    success: false,
    code: 'NOT_FOUND',
    message: 'Route non trouvée',
    path: req.url,
  });
});

// Error Handler
app.setErrorHandler((err, req, reply) => {
  logger.error('Server error', {
    error: err.message,
    stack: err.stack,
    url: req.url,
    method: req.method,
    statusCode: err.statusCode,
  });
  if (err.validation) {
    return reply.code(400).send({
      success: false,
      code: 'VALIDATION_ERROR',
      message: 'Erreur de validation',
      errors: err.validation,
    });
  }
  const code = err.statusCode || 500;
  reply.code(code).send({
    success: false,
    code: err.code || (code === 500 ? 'INTERNAL_ERROR' : 'ERROR'),
    message: code === 500 ? 'Une erreur interne est survenue' : err.message,
  });
});

// Démarrage du serveur
async function start() {
  try {
    const port = parseInt(process.env.PORT) || 3001;
    const address = await app.listen({ port: port, host: '0.0.0.0' });
    console.log(`✅ API démarrée sur ${address}`);
    
    // Initialisation de Socket.IO APRÈS que le serveur Fastify a démarré
    // Récupérer le serveur HTTP sous-jacent de Fastify
    const server = app.server;
    initSocket(server);
    console.log('✅ Socket.IO initialisé');
    
  } catch (err) {
    console.error('❌ ÉCHEC CRITIQUE:', err);
    process.exit(1);
  }
}


start();
