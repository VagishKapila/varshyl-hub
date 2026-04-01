const express = require('express');
const router = express.Router();
const { pool } = require('../db/pool');
const { authMiddleware } = require('../middleware/auth');
const { logActivity } = require('../services/activity.service');

// GET /api/alerts
router.get('/', authMiddleware, async (req, res) => {
  try {
    const alerts = (await pool.query(
      `SELECT a.*, p.name as product_name, p.slug as product_slug, p.icon as product_icon
       FROM alerts a JOIN products p ON a.product_id = p.id
       WHERE a.resolved = false ORDER BY a.created_at DESC LIMIT 50`
    )).rows;
    res.json({ data: alerts });
  } catch (err) {
    console.error('[GET /api/alerts]', err.message);
    res.status(500).json({ error: 'Failed to load alerts' });
  }
});

// POST /api/alerts/:id/resolve
router.post('/:id/resolve', authMiddleware, async (req, res) => {
  try {
    await pool.query('UPDATE alerts SET resolved = true, resolved_at = NOW() WHERE id = $1', [req.params.id]);
    res.json({ message: 'Alert resolved' });
  } catch (err) {
    console.error('[POST /api/alerts/:id/resolve]', err.message);
    res.status(500).json({ error: 'Failed to resolve alert' });
  }
});

// GET /api/alerts/summary
router.get('/summary', authMiddleware, async (req, res) => {
  try {
    const summary = (await pool.query(
      `SELECT
        COUNT(*) as total_active,
        SUM(CASE WHEN severity = 'critical' THEN 1 ELSE 0 END) as critical_count,
        SUM(CASE WHEN severity = 'warning' THEN 1 ELSE 0 END) as warning_count,
        SUM(CASE WHEN severity = 'info' THEN 1 ELSE 0 END) as info_count
       FROM alerts WHERE resolved = false`
    )).rows[0];

    const typeCounts = (await pool.query(
      `SELECT type, COUNT(*) as count
       FROM alerts WHERE resolved = false
       GROUP BY type ORDER BY count DESC`
    )).rows;

    res.json({
      data: {
        total_active: parseInt(summary.total_active) || 0,
        critical_count: parseInt(summary.critical_count) || 0,
        warning_count: parseInt(summary.warning_count) || 0,
        info_count: parseInt(summary.info_count) || 0,
        by_type: typeCounts
      }
    });
  } catch (err) {
    console.error('[GET /api/alerts/summary]', err.message);
    res.status(500).json({ error: 'Failed to load alert summary' });
  }
});

// POST /api/alerts/resolve-all
router.post('/resolve-all', authMiddleware, async (req, res) => {
  try {
    const result = await pool.query(
      'UPDATE alerts SET resolved = true, resolved_at = NOW() WHERE resolved = false RETURNING id'
    );
    const count = result.rows.length;
    await logActivity(req.user.id, null, 'all_alerts_resolved', { count }, req.ip);
    res.json({ message: `Resolved ${count} alerts`, data: { resolved_count: count } });
  } catch (err) {
    console.error('[POST /api/alerts/resolve-all]', err.message);
    res.status(500).json({ error: 'Failed to resolve all alerts' });
  }
});

module.exports = router;
