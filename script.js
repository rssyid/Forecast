// Konfigurasi & State
const CLASS_ORDER = [
    "No Data",
    "Banjir (<0)",
    "Tergenang (0-40)",
    "A Tergenang (41-45)",
    "Normal (46-60)",
    "A Kering (61-65)",
    "Kering (>65)",
];

const CLASS_COLORS = {
    "No Data": "#B0B8C2",
    "Banjir (<0)": "#000000", /* Warna hitam untuk banjir */
    "Tergenang (0-40)": "#1D4ED8",
    "A Tergenang (41-45)": "#60A5FA",
    "Normal (46-60)": "#22C55E",
    "A Kering (61-65)": "#F59E0B",
    "Kering (>65)": "#EF4444",
};

const MONTH_MAP = {
    jan: 1, january: 1, feb: 2, february: 2, mar: 3, march: 3, apr: 4, april: 4,
    may: 5, jun: 6, june: 6, jul: 7, july: 7, aug: 8, august: 8, sep: 9, sept: 9, september: 9,
    oct: 10, october: 10, nov: 11, november: 11, dec: 12, december: 12,
};

const COL_CANDIDATES = {
    week: ["week name", "week_name", "week"],
    estate: ["estate", "nama kebun"],
    id: ["piezorecordid", "piezorecordid", "id"],
    tmat: ["ketinggian", "tmat", "value"],
    block: ["block"],
    date: ["date"],
};

const state = {
    rawRows: [],
    detectedCols: null,
    weeks: [],
    processed: null,
    charts: {
        trend: null,
        dist: null,
    },
};

// DOM Elements
const csvFileEl = document.getElementById("csvFile");
const baselineWeekEl = document.getElementById("baselineWeek");
const scenarioInputEl = document.getElementById("scenarioInput");
const processBtnEl = document.getElementById("processBtn");
const exportExcelBtnEl = document.getElementById("exportExcelBtn");
const statusBoxEl = document.getElementById("statusBox");
const rainfallTableWrapEl = document.getElementById("rainfallTableWrap");
const mappingSummaryEl = document.getElementById("mappingSummary");
const resultsSectionEl = document.getElementById("resultsSection");
const weeklySummaryWrapEl = document.getElementById("weeklySummaryWrap");
const baselineWrapEl = document.getElementById("baselineWrap");
const forecastWrapEl = document.getElementById("forecastWrap");
const forecastSummaryWrapEl = document.getElementById("forecastSummaryWrap");
const modelSummaryEl = document.getElementById("modelSummary");
const downloadTemplateBtnEl = document.getElementById("downloadTemplateBtn");

// AI Elements
const generateAiBtnEl = document.getElementById("generateAiBtn");
const userContextEl = document.getElementById("userContext");
const wmActionsEl = document.getElementById("wmActions");
const aiOutputWrapEl = document.getElementById("aiOutputWrap");

// Event Listeners
csvFileEl.addEventListener("change", handleFileUpload);
processBtnEl.addEventListener("click", handleProcess);
exportExcelBtnEl.addEventListener("click", handleExportExcel);
downloadTemplateBtnEl.addEventListener("click", handleDownloadTemplate);
generateAiBtnEl.addEventListener("click", handleGenerateAIReport);

// ==========================================
// UTILITIES & LOGIKA CSV (FRONTEND)
// ==========================================
function setStatus(message, type = "neutral") {
    statusBoxEl.textContent = message;
    statusBoxEl.className = `status ${type}`;
}

function handleFileUpload(event) {
    const file = event.target.files[0];
    if (!file) return;

    Papa.parse(file, {
        header: true,
        skipEmptyLines: true,
        complete: (results) => {
            try {
                if (!Array.isArray(results.data) || !results.data.length) {
                    throw new Error("CSV kosong atau tidak terbaca.");
                }

                const cleanedRows = results.data.filter((row) => {
                    return Object.values(row).some((value) => String(value ?? "").trim() !== "");
                });

                const detectedCols = detectColumns(results.meta.fields || []);
                validateRequiredColumns(detectedCols);

                state.rawRows = cleanedRows;
                state.detectedCols = detectedCols;
                state.weeks = getSortedDistinctWeeks(cleanedRows, detectedCols.week);
                state.processed = null;

                renderColumnMapping(detectedCols, results.meta.fields || []);
                renderRainfallInputs(state.weeks);
                renderBaselineOptions(state.weeks);

                processBtnEl.disabled = false;
                exportExcelBtnEl.disabled = true;
                resultsSectionEl.classList.add("hidden");

                const latestWeek = state.weeks[state.weeks.length - 1] || "-";
                setStatus(`CSV berhasil dibaca. Total row: ${cleanedRows.length}. Latest week: ${latestWeek}.`, "success");
            } catch (error) {
                console.error(error);
                setStatus(error.message || "Gagal membaca CSV.", "warn");
                processBtnEl.disabled = true;
                exportExcelBtnEl.disabled = true;
                mappingSummaryEl.innerHTML = '<div class="empty-state">Gagal mendeteksi header CSV.</div>';
                rainfallTableWrapEl.innerHTML = '<div class="empty-state">Upload CSV yang valid.</div>';
            }
        },
        error: (error) => {
            console.error(error);
            setStatus("Terjadi error saat parsing CSV.", "warn");
        },
    });
}

