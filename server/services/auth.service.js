const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { pool } = require('../db/pool');
const config = require('../config/env');
const { logActivity } = require('./activity.service');

async function login(email, password, ip) {
  try {
    const normalEmail = email.trim().toLowerCase();
    
    // Check if email is in admin list
    if (!config.ADMIN_EMAILS.includes(normalEmail)) {
      throw { status: 403, message: 'Access restricted to admin accounts' };
    }

    const result = await pool.query('SELECT * FROM hub_users WHERE email = $1', [normalEmail]);
    if (result.rows.length === 0) {
      throw { status: 401, message: 'Invalid credentials' };
    }

    const user = result.rows[0];
    const valid = await bcrypt.compare(password, user.password_hash);
    if (!valid) {
      throw { status: 401, message: 'Invalid credentials' };
    }

    // Update last login
    await pool.query('UPDATE hub_users SET last_login = NOW() WHERE id = $1', [user.id]);

    const token = jwt.sign(
      { id: user.id, email: user.email, name: user.name },
      config.JWT_SECRET,
      { expiresIn: '7d' }
    );

    await logActivity(user.id, null, 'login', {}, ip);

    return {
      token,
      user: { id: user.id, name: user.name, email: user.email }
    };
  } catch (err) {
    if (err.status) throw err;
    throw { status: 500, message: 'Login failed: ' + err.message };
  }
}

async function setup(name, email, password, ip) {
  try {
    const existing = await pool.query('SELECT COUNT(*) FROM hub_users');
    if (parseInt(existing.rows[0].count) > 0) {
      throw { status: 403, message: 'Setup already complete. Use /api/auth/login.' };
    }

    if (!name || !email || !password) {
      throw { status: 400, message: 'Name, email, and password required' };
    }
    if (password.length < 8) {
      throw { status: 400, message: 'Password must be at least 8 characters' };
    }

    const normalEmail = email.trim().toLowerCase();
    if (!config.ADMIN_EMAILS.includes(normalEmail)) {
      throw { status: 403, message: 'This email is not in the ADMIN_EMAILS list' };
    }

    const hash = await bcrypt.hash(password, 12);
    const result = await pool.query(
      'INSERT INTO hub_users(name, email, password_hash) VALUES($1, $2, $3) RETURNING id, name, email',
      [name.trim(), normalEmail, hash]
    );

    const user = result.rows[0];
    const token = jwt.sign(
      { id: user.id, email: user.email, name: user.name },
      config.JWT_SECRET,
      { expiresIn: '7d' }
    );

    await logActivity(user.id, null, 'setup', {}, ip);

    return { token, user };
  } catch (err) {
    if (err.status) throw err;
    throw { status: 500, message: 'Setup failed: ' + err.message };
  }
}

module.exports = { login, setup };
