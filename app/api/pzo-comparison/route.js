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

        // 2. Get available weeks
        const weeksRes = await pool.query(`
            SELECT DISTINCT formatted_name, start_date, end_date 
            FROM calendar_weeks 
            WHERE formatted_name IN (SELECT DISTINCT month_name FROM piezometer_data WHERE company_code = ANY($1))
            ORDER BY start_date DESC LIMIT 20
        `, [companyCodes]);
        const availableWeeks = weeksRes.rows;

        // Resolve the selected week and previous week
        const selectedWeek = weekFilter || (availableWeeks.length > 0 ? availableWeeks[0].formatted_name : null);
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
                COUNT(*)::int AS total,
                SUM(CASE WHEN p.ketinggian < 0 THEN 1 ELSE 0 END)::int AS cnt_banjir,
                SUM(CASE WHEN p.ketinggian BETWEEN 0 AND 40 THEN 1 ELSE 0 END)::int AS cnt_tergenang,
                SUM(CASE WHEN p.ketinggian BETWEEN 61 AND 65 THEN 1 ELSE 0 END)::int AS cnt_a_kering,
                SUM(CASE WHEN p.ketinggian > 65 THEN 1 ELSE 0 END)::int AS cnt_kering
            FROM piezometer_data p
            WHERE p.month_name = ANY($1) AND p.company_code = ANY($2)
            AND p.ketinggian IS NOT NULL
            GROUP BY p.company_code, p.month_name
        `, [targetWeeks, companyCodes]);

        // 4. Rainfall per company for these weeks (average mm and rain days)
        const rainRes = await pool.query(`
            SELECT 
                r.company_code,
                cw.formatted_name AS week,
                ROUND(AVG(r.rainfall_mm)::numeric, 1) AS avg_mm,
                COUNT(DISTINCT CASE WHEN r.rainfall_mm > 0 THEN r.record_date END)::int AS hari_hujan
            FROM daily_rainfall r
            JOIN calendar_weeks cw ON r.record_date >= cw.start_date AND r.record_date <= cw.end_date
            WHERE cw.formatted_name = ANY($1) AND r.company_code = ANY($2)
            GROUP BY r.company_code, cw.formatted_name
        `, [targetWeeks, companyCodes]);

        // 5. Build the comparison table rows (one per company)
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
                    ch: swRain ? `${swRain.avg_mm} mm` : '-',
                    hh: swRain ? swRain.hari_hujan : 0,
                    banjir: sw?.cnt_banjir || 0,
                    tergenang: sw?.cnt_tergenang || 0,
                    a_kering: sw?.cnt_a_kering || 0,
                    kering: sw?.cnt_kering || 0,
                    total: sw?.total || 0
                },
                previous: pw ? {
                    ch: pwRain ? `${pwRain.avg_mm} mm` : '-',
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
