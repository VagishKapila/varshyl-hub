require('dotenv').config();
const express = require('express');
const cors = require('cors');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const path = require('path');
const crypto = require('crypto');
const { pool, initDB } = require('./db');

// ── Stripe SDK (lazy init — only active when STRIPE_ORG_KEY is set) ──────
let stripe = null;
if (process.env.STRIPE_ORG_KEY) {
  const Stripe = require('stripe');
  stripe = new Stripe(process.env.STRIPE_ORG_KEY);
  console.log('[Stripe] Organization API connected');
} else {
  console.log('[Stripe] No STRIPE_ORG_KEY — revenue features use reported metrics only');
}

// ── Security middleware ──────────────────────────────────────────────────
let helmet, rateLimit;
try { helmet = require('helmet'); } catch(e) { console.warn('helmet not installed'); }
try { rateLimit = require('express-rate-limit'); } catch(e) { console.warn('express-rate-limit not installed'); }

const app = express();
app.set('trust proxy', 1);
const PORT = process.env.PORT || 3000;
const JWT_SECRET = process.env.JWT_SECRET || 'change-this-secret';
const ADMIN_EMAILS = (process.env.ADMIN_EMAILS || 'vaakapila@gmail.com').split(',').map(e => e.trim().toLowerCase());

if (!process.env.JWT_SECRET && process.env.NODE_ENV === 'production') {
  console.error('FATAL: JWT_SECRET must be set in production. Exiting.');
  process.exit(1);
}

if (helmet) app.use(helmet({ contentSecurityPolicy: false }));
app.use(cors({ origin: process.env.ALLOWED_ORIGIN || '*' }));
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public'), {
  setHeaders: (res, filePath) => {
    if (filePath.endsWith('.html')) {
      res.setHeader('Cache-Control', 'no-cache, must-revalidate');
    }
  }
}));

// ── Rate limiting ────────────────────────────────────────────────────────
const authLimiter = rateLimit ? rateLimit({
  windowMs: 60 * 1000, max: 10,
  standardHeaders: true, legacyHeaders: false,
  message: { error: 'Too many attempts. Wait a minute.' }
}) : (req, res, next) => next();

// ── Auth middleware ──────────────────────────────────────────────────────
function auth(req, res, next) {
  const token = req.headers.authorization?.replace('Bearer ', '');
  if (!token) return res.status(401).json({ error: 'Authentication required' });
  try {
    const decoded = jwt.verify(token, JWT_SECRET);
    if (!ADMIN_EMAILS.includes(decoded.email?.toLowerCase())) {
      return res.status(403).json({ error: 'Admin access required' });
    }
    req.user = decoded;
    next();
  } catch(e) {
    res.status(401).json({ error: 'Invalid or expired token' });
  }
}

// ── API Key auth (for product reporters) ─────────────────────────────────
async function apiKeyAuth(req, res, next) {
  const key = req.headers['x-api-key'];
  if (!key) return res.status(401).json({ error: 'API key required' });
  try {
    const result = await pool.query('SELECT * FROM products WHERE api_key = $1 AND is_active = true', [key]);
    if (result.rows.length === 0) return res.status(401).json({ error: 'Invalid API key' });
    req.product = result.rows[0];
    next();
  } catch(e) {
    console.error('[apiKeyAuth]', e.message);
    res.status(500).json({ error: 'Auth failed' });
  }
}

// ── Activity logger ──────────────────────────────────────────────────────
async function logActivity(userId, productSlug, action, details = {}, ip = null) {
  try {
    await pool.query(
      'INSERT INTO activity_log(user_id, product_slug, action, details, ip_address) VALUES($1,$2,$3,$4,$5)',
      [userId, productSlug, action, JSON.stringify(details), ip]
    );
  } catch(e) { console.error('[logActivity]', e.message); }
}

// ═══════════════════════════════════════════════════════════════════════════
// AUTH ROUTES
// ═══════════════════════════════════════════════════════════════════════════

