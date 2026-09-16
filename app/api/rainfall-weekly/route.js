import pg from 'pg';
const { Pool } = pg;

export const dynamic = 'force-dynamic';

function getRainCategory(totalMm) {
    const val = Number(totalMm) || 0;
    if (val === 0) return { label: 'Kering', color: '#9CA3AF', bg: '#F3F4F6' };
    if (val <= 50) return { label: 'Rendah', color: '#2563EB', bg: '#EFF6FF' };
    if (val <= 100) return { label: 'Sedang', color: '#D97706', bg: '#FEF3C7' };
    if (val <= 150) return { label: 'Tinggi', color: '#DC2626', bg: '#FEE2E2' };
    return { label: 'Sangat Tinggi', color: '#7F1D1D', bg: '#FEE2E2' };
}

export async function GET(request) {
    const { searchParams } = new URL(request.url);
    const mode = searchParams.get('mode') || 'single'; // 'single' | 'matrix'
    const weekParam = searchParams.get('week') || null;
    const limitWeeks = parseInt(searchParams.get('limit') || '8', 10);

    const pool = new Pool({
        connectionString: process.env.DATABASE_URL,
        ssl: { rejectUnauthorized: false }
    });

    try {
        // 1. Get list of all weeks available for dropdown
        const allWeeksRes = await pool.query(`
            SELECT id, formatted_name, start_date, end_date, week, month, year
            FROM calendar_weeks
            WHERE start_date <= NOW() + INTERVAL '7 days'
            ORDER BY start_date DESC
            LIMIT 52
        `);
        const availableWeeks = allWeeksRes.rows;

        // Active companies
        const compRes = await pool.query(`
            SELECT code, name 
            FROM companies 
            WHERE "isActive" = true 
            ORDER BY code ASC
        `);
        const companies = compRes.rows;
        const companyCodes = companies.map(c => c.code);

        // ----------------------------------------------------
        // MODE 1: SINGLE WEEK VIEW
        // ----------------------------------------------------
        if (mode === 'single') {
            let currentWeekRow = null;
            if (weekParam) {
                currentWeekRow = availableWeeks.find(w => w.formatted_name === weekParam);
            }
            if (!currentWeekRow) {
                currentWeekRow = availableWeeks.find(w => new Date(w.start_date) <= new Date()) || availableWeeks[0];
            }

            if (!currentWeekRow) {
                return Response.json({ error: 'No calendar week found' }, { status: 404 });
            }

            // Find previous week
            const currIdx = availableWeeks.findIndex(w => w.id === currentWeekRow.id);
            const prevWeekRow = (currIdx >= 0 && currIdx + 1 < availableWeeks.length)
                ? availableWeeks[currIdx + 1]
                : null;

            const currStart = currentWeekRow.start_date;
            const currEnd = currentWeekRow.end_date;
            const prevStart = prevWeekRow ? prevWeekRow.start_date : currStart;
            const prevEnd = prevWeekRow ? prevWeekRow.end_date : currEnd;

            const query = `
                WITH daily_co_avg AS (
                    SELECT 
                        r.company_code,
                        r.record_date,
                        AVG(r.rainfall_mm) AS daily_avg
                    FROM daily_rainfall r
                    WHERE (r.record_date BETWEEN $1 AND $2 OR r.record_date BETWEEN $3 AND $4)
                      AND r.company_code = ANY($5)
                    GROUP BY r.company_code, r.record_date
                )
                SELECT 
                    c.code AS company_code,
                    c.name AS company_name,
                    -- Current week stats
                    COALESCE(ROUND(SUM(CASE WHEN da.record_date BETWEEN $1 AND $2 THEN da.daily_avg END)::numeric, 1), 0.0) AS total_ch_mm,
                    COALESCE(ROUND((SUM(CASE WHEN da.record_date BETWEEN $1 AND $2 THEN da.daily_avg END) / 7.0)::numeric, 1), 0.0) AS avg_daily_mm,
                    COALESCE(COUNT(DISTINCT CASE WHEN da.record_date BETWEEN $1 AND $2 AND da.daily_avg > 0 THEN da.record_date END), 0)::int AS hari_hujan,
                    -- Previous week stats
                    COALESCE(ROUND(SUM(CASE WHEN da.record_date BETWEEN $3 AND $4 THEN da.daily_avg END)::numeric, 1), 0.0) AS prev_total_ch_mm,
                    COALESCE(ROUND((SUM(CASE WHEN da.record_date BETWEEN $3 AND $4 THEN da.daily_avg END) / 7.0)::numeric, 1), 0.0) AS prev_avg_daily_mm,
                    COALESCE(COUNT(DISTINCT CASE WHEN da.record_date BETWEEN $3 AND $4 AND da.daily_avg > 0 THEN da.record_date END), 0)::int AS prev_hari_hujan
                FROM companies c
                LEFT JOIN daily_co_avg da ON da.company_code = c.code
                WHERE c."isActive" = true
                GROUP BY c.code, c.name
                ORDER BY total_ch_mm DESC;
            `;

            const { rows } = await pool.query(query, [currStart, currEnd, prevStart, prevEnd, companyCodes]);

            const dataWithCategories = rows.map(r => {
                const total = Number(r.total_ch_mm) || 0;
                const prevTotal = Number(r.prev_total_ch_mm) || 0;
                const delta = Number((total - prevTotal).toFixed(1));
                const category = getRainCategory(total);
                return {
                    ...r,
                    total_ch_mm: total,
                    avg_daily_mm: Number(r.avg_daily_mm) || 0,
                    hari_hujan: Number(r.hari_hujan) || 0,
                    prev_total_ch_mm: prevTotal,
                    prev_avg_daily_mm: Number(r.prev_avg_daily_mm) || 0,
                    prev_hari_hujan: Number(r.prev_hari_hujan) || 0,
                    delta_ch_mm: delta,
                    category
                };
            });

            // Overall Summary for header cards
            const totalPT = dataWithCategories.length || 1;
            const avgCHAllPT = Number((dataWithCategories.reduce((acc, c) => acc + c.total_ch_mm, 0) / totalPT).toFixed(1));
            const avgDailyAllPT = Number((dataWithCategories.reduce((acc, c) => acc + c.avg_daily_mm, 0) / totalPT).toFixed(1));
            const avgHHAllPT = Number((dataWithCategories.reduce((acc, c) => acc + c.hari_hujan, 0) / totalPT).toFixed(1));
            const wettestPT = dataWithCategories[0] || null;
            const driestPT = dataWithCategories[dataWithCategories.length - 1] || null;

            return Response.json({
                mode: 'single',
                week: currentWeekRow,
                prevWeek: prevWeekRow,
                availableWeeks: availableWeeks.map(w => ({
                    id: w.id,
                    formatted_name: w.formatted_name,
                    start_date: w.start_date,
                    end_date: w.end_date
                })),
                metrics: {
                    avgCHAllPT,
                    avgDailyAllPT,
                    avgHHAllPT,
                    wettestPT: wettestPT ? { code: wettestPT.company_code, total_mm: wettestPT.total_ch_mm, hh: wettestPT.hari_hujan } : null,
                    driestPT: driestPT ? { code: driestPT.company_code, total_mm: driestPT.total_ch_mm, hh: driestPT.hari_hujan } : null
                },
                data: dataWithCategories
            });
        }

        // ----------------------------------------------------
        // MODE 2: MULTI-WEEK MATRIX VIEW
        // ----------------------------------------------------
        if (mode === 'matrix') {
            // Take the last N weeks
            const selectedWeeks = availableWeeks.slice(0, Math.min(limitWeeks, availableWeeks.length));
            // Sort ascending by start_date for chronological left-to-right matrix
            selectedWeeks.sort((a, b) => new Date(a.start_date) - new Date(b.start_date));

            if (selectedWeeks.length === 0) {
                return Response.json({ weeks: [], matrix: {}, companies });
            }

            const minStartDate = selectedWeeks[0].start_date;
            const maxEndDate = selectedWeeks[selectedWeeks.length - 1].end_date;
            const weekIds = selectedWeeks.map(w => w.id);

            const matrixQuery = `
                WITH daily_co_avg AS (
                    SELECT 
                        r.company_code,
                        r.record_date,
                        AVG(r.rainfall_mm) AS daily_avg
                    FROM daily_rainfall r
                    WHERE r.record_date BETWEEN $1 AND $2
                      AND r.company_code = ANY($3)
                    GROUP BY r.company_code, r.record_date
                )
                SELECT 
                    da.company_code,
                    cw.id AS week_id,
                    cw.formatted_name,
                    ROUND(SUM(da.daily_avg)::numeric, 1) AS total_ch_mm,
                    ROUND((SUM(da.daily_avg) / 7.0)::numeric, 1) AS avg_daily_mm,
                    COUNT(DISTINCT CASE WHEN da.daily_avg > 0 THEN da.record_date END)::int AS hari_hujan
                FROM daily_co_avg da
                INNER JOIN calendar_weeks cw ON da.record_date BETWEEN cw.start_date AND cw.end_date
                WHERE cw.id = ANY($4)
                GROUP BY da.company_code, cw.id, cw.formatted_name
            `;

            const { rows } = await pool.query(matrixQuery, [minStartDate, maxEndDate, companyCodes, weekIds]);

            // Transform into nested object: matrix[company_code][formatted_name] = { total_ch_mm, avg_daily_mm, hari_hujan }
            const matrix = {};
            companies.forEach(comp => {
                matrix[comp.code] = {};
                selectedWeeks.forEach(w => {
                    matrix[comp.code][w.formatted_name] = {
                        total_ch_mm: 0,
                        avg_daily_mm: 0,
                        hari_hujan: 0,
                        category: getRainCategory(0)
                    };
                });
            });

            rows.forEach(r => {
                if (matrix[r.company_code] && matrix[r.company_code][r.formatted_name]) {
                    const total = Number(r.total_ch_mm) || 0;
                    matrix[r.company_code][r.formatted_name] = {
                        total_ch_mm: total,
                        avg_daily_mm: Number(r.avg_daily_mm) || 0,
                        hari_hujan: Number(r.hari_hujan) || 0,
                        category: getRainCategory(total)
                    };
                }
            });

            return Response.json({
                mode: 'matrix',
                weeks: selectedWeeks.map(w => ({
                    id: w.id,
                    formatted_name: w.formatted_name,
                    start_date: w.start_date,
                    end_date: w.end_date
                })),
                availableWeeks: availableWeeks.map(w => ({
                    id: w.id,
                    formatted_name: w.formatted_name
                })),
                companies,
                matrix
            });
        }

        return Response.json({ error: 'Invalid mode' }, { status: 400 });

    } catch (err) {
        console.error('[Rainfall Weekly API Error]', err);
        return Response.json({ error: err.message }, { status: 500 });
    } finally {
        await pool.end();
    }
}

