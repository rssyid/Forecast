import pg from 'pg';
const { Pool } = pg;
import { NextResponse } from 'next/server';

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
        // 0. Fetch active companies
        const activeRes = await pool.query('SELECT code FROM companies WHERE "isActive" = true');
        const activeCodes = activeRes.rows.length > 0 
            ? activeRes.rows.map(r => r.code)
            : ['PT.THIP', 'PT.PTW', 'PT.SUMS', 'PT.WKN', 'PT.PANPS', 'PT.SAM', 'PT.NJP', 'PT.PLDK', 'PT.SUMK', 'PT.BAS', 'PT.AAN', 'PT.GAN', 'PT.AJP', 'PT.JJP', 'PT.SIP', 'PT.WSM']; // Fallback


        const companyWhere = companyFilter !== 'Semua' 
            ? `AND p.company_code = $1` 
            : `AND p.company_code = ANY($1)`;
        
        const queryParams = companyFilter !== 'Semua' 
            ? [companyFilter] 
            : [activeCodes];
        
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
            ? `AND cw.start_date <= $2`
            : '';
        const weekParams = anchorStartDate ? [queryParams[0], anchorStartDate] : [queryParams[0]];

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
            const estateWhere = companyFilter !== 'Semua' ? 'AND p.company_code = $1' : 'AND p.company_code = ANY($1)';
            const estateRes = await pool.query(`
                SELECT 
                    p.est_code AS estate, p.company_code AS company,
                    COUNT(DISTINCT p.pie_record_id)::int AS total_pzo,
                    COUNT(DISTINCT COALESCE(m.block_id, p.block))::int AS total_block,
                    COUNT(DISTINCT CASE WHEN p.ketinggian > 65 THEN COALESCE(m.block_id, p.block) END)::int AS cnt_kering,
                    COUNT(DISTINCT CASE WHEN p.ketinggian <= 45 THEN COALESCE(m.block_id, p.block) END)::int AS cnt_basah,
                    ROUND(AVG(p.ketinggian)::numeric, 1) AS avg_tmat
                FROM piezometer_data p
                LEFT JOIN pzo_master_mapping m ON p.pie_record_id = m.pie_record_id
                WHERE p.month_name = $2
                ${estateWhere}
                AND (m.is_active IS NULL OR m.is_active = true)
                GROUP BY p.est_code, p.company_code
                ORDER BY cnt_kering DESC
                LIMIT 10
            `, [queryParams[0], selectedWeekName]);
            estateBreakdown = estateRes.rows;
        }

        // 4. Rainfall for same calendar week period
        const rainStart = currentWeek?.week_start || null;
        const rainEnd = currentWeek?.week_end || null;
        let rainfallData = [];

        if (rainStart && rainEnd) {
            const rainWhere = companyFilter !== 'Semua' ? 'AND r.company_code = $1' : 'AND r.company_code = ANY($1)';
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
                WHERE r.record_date BETWEEN $2 AND $3 ${rainWhere}
                GROUP BY r.est_code, r.company_code
                ORDER BY total_mm DESC
                LIMIT 10
            `, [queryParams[0], rainStart, rainEnd]);
            rainfallData = rainRes.rows;
        }

        // 5. Last Rain Analysis (Real-time: Days since last rain relative to TODAY)
        let lastRainData = [];
        const lastRainWhere = companyFilter !== 'Semua' ? 'WHERE r.company_code = $1' : 'WHERE r.company_code = ANY($1)';
        const lastRainRes = await pool.query(`
            SELECT 
                r.est_code, r.company_code,
                MAX(r.record_date)::text AS last_rain_date,
                (CURRENT_DATE - MAX(r.record_date)::date)::int AS days_since_rain
            FROM daily_rainfall r
            ${lastRainWhere} AND r.rainfall_mm > 0 
            GROUP BY r.est_code, r.company_code
            ORDER BY days_since_rain DESC
            LIMIT 10
        `, [queryParams[0]]);
        lastRainData = lastRainRes.rows;

        // 6. DB sync status
        const syncWhere = companyFilter !== 'Semua' ? 'WHERE company_code = $1' : 'WHERE company_code = ANY($1)';
        const syncRes = await pool.query(`
            SELECT COUNT(*)::int AS total_records,
                   COUNT(DISTINCT company_code)::int AS total_companies,
                   COUNT(DISTINCT est_code)::int AS total_estates
            FROM piezometer_data
            ${syncWhere}
        `, [queryParams[0]]);
        const syncInfo = syncRes.rows[0];

        return NextResponse.json({
            weeklyData, currentWeek, prevWeek,
            estateBreakdown, rainfallData, lastRainData,
            rainfallWeekStart: rainStart, rainfallWeekEnd: rainEnd,
            syncInfo, selectedCompany: companyFilter,
            selectedWeek: selectedWeekName,
        });

    } catch (err) {
        console.error('[Dashboard API Error]', err.message, err.stack);
        return NextResponse.json({ error: err.message, stack: err.stack }, { status: 500 });
    } finally {
        await pool.end();
    }
}
