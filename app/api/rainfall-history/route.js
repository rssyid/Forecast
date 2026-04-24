import pg from 'pg';
const { Pool } = pg;

export async function GET(request) {
    const { searchParams } = new URL(request.url);
    const company = searchParams.get('company') || 'Semua';
    const start = searchParams.get('start') || null;
    const end = searchParams.get('end') || null;

    const pool = new Pool({
        connectionString: process.env.DATABASE_URL,
        ssl: { rejectUnauthorized: false }
    });

    try {
        let whereClause = '';
        let params = [];

        if (start && end) {
            whereClause += `WHERE r.record_date BETWEEN $1 AND $2 `;
            params = [start, end];
        }

        if (company !== 'Semua') {
            whereClause += (whereClause ? 'AND ' : 'WHERE ') + `r.company_code = $${params.length + 1} `;
            params.push(company);
        }

        // 1. Summary by Estate
        const summaryRes = await pool.query(`
            SELECT 
                r.est_code, r.company_code,
                ROUND(SUM(r.rainfall_mm)::numeric, 1) AS total_mm,
                ROUND(AVG(r.rainfall_mm)::numeric, 1) AS avg_daily_mm,
                COUNT(CASE WHEN r.rainfall_mm > 0 THEN 1 END)::int AS hari_hujan,
                COUNT(*)::int AS total_hari
            FROM daily_rainfall r
            ${whereClause}
            GROUP BY r.est_code, r.company_code
            ORDER BY total_mm DESC
        `, params);

        // 2. Trend by Date (for chart)
        const trendRes = await pool.query(`
            SELECT 
                r.record_date::text AS date,
                ROUND(AVG(r.rainfall_mm)::numeric, 1) AS avg_mm
            FROM daily_rainfall r
            ${whereClause}
            GROUP BY r.record_date
            ORDER BY r.record_date ASC
        `, params);

        return Response.json({
            summary: summaryRes.rows,
            trend: trendRes.rows
        });

    } catch (err) {
        return Response.json({ error: err.message }, { status: 500 });
    } finally {
        await pool.end();
    }
}
