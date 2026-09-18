const fp = require('fastify-plugin');

module.exports = fp(async function (fastify, opts) {
  await fastify.register(require('@fastify/jwt'), {
    secret: process.env.JWT_SECRET || 'votre-secret-jwt-tres-securise'
  });
});
