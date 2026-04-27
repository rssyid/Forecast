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
        // 1. Get active companies
        const activeRes = await pool.query('SELECT code, name FROM companies WHERE "isActive" = true ORDER BY code');
        const companies = activeRes.rows;
        const companyCodes = companies.map(c => c.code);

        // 2. Determine target weeks (Current & Previous)
        if (!weekFilter) {
            return NextResponse.json({ error: 'Week parameter is required' }, { status: 400 });
        }

        const anchorRes = await pool.query(
            `SELECT start_date, end_date FROM calendar_weeks WHERE formatted_name = $1 LIMIT 1`,
            [weekFilter]
        );
        
        if (anchorRes.rows.length === 0) {
            return NextResponse.json({ error: 'Invalid week name' }, { status: 400 });
        }

        const currentStart = anchorRes.rows[0].start_date;
        
        // Get the week immediately before currentStart
        const prevWeekRes = await pool.query(
            `SELECT formatted_name, start_date, end_date FROM calendar_weeks 
             WHERE start_date < $1 ORDER BY start_date DESC LIMIT 1`,
            [currentStart]
        );
        
        const prevWeekName = prevWeekRes.rows[0]?.formatted_name || null;
        const prevStart = prevWeekRes.rows[0]?.start_date || null;
        const prevEnd = prevWeekRes.rows[0]?.end_date || null;
        const currentEnd = anchorRes.rows[0].end_date;

        // 3. Aggregate TMAT data for both weeks per company
        const tmatStatsQ = `
            SELECT 
                p.company_code,
                p.month_name AS week,
                COUNT(DISTINCT COALESCE(m.block_id, p.block)) FILTER (WHERE p.ketinggian < 0)::int AS cnt_banjir,
                COUNT(DISTINCT COALESCE(m.block_id, p.block)) FILTER (WHERE p.ketinggian BETWEEN 0 AND 40)::int AS cnt_tergenang,
                COUNT(DISTINCT COALESCE(m.block_id, p.block)) FILTER (WHERE p.ketinggian BETWEEN 41 AND 45)::int AS cnt_a_tergenang,
                COUNT(DISTINCT COALESCE(m.block_id, p.block)) FILTER (WHERE p.ketinggian BETWEEN 46 AND 60)::int AS cnt_normal,
                COUNT(DISTINCT COALESCE(m.block_id, p.block)) FILTER (WHERE p.ketinggian BETWEEN 61 AND 65)::int AS cnt_a_kering,
                COUNT(DISTINCT COALESCE(m.block_id, p.block)) FILTER (WHERE p.ketinggian > 65)::int AS cnt_kering,
                COUNT(DISTINCT COALESCE(m.block_id, p.block))::int AS total_blocks
            FROM piezometer_data p
            LEFT JOIN pzo_master_mapping m ON p.pie_record_id = m.pie_record_id
            WHERE p.month_name IN ($1, $2)
            AND p.company_code = ANY($3)
            AND (m.is_active IS NULL OR m.is_active = true)
            GROUP BY p.company_code, p.month_name
        `;
        const tmatRes = await pool.query(tmatStatsQ, [weekFilter, prevWeekName, companyCodes]);

        // 4. Aggregate Rainfall data for both weeks per company
        const rainStatsQ = `
            SELECT 
                r.company_code,
                CASE 
                    WHEN r.record_date BETWEEN $1 AND $2 THEN 'current'
                    WHEN r.record_date BETWEEN $3 AND $4 THEN 'prev'
                END as period,
                ROUND(SUM(r.rainfall_mm)::numeric, 1) AS total_mm
            FROM daily_rainfall r
            WHERE (r.record_date BETWEEN $1 AND $2 OR r.record_date BETWEEN $3 AND $4)
            AND r.company_code = ANY($5)
            GROUP BY r.company_code, period
        `;
        const rainRes = await pool.query(rainStatsQ, [currentStart, currentEnd, prevStart, prevEnd, companyCodes]);

        // 5. Structure the data for Option B (Grid View)
        const result = companies.map(comp => {
            const currentTmat = tmatRes.rows.find(r => r.company_code === comp.code && r.week === weekFilter) || null;
            const prevTmat = tmatRes.rows.find(r => r.company_code === comp.code && r.week === prevWeekName) || null;
            
            const currentRain = rainRes.rows.find(r => r.company_code === comp.code && r.period === 'current')?.total_mm || 0;
            const prevRain = rainRes.rows.find(r => r.company_code === comp.code && r.period === 'prev')?.total_mm || 0;

            return {
                companyCode: comp.code,
                companyName: comp.name,
                currentWeek: currentTmat,
                prevWeek: prevTmat,
                rainfall: {
                    current: currentRain,
                    prev: prevRain,
                    delta: currentRain - prevRain
                }
            };
        });

        return NextResponse.json({
            weeks: { current: weekFilter, prev: prevWeekName },
            data: result
        });

    } catch (err) {
        console.error('[Comparison Bulk API Error]', err.message);
        return NextResponse.json({ error: err.message }, { status: 500 });
    } finally {
        await pool.end();
    }
}
