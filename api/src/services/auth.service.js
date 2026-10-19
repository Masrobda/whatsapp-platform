const { query } = require('../config/database');
const { hashPassword, comparePassword, generateApiToken, generateApiInstance, generateResetToken } = require('../utils/crypto');
const { sendWelcomeEmail, sendResetPasswordEmail } = require('./email.service');
const jwt = require('jsonwebtoken');
const logger = require('../utils/logger');
const templateService = require('./template.service');
const { v4: uuidv4 } = require('uuid');   // <-- AJOUT
const fs = require('fs-extra');
const path = require('path');              // <-- AJOUT

/**
 * Inscription d'un nouveau client
 */
async function registerClient(clientData) {

  try {
    console.log('Données reçues:', JSON.stringify(clientData, null, 2));
    // Vérifier si l'email existe déjà
    const existingClient = await query(
      'SELECT id FROM clients WHERE email = $1',
      [clientData.email]
    );

    if (existingClient.rows.length > 0) {
      throw {
        statusCode: 409,
        code: 'EMAIL_EXISTS',
        message: 'Cette adresse email est déjà utilisée'
      };
    }

    // Hash du mot de passe
    const password_hash = await hashPassword(clientData.password);
    
    // Génération des identifiants API
    const api_token = generateApiToken();
    const api_instance = generateApiInstance();

    // Calcul de la date d'expiration de l'essai (5 jours)
    const trial_expires_at = new Date();
    trial_expires_at.setDate(trial_expires_at.getDate() + parseInt(process.env.TRIAL_DURATION_DAYS || 5));

    // Insertion du client
    const result = await query(
      `INSERT INTO clients (
        company_name, company_type, email, phone, address, city, country, tax_id,
        password_hash, api_token, api_instance, trial_expires_at, vat_rate
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13)
      RETURNING id, company_name, email, api_token, api_instance, quota_total, trial_expires_at`,
      [
        clientData.company_name || null,
        clientData.company_type,
        clientData.email,
        clientData.phone || null,
        clientData.address || null,
        clientData.city || null,
        clientData.country || 'Cameroun',
        clientData.tax_id || null,
        password_hash,
        api_token,
        api_instance,
        trial_expires_at,
        clientData.country === 'Cameroun' ? 19.25 : 0 // VAT à adapter selon le pays
      ]
    );

    const newClient = result.rows[0];    
    const clientId = newClient.id;
const tableName = `messages_client_${clientId.replace(/-/g, '_')}`; // remplace - par _ pour éviter erreurs SQL

// Créer la table
await query(`
  CREATE TABLE IF NOT EXISTS ${tableName} (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    recipient_phone varchar(20) NOT NULL,
    message_type varchar(20) NOT NULL CHECK (message_type IN ('text', 'template', 'media')),
    template_name varchar(255),
    template_language varchar(10) DEFAULT 'fr',
    template_params jsonb,
    message_content text,
    media_url varchar(500),
    wa_message_id varchar(255),
    wati_local_id varchar(255),
    wa_status varchar(50) DEFAULT 'queued' CHECK (wa_status IN ('queued', 'sent', 'delivered', 'read', 'failed')),
    wa_error_code varchar(50),
    wa_error_message text,
    queued_at timestamptz DEFAULT now(),
    sent_at timestamptz,
    delivered_at timestamptz,
    read_at timestamptz,
    failed_at timestamptz,
    delete_after timestamptz DEFAULT (now() + interval '90 days'),
    created_at timestamptz DEFAULT now(),
    channel varchar(20) DEFAULT 'whatsapp',
    fallback_used boolean DEFAULT false,
    prelude_response jsonb,
    batch_id uuid,
    estimated_cost numeric(10,4),
    channel_used varchar(20),
    prelude_message_id varchar(255)
  );
`);

// Indexes
await query(`
  -- Index principaux pour les performances
  CREATE INDEX IF NOT EXISTS idx_${tableName}_created_at  ON ${tableName} (created_at DESC);
  CREATE INDEX IF NOT EXISTS idx_${tableName}_client_status_date  ON ${tableName} (wa_status, created_at DESC);
  CREATE INDEX IF NOT EXISTS idx_${tableName}_recipient_phone  ON ${tableName} (recipient_phone);
  CREATE INDEX IF NOT EXISTS idx_${tableName}_wa_message_id  ON ${tableName} (wa_message_id);
  CREATE INDEX IF NOT EXISTS idx_${tableName}_wati_local_id  ON ${tableName} (wati_local_id);
  CREATE INDEX IF NOT EXISTS idx_${tableName}_batch_id  ON ${tableName} (batch_id);
  CREATE INDEX IF NOT EXISTS idx_${tableName}_status_recipient  ON ${tableName} (wa_status, recipient_phone);
  -- Index composite très utile pour les requêtes courantes
  CREATE INDEX IF NOT EXISTS idx_${tableName}_created_status_type  ON ${tableName} (created_at DESC, wa_status, message_type);
  -- Index pour les filtres fréquents
  CREATE INDEX IF NOT EXISTS idx_${tableName}_sent_at  ON ${tableName} (sent_at DESC);
  CREATE INDEX IF NOT EXISTS idx_${tableName}_read_at  ON ${tableName} (read_at DESC);
/**  CREATE INDEX IF NOT EXISTS idx_${tableName}_created_at ON ${tableName} (created_at DESC);
  CREATE INDEX IF NOT EXISTS idx_${tableName}_wa_status ON ${tableName} (wa_status);
  CREATE INDEX IF NOT EXISTS idx_${tableName}_recipient_phone ON ${tableName} (recipient_phone);
  CREATE INDEX IF NOT EXISTS idx_${tableName}_wa_message_id ON ${tableName} (wa_message_id);
  CREATE INDEX IF NOT EXISTS idx_${tableName}_batch_id ON ${tableName} (batch_id);
  CREATE INDEX IF NOT EXISTS idx_${tableName}_wa_message_id ON ${tableName} (wa_message_id);
  CREATE INDEX IF NOT EXISTS idx_${tableName}_wati_local_id ON ${tableName} (wati_local_id);
*/`
);

// Optionnel : partitionner par mois si besoin plus tard
// await query(`CREATE INDEX IF NOT EXISTS idx_${tableName}_queued_at_month ON ${tableName} (date_trunc('month', queued_at));`);

logger.info(`Table messages créée pour client ${clientId}: ${tableName}`);

// === CRÉATION DE L'ESPACE STOCKAGE PAR DÉFAUT (100 Mo) ===
// const SPACE_SIZE_BYTES = 100 * 1024 * 1024; // 100 Mo
// const SPACE_SIZE_BYTES = 50 * 1024 * 1024; // 50 Mo
const SPACE_SIZE_BYTES = 25 * 1024 * 1024; // 25 Mo
const spaceId = uuidv4();
const storagePath = process.env.STORAGE_PATH || '/var/www/storage/clients';
const expiresAt = new Date(Date.now() + 365 * 24 * 60 * 60 * 1000); // +1 an

await query(
  `INSERT INTO storage_spaces
   (id, client_id, size_limit_bytes, current_usage_bytes, is_active, expires_at, created_by)
   VALUES ($1, $2, $3, $4, $5, $6, $7)`,
  [spaceId, newClient.id, SPACE_SIZE_BYTES, 0, true, expiresAt, null]
);

// Créer le dossier physique
const spaceFolder = path.join(storagePath, spaceId);
await fs.ensureDir(spaceFolder);

logger.info(`Espace de stockage par défaut (100 Mo) créé pour le client ${newClient.id} : ${spaceId}`);

// === NOUVELLE PARTIE : Assigner un numéro WhatsApp par défaut ===
    try {
      // Fonction pour trouver un numéro disponible
      const findAvailableNumber = async () => {
        // Chercher un numéro qui n'est assigné à aucun client
        const result = await query(`
          SELECT id, phone_number 
          FROM whatsapp_numbers 
          WHERE is_active = true 
            AND id NOT IN (
              SELECT DISTINCT number_id 
              FROM whatsapp_number_assignments
            )
          LIMIT 1
        `);

        if (result.rows.length === 0) {
          // Si aucun numéro libre, prendre le numéro avec le moins d'assignations
          const fallback = await query(`
            SELECT wn.id, wn.phone_number, COUNT(wa.client_id) as assign_count
            FROM whatsapp_numbers wn
            LEFT JOIN whatsapp_number_assignments wa ON wn.id = wa.number_id
            WHERE wn.is_active = true
            GROUP BY wn.id, wn.phone_number
            ORDER BY assign_count ASC
            LIMIT 1
          `);
          
          return fallback.rows[0] || null;
        }

        return result.rows[0];
      };

      const availableNumber = await findAvailableNumber();
      
      if (availableNumber) {
        // Créer l'assignation
        await query(
          `INSERT INTO whatsapp_number_assignments 
           (number_id, client_id, assigned_by, is_primary, notes, assigned_at)
           VALUES ($1, $2, $3, $4, $5, NOW())`,
          [
            availableNumber.id,
            newClient.id,
            null, // assigné automatiquement par le système
            true, // is_primary = true (client principal)
            'Assigné automatiquement à la création du compte'
          ]
        );
        
        logger.info(`Numéro WhatsApp ${availableNumber.phone_number} assigné automatiquement au client ${newClient.id}`);
      } else {
        logger.warn(`Aucun numéro WhatsApp disponible pour assignation automatique au client ${newClient.id}`);
        
        // Optionnel : créer une alerte pour les admins
        await query(
          `INSERT INTO admin_alerts (type, message, severity)
           VALUES ($1, $2, $3)`,
          [
            'WHATSAPP_NUMBER_MISSING',
            `Le client ${newClient.email} (${newClient.company_name}) n'a pas reçu de numéro WhatsApp automatique par manque de disponibilité.`,
            'warning'
          ]
        );
      }
    } catch (assignErr) {
      logger.error('Erreur assignation automatique numéro WhatsApp:', assignErr);
      // Ne pas bloquer l'inscription, mais logger l'erreur
    }
    // === FIN DE LA NOUVELLE PARTIE ===

  await templateService.assignDefaultTemplateToClient(newClient.id);

    // Envoyer l'email de bienvenue (async, ne pas bloquer)
    sendWelcomeEmail(newClient).catch(err => 
      logger.error('Erreur envoi email bienvenue:', err)
    );

    // Log d'audit
    await query(
      `INSERT INTO audit_logs (client_id, action, entity_type, entity_id, new_values)
       VALUES ($1, $2, $3, $4, $5)`,
      [
        newClient.id,
        'CLIENT_REGISTERED',
        'client',
        newClient.id,
        JSON.stringify({ email: newClient.email, company_name: newClient.company_name })
      ]
    );

    logger.info('Nouveau client inscrit:', newClient.email);

    return {
      success: true,
      message: 'Compte créé avec succès. Un email de bienvenue vous a été envoyé.',
      client: {
        id: newClient.id,
        email: newClient.email,
        company_name: newClient.company_name,
        trial_messages: newClient.quota_total,
        trial_expires_at: newClient.trial_expires_at
      }
    };

  } catch (error) {
    console.error('Erreur détaillée inscription:', error);
    console.error('Stack trace:', error.stack);
    logger.error('Erreur inscription client:', error);
    throw error;
  }
}

