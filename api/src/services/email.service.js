// src/services/email.service.js
const nodemailer = require('nodemailer');
const notificationService = require('./notification.service');
const logger = require('../utils/logger');
require('dotenv').config();

// Configuration du transporteur SMTP
const transporter = nodemailer.createTransport({
  host: process.env.SMTP_HOST,
  port: process.env.SMTP_PORT,
  secure: process.env.SMTP_SECURE === 'true',
  auth: {
    user: process.env.SMTP_USER,
    pass: process.env.SMTP_PASSWORD,
  },
});



// === Activer les logs détaillés de nodemailer (très utile pour debug) ===
transporter.on('debug', (info) => {
  // info est un objet avec level, message, etc.
  logger.debug('[nodemailer debug]', {
    level: info.level,
    message: info.message,
    // on peut filtrer les infos sensibles si besoin
  });
});

transporter.on('log', (info) => {
  logger.info('[nodemailer log]', info);
});

transporter.on('error', (err) => {
  logger.error('[nodemailer error]', {
    message: err.message,
    code: err.code,
    command: err.command,
  });
});


// Vérification de la configuration
transporter.verify((error, success) => {
  if (error) {
    logger.error('Erreur configuration email:', error);
  } else {
    logger.info('✅ Serveur email prêt');
  }
});

/**
 * Template email de bienvenue client
 */
function getWelcomeEmailTemplate(clientData) {
  return `
<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <style>
    body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
    .container { max-width: 600px; margin: 0 auto; padding: 20px; }
    .header { background: linear-gradient(135deg, #2d5016 0%, #8bc34a 100%); color: white; padding: 30px; text-align: center; border-radius: 10px 10px 0 0; }
    .content { background: #f9f9f9; padding: 30px; border-radius: 0 0 10px 10px; }
    .credentials { background: white; padding: 20px; border-left: 4px solid #8bc34a; margin: 20px 0; }
    .button { display: inline-block; background: #2d5016; color: white; padding: 12px 30px; text-decoration: none; border-radius: 5px; margin: 20px 0; }
    .footer { text-align: center; margin-top: 30px; color: #666; font-size: 12px; }
    .warning { background: #fff3cd; border-left: 4px solid #ffc107; padding: 15px; margin: 20px 0; }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <h1>🎉 Bienvenue chez NEXT LTD</h1>
      <p>Votre compte WhatsApp Business API est prêt !</p>
    </div>
    <div class="content">
      <p>Bonjour <strong>${clientData.company_name || clientData.email}</strong>,</p>

      <p>Nous sommes ravis de vous accueillir sur notre plateforme d'intégration WhatsApp Business API.</p>

      <div class="credentials">
        <h3>🔐 Vos identifiants de connexion</h3>
        <p><strong>Email :</strong> ${clientData.email}</p>
        <p><strong>Dashboard :</strong> <a href="${process.env.DASHBOARD_URL}">${process.env.DASHBOARD_URL}</a></p>
      </div>

      <div class="warning">
        <h3>🎁 Offre de bienvenue</h3>
        <p><strong>25 messages gratuits</strong> pour tester notre service pendant 5 jours (5 messages/jour maximum).</p>
        <p>Vous pouvez consulter vos identifiants API dans votre dashboard (section Documentation API).</p>
      </div>

      <a href="${process.env.DASHBOARD_URL}" class="button">Accéder à mon Dashboard</a>

      <h3>📚 Prochaines étapes :</h3>
      <ol>
        <li>Connectez-vous à votre dashboard</li>
        <li>Consultez la documentation API</li>
        <li>Testez l'envoi de votre premier message</li>
        <li>Passez commande pour continuer après la période d'essai</li>
      </ol>

      <p>Notre équipe est à votre disposition pour toute question.</p>

      <p>Cordialement,<br><strong>L'équipe NEXT LTD</strong></p>
    </div>
    <div class="footer">
      <p>NEXT LTD - Numeric EXport Technologies</p>
      <p>Email: team@numericexport.com | Web: ${process.env.VITRINE_URL}</p>
    </div>
  </div>
</body>
</html>
  `;
}

