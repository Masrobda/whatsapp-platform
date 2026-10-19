// api/src/routes/v1/vehicle-mapping.routes.js
const vehicleMappingController = require('../../controllers/vehicle-mapping.controller');
const { authenticateBoth } = require('../../middlewares/authenticate-both');

async function vehicleMappingRoutes(fastify, opts) {
  // Toutes les routes nécessitent une authentification (JWT ou API Token)
  fastify.addHook('preValidation', authenticateBoth);

  fastify.get('/', vehicleMappingController.getMappings);
  fastify.post('/', vehicleMappingController.createMapping);
  fastify.put('/:id', vehicleMappingController.updateMapping);
  fastify.delete('/:id', vehicleMappingController.deleteMapping);
  fastify.post('/bulk-import', vehicleMappingController.bulkImport);
}

module.exports = vehicleMappingRoutes;
