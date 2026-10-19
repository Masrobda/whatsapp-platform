// api/src/middlewares/authenticate-both.js
const { authenticateJWT, authenticateApiToken } = require('./auth.middleware');
const logger = require('../utils/logger');

/**
 * Middleware qui tente d'abord l'authentification JWT, puis l'API Token.
 * Si aucun n'est valide, renvoie 401.
 */
async function authenticateBoth(request, reply) {
  // On essaie JWT en premier
  let authenticated = false;
  try {
    await authenticateJWT(request, reply);
    // Si authenticateJWT a attaché un utilisateur, on considère que c'est bon
    if (request.user) {
      authenticated = true;
      logger.debug('[AuthBoth] Authentifié via JWT');
    }
  } catch (err) {
    // Ignorer l'erreur, on passera à l'API token
  }

  if (!authenticated) {
    // Tenter l'API Token
    try {
      await authenticateApiToken(request, reply);
      if (request.client) {
        // On transforme request.client en request.user pour uniformiser
        request.user = {
          id: request.client.id,
          email: request.client.email,
          company_name: request.client.company_name,
          type: 'client',
          role: 'client',
          quota_remaining: request.client.quota_remaining,
          phoneNumber: request.client.phoneNumber || null
        };
        authenticated = true;
        logger.debug('[AuthBoth] Authentifié via API Token');
      }
    } catch (err) {
      // Ignorer
    }
  }

  if (!authenticated) {
    return reply.code(401).send({ 
      success: false, 
      code: 'UNAUTHORIZED',
      message: 'Authentification requise. Veuillez fournir un token JWT valide ou une clé API.' 
    });
  }
}

module.exports = { authenticateBoth };
