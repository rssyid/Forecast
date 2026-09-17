import pool from '../../../lib/db.js';

export async function GET(request) {
    try {
        const { searchParams } = new URL(request.url);
        const date = searchParams.get('date');

        if (!date) {
            return Response.json({ error: 'Date query parameter is required (YYYY-MM-DD)' }, { status: 400 });
        }

        const query = `
            SELECT forecast_date, geojson_data, feature_count, created_at 
            FROM ecmwf_forecast_data 
            WHERE forecast_date = $1
        `;
        const { rows } = await pool.query(query, [date]);

        if (rows.length === 0) {
            return Response.json({ found: false });
        }

        const row = rows[0];
        return Response.json({
            found: true,
            date,
            geojson: row.geojson_data,
            feature_count: row.feature_count,
            created_at: row.created_at
        });
    } catch (err) {
        console.error('Error in GET /api/ecmwf-forecast:', err);
        return Response.json({ error: err.message }, { status: 500 });
    }
}

export async function POST(request) {
    try {
        const apiKey = request.headers.get('x-api-key');
        if (!process.env.ECMWF_API_SECRET || apiKey !== process.env.ECMWF_API_SECRET) {
            return Response.json({ error: 'Unauthorized' }, { status: 401 });
        }

        const body = await request.json();
        const { date, geojson, processing_time_sec } = body;

        if (!date) {
            return Response.json({ error: 'Date is required' }, { status: 400 });
        }

        // Validate that date is a Wednesday (new Date(date).getUTCDay() === 3)
        const parsedDate = new Date(date);
        if (isNaN(parsedDate.getTime()) || parsedDate.getUTCDay() !== 3) {
            return Response.json({ error: 'Forecast date must be a Wednesday' }, { status: 400 });
        }

        if (!geojson) {
            return Response.json({ error: 'GeoJSON data is required' }, { status: 400 });
        }

        let featureCount = 0;
        let geojsonPayload = geojson;

        if (typeof geojson === 'string') {
            try {
                const parsed = JSON.parse(geojson);
                featureCount = parsed?.features?.length || 0;
            } catch {
                featureCount = 0;
            }
        } else {
            featureCount = geojson?.features?.length || 0;
            geojsonPayload = JSON.stringify(geojson);
        }

        const upsertQuery = `
            INSERT INTO ecmwf_forecast_data (forecast_date, geojson_data, feature_count, processing_time_sec)
            VALUES ($1, $2, $3, $4)
            ON CONFLICT (forecast_date)
            DO UPDATE SET 
                geojson_data = $2, 
                feature_count = $3, 
                processing_time_sec = $4, 
                created_at = NOW()
        `;

        await pool.query(upsertQuery, [
            date,
            geojsonPayload,
            featureCount,
            processing_time_sec !== undefined ? processing_time_sec : null
        ]);

        return Response.json({
            success: true,
            date,
            feature_count: featureCount
        });
    } catch (err) {
        console.error('Error in POST /api/ecmwf-forecast:', err);
        return Response.json({ error: err.message }, { status: 500 });
    }
}