/**
 * Trouve un numéro WhatsApp disponible à assigner automatiquement
 */
async function findAvailableWhatsAppNumber() {
  try {
    // Chercher un numéro qui n'est assigné à aucun client
    // et qui est actif
    const result = await query(`
      SELECT id, phone_number 
      FROM whatsapp_numbers 
      WHERE is_active = true 
        AND id NOT IN (
          SELECT DISTINCT number_id 
          FROM whatsapp_number_assignments
        )
      LIMIT 1
    `);

    if (result.rows.length === 0) {
      // Si aucun numéro libre, prendre le numéro avec le moins d'assignations
      const fallback = await query(`
        SELECT wn.id, wn.phone_number, COUNT(wa.client_id) as assign_count
        FROM whatsapp_numbers wn
        LEFT JOIN whatsapp_number_assignments wa ON wn.id = wa.number_id
        WHERE wn.is_active = true
        GROUP BY wn.id, wn.phone_number
        ORDER BY assign_count ASC
        LIMIT 1
      `);
      
      return fallback.rows[0] || null;
    }

    return result.rows[0];
  } catch (err) {
    logger.error('Erreur recherche numéro disponible:', err);
    return null;
  }
}

/**
 * Inscription d'un utilisateur interne (personnel)
 */
async function registerUser(userData) {
  try {
    const { full_name, email, password, role, permissions } = userData;

    // Vérifier si l'email existe déjà
    const existing = await query(
      'SELECT id FROM users WHERE email = $1',
      [email]
    );
    if (existing.rows.length > 0) {
      throw {
        statusCode: 409,
        code: 'EMAIL_EXISTS',
        message: 'Cette adresse email est déjà utilisée'
      };
    }

    const password_hash = await hashPassword(password);

    const result = await query(
      `INSERT INTO users (
        full_name, email, password_hash, role, permissions, is_active
      ) VALUES ($1, $2, $3, $4, $5, $6)
      RETURNING id, email, full_name, role, permissions`,
      [
        full_name,
        email,
        password_hash,
        role,
        JSON.stringify(permissions),
        true
      ]
    );

    const newUser = result.rows[0];

    // Log d'audit
    await query(
      `INSERT INTO audit_logs (user_id, action, entity_type, entity_id, new_values)
       VALUES ($1, $2, $3, $4, $5)`,
      [newUser.id, 'USER_REGISTERED_VIA_INVITATION', 'user', newUser.id, JSON.stringify({ role, email })]
    );

    logger.info('Nouveau membre du personnel inscrit via invitation:', email);

    return newUser;
  } catch (error) {
    logger.error('Erreur registerUser:', error);
    throw error;
  }
}



