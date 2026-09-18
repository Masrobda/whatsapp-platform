// src/controllers/auth.controller.js
const authService = require('../services/auth.service');
const { validate, schemas } = require('../utils/validators');
const logger = require('../utils/logger');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { query, getClient } = require('../config/database');
const invitationService = require('../services/invitation.service');

/**
 * POST /api/v1/auth/register/client
 * Inscription d'un nouveau client
 */
async function registerClientHandler(request, reply) {
  try {
    // Validation des données
    const validatedData = validate(schemas.registerClientSchema, request.body);

    // Appel au service
    const result = await authService.registerClient(validatedData);

    return reply.code(201).send(result);
    } catch (error) {
  if (error.statusCode === 400 && error.code === 'VALIDATION_ERROR') {
    console.error('VALIDATION ERROR FULL DETAILS:');
    console.error(JSON.stringify(error.errors, null, 2));
    // ou même : console.error(error); pour voir toute la stack
  }

  if (error.statusCode) {
    return reply.code(error.statusCode).send({
      success: false,
      code: error.code,
      message: error.message,
      errors: error.errors || []
    });
  }


    logger.error('Erreur registerClient:', error);
    return reply.code(500).send({
      success: false,
      code: 'INTERNAL_ERROR',
      message: 'Une erreur est survenue lors de l\'inscription'
    });
  }
}

/**
 * POST /api/v1/auth/register/invitation
 * Inscription d'un membre du personnel via lien d'invitation
 */
async function registerStaffViaInvitation(request, reply) {
  const client = await getClient();
  
  try {
    await client.query('BEGIN');

    const {
      full_name,
      email,
      password,
      confirm_password,
      invitation_token
    } = request.body;

    // Validation basique
    if (!full_name || !email || !password || !confirm_password || !invitation_token) {
      throw {
        statusCode: 400,
        message: 'Tous les champs sont obligatoires'
      };
    }

    if (password !== confirm_password) {
      throw {
        statusCode: 400,
        message: 'Les mots de passe ne correspondent pas'
      };
    }

    // 1. Valider l'invitation
    const invitationResult = await invitationService.validateInvitation(invitation_token);
    
    if (!invitationResult.success || !invitationResult.invitation) {
      throw {
        statusCode: 400,
        message: 'Lien d\'invitation invalide ou expiré'
      };
    }

    const invitation = invitationResult.invitation;

    // 2. Vérifier si l'email existe déjà
    const existingUser = await client.query(
      'SELECT id FROM users WHERE email = $1',
      [email]
    );

    if (existingUser.rows.length > 0) {
      throw {
        statusCode: 400,
        message: 'Cet email est déjà utilisé'
      };
    }

    // 3. Hasher le mot de passe
    const hashedPassword = await bcrypt.hash(password, 10);

    // 4. Créer l'utilisateur - RETIREZ created_via_invitation
    const userResult = await client.query(
      `INSERT INTO users (
        email, password_hash, full_name, role, permissions, is_active
      ) VALUES ($1, $2, $3, $4, $5, $6)
      RETURNING id, email, full_name, role, created_at`,
      [
        email,
        hashedPassword,
        full_name,
        invitation.role,
        JSON.stringify(invitation.permissions || []),
        true  // is_active = true par défaut
      ]
    );

    const newUser = userResult.rows[0];

    // 5. Marquer l'invitation comme utilisée
    await invitationService.useInvitation(invitation_token);

    // 6. Générer le token JWT
    const token = jwt.sign(
      {
        id: newUser.id,
        email: newUser.email,
        role: newUser.role
      },
      process.env.JWT_SECRET || 'your-secret-key',
      { expiresIn: '7d' }
    );

    // 7. Log d'audit
    await client.query(
      `INSERT INTO audit_logs (user_id, action, entity_type, entity_id, new_values)
       VALUES ($1, $2, $3, $4, $5)`,
      [
        newUser.id,
        'USER_REGISTERED_VIA_INVITATION',
        'user',
        newUser.id,
        JSON.stringify({
          email: newUser.email,
          role: newUser.role,
          invitation_id: invitation.id
        })
      ]
    );

    await client.query('COMMIT');

    logger.info('Utilisateur inscrit via invitation:', { id: newUser.id, email: newUser.email });

    return reply.code(201).send({
      success: true,
      message: 'Inscription réussie',
      user: newUser,
      token
    });

  } catch (error) {
    await client.query('ROLLBACK');
    
    logger.error('Erreur inscription via invitation:', error);
    
    return reply.code(error.statusCode || 500).send({
      success: false,
      message: error.message || 'Erreur lors de l\'inscription'
    });
  } finally {
    client.release();
  }
}

