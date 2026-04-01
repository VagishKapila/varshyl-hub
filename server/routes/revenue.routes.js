const express = require('express');
const router = express.Router();
const { pool } = require('../db/pool');
const { authMiddleware } = require('../middleware/auth');

// GET /api/revenue
router.get('/', authMiddleware, async (req, res) => {
  try {
    // Monthly revenue trend from snapshots (last 12 months)
    const monthly = (await pool.query(
      `SELECT p.slug, p.name, p.color,
        DATE_TRUNC('month', ms.recorded_at) as month,
        MAX(ms.mrr_cents) as mrr_cents,
        MAX(ms.total_revenue_cents) as total_revenue_cents
       FROM metrics_snapshots ms
       JOIN products p ON ms.product_id = p.id
       WHERE ms.recorded_at > NOW() - INTERVAL '12 months'
       GROUP BY p.slug, p.name, p.color, DATE_TRUNC('month', ms.recorded_at)
       ORDER BY month`
    )).rows;

    // Revenue by product (latest)
    const byProduct = (await pool.query(
      `SELECT DISTINCT ON (p.id) p.slug, p.name, p.color, p.icon,
        ms.mrr_cents, ms.total_revenue_cents, ms.pro_users
       FROM products p
       LEFT JOIN metrics_snapshots ms ON ms.product_id = p.id
       WHERE p.is_active = true
       ORDER BY p.id, ms.recorded_at DESC`
    )).rows;

    res.json({ data: { monthly, byProduct } });
  } catch (err) {
    console.error('[GET /api/revenue]', err.message);
    res.status(500).json({ error: 'Failed to load revenue data' });
  }
});

// GET /api/revenue/details
router.get('/details', authMiddleware, async (req, res) => {
  try {
    // Per-product revenue cards with current month and previous month comparison
    const products = (await pool.query(
      `SELECT id, slug, name, color, icon FROM products WHERE is_active = true ORDER BY name`
    )).rows;

    const productCards = [];
    for (const p of products) {
      // Latest snapshot
      const latest = (await pool.query(
        `SELECT ms.mrr_cents, ms.pro_users, ms.total_revenue_cents FROM metrics_snapshots ms
         WHERE ms.product_id = $1 ORDER BY ms.recorded_at DESC LIMIT 1`,
        [p.id]
      )).rows[0];

      // Previous month's MRR (30 days ago)
      const previous = (await pool.query(
        `SELECT ms.mrr_cents FROM metrics_snapshots ms
         WHERE ms.product_id = $1 AND ms.recorded_at < NOW() - INTERVAL '30 days'
         ORDER BY ms.recorded_at DESC LIMIT 1`,
        [p.id]
      )).rows[0];

      const currentMRR = latest?.mrr_cents || 0;
      const previousMRR = previous?.mrr_cents || 0;
      const mrrGrowth = previousMRR > 0 ? ((currentMRR - previousMRR) / previousMRR) * 100 : 0;
      const proUsers = latest?.pro_users || 0;
      const arpu = proUsers > 0 ? currentMRR / proUsers : 0;

      productCards.push({
        name: p.name,
        slug: p.slug,
        color: p.color,
        icon: p.icon,
        mrr: currentMRR,
        previous_month_mrr: previousMRR,
        mrr_growth_percent: Math.round(mrrGrowth * 100) / 100,
        total_all_time_revenue: latest?.total_revenue_cents || 0,
        pro_users: proUsers,
        arpu: Math.round(arpu * 100) / 100
      });
    }

    // Daily revenue data for last 30 days
    const dailyRevenue = (await pool.query(
      `SELECT DATE(ms.recorded_at) as date, p.slug, MAX(ms.mrr_cents) as mrr_cents
       FROM metrics_snapshots ms
       JOIN products p ON ms.product_id = p.id
       WHERE ms.recorded_at > NOW() - INTERVAL '30 days'
       GROUP BY DATE(ms.recorded_at), p.slug
       ORDER BY date ASC`
    )).rows;

    // Revenue milestones (significant events)
    const milestones = [];

    // Find first $1K MRR
    const first1k = (await pool.query(
      `SELECT MIN(recorded_at) as date FROM metrics_snapshots
       WHERE mrr_cents >= 100000`
    )).rows[0];
    if (first1k?.date) {
      milestones.push({
        title: 'First $1K MRR',
        date: first1k.date,
        description: 'First month with $1,000 MRR achieved'
      });
    }

    // Find first 100 pro users
    const first100users = (await pool.query(
      `SELECT MIN(recorded_at) as date FROM metrics_snapshots
       WHERE pro_users >= 100`
    )).rows[0];
    if (first100users?.date) {
      milestones.push({
        title: '100 Pro Users',
        date: first100users.date,
        description: 'Reached 100 paying customers'
      });
    }

    // Find $10K MRR milestone
    const first10k = (await pool.query(
      `SELECT MIN(recorded_at) as date FROM metrics_snapshots
       WHERE mrr_cents >= 1000000`
    )).rows[0];
    if (first10k?.date) {
      milestones.push({
        title: '$10K MRR Milestone',
        date: first10k.date,
        description: 'Achieved $10,000 monthly recurring revenue'
      });
    }

    milestones.sort((a, b) => new Date(a.date) - new Date(b.date));

    res.json({
      data: {
        product_cards: productCards,
        daily_revenue: dailyRevenue,
        milestones: milestones
      }
    });
  } catch (err) {
    console.error('[GET /api/revenue/details]', err.message);
    res.status(500).json({ error: 'Failed to load revenue details' });
  }
});

module.exports = router;