function detectColumns(headers) {
    const headerMap = Object.fromEntries(headers.map((header) => [normalizeHeader(header), header]));
    const detected = {};

    for (const [key, candidates] of Object.entries(COL_CANDIDATES)) {
        detected[key] = null;
        for (const candidate of candidates) {
            if (headerMap[normalizeHeader(candidate)]) {
                detected[key] = headerMap[normalizeHeader(candidate)];
                break;
            }
        }
    }

    return detected;
}

function normalizeHeader(value) {
    return String(value || "").trim().toLowerCase();
}

function validateRequiredColumns(detectedCols) {
    const missing = [];
    if (!detectedCols.week) missing.push("Week Name");
    if (!detectedCols.tmat) missing.push("Ketinggian / TMAT");
    if (missing.length) {
        throw new Error(`Kolom wajib tidak ditemukan: ${missing.join(", ")}.`);
    }
}

function renderColumnMapping(detectedCols, headers) {
    const rows = [
        ["Week", detectedCols.week],
        ["TMAT", detectedCols.tmat],
        ["Estate", detectedCols.estate],
        ["Piezo ID", detectedCols.id],
        ["Block", detectedCols.block],
        ["Date", detectedCols.date],
    ];

    mappingSummaryEl.innerHTML = rows
        .map(([label, value]) => `
      <div class="mapping-row">
        <div class="mapping-label">${escapeHtml(label)}</div>
        <div class="mapping-value">${escapeHtml(value || "Tidak terdeteksi")}</div>
      </div>
    `)
        .join("");
}

function getSortedDistinctWeeks(rows, weekCol) {
    const weeks = [...new Set(rows.map((row) => String(row[weekCol] || "").trim()).filter(Boolean))];
    weeks.sort(compareWeekName);
    return weeks;
}

function parseWeekName(weekName) {
    const text = String(weekName || "").trim();
    const match = text.match(/([A-Za-z]+)\s+(\d{4})\s*,?\s*W(?:eek)?\s*(\d+)/i);
    if (match) {
        return {
            year: Number(match[2]),
            month: MONTH_MAP[match[1].toLowerCase()] || 99,
            week: Number(match[3]),
            raw: text,
        };
    }

    const nums = text.match(/\d+/g) || [];
    return {
        year: nums[0] ? Number(nums[0]) : 9999,
        month: nums[1] ? Number(nums[1]) : 99,
        week: nums[2] ? Number(nums[2]) : 99,
        raw: text,
    };
}

function compareWeekName(a, b) {
    const pa = parseWeekName(a);
    const pb = parseWeekName(b);

    if (pa.year !== pb.year) return pa.year - pb.year;
    if (pa.month !== pb.month) return pa.month - pb.month;
    if (pa.week !== pb.week) return pa.week - pb.week;
    return String(a).localeCompare(String(b));
}

function renderBaselineOptions(weeks) {
    baselineWeekEl.innerHTML = weeks
        .map((week, index) => `<option value="${escapeHtml(week)}" ${index === weeks.length - 1 ? "selected" : ""}>${escapeHtml(week)}</option>`)
        .join("");
    baselineWeekEl.disabled = !weeks.length;
}

function renderRainfallInputs(weeks) {
    if (!weeks.length) {
        rainfallTableWrapEl.innerHTML = '<div class="empty-state">Week Name tidak ditemukan.</div>';
        return;
    }

    const rows = weeks
        .map((week) => `
      <tr>
        <td>${escapeHtml(week)}</td>
        <td><input type="number" class="rain-input" step="any" data-week="${escapeHtmlAttr(week)}" placeholder="0" /></td>
      </tr>
    `)
        .join("");

    rainfallTableWrapEl.innerHTML = `
    <table class="table">
      <thead>
        <tr>
          <th>Week Name</th>
          <th>Rainfall (mm)</th>
        </tr>
      </thead>
      <tbody>${rows}</tbody>
    </table>
  `;
}

function handleProcess() {
    try {
        if (!state.rawRows.length || !state.detectedCols) {
            throw new Error("Upload CSV terlebih dahulu.");
        }

        const rainfallMap = getRainfallMapFromInputs();
        const scenarios = parseScenarioInput(scenarioInputEl.value);
        const baselineWeek = baselineWeekEl.value;
        const processed = processData(state.rawRows, state.detectedCols, rainfallMap, scenarios, baselineWeek);

        state.processed = processed;

        renderModelSummary(processed);
        renderTables(processed);
        renderCharts(processed);

        resultsSectionEl.classList.remove("hidden");
        exportExcelBtnEl.disabled = false;
        setStatus(`Process selesai. Baseline week: ${processed.baselineWeek}.`, "success");
    } catch (error) {
        console.error(error);
        setStatus(error.message || "Gagal memproses data.", "warn");
    }
}

function getRainfallMapFromInputs() {
    const rainfallMap = {};
    document.querySelectorAll(".rain-input").forEach((input) => {
        const week = input.dataset.week;
        const value = input.value.trim();
        rainfallMap[week] = value === "" ? NaN : Number(value);
    });
    return rainfallMap;
}

function parseScenarioInput(text) {
    const values = String(text || "")
        .split(",")
        .map((item) => item.trim())
        .filter(Boolean)
        .map((item) => Number(item));

    const validValues = [...new Set(values.filter((value) => Number.isFinite(value) && value >= 0))];
    if (!validValues.length) {
        throw new Error("Scenario rainfall harus diisi, misalnya 0,50.");
    }
    return validValues;
}

