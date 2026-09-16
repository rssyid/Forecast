import pg from 'pg';
const { Pool } = pg;

import { syncGisComparisonForWeek } from '../../../lib/gisService.js';

export async function GET(request) {
    const { searchParams } = new URL(request.url);
    const weekFilter = searchParams.get('week') || null;
    const forceSync = searchParams.get('forceSync') === 'true' || searchParams.get('sync') === 'true';

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
            return Response.json({ error: 'Week parameter is required' }, { status: 400 });
        }

        const anchorRes = await pool.query(
            `SELECT id, gis_week_id, formatted_name, start_date, end_date 
             FROM calendar_weeks WHERE formatted_name = $1 LIMIT 1`,
            [weekFilter]
        );
        
        if (anchorRes.rows.length === 0) {
            return Response.json({ error: 'Invalid week name' }, { status: 400 });
        }

        const currentStart = anchorRes.rows[0].start_date;
        const currentEnd = anchorRes.rows[0].end_date;
        const currentWeekId = anchorRes.rows[0].gis_week_id || (anchorRes.rows[0].id + 434);
        
        // Get the week immediately before currentStart
        const prevWeekRes = await pool.query(
            `SELECT id, gis_week_id, formatted_name, start_date, end_date 
             FROM calendar_weeks 
             WHERE start_date < $1 ORDER BY start_date DESC LIMIT 1`,
            [currentStart]
        );
        
        const prevWeekName = prevWeekRes.rows[0]?.formatted_name || null;
        const prevStart = prevWeekRes.rows[0]?.start_date || null;
        const prevEnd = prevWeekRes.rows[0]?.end_date || null;
        const prevWeekId = prevWeekRes.rows[0] ? (prevWeekRes.rows[0].gis_week_id || (prevWeekRes.rows[0].id + 434)) : null;

        // 3. Check if GIS comparison data exists in database
        const existingCountRes = await pool.query(
            `SELECT COUNT(DISTINCT company_code)::int AS cnt 
             FROM gis_comparison_data 
             WHERE week_id = $1 AND company_code = ANY($2)`,
            [currentWeekId, companyCodes]
        );
        const existingCount = existingCountRes.rows[0]?.cnt || 0;

        // If data is missing or user requested forceSync, sync directly from GIS-DIV API
        if (forceSync || existingCount < companyCodes.length) {
            console.log(`[comparison-bulk] Syncing week ${currentWeekId} (${weekFilter}) from GIS API...`);
            try {
                await syncGisComparisonForWeek(currentWeekId, companies);
            } catch (syncErr) {
                console.warn('[comparison-bulk] GIS API sync error (continuing with existing data):', syncErr.message);
            }
        }

        // 4. Fetch TMAT comparison data from gis_comparison_data
        const targetWeekIds = [currentWeekId];
        if (prevWeekId) targetWeekIds.push(prevWeekId);

        const gisDataRes = await pool.query(
            `SELECT * FROM gis_comparison_data 
             WHERE week_id = ANY($1) AND company_code = ANY($2)`,
            [targetWeekIds, companyCodes]
        );

        // 5. Aggregate Rainfall data: Sum of Daily Averages per Company (from daily_rainfall table)
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

        // 6. Structure response for CompanyComparisonCard
        const result = companies.map(comp => {
            const currentGis = gisDataRes.rows.find(r => r.company_code === comp.code && r.week_id === currentWeekId) || null;
            const prevGis = gisDataRes.rows.find(r => r.company_code === comp.code && r.week_id === prevWeekId) || null;

            // Structure Current Week Stats
            const currentStats = currentGis ? {
                cnt_banjir: currentGis.cnt_banjir,
                cnt_tergenang: currentGis.cnt_tergenang,
                cnt_a_tergenang: currentGis.cnt_a_tergenang,
                cnt_normal: currentGis.cnt_normal,
                cnt_a_kering: currentGis.cnt_a_kering,
                cnt_kering: currentGis.cnt_kering,
                total_blocks: currentGis.cnt_total || currentGis.total_piezo,
                avg_tmat: currentGis.avg_tmat != null ? parseFloat(currentGis.avg_tmat) : 0,
                percentages: currentGis.percentages || [0, 0, 0, 0, 0, 0]
            } : null;

            // Structure Previous Week Stats
            const prevStats = prevGis ? {
                cnt_banjir: prevGis.cnt_banjir,
                cnt_tergenang: prevGis.cnt_tergenang,
                cnt_a_tergenang: prevGis.cnt_a_tergenang,
                cnt_normal: prevGis.cnt_normal,
                cnt_a_kering: prevGis.cnt_a_kering,
                cnt_kering: prevGis.cnt_kering,
                total_blocks: prevGis.cnt_total || prevGis.total_piezo,
                avg_tmat: prevGis.avg_tmat != null ? parseFloat(prevGis.avg_tmat) : 0,
                percentages: prevGis.percentages || [0, 0, 0, 0, 0, 0]
            } : null;

            // Rainfall info
            const currentRainObj = rainRes.rows.find(r => r.company_code === comp.code && r.period === 'current');
            const prevRainObj = rainRes.rows.find(r => r.company_code === comp.code && r.period === 'prev');

            const currentRain = currentRainObj?.total_ch || 0;
            const prevRain = prevRainObj?.total_ch || 0;

            // Dominant status from GIS
            // Note: 'No Data' is a truthy string, so we must explicitly check for it before falling back
            const dominantLabel =
                (currentGis?.dominant_status && currentGis.dominant_status !== 'No Data')
                    ? currentGis.dominant_status
                    : (prevGis?.dominant_status && prevGis.dominant_status !== 'No Data')
                        ? prevGis.dominant_status
                        : 'No Data';

            // TMAT average comparison: delta = prev - current
            // Negative delta = water went deeper = drier = worse
            const prevAvg = prevStats?.avg_tmat || 0;
            const currAvg = currentStats?.avg_tmat || 0;
            const tmatDelta = (prevAvg > 0 && currAvg > 0) ? parseFloat((prevAvg - currAvg).toFixed(1)) : 0;

            return {
                companyCode: comp.code,
                companyName: comp.name,
                currentWeek: currentStats,
                prevWeek: prevStats,
                dominantStatus: dominantLabel,
                tmat: {
                    prev: prevAvg,
                    current: currAvg,
                    delta: tmatDelta
                },
                rainfall: {
                    current: currentRain,
                    prev: prevRain,
                    delta: parseFloat((currentRain - prevRain).toFixed(1)),
                    currentHH: currentRainObj?.hari_hujan || 0,
                    prevHH: prevRainObj?.hari_hujan || 0
                }
            };
        });

        // Fetch max updated_at for last sync timestamp
        const lastSyncRes = await pool.query(`SELECT MAX(updated_at) AS last_updated FROM gis_comparison_data`);
        const lastSyncTime = lastSyncRes.rows[0]?.last_updated || null;

        return Response.json({
            weeks: { current: weekFilter, prev: prevWeekName },
            currentWeekId,
            prevWeekId,
            lastSyncTime,
            data: result
        });

    } catch (err) {
        console.error('[Comparison Bulk API Error]', err);
        return Response.json({ error: err.message }, { status: 500 });
    } finally {
        await pool.end();
    }
}
