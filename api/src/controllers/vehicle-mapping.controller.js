// api/src/controllers/vehicle-mapping.controller.js
const vehicleMappingService = require('../services/vehicle-mapping.service');
const { normalizePhoneNumber } = require('../utils/phone-validator');
const logger = require('../utils/logger');

/**
 * Récupérer tous les mappings du client
 */
async function getMappings(req, reply) {
  try {
    const clientId = req.user.id;
    const mappings = await vehicleMappingService.getMappings(clientId);
    return reply.send({ success: true, mappings });
  } catch (err) {
    logger.error('[VehicleMapping] getMappings error:', err);
    return reply.status(500).send({ success: false, message: err.message });
  }
}

/**
 * Créer un nouveau mapping
 */
async function createMapping(req, reply) {
  try {
    const clientId = req.user.id;
    const { license_num, phone_number, driver_name } = req.body;

    if (!license_num || !phone_number) {
      return reply.status(400).send({ success: false, message: 'license_num et phone_number requis' });
    }

    const normalizedPhone = normalizePhoneNumber(phone_number);
    if (!normalizedPhone) {
      return reply.status(400).send({ success: false, message: 'Numéro de téléphone invalide' });
    }

    const mapping = await vehicleMappingService.createMapping(
      clientId,
      license_num.toUpperCase(),
      normalizedPhone,
      driver_name || null
    );
    return reply.send({ success: true, mapping });
  } catch (err) {
    logger.error('[VehicleMapping] createMapping error:', err);
    return reply.status(500).send({ success: false, message: err.message });
  }
}

/**
 * Mettre à jour un mapping
 */
async function updateMapping(req, reply) {
  try {
    const clientId = req.user.id;
    const { id } = req.params;
    const { phone_number, driver_name } = req.body;

    if (!phone_number) {
      return reply.status(400).send({ success: false, message: 'phone_number requis' });
    }

    const normalizedPhone = normalizePhoneNumber(phone_number);
    if (!normalizedPhone) {
      return reply.status(400).send({ success: false, message: 'Numéro de téléphone invalide' });
    }

    const mapping = await vehicleMappingService.updateMapping(id, clientId, normalizedPhone, driver_name || null);
    return reply.send({ success: true, mapping });
  } catch (err) {
    logger.error('[VehicleMapping] updateMapping error:', err);
    return reply.status(500).send({ success: false, message: err.message });
  }
}

/**
 * Supprimer un mapping
 */
async function deleteMapping(req, reply) {
  try {
    const clientId = req.user.id;
    const { id } = req.params;

    const deleted = await vehicleMappingService.deleteMapping(id, clientId);
    if (!deleted) {
      return reply.status(404).send({ success: false, message: 'Mapping non trouvé' });
    }
    return reply.send({ success: true, message: 'Mapping supprimé' });
  } catch (err) {
    logger.error('[VehicleMapping] deleteMapping error:', err);
    return reply.status(500).send({ success: false, message: err.message });
  }
}

/**
 * Importer en masse (remplace tous les mappings du client)
 */
async function bulkImport(req, reply) {
  try {
    const clientId = req.user.id;
    const { mappings } = req.body;

    if (!mappings || !Array.isArray(mappings)) {
      return reply.status(400).send({ success: false, message: 'mappings doit être un tableau' });
    }

    // Normaliser les numéros
    const normalized = mappings.map(m => ({
      license_num: m.license_num?.toUpperCase(),
      phone_number: normalizePhoneNumber(m.phone_number),
      driver_name: m.driver_name || null
    }));

    // Vérifier qu'aucun numéro n'est invalide
    const invalid = normalized.filter(m => !m.phone_number);
    if (invalid.length > 0) {
      return reply.status(400).send({
        success: false,
        message: 'Certains numéros sont invalides',
        invalid
      });
    }

    const inserted = await vehicleMappingService.bulkImport(clientId, normalized);
    return reply.send({ success: true, mappings: inserted });
  } catch (err) {
    logger.error('[VehicleMapping] bulkImport error:', err);
    return reply.status(500).send({ success: false, message: err.message });
  }
}

module.exports = {
  getMappings,
  createMapping,
  updateMapping,
  deleteMapping,
  bulkImport
};