/**
 * Template email de réinitialisation de mot de passe
 */

function getResetPasswordTemplate(resetData) {
  const resetUrl = `${process.env.DASHBOARD_URL}/reset-password?token=${resetData.token}`;
  const logoUrl = 'https://api.numericexport.com/api/logo.png'; // ou ton URL logo

  return `
<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <style>
    body { font-family: 'Segoe UI', Arial, sans-serif; line-height: 1.6; color: #333; margin:0; padding:0; background:#f5f5f5; }
    .container { max-width: 600px; margin: 20px auto; background: white; border-radius: 12px; overflow: hidden; box-shadow: 0 4px 20px rgba(0,0,0,0.1); }
    .header { background: linear-gradient(135deg, #2d5016 0%, #8bc34a 100%); color: white; padding: 40px 30px; text-align: center; }
    .logo-img { max-width: 140px; height: auto; margin-bottom: 15px; }
    .content { padding: 40px 30px; }
    .button { display: inline-block; background: #2d5016; color: white; padding: 14px 40px; text-decoration: none; border-radius: 50px; font-weight: 600; font-size: 16px; transition: all 0.3s; }
    .button:hover { background: #1e3a10; transform: translateY(-2px); box-shadow: 0 6px 15px rgba(45,80,22,0.3); }
    .link-box { background: #f8f9fa; padding: 12px 16px; border-radius: 8px; word-break: break-all; font-size: 14px; margin: 20px 0; }
    .warning { background: #ffebee; border-left: 4px solid #f44336; padding: 16px; margin: 25px 0; border-radius: 6px; }
    .footer { background: #2d5016; color: white; text-align: center; padding: 25px; font-size: 13px; }
    @media (max-width: 600px) { .container { margin: 10px; } .content, .header { padding: 30px 20px; } }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <img src="${logoUrl}" alt="NEXT LTD" class="logo-img">
      <h1 style="margin:0; font-size:28px;">Réinitialisation de mot de passe</h1>
    </div>
    <div class="content">
      <p>Bonjour,</p>
      <p>Une demande de réinitialisation de mot de passe a été effectuée pour votre compte NEXT LTD.</p>
      <div style="text-align:center; margin:35px 0;">
        <a href="${resetUrl}" class="button">Réinitialiser mon mot de passe</a>
      </div>
      <p>Ou copiez ce lien :</p>
      <div class="link-box">${resetUrl}</div>
      <div class="warning">
        <strong>Attention :</strong><br>
        Ce lien expire dans <strong>1 heure</strong>.<br>
        Si vous n'êtes pas à l'origine de cette demande, ignorez cet email.
      </div>
      <p>Cordialement,<br><strong>L'équipe NEXT LTD</strong></p>
    </div>
    <div class="footer">
      Numeric EXport Technologies | Douala, Cameroun<br>
      <a href="${process.env.VITRINE_URL}" style="color:#8bc34a;">${process.env.VITRINE_URL}</a>
    </div>
  </div>
</body>
</html>
  `;
}

/**
 * Template email invitation utilisateur amélioré
 */
