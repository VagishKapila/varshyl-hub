require('dotenv').config({ path: require('path').join(__dirname, '..', '.env') });
const express = require('express');
const path = require('path');
const config = require('./config/env');
const { pool, createPool, testConnection } = require('./db/pool');
const { initDB } = require('./db/schema');

// Middleware
let helmet;
try {
  helmet = require('helmet');
} catch (err) {
  console.warn('[Helmet] Not installed');
}
const cors = require('cors');

// Error handler
const { errorHandler } = require('./middleware/errorHandler');
// Metrics retention
const { pruneOldSnapshots } = require('./services/metrics.service');

// Routes
const authRoutes = require('./routes/auth.routes');
const adminsRoutes = require('./routes/admins.routes');
const productsRoutes = require('./routes/products.routes');
const dashboardRoutes = require('./routes/dashboard.routes');
const revenueRoutes = require('./routes/revenue.routes');
const alertsRoutes = require('./routes/alerts.routes');
const activityRoutes = require('./routes/activity.routes');
const chartsRoutes = require('./routes/charts.routes');
const reportRoutes = require('./routes/report.routes');
const productApiRoutes = require('./routes/product-api.routes');
const adminRoutes = require('./routes/admin.routes');
const formiqWebhook = require('./routes/webhooks/formiq');

const app = express();

// Trust proxy
app.set('trust proxy', 1);

// Security middleware
if (helmet) {
  app.use(helmet({ contentSecurityPolicy: false }));
}

// CORS
app.use(cors({ origin: config.ALLOWED_ORIGIN }));

// Body parsers
app.use(express.json());

// Static files
app.use(express.static(path.join(__dirname, '..', 'public'), {
  setHeaders: (res, filePath) => {
    if (filePath.endsWith('.html')) {
      res.setHeader('Cache-Control', 'no-cache, must-revalidate');
    }
  }
}));

// API Routes
app.use('/api/auth', authRoutes);
app.use('/api/admins', adminsRoutes);
app.use('/api/products', productsRoutes);
app.use('/api/dashboard', dashboardRoutes);
app.use('/api/revenue', revenueRoutes);
app.use('/api/alerts', alertsRoutes);
app.use('/api/activity', activityRoutes);
app.use('/api/charts', chartsRoutes);
app.use('/api/v1/report', reportRoutes);
app.use('/api/v1', productApiRoutes);
app.use('/api/admin', adminRoutes);

// Webhook Routes
app.use('/webhook', formiqWebhook);

// Health check
app.get('/health', async (req, res) => {
  try {
    await pool.query('SELECT 1');
    res.json({ status: 'ok', uptime: process.uptime(), timestamp: new Date().toISOString() });
  } catch (err) {
    res.status(500).json({ status: 'error', error: 'Database unreachable' });
  }
});

// SPA catch-all — serve React app for all non-API routes
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, '..', 'public', 'index.html'));
});

// Error handler
app.use(errorHandler);

// Start server
async function start() {
  try {
    // Create pool if not already created
    if (!pool) {
      createPool();
    }

    // Test connection
    await testConnection();

    // Initialize database
    await initDB();

    // Start server
    app.listen(config.PORT, '0.0.0.0', () => {
      console.log(`[Varshyl Hub] Running on port ${config.PORT}`);
      console.log(`[Varshyl Hub] Admin emails: ${config.ADMIN_EMAILS.join(', ')}`);
      console.log(`[Varshyl Hub] Environment: ${config.NODE_ENV}`);
    });

    // Daily retention pruning — run once on startup, then every 24h
    pruneOldSnapshots(90).catch(() => {});
    setInterval(() => pruneOldSnapshots(90).catch(() => {}), 24 * 60 * 60 * 1000);
  } catch (err) {
    console.error('[FATAL] Startup failed:', err.message);
    process.exit(1);
  }
}

start();

module.exports = app;