/**
 * Connexion client
 */
async function loginClient(email, password, rememberMe = false) {
  try {
    // 1. Récupérer le client avec TOUS les champs nécessaires
    const result = await query(
      `SELECT 
         id, email, password_hash, company_name, is_active, is_blocked,
         block_reason, block_expires_at, quota_remaining, trial_expires_at
       FROM clients WHERE email = $1`,
      [email]
    );

    if (result.rows.length === 0) {
      throw { 
        statusCode: 401, 
        code: 'INVALID_CREDENTIALS', 
        message: 'Email ou mot de passe incorrect' 
      };
    }

    const client = result.rows[0];

    // 2. Vérifications de statut AVANT de valider le mot de passe
    if (!client.is_active) {
      throw {
        statusCode: 403,
        code: 'ACCOUNT_DISABLED',
        message: 'Votre compte a été désactivé. Contactez le support pour connaître la raison et les démarches de réactivation.'
      };
    }

    if (client.is_blocked) {
      if (client.block_expires_at) {
        const expiresDate = new Date(client.block_expires_at);
        if (expiresDate > new Date()) {
          throw {
            statusCode: 403,
            code: 'ACCOUNT_BLOCKED_TEMP',
            message: `Votre compte est temporairement bloqué jusqu'au ${expiresDate.toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', year: 'numeric' })} à ${expiresDate.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })}. Raison : ${client.block_reason || 'non précisée'}. Contactez le support si vous pensez qu’il s’agit d’une erreur.`
          };
        } else {
          // Déblocage automatique si expiré (on le fait ici aussi pour cohérence)
          await query(
            `UPDATE clients 
             SET is_blocked = false, block_reason = NULL, block_expires_at = NULL, updated_at = CURRENT_TIMESTAMP 
             WHERE id = $1`,
            [client.id]
          );
          logger.info(`Blocage temporaire expiré et levé automatiquement pour client ${client.id} lors du login`);
          // On continue la connexion normalement
        }
      } else {
        throw {
          statusCode: 403,
          code: 'ACCOUNT_BLOCKED',
          message: `Votre compte est bloqué définitivement. Raison : ${client.block_reason || 'non précisée'}. Contactez le support pour plus d'informations ou pour demander une levée de blocage.`
        };
      }
    }

    // 3. Vérifier le mot de passe seulement si les statuts sont OK
    const isPasswordValid = await comparePassword(password, client.password_hash);
    if (!isPasswordValid) {
      throw { 
        statusCode: 401, 
        code: 'INVALID_CREDENTIALS', 
        message: 'Email ou mot de passe incorrect' 
      };
    }

    // 4. Générer le token
    const expiresIn = rememberMe ? (process.env.JWT_REFRESH_EXPIRES_IN || '30d') : (process.env.JWT_EXPIRES_IN || '7d');
    const token = jwt.sign(
      {
        id: client.id,
        email: client.email,
        type: 'client',
        role: 'client'
      },
      process.env.JWT_SECRET,
      { expiresIn }
    );

    // 5. Mises à jour
    await query('UPDATE clients SET last_login = CURRENT_TIMESTAMP WHERE id = $1', [client.id]);
    await query(
      'INSERT INTO audit_logs (client_id, action, entity_type, entity_id) VALUES ($1, $2, $3, $4)',
      [client.id, 'CLIENT_LOGIN', 'client', client.id]
    );

    logger.info('Client connecté avec succès:', client.email);

    return {
      success: true,
      token,
      user: {
        id: client.id,
        email: client.email,
        company_name: client.company_name,
        type: 'client',
        role: 'client',
        quota_remaining: client.quota_remaining,
        trial_expires_at: client.trial_expires_at
      }
    };
  } catch (error) {
    logger.error('Erreur login client:', error);
    throw error;
  }
}

