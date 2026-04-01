const jwt = require('jsonwebtoken');
const { pool } = require('../db/pool');
const config = require('../config/env');

function authMiddleware(req, res, next) {
  try {
    const token = req.headers.authorization?.replace('Bearer ', '');
    if (!token) {
      return res.status(401).json({ error: 'Authentication required' });
    }

    try {
      const decoded = jwt.verify(token, config.JWT_SECRET);
      if (!config.ADMIN_EMAILS.includes(decoded.email?.toLowerCase())) {
        return res.status(403).json({ error: 'Admin access required' });
      }
      req.user = decoded;
      next();
    } catch (err) {
      return res.status(401).json({ error: 'Invalid or expired token' });
    }
  } catch (err) {
    console.error('[Auth Middleware Error]', err.message);
    res.status(500).json({ error: 'Authentication failed' });
  }
}

async function apiKeyAuthMiddleware(req, res, next) {
  try {
    const key = req.headers['x-api-key'];
    if (!key) {
      return res.status(401).json({ error: 'API key required' });
    }

    const result = await pool.query('SELECT * FROM products WHERE api_key = $1 AND is_active = true', [key]);
    if (result.rows.length === 0) {
      return res.status(401).json({ error: 'Invalid API key' });
    }

    req.product = result.rows[0];
    next();
  } catch (err) {
    console.error('[API Key Auth Error]', err.message);
    res.status(500).json({ error: 'Auth failed' });
  }
}

module.exports = {
  authMiddleware,
  apiKeyAuthMiddleware
};
