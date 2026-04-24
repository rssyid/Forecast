import pkg from 'pg';
const { Pool } = pkg;
import dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false }
});

try {
  const companiesRes = await pool.query(`
    SELECT DISTINCT company_code 
    FROM (
      SELECT company_code FROM piezometer_data
      UNION
      SELECT company_code FROM daily_rainfall
    ) as combined
    WHERE company_code IS NOT NULL
  `);
  
  const estatesRes = await pool.query(`
    SELECT DISTINCT company_code, est_code 
    FROM (
      SELECT company_code, est_code FROM piezometer_data
      UNION
      SELECT company_code, est_code FROM daily_rainfall
    ) as combined
    WHERE est_code IS NOT NULL AND company_code IS NOT NULL
  `);

  console.log('Companies:', companiesRes.rows.length);
  console.log('Estates:', estatesRes.rows.length);

  // Let's seed the tables
  console.log('Clearing existing dummy data (cascading)...');
  
  // Clean up existing dummy data using TRUNCATE CASCADE to handle foreign keys
  await pool.query('TRUNCATE TABLE companies CASCADE');

  console.log('Inserting real data...');

  // Insert Companies
  for (const row of companiesRes.rows) {
    const code = row.company_code;
    const name = code.replace('.', '. '); // E.g., PT.THIP -> PT. THIP
    await pool.query(`
      INSERT INTO companies (id, code, name, "isActive", "createdAt", "updatedAt")
      VALUES ($1, $2, $3, true, NOW(), NOW())
    `, [code, code, name]);
  }

  // Insert Estates
  for (const row of estatesRes.rows) {
    const estCode = row.est_code;
    const compCode = row.company_code;
    const id = `${compCode}_${estCode}`;
    await pool.query(`
      INSERT INTO estates (id, code, name, "companyId", "isActive", "createdAt", "updatedAt")
      VALUES ($1, $2, $3, $4, true, NOW(), NOW())
    `, [id, estCode, estCode, compCode]);
  }

  console.log('Successfully seeded real data from piezometer_data and daily_rainfall!');

} catch (err) {
  console.error('DB Error:', err.message);
} finally {
  await pool.end();
}
