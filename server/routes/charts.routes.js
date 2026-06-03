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

// GET /api/charts/product-health
router.get('/product-health', authMiddleware, async (req, res) => {
  try {
    const products = (await pool.query('SELECT * FROM products WHERE is_active = true ORDER BY name')).rows;
    const result = [];
    for (const p of products) {
      const snap = (await pool.query(
        'SELECT * FROM metrics_snapshots WHERE product_id = $1 ORDER BY recorded_at DESC LIMIT 1', [p.id]
      )).rows[0];
      let score = 100;
      if (snap) {
        if (snap.errors_24h > 50) score -= 30;
        else if (snap.errors_24h > 10) score -= 15;
        if (snap.total_users > 0 && snap.active_users_24h / snap.total_users < 0.05) score -= 20;
        if (snap.signups_24h === 0) score -= 10;
        if (snap.avg_response_ms > 2000) score -= 15;
        else if (snap.avg_response_ms > 500) score -= 5;
      }
      score = Math.max(0, score);
      result.push({
        slug: p.slug, name: p.name, icon: p.icon, color: p.color,
        health_score: score,
        health_label: score >= 80 ? 'Healthy' : score >= 60 ? 'Warning' : 'Critical',
        health_color: score >= 80 ? '#059669' : score >= 60 ? '#d97706' : '#dc2626',
        metrics: snap || null
      });
    }
    res.json({ data: result });
  } catch (err) {
    console.error('[GET /api/charts/product-health]', err.message);
    res.status(500).json({ error: 'Failed' });
  }
});

// GET /api/charts/growth-rate
router.get('/growth-rate', authMiddleware, async (req, res) => {
  try {
    const products = (await pool.query('SELECT * FROM products WHERE is_active = true')).rows;
    const result = [];
    const growth = (curr, prev) => prev && prev > 0 ? +(((curr - prev) / prev) * 100).toFixed(1) : 0;
    for (const p of products) {
      const latest = (await pool.query('SELECT * FROM metrics_snapshots WHERE product_id = $1 ORDER BY recorded_at DESC LIMIT 1', [p.id])).rows[0];
      const prior = (await pool.query(
        'SELECT * FROM metrics_snapshots WHERE product_id = $1 AND recorded_at < NOW() - INTERVAL \'6 days\' ORDER BY recorded_at DESC LIMIT 1', [p.id]
      )).rows[0];
      result.push({
        slug: p.slug, name: p.name, color: p.color,
        user_growth_pct: growth(latest?.total_users || 0, prior?.total_users),
        mrr_growth_pct: growth(latest?.mrr_cents || 0, prior?.mrr_cents),
        signup_trend: latest?.signups_24h || 0,
        has_prior_data: !!prior
      });
    }
    res.json({ data: result });
  } catch (err) {
    console.error('[GET /api/charts/growth-rate]', err.message);
    res.status(500).json({ error: 'Failed' });
  }
});

// GET /api/charts/funnel
router.get('/funnel', authMiddleware, async (req, res) => {
  try {
    const products = (await pool.query('SELECT * FROM products WHERE is_active = true')).rows;
    const result = [];
    for (const p of products) {
      const snap = (await pool.query('SELECT * FROM metrics_snapshots WHERE product_id = $1 ORDER BY recorded_at DESC LIMIT 1', [p.id])).rows[0];
      const total = snap?.total_users || 0;
      const trial = snap?.trial_users || 0;
      const pro = snap?.pro_users || 0;
      result.push({
        slug: p.slug, name: p.name, icon: p.icon, color: p.color,
        total_users: total, trial_users: trial, pro_users: pro,
        trial_rate: total > 0 ? +((trial / total) * 100).toFixed(1) : 0,
        pro_rate: trial > 0 ? +((pro / trial) * 100).toFixed(1) : 0
      });
    }
    res.json({ data: result });
  } catch (err) {
    console.error('[GET /api/charts/funnel]', err.message);
    res.status(500).json({ error: 'Failed' });
  }
});

module.exports = router;
