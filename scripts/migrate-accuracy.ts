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

  const backfillRunRes = await pool.query(`
    UPDATE run_meta rm
    SET
      week_name = cw.week_name,
      week_label = cw.formatted_name,
      week_start = cw.start_date,
      week_end = cw.end_date
    FROM calendar_weeks cw
    WHERE rm.week_label IS NULL
      AND rm.period_to >= cw.start_date
      AND rm.period_to <= cw.end_date
  `);

  const backfillCovRes = await pool.query(`
    UPDATE coverage_run cr
    SET
      week_name = rm.week_name,
      week_label = rm.week_label
    FROM run_meta rm
    WHERE cr.run_id = rm.run_id
      AND cr.week_label IS NULL
      AND rm.week_label IS NOT NULL
  `);

  console.log(
    `Migrasi tabel akurasi IoT TMAT selesai. Backfill run_meta=${backfillRunRes.rowCount ?? 0}, coverage_run=${backfillCovRes.rowCount ?? 0}.`
  );
} catch (err) {
  console.error('Gagal menjalankan migrasi tabel akurasi:', err);
  process.exitCode = 1;
} finally {
  await pool.end();
}
