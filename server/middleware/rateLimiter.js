let rateLimit;
try {
  rateLimit = require('express-rate-limit');
} catch (err) {
  console.warn('[Rate Limiter] express-rate-limit not installed');
}

const authLimiter = rateLimit ? rateLimit({
  windowMs: 60 * 1000,
  max: 10,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Too many attempts. Wait a minute.' }
}) : (_req, _res, next) => next();

// Per-API-key rate limiter for the report endpoint
// 120 requests per hour per API key (generous for hourly reporting + retries)
const reportLimiter = rateLimit ? rateLimit({
  windowMs: 60 * 60 * 1000, // 1 hour
  max: 120,
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: (req) => req.headers['x-api-key'] || req.ip,
  message: { error: 'Rate limit exceeded. Max 120 reports per hour per API key.' }
}) : (_req, _res, next) => next();

module.exports = { authLimiter, reportLimiter };
