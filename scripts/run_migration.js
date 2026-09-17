import pg from 'pg';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// Load .env.local
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
}

const pool = new pg.Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: { rejectUnauthorized: false }
});

const sql = fs.readFileSync(path.join(__dirname, 'create_ecmwf_table.sql'), 'utf8');

try {
    await pool.query(sql);
    console.log('✅ Table ecmwf_forecast_data created successfully');
} catch (err) {
    console.error('❌ Error:', err.message);
} finally {
    await pool.end();
}
