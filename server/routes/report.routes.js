const express = require('express');
const router = express.Router();
const { apiKeyAuthMiddleware } = require('../middleware/auth');
const { validateBody, metricsReportSchema } = require('../middleware/validate');
const { reportLimiter } = require('../middleware/rateLimiter');
const { recordMetrics } = require('../services/metrics.service');

// POST /api/v1/report
// Products send hourly metrics snapshots here
// Auth: X-Api-Key header (product API key)
// Rate limit: 120 requests/hour per API key
// Body: validated against metricsReportSchema (Zod)
router.post('/',
  reportLimiter,
  apiKeyAuthMiddleware,
  validateBody(metricsReportSchema),
  async (req, res) => {
    try {
      const product = req.product;
      const metrics = req.validatedBody;

      await recordMetrics(product.id, metrics);

      res.json({
        data: { product: product.slug, recorded_at: new Date().toISOString() },
        message: 'Metrics recorded',
      });
    } catch (err) {
      console.error('[POST /api/v1/report]', err.message);
      res.status(500).json({ error: 'Failed to record metrics' });
    }
  }
);

module.exports = router;
