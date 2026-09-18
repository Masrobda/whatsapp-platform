const { query, getClient } = require('../config/database');
const { sendInvitationEmail } = require('./email.service');
const crypto = require('crypto');
const logger = require('../utils/logger');

/**
 * Créer un nouveau lien d'invitation et envoyer l'email
 */
async function createInvitation(userId, invitationData) {
  const client = await getClient();

  try {
    await client.query('BEGIN');

    // Générer un token unique
    const token = crypto.randomBytes(32).toString('hex');

    // Calculer la date d'expiration
    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + invitationData.expires_in_days);

    // Insérer l'invitation
    const result = await client.query(
      `INSERT INTO invitation_links (
        token, role, permissions, max_uses, expires_at, created_by
      ) VALUES ($1, $2, $3, $4, $5, $6)
      RETURNING id, token, role, max_uses, expires_at, created_at`,
      [
        token,
        invitationData.role,
        JSON.stringify(invitationData.permissions || []),
        invitationData.max_uses || 1,
        expiresAt,
        userId
      ]
    );

    const newInvitation = result.rows[0];

    // Envoyer l'email si fourni
    if (invitationData.email) {
      try {
        await sendInvitationEmail({
          to: invitationData.email,
          token: token,
          role: invitationData.role,
          expiresAt: expiresAt,
          maxUses: invitationData.max_uses || 1,
          createdBy: userId
        });
        logger.info('Email d\'invitation envoyé avec succès à:', invitationData.email);
      } catch (emailError) {
        logger.error('Erreur envoi email invitation:', emailError);
        // On ne rollback pas pour l'erreur d'email, on continue
      }
    }

    // Log d'audit
    await client.query(
      `INSERT INTO audit_logs (user_id, action, entity_type, entity_id, new_values)
       VALUES ($1, $2, $3, $4, $5)`,
      [
        userId,
        'INVITATION_CREATED',
        'invitation_link',
        newInvitation.id,
        JSON.stringify({
          role: invitationData.role,
          max_uses: invitationData.max_uses,
          expires_at: expiresAt,
          email_sent: !!invitationData.email
        })
      ]
    );

    await client.query('COMMIT');

    logger.info('Invitation créée:', { 
      id: newInvitation.id, 
      role: invitationData.role,
      email_sent: !!invitationData.email
    });

    return {
      success: true,
      message: invitationData.email 
        ? 'Invitation créée et email envoyé avec succès' 
        : 'Invitation créée avec succès',
      invitation: newInvitation
    };

  } catch (error) {
    await client.query('ROLLBACK');
    logger.error('Erreur création invitation:', error);
    throw error;
  } finally {
    client.release();
  }
}

/**
 * Récupérer toutes les invitations
 */
async function getAllInvitations(filters = {}) {
  try {
    const { page = 1, limit = 5, status } = filters;
    const offset = (page - 1) * limit;

    let whereClause = 'WHERE 1=1';
    const params = [];
    let paramIndex = 1;

    if (status === 'active') {
      whereClause += ` AND expires_at > CURRENT_TIMESTAMP AND current_uses < max_uses`;
    } else if (status === 'expired') {
      whereClause += ` AND expires_at <= CURRENT_TIMESTAMP`;
    } else if (status === 'used') {
      whereClause += ` AND current_uses >= max_uses`;
    }

    // Compter le total
    const countResult = await query(
      `SELECT COUNT(*) FROM invitation_links ${whereClause}`,
      params
    );
    const total = parseInt(countResult.rows[0].count);

    // Récupérer les invitations
    const invitationsResult = await query(
      `SELECT
        il.*,
        u.full_name as created_by_name,
        u.email as created_by_email
       FROM invitation_links il
       LEFT JOIN users u ON il.created_by = u.id
       ${whereClause}
       ORDER BY created_at DESC
       LIMIT $${paramIndex} OFFSET $${paramIndex + 1}`,
      [...params, limit, offset]
    );

    return {
      success: true,
      invitations: invitationsResult.rows,
      pagination: {
        total,
        page: parseInt(page),
        limit: parseInt(limit),
        totalPages: Math.ceil(total / limit)
      }
    };

  } catch (error) {
    logger.error('Erreur récupération invitations:', error);
    throw error;
  }
}

/**
 * Valider un token d'invitation
 */
async function validateInvitation(token) {
  try {
    const result = await query(
      `SELECT
        il.*,
        u.full_name as created_by_name
       FROM invitation_links il
       LEFT JOIN users u ON il.created_by = u.id
       WHERE token = $1`,
      [token]
    );

    if (result.rows.length === 0) {
      throw {
        statusCode: 404,
        code: 'INVITATION_NOT_FOUND',
        message: 'Lien d\'invitation invalide'
      };
    }

    const invitation = result.rows[0];

    // Vérifier l'expiration
    if (new Date() > new Date(invitation.expires_at)) {
      throw {
        statusCode: 400,
        code: 'INVITATION_EXPIRED',
        message: 'Ce lien d\'invitation a expiré'
      };
    }

    // Vérifier les utilisations
    if (invitation.current_uses >= invitation.max_uses) {
      throw {
        statusCode: 400,
        code: 'INVITATION_USED_UP',
        message: 'Ce lien a déjà été utilisé'
      };
    }

    return {
      success: true,
      invitation
    };

  } catch (error) {
    logger.error('Erreur validation invitation:', error);
    throw error;
  }
}

