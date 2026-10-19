const jwt = require('jsonwebtoken');
const { query } = require('../config/database');
const logger = require('../utils/logger');

/**
 * Middleware pour vérifier le JWT (clients et utilisateurs)
 */
async function authenticateJWT(request, reply) {
  try {
    const authHeader = request.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return reply.code(401).send({
        success: false,
        code: 'NO_TOKEN',
        message: 'Token d\'authentification manquant'
      });
    }

    const token = authHeader.substring(7);
    const decoded = jwt.verify(token, process.env.JWT_SECRET);

    let userData;
    if (decoded.type === 'client') {
      const result = await query(
        `SELECT 
           id, email, company_name, quota_remaining, is_active, 
           is_blocked, block_reason, block_expires_at
         FROM clients WHERE id = $1`,
        [decoded.id]
      );

      if (result.rows.length === 0) {
        return reply.code(401).send({
          success: false,
          code: 'INVALID_TOKEN',
          message: 'Token invalide : compte introuvable'
        });
      }

      const client = result.rows[0];

      // Vérification blocage
      if (client.is_blocked) {
        if (client.block_expires_at) {
          if (new Date(client.block_expires_at) > new Date()) {
            return reply.code(403).send({
              success: false,
              code: 'ACCOUNT_BLOCKED_TEMP',
              message: `Compte temporairement bloqué jusqu'au ${new Date(client.block_expires_at).toLocaleString('fr-FR')}. Raison : ${client.block_reason || 'non précisée'}`
            });
          } else {
            // Déblocage auto si expiré
            await query(
              `UPDATE clients 
               SET is_blocked = false, block_reason = NULL, block_expires_at = NULL, updated_at = CURRENT_TIMESTAMP 
               WHERE id = $1`,
              [client.id]
            );
            logger.info(`Blocage temporaire expiré et levé pour client ${client.id}`);
          }
        } else {
          return reply.code(403).send({
            success: false,
            code: 'ACCOUNT_BLOCKED',
            message: `Compte bloqué définitivement. Raison : ${client.block_reason || 'non précisée'}`
          });
        }
      }

      if (!client.is_active) {
        return reply.code(403).send({
          success: false,
          code: 'ACCOUNT_DISABLED',
          message: 'Compte désactivé'
        });
      }

      userData = {
        ...client,
        type: 'client'
      };
    } 
    else if (decoded.type === 'user') {
      const result = await query(
        `SELECT id, email, full_name, role, permissions, is_active, is_blocked
         FROM users WHERE id = $1`,
        [decoded.id]
      );

      if (result.rows.length === 0) {
        return reply.code(401).send({
          success: false,
          code: 'INVALID_TOKEN',
          message: 'Token invalide : utilisateur introuvable'
        });
      }

      const user = result.rows[0];

      if (!user.is_active || user.is_blocked) {
        return reply.code(403).send({
          success: false,
          code: user.is_blocked ? 'ACCOUNT_BLOCKED' : 'ACCOUNT_DISABLED',
          message: user.is_blocked ? 'Compte bloqué' : 'Compte désactivé'
        });
      }

      userData = {
        ...user,
        type: 'user'
      };
    } 
    else {
      return reply.code(401).send({
        success: false,
        code: 'INVALID_TOKEN_TYPE',
        message: 'Type de token non reconnu'
      });
    }

    request.user = userData;
    logger.debug('authenticateJWT → utilisateur attaché', { 
      userId: userData.id, 
      type: userData.type 
    });

  } catch (error) {
    if (error.name === 'TokenExpiredError') {
      return reply.code(401).send({
        success: false,
        code: 'TOKEN_EXPIRED',
        message: 'Token expiré. Veuillez vous reconnecter.'
      });
    }
    if (error.name === 'JsonWebTokenError') {
      return reply.code(401).send({
        success: false,
        code: 'INVALID_TOKEN',
        message: 'Token invalide'
      });
    }
    logger.error('Erreur authenticateJWT:', error);
    return reply.code(500).send({
      success: false,
      code: 'INTERNAL_ERROR',
      message: 'Erreur d\'authentification'
    });
  }
}

/**
 * Middleware pour vérifier l'API Token (appels API clients)
 * Ajout des contrôles quota = 0 et trial expiré
 */
