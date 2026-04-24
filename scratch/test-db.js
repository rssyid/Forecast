import pkg from 'pg';
const { Pool } = pkg;
import dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false }
});

try {
  const res = await pool.query('SELECT NOW()');
  console.log('DB OK:', res.rows[0].now);
} catch (err) {
  console.error('DB Error:', err.message);
} finally {
  await pool.end();
}
