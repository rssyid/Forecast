export const CLASS_ORDER = ["No Data", "Banjir (<0)", "Tergenang (0-40)", "A Tergenang (41-45)", "Normal (46-60)", "A Kering (61-65)", "Kering (>65)"];
export const CLASS_COLORS = { "No Data": "#B0B8C2", "Banjir (<0)": "#71717A", "Tergenang (0-40)": "#1D4ED8", "A Tergenang (41-45)": "#60A5FA", "Normal (46-60)": "#22C55E", "A Kering (61-65)": "#F59E0B", "Kering (>65)": "#EF4444" };
export const MONTH_MAP = { jan: 1, january: 1, feb: 2, february: 2, mar: 3, march: 3, apr: 4, april: 4, may: 5, jun: 6, june: 6, jul: 7, july: 7, aug: 8, august: 8, sep: 9, sept: 9, september: 9, oct: 10, october: 10, nov: 11, november: 11, dec: 12, december: 12 };
export const COL_CANDIDATES = { week: ["week name", "week_name", "week", "month_name"], estate: ["estate", "nama kebun", "est_code"], id: ["piezorecordid", "pie_record_id", "id"], tmat: ["ketinggian", "tmat", "value"], block: ["block"], date: ["date", "date_timestamp"] };

export function parseWeekName(weekName) {
    const text = String(weekName || "").trim();
    const match = text.match(/([A-Za-z]+)\s+(\d{4})\s*,?\s*W(?:eek)?\s*(\d+)/i);
    if (match) return { year: Number(match[2]), month: MONTH_MAP[match[1].toLowerCase()] || 99, week: Number(match[3]) };
    const nums = text.match(/\d+/g) || [];
    return { year: nums[0] ? Number(nums[0]) : 9999, month: nums[1] ? Number(nums[1]) : 99, week: nums[2] ? Number(nums[2]) : 99 };
}

export function getSortedDistinctWeeks(rows, weekCol) {
    const weeks = [...new Set(rows.map((row) => String(row[weekCol] || "").trim()).filter(Boolean))];
    weeks.sort((a, b) => {
        const pa = parseWeekName(a), pb = parseWeekName(b);
        if (pa.year !== pb.year) return pa.year - pb.year;
        if (pa.month !== pb.month) return pa.month - pb.month;
        if (pa.week !== pb.week) return pa.week - pb.week;
        return String(a).localeCompare(String(b));
    });
    return weeks;
}

export function classifyTMAT(val) { 
    if (!Number.isFinite(val)) return "No Data"; 
    if (val < 0) return "Banjir (<0)"; 
    if (val <= 40) return "Tergenang (0-40)"; 
    if (val <= 45) return "A Tergenang (41-45)"; 
    if (val <= 60) return "Normal (46-60)"; 
    if (val <= 65) return "A Kering (61-65)"; 
    return "Kering (>65)"; 
}

export function sumValues(obj) { return Object.values(obj).reduce((s, v) => s + Number(v || 0), 0); }
export function mean(arr) { return arr.length ? arr.reduce((s, v) => s + v, 0) / arr.length : NaN; }
export function ensureAllClasses(counts) { const out = {}; CLASS_ORDER.forEach(c => out[c] = Number(counts[c] || 0)); return out; }
export function summarizeCounts(c) { 
    const tot = sumValues(c);
    const basah = c["Tergenang (0-40)"] + c["A Tergenang (41-45)"];
    const krg = c["A Kering (61-65)"] + c["Kering (>65)"]; 
    return { 
        "Basah <=45 Count": basah, 
        "Basah <=45 %": tot ? (basah / tot) * 100 : 0, 
        "Kering >60 Count": krg, 
        "Kering >60 %": tot ? (krg / tot) * 100 : 0, 
        Total: tot 
    }; 
}

export function formatNumber(v, d = 1) { return !Number.isFinite(v) ? "-" : new Intl.NumberFormat("en-US", { minimumFractionDigits: d, maximumFractionDigits: d }).format(v); }

export function toNumber(v) { 
    if (v == null) return NaN; 
    if (typeof v === "number") return Number.isFinite(v) && Math.abs(v) !== 999 ? v : NaN; 
    const c = String(v).replace(/,/g, "").trim().toLowerCase(); 
    if (["", "null", "na", "n/a", "nan", "none", "-", "--"].includes(c)) return NaN; 
    const n = Number(c); 
    return Number.isFinite(n) && Math.abs(n) !== 999 ? n : NaN; 
}

