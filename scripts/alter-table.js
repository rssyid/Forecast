import pool from '../lib/db.js';

async function main() {
    try {
        await pool.query(`ALTER TABLE public.piezometer_data ADD COLUMN IF NOT EXISTS company_code VARCHAR(50);`);
        console.log("Success adding company_code to piezometer_data");
    } catch(err) {
        console.error("Error altering table:", err);
    }
    process.exit(0);
}

main();
