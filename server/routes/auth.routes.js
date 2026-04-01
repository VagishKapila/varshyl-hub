const express = require('express');
const router = express.Router();
const { authMiddleware } = require('../middleware/auth');
const { authLimiter } = require('../middleware/rateLimiter');
const { login, setup } = require('../services/auth.service');

// POST /api/auth/login
router.post('/login', authLimiter, async (req, res) => {
  try {
    const { email, password } = req.body;
    if (!email || !password) {
      return res.status(400).json({ error: 'Email and password required' });
    }

    const result = await login(email, password, req.ip);
    res.json({ data: result });
  } catch (err) {
    console.error('[POST /api/auth/login]', err.message);
    res.status(err.status || 500).json({ error: err.message });
  }
});

// POST /api/auth/setup
router.post('/setup', async (req, res) => {
  try {
    const { name, email, password } = req.body;
    const result = await setup(name, email, password, req.ip);
    res.json({ data: result, message: 'Admin account created' });
  } catch (err) {
    console.error('[POST /api/auth/setup]', err.message);
    res.status(err.status || 500).json({ error: err.message });
  }
});

// GET /api/auth/me
router.get('/me', authMiddleware, (req, res) => {
  try {
    res.json({ data: { id: req.user.id, name: req.user.name, email: req.user.email } });
  } catch (err) {
    console.error('[GET /api/auth/me]', err.message);
    res.status(500).json({ error: 'Failed to get user info' });
  }
});

module.exports = router;
