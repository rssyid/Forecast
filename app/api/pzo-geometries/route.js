import pool from '@/lib/db';
import { NextResponse } from 'next/server';

export async function POST(request) {
    const { searchParams } = new URL(request.url);
    const key = request.headers.get('x-admin-key');
    
    // Auth check
    if (key !== process.env.ADMIN_KEY && key !== 'pzo123') { // Fallback for dev
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    try {
        const geojson = await request.json();
        
        if (!geojson.features || !Array.isArray(geojson.features)) {
            throw new Error("Invalid GeoJSON: 'features' array not found.");
        }

        const client = await pool.connect();
        try {
            await client.query('BEGIN');
            
            // Clear existing if clear=true
            if (searchParams.get('clear') === 'true') {
                await client.query('DELETE FROM pzo_geometries');
            }

            for (const feature of geojson.features) {
                const pieId = feature.properties.PieRecordID || feature.properties.pie_record_id;
                if (!pieId) continue;

                // Strip properties for storage to save space, keep only geom
                const geometry = feature.geometry;
                const company = feature.properties.CompanyCode || feature.properties.company_code || '';
                const estate = feature.properties.EstCode || feature.properties.est_code || '';

                await client.query(`
                    INSERT INTO pzo_geometries (pie_record_id, geom, company_code, est_code, updated_at)
                    VALUES ($1, $2, $3, $4, NOW())
                    ON CONFLICT (pie_record_id) DO UPDATE SET 
                        geom = EXCLUDED.geom,
                        company_code = EXCLUDED.company_code,
                        est_code = EXCLUDED.est_code,
                        updated_at = NOW();
                `, [pieId, JSON.stringify(geometry), company, estate]);
            }

            await client.query('COMMIT');
            return NextResponse.json({ success: true, count: geojson.features.length });
        } catch (e) {
            await client.query('ROLLBACK');
            throw e;
        } finally {
            client.release();
        }
    } catch (err) {
        return NextResponse.json({ error: err.message }, { status: 500 });
    }
}
