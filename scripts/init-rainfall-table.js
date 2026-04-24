import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// Load .env.local manually for standalone execution
const envPath = path.join(__dirname, '..', '.env.local');
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

async function init() {
    const { default: pool } = await import('../lib/db.js');
    
    console.log('🏗️  Initializing daily_rainfall table...');
    
    try {
        await pool.query(`
            CREATE TABLE IF NOT EXISTS daily_rainfall (
                id SERIAL PRIMARY KEY,
                company_code VARCHAR(50),
                est_code VARCHAR(50),
                station_id VARCHAR(100),
                location VARCHAR(255),
                record_date DATE,
                rainfall_mm NUMERIC,
                updated_at TIMESTAMP DEFAULT NOW(),
                UNIQUE(station_id, record_date)
            );
        `);
        console.log('✅ Table daily_rainfall is ready.');
    } catch (err) {
        console.error('❌ Error creating table:', err.message);
    } finally {
        await pool.end();
    }
}

init();