function getInvitationEmailTemplate(invitationData) {
  const invitationUrl = `${process.env.FRONTEND_URL || process.env.DASHBOARD_URL}/register/invitation?token=${invitationData.token}`;
  const logoUrl = 'https://api.numericexport.com/api/logo.png';
  
  const formattedDate = new Date(invitationData.expires_at).toLocaleDateString('fr-FR', {
    weekday: 'long',
    year: 'numeric',
    month: 'long',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit'
  });

  const roleTranslations = {
    'admin': 'Administrateur',
    'secretaire': 'Secrétaire',
    'commercial': 'Commercial',
    'auditeur': 'Auditeur',
    'responsable_achat': 'Responsable Achats',
    'responsable_financier': 'Responsable Financier'
  };

  const roleName = roleTranslations[invitationData.role] || invitationData.role;

  return `
<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <style>
    body { font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; line-height: 1.6; color: #333; margin: 0; padding: 0; background-color: #f5f5f5; }
    .container { max-width: 600px; margin: 20px auto; background: white; border-radius: 10px; overflow: hidden; box-shadow: 0 4px 6px rgba(0,0,0,0.1); }
    .header { background: linear-gradient(135deg, #2d5016 0%, #8bc34a 100%); color: white; padding: 40px 30px; text-align: center; }
   
    /* STYLE DU LOGO RESPONSIVE */
    .logo-img {
      max-width: 128px; /* Taille originale */
      width: 100%;      /* S'adapte sur mobile */
      height: auto;     /* Garde les proportions */
      margin-bottom: 15px;
      display: inline-block;
    }
   
    .header h1 { margin: 0; font-size: 28px; font-weight: 600; }
    .header p { margin: 10px 0 0; opacity: 0.9; }
    .content { padding: 40px 30px; }
    .welcome { font-size: 18px; margin-bottom: 25px; color: #2d5016; }
    .details-card { background: #f8f9fa; border-left: 4px solid #2d5016; padding: 25px; margin: 25px 0; border-radius: 8px; }
    .detail-item { margin-bottom: 12px; display: flex; }
    .detail-label { font-weight: 600; color: #2d5016; min-width: 150px; }
    .detail-value { color: #555; }
    .button-container { text-align: center; margin: 35px 0; }
    .invite-button { display: inline-block; background: linear-gradient(135deg, #2d5016 0%, #8bc34a 100%); color: white; padding: 16px 40px; text-decoration: none; border-radius: 50px; font-size: 18px; font-weight: 600; transition: transform 0.3s, box-shadow 0.3s; box-shadow: 0 4px 15px rgba(45, 80, 22, 0.3); }
    .invite-button:hover { transform: translateY(-2px); box-shadow: 0 6px 20px rgba(45, 80, 22, 0.4); }
    .link-box { background: #f8f9fa; padding: 15px; border-radius: 8px; margin: 20px 0; word-break: break-all; font-family: monospace; font-size: 14px; color: #555; border: 1px dashed #ddd; }
    .instructions { background: #fff3cd; border-left: 4px solid #ffc107; padding: 20px; margin: 25px 0; border-radius: 8px; }
    .instructions h3 { color: #856404; margin-top: 0; }
    .footer { background: #2d5016; color: white; text-align: center; padding: 25px 30px; font-size: 14px; }
    .footer a { color: #8bc34a; text-decoration: none; }
    .footer a:hover { text-decoration: underline; }
    .logo { font-size: 24px; font-weight: 700; margin-bottom: 10px; color: #8bc34a; }
    @media (max-width: 600px) {
      .container { margin: 10px; }
      .header, .content { padding: 25px 20px; }
      .detail-item { flex-direction: column; }
      .detail-label { margin-bottom: 5px; }
      .logo-img { max-width: 100px; }
    }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
    <img src="${logoUrl}" alt="NEXT LTD" class="logo-img">
      <h1>🎉 Invitation à rejoindre NEXT LTD</h1>
      <p>Vous avez été invité(e) à rejoindre notre plateforme</p>
    </div>
    
    <div class="content">
      <p class="welcome">Bonjour,</p>
      
      <p>Vous avez été invité(e) par <strong>${invitationData.created_by || 'un administrateur'}</strong> à rejoindre la plateforme NEXT LTD en tant que <strong>${roleName}</strong>.</p>
      
      <div class="details-card">
        <div class="detail-item">
          <span class="detail-label">📋 Rôle attribué :</span>
          <span class="detail-value">${roleName}</span>
        </div>
        <div class="detail-item">
          <span class="detail-label">📅 Date d'expiration :</span>
          <span class="detail-value">${formattedDate}</span>
        </div>
        <div class="detail-item">
          <span class="detail-label">🎫 Utilisations :</span>
          <span class="detail-value">${invitationData.max_uses || 1} utilisation(s) maximum</span>
        </div>
        <div class="detail-item">
          <span class="detail-label">🔐 Permissions :</span>
          <span class="detail-value">${(invitationData.permissions || []).join(', ') || 'Défaut selon le rôle'}</span>
        </div>
      </div>
      
      <div class="button-container">
        <a href="${invitationUrl}" class="invite-button">👥 Accepter l'invitation</a>
      </div>
      
      <p>Si le bouton ne fonctionne pas, copiez-collez ce lien dans votre navigateur :</p>
      <div class="link-box">${invitationUrl}</div>
      
      <div class="instructions">
        <h3>📝 Instructions importantes</h3>
        <ul style="margin: 10px 0; padding-left: 20px;">
          <li>Ce lien est personnel et confidentiel</li>
          <li>Il expirera le <strong>${formattedDate}</strong></li>
          <li>Vous ne pouvez l'utiliser que <strong>${invitationData.max_uses || 1} fois</strong></li>
          <li>Après expiration, vous devrez demander une nouvelle invitation</li>
        </ul>
      </div>
      
      <p>Une fois votre compte créé, vous aurez accès à toutes les fonctionnalités de la plateforme selon votre rôle.</p>
      
      <p>Si vous avez des questions, n'hésitez pas à nous contacter.</p>
      
      <p>Cordialement,<br><strong>L'équipe NEXT LTD</strong></p>
    </div>
    
    <div class="footer">
      <div class="logo">NEXT LTD</div>
      <p>Numeric EXport Technologies - Plateforme de gestion commerciale</p>
      <p>📍 Douala, Cameroun | 📧 <a href="mailto:team@numericexport.com">team@numericexport.com</a></p>
      <p style="margin-top: 15px; opacity: 0.8; font-size: 12px;">
        Cet email a été envoyé automatiquement. Si vous n'avez pas sollicité cette invitation, veuillez l'ignorer.
      </p>
      <img src="${logoUrl}" alt="NEXT LTD Logo" class="logo-img">
    </div>
  </div>
</body>
</html>
  `;
}

