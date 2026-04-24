import pool from '../../../lib/db.js';

export async function GET(request) {
    try {
        const { searchParams } = new URL(request.url);
        const company = searchParams.get('company');
        const month = searchParams.get('month'); // 1-12
        const year = 2026;

        if (!company || !month) {
            return Response.json({ error: 'Company and Month are required' }, { status: 400 });
        }

        const startDate = `${year}-${month.padStart(2, '0')}-01`;
        const lastDay = new Date(year, month, 0).getDate();
        const endDate = `${year}-${month.padStart(2, '0')}-${lastDay}`;

        const query = `
            SELECT 
                r.est_code, 
                EXTRACT(DAY FROM r.record_date)::int as day,
                ROUND(AVG(r.rainfall_mm)::numeric, 1) as rainfall
            FROM daily_rainfall r
            WHERE r.company_code = $1 
              AND r.record_date >= $2 
              AND r.record_date <= $3
            GROUP BY r.est_code, r.record_date
            ORDER BY r.est_code, r.record_date
        `;

        const { rows } = await pool.query(query, [company, startDate, endDate]);

        // Transform rows into a map for easier frontend consumption
        // { "EST_A": { "1": 10.5, "2": 0, ... }, "EST_B": { ... } }
        const matrix = {};
        rows.forEach(row => {
            if (!matrix[row.est_code]) matrix[row.est_code] = {};
            matrix[row.est_code][row.day] = Number(row.rainfall || 0);
        });

        return Response.json({
            company,
            month,
            year,
            lastDay,
            matrix
        });

    } catch (err) {
        console.error('Error in rainfall-daily API:', err);
        return Response.json({ error: err.message }, { status: 500 });
    }
}
