// api/src/routes/v1/socadel-agent-auth.routes.js
'use strict';

const bcrypt = require('bcryptjs');
const crypto = require('crypto');
const { query } = require('../../config/database');
const emailService = require('../../services/email.service');

const EMAIL_RE = /^[a-zA-Z0-9._%+-]+@(camlight\.cm|eneo\.cm)$/i;

function hashCode(code) {
  return crypto.createHash('sha256').update(String(code)).digest('hex');
}

async function socadelAgentAuthRoutes(fastify) {
  // ─────────────────────────────────────────────
  // POST /socadel-agent/register
  // ─────────────────────────────────────────────
  fastify.post('/socadel-agent/register', async (request, reply) => {
    const { email, matricule, password, full_name } = request.body || {};

    if (!email || !matricule || !password) {
      return reply.code(400).send({
        success: false,
        message: 'email, matricule et mot de passe sont requis'
      });
    }

    const cleanEmail = String(email).toLowerCase().trim();
    const cleanMatricule = String(matricule).trim();

    if (!EMAIL_RE.test(cleanEmail)) {
      return reply.code(400).send({
        success: false,
        message: 'L’email doit être du domaine @camlight.cm ou @eneo.cm'
      });
    }

    if (String(password).length < 8) {
      return reply.code(400).send({
        success: false,
        message: 'Le mot de passe doit contenir au moins 8 caractères'
      });
    }

    if (cleanMatricule.length < 2) {
      return reply.code(400).send({
        success: false,
        message: 'Matricule invalide'
      });
    }

    const code = String(crypto.randomInt(100000, 999999));
    const password_hash = await bcrypt.hash(String(password), 12);
    const activation_expires_at = new Date(Date.now() + 24 * 60 * 60 * 1000);

    try {
      await query(
        `INSERT INTO socadel_agents
           (email, matricule, password_hash, full_name, activation_code, activation_expires_at, is_active)
         VALUES ($1, $2, $3, $4, $5, $6, false)`,
        [
          cleanEmail,
          cleanMatricule,
          password_hash,
          full_name ? String(full_name).trim() : null,
          code,
          activation_expires_at
        ]
      );
    } catch (e) {
      if (e.code === '23505') {
        return reply.code(409).send({
          success: false,
          message: 'Un compte existe déjà avec cet email ou ce matricule'
        });
      }
      request.log?.error?.(e) || console.error('[socadel-agent/register]', e);
      return reply.code(500).send({ success: false, message: 'Erreur création compte' });
    }

    try {
      await emailService.sendSocadelAgentActivationEmail({
        email: cleanEmail,
        full_name: full_name || cleanMatricule,
        matricule: cleanMatricule,
        code
      });
    } catch (mailErr) {
      // Compte créé mais mail échoué : on informe clairement
      return reply.code(201).send({
        success: true,
        warning: true,
        message:
          'Compte créé mais l’email n’a pas pu être envoyé. Contactez le support pour recevoir le code.'
      });
    }

    return reply.code(201).send({
      success: true,
      message: 'Compte créé. Un code d’activation a été envoyé à votre email Socadel.'
    });
  });

  // ─────────────────────────────────────────────
  // POST /socadel-agent/activate
  // ─────────────────────────────────────────────
  fastify.post('/socadel-agent/activate', async (request, reply) => {
    const { email, code } = request.body || {};

    if (!email || !code) {
      return reply.code(400).send({
        success: false,
        message: 'email et code requis'
      });
    }

    const result = await query(
      `UPDATE socadel_agents
       SET is_active = true,
           activation_code = NULL,
           activation_expires_at = NULL,
           updated_at = NOW()
       WHERE LOWER(email) = LOWER($1)
         AND activation_code = $2
         AND activation_expires_at > NOW()
         AND is_active = false
       RETURNING id, email, matricule, full_name`,
      [String(email).trim(), String(code).trim()]
    );

    if (result.rows.length === 0) {
      return reply.code(400).send({
        success: false,
        message: 'Code invalide, expiré, ou compte déjà activé'
      });
    }

    return reply.send({
      success: true,
      message: 'Compte activé. Vous pouvez vous connecter.',
      agent: {
        email: result.rows[0].email,
        matricule: result.rows[0].matricule,
        full_name: result.rows[0].full_name
      }
    });
  });

  // ─────────────────────────────────────────────
  // POST /socadel-agent/resend-code
  // ─────────────────────────────────────────────
  fastify.post('/socadel-agent/resend-code', async (request, reply) => {
    const { email } = request.body || {};
    if (!email) {
      return reply.code(400).send({ success: false, message: 'email requis' });
    }

    const cleanEmail = String(email).toLowerCase().trim();
    const existing = await query(
      `SELECT id, full_name, matricule, is_active FROM socadel_agents WHERE LOWER(email) = $1`,
      [cleanEmail]
    );

    if (existing.rows.length === 0) {
      // Ne pas révéler si l'email existe (énumération)
      return reply.send({
        success: true,
        message: 'Si un compte existe, un nouveau code a été envoyé.'
      });
    }

    const agent = existing.rows[0];
    if (agent.is_active) {
      return reply.send({
        success: true,
        message: 'Ce compte est déjà activé. Connectez-vous.'
      });
    }

    const code = String(crypto.randomInt(100000, 999999));
    const activation_expires_at = new Date(Date.now() + 24 * 60 * 60 * 1000);

    await query(
      `UPDATE socadel_agents
       SET activation_code = $1, activation_expires_at = $2, updated_at = NOW()
       WHERE id = $3`,
      [code, activation_expires_at, agent.id]
    );

    try {
      await emailService.sendSocadelAgentActivationEmail({
        email: cleanEmail,
        full_name: agent.full_name || agent.matricule,
        matricule: agent.matricule,
        code
      });
    } catch (_) {
      return reply.code(500).send({
        success: false,
        message: 'Impossible d’envoyer l’email pour le moment'
      });
    }

    return reply.send({
      success: true,
      message: 'Si un compte existe, un nouveau code a été envoyé.'
    });
  });

  // ─────────────────────────────────────────────
  // POST /socadel-agent/login
  // ─────────────────────────────────────────────
  fastify.post('/socadel-agent/login', async (request, reply) => {
    const { email, password } = request.body || {};

    if (!email || !password) {
      return reply.code(400).send({
        success: false,
        message: 'email et mot de passe requis'
      });
    }

    const result = await query(
      `SELECT * FROM socadel_agents WHERE LOWER(email) = LOWER($1)`,
      [String(email).trim()]
    );
    const agent = result.rows[0];

    if (!agent) {
      return reply.code(401).send({ success: false, message: 'Identifiants incorrects' });
    }

    const ok = await bcrypt.compare(String(password), agent.password_hash);
    if (!ok) {
      return reply.code(401).send({ success: false, message: 'Identifiants incorrects' });
    }

    if (!agent.is_active) {
      return reply.code(403).send({
        success: false,
        code: 'NOT_ACTIVATED',
        message: 'Compte non activé. Saisissez le code reçu par email.'
      });
    }

    await query(`UPDATE socadel_agents SET last_login_at = NOW() WHERE id = $1`, [agent.id]);

    const token = fastify.jwt.sign(
      {
        role: 'agent_socadel',
        scope: 'socadel',
        agentId: agent.id,
        matricule: agent.matricule,
        email: agent.email
      },
      { expiresIn: '12h' }
    );

    return reply.send({
      success: true,
      token,
      agent: {
        id: agent.id,
        email: agent.email,
        matricule: agent.matricule,
        full_name: agent.full_name
      }
    });
  });

  // ═════════════════════════════════════════════
  //  NOUVEAU : Mot de passe oublié (email)
  // ═════════════════════════════════════════════

  // POST /socadel-agent/forgot-password  { email }
  fastify.post('/socadel-agent/forgot-password', async (request, reply) => {
    const email = String(request.body?.email || '').trim().toLowerCase();
    if (!email || !email.includes('@')) {
      return reply.code(400).send({ success: false, message: 'Email invalide' });
    }

    const result = await query(
      `SELECT id, email, full_name, matricule, is_active
       FROM socadel_agents
       WHERE LOWER(email) = $1`,
      [email]
    );

    // Toujours 200 pour ne pas révéler l'existence du compte
    if (!result.rows[0]?.is_active) {
      return reply.send({
        success: true,
        message: 'Si un compte existe, un code a été envoyé par email.',
      });
    }

    const agent = result.rows[0];
    const code = String(crypto.randomInt(100000, 999999));
    const expires = new Date(Date.now() + 15 * 60 * 1000);

    await query(
      `INSERT INTO socadel_password_resets
         (account_type, account_id, identifier, code_hash, expires_at)
       VALUES ('agent', $1, $2, $3, $4)`,
      [agent.id, email, hashCode(code), expires]
    );

    try {
      await emailService.sendSocadelAgentPasswordResetEmail({
        email,
        full_name: agent.full_name || agent.matricule,
        matricule: agent.matricule,
        code,
      });
    } catch (e) {
      request.log?.error?.(e) || console.error('[agent/forgot-password] mail', e);
      // On renvoie quand même 200 pour ne pas casser le flow (l'utilisateur
      // verra s'il reçoit ou non ; il peut redemander un code)
    }

    return reply.send({
      success: true,
      message: 'Si un compte existe, un code a été envoyé par email.',
    });
  });

  // POST /socadel-agent/reset-password  { email, code, new_password }
  fastify.post('/socadel-agent/reset-password', async (request, reply) => {
    const { email: rawEmail, code, new_password } = request.body || {};
    const email = String(rawEmail || '').trim().toLowerCase();

    if (!email || !code || !new_password || String(new_password).length < 8) {
      return reply.code(400).send({
        success: false,
        message: 'Email, code et nouveau mot de passe (8 car. min.) requis',
      });
    }

    const reset = await query(
      `SELECT * FROM socadel_password_resets
       WHERE account_type = 'agent'
         AND identifier = $1
         AND used_at IS NULL
         AND expires_at > NOW()
       ORDER BY created_at DESC
       LIMIT 1`,
      [email]
    );

    const row = reset.rows[0];
    if (!row || row.code_hash !== hashCode(String(code).trim())) {
      return reply.code(400).send({ success: false, message: 'Code invalide ou expiré' });
    }

    const password_hash = await bcrypt.hash(String(new_password), 12);
    await query(
      `UPDATE socadel_agents SET password_hash = $1, updated_at = NOW() WHERE id = $2`,
      [password_hash, row.account_id]
    );
    await query(`UPDATE socadel_password_resets SET used_at = NOW() WHERE id = $1`, [row.id]);

    return reply.send({
      success: true,
      message: 'Mot de passe mis à jour. Vous pouvez vous connecter.',
    });
  });
}

module.exports = socadelAgentAuthRoutes;
