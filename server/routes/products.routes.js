const express = require('express');
const router = express.Router();
const crypto = require('crypto');
const { Pool } = require('pg');
const { pool } = require('../db/pool');
const { authMiddleware } = require('../middleware/auth');
const { logActivity } = require('../services/activity.service');

// Helper: get a read-only pool for a product's DB
const productPools = {};
function getProductPool(connString) {
  if (!connString) return null;
  if (!productPools[connString]) {
    productPools[connString] = new Pool({
      connectionString: connString,
      ssl: { rejectUnauthorized: false },
      max: 3 // small pool — read-only queries
    });
  }
  return productPools[connString];
}

// GET /api/products
router.get('/', authMiddleware, async (req, res) => {
  try {
    const products = (await pool.query(
      `SELECT id, slug, name, url, staging_url, stripe_account_id, subscription_amount,
       is_active, icon, color, api_key, broadcast_url, created_at, updated_at,
       CASE WHEN db_connection_string IS NOT NULL AND db_connection_string != '' THEN true ELSE false END as has_db_connection
       FROM products ORDER BY name`
    )).rows;
    res.json({ data: products });
  } catch (err) {
    console.error('[GET /api/products]', err.message);
    res.status(500).json({ error: 'Failed to load products' });
  }
});

// POST /api/products
router.post('/', authMiddleware, async (req, res) => {
  try {
    const { slug, name, url, staging_url, stripe_account_id, db_connection_string, subscription_amount, icon, color, broadcast_url } = req.body;
    if (!slug || !name) return res.status(400).json({ error: 'Slug and name required' });

    const apiKey = 'vhub_' + crypto.randomBytes(24).toString('hex');

    const result = await pool.query(
      `INSERT INTO products(slug, name, url, staging_url, stripe_account_id, db_connection_string, api_key, subscription_amount, icon, color, broadcast_url)
       VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11) RETURNING *`,
      [slug.toLowerCase().trim(), name.trim(), url || null, staging_url || null,
       stripe_account_id || null, db_connection_string || null, apiKey, subscription_amount || 0, icon || '📦', color || '#6366f1', broadcast_url || null]
    );

    await logActivity(req.user.id, slug, 'product_registered', { name }, req.ip);
    res.json({ data: result.rows[0], message: 'Product registered' });
  } catch (err) {
    if (err.code === '23505') return res.status(409).json({ error: 'Product slug already exists' });
    console.error('[POST /api/products]', err.message);
    res.status(500).json({ error: 'Failed to register product' });
  }
});

// PUT /api/products/:slug
router.put('/:slug', authMiddleware, async (req, res) => {
  try {
    const product = (await pool.query('SELECT * FROM products WHERE slug = $1', [req.params.slug])).rows[0];
    if (!product) return res.status(404).json({ error: 'Product not found' });

    const { name, slug: newSlug, url, staging_url, stripe_account_id, db_connection_string, subscription_amount, icon, color, is_active, broadcast_url } = req.body;

    const result = await pool.query(
      `UPDATE products SET
        name = COALESCE($1, name),
        url = COALESCE($2, url),
        staging_url = COALESCE($3, staging_url),
        stripe_account_id = COALESCE($4, stripe_account_id),
        db_connection_string = COALESCE($5, db_connection_string),
        subscription_amount = COALESCE($6, subscription_amount),
        icon = COALESCE($7, icon),
        color = COALESCE($8, color),
        is_active = COALESCE($9, is_active),
        broadcast_url = COALESCE($12, broadcast_url),
        slug = COALESCE($11, slug),
        updated_at = NOW()
      WHERE id = $10
      RETURNING id, slug, name, url, staging_url, stripe_account_id, subscription_amount, is_active, icon, color, broadcast_url, created_at, updated_at`,
      [name || null, url !== undefined ? url : null, staging_url !== undefined ? staging_url : null,
       stripe_account_id !== undefined ? stripe_account_id : null,
       db_connection_string !== undefined ? db_connection_string : null,
       subscription_amount !== undefined ? subscription_amount : null,
       icon || null, color || null,
       is_active !== undefined ? is_active : null,
       product.id,
       newSlug || null,
       broadcast_url !== undefined ? broadcast_url : null]
    );

    await logActivity(req.user.id, req.params.slug, 'product_updated', { fields: Object.keys(req.body) }, req.ip);
    res.json({ data: result.rows[0], message: 'Product updated' });
  } catch (err) {
    console.error('[PUT /api/products/:slug]', err.message);
    res.status(500).json({ error: 'Failed to update product' });
  }
});

