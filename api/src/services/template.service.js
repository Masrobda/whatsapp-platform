// src/services/template.service.js

const db = require('../config/database');
const whatsappService = require('./whatsapp.service');
const logger = require('../utils/logger');

/**
 * Créer un nouveau template
 */
async function createTemplate(userId, templateData) {
  const client = await db.getClient();
  try {
    await client.query('BEGIN');

    // Validation serveur ASSOUPLIE
    if (!templateData.name?.trim()) {
      throw { statusCode: 400, message: 'Nom du template requis' };
    }

    // MODIFICATION: Accepter body_content vide avec valeur par défaut
    const bodyContent = templateData.body_content?.trim() || 'Message par défaut - veuillez éditer ce contenu';
    
    if (!templateData.body_content?.trim()) {
      logger.warn(`Template créé avec body_content vide par utilisateur ${userId} - valeur par défaut utilisée`);
    }

    const cleanName = templateData.name
      .toLowerCase()
      .replace(/[^a-z0-9_]/g, '_')
      .replace(/_{2,}/g, '_');

    const variables = extractVariables(bodyContent);

    if (templateData.header_type === 'text' && templateData.header_content) {
      variables.push(...extractVariables(templateData.header_content));
    }

    const result = await client.query(
      `INSERT INTO templates (
        name, language, category,
        header_type, header_content,
        body_content, footer_content,
        buttons, variables, created_by,
        status, metadata,
        created_at, updated_at
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
      RETURNING *`,
      [
        cleanName,
        templateData.language || 'fr',
        templateData.category || 'UTILITY',
        templateData.header_type || 'none',
        templateData.header_content || null,
        bodyContent,
        templateData.footer_content || null,
        JSON.stringify(templateData.buttons || []),
        JSON.stringify([...new Set(variables)]),
        userId,
        templateData.status || 'draft',
        JSON.stringify(templateData.metadata || {})
      ]
    );

    await client.query('COMMIT');
    logger.info(`Template créé: ${cleanName} par utilisateur ${userId}`);
    return result.rows[0];
  } catch (error) {
    await client.query('ROLLBACK');
    logger.error('Erreur création template:', error);
    throw error;
  } finally {
    client.release();
  }
}

/**
 * Extraire les variables d'un texte (format {{1}}, {{2}}, etc.)
 */
function extractVariables(text) {
  if (!text) return [];
  const regex = /{{(\d+)}}/g;
  const matches = [...text.matchAll(regex)];
  return matches.map(m => parseInt(m[1])).filter((v, i, a) => a.indexOf(v) === i).sort();
}

/**
 * Soumettre un template à Meta (360Dialog)
 */
async function submitTemplateToMeta(templateId, userId) {
  const client = await db.getClient();
  try {
    await client.query('BEGIN');

    // Récupérer le template avec tout son contenu
    const template = await getTemplateById(templateId);
    
    console.log('Template à soumettre:', JSON.stringify(template, null, 2));

    // Vérifier si déjà soumis
    if (template.wa_template_id) {
      throw { statusCode: 400, message: 'Template déjà soumis à Meta' };
    }

    // Vérification critique avant soumission
    if (!template.body_content?.trim()) {
      throw { statusCode: 400, message: 'Impossible de soumettre : le contenu du corps est vide ou manquant' };
    }

    // IMPORTANT: Ne PAS créer de nouveau template
    // Utiliser l'ID du template existant
    const submissionData = {
      id: templateId,  // ← Passer l'ID du template existant
      name: template.name,
      language: template.language,
      category: template.category,
      header_type: template.header_type,
      header_content: template.header_content,
      body_content: template.body_content,
      footer_content: template.footer_content,
      buttons: template.buttons || []
    };

    // Soumettre à Meta via Prelude
    const result = await whatsappService.submitTemplate(submissionData);
    
    console.log('Résultat soumission:', result);

    // Mettre à jour le template existant (pas en créer un nouveau)
    await client.query(
      `UPDATE templates
       SET wa_template_id = $1,
           status = $2,
           submitted_at = CURRENT_TIMESTAMP,
           submitted_by = $3,
           metadata = metadata || $4,
           updated_at = CURRENT_TIMESTAMP
       WHERE id = $5
       RETURNING *`,
      [
        result.prelude_template_id || result.wa_template_id,
        result.status?.toLowerCase() || 'pending',
        userId,
        JSON.stringify({ submission_response: result }),
        templateId  // ← Utiliser l'ID original
      ]
    );

    await client.query('COMMIT');
    logger.info(`Template ${template.name} (${templateId}) soumis à Meta avec ID: ${result.prelude_template_id || result.wa_template_id}`);

    return {
      success: true,
      wa_template_id: result.prelude_template_id || result.wa_template_id,
      status: result.status?.toLowerCase() || 'pending'
    };

  } catch (error) {
    await client.query('ROLLBACK');
    logger.error('Erreur soumission template à Meta:', error);
    throw error;
  } finally {
    client.release();
  }
}


