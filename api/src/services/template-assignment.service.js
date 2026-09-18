// src/services/template-assignment.service.js

const { query } = require('../config/database');
const logger = require('../utils/logger');

class TemplateAssignmentService {
  
  /**
   * Assigner un template à un client
   */
  async assignTemplateToClient(clientId, templateId, userId, notes = '') {
    try {
      // Vérifier que le template existe et est approuvé
      const templateCheck = await query(
        `SELECT id, name, status FROM templates WHERE id = $1`,
        [templateId]
      );

      if (templateCheck.rows.length === 0) {
        throw { statusCode: 404, message: 'Template non trouvé' };
      }

      const template = templateCheck.rows[0];

      // Vérifier que le template est approuvé
      if (template.status !== 'approved') {
        throw { 
          statusCode: 400, 
          message: 'Seuls les templates approuvés peuvent être assignés aux clients' 
        };
      }

      // Vérifier que le client existe
      const clientCheck = await query(
        `SELECT id, company_name FROM clients WHERE id = $1`,
        [clientId]
      );

      if (clientCheck.rows.length === 0) {
        throw { statusCode: 404, message: 'Client non trouvé' };
      }

      // Vérifier si déjà assigné
      const existing = await query(
        `SELECT id FROM client_templates WHERE client_id = $1 AND template_id = $2`,
        [clientId, templateId]
      );

      let result;
      if (existing.rows.length > 0) {
        // Mise à jour (réactivation)
        result = await query(
          `UPDATE client_templates 
           SET is_active = true, assigned_by = $1, assigned_at = NOW(), notes = $2
           WHERE client_id = $3 AND template_id = $4
           RETURNING *`,
          [userId, notes, clientId, templateId]
        );
        logger.info(`Template ${templateId} réassigné au client ${clientId}`);
      } else {
        // Nouvelle assignation
        result = await query(
          `INSERT INTO client_templates (client_id, template_id, assigned_by, notes)
           VALUES ($1, $2, $3, $4)
           RETURNING *`,
          [clientId, templateId, userId, notes]
        );
        logger.info(`Template ${templateId} assigné au client ${clientId}`);
      }

      return {
        success: true,
        data: result.rows[0],
        template: template.name
      };

    } catch (error) {
      logger.error('Erreur assignation template:', error);
      throw error;
    }
  }

  /**
   * Retirer l'assignation d'un template à un client
   */
  async removeTemplateFromClient(clientId, templateId) {
    try {
      const result = await query(
        `UPDATE client_templates 
         SET is_active = false 
         WHERE client_id = $1 AND template_id = $2 
         RETURNING id`,
        [clientId, templateId]
      );

      if (result.rows.length === 0) {
        throw { statusCode: 404, message: 'Assignation non trouvée' };
      }

      logger.info(`Template ${templateId} retiré du client ${clientId}`);
      return { success: true };

    } catch (error) {
      logger.error('Erreur retrait template:', error);
      throw error;
    }
  }

  /**
   * Récupérer tous les templates assignés à un client
   */
  async getClientTemplates(clientId, filters = {}) {
    try {
      const { is_active = true, page = 1, limit = 50 } = filters;
      const offset = (page - 1) * limit;

      const whereClause = `
        WHERE ct.client_id = $1 
        AND ct.is_active = $2
      `;

      const countResult = await query(
        `SELECT COUNT(*) FROM client_templates ct ${whereClause}`,
        [clientId, is_active]
      );
      const total = parseInt(countResult.rows[0].count);

      const result = await query(
        `SELECT 
           ct.*,
           t.name as template_name,
           t.category,
           t.language,
           t.header_type,
           t.body_content,
           t.variables,
           t.buttons,
           t.wa_template_id,
           u.email as assigned_by_email,
           COALESCE(u.full_name, u.email) as assigned_by_name
         FROM client_templates ct
         JOIN templates t ON ct.template_id = t.id
         LEFT JOIN users u ON ct.assigned_by = u.id
         ${whereClause}
         ORDER BY ct.assigned_at DESC
         LIMIT $3 OFFSET $4`,
        [clientId, is_active, limit, offset]
      );

      return {
        success: true,
        data: result.rows,
        pagination: {
          total,
          page,
          limit,
          pages: Math.ceil(total / limit)
        }
      };

    } catch (error) {
      logger.error('Erreur récupération templates client:', error);
      throw error;
    }
  }