async function authenticateApiToken(request, reply) {
  try {
    const authHeader = request.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return reply.code(401).send({
        success: false,
        code: 'NO_TOKEN',
        message: 'API Token manquant'
      });
    }

    const apiToken = authHeader.substring(7);
    logger.debug('authenticateApiToken → tentative avec token', { 
      tokenPrefix: apiToken.substring(0, 10) + '...' 
    });

    const result = await query(
      `SELECT 
         id, email, company_name, quota_remaining, quota_total,
         is_active, api_instance, is_blocked, block_reason, block_expires_at,
         trial_expires_at, trial_messages_per_day
       FROM clients WHERE api_token = $1`,
      [apiToken]
    );

    if (result.rows.length === 0) {
      logger.warn('authenticateApiToken → token non trouvé', { 
        tokenPrefix: apiToken.substring(0, 10) + '...' 
      });
      return reply.code(401).send({
        success: false,
        code: 'INVALID_API_TOKEN',
        message: 'API Token invalide'
      });
    }

    const client = result.rows[0];

    // 1. Vérification blocage (permanent ou temporaire)
    if (client.is_blocked) {
      if (client.block_expires_at) {
        if (new Date(client.block_expires_at) > new Date()) {
          return reply.code(403).send({
            success: false,
            code: 'ACCOUNT_BLOCKED_TEMP',
            message: `API bloquée temporairement jusqu'au ${new Date(client.block_expires_at).toLocaleString('fr-FR')}. Raison : ${client.block_reason || 'non précisée'}`
          });
        } else {
          // Déblocage automatique
          await query(
            `UPDATE clients 
             SET is_blocked = false, block_reason = NULL, block_expires_at = NULL, updated_at = CURRENT_TIMESTAMP 
             WHERE id = $1`,
            [client.id]
          );
          logger.info(`Blocage temporaire expiré et levé pour client ${client.id} (via API token)`);
        }
      } else {
        return reply.code(403).send({
          success: false,
          code: 'ACCOUNT_BLOCKED',
          message: `API bloquée définitivement. Raison : ${client.block_reason || 'non précisée'}`
        });
      }
    }

    // 2. Vérification compte actif
    if (!client.is_active) {
      return reply.code(403).send({
        success: false,
        code: 'ACCOUNT_DISABLED',
        message: 'Compte désactivé'
      });
    }

    // 3. Vérification quota épuisé
    if (client.quota_remaining <= 0) {
      return reply.code(403).send({
        success: false,
        code: 'QUOTA_EXHAUSTED',
        message: 'Quota de messages épuisé. Veuillez recharger votre compte.'
      });
    }

    // 4. Vérification trial expiré (si le client est encore en mode trial)
    if (client.trial_expires_at) {
      const trialExpired = new Date(client.trial_expires_at) < new Date();
      if (trialExpired) {
        // Option : tu peux aussi vérifier si quota_total est toujours le quota trial initial
        // Ici on bloque simplement si trial expiré ET quota faible (exemple conservateur)
        if (client.quota_remaining < 5) {  // ou autre seuil
          return reply.code(403).send({
            success: false,
            code: 'TRIAL_EXPIRED',
            message: 'Période d\'essai expirée. Veuillez recharger votre quota.'
          });
        }
      }
    }

    // Tout est OK → attacher le client
    request.client = client;
    logger.debug('authenticateApiToken → client attaché avec succès', {
      clientId: client.id,
      email: client.email,
      company: client.company_name,
      quota_remaining: client.quota_remaining
    });

  } catch (error) {
    logger.error('Erreur authenticateApiToken:', error);
    return reply.code(500).send({
      success: false,
      code: 'INTERNAL_ERROR',
      message: 'Erreur d\'authentification API'
    });
  }
}

/**
 * Middleware pour vérifier que l'utilisateur est un client (JWT)
 */
async function requireClient(request, reply) {
  if (!request.user || request.user.type !== 'client') {
    return reply.code(403).send({
      success: false,
      code: 'FORBIDDEN',
      message: 'Accès réservé aux clients'
    });
  }
}

/**
 * Middleware pour vérifier que l'utilisateur est un membre de l'équipe (JWT)
 */
async function requireUser(request, reply) {
  if (!request.user || request.user.type !== 'user') {
    return reply.code(403).send({
      success: false,
      code: 'FORBIDDEN',
      message: 'Accès réservé aux membres de l\'équipe'
    });
  }
}

module.exports = {
  authenticateJWT,
  authenticateApiToken,
  requireClient,
  requireUser,
};