// POST /api/auth/login — Admin login
app.post('/api/auth/login', authLimiter, async (req, res) => {
  try {
    const { email, password } = req.body;
    if (!email || !password) return res.status(400).json({ error: 'Email and password required' });

    const normalEmail = email.trim().toLowerCase();
    if (!ADMIN_EMAILS.includes(normalEmail)) {
      return res.status(403).json({ error: 'Access restricted to admin accounts' });
    }

    const result = await pool.query('SELECT * FROM hub_users WHERE email = $1', [normalEmail]);
    if (result.rows.length === 0) return res.status(401).json({ error: 'Invalid credentials' });

    const user = result.rows[0];
    const valid = await bcrypt.compare(password, user.password_hash);
    if (!valid) return res.status(401).json({ error: 'Invalid credentials' });

    await pool.query('UPDATE hub_users SET last_login = NOW() WHERE id = $1', [user.id]);

    const token = jwt.sign({ id: user.id, email: user.email, name: user.name }, JWT_SECRET, { expiresIn: '7d' });
    res.json({ data: { token, user: { id: user.id, name: user.name, email: user.email } } });
  } catch(e) {
    console.error('[POST /api/auth/login]', e.message);
    res.status(500).json({ error: 'Login failed' });
  }
});

// POST /api/auth/setup — First-time admin account creation (only works if no users exist)
app.post('/api/auth/setup', async (req, res) => {
  try {
    const existing = await pool.query('SELECT COUNT(*) FROM hub_users');
    if (parseInt(existing.rows[0].count) > 0) {
      return res.status(403).json({ error: 'Setup already complete. Use /api/auth/login.' });
    }

    const { name, email, password } = req.body;
    if (!name || !email || !password) return res.status(400).json({ error: 'Name, email, and password required' });
    if (password.length < 8) return res.status(400).json({ error: 'Password must be at least 8 characters' });

    const normalEmail = email.trim().toLowerCase();
    if (!ADMIN_EMAILS.includes(normalEmail)) {
      return res.status(403).json({ error: 'This email is not in the ADMIN_EMAILS list' });
    }

    const hash = await bcrypt.hash(password, 12);
    const result = await pool.query(
      'INSERT INTO hub_users(name, email, password_hash) VALUES($1, $2, $3) RETURNING id, name, email',
      [name.trim(), normalEmail, hash]
    );

    const user = result.rows[0];
    const token = jwt.sign({ id: user.id, email: user.email, name: user.name }, JWT_SECRET, { expiresIn: '7d' });
    res.json({ data: { token, user }, message: 'Admin account created' });
  } catch(e) {
    console.error('[POST /api/auth/setup]', e.message);
    res.status(500).json({ error: 'Setup failed' });
  }
});

// GET /api/auth/me — Current user info
app.get('/api/auth/me', auth, async (req, res) => {
  res.json({ data: { id: req.user.id, name: req.user.name, email: req.user.email } });
});

// ═══════════════════════════════════════════════════════════════════════════
// ADMIN MANAGEMENT (create/list/delete hub admins from any product)
// ═══════════════════════════════════════════════════════════════════════════

// GET /api/admins — List all hub admin accounts
app.get('/api/admins', auth, async (req, res) => {
  try {
    const result = await pool.query(
      'SELECT id, name, email, is_admin, last_login, created_at FROM hub_users ORDER BY created_at'
    );
    res.json({ data: result.rows });
  } catch(e) {
    console.error('[GET /api/admins]', e.message);
    res.status(500).json({ error: 'Failed to load admins' });
  }
});

