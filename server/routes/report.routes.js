const express = require('express');
const router = express.Router();
const { apiKeyAuthMiddleware } = require('../middleware/auth');
const { recordMetrics } = require('../services/metrics.service');

// POST /api/v1/report
router.post('/', apiKeyAuthMiddleware, async (req, res) => {
  try {
    const p = req.product;
    await recordMetrics(p.id, req.body);
    res.json({ message: 'Metrics recorded', product: p.slug });
  } catch (err) {
    console.error('[POST /api/v1/report]', err.message);
    res.status(500).json({ error: 'Failed to record metrics' });
  }
});

module.exports = router;
