const { pool } = require('../db/pool');

// Alert thresholds — could move to env vars or DB config later
const ALERT_THRESHOLDS = {
  error_spike: { field: 'errors_24h', threshold: 50, severity: 'critical', type: 'error_spike' },
  slow_api: { field: 'avg_response_ms', threshold: 3000, severity: 'warning', type: 'slow_api' },
};

// Alert dedup window — suppress duplicate alerts within this period
const ALERT_DEDUP_HOURS = 6;

/**
 * Record a validated metrics snapshot with transaction safety and alert dedup.
 * @param {number} productId - Product ID from products table
 * @param {object} metrics - Validated metrics object (from Zod schema)
 */
async function recordMetrics(productId, metrics) {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    const m = metrics;

    // Insert metrics snapshot with optional collected_at
    await client.query(
      `INSERT INTO metrics_snapshots(
        product_id, total_users, active_users_24h, trial_users, pro_users,
        churned_users, free_override_users, mrr_cents, total_revenue_cents,
        errors_24h, avg_response_ms, signups_24h, pay_apps_created_24h,
        pdfs_generated_24h, emails_sent_24h, collected_at, metadata
      ) VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17)`,
      [
        productId,
        m.total_users, m.active_users_24h, m.trial_users, m.pro_users,
        m.churned_users, m.free_override_users, m.mrr_cents, m.total_revenue_cents,
        m.errors_24h, m.avg_response_ms, m.signups_24h, m.pay_apps_created_24h,
        m.pdfs_generated_24h, m.emails_sent_24h,
        m.collected_at || new Date().toISOString(),
        JSON.stringify(m.metadata || {}),
      ]
    );

    // Check alert thresholds and create deduplicated alerts
    for (const [_key, rule] of Object.entries(ALERT_THRESHOLDS)) {
      const value = m[rule.field] || 0;
      if (value > rule.threshold) {
        await createDedupedAlert(client, productId, rule, value);
      }
    }

    await client.query('COMMIT');
  } catch (err) {
    await client.query('ROLLBACK');
    console.error('[Metrics Service Error]', err.message);
    throw err;
  } finally {
    client.release();
  }
}

/**
 * Create an alert only if no unresolved alert of the same type exists
 * within the dedup window for this product.
 */
async function createDedupedAlert(client, productId, rule, currentValue) {
  // Check for existing unresolved alert within dedup window
  const existing = await client.query(
    `SELECT id FROM alerts
     WHERE product_id = $1
       AND type = $2
       AND resolved = FALSE
       AND created_at > NOW() - INTERVAL '${ALERT_DEDUP_HOURS} hours'
     LIMIT 1`,
    [productId, rule.type]
  );

  if (existing.rows.length > 0) {
    // Alert already exists within dedup window — skip
    return;
  }

  const title = rule.type === 'error_spike'
    ? `Error Spike: ${currentValue} errors in 24h`
    : `Slow API: Avg response ${currentValue}ms`;

  const message = rule.type === 'error_spike'
    ? `Error count exceeded threshold (${rule.threshold}). Current: ${currentValue}`
    : `API response time above ${rule.threshold}ms threshold. Current: ${currentValue}ms`;

  await client.query(
    `INSERT INTO alerts(product_id, type, severity, title, message)
     VALUES($1, $2, $3, $4, $5)`,
    [productId, rule.type, rule.severity, title, message]
  );
}

/**
 * Prune metrics snapshots older than retentionDays.
 * Called on a schedule (e.g., daily cron or on startup).
 * Returns number of rows deleted.
 */
async function pruneOldSnapshots(retentionDays = 90) {
  try {
    const result = await pool.query(
      `DELETE FROM metrics_snapshots
       WHERE recorded_at < NOW() - INTERVAL '1 day' * $1
       RETURNING id`,
      [retentionDays]
    );
    const count = result.rowCount;
    if (count > 0) {
      console.log(`[Metrics Retention] Pruned ${count} snapshots older than ${retentionDays} days`);
    }
    return count;
  } catch (err) {
    console.error('[Metrics Retention Error]', err.message);
    return 0;
  }
}

module.exports = { recordMetrics, pruneOldSnapshots, ALERT_THRESHOLDS };
