/**
 * @varshyl/hub-reporter — Metrics Reporter for Varshyl Business Hub
 *
 * Drop this module into any Varshyl SaaS product to auto-report
 * KPIs to the central hub every hour.
 *
 * Usage:
 *   const { startReporter } = require('@varshyl/hub-reporter');
 *   startReporter({
 *     hubUrl: process.env.VARSHYL_HUB_URL || 'https://hub.varshyl.com',
 *     apiKey: process.env.VARSHYL_HUB_API_KEY,
 *     collector: async () => ({
 *       total_users: await db.query('SELECT COUNT(*) FROM users').then(r => +r.rows[0].count),
 *       pro_users: await db.query("SELECT COUNT(*) FROM users WHERE plan = 'pro'").then(r => +r.rows[0].count),
 *       mrr_cents: proUsers * 4000, // example: $40/mo per pro user
 *       // ... other fields
 *     }),
 *     intervalMs: 60 * 60 * 1000, // 1 hour (default)
 *   });
 */

'use strict';

const DEFAULT_INTERVAL = 60 * 60 * 1000; // 1 hour
const REPORT_ENDPOINT = '/api/v1/report';

/**
 * All supported metric fields that the hub accepts.
 * Any field not provided defaults to 0 on the hub side.
 */
const METRIC_FIELDS = [
  'total_users',
  'active_users_24h',
  'trial_users',
  'pro_users',
  'churned_users',
  'free_override_users',
  'mrr_cents',
  'total_revenue_cents',
  'errors_24h',
  'avg_response_ms',
  'signups_24h',
  'pay_apps_created_24h',
  'pdfs_generated_24h',
  'emails_sent_24h',
  'metadata',       // JSONB — any product-specific extras
];

class VarshylHubReporter {
  constructor(options = {}) {
    if (!options.apiKey) {
      throw new Error('[VarshylHubReporter] apiKey is required. Set VARSHYL_HUB_API_KEY in your environment.');
    }
    if (!options.collector || typeof options.collector !== 'function') {
      throw new Error('[VarshylHubReporter] collector function is required. It should return a metrics object.');
    }

    this.hubUrl = (options.hubUrl || 'https://hub.varshyl.com').replace(/\/$/, '');
    this.apiKey = options.apiKey;
    this.collector = options.collector;
    this.intervalMs = options.intervalMs || DEFAULT_INTERVAL;
    this.onSuccess = options.onSuccess || null;
    this.onError = options.onError || null;
    this.retryCount = options.retryCount || 3;
    this.retryDelayMs = options.retryDelayMs || 5000;
    this._timer = null;
    this._running = false;
  }

  /**
   * Start the reporter. Sends an initial report immediately,
   * then continues on the configured interval.
   */
  start() {
    if (this._running) {
      console.warn('[VarshylHubReporter] Already running');
      return this;
    }
    this._running = true;
    console.log(`[VarshylHubReporter] Started — reporting every ${Math.round(this.intervalMs / 60000)} min to ${this.hubUrl}`);

    // Send first report immediately
    this._report();

    // Schedule recurring reports
    this._timer = setInterval(() => this._report(), this.intervalMs);

    // Don't block process exit
    if (this._timer.unref) this._timer.unref();

    return this;
  }

  /**
   * Stop the reporter gracefully.
   */
  stop() {
    if (this._timer) {
      clearInterval(this._timer);
      this._timer = null;
    }
    this._running = false;
    console.log('[VarshylHubReporter] Stopped');
    return this;
  }

  /**
   * Send a single report right now (useful for manual triggers).
   */
  async reportNow() {
    return this._report();
  }

  /**
   * Internal: collect metrics and POST to hub.
   */
  async _report() {
    let metrics;
    try {
      metrics = await this.collector();
      if (!metrics || typeof metrics !== 'object') {
        throw new Error('Collector returned invalid data (expected object)');
      }
    } catch (err) {
      console.error('[VarshylHubReporter] Collector error:', err.message);
      if (this.onError) this.onError(err, 'collector');
      return;
    }

    // Sanitize — only send known numeric fields + metadata
    const payload = {};
    for (const field of METRIC_FIELDS) {
      if (field === 'metadata') {
        payload.metadata = metrics.metadata || {};
      } else if (metrics[field] !== undefined) {
        payload[field] = Math.max(0, parseInt(metrics[field]) || 0);
      }
    }

    // POST with retries
    for (let attempt = 1; attempt <= this.retryCount; attempt++) {
      try {
        const res = await fetch(`${this.hubUrl}${REPORT_ENDPOINT}`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'X-Api-Key': this.apiKey,
          },
          body: JSON.stringify(payload),
          signal: AbortSignal.timeout(15000), // 15s timeout
        });

        if (!res.ok) {
          const body = await res.text().catch(() => '');
          throw new Error(`HTTP ${res.status}: ${body}`);
        }

        const data = await res.json();
        console.log(`[VarshylHubReporter] ✓ Reported to ${data.product || 'hub'} — ${payload.total_users || 0} users, $${((payload.mrr_cents || 0) / 100).toFixed(0)} MRR`);

        if (this.onSuccess) this.onSuccess(payload, data);
        return data;

      } catch (err) {
        console.error(`[VarshylHubReporter] Attempt ${attempt}/${this.retryCount} failed:`, err.message);
        if (attempt < this.retryCount) {
          await new Promise(r => setTimeout(r, this.retryDelayMs));
        } else {
          console.error('[VarshylHubReporter] All retries exhausted. Will try again next interval.');
          if (this.onError) this.onError(err, 'send');
        }
      }
    }
  }
}

/**
 * Convenience: create and start a reporter in one call.
 */
function startReporter(options) {
  const reporter = new VarshylHubReporter(options);
  reporter.start();
  return reporter;
}

module.exports = { VarshylHubReporter, startReporter, METRIC_FIELDS };
