import pool from '../../../lib/db.js';

function formatDate(val) {
    if (!val) return val;
    if (val instanceof Date) {
        const year = val.getFullYear();
        const month = String(val.getMonth() + 1).padStart(2, '0');
        const day = String(val.getDate()).padStart(2, '0');
        return `${year}-${month}-${day}`;
    }
    return String(val).split('T')[0];
}

export async function GET() {
    try {
        const query = `
            SELECT forecast_date, feature_count, created_at 
            FROM ecmwf_forecast_data 
            ORDER BY forecast_date DESC
        `;
        const { rows } = await pool.query(query);

        return Response.json({
            dates: rows.map((r) => ({
                date: formatDate(r.forecast_date),
                feature_count: r.feature_count,
                created_at: r.created_at
            }))
        });
    } catch (err) {
        console.error('Error in GET /api/ecmwf-dates:', err);
        return Response.json({ error: err.message }, { status: 500 });
    }
}
