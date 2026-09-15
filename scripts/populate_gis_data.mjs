// scripts/populate_gis_data.mjs (artifact copy)
import dotenv from 'dotenv';
import pg from 'pg';
import { syncGisComparisonForWeek } from '../lib/gisService.js';

dotenv.config({ path: './.env.local' });

const { Pool } = pg;
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

(async () => {
  const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: { rejectUnauthorized: false },
  });
  try {
    console.log('🚀 Starting GIS bulk‑populate');
    const compRes = await pool.query(`SELECT code, name FROM companies WHERE "isActive" = true ORDER BY code`);
    const companies = compRes.rows;
    console.log(`✅ Loaded ${companies.length} active companies`);
    const weeksRes = await pool.query(
      `SELECT id, gis_week_id, formatted_name, start_date, end_date FROM calendar_weeks WHERE start_date >= $1 ORDER BY start_date ASC`,
      ['2026-01-01']
    );
    const weeks = weeksRes.rows;
    if (!weeks.length) { console.warn('⚠️ No weeks found after 2026‑01‑01 – exiting'); return; }
    console.log(`✅ Found ${weeks.length} weeks to process`);
    for (let i = 0; i < weeks.length; i++) {
      const w = weeks[i];
      const gisWeekId = w.gis_week_id ?? w.id + 434;
      console.log(`\n🔹 [${i + 1}/${weeks.length}] Sync week "${w.formatted_name}" (GIS ID ${gisWeekId})`);
      try {
        await syncGisComparisonForWeek(gisWeekId, companies);
        console.log('   ✅ Success');
      } catch (e) {
        console.error('   ❌ Error syncing week:', e.message || e);
      }
      await sleep(800);
    }
    console.log('\n🎉 Finished – all weeks processed');
  } catch (e) {
    console.error('💥 Unexpected failure:', e);
  } finally {
    await pool.end();
    console.log('🔚 Database connection closed');
  }
})();
