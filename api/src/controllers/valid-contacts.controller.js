// src/controllers/valid-contacts.controller.js
const { query } = require('../config/database');
const logger = require('../utils/logger');

class ValidContactsController {
  /**
   * GET /api/v1/bot/valid-contacts
   * Récupère les contacts WhatsApp validés (table whatsapp_valid_contacts)
   * Pagination : limit (défaut 1000), offset (défaut 0)
   * Authentification : API Key (verifyApiKey) ou admin JWT
   */
  async getValidContacts(request, reply) {
    try {
      const { limit = 1000, offset = 0, since } = request.query;

      let whereClause = '';
      const params = [];
      if (since) {
        whereClause = 'WHERE activated_at >= $1';
        params.push(since);
      }

      const countResult = await query(
        `SELECT COUNT(*) FROM whatsapp_valid_contacts ${whereClause}`,
        params
      );
      const total = parseInt(countResult.rows[0].count);

      const rows = await query(
        `SELECT contract_number, whatsapp_phone, activated_at
         FROM whatsapp_valid_contacts
         ${whereClause}
         ORDER BY activated_at DESC
         LIMIT $${params.length + 1} OFFSET $${params.length + 2}`,
        [...params, parseInt(limit), parseInt(offset)]
      );

      return reply.send({
        success: true,
        data: rows,
        pagination: { total, limit: parseInt(limit), offset: parseInt(offset) }
      });
    } catch (err) {
      request.log.error(err);
      return reply.code(500).send({ success: false, message: err.message });
    }
  }
}

module.exports = new ValidContactsController();
