const express = require('express');
const router = express.Router();
const { pool } = require('../db/pool');
const { authMiddleware } = require('../middleware/auth');
const { generateAndSendDigest, chatWithSoren } = require('../services/digest.service');

// GET /api/digest
router.get('/', authMiddleware, async (req, res) => {
  try {
    const rows = (await pool.query(
      'SELECT * FROM nightly_digests ORDER BY digest_date DESC LIMIT 30'
    )).rows;
    res.json({ data: rows });
  } catch (err) {
    console.error('[GET /api/digest]', err.message);
    res.status(500).json({ error: 'Failed to load digests' });
  }
});

// POST /api/digest/run
router.post('/run', authMiddleware, async (req, res) => {
  try {
    const digestRecord = await generateAndSendDigest();
    if (!digestRecord) {
      return res.status(500).json({ error: 'Failed to generate digest' });
    }
    res.json({ data: digestRecord, message: 'Digest generated and sent' });
  } catch (err) {
    console.error('[POST /api/digest/run]', err.message);
    res.status(500).json({ error: 'Failed to run digest' });
  }
});

// POST /api/digest/chat
router.post('/chat', authMiddleware, async (req, res) => {
  try {
    const { message, history } = req.body;
    if (!message) {
      return res.status(400).json({ error: 'Message is required' });
    }

    const reply = await chatWithSoren(message, history || []);
    res.json({ data: { reply } });
  } catch (err) {
    console.error('[POST /api/digest/chat]', err.message);
    res.status(500).json({ error: 'Failed to get reply from Soren' });
  }
});

module.exports = router;
