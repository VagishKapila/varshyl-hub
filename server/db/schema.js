const { pool } = require('./pool');

async function initDB() {
  try {
    await pool.query(`
    -- ═══ Hub Users (super admin accounts) ═══
    CREATE TABLE IF NOT EXISTS hub_users (
      id SERIAL PRIMARY KEY,
      name VARCHAR(200) NOT NULL,
      email VARCHAR(200) UNIQUE NOT NULL,
      password_hash VARCHAR(200) NOT NULL,
      is_admin BOOLEAN DEFAULT TRUE,
      last_login TIMESTAMPTZ,
      created_at TIMESTAMPTZ DEFAULT NOW()
    );

    -- ═══ Registered Products ═══
    CREATE TABLE IF NOT EXISTS products (
      id SERIAL PRIMARY KEY,
      slug VARCHAR(50) UNIQUE NOT NULL,
      name VARCHAR(200) NOT NULL,
      url TEXT,
      staging_url TEXT,
      stripe_account_id VARCHAR(200),
      db_connection_string TEXT,
      api_key VARCHAR(200) UNIQUE NOT NULL,
      subscription_price_id VARCHAR(200),
      subscription_amount INTEGER DEFAULT 0,
      is_active BOOLEAN DEFAULT TRUE,
      icon VARCHAR(10) DEFAULT '📦',
      color VARCHAR(20) DEFAULT '#6366f1',
      created_at TIMESTAMPTZ DEFAULT NOW(),
      updated_at TIMESTAMPTZ DEFAULT NOW()
    );

    -- ═══ Metrics Snapshots (hourly from each product) ═══
    CREATE TABLE IF NOT EXISTS metrics_snapshots (
      id SERIAL PRIMARY KEY,
      product_id INTEGER REFERENCES products(id) ON DELETE CASCADE,
      recorded_at TIMESTAMPTZ DEFAULT NOW(),
      total_users INTEGER DEFAULT 0,
      active_users_24h INTEGER DEFAULT 0,
      trial_users INTEGER DEFAULT 0,
      pro_users INTEGER DEFAULT 0,
      churned_users INTEGER DEFAULT 0,
      free_override_users INTEGER DEFAULT 0,
      mrr_cents INTEGER DEFAULT 0,
      total_revenue_cents BIGINT DEFAULT 0,
      errors_24h INTEGER DEFAULT 0,
      avg_response_ms INTEGER DEFAULT 0,
      signups_24h INTEGER DEFAULT 0,
      pay_apps_created_24h INTEGER DEFAULT 0,
      pdfs_generated_24h INTEGER DEFAULT 0,
      emails_sent_24h INTEGER DEFAULT 0,
      metadata JSONB DEFAULT '{}'
    );
    -- Add collected_at column if it doesn't exist (tracks when product collected vs when hub received)
    ALTER TABLE metrics_snapshots ADD COLUMN IF NOT EXISTS collected_at TIMESTAMPTZ;

    CREATE INDEX IF NOT EXISTS idx_snapshots_product ON metrics_snapshots(product_id);
    CREATE INDEX IF NOT EXISTS idx_snapshots_recorded ON metrics_snapshots(recorded_at);
    CREATE INDEX IF NOT EXISTS idx_snapshots_product_time ON metrics_snapshots(product_id, recorded_at DESC);

    -- ═══ Alerts ═══
    CREATE TABLE IF NOT EXISTS alerts (
      id SERIAL PRIMARY KEY,
      product_id INTEGER REFERENCES products(id) ON DELETE CASCADE,
      type VARCHAR(50) NOT NULL,
      severity VARCHAR(20) DEFAULT 'warning',
      title VARCHAR(300) NOT NULL,
      message TEXT,
      resolved BOOLEAN DEFAULT FALSE,
      resolved_at TIMESTAMPTZ,
      created_at TIMESTAMPTZ DEFAULT NOW()
    );
    CREATE INDEX IF NOT EXISTS idx_alerts_product ON alerts(product_id);
    CREATE INDEX IF NOT EXISTS idx_alerts_resolved ON alerts(resolved, created_at DESC);

    -- ═══ Activity Log (Hub-level audit trail) ═══
    CREATE TABLE IF NOT EXISTS activity_log (
      id SERIAL PRIMARY KEY,
      user_id INTEGER REFERENCES hub_users(id) ON DELETE SET NULL,
      product_slug VARCHAR(50),
      action VARCHAR(100) NOT NULL,
      details JSONB DEFAULT '{}',
      ip_address VARCHAR(100),
      created_at TIMESTAMPTZ DEFAULT NOW()
    );
    CREATE INDEX IF NOT EXISTS idx_activity_created ON activity_log(created_at DESC);

    -- ═══ Feature Flags (per product, toggled from Hub) ═══
    CREATE TABLE IF NOT EXISTS feature_flags (
      id SERIAL PRIMARY KEY,
      product_id INTEGER REFERENCES products(id) ON DELETE CASCADE,
      flag_key VARCHAR(100) NOT NULL,
      enabled BOOLEAN DEFAULT FALSE,
      description TEXT,
      updated_at TIMESTAMPTZ DEFAULT NOW(),
      UNIQUE(product_id, flag_key)
    );

    -- ═══ Analytics Events (webhook-received events from products) ═══
    CREATE TABLE IF NOT EXISTS analytics_events (
      id SERIAL PRIMARY KEY,
      product_id INTEGER REFERENCES products(id) ON DELETE CASCADE,
      event VARCHAR(100) NOT NULL,
      user_id VARCHAR(255),
      metadata JSONB DEFAULT '{}',
      timestamp TIMESTAMPTZ DEFAULT NOW(),
      created_at TIMESTAMPTZ DEFAULT NOW()
    );
    CREATE INDEX IF NOT EXISTS idx_analytics_product ON analytics_events(product_id);
    CREATE INDEX IF NOT EXISTS idx_analytics_event ON analytics_events(event);
    CREATE INDEX IF NOT EXISTS idx_analytics_timestamp ON analytics_events(timestamp DESC);

    -- ═══ Entitlements ═══
    CREATE TABLE IF NOT EXISTS entitlements (
      id SERIAL PRIMARY KEY,
      product_slug VARCHAR(50) NOT NULL,
      email VARCHAR(200) NOT NULL,
      override_type VARCHAR(50) NOT NULL,
      discount_pct INTEGER DEFAULT 0,
      trial_days INTEGER DEFAULT 0,
      note TEXT,
      granted_by INTEGER REFERENCES hub_users(id) ON DELETE SET NULL,
      expires_at TIMESTAMPTZ,
      is_active BOOLEAN DEFAULT TRUE,
      created_at TIMESTAMPTZ DEFAULT NOW()
    );
    CREATE INDEX IF NOT EXISTS idx_entitlements_email ON entitlements(product_slug, email);
    CREATE INDEX IF NOT EXISTS idx_entitlements_active ON entitlements(is_active, expires_at);

    -- ═══ Promo Codes ═══
    CREATE TABLE IF NOT EXISTS promo_codes (
      id SERIAL PRIMARY KEY,
      code VARCHAR(50) UNIQUE NOT NULL,
      product_slug VARCHAR(50),
      discount_pct INTEGER DEFAULT 0,
      trial_days INTEGER DEFAULT 0,
      max_uses INTEGER DEFAULT NULL,
      uses_count INTEGER DEFAULT 0,
      valid_from TIMESTAMPTZ DEFAULT NOW(),
      valid_until TIMESTAMPTZ,
      is_active BOOLEAN DEFAULT TRUE,
      created_by INTEGER REFERENCES hub_users(id) ON DELETE SET NULL,
      created_at TIMESTAMPTZ DEFAULT NOW()
    );
    CREATE INDEX IF NOT EXISTS idx_promo_codes_code ON promo_codes(code, is_active);

    -- ═══ Nightly Digests ═══
    CREATE TABLE IF NOT EXISTS nightly_digests (
      id SERIAL PRIMARY KEY,
      digest_date DATE UNIQUE NOT NULL,
      bullets JSONB NOT NULL DEFAULT '[]',
      raw_data JSONB DEFAULT '{}',
      email_sent BOOLEAN DEFAULT FALSE,
      email_sent_at TIMESTAMPTZ,
      created_at TIMESTAMPTZ DEFAULT NOW()
    );
    CREATE INDEX IF NOT EXISTS idx_digests_date ON nightly_digests(digest_date DESC);

    -- ═══ Webhook Registry ═══
    CREATE TABLE IF NOT EXISTS webhooks (
      id SERIAL PRIMARY KEY,
      product_slug VARCHAR(50),
      name VARCHAR(200) NOT NULL,
      endpoint_url TEXT NOT NULL,
      secret VARCHAR(200),
      events TEXT[] DEFAULT '{}',
      is_active BOOLEAN DEFAULT TRUE,
      last_triggered_at TIMESTAMPTZ,
      created_by INTEGER REFERENCES hub_users(id) ON DELETE SET NULL,
      created_at TIMESTAMPTZ DEFAULT NOW()
    );

    -- ═══ Webhook Deliveries ═══
    CREATE TABLE IF NOT EXISTS webhook_deliveries (
      id SERIAL PRIMARY KEY,
      webhook_id INTEGER REFERENCES webhooks(id) ON DELETE CASCADE,
      event_type VARCHAR(100) NOT NULL,
      payload JSONB DEFAULT '{}',
      response_status INTEGER,
      response_body TEXT,
      success BOOLEAN DEFAULT FALSE,
      duration_ms INTEGER,
      attempted_at TIMESTAMPTZ DEFAULT NOW()
    );
    CREATE INDEX IF NOT EXISTS idx_webhook_deliveries_webhook ON webhook_deliveries(webhook_id, attempted_at DESC);
    `);
    console.log('[DB] Database initialized');
  } catch (err) {
    console.error('[DB Init Error]', err.message);
    throw err;
  }
}

module.exports = { initDB };
