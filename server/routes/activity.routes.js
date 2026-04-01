const express = require('express');
const router = express.Router();
const { pool } = require('../db/pool');
const { authMiddleware } = require('../middleware/auth');

// GET /api/activity
router.get('/', authMiddleware, async (req, res) => {
  try {
    const limit = Math.min(100, Math.max(1, parseInt(req.query.limit) || 30));
    const productSlug = req.query.product;
    let activity;
    if (productSlug) {
      activity = (await pool.query(
        'SELECT * FROM activity_log WHERE product_slug = $1 ORDER BY created_at DESC LIMIT $2',
        [productSlug, limit]
      )).rows;
    } else {
      activity = (await pool.query(
        'SELECT * FROM activity_log ORDER BY created_at DESC LIMIT $1',
        [limit]
      )).rows;
    }
    res.json({ data: activity });
  } catch (err) {
    console.error('[GET /api/activity]', err.message);
    res.status(500).json({ error: 'Failed to load activity log' });
  }
});

module.exports = router;