/**
 * Rafraîchir le statut d'un template depuis Meta
 */
async function refreshTemplateStatus(templateId) {
  const client = await db.getClient();
  try {
    await client.query('BEGIN');
    
    const template = await getTemplateById(templateId);

    if (!template.wa_template_id) {
      throw { statusCode: 400, message: 'Template non soumis à Meta' };
    }

    // Récupérer le statut depuis Meta/Prelude
    const result = await whatsappService.getTemplateStatus(template.wa_template_id);
    
    console.log('Résultat refresh:', result);

    // Mapper le statut vers une valeur valide
    let newStatus = 'pending'; // par défaut
    
    if (result.status) {
      const statusLower = result.status.toLowerCase();
      // Liste des statuts valides : draft, pending, approved, rejected
      if (['approved', 'rejected', 'pending'].includes(statusLower)) {
        newStatus = statusLower;
      } else if (statusLower === 'approved') {
        newStatus = 'approved';
      } else if (statusLower === 'rejected') {
        newStatus = 'rejected';
      } else {
        newStatus = 'pending'; // fallback
      }
    }

    // Mettre à jour le template
    await client.query(
      `UPDATE templates
       SET status = $1,
           updated_at = CURRENT_TIMESTAMP,
           metadata = metadata || $2::jsonb
       WHERE id = $3`,
      [
        newStatus,
        JSON.stringify({ 
          last_status_check: new Date().toISOString(),
          last_response: result 
        }),
        templateId
      ]
    );

    // Mettre à jour prelude_templates si existe
    await client.query(
      `UPDATE prelude_templates
       SET status = $1,
           prelude_status = $2,
           synced_at = CURRENT_TIMESTAMP,
           updated_at = CURRENT_TIMESTAMP
       WHERE template_id = $3`,
      [newStatus, result.status?.toUpperCase() || 'PENDING', templateId]
    );

    await client.query('COMMIT');

    logger.info(`Statut template ${template.name} rafraîchi: ${newStatus}`);

    return {
      success: true,
      status: newStatus,
      previous_status: template.status,
      details: result
    };

  } catch (error) {
    await client.query('ROLLBACK');
    logger.error('Erreur rafraîchissement statut template:', error);
    throw error;
  } finally {
    client.release();
  }
}


/**
 * Récupérer tous les templates avec filtres
 */
async function getTemplates(filters = {}) {
  const {
    page = 1,
    limit = 10,
    status,
    category,
    search,
    language,
    created_by
  } = filters;

  const offset = (page - 1) * limit;

  let whereClause = 'WHERE 1=1';
  const params = [];
  let paramIndex = 1;

  if (status) {
    whereClause += ` AND status = $${paramIndex}`;
    params.push(status);
    paramIndex++;
  }

  if (category) {
    whereClause += ` AND category = $${paramIndex}`;
    params.push(category);
    paramIndex++;
  }

  if (language) {
    whereClause += ` AND language = $${paramIndex}`;
    params.push(language);
    paramIndex++;
  }

  if (created_by) {
    whereClause += ` AND created_by = $${paramIndex}`;
    params.push(created_by);
    paramIndex++;
  }

  if (search) {
    whereClause += ` AND (name ILIKE $${paramIndex} OR body_content ILIKE $${paramIndex})`;
    params.push(`%${search}%`);
    paramIndex++;
  }

  // Compter total
  const countRes = await db.query(`SELECT COUNT(*) FROM templates ${whereClause}`, params);
  const total = parseInt(countRes.rows[0].count);

  // Récupérer les templates
  const queryText = `
    SELECT t.*,
           u.email as created_by_email,
           COALESCE(u.full_name, u.email) as created_by_name
    FROM templates t
    LEFT JOIN users u ON t.created_by = u.id
    ${whereClause}
    ORDER BY t.created_at DESC
    LIMIT $${paramIndex} OFFSET $${paramIndex + 1}
  `;

  const res = await db.query(queryText, [...params, limit, offset]);

  // Enrichir les templates
  const templates = res.rows.map(template => ({
    ...template,
    variables: template.variables || extractVariables(template.body_content || ''),
    buttons: template.buttons || []
  }));

  return {
    templates,
    pagination: {
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit)
    }
  };
}

