import fs from 'node:fs';
import path from 'node:path';
import dotenv from 'dotenv';
import pg from 'pg';
import { runRecentSync } from '../lib/syncRecentData.js';

const { Pool } = pg;

const envLocalPath = path.resolve(process.cwd(), '.env.local');
if (fs.existsSync(envLocalPath)) {
    dotenv.config({ path: envLocalPath });
} else {
    dotenv.config();
}

async function main() {
    if (!process.env.DATABASE_URL) {
        throw new Error('DATABASE_URL environment variable is required.');
    }

    const pool = new Pool({
        connectionString: process.env.DATABASE_URL,
        ssl: { rejectUnauthorized: false }
    });

    const startedAt = Date.now();
    try {
        console.log('🚀 Memulai Update Data Piezometer & Rainfall...');
        const result = await runRecentSync((msg) => console.log(msg), pool);
        const elapsedSec = ((Date.now() - startedAt) / 1000).toFixed(1);
        console.log(
            `\n🎉 SELESAI dalam ${elapsedSec}s! Unit aktif: ${result.companiesCount} | Pzo: ${result.pTotal} | Rain: ${result.rTotal}`
        );

        if (result.failedCompanies.length > 0) {
            console.warn(`⚠️ ${result.failedCompanies.length} request gagal:`, result.failedCompanies);
        }
    } finally {
        await pool.end();
    }
}

main().catch((err) => {
    console.error('❌ Fatal error during recent sync:', err);
    process.exit(1);
});