function processData(rawRows, detectedCols, rainfallMap, scenarios, baselineWeek) {
    const rows = rawRows.map((row) => {
        const tmatValue = toNumber(row[detectedCols.tmat]);
        return {
            ...row,
            __TMAT_NUM__: tmatValue,
            TMAT_Class: classifyTMAT(tmatValue),
        };
    });

    const weeks = getSortedDistinctWeeks(rows, detectedCols.week);
    const weeklyCounts = buildWeeklyCounts(rows, detectedCols.week);
    const weeklyPct = {};
    const weeklySummaryRecords = [];

    weeks.forEach((week) => {
        const counts = ensureAllClasses(weeklyCounts[week] || {});
        const weekRows = rows.filter((row) => String(row[detectedCols.week] || "").trim() === week);
        const values = weekRows.map((row) => row.__TMAT_NUM__).filter((value) => Number.isFinite(value));
        const total = Object.values(counts).reduce((sum, value) => sum + value, 0);
        const pct = {};

        CLASS_ORDER.forEach((className) => {
            pct[className] = total ? (counts[className] / total) * 100 : 0;
        });

        weeklyPct[week] = pct;

        const basah = counts["Tergenang (0-40)"] + counts["A Tergenang (41-45)"];
        const kering60 = counts["A Kering (61-65)"] + counts["Kering (>65)"];

        weeklySummaryRecords.push({
            Week: week,
            "Total Records": total,
            "Avg TMAT (cm)": mean(values),
            "Min TMAT (cm)": min(values),
            "Max TMAT (cm)": max(values),
            StdDev: stddev(values),
            "Basah <=45 (count)": basah,
            "Basah <=45 (%)": total ? (basah / total) * 100 : 0,
            "Kering >60 (count)": kering60,
            "Kering >60 (%)": total ? (kering60 / total) * 100 : 0,
            "Rain (mm)": Number.isFinite(rainfallMap[week]) ? rainfallMap[week] : NaN,
        });
    });

    const fit = fitRainResponse(weeklySummaryRecords);
    const effectiveBaselineWeek = baselineWeek || weeks[weeks.length - 1];
    const baselineCounts = ensureAllClasses(weeklyCounts[effectiveBaselineWeek] || {});
    const baselineTotal = sumValues(baselineCounts);
    const baselinePct = {};
    CLASS_ORDER.forEach((className) => {
        baselinePct[className] = baselineTotal ? (baselineCounts[className] / baselineTotal) * 100 : 0;
    });

    const baselineSummaryRow = weeklySummaryRecords.find((row) => row.Week === effectiveBaselineWeek);
    const baselineAvgTMAT = baselineSummaryRow ? baselineSummaryRow["Avg TMAT (cm)"] : NaN;

    const scenarioResults = scenarios.map((scenarioMm) => {
        const dAvg = fit.a + fit.b * scenarioMm;
        const avgNext = baselineAvgTMAT + dAvg;
        const counts = forecastCountsFromBaseline(baselineCounts, dAvg, baselineTotal);
        const total = sumValues(counts);
        const pct = {};
        CLASS_ORDER.forEach((className) => {
            pct[className] = total ? (counts[className] / total) * 100 : 0;
        });

        return {
            scenarioMm,
            dAvg,
            avgNext,
            counts,
            pct,
            summary: summarizeCounts(counts),
        };
    });

    const forecastRows = CLASS_ORDER.map((className) => {
        const row = {
            "Kelas TMAT": className,
            "Baseline Count": baselineCounts[className],
            "Baseline %": baselinePct[className],
        };

        scenarioResults.forEach((result) => {
            row[`CH${result.scenarioMm} Count`] = result.counts[className];
            row[`CH${result.scenarioMm} %`] = result.pct[className];
        });

        return row;
    });

    const forecastSummaryRows = [
        { Metric: "Basah <=45 Count", Baseline: summarizeCounts(baselineCounts)["Basah <=45 Count"] },
        { Metric: "Basah <=45 %", Baseline: summarizeCounts(baselineCounts)["Basah <=45 %"] },
        { Metric: "Kering >60 Count", Baseline: summarizeCounts(baselineCounts)["Kering >60 Count"] },
        { Metric: "Kering >60 %", Baseline: summarizeCounts(baselineCounts)["Kering >60 %"] },
        { Metric: "Total", Baseline: summarizeCounts(baselineCounts).Total },
    ];

    scenarioResults.forEach((result) => {
        forecastSummaryRows[0][`CH${result.scenarioMm}`] = result.summary["Basah <=45 Count"];
        forecastSummaryRows[1][`CH${result.scenarioMm}`] = result.summary["Basah <=45 %"];
        forecastSummaryRows[2][`CH${result.scenarioMm}`] = result.summary["Kering >60 Count"];
        forecastSummaryRows[3][`CH${result.scenarioMm}`] = result.summary["Kering >60 %"];
        forecastSummaryRows[4][`CH${result.scenarioMm}`] = result.summary.Total;
    });

    return {
        rawRows: rows,
        detectedCols,
        weeks,
        rainfallMap,
        scenarios,
        baselineWeek: effectiveBaselineWeek,
        weeklyCounts,
        weeklyPct,
        weeklySummaryRecords,
        fit,
        baselineCounts,
        baselinePct,
        baselineTotal,
        baselineAvgTMAT,
        scenarioResults,
        forecastRows,
        forecastSummaryRows,
    };
}

