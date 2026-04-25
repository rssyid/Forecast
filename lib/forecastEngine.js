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
    // We now use all available records instead of slicing the last 4
    const fitRows = [];
    
    for (let i = 1; i < records.length; i++) { 
        const currentTmat = records[i]["Avg TMAT (cm)"];
        const prevTmat = records[i - 1]["Avg TMAT (cm)"];
        const currentRain = records[i]["Rain (mm)"];
        
        if (Number.isFinite(currentTmat) && Number.isFinite(prevTmat)) {
            let xValue = currentRain;
            
            if (modelType === 'weighted') {
                const prevRain = records[i-1]["Rain (mm)"];
                if (Number.isFinite(prevRain)) {
                    xValue = (0.7 * currentRain) + (0.3 * prevRain);
                }
            }

            if (Number.isFinite(xValue)) {
                const deltaY = currentTmat - prevTmat;
                // Outlier Filter: Ignore unrealistic weekly jumps (>50cm or <-50cm) to keep the model clean
                if (Math.abs(deltaY) <= 50) {
                    fitRows.push({ 
                        x: xValue, 
                        y: deltaY 
                    }); 
                }
            }
        }
    }

    let a = 0, b = -0.05, r2 = 0, method = "fallback";
    let mae = 0, rmse = 0;

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

            // We only accept valid linear fits where rain decreases TMAT distance (negative correlation)
            if (tempB < 0) {
                a = tempA;
                b = tempB; // No longer capping at -0.8
                r2 = tempR2;
                method = "fit";
                
                // Calculate Accuracy Metrics (MAE & RMSE)
                let sumAbsError = 0;
                let sumSqError = 0;
                fitRows.forEach(r => {
                    const predictedY = a + b * r.x;
                    const error = r.y - predictedY;
                    sumAbsError += Math.abs(error);
                    sumSqError += error * error;
                });
                mae = sumAbsError / n;
                rmse = Math.sqrt(sumSqError / n);
            }
        }
    }

    return { a, b: Math.min(b, -0.001), r2, mae, rmse, fitRows, method, modelType };
}

// Deprecated: No longer used for granular model, kept for backwards compatibility if needed
export function forecastCountsFromBaseline(counts, dAvg, total) {
    const out = { ...counts };
    return out;
}

export function processData(rawRows, detectedCols, rainfallMap, scenarios, baselineWeek, modelType = 'estate', estateRainfall = {}) {
    const rows = rawRows.map((row) => {
        const tmatValue = toNumber(row[detectedCols.tmat]);
        return { ...row, __TMAT_NUM__: tmatValue, TMAT_Class: classifyTMAT(tmatValue) };
    });

    const weeks = getSortedDistinctWeeks(rows, detectedCols.week);
    const effectiveBaselineWeek = baselineWeek || weeks[weeks.length - 1];
    const baselineRows = rows.filter(r => String(r[detectedCols.week] || "").trim() === effectiveBaselineWeek && Number.isFinite(r.__TMAT_NUM__));

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
    
    // Baseline metrics
    const baselineCounts = ensureAllClasses({});
    baselineRows.forEach(r => {
        baselineCounts[r.TMAT_Class] = (baselineCounts[r.TMAT_Class] || 0) + 1;
    });
    const baselineTotal = baselineRows.length;
    const baselinePct = Object.fromEntries(CLASS_ORDER.map(c => [c, baselineTotal ? (baselineCounts[c] / baselineTotal) * 100 : 0]));
    const baselineAvgTMAT = mean(baselineRows.map(r => r.__TMAT_NUM__));

    // For the granular estate-based model
    const R2_THRESHOLD = 0.10; // Minimum R² to trust an estate model
    const estates = [...new Set(rows.map(r => String(r[detectedCols.estate] || "Unknown").trim()))];
    const estateModels = estates.map(est => {
        const estRows = rows.filter(r => String(r[detectedCols.estate] || "").trim() === est);
        const estRain = estateRainfall[est] || null;
        const estWeeklySummary = getWeeklySummary(estRows, estRain);
        const estFit = fitRainResponse(estWeeklySummary, 'simple'); 
        return { est, fit: estFit };
    });

    // Only trust estate models with sufficient R²
    const validModels = estateModels.filter(m => m.fit.method === 'fit' && m.fit.r2 >= R2_THRESHOLD);
    fit = {
        a: mean(validModels.map(m => m.fit.a)) || 0,
        b: mean(validModels.map(m => m.fit.b)) || -0.05,
        r2: mean(validModels.map(m => m.fit.r2)) || 0,
        mae: mean(validModels.map(m => m.fit.mae)) || 0,
        rmse: mean(validModels.map(m => m.fit.rmse)) || 0,
        method: validModels.length > 0 ? 'estate-agg' : 'fallback',
        modelType: 'estate',
        totalEstates: estates.length,
        validEstates: validModels.length
    };

    scenarioResults = scenarios.map(scenarioMm => {
        const aggregatedCounts = {};
        CLASS_ORDER.forEach(c => aggregatedCounts[c] = 0);
        let totalDavg = 0, countDavg = 0;
        let sumNextTmat = 0;
        let validPoints = 0;

        // Stage 2 & 3: Apply the exact predicted Delta to every single piezometer!
        baselineRows.forEach(row => {
            const est = String(row[detectedCols.estate] || "Unknown").trim();
            const estModel = estateModels.find(m => m.est === est);
            
            // Calculate delta TMAT for this specific estate
            let dAvg = 0;
            if (estModel && estModel.fit.method === 'fit' && estModel.fit.r2 >= R2_THRESHOLD) {
                // Use estate-specific model only if it passes the quality threshold
                dAvg = estModel.fit.a + estModel.fit.b * scenarioMm;
            } else {
                // Fallback to global average from high-quality models
                dAvg = fit.a + fit.b * scenarioMm;
            }

            // Physical sanity check: rain (>0mm) should NOT make TMAT drier (positive delta)
            // If scenario has rain but model predicts drying, clamp to 0 (no change)
            if (scenarioMm > 0 && dAvg > 0) {
                dAvg = 0;
            }

            // Stage 3 & 4: New TMAT value and Re-Classification
            const nextTmatValue = row.__TMAT_NUM__ + dAvg;
            const nextClass = classifyTMAT(nextTmatValue);
            
            aggregatedCounts[nextClass]++;
            sumNextTmat += nextTmatValue;
            validPoints++;
            totalDavg += dAvg; 
            countDavg++;
        });

        const finalDavg = countDavg > 0 ? totalDavg / countDavg : 0;
        const total = sumValues(aggregatedCounts);
        const avgNext = validPoints > 0 ? sumNextTmat / validPoints : baselineAvgTMAT;

        return { 
            scenarioMm, 
            dAvg: finalDavg, 
            avgNext: avgNext, 
            counts: aggregatedCounts, 
            pct: Object.fromEntries(CLASS_ORDER.map(c => [c, total ? (aggregatedCounts[c] / total) * 100 : 0])),
            summary: summarizeCounts(aggregatedCounts) 
        };
    });

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