/**
 * Template email invitation text version
 */
function getInvitationEmailText(invitationData) {
  const invitationUrl = `${process.env.FRONTEND_URL || process.env.DASHBOARD_URL}/register?token=${invitationData.token}`;
  const formattedDate = new Date(invitationData.expires_at).toLocaleDateString('fr-FR');
  
  return `
INVITATION À REJOINDRE NEXT LTD

Bonjour,

Vous avez été invité(e) par ${invitationData.created_by || 'un administrateur'} à rejoindre la plateforme NEXT LTD en tant que ${invitationData.role}.

DÉTAILS DE L'INVITATION :
- Rôle : ${invitationData.role}
- Date d'expiration : ${formattedDate}
- Utilisations maximum : ${invitationData.max_uses || 1}
- Permissions : ${(invitationData.permissions || []).join(', ') || 'Défaut selon le rôle'}

POUR ACCEPTER L'INVITATION :
${invitationUrl}

INSTRUCTIONS IMPORTANTES :
- Ce lien est personnel et confidentiel
- Il expirera le ${formattedDate}
- Vous ne pouvez l'utiliser que ${invitationData.max_uses || 1} fois
- Après expiration, vous devrez demander une nouvelle invitation

Une fois votre compte créé, vous aurez accès à toutes les fonctionnalités de la plateforme selon votre rôle.

Si vous avez des questions, n'hésitez pas à nous contacter.

Cordialement,
L'équipe NEXT LTD

NEXT LTD - Numeric EXport Technologies
Douala, Cameroun
Email: team@numericexport.com

Cet email a été envoyé automatiquement. Si vous n'avez pas sollicité cette invitation, veuillez l'ignorer.
  `;
}

/**
 * Envoyer un email de bienvenue
 */
async function sendWelcomeEmail(clientData) {
  try {
    const info = await transporter.sendMail({
      from: process.env.EMAIL_FROM,
      to: clientData.email,
      subject: '🎉 Bienvenue chez NEXT LTD - Votre compte est créé',
      html: getWelcomeEmailTemplate(clientData),
    });

    logger.info('Email de bienvenue envoyé:', info.messageId);
    return { success: true, messageId: info.messageId };
  } catch (error) {
    logger.error('Erreur envoi email de bienvenue:', error);
    throw error;
  }
}

