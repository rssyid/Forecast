import pool from '../../../lib/db';
import { NextResponse } from 'next/server';

export async function GET(request) {
    const { searchParams } = new URL(request.url);
    const company = searchParams.get('company') || 'Semua';
    const week = searchParams.get('week') || '';

    try {
        const params = [];
        let pzoFilter = '';
        
        if (week) {
            pzoFilter = `WHERE month_name = $${params.length + 1}`;
            params.push(week);
        }

        let companyFilter = '';
        if (company !== 'Semua') {
            companyFilter = `WHERE g.company_code = $${params.length + 1}`;
            params.push(company);
        }

        const query = `
            WITH pzo_stats AS (
                SELECT 
                    pie_record_id, 
                    ROUND(AVG(ketinggian)::numeric, 1) as avg_tmat,
                    MODE() WITHIN GROUP (ORDER BY indicator_alias) as mode_status,
                    MAX(date_timestamp) as latest_ts
                FROM piezometer_data
                ${pzoFilter}
                GROUP BY pie_record_id
            )
            SELECT 
                g.pie_record_id,
                g.geom,
                g.company_code,
                g.est_code,
                p.avg_tmat as tmat,
                p.mode_status as status,
                p.latest_ts
            FROM pzo_geometries g
            LEFT JOIN pzo_stats p ON g.pie_record_id = p.pie_record_id
            ${companyFilter}
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