function buildWeeklyCounts(rows, weekCol) {
    const weeklyCounts = {};
    rows.forEach((row) => {
        const week = String(row[weekCol] || "").trim();
        if (!week) return;
        if (!weeklyCounts[week]) weeklyCounts[week] = {};
        const className = row.TMAT_Class;
        weeklyCounts[week][className] = (weeklyCounts[week][className] || 0) + 1;
    });
    return weeklyCounts;
}

function ensureAllClasses(counts) {
    const out = {};
    CLASS_ORDER.forEach((className) => {
        out[className] = Number(counts[className] || 0);
    });
    return out;
}

function classifyTMAT(value) {
    if (!Number.isFinite(value)) return "No Data";
    if (value < 0) return "Banjir (<0)";
    if (value >= 0 && value <= 40) return "Tergenang (0-40)";
    if (value >= 41 && value <= 45) return "A Tergenang (41-45)";
    if (value >= 46 && value <= 60) return "Normal (46-60)";
    if (value >= 61 && value <= 65) return "A Kering (61-65)";
    if (value > 65) return "Kering (>65)";
    return "No Data";
}

function fitRainResponse(weeklySummaryRecords) {
    const lastN = weeklySummaryRecords.slice(-Math.max(3, 2));
    const fitRows = [];

    for (let i = 1; i < lastN.length; i += 1) {
        const prev = lastN[i - 1];
        const curr = lastN[i];
        if (!Number.isFinite(prev["Avg TMAT (cm)"]) || !Number.isFinite(curr["Avg TMAT (cm)"])) continue;
        if (!Number.isFinite(curr["Rain (mm)"])) continue;

        fitRows.push({
            x: curr["Rain (mm)"],
            y: curr["Avg TMAT (cm)"] - prev["Avg TMAT (cm)"],
        });
    }

    let a;
    let b;
    let method = "fit";

    if (fitRows.length >= 2 && hasVariance(fitRows.map((row) => row.x))) {
        const n = fitRows.length;
        const sumX = fitRows.reduce((sum, row) => sum + row.x, 0);
        const sumY = fitRows.reduce((sum, row) => sum + row.y, 0);
        const sumXY = fitRows.reduce((sum, row) => sum + row.x * row.y, 0);
        const sumX2 = fitRows.reduce((sum, row) => sum + row.x * row.x, 0);
        const denom = n * sumX2 - sumX * sumX;

        if (denom !== 0) {
            b = (n * sumXY - sumX * sumY) / denom;
            a = (sumY - b * sumX) / n;
        }
    }

    if (!Number.isFinite(a) || !Number.isFinite(b)) {
        const lastTwo = weeklySummaryRecords.slice(-2);
        const d = lastTwo.length === 2
            ? (lastTwo[1]["Avg TMAT (cm)"] - lastTwo[0]["Avg TMAT (cm)"])
            : 0;
        a = Number.isFinite(d) ? d : 0;
        b = -0.05;
        method = "fallback";
    }

    b = Math.min(b, -0.001);

    return {
        a,
        b,
        fitRows,
        method,
    };
}

function forecastCountsFromBaseline(counts, deltaAvgCm, baselineTotal) {
    const out = { ...counts };
    const mag = Math.min(Math.abs(deltaAvgCm) / 10, 1);

    if (deltaAvgCm >= 0) {
        const m1 = 0.25 * mag;
        const m2 = 0.35 * mag;
        const m3 = 0.4 * mag;

        let shift = Math.min(out["Normal (46-60)"] * m1, out["Normal (46-60)"]);
        out["Normal (46-60)"] -= shift;
        out["A Kering (61-65)"] += shift;

        shift = Math.min(out["A Kering (61-65)"] * m2, out["A Kering (61-65)"]);
        out["A Kering (61-65)"] -= shift;
        out["Kering (>65)"] += shift;

        [["Tergenang (0-40)", "A Tergenang (41-45)"], ["A Tergenang (41-45)", "Normal (46-60)"]].forEach(([src, dst]) => {
            const s = Math.min(out[src] * m3, out[src]);
            out[src] -= s;
            out[dst] += s;
        });
    } else {
        const m1 = 0.3 * mag;
        const m2 = 0.25 * mag;
        const m3 = 0.15 * mag;

        let shift = Math.min(out["Kering (>65)"] * m1, out["Kering (>65)"]);
        out["Kering (>65)"] -= shift;
        out["A Kering (61-65)"] += shift;

        shift = Math.min(out["A Kering (61-65)"] * m2, out["A Kering (61-65)"]);
        out["A Kering (61-65)"] -= shift;
        out["Normal (46-60)"] += shift;

        shift = Math.min(out["Normal (46-60)"] * m3, out["Normal (46-60)"]);
        out["Normal (46-60)"] -= shift;
        out["A Tergenang (41-45)"] += shift * 0.6;
        out["Tergenang (0-40)"] += shift * 0.4;
    }

    CLASS_ORDER.forEach((className) => {
        out[className] = Math.round(out[className]);
    });

    const currentTotal = sumValues(out);
    const diff = baselineTotal - currentTotal;
    if (diff !== 0) {
        const adjustableClasses = CLASS_ORDER.filter((name) => !["No Data", "Banjir (<0)"].includes(name));
        const largestClass = adjustableClasses.reduce((best, className) => {
            if (!best) return className;
            return out[className] > out[best] ? className : best;
        }, null);
        if (largestClass) {
            out[largestClass] += diff;
        }
    }

    return ensureAllClasses(out);
}

