import pg from 'pg';
const { Pool } = pg;

const WEEK_LIMIT = 8;

export async function GET(request) {
    const { searchParams } = new URL(request.url);
    const companyFilter = searchParams.get('company') || 'Semua';
    const weekFilter = searchParams.get('week') || null;

    const pool = new Pool({
        connectionString: process.env.DATABASE_URL,
        ssl: { rejectUnauthorized: false }
    });

    try {
        const companyWhere = companyFilter !== 'Semua' ? `AND p.company_code = $1` : '';
        const queryParams = companyFilter !== 'Semua' ? [companyFilter] : [];

        // 1. Resolve anchor week start_date from calendar_weeks
        let anchorStartDate = null;
        if (weekFilter) {
            const anchorRes = await pool.query(
                `SELECT start_date::text FROM calendar_weeks WHERE formatted_name = $1 LIMIT 1`,
                [weekFilter]
            );
            anchorStartDate = anchorRes.rows[0]?.start_date || null;
        }

        // 2. Get WEEK_LIMIT weeks of TMAT data ending at/before selected week
        const weekCondition = anchorStartDate
            ? `AND cw.start_date <= $${queryParams.length + 1}`
            : '';
        const weekParams = anchorStartDate ? [...queryParams, anchorStartDate] : queryParams;

        const weeklyQ = `
            SELECT 
                p.month_name AS week,
                COUNT(*)::int AS total,
                ROUND(AVG(p.ketinggian)::numeric, 1) AS avg_tmat,
                SUM(CASE WHEN p.ketinggian < 0 THEN 1 ELSE 0 END)::int AS cnt_banjir,
                SUM(CASE WHEN p.ketinggian BETWEEN 0 AND 40 THEN 1 ELSE 0 END)::int AS cnt_tergenang,
                SUM(CASE WHEN p.ketinggian BETWEEN 41 AND 45 THEN 1 ELSE 0 END)::int AS cnt_a_tergenang,
                SUM(CASE WHEN p.ketinggian BETWEEN 46 AND 60 THEN 1 ELSE 0 END)::int AS cnt_normal,
                SUM(CASE WHEN p.ketinggian BETWEEN 61 AND 65 THEN 1 ELSE 0 END)::int AS cnt_a_kering,
                SUM(CASE WHEN p.ketinggian > 65 THEN 1 ELSE 0 END)::int AS cnt_kering,
                MIN(cw.start_date)::text AS week_start,
                MAX(cw.end_date)::text AS week_end
            FROM piezometer_data p
            LEFT JOIN calendar_weeks cw ON cw.formatted_name = p.month_name
            WHERE p.ketinggian IS NOT NULL ${companyWhere} ${weekCondition}
            GROUP BY p.month_name
            ORDER BY MIN(cw.start_date) DESC NULLS LAST
            LIMIT ${WEEK_LIMIT}
        `;
        const weeklyRes = await pool.query(weeklyQ, weekParams);
        const weeklyData = weeklyRes.rows.reverse();

        const currentWeek = weeklyData.length > 0 ? weeklyData[weeklyData.length - 1] : null;
        const prevWeek = weeklyData.length > 1 ? weeklyData[weeklyData.length - 2] : null;

        // 3. Estate breakdown for anchor week
        const selectedWeekName = currentWeek?.week || null;
        let estateBreakdown = [];
        if (selectedWeekName) {
            const estP = companyFilter !== 'Semua' ? [companyFilter, selectedWeekName] : [selectedWeekName];
            const estateRes = await pool.query(`
                SELECT 
                    p.est_code AS estate, p.company_code AS company,
                    COUNT(*)::int AS total,
                    SUM(CASE WHEN p.ketinggian > 65 THEN 1 ELSE 0 END)::int AS cnt_kering,
                    SUM(CASE WHEN p.ketinggian <= 45 THEN 1 ELSE 0 END)::int AS cnt_basah,
                    ROUND(AVG(p.ketinggian)::numeric, 1) AS avg_tmat
                FROM piezometer_data p
                WHERE p.month_name = $${companyFilter !== 'Semua' ? 2 : 1}
                ${companyFilter !== 'Semua' ? 'AND p.company_code = $1' : ''}
                GROUP BY p.est_code, p.company_code
                ORDER BY cnt_kering DESC
                LIMIT 10
            `, estP);
            estateBreakdown = estateRes.rows;
        }

        // 4. Rainfall for same calendar week period
        const rainStart = currentWeek?.week_start || null;
        const rainEnd = currentWeek?.week_end || null;
        let rainfallData = [];

        if (rainStart && rainEnd) {
            const rainCompanyWhere = companyFilter !== 'Semua' ? 'AND r.company_code = $3' : '';
            const rainParams = companyFilter !== 'Semua'
                ? [rainStart, rainEnd, companyFilter]
                : [rainStart, rainEnd];

            const rainRes = await pool.query(`
                SELECT 
                    r.est_code, r.company_code,
                    ROUND(SUM(r.rainfall_mm)::numeric, 1) AS total_mm,
                    ROUND(AVG(r.rainfall_mm)::numeric, 1) AS avg_daily_mm,
                    COUNT(CASE WHEN r.rainfall_mm > 0 THEN 1 END)::int AS hari_hujan,
                    COUNT(*)::int AS total_hari,
                    MIN(r.record_date)::text AS week_start,
                    MAX(r.record_date)::text AS week_end
                FROM daily_rainfall r
                WHERE r.record_date BETWEEN $1 AND $2 ${rainCompanyWhere}
                GROUP BY r.est_code, r.company_code
                ORDER BY total_mm DESC
                LIMIT 10
            `, rainParams);
            rainfallData = rainRes.rows;
        }

        // 5. DB sync status
        const syncRes = await pool.query(`
            SELECT COUNT(*)::int AS total_records,
                   COUNT(DISTINCT company_code)::int AS total_companies,
                   COUNT(DISTINCT est_code)::int AS total_estates
            FROM piezometer_data
            ${companyFilter !== 'Semua' ? 'WHERE company_code = $1' : ''}
        `, companyFilter !== 'Semua' ? [companyFilter] : []);
        const syncInfo = syncRes.rows[0];

        return Response.json({
            weeklyData, currentWeek, prevWeek,
            estateBreakdown, rainfallData,
            rainfallWeekStart: rainStart, rainfallWeekEnd: rainEnd,
            syncInfo, selectedCompany: companyFilter,
            selectedWeek: selectedWeekName,
        });

    } catch (err) {
        console.error('[Dashboard API Error]', err.message);
        return Response.json({ error: err.message }, { status: 500 });
    } finally {
        await pool.end();
    }
}
