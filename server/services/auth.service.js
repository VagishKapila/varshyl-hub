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

async function requestPasswordReset(email) {
  const crypto = require('crypto');
  const normalEmail = email.trim().toLowerCase();
  const user = (await pool.query('SELECT * FROM hub_users WHERE email = $1', [normalEmail])).rows[0];
  if (!user) return { message: 'If that email exists, a reset link has been sent.' };
  const token = crypto.randomBytes(32).toString('hex');
  await pool.query(
    "INSERT INTO password_reset_tokens (user_id, token, expires_at) VALUES ($1, $2, NOW() + INTERVAL '1 hour')",
    [user.id, token]
  );
  const resetUrl = `${config.HUB_URL}/?reset_token=${token}`;
  if (config.RESEND_API_KEY) {
    const { Resend } = require('resend');
    const resend = new Resend(config.RESEND_API_KEY);
    await resend.emails.send({
      from: 'onboarding@resend.dev',
      to: normalEmail,
      subject: 'Varshyl Hub — Password Reset',
      html: `<div style="font-family:Inter,sans-serif;max-width:500px;margin:0 auto"><div style="background:#1A0E16;color:#F5E9E0;padding:24px;border-radius:12px 12px 0 0"><h2 style="margin:0;font-size:18px">Varshyl Hub — Password Reset</h2></div><div style="background:#fff;padding:24px;border:1px solid #e8e8f0;border-radius:0 0 12px 12px"><p>Click below to reset your password. Expires in 1 hour.</p><a href="${resetUrl}" style="display:inline-block;background:#E6A96C;color:#0F0A0D;padding:12px 24px;border-radius:8px;font-weight:700;text-decoration:none;margin:16px 0">Reset Password</a><p style="color:#888;font-size:12px">If you didn't request this, ignore this email.</p></div></div>`
    });
  } else {
    console.log('[Password Reset Token DEV]', resetUrl);
  }
  return { message: 'If that email exists, a reset link has been sent.' };
}

async function resetPasswordWithToken(token, newPassword) {
  const row = (await pool.query(
    'SELECT * FROM password_reset_tokens WHERE token = $1 AND used = false AND expires_at > NOW()',
    [token]
  )).rows[0];
  if (!row) throw { status: 400, message: 'Invalid or expired reset token' };
  const hash = await bcrypt.hash(newPassword, 12);
  await pool.query('UPDATE hub_users SET password_hash = $1 WHERE id = $2', [hash, row.user_id]);
  await pool.query('UPDATE password_reset_tokens SET used = true WHERE id = $1', [row.id]);
  await logActivity(row.user_id, null, 'password_reset', {}, null);
  return { message: 'Password reset successfully' };
}

module.exports = { login, setup, requestPasswordReset, resetPasswordWithToken };
