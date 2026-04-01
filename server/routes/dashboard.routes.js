const express = require('express');
const router = express.Router();
const { authMiddleware } = require('../middleware/auth');
const { getDashboardKPIs } = require('../services/dashboard.service');

// GET /api/dashboard
router.get('/', authMiddleware, async (req, res) => {
  try {
    const data = await getDashboardKPIs();
    res.json({ data });
  } catch (err) {
    console.error('[GET /api/dashboard]', err.message);
    res.status(500).json({ error: 'Failed to load dashboard' });
  }
});

module.exports = router;
