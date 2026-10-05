// src/plugins/db.js
const fp = require('fastify-plugin');
const { Pool } = require('pg');

module.exports = fp(async (fastify, opts) => {
  // Construire la config à partir des variables séparées
  const dbConfig = {
    host: process.env.DB_HOST || 'localhost',
    port: parseInt(process.env.DB_PORT, 10) || 5432,
    database: process.env.DB_NAME,
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    max: parseInt(process.env.DB_POOL_MAX, 10) || 20,
    min: parseInt(process.env.DB_POOL_MIN, 10) || 2,
    idleTimeoutMillis: 30000,
    connectionTimeoutMillis: 2000,
    ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false,
  };

  // Log de debug (très utile pour vérifier)
  fastify.log.info('[DB PLUGIN] Config utilisée :', {
    host: dbConfig.host,
    port: dbConfig.port,
    database: dbConfig.database,
    user: dbConfig.user,
    passwordLength: dbConfig.password ? dbConfig.password.length : 0,
    ssl: !!dbConfig.ssl,
  });

  const pool = new Pool(dbConfig);

  // Test de connexion au démarrage
  try {
    const client = await pool.connect();
    const res = await client.query('SELECT NOW()');
    fastify.log.info(`PostgreSQL connecté - Temps serveur DB : ${res.rows[0].now}`);
    client.release();
  } catch (err) {
    fastify.log.error('ÉCHEC CONNEXION POSTGRES AU BOOT', err.message);
    fastify.log.error('Stack:', err.stack);
    throw err; // arrête le serveur si DB inaccessible
  }

  fastify.decorate('pg', {
    query: (text, params) => pool.query(text, params),
    pool, // si besoin d'accéder au pool ailleurs
  });

  // Fermeture propre
  fastify.addHook('onClose', async () => {
    fastify.log.info('Fermeture pool PostgreSQL...');
    await pool.end();
  });
});