// POST /api/products/:slug/toggle
router.post('/:slug/toggle', authMiddleware, async (req, res) => {
  try {
    const product = (await pool.query('SELECT * FROM products WHERE slug = $1', [req.params.slug])).rows[0];
    if (!product) return res.status(404).json({ error: 'Product not found' });

    const newState = !product.is_active;
    await pool.query('UPDATE products SET is_active = $1, updated_at = NOW() WHERE id = $2', [newState, product.id]);

    await logActivity(req.user.id, req.params.slug, newState ? 'product_activated' : 'product_deactivated', {}, req.ip);
    res.json({ message: `${product.name} ${newState ? 'activated' : 'deactivated'}` });
  } catch (err) {
    console.error('[POST /api/products/:slug/toggle]', err.message);
    res.status(500).json({ error: 'Failed to toggle product' });
  }
});

// POST /api/products/:slug/test-db
router.post('/:slug/test-db', authMiddleware, async (req, res) => {
  try {
    const product = (await pool.query('SELECT * FROM products WHERE slug = $1', [req.params.slug])).rows[0];
    if (!product) return res.status(404).json({ error: 'Product not found' });
    if (!product.db_connection_string) {
      return res.status(400).json({ error: 'No database connection string configured' });
    }

    const testPool = getProductPool(product.db_connection_string);
    const start = Date.now();
    await testPool.query('SELECT 1');
    const latency = Date.now() - start;

    res.json({ data: { connected: true, latency_ms: latency }, message: `Connected in ${latency}ms` });
  } catch (err) {
    console.error('[POST /api/products/:slug/test-db]', err.message);
    res.json({ data: { connected: false, error: err.message }, message: 'Connection failed' });
  }
});

// POST /api/products/:slug/regenerate-key
router.post('/:slug/regenerate-key', authMiddleware, async (req, res) => {
  try {
    const product = (await pool.query('SELECT * FROM products WHERE slug = $1', [req.params.slug])).rows[0];
    if (!product) return res.status(404).json({ error: 'Product not found' });

    const newKey = 'vhub_' + crypto.randomBytes(24).toString('hex');
    await pool.query('UPDATE products SET api_key = $1, updated_at = NOW() WHERE id = $2', [newKey, product.id]);

    await logActivity(req.user.id, req.params.slug, 'api_key_regenerated', {}, req.ip);
    res.json({ data: { api_key: newKey }, message: 'API key regenerated. Update your product reporter.' });
  } catch (err) {
    console.error('[POST /api/products/:slug/regenerate-key]', err.message);
    res.status(500).json({ error: 'Failed to regenerate API key' });
  }
});

// GET /api/products/:slug/metrics
router.get('/:slug/metrics', authMiddleware, async (req, res) => {
  try {
    const product = (await pool.query('SELECT * FROM products WHERE slug = $1', [req.params.slug])).rows[0];
    if (!product) return res.status(404).json({ error: 'Product not found' });

    // Latest snapshot
    const latest = (await pool.query(
      'SELECT * FROM metrics_snapshots WHERE product_id = $1 ORDER BY recorded_at DESC LIMIT 1',
      [product.id]
    )).rows[0];

    // Last 30 days of snapshots (one per day — latest each day)
    const trend = (await pool.query(
      `SELECT DISTINCT ON (DATE(recorded_at))
        DATE(recorded_at) as date, total_users, active_users_24h, trial_users,
        pro_users, mrr_cents, errors_24h, avg_response_ms, signups_24h
       FROM metrics_snapshots WHERE product_id = $1 AND recorded_at > NOW() - INTERVAL '30 days'
       ORDER BY DATE(recorded_at), recorded_at DESC`,
      [product.id]
    )).rows;

    // Alerts for this product
    const alerts = (await pool.query(
      'SELECT * FROM alerts WHERE product_id = $1 ORDER BY created_at DESC LIMIT 20',
      [product.id]
    )).rows;

    // Feature flags
    const flags = (await pool.query(
      'SELECT * FROM feature_flags WHERE product_id = $1 ORDER BY flag_key',
      [product.id]
    )).rows;

    res.json({ data: { product, latest: latest || null, trend, alerts, flags } });
  } catch (err) {
    console.error('[GET /api/products/:slug/metrics]', err.message);
    res.status(500).json({ error: 'Failed to load product metrics' });
  }
});