// POST /api/admins — Create a new admin account (invited by existing admin)
app.post('/api/admins', auth, async (req, res) => {
  try {
    const { name, email, password } = req.body;
    if (!name || !email || !password) return res.status(400).json({ error: 'Name, email, and password required' });
    if (password.length < 8) return res.status(400).json({ error: 'Password must be at least 8 characters' });

    const normalEmail = email.trim().toLowerCase();

    // Check if email already exists
    const existing = await pool.query('SELECT id FROM hub_users WHERE email = $1', [normalEmail]);
    if (existing.rows.length > 0) return res.status(409).json({ error: 'An admin with this email already exists' });

    const hash = await bcrypt.hash(password, 12);
    const result = await pool.query(
      'INSERT INTO hub_users(name, email, password_hash) VALUES($1, $2, $3) RETURNING id, name, email, is_admin, created_at',
      [name.trim(), normalEmail, hash]
    );

    // Dynamically add new email to ADMIN_EMAILS so they can log in immediately
    if (!ADMIN_EMAILS.includes(normalEmail)) {
      ADMIN_EMAILS.push(normalEmail);
    }

    await logActivity(req.user.id, null, 'admin_created', { new_admin_email: normalEmail, new_admin_name: name.trim() }, req.ip);
    res.json({ data: result.rows[0], message: 'Admin created successfully' });
  } catch(e) {
    if (e.code === '23505') return res.status(409).json({ error: 'Email already exists' });
    console.error('[POST /api/admins]', e.message);
    res.status(500).json({ error: 'Failed to create admin' });
  }
});

// DELETE /api/admins/:id — Remove an admin account
app.delete('/api/admins/:id', auth, async (req, res) => {
  try {
    const adminId = parseInt(req.params.id);
    if (adminId === req.user.id) return res.status(400).json({ error: 'You cannot delete your own account' });

    // Get admin info before deletion (for activity log)
    const admin = (await pool.query('SELECT id, name, email FROM hub_users WHERE id = $1', [adminId])).rows[0];
    if (!admin) return res.status(404).json({ error: 'Admin not found' });

    // Prevent deleting the last admin
    const count = await pool.query('SELECT COUNT(*) FROM hub_users');
    if (parseInt(count.rows[0].count) <= 1) return res.status(400).json({ error: 'Cannot delete the last admin account' });

    await pool.query('DELETE FROM hub_users WHERE id = $1', [adminId]);

    // Remove from runtime ADMIN_EMAILS
    const idx = ADMIN_EMAILS.indexOf(admin.email.toLowerCase());
    if (idx > -1) ADMIN_EMAILS.splice(idx, 1);

    await logActivity(req.user.id, null, 'admin_deleted', { deleted_admin_id: adminId, deleted_admin_email: admin.email }, req.ip);
    res.json({ message: `Admin ${admin.name} removed` });
  } catch(e) {
    console.error('[DELETE /api/admins/:id]', e.message);
    res.status(500).json({ error: 'Failed to delete admin' });
  }
});

// POST /api/admins/:id/reset-password — Reset another admin's password
app.post('/api/admins/:id/reset-password', auth, async (req, res) => {
  try {
    const adminId = parseInt(req.params.id);
    const { password } = req.body;
    if (!password || password.length < 8) return res.status(400).json({ error: 'New password must be at least 8 characters' });

    const admin = (await pool.query('SELECT id, name, email FROM hub_users WHERE id = $1', [adminId])).rows[0];
    if (!admin) return res.status(404).json({ error: 'Admin not found' });

    const hash = await bcrypt.hash(password, 12);
    await pool.query('UPDATE hub_users SET password_hash = $1 WHERE id = $2', [hash, adminId]);

    await logActivity(req.user.id, null, 'admin_password_reset', { target_admin_id: adminId, target_admin_email: admin.email }, req.ip);
    res.json({ message: `Password reset for ${admin.name}` });
  } catch(e) {
    console.error('[POST /api/admins/:id/reset-password]', e.message);
    res.status(500).json({ error: 'Failed to reset password' });
  }
});

// ═══════════════════════════════════════════════════════════════════════════
// REPORTER ENDPOINT (products push metrics here)
// ═══════════════════════════════════════════════════════════════════════════

