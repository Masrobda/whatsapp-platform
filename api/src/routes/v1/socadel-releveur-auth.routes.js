// api/src/routes/v1/socadel-releveur-auth.routes.js
'use strict';

const bcrypt = require('bcryptjs');
const crypto = require('crypto');
const { query } = require('../../config/database');

const ROLES_OK = new Set([
  'RELEVEUR', 'DISTRIBUTEUR', 'COUPEUR', 'ELECTRICIEN',
  'COMMERCIAL', 'CHARGE FACTURATION', 'AUTRES'
]);

function normalizePhone237(p) {
  if (!p) return null;
  let cleaned = String(p).trim().replace(/[\s\-\(\)\.]/g, '');
  let digits = cleaned.replace(/\D/g, '');
  if (digits.startsWith('237')) digits = digits.substring(3);
  if (digits.length === 8) digits = '6' + digits;
  if (digits.length !== 9) return null;
  return `+237${digits}`;
}

function normalizeRole(v) {
  const r = String(v || 'RELEVEUR').trim().toUpperCase();
  return ROLES_OK.has(r) ? r : 'RELEVEUR';
}

function hashCode(code) {
  return crypto.createHash('sha256').update(String(code)).digest('hex');
}

async function socadelReleveurAuthRoutes(fastify) {
  // ─────────────────────────────────────────────
  // POST /socadel-releveur/register
  // ─────────────────────────────────────────────
  fastify.post('/socadel-releveur/register', async (request, reply) => {
    const { phone, full_name, entreprise, role, password } = request.body || {};

    const cleanPhone = normalizePhone237(phone);
    if (!cleanPhone) {
      return reply.code(400).send({
        success: false,
        message: 'Numéro invalide. Format attendu : +237 suivi de 9 chiffres (ex: +237677123456)'
      });
    }
    if (!full_name || String(full_name).trim().length < 2) {
      return reply.code(400).send({ success: false, message: 'Le nom complet est requis (min. 2 caractères)' });
    }
    if (!entreprise || String(entreprise).trim().length < 2) {
      return reply.code(400).send({ success: false, message: 'L’entreprise est requise' });
    }
    const cleanRole = normalizeRole(role);
    if (!password || String(password).length < 8) {
      return reply.code(400).send({ success: false, message: 'Le mot de passe doit contenir au moins 8 caractères' });
    }

    const password_hash = await bcrypt.hash(String(password), 12);

    try {
      const result = await query(
        `INSERT INTO socadel_releveurs
           (phone, full_name, entreprise, role, password_hash, is_active)
         VALUES ($1, $2, $3, $4, $5, true)
         RETURNING id, phone, full_name, entreprise, role, created_at`,
        [cleanPhone, String(full_name).trim(), String(entreprise).trim(), cleanRole, password_hash]
      );
      const row = result.rows[0];
      return reply.code(201).send({
        success: true,
        message: 'Compte créé et activé. Vous pouvez vous connecter.',
        releveur: {
          id: row.id, phone: row.phone, full_name: row.full_name,
          entreprise: row.entreprise, role: row.role
        }
      });
    } catch (e) {
      if (e.code === '23505') {
        return reply.code(409).send({ success: false, message: 'Un compte existe déjà avec ce numéro de téléphone' });
      }
      request.log?.error?.(e) || console.error('[socadel-releveur/register]', e);
      return reply.code(500).send({ success: false, message: 'Erreur lors de la création du compte' });
    }
  });

  // ─────────────────────────────────────────────
  // POST /socadel-releveur/login
  // ─────────────────────────────────────────────
  fastify.post('/socadel-releveur/login', async (request, reply) => {
    const { phone, password } = request.body || {};
    const cleanPhone = normalizePhone237(phone);
    if (!cleanPhone || !password) {
      return reply.code(400).send({ success: false, message: 'Téléphone et mot de passe sont requis' });
    }

    const result = await query(`SELECT * FROM socadel_releveurs WHERE phone = $1`, [cleanPhone]);
    const user = result.rows[0];
    if (!user) {
      return reply.code(401).send({ success: false, message: 'Identifiants incorrects' });
    }
    const ok = await bcrypt.compare(String(password), user.password_hash);
    if (!ok) {
      return reply.code(401).send({ success: false, message: 'Identifiants incorrects' });
    }
    if (!user.is_active) {
      return reply.code(403).send({ success: false, message: 'Compte désactivé. Contactez le support.' });
    }

    await query(
      `UPDATE socadel_releveurs SET last_login_at = NOW(), updated_at = NOW() WHERE id = $1`,
      [user.id]
    );

    const token = fastify.jwt.sign(
      {
        role: 'releveur',
        scope: 'socadel',
        releveurId: user.id,
        phone: user.phone,
        full_name: user.full_name,
        entreprise: user.entreprise,
        terrain_role: user.role
      },
      { expiresIn: '12h' }
    );

    return reply.send({
      success: true,
      token,
      releveur: {
        id: user.id, phone: user.phone, full_name: user.full_name,
        entreprise: user.entreprise, role: user.role
      }
    });
  });

  // ─────────────────────────────────────────────
  // GET /socadel-releveur/me
  // ─────────────────────────────────────────────
  fastify.get(
    '/socadel-releveur/me',
    { preHandler: [fastify.authenticateJWT] },
    async (request, reply) => {
      const user = request.user;
      if (user?.role !== 'releveur' || !user.releveurId) {
        return reply.code(403).send({ success: false, message: 'Accès réservé aux releveurs' });
      }
      const result = await query(
        `SELECT id, phone, full_name, entreprise, role, is_active, last_login_at, created_at
         FROM socadel_releveurs WHERE id = $1`,
        [user.releveurId]
      );
      if (!result.rows.length) {
        return reply.code(404).send({ success: false, message: 'Compte introuvable' });
      }
      return reply.send({ success: true, releveur: result.rows[0] });
    }
  );

  // ═════════════════════════════════════════════
  //  NOUVEAU : Mot de passe oublié (WhatsApp)
  // ═════════════════════════════════════════════

  // POST /socadel-releveur/forgot-password  { phone }
  fastify.post('/socadel-releveur/forgot-password', async (request, reply) => {
    const cleanPhone = normalizePhone237(request.body?.phone);
    if (!cleanPhone) {
      return reply.code(400).send({ success: false, message: 'Téléphone invalide' });
    }

    const result = await query(
      `SELECT id, phone, is_active FROM socadel_releveurs WHERE phone = $1`,
      [cleanPhone]
    );

    // Toujours 200 pour ne pas révéler l'existence du compte
    if (!result.rows[0]?.is_active) {
      return reply.send({ success: true, message: 'Si un compte existe, un code a été envoyé sur WhatsApp.' });
    }

    const code = String(Math.floor(100000 + Math.random() * 900000));
    const expires = new Date(Date.now() + 15 * 60 * 1000);

    await query(
      `INSERT INTO socadel_password_resets
         (account_type, account_id, identifier, code_hash, expires_at)
       VALUES ('releveur', $1, $2, $3, $4)`,
      [result.rows[0].id, cleanPhone, hashCode(code), expires]
    );

    // Envoi WhatsApp
    try {
      const watiService = require('../../services/wati.service');
      const channel =
        process.env.SOCADEL_RESET_WHATSAPP_NUMBER ||
        process.env.SOCADEL_QUICK_REGISTER_INVOICE_NUMBER ||
        '+237688356291';

      await watiService.sendTextMessage(
        cleanPhone,
        `Socadel Collecte — Code de réinitialisation : ${code}\nValable 15 minutes. Ne le partagez pas.`,
        channel
      );
    } catch (e) {
      request.log?.error?.(e) || console.error('[releveur/forgot-password] wati', e);
    }

    return reply.send({
      success: true,
      message: 'Si un compte existe, un code a été envoyé sur WhatsApp.',
    });
  });

  // POST /socadel-releveur/reset-password  { phone, code, new_password }
  fastify.post('/socadel-releveur/reset-password', async (request, reply) => {
    const { phone, code, new_password } = request.body || {};
    const cleanPhone = normalizePhone237(phone);
    if (!cleanPhone || !code || !new_password || String(new_password).length < 8) {
      return reply.code(400).send({
        success: false,
        message: 'Téléphone, code et nouveau mot de passe (8 car. min.) requis',
      });
    }

    const reset = await query(
      `SELECT * FROM socadel_password_resets
       WHERE account_type = 'releveur'
         AND identifier = $1
         AND used_at IS NULL
         AND expires_at > NOW()
       ORDER BY created_at DESC
       LIMIT 1`,
      [cleanPhone]
    );

    const row = reset.rows[0];
    if (!row || row.code_hash !== hashCode(String(code).trim())) {
      return reply.code(400).send({ success: false, message: 'Code invalide ou expiré' });
    }

    const password_hash = await bcrypt.hash(String(new_password), 12);
    await query(
      `UPDATE socadel_releveurs SET password_hash = $1, updated_at = NOW() WHERE id = $2`,
      [password_hash, row.account_id]
    );
    await query(`UPDATE socadel_password_resets SET used_at = NOW() WHERE id = $1`, [row.id]);

    return reply.send({
      success: true,
      message: 'Mot de passe mis à jour. Vous pouvez vous connecter.',
    });
  });
}

module.exports = socadelReleveurAuthRoutes;
