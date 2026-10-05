const fp = require('fastify-plugin');

module.exports = fp(async function (fastify, opts) {
  // Décorer fastify avec la fonction d'authentification
  fastify.decorate('authenticateJWT', async function(request, reply) {
    try {
      const authHeader = request.headers.authorization;
      if (!authHeader || !authHeader.startsWith('Bearer ')) {
        return reply.code(401).send({ 
          success: false, 
          message: 'Non authentifié - Token manquant' 
        });
      }

      const token = authHeader.substring(7);
      
      // Vérifier le token JWT
      const decoded = fastify.jwt.verify(token);
      request.user = decoded;
      
    } catch (err) {
      return reply.code(401).send({ 
        success: false, 
        message: 'Token invalide ou expiré' 
      });
    }
  });

  // Décorer avec la fonction isAdmin
  fastify.decorate('isAdmin', async function(request, reply) {
    const user = request.user;
    if (!user || (user.role !== 'admin' && user.role !== 'responsable_financier')) {
      return reply.code(403).send({ 
        success: false, 
        message: 'Accès non autorisé - Admin requis' 
      });
    }
  });
});
