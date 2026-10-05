const fp = require('fastify-plugin');

module.exports = fp(async function (fastify, opts) {
  await fastify.register(require('@fastify/cors'), {
    origin: ['https://dashboard.numericexport.com', 'http://localhost:3000'],
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization']
  });
});
