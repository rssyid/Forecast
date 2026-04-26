import pg from 'pg';
const { Pool } = pg;

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false }
});

async function setup() {
  try {
    console.log("Setting up GIS tables...");
    
    // 1. Create table for geometries
    await pool.query(`
      CREATE TABLE IF NOT EXISTS pzo_geometries (
        pie_record_id TEXT PRIMARY KEY,
        geom JSONB NOT NULL,
        company_code TEXT,
        est_code TEXT,
        updated_at TIMESTAMP DEFAULT NOW()
      );
    `);
    
    // 2. Create index on JSONB for faster access if needed (though PK is usually enough)
    await pool.query(`CREATE INDEX IF NOT EXISTS idx_pzo_geom_company ON pzo_geometries(company_code);`);

    console.log("✅ Success: Table pzo_geometries is ready.");
    
  } catch (e) {
    console.error("❌ Error:", e);
  } finally {
    await pool.end();
  }
}

setup();
