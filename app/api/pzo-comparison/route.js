import pg from 'pg';
const { Pool } = pg;
import { NextResponse } from 'next/server';

export async function GET(request) {
    const { searchParams } = new URL(request.url);
    const weekFilter = searchParams.get('week') || null;

    const pool = new Pool({
        connectionString: process.env.DATABASE_URL,
        ssl: { rejectUnauthorized: false }
    });

    try {
        // 1. Fetch active companies
        const activeRes = await pool.query('SELECT code, name FROM companies WHERE "isActive" = true ORDER BY code');
        const companies = activeRes.rows.length > 0
            ? activeRes.rows
            : []; // fallback empty

        const companyCodes = companies.map(r => r.code);
        if (companyCodes.length === 0) {
            return NextResponse.json({ error: 'No active companies found' }, { status: 404 });
        }

        // 2. Get available weeks (only those that have piezometer data)
        const weeksRes = await pool.query(`
            SELECT DISTINCT cw.formatted_name, cw.start_date, cw.end_date 
            FROM calendar_weeks cw
            WHERE cw.formatted_name IN (SELECT DISTINCT month_name FROM piezometer_data WHERE company_code = ANY($1))
            ORDER BY cw.start_date DESC LIMIT 20
        `, [companyCodes]);
        const availableWeeks = weeksRes.rows;

        // Resolve the selected week:
        // 1. If weekFilter is provided, use it.
        // 2. Otherwise, try to find a week in availableWeeks that covers "today".
        // 3. Otherwise, fallback to the latest available week (availableWeeks[0]).
        let selectedWeek = weekFilter;
        if (!selectedWeek && availableWeeks.length > 0) {
            const now = new Date();
            const currentWeekMeta = availableWeeks.find(w => {
                const start = new Date(w.start_date);
                const end = new Date(w.end_date);
                return now >= start && now <= end;
            });
            selectedWeek = currentWeekMeta ? currentWeekMeta.formatted_name : availableWeeks[0].formatted_name;
        }

        const selectedIdx = availableWeeks.findIndex(w => w.formatted_name === selectedWeek);
        const prevWeekName = selectedIdx >= 0 && selectedIdx + 1 < availableWeeks.length 
            ? availableWeeks[selectedIdx + 1].formatted_name : null;

        if (!selectedWeek) {
            return NextResponse.json({ companies: [], availableWeeks: [], rows: [] });
        }

        const selectedWeekMeta = availableWeeks.find(w => w.formatted_name === selectedWeek);
        const prevWeekMeta = prevWeekName ? availableWeeks.find(w => w.formatted_name === prevWeekName) : null;

        // 3. TMAT class distribution per company for selected week AND previous week
        const targetWeeks = prevWeekName ? [selectedWeek, prevWeekName] : [selectedWeek];
        
        const pzoRes = await pool.query(`
            SELECT 
                p.company_code,
                p.month_name AS week,
                COUNT(DISTINCT COALESCE(m.block_id, p.block))::int AS total,
                COUNT(DISTINCT CASE WHEN p.ketinggian < 0 THEN COALESCE(m.block_id, p.block) END)::int AS cnt_banjir,
                COUNT(DISTINCT CASE WHEN p.ketinggian >= 0 AND p.ketinggian <= 40 THEN COALESCE(m.block_id, p.block) END)::int AS cnt_tergenang,
                COUNT(DISTINCT CASE WHEN p.ketinggian > 60 AND p.ketinggian <= 65 THEN COALESCE(m.block_id, p.block) END)::int AS cnt_a_kering,
                COUNT(DISTINCT CASE WHEN p.ketinggian > 65 THEN COALESCE(m.block_id, p.block) END)::int AS cnt_kering
            FROM piezometer_data p
            LEFT JOIN pzo_master_mapping m ON p.pie_record_id = m.pie_record_id
            WHERE p.month_name = ANY($1) AND p.company_code = ANY($2)
            AND p.ketinggian IS NOT NULL
            AND (m.is_active IS NULL OR m.is_active = true)
            GROUP BY p.company_code, p.month_name
        `, [targetWeeks, companyCodes]);

        // 4. Rainfall per company: Sum of (Daily Average across all estates)
        const rainRes = await pool.query(`
            WITH daily_co_avg AS (
                SELECT 
                    r.company_code,
                    r.record_date,
                    AVG(r.rainfall_mm) as daily_avg
                FROM daily_rainfall r
                WHERE r.company_code = ANY($2)
                GROUP BY r.company_code, r.record_date
            )
            SELECT 
                da.company_code,
                cw.formatted_name AS week,
                ROUND(SUM(da.daily_avg)::numeric, 1) AS total_ch,
                COUNT(DISTINCT CASE WHEN da.daily_avg > 0 THEN da.record_date END)::int AS hari_hujan
            FROM daily_co_avg da
            JOIN calendar_weeks cw ON da.record_date >= cw.start_date AND da.record_date <= cw.end_date
            WHERE cw.formatted_name = ANY($1)
            GROUP BY da.company_code, cw.formatted_name
        `, [targetWeeks, companyCodes]);

        // Build the comparison table rows (one per company)
        const rows = companyCodes.map((code, idx) => {
            const companyName = companies.find(c => c.code === code)?.name || code;
            
            // Selected week data
            const sw = pzoRes.rows.find(r => r.company_code === code && r.week === selectedWeek);
            const swRain = rainRes.rows.find(r => r.company_code === code && r.week === selectedWeek);

            // Previous week data
            const pw = prevWeekName ? pzoRes.rows.find(r => r.company_code === code && r.week === prevWeekName) : null;
            const pwRain = prevWeekName ? rainRes.rows.find(r => r.company_code === code && r.week === prevWeekName) : null;

            return {
                no: idx + 1,
                company: code.replace('PT.', ''),
                companyCode: code,
                selected: {
                    ch: swRain ? `${swRain.total_ch} mm` : '0 mm',
                    hh: swRain ? swRain.hari_hujan : 0,
                    banjir: sw?.cnt_banjir || 0,
                    tergenang: sw?.cnt_tergenang || 0,
                    a_kering: sw?.cnt_a_kering || 0,
                    kering: sw?.cnt_kering || 0,
                    total: sw?.total || 0
                },
                previous: pw ? {
                    ch: pwRain ? `${pwRain.total_ch} mm` : '0 mm',
                    hh: pwRain ? pwRain.hari_hujan : 0,
                    banjir: pw.cnt_banjir || 0,
                    tergenang: pw.cnt_tergenang || 0,
                    a_kering: pw.cnt_a_kering || 0,
                    kering: pw.cnt_kering || 0,
                    total: pw.total || 0
                } : null
            };
        });

        return NextResponse.json({
            companies,
            availableWeeks: availableWeeks.map(w => w.formatted_name),
            selectedWeek,
            prevWeek: prevWeekName,
            rows
        });

    } catch (err) {
        console.error('[PZO Comparison API Error]', err.message);
        return NextResponse.json({ error: err.message }, { status: 500 });
    } finally {
        await pool.end();
    }
}
