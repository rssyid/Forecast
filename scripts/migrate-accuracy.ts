import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import dotenv from 'dotenv';
import pg from 'pg';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const envLocalPath = path.resolve(__dirname, '..', '.env.local');
if (!process.env.DATABASE_URL && fs.existsSync(envLocalPath)) {
  dotenv.config({ path: envLocalPath });
}

if (!process.env.DATABASE_URL) {
  console.error('DATABASE_URL tidak ditemukan pada environment atau .env.local.');
  process.exit(1);
}

const sqlPath = path.join(__dirname, 'create_accuracy_tables.sql');
const sql = fs.readFileSync(sqlPath, 'utf8');

const pool = new pg.Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false },
});

try {
  await pool.query(sql);
  console.log('Migrasi tabel akurasi IoT TMAT selesai.');
} catch (err) {
  console.error('Gagal menjalankan migrasi tabel akurasi:', err);
  process.exitCode = 1;
} finally {
  await pool.end();
}
