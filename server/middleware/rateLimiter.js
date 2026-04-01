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
}) : (req, res, next) => next();

module.exports = { authLimiter };
