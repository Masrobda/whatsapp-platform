const { Pool } = require('pg');
require('dotenv').config();

const pool = new Pool({
  host:     process.env.DB_HOST,
  port:     process.env.DB_PORT,
  database: process.env.DB_NAME,
  user:     process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  min: parseInt(process.env.DB_POOL_MIN) || 2,
  max: parseInt(process.env.DB_POOL_MAX) || 20,   // ← 10→20 par instance PM2 (3 instances × 20 = 60 connexions max, bien sous max_connections=300)
  idleTimeoutMillis:      30000,
  connectionTimeoutMillis: 5000,                   // ← 2000→5000 : évite les timeout spurieux sous charge
});

// Test de connexion
pool.on('connect', () => {
  console.log('✅ PostgreSQL connecté');
});

pool.on('error', (err) => {
  console.error('❌ Erreur PostgreSQL:', err);
  process.exit(-1);
});

// Fonction helper pour les requêtes
const query = async (text, params) => {
  const start = Date.now();
  try {
    const res = await pool.query(text, params);
    const duration = Date.now() - start;
    // Log uniquement si lent (>200ms) pour ne pas spammer les logs sous charge
    if (duration > 200) {
      console.warn('⚠️ Slow query', { duration, text: text.substring(0, 80) });
    }
    return res;
  } catch (error) {
    console.error('Database query error:', error);
    throw error;
  }
};

// Fonction pour les transactions
const transaction = async (callback) => {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const result = await callback(client);
    await client.query('COMMIT');
    return result;
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
};

// Fonction pour obtenir un client dédié (transactions manuelles)
const getClient = async () => {
  const client = await pool.connect();
  const queryFn  = client.query.bind(client);
  const release  = client.release.bind(client);

  // Timeout pour détecter les clients non relâchés (deadlock guard)
  const timeout = setTimeout(() => {
    console.error('⚠️ Client checkout timeout — client non relâché après 5s');
  }, 5000);

  client.release = () => {
    clearTimeout(timeout);
    client.removeAllListeners();
    release();
  };

  return client;
};

module.exports = {
  pool,
  query,
  getClient,
  transaction
};
