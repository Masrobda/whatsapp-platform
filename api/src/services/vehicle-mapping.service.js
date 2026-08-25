// api/src/services/vehicle-mapping.service.js
const { query } = require('../config/database');
const logger = require('../utils/logger');

class VehicleMappingService {
  /**
   * Récupère tous les mappings pour un client
   */
  async getMappings(clientId) {
    const result = await query(
      `SELECT id, license_num, phone_number, driver_name, created_at, updated_at
       FROM vehicle_phone_mapping
       WHERE client_id = $1
       ORDER BY license_num ASC`,
      [clientId]
    );
    return result.rows;
  }

  /**
   * Récupère un mapping par son ID (vérification client)
   */
  async getMappingById(id, clientId) {
    const result = await query(
      `SELECT id, license_num, phone_number, driver_name, created_at, updated_at
       FROM vehicle_phone_mapping
       WHERE id = $1 AND client_id = $2`,
      [id, clientId]
    );
    return result.rows[0] || null;
  }

  /**
   * Récupère le téléphone pour une plaque (sans vérification client)
   */
  async getPhoneByLicense(licenseNum) {
    const result = await query(
      `SELECT phone_number FROM vehicle_phone_mapping WHERE license_num = $1`,
      [licenseNum]
    );
    return result.rows[0]?.phone_number || null;
  }

  /**
   * Crée un nouveau mapping
   */
  async createMapping(clientId, licenseNum, phoneNumber, driverName = null) {
    // Vérifier si la plaque existe déjà pour ce client
    const existing = await query(
      `SELECT id FROM vehicle_phone_mapping WHERE license_num = $1 AND client_id = $2`,
      [licenseNum, clientId]
    );
    if (existing.rowCount > 0) {
      throw new Error(`La plaque ${licenseNum} est déjà enregistrée pour ce client.`);
    }

    const result = await query(
      `INSERT INTO vehicle_phone_mapping (client_id, license_num, phone_number, driver_name)
       VALUES ($1, $2, $3, $4)
       RETURNING id, license_num, phone_number, driver_name, created_at, updated_at`,
      [clientId, licenseNum, phoneNumber, driverName]
    );
    return result.rows[0];
  }

  /**
   * Met à jour un mapping existant
   */
  async updateMapping(id, clientId, phoneNumber, driverName = null) {
    const result = await query(
      `UPDATE vehicle_phone_mapping
       SET phone_number = $1, driver_name = $2, updated_at = NOW()
       WHERE id = $3 AND client_id = $4
       RETURNING id, license_num, phone_number, driver_name, updated_at`,
      [phoneNumber, driverName, id, clientId]
    );
    if (result.rowCount === 0) {
      throw new Error('Mapping non trouvé ou non autorisé.');
    }
    return result.rows[0];
  }

  /**
   * Supprime un mapping
   */
  async deleteMapping(id, clientId) {
    const result = await query(
      `DELETE FROM vehicle_phone_mapping WHERE id = $1 AND client_id = $2`,
      [id, clientId]
    );
    return result.rowCount > 0;
  }

  /**
   * Import en masse (remplace tous les mappings d'un client)
   */
  async bulkImport(clientId, mappings) {
    // Supprimer tous les mappings existants du client
    await query(`DELETE FROM vehicle_phone_mapping WHERE client_id = $1`, [clientId]);

    if (!mappings || mappings.length === 0) return [];

    const inserted = [];
    for (const mapping of mappings) {
      const { license_num, phone_number, driver_name } = mapping;
      const result = await query(
        `INSERT INTO vehicle_phone_mapping (client_id, license_num, phone_number, driver_name)
         VALUES ($1, $2, $3, $4)
         RETURNING id, license_num, phone_number, driver_name`,
        [clientId, license_num, phone_number, driver_name || null]
      );
      inserted.push(result.rows[0]);
    }
    return inserted;
  }
}

module.exports = new VehicleMappingService();
