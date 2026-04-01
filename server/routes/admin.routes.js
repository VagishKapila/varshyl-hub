const express = require('express');
const router = express.Router();
const { pool } = require('../db/pool');
const { authMiddleware } = require('../middleware/auth');
const { logActivity } = require('../services/activity.service');

// GET /health
router.get('/health', async (req, res) => {
  try {
    await pool.query('SELECT 1');
    res.json({ status: 'ok', uptime: process.uptime(), timestamp: new Date().toISOString() });
  } catch (err) {
    res.status(500).json({ status: 'error', error: 'Database unreachable' });
  }
});

// POST /api/admin/seed
router.post('/seed', authMiddleware, async (req, res) => {
  try {
    const { days = 30, clear = false } = req.body;
    if (days < 1 || days > 365) {
      return res.status(400).json({ error: 'Days must be 1-365' });
    }

    // Optionally clear existing snapshots
    if (clear) {
      await pool.query('DELETE FROM metrics_snapshots');
    }

    const products = (await pool.query('SELECT * FROM products WHERE is_active = true')).rows;
    if (products.length === 0) {
      return res.status(400).json({ error: 'No active products to seed' });
    }

    let inserted = 0;

    for (const p of products) {
      // Product-specific growth profiles
      const isCI = p.slug === 'constructinvoice';
      const baseUsers = isCI ? 45 : 120;
      const growthUsers = isCI ? 85 : 280;
      const baseProUsers = isCI ? 5 : 0;
      const growthProUsers = isCI ? 22 : 0;
      const subPrice = isCI ? 4000 : 0;

      for (let daysAgo = days; daysAgo >= 0; daysAgo--) {
        const dayFactor = (days - daysAgo) / days; // 0 → 1
        const jitter = () => Math.random() * 0.15 - 0.075; // ±7.5% noise

        const totalUsers = Math.round((baseUsers + dayFactor * growthUsers) * (1 + jitter()));
        const proUsers = Math.round((baseProUsers + dayFactor * growthProUsers) * (1 + jitter()));
        const trialUsers = isCI ? Math.round((8 + dayFactor * 15) * (1 + jitter())) : 0;

        await pool.query(
          `INSERT INTO metrics_snapshots(
            product_id, recorded_at, total_users, active_users_24h, trial_users,
            pro_users, churned_users, free_override_users, mrr_cents, total_revenue_cents,
            errors_24h, avg_response_ms, signups_24h, pay_apps_created_24h,
            pdfs_generated_24h, emails_sent_24h, metadata
          ) VALUES($1, NOW() - ($2 || ' days')::INTERVAL, $3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17)`,
          [
            p.id,
            daysAgo,
            totalUsers,
            Math.round(totalUsers * (0.25 + dayFactor * 0.15) * (1 + jitter())),
            trialUsers,
            proUsers,
            isCI ? Math.round((2 + dayFactor * 4) * (1 + jitter())) : 0,
            isCI ? Math.round((1 + dayFactor * 2)) : 0,
            proUsers * subPrice,
            Math.round((isCI ? 15000 : 0) + dayFactor * (isCI ? 45000 : 8500)),
            Math.round(Math.max(0, (isCI ? 3 : 5) + Math.random() * (isCI ? 8 : 12) - dayFactor * 5)),
            Math.round((isCI ? 450 : 320) - dayFactor * (isCI ? 150 : 100) + Math.random() * 100),
            Math.round(1 + Math.random() * (isCI ? 4 : 10)),
            Math.round((isCI ? 2 : 0) + Math.random() * (isCI ? 8 : 3)),
            Math.round((isCI ? 5 : 15) + Math.random() * (isCI ? 15 : 40)),
            Math.round((isCI ? 3 : 5) + Math.random() * (isCI ? 10 : 12)),
            JSON.stringify({ product: p.slug, seeded: true })
          ]
        );
        inserted++;
      }
    }

    await logActivity(req.user.id, null, 'metrics_seeded', { days, products: products.length, inserted }, req.ip);
    res.json({ message: `Seeded ${inserted} snapshots across ${products.length} products (${days} days)` });
  } catch (err) {
    console.error('[POST /api/admin/seed]', err.message);
    res.status(500).json({ error: 'Seed failed: ' + err.message });
  }
});

module.exports = router;