  /**
   * Récupérer tous les clients auxquels un template est assigné
   */
  async getTemplateClients(templateId, filters = {}) {
    try {
      const { is_active = true, page = 1, limit = 50 } = filters;
      const offset = (page - 1) * limit;

      const whereClause = `
        WHERE ct.template_id = $1 
        AND ct.is_active = $2
      `;

      const countResult = await query(
        `SELECT COUNT(*) FROM client_templates ct ${whereClause}`,
        [templateId, is_active]
      );
      const total = parseInt(countResult.rows[0].count);

      const result = await query(
        `SELECT 
           ct.*,
           c.company_name,
           c.email,
           c.phone,
           u.email as assigned_by_email
         FROM client_templates ct
         JOIN clients c ON ct.client_id = c.id
         LEFT JOIN users u ON ct.assigned_by = u.id
         ${whereClause}
         ORDER BY c.company_name ASC
         LIMIT $3 OFFSET $4`,
        [templateId, is_active, limit, offset]
      );

      return {
        success: true,
        data: result.rows,
        pagination: {
          total,
          page,
          limit,
          pages: Math.ceil(total / limit)
        }
      };

    } catch (error) {
      logger.error('Erreur récupération clients template:', error);
      throw error;
    }
  }

  /**
   * Récupérer les templates disponibles pour un client (non encore assignés)
   */
  async getAvailableTemplatesForClient(clientId, filters = {}) {
    try {
      const { page = 1, limit = 50, category, language } = filters;
      const offset = (page - 1) * limit;

      let whereClause = `
        WHERE t.status = 'approved'
        AND t.id NOT IN (
          SELECT template_id 
          FROM client_templates 
          WHERE client_id = $1 AND is_active = true
        )
      `;
      const params = [clientId];
      let paramIndex = 2;

      if (category) {
        whereClause += ` AND t.category = $${paramIndex}`;
        params.push(category);
        paramIndex++;
      }

      if (language) {
        whereClause += ` AND t.language = $${paramIndex}`;
        params.push(language);
        paramIndex++;
      }

      const countResult = await query(
        `SELECT COUNT(*) FROM templates t ${whereClause}`,
        params
      );
      const total = parseInt(countResult.rows[0].count);

      const result = await query(
        `SELECT 
           t.id,
           t.name,
           t.category,
           t.language,
           t.header_type,
           t.body_content,
           t.variables,
           t.created_at,
           u.email as created_by_email
         FROM templates t
         LEFT JOIN users u ON t.created_by = u.id
         ${whereClause}
         ORDER BY t.created_at DESC
         LIMIT $${paramIndex} OFFSET $${paramIndex + 1}`,
        [...params, limit, offset]
      );

      return {
        success: true,
        data: result.rows,
        pagination: {
          total,
          page,
          limit,
          pages: Math.ceil(total / limit)
        }
      };

    } catch (error) {
      logger.error('Erreur récupération templates disponibles:', error);
      throw error;
    }
  }

  /**
   * Vérifier si un client a accès à un template
   */
  async checkClientTemplateAccess(clientId, templateId) {
    try {
      const result = await query(
        `SELECT COUNT(*) as has_access
         FROM client_templates
         WHERE client_id = $1 
           AND template_id = $2 
           AND is_active = true`,
        [clientId, templateId]
      );

      return result.rows[0].has_access > 0;

    } catch (error) {
      logger.error('Erreur vérification accès template:', error);
      return false;
    }
  }

  /**
   * Récupérer les templates accessibles pour l'envoi de messages
   */
  async getAccessibleTemplates(clientId, filters = {}) {
    try {
      const { category, language } = filters;

      let sql = `
        SELECT 
          t.*,
          ct.notes as assignment_notes,
          ct.assigned_at
        FROM client_templates ct
        JOIN templates t ON ct.template_id = t.id
        WHERE ct.client_id = $1 
          AND ct.is_active = true 
          AND t.status = 'approved'
      `;
      const params = [clientId];
      let paramIndex = 2;

      if (category) {
        sql += ` AND t.category = $${paramIndex}`;
        params.push(category);
        paramIndex++;
      }

      if (language) {
        sql += ` AND t.language = $${paramIndex}`;
        params.push(language);
        paramIndex++;
      }

      sql += ` ORDER BY t.name ASC`;

      const result = await query(sql, params);

      return {
        success: true,
        data: result.rows,
        count: result.rows.length
      };

    } catch (error) {
      logger.error('Erreur récupération templates accessibles:', error);
      throw error;
    }
  }

  // ========== NOUVELLES MÉTHODES ==========

