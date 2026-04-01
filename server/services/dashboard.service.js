const { pool } = require('../db/pool');

async function getDashboardKPIs() {
  try {
    // Get all active products
    const products = (await pool.query('SELECT * FROM products WHERE is_active = true ORDER BY name')).rows;

    // Get latest snapshot for each product
    const latestSnapshots = [];
    for (const p of products) {
      const snap = (await pool.query(
        'SELECT * FROM metrics_snapshots WHERE product_id = $1 ORDER BY recorded_at DESC LIMIT 1',
        [p.id]
      )).rows[0];
      latestSnapshots.push({ product: p, metrics: snap || null });
    }

    // Aggregate KPIs
    let totalUsers = 0, totalActive = 0, totalTrial = 0, totalPro = 0;
    let totalChurned = 0, totalFreeOverride = 0, totalMRR = 0, totalRevenue = 0;
    let totalErrors = 0, totalSignups = 0;

    for (const { metrics: m } of latestSnapshots) {
      if (!m) continue;
      totalUsers += m.total_users || 0;
      totalActive += m.active_users_24h || 0;
      totalTrial += m.trial_users || 0;
      totalPro += m.pro_users || 0;
      totalChurned += m.churned_users || 0;
      totalFreeOverride += m.free_override_users || 0;
      totalMRR += m.mrr_cents || 0;
      totalRevenue += parseInt(m.total_revenue_cents || 0);
      totalErrors += m.errors_24h || 0;
      totalSignups += m.signups_24h || 0;
    }

    // Active alerts
    const alerts = (await pool.query(
      'SELECT a.*, p.name as product_name, p.slug as product_slug FROM alerts a JOIN products p ON a.product_id = p.id WHERE a.resolved = false ORDER BY a.created_at DESC LIMIT 10'
    )).rows;

    // Recent activity
    const activity = (await pool.query(
      'SELECT * FROM activity_log ORDER BY created_at DESC LIMIT 10'
    )).rows;

    return {
      kpis: {
        total_users: totalUsers,
        active_users_24h: totalActive,
        trial_users: totalTrial,
        pro_users: totalPro,
        churned_users: totalChurned,
        free_override_users: totalFreeOverride,
        mrr_cents: totalMRR,
        arr_cents: totalMRR * 12,
        total_revenue_cents: totalRevenue,
        errors_24h: totalErrors,
        signups_24h: totalSignups,
        product_count: products.length,
      },
      products: latestSnapshots,
      alerts,
      activity,
    };
  } catch (err) {
    console.error('[Dashboard Service Error]', err.message);
    throw err;
  }
}

module.exports = { getDashboardKPIs };
