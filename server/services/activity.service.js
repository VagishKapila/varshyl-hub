const { pool } = require('../db/pool');

async function logActivity(userId, productSlug, action, details = {}, ip = null) {
  try {
    await pool.query(
      'INSERT INTO activity_log(user_id, product_slug, action, details, ip_address) VALUES($1,$2,$3,$4,$5)',
      [userId, productSlug, action, JSON.stringify(details), ip]
    );
  } catch (err) {
    console.error('[logActivity Error]', err.message);
  }
}

module.exports = { logActivity };
