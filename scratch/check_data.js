import pg from 'pg';
const { Pool } = pg;
const pool = new Pool({ connectionString: process.env.DATABASE_URL, ssl: { rejectUnauthorized: false } });

async function check() {
  try {
    const pzo = await pool.query("SELECT DISTINCT est_code FROM piezometer_data WHERE company_code = 'PT.GAN' LIMIT 10");
    const rain = await pool.query("SELECT DISTINCT est_code FROM daily_rainfall WHERE company_code = 'PT.GAN' LIMIT 10");
    console.log("PZO Estates:", pzo.rows.map(r => `"${r.est_code}"`));
    console.log("RAIN Estates:", rain.rows.map(r => `"${r.est_code}"`));
    
    const count = await pool.query("SELECT COUNT(*) FROM piezometer_data p JOIN daily_rainfall r ON split_part(p.est_code, ' - ', 1) = split_part(r.est_code, ' - ', 1) AND date_trunc('day', p.date_timestamp)::date = r.record_date WHERE p.company_code = 'PT.GAN'");
    console.log("Joined Count:", count.rows[0].count);

  } catch (e) {
    console.error(e);
  }
  process.exit(0);
}
check();
