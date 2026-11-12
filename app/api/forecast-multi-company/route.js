import pool from '../../../lib/db.js';
import { NextResponse } from 'next/server';
import { parseScenarioInput, CLASS_ORDER, classifyTMAT, toNumber } from '../../../lib/forecastEngine.js';
import { trainLaggedModels, predictCompanyScenarios } from '../../../lib/multivariateForecastEngine.js';

export async function GET(request) {
    try {
        const { searchParams } = new URL(request.url);
        const lookbackWeeks = parseInt(searchParams.get('lookbackWeeks')) || 8;
        const scenarioInput = searchParams.get('scenarios') || '0,50';
        const requestedBaselineWeek = searchParams.get('baselineWeek');

        const scenarios = parseScenarioInput(scenarioInput);

        // 1. Fetch all calendar weeks chronologically
        const weeksRes = await pool.query(`
            SELECT DISTINCT p.month_name, MAX(p.date_timestamp) as max_ts
            FROM piezometer_data p
            GROUP BY p.month_name
            ORDER BY max_ts ASC
        `);

        if (weeksRes.rows.length === 0) {
            return NextResponse.json({
                success: true,
                companies: [],
                targetWeeks: [],
                baselineWeek: '',
                scenarios,
                overall: null
            });
        }

        const weeksChronological = weeksRes.rows.map(r => r.month_name);
        const latestWeek = weeksChronological[weeksChronological.length - 1];
        const baselineWeek = requestedBaselineWeek && weeksChronological.includes(requestedBaselineWeek)
            ? requestedBaselineWeek
            : latestWeek;

        // Target weeks list for dropdown (most recent first)
        const targetWeeks = [...weeksChronological].reverse().slice(0, 16);

        // 2. Fetch full historical aggregated estate TMAT records for model training
        const histTmatRes = await pool.query(`
            SELECT 
                p.company_code,
                p.est_code,
                p.month_name,
                MAX(p.date_timestamp) as date_timestamp,
                ROUND(AVG(p.ketinggian)::numeric, 2) as avg_tmat
            FROM piezometer_data p
            LEFT JOIN pzo_master_mapping m ON p.pie_record_id = m.pie_record_id
            WHERE (m.is_active IS NULL OR m.is_active = true)
              AND p.ketinggian IS NOT NULL 
              AND p.ketinggian != 999
            GROUP BY p.company_code, p.est_code, p.month_name
        `);

        // 3. Fetch full historical aggregated estate Rain records for model training
        const histRainRes = await pool.query(`
            WITH daily_est_avg AS (
                SELECT 
                    company_code,
                    est_code,
                    record_date,
                    AVG(rainfall_mm) as daily_avg
                FROM daily_rainfall
                GROUP BY company_code, est_code, record_date
            )
            SELECT 
                da.company_code,
                da.est_code,
                cw.formatted_name as week,
                ROUND(SUM(da.daily_avg)::numeric, 2) as total_rain
            FROM daily_est_avg da
            JOIN calendar_weeks cw ON da.record_date >= cw.start_date AND da.record_date <= cw.end_date
            GROUP BY da.company_code, da.est_code, cw.formatted_name
        `);

        // 4. Train 3-lag Antecedent Moisture OLS models
        const trainedModels = trainLaggedModels(
            weeksChronological,
            histTmatRes.rows,
            histRainRes.rows
        );

        // 5. Fetch raw piezometer data ONLY for the baseline week (deduplicated per point)
        const baselinePzoRes = await pool.query(`
            SELECT DISTINCT ON (p.pie_record_id)
                   p.company_code,
                   p.est_code, 
                   COALESCE(m.block_id, p.block) as block, 
                   p.pie_record_id, 
                   p.ketinggian, 
                   p.month_name,
                   p.date_timestamp
            FROM piezometer_data p
            LEFT JOIN pzo_master_mapping m ON p.pie_record_id = m.pie_record_id
            WHERE p.month_name = $1
              AND (m.is_active IS NULL OR m.is_active = true)
            ORDER BY p.pie_record_id, p.date_timestamp DESC
        `, [baselineWeek]);

        // 6. Fetch weekly history for recent lookback period (for charts/tables)
        const recentWeeks = [...weeksChronological].slice(-lookbackWeeks);
        const historyTmatRes = await pool.query(`
            SELECT 
                p.company_code,
                p.month_name as week,
                ROUND(AVG(p.ketinggian)::numeric, 1) as avg_tmat,
                COUNT(DISTINCT p.pie_record_id) as total_records
            FROM piezometer_data p
            LEFT JOIN pzo_master_mapping m ON p.pie_record_id = m.pie_record_id
            WHERE p.month_name = ANY($1)
              AND (m.is_active IS NULL OR m.is_active = true)
              AND p.ketinggian != 999
            GROUP BY p.company_code, p.month_name
        `, [recentWeeks]);

        const historyRainRes = await pool.query(`
            WITH daily_co_avg AS (
                SELECT 
                    company_code,
                    record_date,
                    AVG(rainfall_mm) as daily_avg
                FROM daily_rainfall
                GROUP BY company_code, record_date
            )
            SELECT 
                da.company_code,
                cw.formatted_name as week,
                ROUND(SUM(da.daily_avg)::numeric, 1) as total_rain
            FROM daily_co_avg da
            JOIN calendar_weeks cw ON da.record_date >= cw.start_date AND da.record_date <= cw.end_date
            WHERE cw.formatted_name = ANY($1)
            GROUP BY da.company_code, cw.formatted_name
        `, [recentWeeks]);

        // Map weekly history
        const companyHistoryMap = {};
        historyTmatRes.rows.forEach(r => {
            if (!companyHistoryMap[r.company_code]) companyHistoryMap[r.company_code] = {};
            companyHistoryMap[r.company_code][r.week] = {
                week: r.week,
                avgTmat: parseFloat(r.avg_tmat) || 0,
                totalRecords: parseInt(r.total_records) || 0,
                rainMm: 0
            };
        });
        historyRainRes.rows.forEach(r => {
            if (companyHistoryMap[r.company_code] && companyHistoryMap[r.company_code][r.week]) {
                companyHistoryMap[r.company_code][r.week].rainMm = parseFloat(r.total_rain) || 0;
            }
        });

        // 7. Group baseline rows by company
        const baselineByCompany = {};
        baselinePzoRes.rows.forEach(r => {
            if (!r.company_code) return;
            const val = toNumber(r.ketinggian);
            const enriched = {
                ...r,
                __TMAT_NUM__: val,
                TMAT_Class: classifyTMAT(val)
            };
            if (!baselineByCompany[r.company_code]) baselineByCompany[r.company_code] = [];
            baselineByCompany[r.company_code].push(enriched);
        });

        const companies = Object.keys(baselineByCompany).sort();
        const companyResults = [];

        // Prepare overall accumulator
        const overallBaselineCounts = {};
        CLASS_ORDER.forEach(c => overallBaselineCounts[c] = 0);
        let overallTotalPoints = 0;
        let sumWeightedTmat = 0;

        const overallScenarioCounts = {};
        scenarios.forEach(sc => {
            overallScenarioCounts[sc] = {};
            CLASS_ORDER.forEach(c => overallScenarioCounts[sc][c] = 0);
        });

        for (const comp of companies) {
            const bRows = baselineByCompany[comp] || [];
            const result = predictCompanyScenarios({
                company: comp,
                baselineRows: bRows,
                scenarios,
                models: trainedModels,
                weeksChronological,
                baselineWeek
            });

            // Accumulate overall stats
            const ptCount = result.totalPoints || 0;
            overallTotalPoints += ptCount;
            if (ptCount > 0 && Number.isFinite(result.baselineAvgTmat)) {
                sumWeightedTmat += (result.baselineAvgTmat * ptCount);
            }
            CLASS_ORDER.forEach(c => {
                overallBaselineCounts[c] += (result.baselineCounts[c] || 0);
            });

            result.scenarios.forEach(sc => {
                CLASS_ORDER.forEach(c => {
                    if (overallScenarioCounts[sc.scenarioMm]) {
                        overallScenarioCounts[sc.scenarioMm][c] += (sc.counts[c] || 0);
                    }
                });
            });

            // Format history array
            const histObj = companyHistoryMap[comp] || {};
            const weeklyHistory = recentWeeks.map(w => histObj[w] || {
                week: w,
                avgTmat: 0,
                totalRecords: 0,
                rainMm: 0
            });

            companyResults.push({
                ...result,
                weeklyHistory
            });
        }

        // Finalize overall
        const overallBaselinePct = {};
        CLASS_ORDER.forEach(c => {
            overallBaselinePct[c] = overallTotalPoints > 0
                ? (overallBaselineCounts[c] / overallTotalPoints) * 100
                : 0;
        });

        const overallScenarios = scenarios.map(scMm => {
            const counts = overallScenarioCounts[scMm] || {};
            const pct = {};
            CLASS_ORDER.forEach(c => {
                pct[c] = overallTotalPoints > 0 ? (counts[c] / overallTotalPoints) * 100 : 0;
            });
            const basah = (counts["Tergenang (0-40)"] || 0) + (counts["A Tergenang (41-45)"] || 0) + (counts["Banjir (<0)"] || 0);
            const kering = (counts["A Kering (61-65)"] || 0) + (counts["Kering (>65)"] || 0);
            return {
                scenarioMm: scMm,
                counts,
                pct,
                basahCount: basah,
                basahPct: overallTotalPoints > 0 ? (basah / overallTotalPoints) * 100 : 0,
                keringCount: kering,
                keringPct: overallTotalPoints > 0 ? (kering / overallTotalPoints) * 100 : 0
            };
        });

        // Model accuracy metrics across all fitted estates
        const allEstateModels = Object.values(trainedModels.estateModels);
        const overallAvgR2 = allEstateModels.length > 0 ? (allEstateModels.reduce((s, m) => s + m.r2, 0) / allEstateModels.length) : 0.50;
        const overallAvgMae = allEstateModels.length > 0 ? (allEstateModels.reduce((s, m) => s + m.mae, 0) / allEstateModels.length) : 3.5;

        const overall = {
            totalCompanies: companies.length,
            totalPoints: overallTotalPoints,
            baselineAvgTmat: overallTotalPoints > 0 ? sumWeightedTmat / overallTotalPoints : 0,
            baselineCounts: overallBaselineCounts,
            baselinePct: overallBaselinePct,
            scenarios: overallScenarios,
            modelInfo: {
                modelType: '3-Week Memory OLS (Antecedent Moisture)',
                trainingWeeks: weeksChronological.length,
                totalEstatesFitted: allEstateModels.length,
                avgR2: overallAvgR2,
                avgMae: overallAvgMae,
                groupModel: trainedModels.groupModel
            }
        };

        return NextResponse.json({
            success: true,
            targetWeeks,
            baselineWeek,
            scenarios,
            overall,
            companies: companyResults
        });

    } catch (err) {
        console.error('Error in /api/forecast-multi-company:', err);
        return NextResponse.json({ error: err.message }, { status: 500 });
    }
}
