const { query } = require('../config/database');
const logger = require('../utils/logger');

async function getAllBspProviders(request, reply) {
  try {
    const { active_only = true } = request.query;
    
    let sql = 'SELECT * FROM bsp_providers';
    const params = [];
    
    if (active_only) {
      sql += ' WHERE is_active = $1';
      params.push(true);
    }
    
    sql += ' ORDER BY name';
    
    const result = await query(sql, params);
    
    return reply.code(200).send({
      success: true,
      data: result.rows,
      count: result.rowCount
    });
  } catch (error) {
    logger.error('Erreur récupération BSP:', error);
    return reply.code(500).send({
      success: false,
      code: 'INTERNAL_ERROR',
      message: 'Erreur lors de la récupération des fournisseurs BSP'
    });
  }
}

async function getBspById(request, reply) {
  try {
    const { id } = request.params;
    
    const result = await query('SELECT * FROM bsp_providers WHERE id = $1', [id]);
    
    if (result.rowCount === 0) {
      return reply.code(404).send({
        success: false,
        code: 'BSP_NOT_FOUND',
        message: 'Fournisseur BSP non trouvé'
      });
    }
    
    return reply.code(200).send({
      success: true,
      data: result.rows[0]
    });
  } catch (error) {
    logger.error('Erreur récupération BSP par ID:', error);
    return reply.code(500).send({
      success: false,
      code: 'INTERNAL_ERROR',
      message: 'Erreur lors de la récupération du fournisseur BSP'
    });
  }
}

async function createBspProvider(request, reply) {
  try {
    const { name, message_cost, additional_charges = {}, is_active = true } = request.body;
    
    // Validation des charges supplémentaires
    const validatedCharges = {
      fixed: additional_charges.fixed || 0,
      percent: additional_charges.percent || 0
    };
    
    const result = await query(
      `INSERT INTO bsp_providers (name, message_cost, additional_charges, is_active)
       VALUES ($1, $2, $3, $4) RETURNING *`,
      [name, message_cost, validatedCharges, is_active]
    );
    
    return reply.code(201).send({
      success: true,
      message: 'Fournisseur BSP créé avec succès',
      data: result.rows[0]
    });
  } catch (error) {
    logger.error('Erreur création BSP:', error);
    return reply.code(500).send({
      success: false,
      code: 'INTERNAL_ERROR',
      message: 'Erreur lors de la création du fournisseur BSP'
    });
  }
}

async function updateBspProvider(request, reply) {
  try {
    const { id } = request.params;
    const { name, message_cost, additional_charges, is_active } = request.body;
    
    // Vérifier si le BSP existe
    const checkResult = await query('SELECT * FROM bsp_providers WHERE id = $1', [id]);
    
    if (checkResult.rowCount === 0) {
      return reply.code(404).send({
        success: false,
        code: 'BSP_NOT_FOUND',
        message: 'Fournisseur BSP non trouvé'
      });
    }
    
    // Construire la requête dynamique
    const updates = [];
    const params = [];
    let paramIndex = 1;
    
    if (name !== undefined) {
      updates.push(`name = $${paramIndex}`);
      params.push(name);
      paramIndex++;
    }
    
    if (message_cost !== undefined) {
      updates.push(`message_cost = $${paramIndex}`);
      params.push(message_cost);
      paramIndex++;
    }
    
    if (additional_charges !== undefined) {
      updates.push(`additional_charges = $${paramIndex}`);
      params.push(additional_charges);
      paramIndex++;
    }
    
    if (is_active !== undefined) {
      updates.push(`is_active = $${paramIndex}`);
      params.push(is_active);
      paramIndex++;
    }
    
    updates.push(`updated_at = NOW()`);
    params.push(id);
    
    const sql = `
      UPDATE bsp_providers 
      SET ${updates.join(', ')}
      WHERE id = $${paramIndex}
      RETURNING *
    `;
    
    const result = await query(sql, params);
    
    return reply.code(200).send({
      success: true,
      message: 'Fournisseur BSP mis à jour avec succès',
      data: result.rows[0]
    });
  } catch (error) {
    logger.error('Erreur mise à jour BSP:', error);
    return reply.code(500).send({
      success: false,
      code: 'INTERNAL_ERROR',
      message: 'Erreur lors de la mise à jour du fournisseur BSP'
    });
  }
}

async function deleteBspProvider(request, reply) {
  try {
    const { id } = request.params;
    
    // Vérifier si le BSP est utilisé dans des commandes
    const usageCheck = await query(
      'SELECT COUNT(*) FROM orders WHERE selected_bsp_id = $1',
      [id]
    );
    
    const usageCount = parseInt(usageCheck.rows[0].count);
    
    if (usageCount > 0) {
      return reply.code(400).send({
        success: false,
        code: 'BSP_IN_USE',
        message: `Ce fournisseur BSP est utilisé dans ${usageCount} commande(s)`,
        usage_count: usageCount
      });
    }
    
    const result = await query('DELETE FROM bsp_providers WHERE id = $1 RETURNING id', [id]);
    
    if (result.rowCount === 0) {
      return reply.code(404).send({
        success: false,
        code: 'BSP_NOT_FOUND',
        message: 'Fournisseur BSP non trouvé'
      });
    }
    
    return reply.code(200).send({
      success: true,
      message: 'Fournisseur BSP supprimé avec succès'
    });
  } catch (error) {
    logger.error('Erreur suppression BSP:', error);
    return reply.code(500).send({
      success: false,
      code: 'INTERNAL_ERROR',
      message: 'Erreur lors de la suppression du fournisseur BSP'
    });
  }
}

async function calculateBspCost(request, reply) {
  try {
    const { bsp_id, quantity, custom_cost } = request.body;
    
    // Récupérer les informations du BSP
    const bspResult = await query(
      'SELECT * FROM bsp_providers WHERE id = $1 AND is_active = true',
      [bsp_id]
    );
    
    if (bspResult.rowCount === 0) {
      return reply.code(404).send({
        success: false,
        code: 'BSP_NOT_FOUND',
        message: 'Fournisseur BSP non trouvé ou inactif'
      });
    }
    
    const bsp = bspResult.rows[0];
    const messageCost = custom_cost || bsp.message_cost;
    const additionalCharges = bsp.additional_charges || { fixed: 0, percent: 0 };
    
    // Calcul du coût total
    let totalCost = messageCost * quantity;
    totalCost += additionalCharges.fixed || 0;
    totalCost += totalCost * ((additionalCharges.percent || 0) / 100);
    
    return reply.code(200).send({
      success: true,
      data: {
        bsp,
        quantity,
        message_cost: messageCost,
        additional_charges: additionalCharges,
        subtotal: messageCost * quantity,
        fixed_charges: additionalCharges.fixed || 0,
        percent_charges: additionalCharges.percent || 0,
        total_cost: totalCost,
        cost_per_message: totalCost / quantity
      }
    });
  } catch (error) {
    logger.error('Erreur calcul coût BSP:', error);
    return reply.code(500).send({
      success: false,
      code: 'INTERNAL_ERROR',
      message: 'Erreur lors du calcul des coûts'
    });
  }
}

module.exports = {
  getAllBspProviders,
  createBspProvider,
  updateBspProvider,
  deleteBspProvider,
  getBspById,
  calculateBspCost
};
