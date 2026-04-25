import pool from '../../../lib/db.js';
import { NextResponse } from 'next/server';

export async function GET() {
    try {
        const res = await pool.query('SELECT NOW()');
        return NextResponse.json({ 
            status: 'ok', 
            time: res.rows[0].now,
            env: {
                has_db_url: !!process.env.DATABASE_URL
            }
        });
    } catch (err) {
        return NextResponse.json({ 
            status: 'error', 
            message: err.message,
            stack: err.stack
        }, { status: 500 });
    }
}