// POST /api/v1/report — Receive metrics from a product
app.post('/api/v1/report', apiKeyAuth, async (req, res) => {
  try {
    const p = req.product;
    const m = req.body;

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
        [p.id, `${p.name}: ${m.errors_24h} errors in 24h`, `Error count exceeded threshold (50). Current: ${m.errors_24h}`]
      );
    }
    if ((m.avg_response_ms || 0) > 3000) {
      await pool.query(
        `INSERT INTO alerts(product_id, type, severity, title, message) VALUES($1, 'slow_api', 'warning', $2, $3)`,
        [p.id, `${p.name}: Avg response ${m.avg_response_ms}ms`, `API response time above 3000ms threshold`]
      );
    }

    res.json({ message: 'Metrics recorded', product: p.slug });
  } catch(e) {
    console.error('[POST /api/v1/report]', e.message);
    res.status(500).json({ error: 'Failed to record metrics' });
  }
});

// ═══════════════════════════════════════════════════════════════════════════
// DASHBOARD API
// ═══════════════════════════════════════════════════════════════════════════

// GET /api/dashboard — Overview KPIs across all products
app.get('/api/dashboard', auth, async (req, res) => {
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

    res.json({
      data: {
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
      }
    });
  } catch(e) {
    console.error('[GET /api/dashboard]', e.message);
    res.status(500).json({ error: 'Failed to load dashboard' });
  }
});

// ═══════════════════════════════════════════════════════════════════════════
// PRODUCTS API
// ═══════════════════════════════════════════════════════════════════════════

// GET /api/products — List all products
app.get('/api/products', auth, async (req, res) => {
  try {
    const products = (await pool.query(
      `SELECT id, slug, name, url, staging_url, stripe_account_id, subscription_amount,
       is_active, icon, color, api_key, created_at, updated_at,
       CASE WHEN db_connection_string IS NOT NULL AND db_connection_string != '' THEN true ELSE false END as has_db_connection
       FROM products ORDER BY name`
    )).rows;
    res.json({ data: products });
  } catch(e) {
    console.error('[GET /api/products]', e.message);
    res.status(500).json({ error: 'Failed to load products' });
  }
});

// POST /api/products — Register a new product
app.post('/api/products', auth, async (req, res) => {
  try {
    const { slug, name, url, staging_url, stripe_account_id, db_connection_string, subscription_amount, icon, color } = req.body;
    if (!slug || !name) return res.status(400).json({ error: 'Slug and name required' });

    const apiKey = 'vhub_' + crypto.randomBytes(24).toString('hex');

    const result = await pool.query(
      `INSERT INTO products(slug, name, url, staging_url, stripe_account_id, db_connection_string, api_key, subscription_amount, icon, color)
       VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10) RETURNING *`,
      [slug.toLowerCase().trim(), name.trim(), url || null, staging_url || null,
       stripe_account_id || null, db_connection_string || null, apiKey, subscription_amount || 0, icon || '📦', color || '#6366f1']
    );

    await logActivity(req.user.id, slug, 'product_registered', { name });
    res.json({ data: result.rows[0], message: 'Product registered' });
  } catch(e) {
    if (e.code === '23505') return res.status(409).json({ error: 'Product slug already exists' });
    console.error('[POST /api/products]', e.message);
    res.status(500).json({ error: 'Failed to register product' });
  }
});

