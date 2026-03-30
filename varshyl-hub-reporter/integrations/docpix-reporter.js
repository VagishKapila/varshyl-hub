/**
 * Varshyl Hub Reporter — Docflow Integration
 *
 * Drop this file into the Docflow backend (e.g. backend/src/hub-reporter.js)
 * and call initHubReporter(pool) from your app startup (backend/src/index.ts).
 *
 * Required env vars:
 *   VARSHYL_HUB_URL=https://hub.varshyl.com
 *   VARSHYL_HUB_API_KEY=vhub_xxxxx  (from Varshyl Hub product registration)
 */

'use strict';

const { startReporter } = require('@varshyl/hub-reporter');

/**
 * Initialize the hub reporter with Docflow-specific metrics collection.
 * @param {import('pg').Pool} pool — Your PostgreSQL connection pool (Drizzle's underlying pool)
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
      // ── User counts (from Docflow schema: users table) ─
      const userStats = await pool.query(`
        SELECT
          COUNT(*) as total,
          COUNT(*) FILTER (WHERE "createdAt" > NOW() - INTERVAL '24 hours') as signups_24h,
          COUNT(*) FILTER (WHERE "updatedAt" > NOW() - INTERVAL '24 hours') as active_24h,
          COUNT(*) FILTER (WHERE plan = 'free') as free_users,
          COUNT(*) FILTER (WHERE plan = 'pro') as pro,
          COUNT(*) FILTER (WHERE "emailVerified" = true) as verified
        FROM users
      `);
      const u = userStats.rows[0];

      // ── Documents tracked ───────────────────────────────────
      let docsStats = { pdfs_24h: 0, total_docs: 0 };
      try {
        const ds = await pool.query(`
          SELECT
            COUNT(*) as total,
            COUNT(*) FILTER (WHERE "createdAt" > NOW() - INTERVAL '24 hours') as recent
          FROM documents
        `);
        docsStats = { pdfs_24h: parseInt(ds.rows[0].recent) || 0, total_docs: parseInt(ds.rows[0].total) || 0 };
      } catch (e) { /* documents table may be empty */ }

      // ── Signature requests ──────────────────────────────────
      let sigStats = { sigs_24h: 0 };
      try {
        const ss = await pool.query(`
          SELECT COUNT(*) as recent
          FROM signature_requests
          WHERE "createdAt" > NOW() - INTERVAL '24 hours'
        `);
        sigStats.sigs_24h = parseInt(ss.rows[0].recent) || 0;
      } catch (e) { /* table may not have data yet */ }

      // ── Payments (from Stripe via payments table) ───────────
      let totalRevenue = 0;
      try {
        const ps = await pool.query(`
          SELECT COALESCE(SUM(amount), 0) as total
          FROM payments WHERE status = 'succeeded'
        `);
        totalRevenue = parseInt(ps.rows[0].total) || 0;
      } catch (e) { /* payments table may be empty */ }

      // ── Emails sent ─────────────────────────────────────────
      let emailsSent = 0;
      try {
        const es = await pool.query(`
          SELECT COUNT(*) as count
          FROM audit_log
          WHERE action LIKE '%email%' AND "createdAt" > NOW() - INTERVAL '24 hours'
        `);
        emailsSent = parseInt(es.rows[0].count) || 0;
      } catch (e) { /* audit_log may not track emails yet */ }

      const proUsers = parseInt(u.pro) || 0;
      // Docflow is free — MRR is from signing flow payments only
      const mrrCents = 0; // Update when subscription model launches

      return {
        total_users: parseInt(u.total) || 0,
        active_users_24h: parseInt(u.active_24h) || 0,
        trial_users: 0, // Docflow has no trial tier yet
        pro_users: proUsers,
        churned_users: 0,
        free_override_users: 0,
        mrr_cents: mrrCents,
        total_revenue_cents: totalRevenue,
        errors_24h: 0, // add error tracking table later
        avg_response_ms: 0,
        signups_24h: parseInt(u.signups_24h) || 0,
        pay_apps_created_24h: sigStats.sigs_24h,
        pdfs_generated_24h: docsStats.pdfs_24h,
        emails_sent_24h: emailsSent,
        metadata: {
          product: 'docflow',
          total_documents: docsStats.total_docs,
          verified_users: parseInt(u.verified) || 0,
          version: process.env.APP_VERSION || '1.0.0',
        },
      };
    },

    onSuccess: (metrics) => {
      console.log(`[HubReporter] Docflow → Hub: ${metrics.total_users} users, ${metrics.pdfs_generated_24h} PDFs today`);
    },
    onError: (err, phase) => {
      console.error(`[HubReporter] Error (${phase}):`, err.message);
    },
  });
}

module.exports = { initHubReporter };
