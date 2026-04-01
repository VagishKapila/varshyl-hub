const express = require('express');
const router = express.Router();
const bcrypt = require('bcryptjs');
const { pool } = require('../db/pool');
const { authMiddleware } = require('../middleware/auth');
const { logActivity } = require('../services/activity.service');
const config = require('../config/env');

// GET /api/admins
router.get('/', authMiddleware, async (req, res) => {
  try {
    const result = await pool.query(
      'SELECT id, name, email, is_admin, last_login, created_at FROM hub_users ORDER BY created_at'
    );
    res.json({ data: result.rows });
  } catch (err) {
    console.error('[GET /api/admins]', err.message);
    res.status(500).json({ error: 'Failed to load admins' });
  }
});

// POST /api/admins
router.post('/', authMiddleware, async (req, res) => {
  try {
    const { name, email, password } = req.body;
    if (!name || !email || !password) {
      return res.status(400).json({ error: 'Name, email, and password required' });
    }
    if (password.length < 8) {
      return res.status(400).json({ error: 'Password must be at least 8 characters' });
    }

    const normalEmail = email.trim().toLowerCase();

    // Check if email already exists
    const existing = await pool.query('SELECT id FROM hub_users WHERE email = $1', [normalEmail]);
    if (existing.rows.length > 0) {
      return res.status(409).json({ error: 'An admin with this email already exists' });
    }

    const hash = await bcrypt.hash(password, 12);
    const result = await pool.query(
      'INSERT INTO hub_users(name, email, password_hash) VALUES($1, $2, $3) RETURNING id, name, email, is_admin, created_at',
      [name.trim(), normalEmail, hash]
    );

    // Dynamically add new email to ADMIN_EMAILS so they can log in immediately
    if (!config.ADMIN_EMAILS.includes(normalEmail)) {
      config.ADMIN_EMAILS.push(normalEmail);
    }

    await logActivity(req.user.id, null, 'admin_created', { new_admin_email: normalEmail, new_admin_name: name.trim() }, req.ip);
    res.json({ data: result.rows[0], message: 'Admin created successfully' });
  } catch (err) {
    if (err.code === '23505') return res.status(409).json({ error: 'Email already exists' });
    console.error('[POST /api/admins]', err.message);
    res.status(500).json({ error: 'Failed to create admin' });
  }
});

// DELETE /api/admins/:id
router.delete('/:id', authMiddleware, async (req, res) => {
  try {
    const adminId = parseInt(req.params.id);
    if (adminId === req.user.id) {
      return res.status(400).json({ error: 'You cannot delete your own account' });
    }

    // Get admin info before deletion (for activity log)
    const admin = (await pool.query('SELECT id, name, email FROM hub_users WHERE id = $1', [adminId])).rows[0];
    if (!admin) return res.status(404).json({ error: 'Admin not found' });

    // Prevent deleting the last admin
    const count = await pool.query('SELECT COUNT(*) FROM hub_users');
    if (parseInt(count.rows[0].count) <= 1) {
      return res.status(400).json({ error: 'Cannot delete the last admin account' });
    }

    await pool.query('DELETE FROM hub_users WHERE id = $1', [adminId]);

    // Remove from runtime ADMIN_EMAILS
    const idx = config.ADMIN_EMAILS.indexOf(admin.email.toLowerCase());
    if (idx > -1) config.ADMIN_EMAILS.splice(idx, 1);

    await logActivity(req.user.id, null, 'admin_deleted', { deleted_admin_id: adminId, deleted_admin_email: admin.email }, req.ip);
    res.json({ message: `Admin ${admin.name} removed` });
  } catch (err) {
    console.error('[DELETE /api/admins/:id]', err.message);
    res.status(500).json({ error: 'Failed to delete admin' });
  }
});

// POST /api/admins/:id/reset-password
router.post('/:id/reset-password', authMiddleware, async (req, res) => {
  try {
    const adminId = parseInt(req.params.id);
    const { password } = req.body;
    if (!password || password.length < 8) {
      return res.status(400).json({ error: 'New password must be at least 8 characters' });
    }

    const admin = (await pool.query('SELECT id, name, email FROM hub_users WHERE id = $1', [adminId])).rows[0];
    if (!admin) return res.status(404).json({ error: 'Admin not found' });

    const hash = await bcrypt.hash(password, 12);
    await pool.query('UPDATE hub_users SET password_hash = $1 WHERE id = $2', [hash, adminId]);

    await logActivity(req.user.id, null, 'admin_password_reset', { target_admin_id: adminId, target_admin_email: admin.email }, req.ip);
    res.json({ message: `Password reset for ${admin.name}` });
  } catch (err) {
    console.error('[POST /api/admins/:id/reset-password]', err.message);
    res.status(500).json({ error: 'Failed to reset password' });
  }
});

module.exports = router;
