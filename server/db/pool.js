const { Pool } = require('pg');

let pool = null;

function createPool() {
  if (pool) return pool;

  pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false,
    max: 10,
    idleTimeoutMillis: 30000,
    connectionTimeoutMillis: 5000,
  });

  pool.on('error', (err) => {
    console.error('[DB Pool Error]', err.message);
  });

  console.log('[DB] Pool created');
  return pool;
}

async function testConnection() {
  const p = getPool();
  try {
    await p.query('SELECT 1');
    console.log('[DB] Connection test passed');
    return true;
  } catch (err) {
    console.error('[DB] Connection test failed:', err.message);
    throw err;
  }
}

function getPool() {
  if (!pool) createPool();
  return pool;
}

// Use a getter so pool is lazily created after dotenv loads
module.exports = {
  get pool() { return getPool(); },
  getPool,
  createPool,
  testConnection,
};