/**
 * Connexion utilisateur interne
 */
async function loginUser(email, password, rememberMe = false) {
  try {
    // Récupérer l'utilisateur
    const result = await query(
      `SELECT id, email, password_hash, full_name, role, permissions, is_active, is_blocked
       FROM users WHERE email = $1`,
      [email]
    );

    if (result.rows.length === 0) {
      throw {
        statusCode: 401,
        code: 'INVALID_CREDENTIALS',
        message: 'Email ou mot de passe incorrect'
      };
    }

    const user = result.rows[0];

    // Vérifications
    if (!user.is_active || user.is_blocked) {
      throw {
        statusCode: 403,
        code: 'ACCOUNT_DISABLED',
        message: 'Votre compte est désactivé ou bloqué.'
      };
    }

    // Vérifier le mot de passe
    const isPasswordValid = await comparePassword(password, user.password_hash);

    if (!isPasswordValid) {
      throw {
        statusCode: 401,
        code: 'INVALID_CREDENTIALS',
        message: 'Email ou mot de passe incorrect'
      };
    }

    // Générer le JWT
    const expiresIn = rememberMe ? process.env.JWT_REFRESH_EXPIRES_IN : process.env.JWT_EXPIRES_IN;

    const token = jwt.sign(
      {
        id: user.id,
        email: user.email,
        role: user.role,
        type: 'user' // <--- AJOUTÉ DANS LE TOKEN JWT
      },
      process.env.JWT_SECRET,
      { expiresIn }
    );

    // Mettre à jour last_login
    await query(
      'UPDATE users SET last_login = CURRENT_TIMESTAMP WHERE id = $1',
      [user.id]
    );

    // Log d'audit
    await query(
      `INSERT INTO audit_logs (user_id, action, entity_type, entity_id)
       VALUES ($1, $2, $3, $4)`,
      [user.id, 'USER_LOGIN', 'user', user.id]
    );

    logger.info('Utilisateur connecté:', user.email);

    return {
      success: true,
      token,
      user: {
        id: user.id,
        email: user.email,
        full_name: user.full_name,
        role: user.role,
        type: 'user', // <--- AJOUT CRUCIAL ICI DANS LA RÉPONSE
        permissions: user.permissions
      }
    };

  } catch (error) {
    logger.error('Erreur login utilisateur:', error);
    throw error;
  }
}