export function detectColumns(headers) {
    const headerMap = Object.fromEntries(headers.map((h) => [String(h || "").trim().toLowerCase(), h]));
    const detected = {};
    for (const [key, candidates] of Object.entries(COL_CANDIDATES)) {
        detected[key] = null;
        for (const candidate of candidates) { 
            if (headerMap[candidate.toLowerCase()]) { 
                detected[key] = headerMap[candidate.toLowerCase()]; 
                break; 
            } 
        }
    }
    return detected;
}

export function parseScenarioInput(text) {
    const validValues = [...new Set(String(text || "").split(",").map(i => Number(i.trim())).filter(v => Number.isFinite(v) && v >= 0))];
    if (!validValues.length) throw new Error("Scenario rainfall harus diisi, misalnya 0,50.");
    return validValues;
}

export function fitRainResponse(records, modelType = 'simple') {
    const lastN = records.slice(-4); 
    const fitRows = [];
    
    for (let i = 1; i < lastN.length; i++) { 
        const currentTmat = lastN[i]["Avg TMAT (cm)"];
        const prevTmat = lastN[i - 1]["Avg TMAT (cm)"];
        const currentRain = lastN[i]["Rain (mm)"];
        
        if (Number.isFinite(currentTmat) && Number.isFinite(prevTmat)) {
            let xValue = currentRain;
            
            if (modelType === 'weighted') {
                const prevRain = lastN[i-1]["Rain (mm)"];
                if (Number.isFinite(prevRain)) {
                    xValue = (0.7 * currentRain) + (0.3 * prevRain);
                }
            }

            if (Number.isFinite(xValue)) {
                fitRows.push({ 
                    x: xValue, 
                    y: currentTmat - prevTmat 
                }); 
            }
        }
    }

    let a = 0, b = -0.05, r2 = 0, method = "fallback";

    if (fitRows.length >= 2) {
        const n = fitRows.length;
        const sumX = fitRows.reduce((s, r) => s + r.x, 0);
        const sumY = fitRows.reduce((s, r) => s + r.y, 0);
        const sumXY = fitRows.reduce((s, r) => s + r.x * r.y, 0);
        const sumX2 = fitRows.reduce((s, r) => s + r.x * r.x, 0);
        const sumY2 = fitRows.reduce((s, r) => s + r.y * r.y, 0);
        
        const denom = n * sumX2 - sumX * sumX;
        if (denom !== 0) {
            const tempB = (n * sumXY - sumX * sumY) / denom;
            const tempA = (sumY - tempB * sumX) / n;
            
            const numR = (n * sumXY - sumX * sumY);
            const denR = Math.sqrt((n * sumX2 - sumX * sumX) * (n * sumY2 - sumY * sumY));
            const tempR2 = denR !== 0 ? Math.pow(numR / denR, 2) : 0;

            if (tempB < 0) {
                a = tempA;
                b = Math.max(tempB, -0.8);
                r2 = tempR2;
                method = "fit";
            }
        }
    }

    return { a, b: Math.min(b, -0.001), r2, fitRows, method, modelType };
}

export function forecastCountsFromBaseline(counts, dAvg, total) {
    const out = { ...counts };
    const mag = Math.min(Math.abs(dAvg) / 12, 1); 
    
    if (dAvg >= 0) {
        // Drier
        const m1 = 0.20 * mag, m2 = 0.30 * mag, m3 = 0.35 * mag;
        let s = Math.min(out["Normal (46-60)"] * m1, out["Normal (46-60)"]); out["Normal (46-60)"] -= s; out["A Kering (61-65)"] += s;
        s = Math.min(out["A Kering (61-65)"] * m2, out["A Kering (61-65)"]); out["A Kering (61-65)"] -= s; out["Kering (>65)"] += s;
        [["Tergenang (0-40)", "A Tergenang (41-45)"], ["A Tergenang (41-45)", "Normal (46-60)"]].forEach(([src, dst]) => { 
            const s2 = Math.min(out[src] * m3, out[src]); out[src] -= s2; out[dst] += s2; 
        });
    } else {
        // Wetter
        const m1 = 0.25 * mag, m2 = 0.20 * mag, m3 = 0.12 * mag;
        let s = Math.min(out["Kering (>65)"] * m1, out["Kering (>65)"]); out["Kering (>65)"] -= s; out["A Kering (61-65)"] += s;
        s = Math.min(out["A Kering (61-65)"] * m2, out["A Kering (61-65)"]); out["A Kering (61-65)"] -= s; out["Normal (46-60)"] += s;
        s = Math.min(out["Normal (46-60)"] * m3, out["Normal (46-60)"]); out["Normal (46-60)"] -= s; out["A Tergenang (41-45)"] += s * 0.6; out["Tergenang (0-40)"] += s * 0.4;
    }
    CLASS_ORDER.forEach(c => out[c] = Math.round(out[c]));
    const diff = total - sumValues(out);
    if (diff !== 0) { 
        const adj = CLASS_ORDER.filter(n => !["No Data", "Banjir (<0)"].includes(n)); 
        const best = adj.reduce((b, c) => !b ? c : (out[c] > out[b] ? c : b), null); 
        if (best) out[best] += diff; 
    }
    return ensureAllClasses(out);
}

