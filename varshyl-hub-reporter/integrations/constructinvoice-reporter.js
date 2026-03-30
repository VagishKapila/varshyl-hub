/**
 * Varshyl Hub Reporter — ConstructInvoice AI Integration
 *
 * Drop this file into the ConstructInvoice AI backend (e.g. backend/src/hub-reporter.js)
 * and call initHubReporter(pool) from your app startup.
 *
 * Required env vars:
 *   VARSHYL_HUB_URL=https://hub.varshyl.com
 *   VARSHYL_HUB_API_KEY=vhub_xxxxx  (from Varshyl Hub product registration)
 */

'use strict';

const { startReporter } = require('@varshyl/hub-reporter');

/**
 * Initialize the hub reporter with ConstructInvoice-specific metrics collection.
 * @param {import('pg').Pool} pool — Your PostgreSQL connection pool
 */
function initHubReporter(pool) {
  const apiKey = process.env.VARSHYL_HUB_API_KEY;
  if (!apiKey) {
    console.warn('[HubReporter] VARSHYL_HUB_API_KEY not set — metrics reporting disabled');
    return null;
  }

  return startReporter({
    hubUrl: process.env.VARSHYL_HUB_URL || 'https://hub.varshyl.com',
    apiKey,
    intervalMs: 60 * 60 * 1000, // every hour

    collector: async () => {
      // ── User counts ──────────────────────────────────────────
      const userStats = await pool.query(`
        SELECT
          COUNT(*) as total,
          COUNT(*) FILTER (WHERE created_at > NOW() - INTERVAL '24 hours') as signups_24h,
          COUNT(*) FILTER (WHERE last_login > NOW() - INTERVAL '24 hours') as active_24h,
          COUNT(*) FILTER (WHERE plan_type = 'trial') as trial,
          COUNT(*) FILTER (WHERE plan_type = 'pro' AND subscription_status = 'active') as pro,
          COUNT(*) FILTER (WHERE subscription_status = 'canceled') as churned,
          COUNT(*) FILTER (WHERE plan_type = 'pro' AND subscription_status = 'free_override') as free_override
        FROM users
      `);
      const u = userStats.rows[0];

      // ── Revenue (from Stripe payments or local ledger) ──────
      const revenueStats = await pool.query(`
        SELECT
          COALESCE(SUM(amount), 0) as total_revenue_cents
        FROM payments
        WHERE status = 'succeeded'
      `);

      // ── Product-specific: invoices & PDFs generated ─────────
      const productStats = await pool.query(`
        SELECT
          COUNT(*) FILTER (WHERE created_at > NOW() - INTERVAL '24 hours') as pay_apps_24h,
          COUNT(*) FILTER (WHERE pdf_generated = true AND created_at > NOW() - INTERVAL '24 hours') as pdfs_24h
        FROM invoices
      `);
      const ps = productStats.rows[0];

      // ── Error tracking (if you have an error_log table) ─────
      let errors24h = 0;
      let avgResponseMs = 0;
      try {
        const errorStats = await pool.query(`
          SELECT COUNT(*) as count
          FROM error_log
          WHERE created_at > NOW() - INTERVAL '24 hours'
        `);
        errors24h = parseInt(errorStats.rows[0].count) || 0;
      } catch (e) {
        // error_log table may not exist yet — that's fine
      }

      try {
        const perfStats = await pool.query(`
          SELECT AVG(response_ms) as avg_ms
          FROM request_log
          WHERE created_at > NOW() - INTERVAL '24 hours'
        `);
        avgResponseMs = parseInt(perfStats.rows[0].avg_ms) || 0;
      } catch (e) {
        // request_log table may not exist yet
      }

      const proUsers = parseInt(u.pro) || 0;
      const subscriptionPrice = parseInt(process.env.SUBSCRIPTION_PRICE_CENTS || '4000'); // $40/mo default

      return {
        total_users: parseInt(u.total) || 0,
        active_users_24h: parseInt(u.active_24h) || 0,
        trial_users: parseInt(u.trial) || 0,
        pro_users: proUsers,
        churned_users: parseInt(u.churned) || 0,
        free_override_users: parseInt(u.free_override) || 0,
        mrr_cents: proUsers * subscriptionPrice,
        total_revenue_cents: parseInt(revenueStats.rows[0].total_revenue_cents) || 0,
        errors_24h: errors24h,
        avg_response_ms: avgResponseMs,
        signups_24h: parseInt(u.signups_24h) || 0,
        pay_apps_created_24h: parseInt(ps.pay_apps_24h) || 0,
        pdfs_generated_24h: parseInt(ps.pdfs_24h) || 0,
        emails_sent_24h: 0, // add when email tracking exists
        metadata: {
          product: 'constructinvoice-ai',
          version: process.env.APP_VERSION || '1.0.0',
        },
      };
    },

    onSuccess: (metrics) => {
      console.log(`[HubReporter] ConstructInvoice AI → Hub: ${metrics.total_users} users, ${metrics.pro_users} pro, $${(metrics.mrr_cents / 100).toFixed(0)} MRR`);
    },
    onError: (err, phase) => {
      console.error(`[HubReporter] Error (${phase}):`, err.message);
    },
  });
}

module.exports = { initHubReporter };
