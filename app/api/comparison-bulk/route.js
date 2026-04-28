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
        // 4. Aggregate Rainfall data: Sum of Daily Averages per Company
        const rainStatsQ = `
            WITH daily_co_avg AS (
                SELECT 
                    r.company_code,
                    r.record_date,
                    AVG(r.rainfall_mm) as daily_avg
                FROM daily_rainfall r
                WHERE (r.record_date BETWEEN $1 AND $2 OR r.record_date BETWEEN $3 AND $4)
                AND r.company_code = ANY($5)
                GROUP BY r.company_code, r.record_date
            )
            SELECT 
                da.company_code,
                CASE 
                    WHEN da.record_date BETWEEN $1 AND $2 THEN 'current'
                    WHEN da.record_date BETWEEN $3 AND $4 THEN 'prev'
                END as period,
                ROUND(SUM(da.daily_avg)::numeric, 1) AS total_ch,
                COUNT(DISTINCT CASE WHEN da.daily_avg > 0 THEN da.record_date END)::int AS hari_hujan
            FROM daily_co_avg da
            GROUP BY da.company_code, period
        `;
        const rainRes = await pool.query(rainStatsQ, [currentStart, currentEnd, prevStart, prevEnd, companyCodes]);

        // 5. Structure the data for Option B (Grid View)
        const result = companies.map(comp => {
            // Calculate percentages for Current Week
            const currentStats = currentTmat ? {
                cnt_banjir: currentTmat.cnt_banjir,
                cnt_tergenang: currentTmat.cnt_tergenang,
                cnt_a_tergenang: currentTmat.cnt_a_tergenang,
                cnt_normal: currentTmat.cnt_normal,
                cnt_a_kering: currentTmat.cnt_a_kering,
                cnt_kering: currentTmat.cnt_kering,
                total_blocks: currentTmat.total_blocks,
                percentages: [
                    currentTmat.total_blocks > 0 ? (currentTmat.cnt_banjir / currentTmat.total_blocks * 100) : 0,
                    currentTmat.total_blocks > 0 ? (currentTmat.cnt_tergenang / currentTmat.total_blocks * 100) : 0,
                    currentTmat.total_blocks > 0 ? (currentTmat.cnt_a_tergenang / currentTmat.total_blocks * 100) : 0,
                    currentTmat.total_blocks > 0 ? (currentTmat.cnt_normal / currentTmat.total_blocks * 100) : 0,
                    currentTmat.total_blocks > 0 ? (currentTmat.cnt_a_kering / currentTmat.total_blocks * 100) : 0,
                    currentTmat.total_blocks > 0 ? (currentTmat.cnt_kering / currentTmat.total_blocks * 100) : 0
                ]
            } : null;

            // Calculate percentages for Previous Week
            const prevStats = prevTmat ? {
                cnt_banjir: prevTmat.cnt_banjir,
                cnt_tergenang: prevTmat.cnt_tergenang,
                cnt_a_tergenang: prevTmat.cnt_a_tergenang,
                cnt_normal: prevTmat.cnt_normal,
                cnt_a_kering: prevTmat.cnt_a_kering,
                cnt_kering: prevTmat.cnt_kering,
                total_blocks: prevTmat.total_blocks,
                percentages: [
                    prevTmat.total_blocks > 0 ? (prevTmat.cnt_banjir / prevTmat.total_blocks * 100) : 0,
                    prevTmat.total_blocks > 0 ? (prevTmat.cnt_tergenang / prevTmat.total_blocks * 100) : 0,
                    prevTmat.total_blocks > 0 ? (prevTmat.cnt_a_tergenang / prevTmat.total_blocks * 100) : 0,
                    prevTmat.total_blocks > 0 ? (prevTmat.cnt_normal / prevTmat.total_blocks * 100) : 0,
                    prevTmat.total_blocks > 0 ? (prevTmat.cnt_a_kering / prevTmat.total_blocks * 100) : 0,
                    prevTmat.total_blocks > 0 ? (prevTmat.cnt_kering / prevTmat.total_blocks * 100) : 0
                ]
            } : null;

            const currentRainObj = rainRes.rows.find(r => r.company_code === comp.code && r.period === 'current');
            const prevRainObj = rainRes.rows.find(r => r.company_code === comp.code && r.period === 'prev');

            const currentRain = currentRainObj?.total_ch || 0;
            const prevRain = prevRainObj?.total_ch || 0;

            // Get dominant status for current week
            const labels = ['Banjir', 'Tergenang', 'A Tergenang', 'Normal', 'A Kering', 'Kering'];
            let dominantLabel = 'Unknown';
            if (currentStats && currentStats.percentages) {
                const maxPct = Math.max(...currentStats.percentages);
                const maxIdx = currentStats.percentages.indexOf(maxPct);
                if (maxPct > 0) dominantLabel = labels[maxIdx];
                else dominantLabel = 'No Data';
            }

            return {
                companyCode: comp.code,
                companyName: comp.name,
                currentWeek: currentStats,
                prevWeek: prevStats,
                dominantStatus: dominantLabel,
                rainfall: {
                    current: currentRain,
                    prev: prevRain,
                    delta: currentRain - prevRain,
                    currentHH: currentRainObj?.hari_hujan || 0,
                    prevHH: prevRainObj?.hari_hujan || 0
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
