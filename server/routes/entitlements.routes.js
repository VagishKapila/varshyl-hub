const express = require('express');
const router = express.Router();
const { pool } = require('../db/pool');
const { authMiddleware } = require('../middleware/auth');
const { logActivity } = require('../services/activity.service');

const VALID_OVERRIDE_TYPES = ['free_forever', 'pro_override', 'discount', 'trial_extension'];

// GET /api/entitlements/check/:productSlug/:email — public, no auth
router.get('/check/:productSlug/:email', async (req, res) => {
  try {
    const { productSlug, email } = req.params;
    const result = await pool.query(
      `SELECT * FROM entitlements
       WHERE product_slug = $1 AND email = $2 AND is_active = true
         AND (expires_at IS NULL OR expires_at > NOW())
       ORDER BY created_at DESC LIMIT 1`,
      [productSlug, email.toLowerCase()]
    );

    if (result.rows.length === 0) {
      return res.json({
        data: {
          has_override: false,
          override_type: null,
          discount_pct: 0,
          trial_days: 0,
          expires_at: null,
        },
      });
    }

    const row = result.rows[0];
    res.json({
      data: {
        has_override: true,
        override_type: row.override_type,
        discount_pct: row.discount_pct,
        trial_days: row.trial_days,
        expires_at: row.expires_at,
      },
    });
  } catch (err) {
    console.error('[GET /api/entitlements/check]', err.message);
    res.status(500).json({ error: 'Failed to check entitlement' });
  }
});

// GET /api/entitlements/promo-codes
router.get('/promo-codes', authMiddleware, async (req, res) => {
  try {
    const rows = (await pool.query(
      'SELECT * FROM promo_codes ORDER BY created_at DESC'
    )).rows;
    res.json({ data: rows });
  } catch (err) {
    console.error('[GET /api/entitlements/promo-codes]', err.message);
    res.status(500).json({ error: 'Failed to load promo codes' });
  }
});

// POST /api/entitlements/promo-codes
router.post('/promo-codes', authMiddleware, async (req, res) => {
  try {
    const { code, product_slug, discount_pct, trial_days, max_uses, valid_until } = req.body;

    if (!code) {
      return res.status(400).json({ error: 'Code is required' });
    }

    const result = await pool.query(
      `INSERT INTO promo_codes (code, product_slug, discount_pct, trial_days, max_uses, valid_until, created_by)
       VALUES ($1, $2, $3, $4, $5, $6, $7) RETURNING *`,
      [
        code.toUpperCase().trim(),
        product_slug || null,
        discount_pct || 0,
        trial_days || 0,
        max_uses || null,
        valid_until || null,
        req.user.id,
      ]
    );

    await logActivity(req.user.id, product_slug || 'all', 'promo_code_created', { code }, req.ip);
    res.json({ data: result.rows[0], message: 'Promo code created' });
  } catch (err) {
    console.error('[POST /api/entitlements/promo-codes]', err.message);
    if (err.code === '23505') {
      return res.status(400).json({ error: 'Promo code already exists' });
    }
    res.status(500).json({ error: 'Failed to create promo code' });
  }
});

// POST /api/entitlements/promo-codes/:id/toggle
router.post('/promo-codes/:id/toggle', authMiddleware, async (req, res) => {
  try {
    const result = await pool.query(
      'UPDATE promo_codes SET is_active = NOT is_active WHERE id = $1 RETURNING *',
      [req.params.id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Promo code not found' });
    }

    const row = result.rows[0];
    await logActivity(req.user.id, row.product_slug || 'all', 'promo_code_toggled', {
      code: row.code,
      is_active: row.is_active,
    }, req.ip);

    res.json({
      data: row,
      message: row.is_active ? 'Promo code activated' : 'Promo code deactivated',
    });
  } catch (err) {
    console.error('[POST /api/entitlements/promo-codes/:id/toggle]', err.message);
    res.status(500).json({ error: 'Failed to toggle promo code' });
  }
});

// GET /api/entitlements
router.get('/', authMiddleware, async (req, res) => {
  try {
    const entitlements = (await pool.query(
      `SELECT * FROM entitlements WHERE is_active = true ORDER BY created_at DESC`
    )).rows;

    const promo_codes = (await pool.query(
      'SELECT * FROM promo_codes ORDER BY created_at DESC'
    )).rows;

    res.json({ data: { entitlements, promo_codes } });
  } catch (err) {
    console.error('[GET /api/entitlements]', err.message);
    res.status(500).json({ error: 'Failed to load entitlements' });
  }
});

// POST /api/entitlements
router.post('/', authMiddleware, async (req, res) => {
  try {
    const { product_slug, email, override_type, discount_pct, trial_days, note, expires_at } = req.body;

    if (!product_slug || !email || !override_type) {
      return res.status(400).json({ error: 'product_slug, email, and override_type are required' });
    }

    if (!VALID_OVERRIDE_TYPES.includes(override_type)) {
      return res.status(400).json({ error: 'Invalid override_type' });
    }

    const result = await pool.query(
      `INSERT INTO entitlements (product_slug, email, override_type, discount_pct, trial_days, note, expires_at, granted_by)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8) RETURNING *`,
      [
        product_slug,
        email.toLowerCase().trim(),
        override_type,
        discount_pct || 0,
        trial_days || 0,
        note || null,
        expires_at || null,
        req.user.id,
      ]
    );

    await logActivity(req.user.id, product_slug, 'entitlement_granted', { email, override_type }, req.ip);
    res.json({ data: result.rows[0], message: 'Entitlement granted' });
  } catch (err) {
    console.error('[POST /api/entitlements]', err.message);
    res.status(500).json({ error: 'Failed to grant entitlement' });
  }
});

// DELETE /api/entitlements/:id — soft delete only
router.delete('/:id', authMiddleware, async (req, res) => {
  try {
    const existing = await pool.query('SELECT * FROM entitlements WHERE id = $1', [req.params.id]);
    if (existing.rows.length === 0) {
      return res.status(404).json({ error: 'Entitlement not found' });
    }

    const row = existing.rows[0];
    await pool.query('UPDATE entitlements SET is_active = false WHERE id = $1', [req.params.id]);

    await logActivity(req.user.id, row.product_slug, 'entitlement_revoked', {
      email: row.email,
      override_type: row.override_type,
    }, req.ip);

    res.json({ message: 'Entitlement revoked' });
  } catch (err) {
    console.error('[DELETE /api/entitlements/:id]', err.message);
    res.status(500).json({ error: 'Failed to revoke entitlement' });
  }
});

module.exports = router;