/**
 * Demande de réinitialisation de mot de passe
 */
async function forgotPassword(email, userType = 'client') {
  try {
    // Vérifier que l'email existe
    const table = userType === 'client' ? 'clients' : 'users';
    const result = await query(
      `SELECT id, email FROM ${table} WHERE email = $1`,
      [email]
    );

    if (result.rows.length === 0) {
      // Pour des raisons de sécurité, on ne révèle pas si l'email existe
      return {
        success: true,
        message: 'Si cette adresse email existe, un lien de réinitialisation a été envoyé.'
      };
    }

    // Générer un token de réinitialisation
    const resetToken = generateResetToken();
    const expiresAt = new Date();
    expiresAt.setHours(expiresAt.getHours() + 1); // Expire dans 1 heure

    // Enregistrer le token
    await query(
      `INSERT INTO password_resets (email, token, user_type, expires_at)
       VALUES ($1, $2, $3, $4)`,
      [email, resetToken, userType, expiresAt]
    );

    // Envoyer l'email
    await sendResetPasswordEmail(email, resetToken);

    logger.info('Reset password demandé:', email);

    return {
      success: true,
      message: 'Si cette adresse email existe, un lien de réinitialisation a été envoyé.'
    };

  } catch (error) {
    logger.error('Erreur forgot password:', error);
    throw error;
  }
}