/**
 * Envoyer un email de réinitialisation
 */
async function sendResetPasswordEmail(email, token) {
  try {
    const info = await transporter.sendMail({
      from: process.env.EMAIL_FROM,
      to: email,
      subject: '🔒 Réinitialisation de votre mot de passe - NEXT LTD',
      html: getResetPasswordTemplate({ email, token }),
    });

    logger.info('Email de réinitialisation envoyé:', info.messageId);
    return { success: true, messageId: info.messageId };
  } catch (error) {
    logger.error('Erreur envoi email de réinitialisation:', error);
    throw error;
  }
}

/**
 * Envoyer un email d'invitation amélioré
 */
async function sendInvitationEmail(email, invitationData) {
  try {
    const info = await transporter.sendMail({
      from: process.env.EMAIL_FROM,
      to: email,
      subject: `👥 Invitation NEXT LTD - Rôle: ${invitationData.role}`,
      html: getInvitationEmailTemplate(invitationData),
      text: getInvitationEmailText(invitationData)
    });

    logger.info('Email d\'invitation envoyé:', { 
      to: email, 
      messageId: info.messageId,
      role: invitationData.role 
    });

    // Créer une notification système
    await notificationService.createSystemNotification({
      title: `📧 Invitation envoyée à ${email}`,
      message: `Invitation pour le rôle ${invitationData.role} envoyée avec succès`,
      type: 'info',
      metadata: { 
        email: email,
        role: invitationData.role,
        expires_at: invitationData.expires_at,
        invitation_id: invitationData.id
      }
    }).catch(err => logger.error('Erreur création notification:', err));

    return { 
      success: true, 
      messageId: info.messageId,
      email: email 
    };
  } catch (error) {
    logger.error('Erreur envoi email d\'invitation:', error);
    
    // Notification d'erreur
    await notificationService.createSystemNotification({
      title: `❌ Échec envoi invitation à ${email}`,
      message: `Échec de l'envoi de l'invitation pour ${invitationData.role}: ${error.message}`,
      type: 'error',
      metadata: { 
        email: email,
        role: invitationData.role,
        error: error.message 
      }
    }).catch(err => logger.error('Erreur création notification d\'erreur:', err));
    
    throw error;
  }
}

/**
 * Envoyer une notification à l'équipe
 */
async function sendTeamNotification(subject, content) {
  try {
    // 1. Envoi de l'email via le transporteur
    const info = await transporter.sendMail({
      from: process.env.EMAIL_FROM,
      to: 'team@numericexport.com',
      subject: `[NEXT LTD] ${subject}`,
      html: content,
    });

    logger.info('Notification équipe envoyée:', info.messageId);

    // 2. Création de la notification système
    await notificationService.createSystemNotification({
      title: `📧 ${subject}`,
      message: subject,
      type: 'info',
      metadata: { source: 'email', content: content }
    }).catch(err => logger.error('Erreur création notification:', err));

    return { success: true, messageId: info.messageId };
  } catch (error) {
    logger.error('Erreur envoi notification équipe:', error);
    throw error;
  }
}

/**
 * Tester la connexion SMTP
 */
async function testSMTPConnection() {
  try {
    await transporter.verify();
    logger.info('✅ Connexion SMTP établie avec succès');
    return { 
      success: true, 
      message: 'Connexion SMTP établie',
      config: {
        host: process.env.SMTP_HOST,
        port: process.env.SMTP_PORT,
        secure: process.env.SMTP_SECURE,
        user: process.env.SMTP_USER
      }
    };
  } catch (error) {
    logger.error('❌ Erreur connexion SMTP:', error);
    throw error;
  }
}

module.exports = {
  sendWelcomeEmail,
  sendResetPasswordEmail,
  sendInvitationEmail,
  sendTeamNotification,
  testSMTPConnection,
  transporter
};