/**
 * Utiliser une invitation (incrémenter current_uses)
 */
async function useInvitation(token) {
  const client = await getClient();

  try {
    await client.query('BEGIN');

    const result = await client.query(
      `UPDATE invitation_links
       SET current_uses = current_uses + 1
       WHERE token = $1 AND current_uses < max_uses AND expires_at > CURRENT_TIMESTAMP
       RETURNING id, current_uses`,
      [token]
    );

    if (result.rows.length === 0) {
      throw {
        statusCode: 400,
        code: 'INVITATION_INVALID',
        message: 'Impossible d\'utiliser cette invitation'
      };
    }

    await client.query('COMMIT');

    return {
      success: true,
      current_uses: result.rows[0].current_uses
    };

  } catch (error) {
    await client.query('ROLLBACK');
    logger.error('Erreur utilisation invitation:', error);
    throw error;
  } finally {
    client.release();
  }
}

/**
 * Supprimer une invitation
 */
async function deleteInvitation(invitationId, userId) {
  const client = await getClient();

  try {
    await client.query('BEGIN');

    const result = await client.query(
      'DELETE FROM invitation_links WHERE id = $1 RETURNING id',
      [invitationId]
    );

    if (result.rows.length === 0) {
      throw {
        statusCode: 404,
        code: 'INVITATION_NOT_FOUND',
        message: 'Invitation non trouvée'
      };
    }

    // Log d'audit
    await client.query(
      `INSERT INTO audit_logs (user_id, action, entity_type, entity_id)
       VALUES ($1, $2, $3, $4)`,
      [userId, 'INVITATION_DELETED', 'invitation_link', invitationId]
    );

    await client.query('COMMIT');

    return {
      success: true,
      message: 'Invitation supprimée avec succès'
    };

  } catch (error) {
    await client.query('ROLLBACK');
    logger.error('Erreur suppression invitation:', error);
    throw error;
  } finally {
    client.release();
  }
}

/**
 * Envoyer une invitation par email (pour les invitations existantes)
 */

async function sendInvitationEmailById(invitationId, email, userId) {  // Gardez ces 3 paramètres
  const client = await getClient();

  try {
    await client.query('BEGIN');

    // Récupérer l'invitation
    const invitationResult = await client.query(
      `SELECT il.*, u.full_name as created_by_name
       FROM invitation_links il
       LEFT JOIN users u ON il.created_by = u.id
       WHERE il.id = $1`,
      [invitationId]
    );

    if (invitationResult.rows.length === 0) {
      throw {
        statusCode: 404,
        code: 'INVITATION_NOT_FOUND',
        message: 'Invitation non trouvée'
      };
    }

    const invitation = invitationResult.rows[0];

    // Préparer les données pour l'email
    const invitationData = {
      to: email,
      token: invitation.token,
      role: invitation.role,
      expires_at: invitation.expires_at,
      max_uses: invitation.max_uses,
      created_by: invitation.created_by_name || 'Administrateur',
      permissions: invitation.permissions || []
    };

    // Envoyer l'email - IMPORTANT: passez email en premier paramètre
    try {
      await sendInvitationEmail(email, invitationData);  // Appel avec 2 paramètres
      
      logger.info('Email d\'invitation envoyé avec succès à:', email);
    } catch (emailError) {
      logger.error('Erreur envoi email invitation:', emailError);
      throw {
        statusCode: 500,
        code: 'EMAIL_SEND_FAILED',
        message: 'Échec de l\'envoi de l\'email'
      };
    }

    // Log d'audit
    await client.query(
      `INSERT INTO audit_logs (user_id, action, entity_type, entity_id, details)
       VALUES ($1, $2, $3, $4, $5)`,
      [
        userId,
        'INVITATION_EMAIL_SENT',
        'invitation_link',
        invitationId,
        JSON.stringify({ email: email })
      ]
    );

    await client.query('COMMIT');

    return {
      success: true,
      message: 'Email d\'invitation envoyé avec succès'
    };

  } catch (error) {
    await client.query('ROLLBACK');
    logger.error('Erreur envoi email invitation:', error);
    throw error;
  } finally {
    client.release();
  }
}

module.exports = {
  createInvitation,
  getAllInvitations,
  validateInvitation,
  useInvitation,
  deleteInvitation,
  sendInvitationEmailById  // Ajoutez cette fonction
};