function summarizeCounts(counts) {
    const total = sumValues(counts);
    const basah = counts["Tergenang (0-40)"] + counts["A Tergenang (41-45)"];
    const kering60 = counts["A Kering (61-65)"] + counts["Kering (>65)"];
    return {
        "Basah <=45 Count": basah,
        "Basah <=45 %": total ? (basah / total) * 100 : 0,
        "Kering >60 Count": kering60,
        "Kering >60 %": total ? (kering60 / total) * 100 : 0,
        Total: total,
    };
}

function renderModelSummary(processed) {
    const cards = [
        ["Baseline Week", processed.baselineWeek],
        ["Baseline Avg TMAT", formatNumber(processed.baselineAvgTMAT, 2)],
        ["Koefisien a", formatNumber(processed.fit.a, 3)],
        ["Koefisien b", formatNumber(processed.fit.b, 4)],
        ["Metode", processed.fit.method],
    ];

    modelSummaryEl.innerHTML = cards
        .map(([label, value]) => `
      <div class="metric">
        <div class="metric-label">${escapeHtml(label)}</div>
        <div class="metric-value">${escapeHtml(String(value))}</div>
      </div>
    `)
        .join("");
}

function renderTables(processed) {
    weeklySummaryWrapEl.innerHTML = renderTable(
        processed.weeklySummaryRecords.map((row) => ({
            Week: row.Week,
            "Total Records": row["Total Records"],
            "Avg TMAT (cm)": row["Avg TMAT (cm)"],
            "Min TMAT (cm)": row["Min TMAT (cm)"],
            "Max TMAT (cm)": row["Max TMAT (cm)"],
            StdDev: row.StdDev,
            "Basah <=45 (count)": row["Basah <=45 (count)"],
            "Basah <=45 (%)": row["Basah <=45 (%)"],
            "Kering >60 (count)": row["Kering >60 (count)"],
            "Kering >60 (%)": row["Kering >60 (%)"],
            "Rain (mm)": row["Rain (mm)"],
        }))
    );

    const baselineRows = CLASS_ORDER.map((className) => ({
        "Kelas TMAT": className,
        Count: processed.baselineCounts[className],
        "%": processed.baselinePct[className],
    }));
    baselineWrapEl.innerHTML = renderTable(baselineRows);

    forecastWrapEl.innerHTML = renderTable(processed.forecastRows);
    forecastSummaryWrapEl.innerHTML = renderTable(processed.forecastSummaryRows);
}

function renderTable(rows) {
    if (!rows.length) {
        return '<div class="empty-state">Tidak ada data.</div>';
    }

    const columns = Object.keys(rows[0]);
    const thead = `
    <thead>
      <tr>${columns.map((col) => `<th>${escapeHtml(col)}</th>`).join("")}</tr>
    </thead>
  `;

    const tbody = `
    <tbody>
      ${rows.map((row) => `
        <tr>
          ${columns.map((col, index) => `<td>${formatCell(row[col], index === 0 && col.toLowerCase().includes("kelas") ? col : null)}</td>`).join("")}
        </tr>
      `).join("")}
    </tbody>
  `;

    return `<table class="table">${thead}${tbody}</table>`;
}

function formatCell(value, classCol) {
    if (classCol && CLASS_COLORS[value]) {
        return `<span class="class-chip" style="background:${CLASS_COLORS[value]}22;color:${CLASS_COLORS[value]};">${escapeHtml(String(value))}</span>`;
    }
    if (typeof value === "number") {
        return Number.isInteger(value) ? escapeHtml(String(value)) : escapeHtml(formatNumber(value, 1));
    }
    return escapeHtml(String(value ?? ""));
}

function renderCharts(processed) {
    const trendCtx = document.getElementById("trendChart");
    const distCtx = document.getElementById("distChart");

    if (state.charts.trend) state.charts.trend.destroy();
    if (state.charts.dist) state.charts.dist.destroy();

    state.charts.trend = new Chart(trendCtx, {
        type: "bar",
        data: {
            labels: processed.weeks,
            datasets: [
                {
                    type: "bar",
                    label: "Rainfall (mm)",
                    data: processed.weeklySummaryRecords.map((row) => Number.isFinite(row["Rain (mm)"]) ? row["Rain (mm)"] : null),
                    yAxisID: "y1",
                },
                {
                    type: "line",
                    label: "Avg TMAT (cm)",
                    data: processed.weeklySummaryRecords.map((row) => row["Avg TMAT (cm)"]),
                    yAxisID: "y",
                    tension: 0.25,
                },
            ],
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            interaction: { mode: "index", intersect: false },
            plugins: { legend: { position: "top" } },
            scales: {
                y: {
                    type: "linear",
                    position: "left",
                    title: { display: true, text: "Avg TMAT (cm)" },
                },
                y1: {
                    type: "linear",
                    position: "right",
                    grid: { drawOnChartArea: false },
                    title: { display: true, text: "Rainfall (mm)" },
                },
            },
        },
    });

    const distDatasets = [
        {
            label: "Baseline %",
            data: CLASS_ORDER.map((className) => processed.baselinePct[className]),
        },
        ...processed.scenarioResults.map((result) => ({
            label: `CH${result.scenarioMm} %`,
            data: CLASS_ORDER.map((className) => result.pct[className]),
        })),
    ];

    state.charts.dist = new Chart(distCtx, {
        type: "bar",
        data: {
            labels: CLASS_ORDER,
            datasets: distDatasets,
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: { legend: { position: "top" } },
            scales: {
                y: {
                    beginAtZero: true,
                    title: { display: true, text: "Percent (%)" },
                },
            },
        },
    });
}

