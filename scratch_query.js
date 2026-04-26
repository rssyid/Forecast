import pool from './lib/db.js';

async function run() {
  const res = await pool.query(`
    SELECT table_name, column_name, data_type 
    FROM information_schema.columns 
    WHERE table_schema = 'public' 
    AND table_name IN ('piezometer_data', 'daily_rainfall', 'estates', 'blocks');
  `);
  console.log(JSON.stringify(res.rows, null, 2));
  process.exit(0);
}
run();