// GET /api/products/:slug/users
router.get('/:slug/users', authMiddleware, async (req, res) => {
  try {
    const product = (await pool.query('SELECT * FROM products WHERE slug = $1', [req.params.slug])).rows[0];
    if (!product) return res.status(404).json({ error: 'Product not found' });

    if (!product.db_connection_string) {
      const latest = (await pool.query(
        'SELECT * FROM metrics_snapshots WHERE product_id = $1 ORDER BY recorded_at DESC LIMIT 1',
        [product.id]
      )).rows[0];

      return res.json({
        data: [],
        count: latest?.total_users || 0,
        page: 1,
        limit: 50,
        no_db_connection: true,
        message:
          'No database connection configured. Add DATABASE_URL in Manage Products to see individual users. Total count from reporter: ' +
          (latest?.total_users || 0),
      });
    }

    const productPool = getProductPool(product.db_connection_string);
    if (!productPool) return res.status(400).json({ error: 'Cannot connect to product database' });

    const page = Math.max(1, parseInt(req.query.page) || 1);
    const limit = Math.min(100, Math.max(1, parseInt(req.query.limit) || 50));
    const offset = (page - 1) * limit;
    const search = req.query.search?.trim() || '';

    let query = `SELECT id, name, email, email_verified, blocked, subscription_status,
                  plan_type, trial_start_date, trial_end_date, stripe_customer_id,
                  created_at, updated_at FROM users`;
    let countQuery = 'SELECT COUNT(*) FROM users';
    const params = [];

    if (search) {
      query += ' WHERE (name ILIKE $1 OR email ILIKE $1)';
      countQuery += ' WHERE (name ILIKE $1 OR email ILIKE $1)';
      params.push(`%${search}%`);
    }

    query += ` ORDER BY created_at DESC LIMIT $${params.length + 1} OFFSET $${params.length + 2}`;
    params.push(limit, offset);

    const [users, total] = await Promise.all([
      productPool.query(query, params),
      productPool.query(countQuery, search ? [`%${search}%`] : [])
    ]);

    res.json({
      data: users.rows,
      count: parseInt(total.rows[0].count),
      page, limit
    });
  } catch (err) {
    console.error('[GET /api/products/:slug/users]', err.message);
    res.status(500).json({ error: 'Failed to load users from product database' });
  }
});

