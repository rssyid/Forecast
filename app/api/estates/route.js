import { pool } from '@/lib/db';
import { NextResponse } from 'next/server';

export async function GET(request) {
    const { searchParams } = new URL(request.url);
    const company = searchParams.get('company');

    try {
        let query = 'SELECT DISTINCT est_code as code FROM piezometer_data';
        const params = [];

        if (company && company !== 'Semua') {
            query += ' WHERE company_code = $1';
            params.push(company);
        }

        query += ' ORDER BY est_code ASC';

        const res = await pool.query(query, params);
        return NextResponse.json({ estates: res.rows });
    } catch (err) {
        return NextResponse.json({ error: err.message }, { status: 500 });
    }
}
