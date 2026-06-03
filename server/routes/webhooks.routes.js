const express = require('express');
const router = express.Router();
const { pool } = require('../db/pool');
const { authMiddleware } = require('../middleware/auth');
const { logActivity } = require('../services/activity.service');
const { fireWebhook } = require('../services/webhook.service');

// GET /api/webhooks
router.get('/', authMiddleware, async (req, res) => {
  try {
    const rows = (await pool.query(
      `SELECT w.*,
        (SELECT json_agg(d ORDER BY d.attempted_at DESC)
         FROM (
           SELECT id, event_type, success, response_status, attempted_at
           FROM webhook_deliveries
           WHERE webhook_id = w.id
           ORDER BY attempted_at DESC
           LIMIT 3
         ) d
        ) as recent_deliveries
       FROM webhooks w
       ORDER BY w.created_at DESC`
    )).rows;
    res.json({ data: rows });
  } catch (err) {
    console.error('[GET /api/webhooks]', err.message);
    res.status(500).json({ error: 'Failed to load webhooks' });
  }
});

// POST /api/webhooks
router.post('/', authMiddleware, async (req, res) => {
  try {
    const { name, endpoint_url, secret, events, product_slug } = req.body;

    if (!name || !endpoint_url) {
      return res.status(400).json({ error: 'Name and endpoint_url are required' });
    }

    const eventList = Array.isArray(events) ? events : [];
    const result = await pool.query(
      `INSERT INTO webhooks (name, endpoint_url, secret, events, product_slug, created_by)
       VALUES ($1, $2, $3, $4, $5, $6) RETURNING *`,
      [name, endpoint_url, secret || null, eventList, product_slug || null, req.user.id]
    );

    await logActivity(req.user.id, product_slug || 'all', 'webhook_created', { name }, req.ip);
    res.json({ data: result.rows[0], message: 'Webhook registered' });
  } catch (err) {
    console.error('[POST /api/webhooks]', err.message);
    res.status(500).json({ error: 'Failed to register webhook' });
  }
});

// GET /api/webhooks/:id/deliveries
router.get('/:id/deliveries', authMiddleware, async (req, res) => {
  try {
    const rows = (await pool.query(
      `SELECT * FROM webhook_deliveries
       WHERE webhook_id = $1
       ORDER BY attempted_at DESC
       LIMIT 50`,
      [req.params.id]
    )).rows;
    res.json({ data: rows });
  } catch (err) {
    console.error('[GET /api/webhooks/:id/deliveries]', err.message);
    res.status(500).json({ error: 'Failed to load deliveries' });
  }
});

// POST /api/webhooks/:id/test
router.post('/:id/test', authMiddleware, async (req, res) => {
  try {
    const id = parseInt(req.params.id, 10);
    await fireWebhook('test', { message: 'Varshyl Hub test event', webhook_id: id }, null);
    res.json({ message: 'Test fired' });
  } catch (err) {
    console.error('[POST /api/webhooks/:id/test]', err.message);
    res.status(500).json({ error: 'Failed to fire test webhook' });
  }
});

// POST /api/webhooks/:id/toggle
router.post('/:id/toggle', authMiddleware, async (req, res) => {
  try {
    const result = await pool.query(
      'UPDATE webhooks SET is_active = NOT is_active WHERE id = $1 RETURNING *',
      [req.params.id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Webhook not found' });
    }

    const row = result.rows[0];
    await logActivity(req.user.id, row.product_slug || 'all', 'webhook_toggled', {
      name: row.name,
      is_active: row.is_active,
    }, req.ip);

    res.json({
      data: row,
      message: row.is_active ? 'Webhook activated' : 'Webhook deactivated',
    });
  } catch (err) {
    console.error('[POST /api/webhooks/:id/toggle]', err.message);
    res.status(500).json({ error: 'Failed to toggle webhook' });
  }
});

// PUT /api/webhooks/:id
router.put('/:id', authMiddleware, async (req, res) => {
  try {
    const { name, endpoint_url, secret, events, product_slug } = req.body;
    const eventList = Array.isArray(events) ? events : [];

    const result = await pool.query(
      `UPDATE webhooks SET
         name = COALESCE($1, name),
         endpoint_url = COALESCE($2, endpoint_url),
         secret = $3,
         events = $4,
         product_slug = $5
       WHERE id = $6 RETURNING *`,
      [name, endpoint_url, secret || null, eventList, product_slug || null, req.params.id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Webhook not found' });
    }

    const row = result.rows[0];
    await logActivity(req.user.id, row.product_slug || 'all', 'webhook_updated', { name: row.name }, req.ip);
    res.json({ data: row, message: 'Webhook updated' });
  } catch (err) {
    console.error('[PUT /api/webhooks/:id]', err.message);
    res.status(500).json({ error: 'Failed to update webhook' });
  }
});

// DELETE /api/webhooks/:id
router.delete('/:id', authMiddleware, async (req, res) => {
  try {
    const existing = await pool.query('SELECT * FROM webhooks WHERE id = $1', [req.params.id]);
    if (existing.rows.length === 0) {
      return res.status(404).json({ error: 'Webhook not found' });
    }

    const row = existing.rows[0];
    await pool.query('DELETE FROM webhooks WHERE id = $1', [req.params.id]);
    await logActivity(req.user.id, row.product_slug || 'all', 'webhook_deleted', { name: row.name }, req.ip);
    res.json({ message: 'Webhook deleted' });
  } catch (err) {
    console.error('[DELETE /api/webhooks/:id]', err.message);
    res.status(500).json({ error: 'Failed to delete webhook' });
  }
});

module.exports = router;