/**
 * POST /api/v1/auth/login
 * Connexion (client ou utilisateur)
 */
async function loginHandler(request, reply) {
  try {
    // Validation
    const validatedData = validate(schemas.loginSchema, request.body);

    // Déterminer le type de connexion (client par défaut)
    const userType = request.body.user_type || 'client';

    let result;
    if (userType === 'user') {
      result = await authService.loginUser(
        validatedData.email,
        validatedData.password,
        validatedData.remember_me
      );
    } else {
      result = await authService.loginClient(
        validatedData.email,
        validatedData.password,
        validatedData.remember_me
      );
    }

    return reply.code(200).send(result);

  } catch (error) {
    if (error.statusCode) {
      return reply.code(error.statusCode).send({
        success: false,
        code: error.code,
        message: error.message
      });
    }

    logger.error('Erreur login:', error);
    return reply.code(500).send({
      success: false,
      code: 'INTERNAL_ERROR',
      message: 'Une erreur est survenue lors de la connexion'
    });
  }
}

/**
 * POST /api/v1/auth/forgot-password
 * Demande de réinitialisation de mot de passe
 */
async function forgotPasswordHandler(request, reply) {
  try {
    // Validation
    const validatedData = validate(schemas.forgotPasswordSchema, request.body);

    const result = await authService.forgotPassword(
      validatedData.email,
      validatedData.user_type
    );

    return reply.code(200).send(result);

  } catch (error) {
    if (error.statusCode) {
      return reply.code(error.statusCode).send({
        success: false,
        code: error.code,
        message: error.message
      });
    }

    logger.error('Erreur forgot password:', error);
    return reply.code(500).send({
      success: false,
      code: 'INTERNAL_ERROR',
      message: 'Une erreur est survenue'
    });
  }
}

/**
 * POST /api/v1/auth/reset-password
 * Réinitialisation du mot de passe
 */
async function resetPasswordHandler(request, reply) {
  try {
    // Validation
    const validatedData = validate(schemas.resetPasswordSchema, request.body);

    const result = await authService.resetPassword(
      validatedData.token,
      validatedData.password
    );

    return reply.code(200).send(result);

  } catch (error) {
    if (error.statusCode) {
      return reply.code(error.statusCode).send({
        success: false,
        code: error.code,
        message: error.message
      });
    }

    logger.error('Erreur reset password:', error);
    return reply.code(500).send({
      success: false,
      code: 'INTERNAL_ERROR',
      message: 'Une erreur est survenue'
    });
  }
}

/**
 * GET /api/v1/auth/me
 * Récupérer les informations de l'utilisateur connecté
 */
async function getMeHandler(request, reply) {
  try {
    // L'utilisateur est déjà vérifié par le middleware auth
    const user = request.user;

    return reply.code(200).send({
      success: true,
      user
    });

  } catch (error) {
    logger.error('Erreur getMe:', error);
    return reply.code(500).send({
      success: false,
      code: 'INTERNAL_ERROR',
      message: 'Une erreur est survenue'
    });
  }
}

module.exports = {
  registerClientHandler,
  loginHandler,
  forgotPasswordHandler,
  resetPasswordHandler,
  getMeHandler,
  registerStaffViaInvitation,
};
