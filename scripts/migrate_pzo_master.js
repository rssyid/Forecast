import pg from 'pg';
const { Pool } = pg;
import dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false }
});

async function migrate() {
  try {
    console.log('Creating pzo_master_mapping table...');
    await pool.query(`
      CREATE TABLE IF NOT EXISTS pzo_master_mapping (
          id SERIAL PRIMARY KEY,
          pie_record_id TEXT NOT NULL,
          block_id TEXT NOT NULL,
          company_code TEXT,
          est_code TEXT,
          is_active BOOLEAN DEFAULT TRUE,
          device_name_iot TEXT,
          UNIQUE(pie_record_id, block_id)
      );
    `);
    console.log('Table created successfully.');

    // Sample data provided by user
    const sampleData = [
      {
        "EstCode": "MER",
        "pie_record_id": "MER-01",
        "IsActive": true,
        "Mapping": "73-00",
        "deviceNameIOT": null,
        "EstNewCode": "THP1"
      },
      {
        "EstCode": "MER",
        "pie_record_id": "MER-02",
        "IsActive": true,
        "Mapping": "73-01",
        "deviceNameIOT": null,
        "EstNewCode": "THP1"
      },
      {
        "EstCode": "MER",
        "pie_record_id": "MER-03",
        "IsActive": true,
        "Mapping": "73-02",
        "deviceNameIOT": "TH-MER-7302-T-HK037-AWL",
        "EstNewCode": "THP1"
      }
    ];

    console.log('Seeding sample data...');
    for (const item of sampleData) {
      const blocks = item.Mapping.split(',').map(b => b.trim());
      for (const block of blocks) {
        if (!block) continue;
        await pool.query(`
          INSERT INTO pzo_master_mapping (pie_record_id, block_id, company_code, est_code, is_active, device_name_iot)
          VALUES ($1, $2, $3, $4, $5, $6)
          ON CONFLICT (pie_record_id, block_id) DO NOTHING
        `, [
          item.pie_record_id, 
          block, 
          item.EstNewCode, // Using EstNewCode as company code placeholder if that's the mapping
          item.EstCode, 
          item.IsActive, 
          item.deviceNameIOT
        ]);
      }
    }
    console.log('Seeding completed.');

  } catch (err) {
    console.error('Migration failed:', err);
  } finally {
    await pool.end();
  }
}

migrate();
