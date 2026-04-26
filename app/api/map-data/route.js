import pool from '../../../lib/db';
import { NextResponse } from 'next/server';

export async function GET(request) {
    const { searchParams } = new URL(request.url);
    const company = searchParams.get('company') || 'Semua';

    try {
        let whereClause = '';
        const params = [];
        if (company !== 'Semua') {
            whereClause = ` WHERE g.company_code = $1`;
            params.push(company);
        }

        const query = `
            WITH latest_pzo AS (
                SELECT DISTINCT ON (pie_record_id) 
                    pie_record_id, 
                    ketinggian, 
                    indicator_alias,
                    date_timestamp
                FROM piezometer_data
                ORDER BY pie_record_id, date_timestamp DESC
            )
            SELECT 
                g.pie_record_id,
                g.geom,
                g.company_code,
                g.est_code,
                p.ketinggian as tmat,
                p.indicator_alias as status,
                p.date_timestamp
            FROM pzo_geometries g
            LEFT JOIN latest_pzo p ON g.pie_record_id = p.pie_record_id
            ${whereClause}
        `;

        const res = await pool.query(query, params);
        
        // Construct FeatureCollection
        const features = res.rows.map(row => ({
            type: 'Feature',
            geometry: row.geom,
            properties: {
                pie_record_id: row.pie_record_id,
                company_code: row.company_code,
                est_code: row.est_code,
                tmat: row.tmat,
                status: row.status,
                last_update: row.date_timestamp ? new Date(parseInt(row.date_timestamp)).toLocaleString('id-ID') : 'No Data'
            }
        }));

        return NextResponse.json({
            type: 'FeatureCollection',
            features
        });
    } catch (err) {
        return NextResponse.json({ error: err.message }, { status: 500 });
    }
}