/**
 * Récupérer un template par ID
 */
async function getTemplateById(templateId) {
  const res = await db.query(
    `SELECT t.*,
            u.email as created_by_email,
            COALESCE(u.full_name, u.email) as created_by_name
     FROM templates t
     LEFT JOIN users u ON t.created_by = u.id
     WHERE t.id = $1`,
    [templateId]
  );

  if (res.rows.length === 0) {
    throw { statusCode: 404, message: 'Template non trouvé' };
  }

  const template = res.rows[0];
  template.variables = template.variables || extractVariables(template.body_content);
  template.buttons = template.buttons || [];
  return template;
}

/**
 * Mettre à jour un template - VERSION ASSOUPLIE
 */
async function updateTemplate(templateId, userId, updates) {
  const client = await db.getClient();

  // MODIFICATION: Validation assouplie pour la mise à jour aussi
  if (updates.body_content !== undefined && !updates.body_content?.trim()) {
    logger.warn(`Template ${templateId} mis à jour avec body_content vide - valeur conservée`);
  }

  try {
    await client.query('BEGIN');
    const template = await getTemplateById(templateId);

    // Ne pas permettre la modification si déjà soumis à Meta
    if (template.wa_template_id && template.status !== 'rejected') {
      throw { statusCode: 400, message: 'Template déjà soumis à Meta, modification impossible' };
    }

    // Extraire les nouvelles variables
    const bodyContent = updates.body_content !== undefined 
      ? (updates.body_content?.trim() || template.body_content) 
      : template.body_content;
      
    const variables = extractVariables(bodyContent);
    
    if (updates.header_type === 'text' && updates.header_content) {
      variables.push(...extractVariables(updates.header_content));
    }

    const setClause = [];
    const values = [];
    let paramIndex = 1;

    const fields = {
      name: updates.name,
      language: updates.language,
      category: updates.category,
      header_type: updates.header_type,
      header_content: updates.header_content,
      body_content: bodyContent,
      footer_content: updates.footer_content,
      buttons: updates.buttons ? JSON.stringify(updates.buttons) : undefined,
      variables: JSON.stringify([...new Set(variables)]),
      status: updates.status || 'draft'
    };

    Object.entries(fields).forEach(([key, value]) => {
      if (value !== undefined) {
        setClause.push(`${key} = $${paramIndex}`);
        values.push(value);
        paramIndex++;
      }
    });

    values.push(templateId);

    const result = await client.query(
      `UPDATE templates
       SET ${setClause.join(', ')},
       updated_at = CURRENT_TIMESTAMP
       WHERE id = $${paramIndex}
       RETURNING *`,
      values
    );

    await client.query('COMMIT');
    logger.info(`Template ${templateId} mis à jour par utilisateur ${userId}`);
    return result.rows[0];
  } catch (error) {
    await client.query('ROLLBACK');
    logger.error('Erreur mise à jour template:', error);
    throw error;
  } finally {
    client.release();
  }
}

/**
 * Supprimer un template
 */
async function deleteTemplate(templateId, userId) {
  const client = await db.getClient();
  try {
    await client.query('BEGIN');
    const template = await getTemplateById(templateId);

    // Ne pas supprimer si approuvé
    if (template.status === 'approved') {
      throw { statusCode: 400, message: 'Impossible de supprimer un template approuvé' };
    }

    await client.query('DELETE FROM templates WHERE id = $1', [templateId]);

    await client.query('COMMIT');
    logger.info(`Template ${templateId} supprimé par utilisateur ${userId}`);
    return { success: true };
  } catch (error) {
    await client.query('ROLLBACK');
    logger.error('Erreur suppression template:', error);
    throw error;
  } finally {
    client.release();
  }
}