/**
 * Réinitialisation du mot de passe
 */
async function resetPassword(token, newPassword) {
  try {
    // Vérifier le token
    const result = await query(
      `SELECT email, user_type, expires_at, used 
       FROM password_resets 
       WHERE token = $1`,
      [token]
    );

    if (result.rows.length === 0) {
      throw {
        statusCode: 400,
        code: 'INVALID_TOKEN',
        message: 'Token de réinitialisation invalide ou expiré'
      };
    }

    const resetData = result.rows[0];

    // Vérifications
    if (resetData.used) {
      throw {
        statusCode: 400,
        code: 'TOKEN_USED',
        message: 'Ce token a déjà été utilisé'
      };
    }

    if (new Date() > new Date(resetData.expires_at)) {
      throw {
        statusCode: 400,
        code: 'TOKEN_EXPIRED',
        message: 'Ce token a expiré. Demandez un nouveau lien de réinitialisation.'
      };
    }

    // Hash du nouveau mot de passe
    const password_hash = await hashPassword(newPassword);

    // Mettre à jour le mot de passe
    const table = resetData.user_type === 'client' ? 'clients' : 'users';
    await query(
      `UPDATE ${table} SET password_hash = $1 WHERE email = $2`,
      [password_hash, resetData.email]
    );

    // Marquer le token comme utilisé
    await query(
      'UPDATE password_resets SET used = true WHERE token = $1',
      [token]
    );

    logger.info('Mot de passe réinitialisé:', resetData.email);

    return {
      success: true,
      message: 'Votre mot de passe a été réinitialisé avec succès. Vous pouvez maintenant vous connecter.'
    };

  } catch (error) {
    logger.error('Erreur reset password:', error);
    throw error;
  }
}

module.exports = {
  registerClient,
  loginClient,
  loginUser,
  forgotPassword,
  resetPassword,
  registerUser,
};