// PUT /api/products/:slug — Update product details
app.put('/api/products/:slug', auth, async (req, res) => {
  try {
    const product = (await pool.query('SELECT * FROM products WHERE slug = $1', [req.params.slug])).rows[0];
    if (!product) return res.status(404).json({ error: 'Product not found' });

    const { name, slug: newSlug, url, staging_url, stripe_account_id, db_connection_string, subscription_amount, icon, color, is_active } = req.body;

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
        slug = COALESCE($11, slug),
        updated_at = NOW()
      WHERE id = $10
      RETURNING id, slug, name, url, staging_url, stripe_account_id, subscription_amount, is_active, icon, color, created_at, updated_at`,
      [name || null, url !== undefined ? url : null, staging_url !== undefined ? staging_url : null,
       stripe_account_id !== undefined ? stripe_account_id : null,
       db_connection_string !== undefined ? db_connection_string : null,
       subscription_amount !== undefined ? subscription_amount : null,
       icon || null, color || null,
       is_active !== undefined ? is_active : null,
       product.id,
       newSlug || null]
    );

    await logActivity(req.user.id, req.params.slug, 'product_updated', { fields: Object.keys(req.body) }, req.ip);
    res.json({ data: result.rows[0], message: 'Product updated' });
  } catch(e) {
    console.error('[PUT /api/products/:slug]', e.message);
    res.status(500).json({ error: 'Failed to update product' });
  }
});

// POST /api/products/:slug/regenerate-key — Generate new API key
app.post('/api/products/:slug/regenerate-key', auth, async (req, res) => {
  try {
    const product = (await pool.query('SELECT * FROM products WHERE slug = $1', [req.params.slug])).rows[0];
    if (!product) return res.status(404).json({ error: 'Product not found' });

    const newKey = 'vhub_' + crypto.randomBytes(24).toString('hex');
    await pool.query('UPDATE products SET api_key = $1, updated_at = NOW() WHERE id = $2', [newKey, product.id]);

    await logActivity(req.user.id, req.params.slug, 'api_key_regenerated', {}, req.ip);
    res.json({ data: { api_key: newKey }, message: 'API key regenerated. Update your product reporter.' });
  } catch(e) {
    console.error('[POST /api/products/:slug/regenerate-key]', e.message);
    res.status(500).json({ error: 'Failed to regenerate API key' });
  }
});

// POST /api/products/:slug/toggle — Toggle product active/inactive
app.post('/api/products/:slug/toggle', auth, async (req, res) => {
  try {
    const product = (await pool.query('SELECT * FROM products WHERE slug = $1', [req.params.slug])).rows[0];
    if (!product) return res.status(404).json({ error: 'Product not found' });

    const newState = !product.is_active;
    await pool.query('UPDATE products SET is_active = $1, updated_at = NOW() WHERE id = $2', [newState, product.id]);

    await logActivity(req.user.id, req.params.slug, newState ? 'product_activated' : 'product_deactivated', {}, req.ip);
    res.json({ message: `${product.name} ${newState ? 'activated' : 'deactivated'}` });
  } catch(e) {
    console.error('[POST /api/products/:slug/toggle]', e.message);
    res.status(500).json({ error: 'Failed to toggle product' });
  }
});

// POST /api/products/:slug/test-db — Test product database connection
app.post('/api/products/:slug/test-db', auth, async (req, res) => {
  try {
    const product = (await pool.query('SELECT * FROM products WHERE slug = $1', [req.params.slug])).rows[0];
    if (!product) return res.status(404).json({ error: 'Product not found' });
    if (!product.db_connection_string) return res.status(400).json({ error: 'No database connection string configured' });

    const testPool = getProductPool(product.db_connection_string);
    const start = Date.now();
    await testPool.query('SELECT 1');
    const latency = Date.now() - start;

    res.json({ data: { connected: true, latency_ms: latency }, message: `Connected in ${latency}ms` });
  } catch(e) {
    console.error('[POST /api/products/:slug/test-db]', e.message);
    res.json({ data: { connected: false, error: e.message }, message: 'Connection failed' });
  }
});

// GET /api/products/:slug/metrics — Detailed metrics for one product
app.get('/api/products/:slug/metrics', auth, async (req, res) => {
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

    res.json({
      data: { product, latest: latest || null, trend, alerts, flags }
    });
  } catch(e) {
    console.error('[GET /api/products/:slug/metrics]', e.message);
    res.status(500).json({ error: 'Failed to load product metrics' });
  }
});

// ═══════════════════════════════════════════════════════════════════════════
// PRODUCT DRILL-DOWN — Read from product DBs
// ═══════════════════════════════════════════════════════════════════════════

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

// GET /api/products/:slug/users — User list from product DB
app.get('/api/products/:slug/users', auth, async (req, res) => {
  try {
    const product = (await pool.query('SELECT * FROM products WHERE slug = $1', [req.params.slug])).rows[0];
    if (!product) return res.status(404).json({ error: 'Product not found' });

    if (!product.db_connection_string) {
      return res.status(400).json({ error: 'No database connection configured for this product' });
    }

    const productPool = getProductPool(product.db_connection_string);
    if (!productPool) return res.status(400).json({ error: 'Cannot connect to product database' });

    const page = Math.max(1, parseInt(req.query.page) || 1);
    const limit = Math.min(100, Math.max(1, parseInt(req.query.limit) || 50));
    const offset = (page - 1) * limit;
    const search = req.query.search?.trim() || '';

    let query = `SELECT id, name, email, email_verified, blocked, subscription_status,
                  plan_type, trial_start_date, trial_end_date, stripe_customer_id,
                  created_at FROM users`;
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
  } catch(e) {
    console.error('[GET /api/products/:slug/users]', e.message);
    res.status(500).json({ error: 'Failed to load users from product database' });
  }
});

// POST /api/products/:slug/users/:id/action — Admin action on a product user
app.post('/api/products/:slug/users/:id/action', auth, async (req, res) => {
  try {
    const product = (await pool.query('SELECT * FROM products WHERE slug = $1', [req.params.slug])).rows[0];
    if (!product) return res.status(404).json({ error: 'Product not found' });
    if (!product.db_connection_string) return res.status(400).json({ error: 'No database connection configured' });

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
  } catch(e) {
    console.error('[POST /api/products/:slug/users/:id/action]', e.message);
    res.status(500).json({ error: 'Failed to perform action' });
  }
});

// ═══════════════════════════════════════════════════════════════════════════
// SUBSCRIPTION CONTROL
// ═══════════════════════════════════════════════════════════════════════════

// POST /api/products/:slug/price — Update subscription price
app.post('/api/products/:slug/price', auth, async (req, res) => {
  try {
    const product = (await pool.query('SELECT * FROM products WHERE slug = $1', [req.params.slug])).rows[0];
    if (!product) return res.status(404).json({ error: 'Product not found' });

    const { amount_cents } = req.body;
    if (!amount_cents || amount_cents < 100) return res.status(400).json({ error: 'Amount must be at least $1.00 (100 cents)' });

    await pool.query(
      'UPDATE products SET subscription_amount = $1, updated_at = NOW() WHERE id = $2',
      [amount_cents, product.id]
    );

    await logActivity(req.user.id, req.params.slug, 'price_updated', {
      old_amount: product.subscription_amount,
      new_amount: amount_cents
    }, req.ip);

    res.json({ message: `Price updated to $${(amount_cents / 100).toFixed(2)}/month` });
  } catch(e) {
    console.error('[POST /api/products/:slug/price]', e.message);
    res.status(500).json({ error: 'Failed to update price' });
  }
});

// ═══════════════════════════════════════════════════════════════════════════
// REVENUE API
// ═══════════════════════════════════════════════════════════════════════════

// GET /api/revenue — Revenue data (from metrics or Stripe)
app.get('/api/revenue', auth, async (req, res) => {
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
  } catch(e) {
    console.error('[GET /api/revenue]', e.message);
    res.status(500).json({ error: 'Failed to load revenue data' });
  }
});

// GET /api/revenue/details — Enhanced revenue data with product cards, daily trend, and milestones
app.get('/api/revenue/details', auth, async (req, res) => {
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
  } catch(e) {
    console.error('[GET /api/revenue/details]', e.message);
    res.status(500).json({ error: 'Failed to load revenue details' });
  }
});

// ═══════════════════════════════════════════════════════════════════════════
// ALERTS API
// ═══════════════════════════════════════════════════════════════════════════

// GET /api/alerts — Active alerts
app.get('/api/alerts', auth, async (req, res) => {
  try {
    const alerts = (await pool.query(
      `SELECT a.*, p.name as product_name, p.slug as product_slug, p.icon as product_icon
       FROM alerts a JOIN products p ON a.product_id = p.id
       WHERE a.resolved = false ORDER BY a.created_at DESC LIMIT 50`
    )).rows;
    res.json({ data: alerts });
  } catch(e) {
    console.error('[GET /api/alerts]', e.message);
    res.status(500).json({ error: 'Failed to load alerts' });
  }
});

// POST /api/alerts/:id/resolve — Resolve an alert
app.post('/api/alerts/:id/resolve', auth, async (req, res) => {
  try {
    await pool.query('UPDATE alerts SET resolved = true, resolved_at = NOW() WHERE id = $1', [req.params.id]);
    res.json({ message: 'Alert resolved' });
  } catch(e) {
    console.error('[POST /api/alerts/:id/resolve]', e.message);
    res.status(500).json({ error: 'Failed to resolve alert' });
  }
});

// GET /api/alerts/summary — Alert summary with counts by severity and type
app.get('/api/alerts/summary', auth, async (req, res) => {
  try {
    const summary = (await pool.query(
      `SELECT
        COUNT(*) as total_active,
        SUM(CASE WHEN severity = 'critical' THEN 1 ELSE 0 END) as critical_count,
        SUM(CASE WHEN severity = 'warning' THEN 1 ELSE 0 END) as warning_count,
        SUM(CASE WHEN severity = 'info' THEN 1 ELSE 0 END) as info_count
       FROM alerts WHERE resolved = false`
    )).rows[0];

    const typeCounts = (await pool.query(
      `SELECT type, COUNT(*) as count
       FROM alerts WHERE resolved = false
       GROUP BY type ORDER BY count DESC`
    )).rows;

    res.json({
      data: {
        total_active: parseInt(summary.total_active) || 0,
        critical_count: parseInt(summary.critical_count) || 0,
        warning_count: parseInt(summary.warning_count) || 0,
        info_count: parseInt(summary.info_count) || 0,
        by_type: typeCounts
      }
    });
  } catch(e) {
    console.error('[GET /api/alerts/summary]', e.message);
    res.status(500).json({ error: 'Failed to load alert summary' });
  }
});

// POST /api/alerts/resolve-all — Resolve all active alerts
app.post('/api/alerts/resolve-all', auth, async (req, res) => {
  try {
    const result = await pool.query(
      'UPDATE alerts SET resolved = true, resolved_at = NOW() WHERE resolved = false RETURNING id'
    );
    const count = result.rows.length;
    await logActivity(req.user.id, null, 'all_alerts_resolved', { count }, req.ip);
    res.json({ message: `Resolved ${count} alerts`, data: { resolved_count: count } });
  } catch(e) {
    console.error('[POST /api/alerts/resolve-all]', e.message);
    res.status(500).json({ error: 'Failed to resolve all alerts' });
  }
});

// ═══════════════════════════════════════════════════════════════════════════
// FEATURE FLAGS
// ═══════════════════════════════════════════════════════════════════════════

// POST /api/products/:slug/flags — Toggle a feature flag
app.post('/api/products/:slug/flags', auth, async (req, res) => {
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
  } catch(e) {
    console.error('[POST /api/products/:slug/flags]', e.message);
    res.status(500).json({ error: 'Failed to update feature flag' });
  }
});

// ═══════════════════════════════════════════════════════════════════════════
// ACTIVITY LOG
// ═══════════════════════════════════════════════════════════════════════════

// GET /api/activity — Recent activity log (optional ?product=slug filter)
app.get('/api/activity', auth, async (req, res) => {
  try {
    const limit = Math.min(100, Math.max(1, parseInt(req.query.limit) || 30));
    const productSlug = req.query.product;
    let activity;
    if (productSlug) {
      activity = (await pool.query(
        'SELECT * FROM activity_log WHERE product_slug = $1 ORDER BY created_at DESC LIMIT $2',
        [productSlug, limit]
      )).rows;
    } else {
      activity = (await pool.query(
        'SELECT * FROM activity_log ORDER BY created_at DESC LIMIT $1',
        [limit]
      )).rows;
    }
    res.json({ data: activity });
  } catch(e) {
    console.error('[GET /api/activity]', e.message);
    res.status(500).json({ error: 'Failed to load activity log' });
  }
});

// ═══════════════════════════════════════════════════════════════════════════
// CHART DATA
// ═══════════════════════════════════════════════════════════════════════════

// GET /api/charts/revenue-trend — Monthly revenue by product (stacked bar)
app.get('/api/charts/revenue-trend', auth, async (req, res) => {
  try {
    const data = (await pool.query(
      `SELECT p.slug, p.name, p.color,
        DATE_TRUNC('month', ms.recorded_at) as month,
        MAX(ms.mrr_cents) as mrr_cents
       FROM metrics_snapshots ms
       JOIN products p ON ms.product_id = p.id
       WHERE ms.recorded_at > NOW() - INTERVAL '12 months'
       GROUP BY p.slug, p.name, p.color, DATE_TRUNC('month', ms.recorded_at)
       ORDER BY month`
    )).rows;
    res.json({ data });
  } catch(e) {
    console.error('[GET /api/charts/revenue-trend]', e.message);
    res.status(500).json({ error: 'Failed to load chart data' });
  }
});

// GET /api/charts/user-growth — User growth over time
app.get('/api/charts/user-growth', auth, async (req, res) => {
  try {
    const data = (await pool.query(
      `SELECT p.slug, p.name, p.color,
        DATE(ms.recorded_at) as date,
        MAX(ms.total_users) as total_users,
        MAX(ms.signups_24h) as signups
       FROM metrics_snapshots ms
       JOIN products p ON ms.product_id = p.id
       WHERE ms.recorded_at > NOW() - INTERVAL '30 days'
       GROUP BY p.slug, p.name, p.color, DATE(ms.recorded_at)
       ORDER BY date`
    )).rows;
    res.json({ data });
  } catch(e) {
    console.error('[GET /api/charts/user-growth]', e.message);
    res.status(500).json({ error: 'Failed to load chart data' });
  }
});

// ═══════════════════════════════════════════════════════════════════════════
// HEALTH CHECK
// ═══════════════════════════════════════════════════════════════════════════

app.get('/health', async (req, res) => {
  try {
    await pool.query('SELECT 1');
    res.json({ status: 'ok', uptime: process.uptime(), timestamp: new Date().toISOString() });
  } catch(e) {
    res.status(500).json({ status: 'error', error: 'Database unreachable' });
  }
});

// ═══════════════════════════════════════════════════════════════════════════
// ADMIN: SEED / BACKFILL METRICS (for demo & testing)
// ═══════════════════════════════════════════════════════════════════════════

// POST /api/admin/seed — Generate realistic historical metrics for all products
app.post('/api/admin/seed', auth, async (req, res) => {
  try {
    const { days = 30, clear = false } = req.body;
    if (days < 1 || days > 365) return res.status(400).json({ error: 'Days must be 1-365' });

    // Optionally clear existing snapshots
    if (clear) {
      await pool.query('DELETE FROM metrics_snapshots');
    }

    const products = (await pool.query('SELECT * FROM products WHERE is_active = true')).rows;
    if (products.length === 0) return res.status(400).json({ error: 'No active products to seed' });

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
  } catch(e) {
    console.error('[POST /api/admin/seed]', e.message);
    res.status(500).json({ error: 'Seed failed: ' + e.message });
  }
});

// ═══════════════════════════════════════════════════════════════════════════
// CATCH-ALL
// ═══════════════════════════════════════════════════════════════════════════

app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'app.html'));
});

// ═══════════════════════════════════════════════════════════════════════════
// START
// ═══════════════════════════════════════════════════════════════════════════

initDB().then(() => {
  app.listen(PORT, '0.0.0.0', () => {
    console.log(`[Varshyl Hub] Running on port ${PORT}`);
    console.log(`[Varshyl Hub] Admin emails: ${ADMIN_EMAILS.join(', ')}`);
  });
}).catch(err => {
  console.error('[FATAL] Database init failed:', err.message);
  process.exit(1);
});
