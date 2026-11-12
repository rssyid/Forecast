import pool from '../../../lib/db.js';
import { NextResponse } from 'next/server';
import { processData, parseScenarioInput, CLASS_ORDER, sumValues, mean } from '../../../lib/forecastEngine.js';

export async function GET(request) {
    try {
        const { searchParams } = new URL(request.url);
        const lookbackWeeks = parseInt(searchParams.get('lookbackWeeks')) || 8;
        const scenarioInput = searchParams.get('scenarios') || '0,50';
        const requestedBaselineWeek = searchParams.get('baselineWeek');

        const scenarios = parseScenarioInput(scenarioInput);

        // 1. Fetch available calendar weeks from piezometer data
        const weeksRes = await pool.query(`
            SELECT p.month_name, MAX(cw.start_date) as start_date, MAX(cw.end_date) as end_date 
            FROM piezometer_data p
            LEFT JOIN calendar_weeks cw ON p.month_name = cw.formatted_name
            GROUP BY p.month_name 
            ORDER BY MAX(p.date_timestamp) DESC 
            LIMIT $1 + 1
        `, [lookbackWeeks]);

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

        const targetWeeks = weeksRes.rows.map(r => r.month_name);
        const baselineWeek = requestedBaselineWeek && targetWeeks.includes(requestedBaselineWeek)
            ? requestedBaselineWeek
            : targetWeeks[0];

        // 2. Fetch Piezometer Data for all active points in target weeks
        const pzoRes = await pool.query(`
            SELECT DISTINCT ON (p.company_code, p.pie_record_id, p.month_name)
                   p.company_code,
                   p.est_code, 
                   COALESCE(m.block_id, p.block) as block, 
                   p.pie_record_id, 
                   p.ketinggian, 
                   p.month_name,
                   p.date_timestamp
            FROM piezometer_data p
            LEFT JOIN pzo_master_mapping m ON p.pie_record_id = m.pie_record_id
            WHERE p.month_name = ANY($1)
              AND (m.is_active IS NULL OR m.is_active = true)
            ORDER BY p.company_code, p.pie_record_id, p.month_name, p.date_timestamp DESC
        `, [targetWeeks]);

        // 3. Fetch Estate-level Rainfall
        const estateRainRes = await pool.query(`
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
                SUM(da.daily_avg) as total_rain
            FROM daily_est_avg da
            JOIN calendar_weeks cw ON da.record_date >= cw.start_date AND da.record_date <= cw.end_date
            WHERE cw.formatted_name = ANY($1)
            GROUP BY da.company_code, da.est_code, cw.formatted_name
        `, [targetWeeks]);

        // 4. Fetch Company-level Rainfall
        const coRainRes = await pool.query(`
            WITH daily_company_avg AS (
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
                SUM(da.daily_avg) as total_rain
            FROM daily_company_avg da
            JOIN calendar_weeks cw ON da.record_date >= cw.start_date AND da.record_date <= cw.end_date
            WHERE cw.formatted_name = ANY($1)
            GROUP BY da.company_code, cw.formatted_name
        `, [targetWeeks]);

        // Map Rainfall data
        const companyRainMap = {};
        coRainRes.rows.forEach(r => {
            if (!companyRainMap[r.company_code]) companyRainMap[r.company_code] = {};
            companyRainMap[r.company_code][r.week] = parseFloat(r.total_rain) || 0;
        });

        const estateRainMap = {};
        estateRainRes.rows.forEach(r => {
            if (!estateRainMap[r.company_code]) estateRainMap[r.company_code] = {};
            if (!estateRainMap[r.company_code][r.est_code]) estateRainMap[r.company_code][r.est_code] = {};
            estateRainMap[r.company_code][r.est_code][r.week] = parseFloat(r.total_rain) || 0;
        });

        // Group PZO rows by company
        const pzoByCompany = {};
        pzoRes.rows.forEach(r => {
            if (!r.company_code) return;
            if (!pzoByCompany[r.company_code]) pzoByCompany[r.company_code] = [];
            pzoByCompany[r.company_code].push(r);
        });

        const DB_COL_MAP = {
            week: "month_name",
            tmat: "ketinggian",
            estate: "est_code",
            id: "pie_record_id",
            block: "block",
            date: "date_timestamp"
        };

        const companies = Object.keys(pzoByCompany).sort();
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
            const rawRows = pzoByCompany[comp] || [];
            const compRain = companyRainMap[comp] || {};
            const compEstRain = estateRainMap[comp] || {};

            const processed = processData(
                rawRows,
                DB_COL_MAP,
                compRain,
                scenarios,
                baselineWeek,
                'estate',
                compEstRain
            );

            // Accumulate overall
            const ptCount = processed.baselineTotal || 0;
            overallTotalPoints += ptCount;
            if (ptCount > 0 && Number.isFinite(processed.baselineAvgTMAT)) {
                sumWeightedTmat += (processed.baselineAvgTMAT * ptCount);
            }
            CLASS_ORDER.forEach(c => {
                overallBaselineCounts[c] += (processed.baselineCounts[c] || 0);
            });

            const scenarioList = processed.scenarioResults.map(sc => {
                CLASS_ORDER.forEach(c => {
                    if (overallScenarioCounts[sc.scenarioMm]) {
                        overallScenarioCounts[sc.scenarioMm][c] += (sc.counts[c] || 0);
                    }
                });

                return {
                    scenarioMm: sc.scenarioMm,
                    avgNext: sc.avgNext,
                    dAvg: sc.dAvg,
                    counts: sc.counts,
                    pct: sc.pct,
                    summary: sc.summary
                };
            });

            companyResults.push({
                company: comp,
                baselineWeek: processed.baselineWeek,
                totalPoints: ptCount,
                baselineAvgTmat: processed.baselineAvgTMAT,
                baselineCounts: processed.baselineCounts,
                baselinePct: processed.baselinePct,
                fit: {
                    a: processed.fit.a,
                    b: processed.fit.b,
                    r2: processed.fit.r2,
                    mae: processed.fit.mae,
                    method: processed.fit.method,
                    validEstates: processed.fit.validEstates,
                    totalEstates: processed.fit.totalEstates
                },
                scenarios: scenarioList,
                weeklyHistory: processed.weeklySummaryRecords.map(w => ({
                    week: w.Week,
                    rainMm: w["Rain (mm)"],
                    avgTmat: w["Avg TMAT (cm)"],
                    totalRecords: w["Total Records"]
                }))
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

        const overall = {
            totalCompanies: companies.length,
            totalPoints: overallTotalPoints,
            baselineAvgTmat: overallTotalPoints > 0 ? sumWeightedTmat / overallTotalPoints : 0,
            baselineCounts: overallBaselineCounts,
            baselinePct: overallBaselinePct,
            scenarios: overallScenarios
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
