import pg from 'pg';
const { Pool } = pg;
import { NextResponse } from 'next/server';

export async function GET(request) {
    const pool = new Pool({
        connectionString: process.env.DATABASE_URL,
        ssl: { rejectUnauthorized: false }
    });
    try {
        const { searchParams } = new URL(request.url);
        const onlyActive = searchParams.get('active') === 'true';

        // 1. Query
        const query = onlyActive 
            ? 'SELECT code FROM companies WHERE "isActive" = true ORDER BY code ASC'
            : 'SELECT code, "isActive" FROM companies ORDER BY code ASC';
        
        const { rows } = await pool.query(query);
        
        // Map "isActive" back to the expected "is_active" for frontend compatibility if needed, 
        // but DashboardClient just checks `json.companies` so returning as is or mapped is fine.
        // Let's map it so the frontend doesn't need to change its property access.
        const mappedRows = rows.map(r => ({
            code: r.code,
            is_active: r.isActive
        }));

        return NextResponse.json({ companies: mappedRows });

    } catch (err) {
        console.error('Error in companies API:', err);
        return NextResponse.json({ error: err.message, stack: err.stack }, { status: 500 });
    } finally {
        await pool.end();
    }
}

export async function PATCH(request) {
    // Security: Check for ADMIN_KEY
    const adminKey = process.env.ADMIN_KEY;
    if (adminKey) {
        const providedKey = request.headers.get('x-admin-key');
        if (providedKey !== adminKey) {
            return NextResponse.json({ error: 'Otentikasi gagal: Admin Key tidak valid.' }, { status: 401 });
        }
    }

    const pool = new Pool({
        connectionString: process.env.DATABASE_URL,
        ssl: { rejectUnauthorized: false }
    });
    try {
        const { code, is_active } = await request.json();
        
        if (!code) {
            return NextResponse.json({ error: 'Company code is required' }, { status: 400 });
        }

        await pool.query(
            'UPDATE companies SET "isActive" = $1 WHERE code = $2',
            [is_active, code]
        );

        return NextResponse.json({ success: true, code, is_active });

    } catch (err) {
        console.error('Error updating company status:', err);
        return NextResponse.json({ error: err.message }, { status: 500 });
    } finally {
        await pool.end();
    }
}
