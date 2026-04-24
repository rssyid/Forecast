import pool from '../../../lib/db.js';
import { NextResponse } from 'next/server';

const DEFAULT_COMPANIES = [
    'PT.THIP', 'PT.PTW', 'PT.SUMS', 'PT.WKN', 'PT.PANPS', 
    'PT.SAM', 'PT.NJP', 'PT.PLDK', 'PT.SUMK', 'PT.BAS', 
    'PT.AAN', 'PT.GAN', 'PT.AJP', 'PT.JJP', 'PT.SIP', 'PT.WSM'
];

export async function GET(request) {
    try {
        const { searchParams } = new URL(request.url);
        const onlyActive = searchParams.get('active') === 'true';

        // 1. Ensure table exists
        await pool.query(`
            CREATE TABLE IF NOT EXISTS companies (
                code TEXT PRIMARY KEY,
                is_active BOOLEAN DEFAULT true,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            )
        `);

        // 2. Check if empty, then seed
        const checkRes = await pool.query('SELECT COUNT(*) FROM companies');
        if (parseInt(checkRes.rows[0].count) === 0) {
            console.log('Seeding default companies...');
            for (const code of DEFAULT_COMPANIES) {
                await pool.query('INSERT INTO companies (code, is_active) VALUES ($1, true) ON CONFLICT DO NOTHING', [code]);
            }
        }

        // 3. Query
        const query = onlyActive 
            ? 'SELECT code FROM companies WHERE is_active = true ORDER BY code ASC'
            : 'SELECT code, is_active FROM companies ORDER BY code ASC';
        
        const { rows } = await pool.query(query);
        
        return NextResponse.json({ companies: rows });

    } catch (err) {
        console.error('Error in companies API:', err);
        return NextResponse.json({ error: err.message, stack: err.stack }, { status: 500 });
    }
}

export async function PATCH(request) {
    try {
        const { code, is_active } = await request.json();
        
        if (!code) {
            return NextResponse.json({ error: 'Company code is required' }, { status: 400 });
        }

        await pool.query(
            'UPDATE companies SET is_active = $1 WHERE code = $2',
            [is_active, code]
        );

        return NextResponse.json({ success: true, code, is_active });

    } catch (err) {
        console.error('Error updating company status:', err);
        return NextResponse.json({ error: err.message }, { status: 500 });
    }
}
