const express = require('express');
const router = express.Router();
const { pool } = require('../../db/pool');

// POST /webhook/formiq
// Receives analytics events from FormIQ
// Auth: X-Varshyl-Key header must match FormIQ's api_key in products table
router.post('/formiq', async (req, res) => {
  try {
    // 1. Extract API key from header
    const apiKey = req.headers['x-varshyl-key'];
    if (!apiKey) {
      return res.status(401).json({ error: 'Missing X-Varshyl-Key header' });
    }

    // 2. Validate key against the formiq product
    const productResult = await pool.query(
      `SELECT id, slug, api_key FROM products WHERE slug = 'formiq' AND is_active = true`,
    );

    if (productResult.rows.length === 0) {
      return res.status(404).json({ error: 'FormIQ product not registered' });
    }

    const product = productResult.rows[0];
    if (product.api_key !== apiKey) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    // 3. Parse and validate payload
    const { event, user_id, metadata, timestamp } = req.body;

    if (!event || typeof event !== 'string') {
      return res.status(400).json({ error: 'Missing or invalid "event" field' });
    }

    const eventTimestamp = timestamp ? new Date(timestamp) : new Date();
    if (isNaN(eventTimestamp.getTime())) {
      return res.status(400).json({ error: 'Invalid timestamp format' });
    }

    // 4. Insert into analytics_events
    await pool.query(
      `INSERT INTO analytics_events (product_id, event, user_id, metadata, timestamp)
       VALUES ($1, $2, $3, $4, $5)`,
      [
        product.id,
        event,
        user_id || null,
        metadata ? JSON.stringify(metadata) : '{}',
        eventTimestamp,
      ],
    );

    // 5. Return success
    res.json({ received: true, event });
  } catch (err) {
    console.error('[POST /webhook/formiq]', err.message);
    res.status(500).json({ error: 'Failed to process webhook' });
  }
});

module.exports = router;