  /**
   * Récupérer toutes les assignations (pour l'admin)
   */
  async getAllAssignments(filters = {}) {
    try {
      const { 
        page = 1, 
        limit = 50, 
        client_id, 
        template_id,
        is_active = true 
      } = filters;
      
      const offset = (page - 1) * limit;
      
      let whereClause = 'WHERE 1=1';
      const params = [];
      let paramIndex = 1;

      if (client_id) {
        whereClause += ` AND ct.client_id = $${paramIndex}`;
        params.push(client_id);
        paramIndex++;
      }

      if (template_id) {
        whereClause += ` AND ct.template_id = $${paramIndex}`;
        params.push(template_id);
        paramIndex++;
      }

      if (is_active !== undefined) {
        whereClause += ` AND ct.is_active = $${paramIndex}`;
        params.push(is_active);
        paramIndex++;
      }

      // Compter le total
      const countResult = await query(`
        SELECT COUNT(*) 
        FROM client_templates ct
        ${whereClause}
      `, params);
      
      const total = parseInt(countResult.rows[0].count);

      // Récupérer les assignations avec toutes les informations
      const result = await query(`
        SELECT 
          ct.id,
          ct.client_id,
          ct.template_id,
          ct.assigned_at,
          ct.assigned_by,
          ct.is_active,
          ct.notes,
          c.company_name as client_name,
          c.email as client_email,
          t.name as template_name,
          t.category as template_category,
          t.language as template_language,
          t.status as template_status,
          u.email as assigned_by_email,
          COALESCE(u.full_name, u.email) as assigned_by_name
        FROM client_templates ct
        JOIN clients c ON ct.client_id = c.id
        JOIN templates t ON ct.template_id = t.id
        LEFT JOIN users u ON ct.assigned_by = u.id
        ${whereClause}
        ORDER BY ct.assigned_at DESC
        LIMIT $${paramIndex} OFFSET $${paramIndex + 1}
      `, [...params, limit, offset]);

      return {
        success: true,
        data: result.rows,
        pagination: {
          total,
          page,
          limit,
          pages: Math.ceil(total / limit)
        }
      };

    } catch (error) {
      logger.error('Erreur récupération toutes assignations:', error);
      throw error;
    }
  }

  /**
   * Récupérer les statistiques des assignations
   */
  async getAssignmentStats() {
    try {
      const stats = await query(`
        SELECT
          COUNT(DISTINCT ct.client_id) as total_clients_with_templates,
          COUNT(DISTINCT ct.template_id) as total_templates_assigned,
          COUNT(ct.id) as total_assignments,
          COUNT(ct.id) FILTER (WHERE ct.is_active = true) as active_assignments,
          COALESCE(
            (SELECT AVG(template_count) FROM (
              SELECT COUNT(*) as template_count 
              FROM client_templates 
              GROUP BY client_id
            ) as counts),
            0
          ) as avg_templates_per_client
        FROM client_templates ct
      `);

      // Top 5 clients avec le plus de templates
      const topClients = await query(`
        SELECT 
          c.id,
          c.company_name,
          c.email,
          COUNT(ct.id) as templates_count
        FROM clients c
        LEFT JOIN client_templates ct ON c.id = ct.client_id AND ct.is_active = true
        GROUP BY c.id, c.company_name, c.email
        HAVING COUNT(ct.id) > 0
        ORDER BY templates_count DESC
        LIMIT 5
      `);

      // Top 5 templates les plus assignés
      const topTemplates = await query(`
        SELECT 
          t.id,
          t.name,
          t.category,
          COUNT(ct.id) as assignments_count
        FROM templates t
        LEFT JOIN client_templates ct ON t.id = ct.template_id AND ct.is_active = true
        WHERE t.status = 'approved'
        GROUP BY t.id, t.name, t.category
        HAVING COUNT(ct.id) > 0
        ORDER BY assignments_count DESC
        LIMIT 5
      `);

      // Répartition par catégorie
      const categoryDistribution = await query(`
        SELECT 
          t.category,
          COUNT(ct.id) as assignments_count
        FROM client_templates ct
        JOIN templates t ON ct.template_id = t.id
        WHERE ct.is_active = true
        GROUP BY t.category
        ORDER BY assignments_count DESC
      `);

      return {
        success: true,
        data: {
          overview: stats.rows[0],
          top_clients: topClients.rows,
          top_templates: topTemplates.rows,
          category_distribution: categoryDistribution.rows
        }
      };

    } catch (error) {
      logger.error('Erreur récupération stats assignations:', error);
      throw error;
    }
  }
}

module.exports = new TemplateAssignmentService();
