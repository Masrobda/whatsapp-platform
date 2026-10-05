/**
 * Middleware pour vérifier les rôles
 */
function requireRole(...allowedRoles) {
  return async function(request, reply) {
    if (!request.user || request.user.type !== 'user') {
      return reply.code(403).send({
        success: false,
        code: 'FORBIDDEN',
        message: 'Accès réservé aux membres de l\'équipe'
      });
    }

    if (!allowedRoles.includes(request.user.role)) {
      return reply.code(403).send({
        success: false,
        code: 'INSUFFICIENT_PERMISSIONS',
        message: `Accès réservé aux rôles: ${allowedRoles.join(', ')}`
      });
    }
  };
}

/**
 * Middleware pour vérifier les permissions spécifiques
 */
function requirePermission(...requiredPermissions) {
  return async function(request, reply) {
    if (!request.user || request.user.type !== 'user') {
      return reply.code(403).send({
        success: false,
        code: 'FORBIDDEN',
        message: 'Accès non autorisé'
      });
    }

    // Admin a tous les droits
    if (request.user.role === 'admin') {
      return;
    }

    const userPermissions = request.user.permissions || [];
    const hasPermission = requiredPermissions.some(permission => 
      userPermissions.includes(permission) || userPermissions.includes('all')
    );

    if (!hasPermission) {
      return reply.code(403).send({
        success: false,
        code: 'INSUFFICIENT_PERMISSIONS',
        message: 'Vous n\'avez pas les permissions nécessaires'
      });
    }
  };
}

/**
 * Rôles disponibles
 */
const ROLES = {
  ADMIN: 'admin',
  SECRETARY: 'secretaire',
  COMMERCIAL: 'commercial',
  AUDITOR: 'auditeur',
  PURCHASE_MANAGER: 'responsable_achat',
  FINANCIAL_MANAGER: 'responsable_financier',
  CLIENT: 'client'

};

module.exports = {
  requireRole,
  requirePermission,
  ROLES,
};