function handleExportExcel() {
    try {
        if (!state.processed) {
            throw new Error("Belum ada hasil yang bisa diexport.");
        }

        const wb = XLSX.utils.book_new();
        const p = state.processed;

        const rawSheetRows = p.rawRows.map((row) => {
            const out = { ...row };
            out.__TMAT_NUM__ = row.__TMAT_NUM__;
            out.TMAT_Class = row.TMAT_Class;
            return out;
        });

        appendJsonSheet(wb, rawSheetRows, "Raw");
        appendJsonSheet(wb, p.weeklySummaryRecords, "WeeklySummary");

        const weeklyCountRows = p.weeks.map((week) => ({ Week: week, ...ensureAllClasses(p.weeklyCounts[week]) }));
        appendJsonSheet(wb, weeklyCountRows, "WeeklyCounts");

        const weeklyPctRows = p.weeks.map((week) => ({
            Week: week,
            ...Object.fromEntries(CLASS_ORDER.map((className) => [className, p.weeklyPct[week][className]])),
        }));
        appendJsonSheet(wb, weeklyPctRows, "WeeklyPct");

        const baselineSheet = XLSX.utils.aoa_to_sheet([
            ["Baseline Week", p.baselineWeek],
            [],
            ["Kelas TMAT", "Count", "%"],
            ...CLASS_ORDER.map((className) => [className, p.baselineCounts[className], p.baselinePct[className]]),
        ]);
        XLSX.utils.book_append_sheet(wb, baselineSheet, "Baseline");

        appendJsonSheet(wb, p.forecastRows, "Forecast");
        appendJsonSheet(wb, p.forecastSummaryRows, "ForecastSummary");

        const modelRows = [
            { Parameter: "a", Value: p.fit.a },
            { Parameter: "b", Value: p.fit.b },
            { Parameter: "method", Value: p.fit.method },
            { Parameter: "baseline_week", Value: p.baselineWeek },
            { Parameter: "baseline_avg_tmat", Value: p.baselineAvgTMAT },
            ...p.scenarioResults.map((result) => ({ Parameter: `CH${result.scenarioMm}_avg_next`, Value: result.avgNext })),
            ...p.scenarioResults.map((result) => ({ Parameter: `CH${result.scenarioMm}_dAvg`, Value: result.dAvg })),
        ];
        appendJsonSheet(wb, modelRows, "Model");

        const filename = `TMAT_Forecast_${slugify(p.baselineWeek || "baseline")}.xlsx`;
        XLSX.writeFile(wb, filename);
        setStatus(`Excel berhasil diexport: ${filename}`, "success");
    } catch (error) {
        console.error(error);
        setStatus(error.message || "Gagal export Excel.", "warn");
    }
}

function appendJsonSheet(wb, rows, name) {
    const safeRows = rows.length ? rows : [{ Info: "No Data" }];
    const ws = XLSX.utils.json_to_sheet(safeRows);
    XLSX.utils.book_append_sheet(wb, ws, name);
}

function handleDownloadTemplate() {
    const csv = [
        ["Data Taken", "Estate", "Block", "PiezoRecordID", "Ketinggian", "Indicator Name", "Indicator Alias", "Week Name", "Date"],
        ["From Android", "THP20", "64-19", "AGT-10", "71", ">65", "Kering(Dry)", "Apr 2026, W1", "04/01/2026 08:27:00"],
    ].map((row) => row.join(",")).join("\n");

    downloadBlob(csv, "text/csv;charset=utf-8;", "TMAT_Header_Guide.csv");
}

function downloadBlob(content, mimeType, filename) {
    const blob = new Blob([content], { type: mimeType });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
}

function slugify(text) {
    return String(text || "file")
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, "_")
        .replace(/^_+|_+$/g, "");
}

const NO_DATA_NUMERIC_SENTINELS = new Set([999, -999]);
const NO_DATA_TEXT_SENTINELS = new Set(["", "null", "na", "n/a", "nan", "none", "-", "--"]);

function toNumber(value) {
    if (value === null || value === undefined) return NaN;

    if (typeof value === "number") {
        return Number.isFinite(value) && !NO_DATA_NUMERIC_SENTINELS.has(value) ? value : NaN;
    }

    const cleaned = String(value).replace(/,/g, "").trim();
    if (NO_DATA_TEXT_SENTINELS.has(cleaned.toLowerCase())) return NaN;

    const num = Number(cleaned);
    if (!Number.isFinite(num)) return NaN;
    return NO_DATA_NUMERIC_SENTINELS.has(num) ? NaN : num;
}