/**
 * Dupliquer un template
 */
async function duplicateTemplate(templateId, userId) {
  const template = await getTemplateById(templateId);

  // Vérification critique + fallback
  const safeBodyContent = template.body_content?.trim() || 'Message par défaut - veuillez éditer ce contenu';

  if (!template.body_content?.trim()) {
    console.warn(`Duplication de template ${templateId} : body_content était vide/null → fallback utilisé`);
  }

  const newTemplateData = {
    name: `${template.name}_copy_${Date.now()}`,
    language: template.language || 'fr',
    category: template.category || 'UTILITY',
    header_type: template.header_type || 'none',
    header_content: template.header_content || null,
    body_content: safeBodyContent,
    footer_content: template.footer_content || null,
    buttons: template.buttons || [],
    status: 'pending'
  };

  return createTemplate(userId, newTemplateData);
}

/**
 * Tester un template avec des variables d'exemple
 */
function previewTemplate(template, variables = {}) {
  let preview = {
    header: template.header_content || '',
    body: template.body_content || '',
    footer: template.footer_content || '',
    buttons: template.buttons || []
  };

  // Remplacer les variables
  if (template.header_type === 'text' && template.header_content) {
    preview.header = replaceVariables(template.header_content, variables);
  }
  preview.body = replaceVariables(template.body_content, variables);
  if (template.footer_content) {
    preview.footer = replaceVariables(template.footer_content, variables);
  }

  return preview;
}

/**
 * Remplacer les variables dans un texte
 */
function replaceVariables(text, variables) {
  if (!text) return text;
  return text.replace(/{{(\d+)}}/g, (match, index) => {
    const varIndex = parseInt(index);
    return variables[varIndex] || match;
  });
}

/**
 * Assigner un template par défaut à un client
 */
async function assignDefaultTemplateToClient(clientId) {
  try {
    // Récupérer l'ID du template next_new_chat_v1
    const templateResult = await db.query(
      `SELECT id, name FROM templates WHERE name = 'next_new_chat_v1' AND status = 'approved' LIMIT 1`
    );
    
    if (templateResult.rows.length === 0) {
      logger.warn(`Template "next_new_chat_v1" non trouvé ou non approuvé`);
      return { success: false, reason: 'template_not_found' };
    }
    
    const templateId = templateResult.rows[0].id;
    const templateName = templateResult.rows[0].name;
    
    // Vérifier si déjà assigné
    const existing = await db.query(
      `SELECT id FROM client_templates WHERE client_id = $1 AND template_id = $2`,
      [clientId, templateId]
    );
    
    if (existing.rows.length > 0) {
      logger.info(`Template déjà assigné au client ${clientId}`);
      return { success: true, already_assigned: true };
    }
    
    // Assigner le template
    await db.query(
      `INSERT INTO client_templates (client_id, template_id, is_active, assigned_at, assigned_by)
       VALUES ($1, $2, true, NOW(), $3)`,
      [clientId, templateId, null]
    );
    
    logger.info(`Template "${templateName}" assigné au client ${clientId}`);
    return { success: true, template_id: templateId, template_name: templateName };
    
  } catch (error) {
    logger.error('Erreur assignation template par défaut:', error);
    return { success: false, reason: error.message };
  }
}

/**
 * Formater les paramètres d'un template pour WATI
 * Convertit les variables nommées en variables numérotées selon l'ordre du template
 */
