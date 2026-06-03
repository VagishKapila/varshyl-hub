const requiredInProd = ['DATABASE_URL', 'JWT_SECRET'];

const config = {
  PORT: parseInt(process.env.PORT || '3000'),
  NODE_ENV: process.env.NODE_ENV || 'development',
  DATABASE_URL: process.env.DATABASE_URL,
  JWT_SECRET: process.env.JWT_SECRET || 'change-this-secret',
  ALLOWED_ORIGIN: process.env.ALLOWED_ORIGIN || '*',
  ADMIN_EMAILS: (process.env.ADMIN_EMAILS || 'vaakapila@gmail.com')
    .split(',')
    .map(e => e.trim().toLowerCase()),
  STRIPE_ORG_KEY: process.env.STRIPE_ORG_KEY || null,
  ANTHROPIC_API_KEY: process.env.ANTHROPIC_API_KEY || null,
  DIGEST_EMAIL: process.env.DIGEST_EMAIL || 'kapilav@varshyl.com',
  RESEND_API_KEY: process.env.RESEND_API_KEY || null,
};

// Validate critical env vars in production
if (config.NODE_ENV === 'production') {
  for (const key of requiredInProd) {
    if (!process.env[key]) {
      console.error(`FATAL: ${key} is required in production`);
      process.exit(1);
    }
  }
}

// Warn if JWT_SECRET is default
if (config.JWT_SECRET === 'change-this-secret') {
  console.warn('WARNING: Using default JWT_SECRET — please set in production');
}

module.exports = config;