function mean(values) {
    if (!values.length) return NaN;
    return values.reduce((sum, value) => sum + value, 0) / values.length;
}

function min(values) {
    if (!values.length) return NaN;
    return Math.min(...values);
}

function max(values) {
    if (!values.length) return NaN;
    return Math.max(...values);
}

function stddev(values) {
    if (values.length < 2) return NaN;
    const avg = mean(values);
    const variance = values.reduce((sum, value) => sum + (value - avg) ** 2, 0) / (values.length - 1);
    return Math.sqrt(variance);
}

function hasVariance(values) {
    if (values.length < 2) return false;
    const unique = new Set(values.map((value) => String(value)));
    return unique.size > 1;
}

function sumValues(obj) {
    return Object.values(obj).reduce((sum, value) => sum + Number(value || 0), 0);
}

function formatNumber(value, digits = 1) {
    if (!Number.isFinite(value)) return "-";
    return new Intl.NumberFormat("en-US", {
        minimumFractionDigits: digits,
        maximumFractionDigits: digits,
    }).format(value);
}

function escapeHtml(value) {
    return String(value ?? "")
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;")
        .replace(/'/g, "&#39;");
}

function escapeHtmlAttr(value) {
    return escapeHtml(value);
}

// =========================================================================
// LOGIKA AI GENERATOR (MENGGUNAKAN BACKEND VERCEL) FULL BAHASA INDONESIA
// =========================================================================
async function handleGenerateAIReport() {
    if (!state.processed) {
        alert("Proses data CSV terlebih dahulu!");
        return;
    }

    aiOutputWrapEl.innerHTML = "<em>Menganalisis kondisi dominan dan menghubungi server, mohon tunggu...</em>";
    generateAiBtnEl.disabled = true;

    try {
        const p = state.processed;
        const userNotes = userContextEl.value || "Kondisi curah hujan bervariasi.";
        const wmActions = wmActionsEl.value || "tim operasional WM terus memantau level air kanal melalui patroli rutin.";

        // Data Calculation
        const currentSummary = p.weeklySummaryRecords.find(r => r.Week === p.baselineWeek);
        const currentIndex = p.weeklySummaryRecords.findIndex(r => r.Week === p.baselineWeek);
        const prevSummary = currentIndex > 0 ? p.weeklySummaryRecords[currentIndex - 1] : currentSummary;

        let prevRedPct = "-", prevWetPct = "-";
        if (prevSummary) {
            const prevWeek = prevSummary.Week;
            const prevTotal = p.weeklySummaryRecords.find(r => r.Week === prevWeek)["Total Records"];
            const prevRedCount = p.weeklyCounts[prevWeek]?.["Kering (>65)"] || 0;
            prevRedPct = prevTotal ? Math.round((prevRedCount / prevTotal) * 100) : "-";
            const prevWetCount = (p.weeklyCounts[prevWeek]?.["Tergenang (0-40)"] || 0) + (p.weeklyCounts[prevWeek]?.["A Tergenang (41-45)"] || 0);
            prevWetPct = prevTotal && prevWetCount ? Math.round((prevWetCount / prevTotal) * 100) : "-";
        }

        const currRedCount = p.baselineCounts["Kering (>65)"] || 0;
        const currRedPct = p.baselineTotal ? Math.round((currRedCount / p.baselineTotal) * 100) : "-";
        const currWetPct = Math.round(currentSummary["Basah <=45 (%)"]);

        const prevTmat = prevSummary ? Math.round(Math.abs(prevSummary["Avg TMAT (cm)"])) : '-';
        const currTmat = Math.round(Math.abs(currentSummary["Avg TMAT (cm)"]));
        const diffTmat = prevSummary ? Math.abs(prevTmat - currTmat) : '-';

        const pctBasah = currentSummary["Basah <=45 (%)"];
        const pctKering = currentSummary["Kering >60 (%)"];
        const countNormal = p.baselineCounts["Normal (46-60)"] || 0;
        const pctNormal = p.baselineTotal ? (countNormal / p.baselineTotal) * 100 : 0;

        let dominan = "Normal", instruksiAI = "", templatePenutup = "";
        if (pctKering >= Math.max(pctBasah, pctNormal)) {
            dominan = "Kering";
            instruksiAI = `Karena data didominasi area KERING (${Math.round(pctKering)}%), fokuskan analisis Paragraf 1 pada bahaya kekeringan, defisit air, dan kantong-kantong kering yang kritis.`;
            templatePenutup = `Secara keseluruhan, TMAT masih berada di bawah tekanan kekeringan. Hal ini sejalan dengan kondisi lapangan: [SUMMARY OF USER WEATHER NOTE]. Rata-rata TMAT bergerak dari sekitar ${prevTmat} cm minggu lalu menjadi sekitar ${currTmat} cm minggu ini, dan blok merah (>65 cm) berubah dari sekitar ${prevRedPct}% menjadi sekitar ${currRedPct}%. Namun, kondisi kering masih mendominasi, dengan sebagian besar blok tetap berada di kelas kering (>60 cm), mengindikasikan risiko kekeringan masih tinggi. Respons piezometer masih lemah dalam skala lanskap dan blok-blok tersebut membutuhkan retensi air di kanal. Untuk memperlambat penurunan TMAT lebih lanjut, ${wmActions}.`;
        } else if (pctBasah >= Math.max(pctKering, pctNormal)) {
            dominan = "Basah";
            instruksiAI = `Karena data didominasi area BASAH/TERGENANG (${Math.round(pctBasah)}%), fokuskan analisis Paragraf 1 pada masalah genangan, risiko banjir, dan perlunya membuang kelebihan air (drainase).`;
            templatePenutup = `Secara keseluruhan, TMAT mengindikasikan kondisi jenuh air atau tekanan genangan, dengan beberapa area menunjukkan kelebihan air minggu ini. Hal ini sejalan dengan kondisi cuaca: [SUMMARY OF USER WEATHER NOTE]. Rata-rata TMAT bergerak dari sekitar ${prevTmat} cm minggu lalu menjadi sekitar ${currTmat} cm minggu ini, sementara blok basah (<=45 cm) berubah dari sekitar ${prevWetPct}% menjadi sekitar ${currWetPct}%. Kondisi basah saat ini mendominasi, mengindikasikan risiko genangan masih tinggi jika drainase tidak dioptimalkan. Secara umum, lanskap sangat jenuh air. Untuk mengelola kelebihan air ini, ${wmActions}.`;
        } else {
            instruksiAI = `Karena data didominasi area NORMAL (${Math.round(pctNormal)}%), fokuskan analisis Paragraf 1 pada keberhasilan menjaga kelembapan ideal, stabilitas tata air, dan tren kelembapan yang terkendali.`;
            templatePenutup = `Secara keseluruhan, TMAT tetap dalam kondisi stabil dan normal, mencerminkan elevasi air yang terjaga dengan baik di sebagian besar blok minggu ini. Hal ini sejalan dengan kondisi cuaca: [SUMMARY OF USER WEATHER NOTE]. Rata-rata TMAT terkelola dengan baik, bergerak dari sekitar ${prevTmat} cm minggu lalu menjadi sekitar ${currTmat} cm minggu ini. Blok kelas normal (46-60 cm) mendominasi perkebunan, menunjukkan keberhasilan manajemen tata air dan tingkat kelembapan yang seimbang. Untuk mempertahankan kondisi optimal ini, ${wmActions}.`;
        }

        const sc0 = p.scenarioResults.find(s => s.scenarioMm === 0) || p.scenarioResults[0];
        const sc50 = p.scenarioResults.find(s => s.scenarioMm === 50) || p.scenarioResults[1];

        // Susun Prompt Text
        const promptText = `
      Anda adalah asisten ahli hidrologi. Buat laporan analisis TMAT dalam 4 paragraf.

      DATA:
      - TMAT M-1: ${prevTmat} cm, TMAT M0: ${currTmat} cm.
      - Blok Kering (>60cm) M0: ${currentSummary["Kering >60 (count)"]} blok (${Math.round(currentSummary["Kering >60 (%)"])}%).
      - Blok Basah (<=45cm) M0: ${currentSummary["Basah <=45 (count)"]} blok (${Math.round(currentSummary["Basah <=45 (%)"])}%).
      - Blok Normal (46-60cm) M0: ${countNormal} blok (${Math.round(pctNormal)}%).
      - Forecast 0mm: TMAT ${Math.round(Math.abs(sc0.avgNext))} cm, Kering >65cm: ${sc0.counts["Kering (>65)"]} blok, Basah <=45cm: ${sc0.summary["Basah <=45 Count"]} blok.
      - Forecast 50mm: TMAT ${Math.round(Math.abs(sc50.avgNext))} cm, Kering >65cm: ${sc50.counts["Kering (>65)"]} blok, Basah <=45cm: ${sc50.summary["Basah <=45 Count"]} blok, Normal 46-60cm: ${sc50.counts["Normal (46-60)"]} blok.

      INSTRUKSI FORMAT:
      Paragraf 1 (Bahasa Indonesia): Bahas catatan cuaca user ("${userNotes}"), bandingkan TMAT minggu lalu dan ini. ${instruksiAI}
      Paragraf 2 (Bahasa Indonesia): Awali dengan "CH = 0 mm:". Jelaskan proyeksi TMAT, blok kering, dan basah jika tidak ada hujan.
      Paragraf 3 (Bahasa Indonesia): Awali dengan "CH = 50 mm:". Jelaskan proyeksi pemulihan atau risiko genangan jika hujan turun.
      Paragraf 4 (Bahasa Indonesia): KELUARKAN TEKS DI BAWAH INI PERSIS TANPA DIUBAH, hanya rangkum secara ringkas konteks cuaca user ("${userNotes}") dalam maksimal 10 kata di bagian [SUMMARY OF USER WEATHER NOTE].

      ${templatePenutup}
    `;

        // MENGIRIM KE BACKEND VERCEL (BUKAN LANGSUNG KE GEMINI)
        const response = await fetch('/api/generate', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ prompt: promptText })
        });

        const data = await response.json();

        if (!response.ok) {
            throw new Error(data.error || "Terjadi kesalahan pada server backend.");
        }

        aiOutputWrapEl.innerHTML = data.text.replace(/\n/g, '<br>');

    } catch (error) {
        console.error(error);
        aiOutputWrapEl.innerHTML = `<span style="color: red;">Gagal membuat laporan AI: ${error.message}</span>`;
    } finally {
        generateAiBtnEl.disabled = false;
    }
}