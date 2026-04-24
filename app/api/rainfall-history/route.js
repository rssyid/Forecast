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

        // 1. Summary by Estate (Filtered) - Group by Estate and Date first to average stations
        const summaryRes = await pool.query(`
            WITH daily_estate_avg AS (
                SELECT 
                    r.est_code, r.company_code, r.record_date,
                    AVG(r.rainfall_mm) as avg_rain
                FROM daily_rainfall r
                ${whereClause}
                GROUP BY r.est_code, r.company_code, r.record_date
            )
            SELECT 
                est_code, company_code,
                ROUND(SUM(avg_rain)::numeric, 1) AS total_mm,
                ROUND(AVG(avg_rain)::numeric, 1) AS avg_daily_mm,
                COUNT(CASE WHEN avg_rain > 0 THEN 1 END)::int AS hari_hujan,
                COUNT(*)::int AS total_hari
            FROM daily_estate_avg
            GROUP BY est_code, company_code
            ORDER BY total_mm DESC
        `, params);

        // 2. Filtered Trend (for line chart) - Averaging across estates
        const filterTrendRes = await pool.query(`
            WITH daily_estate_avg AS (
                SELECT r.record_date, r.est_code, AVG(r.rainfall_mm) as avg_rain
                FROM daily_rainfall r
                ${whereClause}
                GROUP BY r.record_date, r.est_code
            )
            SELECT 
                record_date::text AS date,
                ROUND(AVG(avg_rain)::numeric, 1) AS avg_mm
            FROM daily_estate_avg
            GROUP BY record_date
            ORDER BY record_date ASC
        `, params);

        // 3. Year-to-date Trend (for Calendar Heatmap)
        const hmCompany = searchParams.get('hmCompany') || 'Semua';
        const hmEstate = searchParams.get('hmEstate') || 'Semua';

        const currentYear = new Date().getFullYear();
        let yearWhere = `WHERE r.record_date >= '${currentYear}-01-01' AND r.record_date <= '${currentYear}-12-31' `;
        let yearParams = [];

        if (hmCompany !== 'Semua') {
            yearWhere += `AND r.company_code = $${yearParams.length + 1} `;
            yearParams.push(hmCompany);
        }
        if (hmEstate !== 'Semua') {
            yearWhere += `AND r.est_code = $${yearParams.length + 1} `;
            yearParams.push(hmEstate);
        }

        const yearTrendRes = await pool.query(`
            WITH daily_estate_avg AS (
                SELECT r.record_date, r.est_code, AVG(r.rainfall_mm) as avg_rain
                FROM daily_rainfall r
                ${yearWhere}
                GROUP BY r.record_date, r.est_code
            )
            SELECT 
                record_date::text AS date,
                ROUND(AVG(avg_rain)::numeric, 1) AS avg_mm
            FROM daily_estate_avg
            GROUP BY record_date
            ORDER BY record_date ASC
        `, yearParams);

        return Response.json({
            summary: summaryRes.rows,
            trend: filterTrendRes.rows,
            yearTrend: yearTrendRes.rows
        });

    } catch (err) {
        return Response.json({ error: err.message }, { status: 500 });
    } finally {
        await pool.end();
    }
}
