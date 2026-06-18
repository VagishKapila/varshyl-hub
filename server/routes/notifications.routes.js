const express = require('express');
const router = express.Router();
const { pool } = require('../db/pool');
const { authMiddleware } = require('../middleware/auth');
const { logActivity } = require('../services/activity.service');
const config = require('../config/env');

// GET /api/notifications/broadcasts
router.get('/broadcasts', authMiddleware, async (req, res) => {
  try {
    const result = await pool.query(
      `SELECT nb.*, hu.name as sent_by_name
       FROM notification_broadcasts nb
       LEFT JOIN hub_users hu ON hu.id = nb.sent_by
       ORDER BY nb.sent_at DESC
       LIMIT 50`
    );
    res.json({ data: result.rows });
  } catch (err) {
    console.error('[GET /api/notifications/broadcasts]', err.message);
    res.status(500).json({ error: 'Failed to load broadcast history' });
  }
});

// GET /api/notifications/products
router.get('/products', authMiddleware, async (req, res) => {
  try {
    const result = await pool.query(
      `SELECT id, slug, name, icon, color, broadcast_url
       FROM products
       WHERE is_active = true AND broadcast_url IS NOT NULL
       ORDER BY name`
    );
    res.json({ data: result.rows });
  } catch (err) {
    console.error('[GET /api/notifications/products]', err.message);
    res.status(500).json({ error: 'Failed to load notification-enabled products' });
  }
});

// POST /api/notifications/send
router.post('/send', authMiddleware, async (req, res) => {
  try {
    const { product_slug, title, body, dry_run = false } = req.body;

    if (!product_slug) return res.status(400).json({ error: 'product_slug required' });
    if (!title || title.trim().length === 0) return res.status(400).json({ error: 'title required' });
    if (!body || body.trim().length === 0) return res.status(400).json({ error: 'body required' });
    if (title.length > 50) return res.status(400).json({ error: 'title max 50 characters' });
    if (body.length > 150) return res.status(400).json({ error: 'body max 150 characters' });

    const productResult = await pool.query(
      'SELECT * FROM products WHERE slug = $1 AND is_active = true',
      [product_slug]
    );
    if (!productResult.rows.length) {
      return res.status(404).json({ error: 'Product not found' });
    }
    const product = productResult.rows[0];

    if (!product.broadcast_url) {
      return res.status(400).json({
        error: 'This product has no broadcast endpoint configured. Add broadcast_url in Manage Products.',
      });
    }

    if (dry_run) {
      let estimated = 0;
      try {
        const dryRes = await fetch(product.broadcast_url, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'X-Hub-Secret': config.HUB_BROADCAST_SECRET || '',
          },
          body: JSON.stringify({
            title: title.trim(),
            body: body.trim(),
            segment: 'announcements_opted_in',
            dry_run: true,
          }),
          signal: AbortSignal.timeout(8000),
        });
        const dryData = await dryRes.json();
        estimated = dryData.estimated_recipients || dryData.count || 0;
      } catch (err) {
        console.error('[Dry Run Fetch Error]', err.message);
      }

      await pool.query(
        `INSERT INTO notification_broadcasts
         (product_slug, product_name, title, body, dry_run, estimated_recipients, status, sent_by)
         VALUES ($1,$2,$3,$4,true,$5,'dry_run',$6)`,
        [product_slug, product.name, title.trim(), body.trim(), estimated, req.user.id]
      );

      return res.json({
        data: { dry_run: true, estimated_recipients: estimated },
        message: `Dry run complete. Estimated ${estimated} recipients.`,
      });
    }

    let sent_count = 0;
    let failed_count = 0;
    let status = 'sent';
    let error_message = null;

    try {
      const sendRes = await fetch(product.broadcast_url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Hub-Secret': config.HUB_BROADCAST_SECRET || '',
        },
        body: JSON.stringify({
          title: title.trim(),
          body: body.trim(),
          segment: 'announcements_opted_in',
          dry_run: false,
        }),
        signal: AbortSignal.timeout(15000),
      });

      if (!sendRes.ok) {
        const errText = await sendRes.text();
        throw new Error(`Product returned ${sendRes.status}: ${errText.slice(0, 200)}`);
      }

      const sendData = await sendRes.json();
      sent_count = sendData.sent || 0;
      failed_count = sendData.failed || 0;
    } catch (err) {
      status = 'failed';
      error_message = err.message;
      console.error('[Broadcast Send Error]', err.message);
    }

    const saved = await pool.query(
      `INSERT INTO notification_broadcasts
       (product_slug, product_name, title, body, sent_count, failed_count,
        dry_run, status, error_message, sent_by)
       VALUES ($1,$2,$3,$4,$5,$6,false,$7,$8,$9)
       RETURNING *`,
      [product_slug, product.name, title.trim(), body.trim(),
        sent_count, failed_count, status, error_message, req.user.id]
    );

    await logActivity(
      req.user.id, product_slug, 'broadcast_sent',
      { title: title.trim(), sent_count, failed_count, status },
      req.ip
    );

    if (status === 'failed') {
      return res.status(502).json({
        error: `Broadcast failed: ${error_message}`,
        data: saved.rows[0],
      });
    }

    res.json({
      data: saved.rows[0],
      message: `Sent to ${sent_count} users. ${failed_count} failed.`,
    });
  } catch (err) {
    console.error('[POST /api/notifications/send]', err.message);
    res.status(500).json({ error: 'Failed to send broadcast' });
  }
});

module.exports = router;