export function processData(rawRows, detectedCols, rainfallMap, scenarios, baselineWeek, modelType = 'simple', estateRainfall = {}) {
    const rows = rawRows.map((row) => {
        const tmatValue = toNumber(row[detectedCols.tmat]);
        return { ...row, __TMAT_NUM__: tmatValue, TMAT_Class: classifyTMAT(tmatValue) };
    });

    const weeks = getSortedDistinctWeeks(rows, detectedCols.week);
    const effectiveBaselineWeek = baselineWeek || weeks[weeks.length - 1];

    const getWeeklySummary = (subsetRows, specificRainMap = null) => {
        const countsByWeek = {};
        subsetRows.forEach(r => {
            const w = String(r[detectedCols.week] || "").trim();
            if (w) {
                countsByWeek[w] = countsByWeek[w] || {};
                countsByWeek[w][r.TMAT_Class] = (countsByWeek[w][r.TMAT_Class] || 0) + 1;
            }
        });
        
        return weeks.map(week => {
            const counts = ensureAllClasses(countsByWeek[week] || {});
            const values = subsetRows.filter(r => String(r[detectedCols.week] || "").trim() === week).map(r => r.__TMAT_NUM__).filter(Number.isFinite);
            const total = sumValues(counts);
            const rainValue = (specificRainMap && specificRainMap[week] !== undefined) ? specificRainMap[week] : (rainfallMap[week] ?? NaN);
            
            return {
                Week: week,
                "Total Records": total,
                "Avg TMAT (cm)": mean(values),
                "Rain (mm)": rainValue,
                counts
            };
        });
    };

    let fit, scenarioResults;
    const allWeeklySummary = getWeeklySummary(rows);
    const baselineCounts = ensureAllClasses(allWeeklySummary.find(r => r.Week === effectiveBaselineWeek)?.counts || {});
    const baselineTotal = sumValues(baselineCounts);
    const baselinePct = Object.fromEntries(CLASS_ORDER.map(c => [c, baselineTotal ? (baselineCounts[c] / baselineTotal) * 100 : 0]));
    const baselineAvgTMAT = allWeeklySummary.find(r => r.Week === effectiveBaselineWeek)?.["Avg TMAT (cm)"] ?? NaN;

    if (modelType === 'estate') {
        const estates = [...new Set(rows.map(r => String(r[detectedCols.estate] || "Unknown").trim()))];
        const estateModels = estates.map(est => {
            const estRows = rows.filter(r => String(r[detectedCols.estate] || "").trim() === est);
            const estRain = estateRainfall[est] || null;
            const estWeeklySummary = getWeeklySummary(estRows, estRain);
            const estFit = fitRainResponse(estWeeklySummary, 'simple'); 
            const estBaseline = ensureAllClasses(estWeeklySummary.find(r => r.Week === effectiveBaselineWeek)?.counts || {});
            const estBaselineAvg = estWeeklySummary.find(r => r.Week === effectiveBaselineWeek)?.["Avg TMAT (cm)"] ?? NaN;
            return { est, fit: estFit, baselineCounts: estBaseline, baselineAvg: estBaselineAvg, total: sumValues(estBaseline) };
        });

        scenarioResults = scenarios.map(scenarioMm => {
            const aggregatedCounts = {};
            CLASS_ORDER.forEach(c => aggregatedCounts[c] = 0);
            let totalDavg = 0, countDavg = 0;

            estateModels.forEach(em => {
                const dAvg = em.fit.a + em.fit.b * scenarioMm;
                const shifted = forecastCountsFromBaseline(em.baselineCounts, dAvg, em.total);
                CLASS_ORDER.forEach(c => aggregatedCounts[c] += shifted[c]);
                if (em.total > 0) { totalDavg += dAvg; countDavg++; }
            });

            const finalDavg = countDavg > 0 ? totalDavg / countDavg : 0;
            const total = sumValues(aggregatedCounts);
            return { 
                scenarioMm, 
                dAvg: finalDavg, 
                avgNext: baselineAvgTMAT + finalDavg, 
                counts: aggregatedCounts, 
                pct: Object.fromEntries(CLASS_ORDER.map(c => [c, total ? (aggregatedCounts[c] / total) * 100 : 0])),
                summary: summarizeCounts(aggregatedCounts) 
            };
        });

        const validModels = estateModels.filter(m => m.fit.method === 'fit');
        fit = {
            a: mean(validModels.map(m => m.fit.a)) || 0,
            b: mean(validModels.map(m => m.fit.b)) || -0.05,
            r2: mean(validModels.map(m => m.fit.r2)) || 0,
            method: validModels.length > 0 ? 'estate-agg' : 'fallback',
            modelType: 'estate'
        };

    } else {
        fit = fitRainResponse(allWeeklySummary, modelType);
        scenarioResults = scenarios.map((scenarioMm) => {
            const dAvg = fit.a + fit.b * scenarioMm;
            const counts = forecastCountsFromBaseline(baselineCounts, dAvg, baselineTotal);
            const total = sumValues(counts);
            return { 
                scenarioMm, 
                dAvg, 
                avgNext: baselineAvgTMAT + dAvg, 
                counts, 
                pct: Object.fromEntries(CLASS_ORDER.map(c => [c, total ? (counts[c] / total) * 100 : 0])), 
                summary: summarizeCounts(counts) 
            };
        });
    }

    const forecastRows = CLASS_ORDER.map(c => { 
        const r = { "Kelas TMAT": c, "Baseline Count": baselineCounts[c], "Baseline %": baselinePct[c] }; 
        scenarioResults.forEach(res => { 
            r[`CH${res.scenarioMm} Count`] = res.counts[c]; 
            r[`CH${res.scenarioMm} %`] = res.pct[c]; 
        }); 
        return r; 
    });
    
    const bSum = summarizeCounts(baselineCounts);
    const forecastSummaryRows = [
        { Metric: "Basah <=45 Count", Baseline: bSum["Basah <=45 Count"] }, 
        { Metric: "Basah <=45 %", Baseline: bSum["Basah <=45 %"] }, 
        { Metric: "Kering >60 Count", Baseline: bSum["Kering >60 Count"] }, 
        { Metric: "Kering >60 %", Baseline: bSum["Kering >60 %"] }, 
        { Metric: "Total", Baseline: bSum.Total }
    ];
    
    scenarioResults.forEach(res => { 
        forecastSummaryRows[0][`CH${res.scenarioMm}`] = res.summary["Basah <=45 Count"]; 
        forecastSummaryRows[1][`CH${res.scenarioMm}`] = res.summary["Basah <=45 %"]; 
        forecastSummaryRows[2][`CH${res.scenarioMm}`] = res.summary["Kering >60 Count"]; 
        forecastSummaryRows[3][`CH${res.scenarioMm}`] = res.summary["Kering >60 %"]; 
        forecastSummaryRows[4][`CH${res.scenarioMm}`] = res.summary.Total; 
    });

    return { 
        rawRows: rows, detectedCols, weeks, rainfallMap, scenarios, 
        baselineWeek: effectiveBaselineWeek, 
        weeklySummaryRecords: allWeeklySummary.map(s => ({ ...s, "Avg TMAT (cm)": s["Avg TMAT (cm)"], "Rain (mm)": s["Rain (mm)"] })), 
        fit, baselineCounts, baselinePct, baselineTotal, baselineAvgTMAT, scenarioResults, forecastRows, forecastSummaryRows, weeklyCounts: Object.fromEntries(allWeeklySummary.map(w => [w.Week, w.counts])) 
    };
}
