const express = require('express');
const router = express.Router();
const { pool } = require('../db/pool');
const { authMiddleware } = require('../middleware/auth');

// GET /api/charts/revenue-trend
router.get('/revenue-trend', authMiddleware, async (req, res) => {
  try {
    const data = (await pool.query(
      `SELECT p.slug, p.name, p.color,
        DATE_TRUNC('month', ms.recorded_at) as month,
        MAX(ms.mrr_cents) as mrr_cents
       FROM metrics_snapshots ms
       JOIN products p ON ms.product_id = p.id
       WHERE ms.recorded_at > NOW() - INTERVAL '12 months'
       GROUP BY p.slug, p.name, p.color, DATE_TRUNC('month', ms.recorded_at)
       ORDER BY month`
    )).rows;
    res.json({ data });
  } catch (err) {
    console.error('[GET /api/charts/revenue-trend]', err.message);
    res.status(500).json({ error: 'Failed to load chart data' });
  }
});

// GET /api/charts/user-growth
router.get('/user-growth', authMiddleware, async (req, res) => {
  try {
    const data = (await pool.query(
      `SELECT p.slug, p.name, p.color,
        DATE(ms.recorded_at) as date,
        MAX(ms.total_users) as total_users,
        MAX(ms.signups_24h) as signups
       FROM metrics_snapshots ms
       JOIN products p ON ms.product_id = p.id
       WHERE ms.recorded_at > NOW() - INTERVAL '30 days'
       GROUP BY p.slug, p.name, p.color, DATE(ms.recorded_at)
       ORDER BY date`
    )).rows;
    res.json({ data });
  } catch (err) {
    console.error('[GET /api/charts/user-growth]', err.message);
    res.status(500).json({ error: 'Failed to load chart data' });
  }
});

module.exports = router;
