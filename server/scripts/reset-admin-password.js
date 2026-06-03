require('dotenv').config({ path: require('path').join(__dirname, '..', '..', '.env') });
const bcrypt = require('bcryptjs');
const { Pool } = require('pg');

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false },
});

async function resetPassword() {
  const email = 'vaakapila@gmail.com';
  const newPassword = 'VarshylHub2026!';

  const hash = await bcrypt.hash(newPassword, 12);

  const result = await pool.query(
    'UPDATE hub_users SET password_hash = $1 WHERE email = $2 RETURNING id, name, email',
    [hash, email]
  );

  if (result.rows.length === 0) {
    console.log('No user found with that email');
  } else {
    console.log('Password reset for:', result.rows[0]);
    console.log('New password: VarshylHub2026!');
  }

  await pool.end();
}

resetPassword().catch(console.error);