// POST /api/products/:slug/users/:id/action
router.post('/:slug/users/:id/action', authMiddleware, async (req, res) => {
  try {
    const product = (await pool.query('SELECT * FROM products WHERE slug = $1', [req.params.slug])).rows[0];
    if (!product) return res.status(404).json({ error: 'Product not found' });
    if (!product.db_connection_string) {
      return res.status(400).json({ error: 'No database connection configured' });
    }

    const productPool = getProductPool(product.db_connection_string);
    if (!productPool) return res.status(400).json({ error: 'Cannot connect to product database' });

    const userId = parseInt(req.params.id);
    const { action } = req.body;
    if (!action) return res.status(400).json({ error: 'Action required' });

    let result;
    switch (action) {
      case 'block':
        result = await productPool.query('UPDATE users SET blocked = true WHERE id = $1 RETURNING id, name, email', [userId]);
        break;
      case 'unblock':
        result = await productPool.query('UPDATE users SET blocked = false WHERE id = $1 RETURNING id, name, email', [userId]);
        break;
      case 'extend_trial': {
        const days = parseInt(req.body.days) || 30;
        result = await productPool.query(
          'UPDATE users SET trial_end_date = COALESCE(trial_end_date, NOW()) + $1 * INTERVAL \'1 day\' WHERE id = $2 RETURNING id, name, email, trial_end_date',
          [days, userId]
        );
        break;
      }
      case 'set_free_override':
        result = await productPool.query(
          "UPDATE users SET subscription_status = 'free_override', plan_type = 'free_override' WHERE id = $1 RETURNING id, name, email",
          [userId]
        );
        break;
      case 'upgrade_to_pro':
        result = await productPool.query(
          "UPDATE users SET subscription_status = 'active', plan_type = 'pro' WHERE id = $1 RETURNING id, name, email",
          [userId]
        );
        break;
      case 'reset_to_trial':
        result = await productPool.query(
          "UPDATE users SET subscription_status = 'trial', plan_type = 'free_trial', trial_end_date = NOW() + INTERVAL '90 days' WHERE id = $1 RETURNING id, name, email",
          [userId]
        );
        break;
      case 'verify_email':
        result = await productPool.query(
          'UPDATE users SET email_verified = true WHERE id = $1 RETURNING id, name, email',
          [userId]
        );
        break;
      default:
        return res.status(400).json({ error: `Unknown action: ${action}` });
    }

    if (!result.rows.length) return res.status(404).json({ error: 'User not found' });

    await logActivity(req.user.id, req.params.slug, `user_${action}`, { target_user_id: userId, ...req.body }, req.ip);
    res.json({ data: result.rows[0], message: `Action '${action}' completed` });
  } catch (err) {
    console.error('[POST /api/products/:slug/users/:id/action]', err.message);
    res.status(500).json({ error: 'Failed to perform action' });
  }
});

// POST /api/products/:slug/price
router.post('/:slug/price', authMiddleware, async (req, res) => {
  try {
    const product = (await pool.query('SELECT * FROM products WHERE slug = $1', [req.params.slug])).rows[0];
    if (!product) return res.status(404).json({ error: 'Product not found' });

    const { amount_cents } = req.body;
    if (!amount_cents || amount_cents < 100) {
      return res.status(400).json({ error: 'Amount must be at least $1.00 (100 cents)' });
    }

    await pool.query(
      'UPDATE products SET subscription_amount = $1, updated_at = NOW() WHERE id = $2',
      [amount_cents, product.id]
    );

    await logActivity(req.user.id, req.params.slug, 'price_updated', {
      old_amount: product.subscription_amount,
      new_amount: amount_cents
    }, req.ip);

    res.json({ message: `Price updated to $${(amount_cents / 100).toFixed(2)}/month` });
  } catch (err) {
    console.error('[POST /api/products/:slug/price]', err.message);
    res.status(500).json({ error: 'Failed to update price' });
  }
});

// POST /api/products/:slug/flags
router.post('/:slug/flags', authMiddleware, async (req, res) => {
  try {
    const product = (await pool.query('SELECT * FROM products WHERE slug = $1', [req.params.slug])).rows[0];
    if (!product) return res.status(404).json({ error: 'Product not found' });

    const { flag_key, enabled, description } = req.body;
    if (!flag_key) return res.status(400).json({ error: 'flag_key required' });

    await pool.query(
      `INSERT INTO feature_flags(product_id, flag_key, enabled, description)
       VALUES($1, $2, $3, $4)
       ON CONFLICT(product_id, flag_key)
       DO UPDATE SET enabled = EXCLUDED.enabled, description = COALESCE(EXCLUDED.description, feature_flags.description), updated_at = NOW()`,
      [product.id, flag_key, enabled !== false, description || null]
    );

    await logActivity(req.user.id, req.params.slug, 'flag_toggled', { flag_key, enabled }, req.ip);
    res.json({ message: `Flag '${flag_key}' ${enabled !== false ? 'enabled' : 'disabled'}` });
  } catch (err) {
    console.error('[POST /api/products/:slug/flags]', err.message);
    res.status(500).json({ error: 'Failed to update feature flag' });
  }
});

module.exports = router;
