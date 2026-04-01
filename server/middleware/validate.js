const { z } = require('zod');

/**
 * Zod validation middleware factory
 * Usage: validateBody(metricsReportSchema)
 */
function validateBody(schema) {
  return (req, res, next) => {
    try {
      const result = schema.safeParse(req.body);
      if (!result.success) {
        const details = result.error.issues.map(i => `${i.path.join('.')}: ${i.message}`);
        return res.status(400).json({
          error: 'Validation failed',
          details,
        });
      }
      req.validatedBody = result.data;
      next();
    } catch (err) {
      console.error('[Validation Middleware]', err.message);
      res.status(500).json({ error: 'Validation error' });
    }
  };
}

// ═══ Metrics Report Schema ═══
// Defines all accepted fields with bounds checking
const metricsReportSchema = z.object({
  // User counts (0–10M reasonable range)
  total_users:          z.number().int().min(0).max(10_000_000).default(0),
  active_users_24h:     z.number().int().min(0).max(10_000_000).default(0),
  trial_users:          z.number().int().min(0).max(10_000_000).default(0),
  pro_users:            z.number().int().min(0).max(10_000_000).default(0),
  churned_users:        z.number().int().min(0).max(10_000_000).default(0),
  free_override_users:  z.number().int().min(0).max(10_000_000).default(0),

  // Revenue (in cents, max ~$10M)
  mrr_cents:            z.number().int().min(0).max(1_000_000_000).default(0),
  total_revenue_cents:  z.number().int().min(0).max(10_000_000_000).default(0),

  // Operational metrics
  errors_24h:           z.number().int().min(0).max(1_000_000).default(0),
  avg_response_ms:      z.number().int().min(0).max(60_000).default(0),
  signups_24h:          z.number().int().min(0).max(100_000).default(0),

  // Product-specific counters
  pay_apps_created_24h: z.number().int().min(0).max(100_000).default(0),
  pdfs_generated_24h:   z.number().int().min(0).max(100_000).default(0),
  emails_sent_24h:      z.number().int().min(0).max(100_000).default(0),

  // When the product collected these metrics (ISO 8601)
  collected_at:         z.string().datetime().optional(),

  // Arbitrary JSON metadata
  metadata:             z.record(z.string(), z.any()).default({}),
}).strict();

module.exports = {
  validateBody,
  metricsReportSchema,
};