async function formatTemplateParametersForWATI(templateName, userParams) {
  // 1. Récupérer le template
  const template = await getTemplateByName(templateName);
  
  if (!template) {
    throw new Error(`Template ${templateName} non trouvé`);
  }
  
  // 2. Extraire l'ordre des variables du template (ex: [1, 2, 3, 4, 5, 6, 7, 8])
  let templateVars = template.variables;
  if (typeof templateVars === 'string') {
    templateVars = JSON.parse(templateVars);
  }
  
  // 3. Si templateVars est un tableau de nombres, déterminer l'ordre
  let orderedParams = [];
  
  if (templateVars.length > 0 && typeof templateVars[0] === 'number') {
    // C'est un template avec variables numérotées {{1}}, {{2}}, etc.
    const maxVar = Math.max(...templateVars);
    
    // Pour chaque position, trouver la valeur correspondante
    // On utilise l'ordre des clés dans userParams
    const userKeys = Object.keys(userParams);
    
    for (let i = 1; i <= maxVar; i++) {
      let value = null;
      
      // Chercher une variable qui correspond à cette position
      // Soit par l'ordre (position 1 = première clé)
      if (userKeys[i - 1]) {
        value = userParams[userKeys[i - 1]];
      }
      
      // Si pas trouvé, chercher par convention de nom
      if (!value && userParams[`var${i}`]) {
        value = userParams[`var${i}`];
      }
      if (!value && userParams[`param${i}`]) {
        value = userParams[`param${i}`];
      }
      
      if (value) {
        orderedParams.push({
          name: `{{${i}}}`,
          value: String(value)
        });
      }
    }
  } 
  // 4. Si templateVars est un tableau de strings
  else if (templateVars.length > 0 && typeof templateVars[0] === 'string') {
    // Convertir les noms de variables en positions
    const varToPosition = {};
    templateVars.forEach((varName, idx) => {
      varToPosition[varName] = idx + 1;
    });
    
    for (const [key, value] of Object.entries(userParams)) {
      const position = varToPosition[key];
      if (position) {
        orderedParams.push({
          name: `{{${position}}}`,
          value: String(value)
        });
      }
    }
  }
  
  // 5. Détecter et ajouter le PDF comme fichier
  let pdfUrl = null;
  for (const [key, value] of Object.entries(userParams)) {
    if (typeof value === 'string' && (value.match(/\.(pdf)$/i))) {
      pdfUrl = value;
      break;
    }
  }
  
  if (pdfUrl && template.header_type === 'document') {
    orderedParams.push({
      name: 'file',
      value: pdfUrl
    });
  }
  
  console.log(`📋 Template ${templateName}: ${orderedParams.length} paramètres formatés`);
  return orderedParams;
}

/**
 * Récupérer un template par son nom
 */
async function getTemplateByName(templateName) {
  const res = await db.query(
    `SELECT t.*,
            u.email as created_by_email,
            COALESCE(u.full_name, u.email) as created_by_name
     FROM templates t
     LEFT JOIN users u ON t.created_by = u.id
     WHERE t.name = $1`,
    [templateName]
  );

  if (res.rows.length === 0) {
    return null;
  }

  const template = res.rows[0];
  template.variables = template.variables || extractVariables(template.body_content);
  template.buttons = template.buttons || [];
  return template;
}

/**
 * Mettre à jour manuellement le statut d'un template
 */
async function manualStatusUpdate(templateId, userId, status, reason) {
  const client = await db.getClient();
  try {
    await client.query('BEGIN');

    const template = await getTemplateById(templateId);

    // Mettre à jour le template
    await client.query(
      `UPDATE templates
       SET status = $1,
           rejection_reason = $2,
           updated_at = CURRENT_TIMESTAMP
       WHERE id = $3
       RETURNING *`,
      [status, reason || null, templateId]
    );

    // Mettre à jour prelude_templates si existe
    await client.query(
      `UPDATE prelude_templates
       SET status = $1,
           prelude_status = $2,
           rejection_reason = $3,
           updated_at = CURRENT_TIMESTAMP
       WHERE template_id = $4`,
      [status, status.toUpperCase(), reason || null, templateId]
    );

    await client.query('COMMIT');

    logger.info(`Template ${templateId} mis à jour manuellement: ${status} par ${userId}`);

    return {
      success: true,
      template_id: templateId,
      status: status,
      reason: reason
    };

  } catch (error) {
    await client.query('ROLLBACK');
    logger.error('Erreur mise à jour manuelle template:', error);
    throw error;
  } finally {
    client.release();
  }
}

module.exports = {
  createTemplate,
  submitTemplateToMeta,
  getTemplates,
  getTemplateById,
  getTemplateByName,
  updateTemplate,
  deleteTemplate,
  duplicateTemplate,
  refreshTemplateStatus,
  previewTemplate,
  extractVariables,
  replaceVariables,
  assignDefaultTemplateToClient,
  manualStatusUpdate,
  formatTemplateParametersForWATI
};
