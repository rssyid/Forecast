/**
 * Script migrasi: tambah kolom company_code ke tabel piezometer_data
 * Jalankan: node scripts/migrate.js
 */
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import pg from 'pg';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// Load .env.local
const envPath = path.join(__dirname, '../.env.local');
if (fs.existsSync(envPath)) {
    fs.readFileSync(envPath, 'utf8').split('\n').forEach(line => {
        const trimmed = line.trim();
        if (trimmed && !trimmed.startsWith('#')) {
            const eqIdx = trimmed.indexOf('=');
            if (eqIdx > 0) {
                const key = trimmed.slice(0, eqIdx).trim();
                let val = trimmed.slice(eqIdx + 1).trim();
                if ((val.startsWith("'") && val.endsWith("'")) || (val.startsWith('"') && val.endsWith('"'))) {
                    val = val.slice(1, -1);
                }
                process.env[key] = process.env[key] || val;
            }
        }
    });
    console.log('✅ .env.local loaded');
}

const { Pool } = pg;
const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: { rejectUnauthorized: false }
});

async function migrate() {
    console.log('Connecting to Neon PostgreSQL...');
    try {
        await pool.query(`
            ALTER TABLE piezometer_data 
            ADD COLUMN IF NOT EXISTS company_code VARCHAR(50);
        `);
        console.log('✅ Migration success: column company_code added (or already exists).');
    } catch (err) {
        console.error('❌ Migration failed:', err.message);
    } finally {
        await pool.end();
        process.exit(0);
    }
}

migrate();
