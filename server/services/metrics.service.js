const { pool } = require('../db/pool');

async function recordMetrics(productId, metrics) {
  try {
    const m = metrics;
    const p = { id: productId };

    await pool.query(
      `INSERT INTO metrics_snapshots(
        product_id, total_users, active_users_24h, trial_users, pro_users,
        churned_users, free_override_users, mrr_cents, total_revenue_cents,
        errors_24h, avg_response_ms, signups_24h, pay_apps_created_24h,
        pdfs_generated_24h, emails_sent_24h, metadata
      ) VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16)`,
      [
        p.id,
        m.total_users || 0, m.active_users_24h || 0, m.trial_users || 0, m.pro_users || 0,
        m.churned_users || 0, m.free_override_users || 0, m.mrr_cents || 0, m.total_revenue_cents || 0,
        m.errors_24h || 0, m.avg_response_ms || 0, m.signups_24h || 0, m.pay_apps_created_24h || 0,
        m.pdfs_generated_24h || 0, m.emails_sent_24h || 0, JSON.stringify(m.metadata || {})
      ]
    );

    // Auto-generate alerts for anomalies
    if ((m.errors_24h || 0) > 50) {
      await pool.query(
        `INSERT INTO alerts(product_id, type, severity, title, message) VALUES($1, 'error_spike', 'critical', $2, $3)`,
        [p.id, `Error Spike: ${m.errors_24h} errors in 24h`, `Error count exceeded threshold (50). Current: ${m.errors_24h}`]
      );
    }
    if ((m.avg_response_ms || 0) > 3000) {
      await pool.query(
        `INSERT INTO alerts(product_id, type, severity, title, message) VALUES($1, 'slow_api', 'warning', $2, $3)`,
        [p.id, `Slow API: Avg response ${m.avg_response_ms}ms`, `API response time above 3000ms threshold`]
      );
    }
  } catch (err) {
    console.error('[Metrics Service Error]', err.message);
    throw err;
  }
}

module.exports = { recordMetrics };
