const express = require('express');
const router = express.Router();
const { apiKeyAuthMiddleware } = require('../middleware/auth');
const { pool } = require('../db/pool');

// GET /api/v1/flags
// Products query their feature flags from the hub
// Auth: X-Api-Key header
router.get('/flags', apiKeyAuthMiddleware, async (req, res) => {
  try {
    const product = req.product;

    const result = await pool.query(
      `SELECT flag_key, enabled, description, updated_at
       FROM feature_flags
       WHERE product_id = $1
       ORDER BY flag_key`,
      [product.id]
    );

    // Return as a key→boolean map for easy consumption
    const flags = {};
    for (const row of result.rows) {
      flags[row.flag_key] = row.enabled;
    }

    res.json({
      data: {
        product: product.slug,
        flags,
        details: result.rows,
      },
      message: 'Feature flags retrieved',
    });
  } catch (err) {
    console.error('[GET /api/v1/flags]', err.message);
    res.status(500).json({ error: 'Failed to retrieve flags' });
  }
});

// GET /api/v1/config
// Products query their hub-side configuration (plan, limits, status)
// Auth: X-Api-Key header
router.get('/config', apiKeyAuthMiddleware, async (req, res) => {
  try {
    const product = req.product;

    // Get feature flags
    const flagsResult = await pool.query(
      `SELECT flag_key, enabled FROM feature_flags WHERE product_id = $1`,
      [product.id]
    );
    const flags = {};
    for (const row of flagsResult.rows) {
      flags[row.flag_key] = row.enabled;
    }

    // Get latest alert count (unresolved)
    const alertsResult = await pool.query(
      `SELECT COUNT(*) as count FROM alerts WHERE product_id = $1 AND resolved = FALSE`,
      [product.id]
    );

    res.json({
      data: {
        product: {
          slug: product.slug,
          name: product.name,
          is_active: product.is_active,
          subscription_amount: product.subscription_amount,
        },
        flags,
        unresolved_alerts: parseInt(alertsResult.rows[0].count),
      },
      message: 'Product config retrieved',
    });
  } catch (err) {
    console.error('[GET /api/v1/config]', err.message);
    res.status(500).json({ error: 'Failed to retrieve config' });
  }
});

// GET /api/v1/entitlement
// Products check user entitlements from the hub
// Auth: X-Api-Key header, query param: ?email=xxx
router.get('/entitlement', apiKeyAuthMiddleware, async (req, res) => {
  try {
    const email = req.query.email;
    if (!email) {
      return res.status(400).json({ error: 'email query parameter required' });
    }

    const result = await pool.query(
      `SELECT * FROM entitlements
       WHERE product_slug = $1 AND email = $2 AND is_active = true
         AND (expires_at IS NULL OR expires_at > NOW())
       ORDER BY created_at DESC LIMIT 1`,
      [req.product.slug, email.toLowerCase()]
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
    console.error('[GET /api/v1/entitlement]', err.message);
    res.status(500).json({ error: 'Failed to check entitlement' });
  }
});

module.exports = router;
