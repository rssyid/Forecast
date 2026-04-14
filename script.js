// Konfigurasi & State
const CLASS_ORDER = ["No Data", "Banjir (<0)", "Tergenang (0-40)", "A Tergenang (41-45)", "Normal (46-60)", "A Kering (61-65)", "Kering (>65)"];
const CLASS_COLORS = { "No Data": "#B0B8C2", "Banjir (<0)": "#71717A", "Tergenang (0-40)": "#1D4ED8", "A Tergenang (41-45)": "#60A5FA", "Normal (46-60)": "#22C55E", "A Kering (61-65)": "#F59E0B", "Kering (>65)": "#EF4444" };
const MONTH_MAP = { jan: 1, january: 1, feb: 2, february: 2, mar: 3, march: 3, apr: 4, april: 4, may: 5, jun: 6, june: 6, jul: 7, july: 7, aug: 8, august: 8, sep: 9, sept: 9, september: 9, oct: 10, october: 10, nov: 11, november: 11, dec: 12, december: 12 };
const COL_CANDIDATES = { week: ["week name", "week_name", "week"], estate: ["estate", "nama kebun"], id: ["piezorecordid", "piezorecordid", "id"], tmat: ["ketinggian", "tmat", "value"], block: ["block"], date: ["date"] };

const state = { rawRows: [], detectedCols: null, weeks: [], processed: null, charts: { trend: null, dist: null } };

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
const aiOutputContentEl = document.getElementById("aiOutputContent") || document.getElementById("aiOutputWrap");

// Translation Elements
const translateModuleEl = document.getElementById("translateModule");
const translateInputEl = document.getElementById("translateInput");
const translateBtnEl = document.getElementById("translateBtn");
const translateOutputWrapEl = document.getElementById("translateOutputWrap");
const translateOutputContentEl = document.getElementById("translateOutputContent") || document.getElementById("translateOutputWrap");

// External UI Elements
const themeToggleBtn = document.getElementById("themeToggleBtn");
const themeIconDark = document.getElementById("themeIconDark");
const themeIconLight = document.getElementById("themeIconLight");
const copyAiBtn = document.getElementById("copyAiBtn");
const copyTranslateBtn = document.getElementById("copyTranslateBtn");

// Event Listeners
csvFileEl.addEventListener("change", handleFileUpload);
processBtnEl.addEventListener("click", handleProcess);
exportExcelBtnEl.addEventListener("click", handleExportExcel);
downloadTemplateBtnEl.addEventListener("click", handleDownloadTemplate);
generateAiBtnEl?.addEventListener("click", handleGenerateAIReport);
translateBtnEl?.addEventListener("click", handleTranslateReport);

themeToggleBtn?.addEventListener("click", handleThemeToggle);
copyAiBtn?.addEventListener("click", () => handleCopy(aiOutputContentEl, copyAiBtn));
copyTranslateBtn?.addEventListener("click", () => handleCopy(translateOutputContentEl, copyTranslateBtn));

function handleThemeToggle() {
    const isDark = document.documentElement.classList.toggle('dark');
    if (themeIconDark) {
        themeIconDark.classList.toggle('hidden', !isDark);
        themeIconDark.classList.toggle('block', isDark);
    }
    if (themeIconLight) {
        themeIconLight.classList.toggle('hidden', isDark);
        themeIconLight.classList.toggle('block', !isDark);
    }
    localStorage.theme = isDark ? 'dark' : 'light';
}

function handleCopy(contentEl, btnEl) {
    if (!contentEl.innerText) return;
    navigator.clipboard.writeText(contentEl.innerText).then(() => {
        const originalHtml = btnEl.innerHTML;
        btnEl.innerHTML = '<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" class="text-green-500" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"></polyline></svg>';
        setTimeout(() => btnEl.innerHTML = originalHtml, 2000);
    });
}

// Initial Theme Setup
if (localStorage.theme === 'dark') {
    document.documentElement.classList.add('dark');
    if (themeIconDark) themeIconDark.classList.replace('hidden', 'block');
    if (themeIconLight) themeIconLight.classList.replace('block', 'hidden');
} else {
    document.documentElement.classList.remove('dark');
}

// Utilities & Logic CSV (Frontend)
function setStatus(message, type = "neutral") {
    statusBoxEl.textContent = message;
    // Shadcn Alert Styling for Status
    if (type === 'success') {
        statusBoxEl.className = "text-sm px-4 py-2 rounded-md font-medium border bg-green-50 border-green-200 text-green-900 w-full md:w-auto flex-1";
    } else if (type === 'warn') {
        statusBoxEl.className = "text-sm px-4 py-2 rounded-md font-medium border bg-yellow-50 border-yellow-200 text-yellow-900 w-full md:w-auto flex-1";
    } else {
        statusBoxEl.className = "text-sm px-4 py-2 rounded-md font-medium border bg-muted text-muted-foreground w-full md:w-auto flex-1";
    }
}

function handleFileUpload(event) {
    const file = event.target.files[0];
    if (!file) return;

    Papa.parse(file, {
        header: true, skipEmptyLines: true,
        complete: (results) => {
            try {
                if (!Array.isArray(results.data) || !results.data.length) throw new Error("CSV kosong atau tidak terbaca.");
                const cleanedRows = results.data.filter((row) => Object.values(row).some((value) => String(value ?? "").trim() !== ""));
                const detectedCols = detectColumns(results.meta.fields || []);
                validateRequiredColumns(detectedCols);

                state.rawRows = cleanedRows; state.detectedCols = detectedCols;
                state.weeks = getSortedDistinctWeeks(cleanedRows, detectedCols.week);
                state.processed = null;

                renderColumnMapping(detectedCols, results.meta.fields || []); renderRainfallInputs(state.weeks); renderBaselineOptions(state.weeks);
                processBtnEl.disabled = false; exportExcelBtnEl.disabled = true; resultsSectionEl.classList.add("hidden");
                translateModuleEl.classList.add("hidden"); aiOutputWrapEl.classList.add("hidden");

                const latestWeek = state.weeks[state.weeks.length - 1] || "-";
                setStatus(`CSV berhasil dibaca. Total row: ${cleanedRows.length}. Latest week: ${latestWeek}.`, "success");
            } catch (error) {
                setStatus(error.message || "Gagal membaca CSV.", "warn");
                processBtnEl.disabled = true; exportExcelBtnEl.disabled = true;
            }
        },
        error: () => setStatus("Terjadi error saat parsing CSV.", "warn")
    });
}

function detectColumns(headers) {
    const headerMap = Object.fromEntries(headers.map((h) => [String(h || "").trim().toLowerCase(), h]));
    const detected = {};
    for (const [key, candidates] of Object.entries(COL_CANDIDATES)) {
        detected[key] = null;
        for (const candidate of candidates) { if (headerMap[candidate.toLowerCase()]) { detected[key] = headerMap[candidate.toLowerCase()]; break; } }
    }
    return detected;
}

function validateRequiredColumns(detectedCols) {
    const missing = [];
    if (!detectedCols.week) missing.push("Week Name");
    if (!detectedCols.tmat) missing.push("Ketinggian / TMAT");
    if (missing.length) throw new Error(`Kolom wajib tidak ditemukan: ${missing.join(", ")}.`);
}

function renderColumnMapping(detectedCols, headers) {
    const rows = [["Week", detectedCols.week], ["TMAT", detectedCols.tmat], ["Estate", detectedCols.estate], ["Piezo ID", detectedCols.id], ["Block", detectedCols.block], ["Date", detectedCols.date]];
    mappingSummaryEl.innerHTML = `<div class="grid grid-cols-1 md:grid-cols-2 gap-4">` + rows.map(([label, value]) => `
      <div class="flex items-center justify-between p-3 border rounded-md bg-muted/50">
        <span class="text-sm font-semibold">${escapeHtml(label)}</span>
        <span class="text-sm text-muted-foreground">${escapeHtml(value || "Tidak terdeteksi")}</span>
      </div>`).join("") + `</div>`;
}

function getSortedDistinctWeeks(rows, weekCol) {
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

function parseWeekName(weekName) {
    const text = String(weekName || "").trim();
    const match = text.match(/([A-Za-z]+)\s+(\d{4})\s*,?\s*W(?:eek)?\s*(\d+)/i);
    if (match) return { year: Number(match[2]), month: MONTH_MAP[match[1].toLowerCase()] || 99, week: Number(match[3]) };
    const nums = text.match(/\d+/g) || [];
    return { year: nums[0] ? Number(nums[0]) : 9999, month: nums[1] ? Number(nums[1]) : 99, week: nums[2] ? Number(nums[2]) : 99 };
}

function renderBaselineOptions(weeks) {
    baselineWeekEl.innerHTML = weeks.map((week, index) => `<option value="${escapeHtml(week)}" ${index === weeks.length - 1 ? "selected" : ""}>${escapeHtml(week)}</option>`).join("");
    baselineWeekEl.disabled = !weeks.length;
}

function renderRainfallInputs(weeks) {
    if (!weeks.length) { rainfallTableWrapEl.innerHTML = '<div class="p-6 text-sm text-muted-foreground italic">Week Name tidak ditemukan.</div>'; return; }
    const rows = weeks.map((week) => `<tr class="border-b transition-colors hover:bg-muted/50"><td class="p-4 align-middle font-medium">${escapeHtml(week)}</td><td class="p-4 align-middle"><input type="number" class="rain-input flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring" step="any" data-week="${escapeHtmlAttr(week)}" placeholder="0" /></td></tr>`).join("");
    rainfallTableWrapEl.innerHTML = `<table class="w-full caption-bottom text-sm"><thead class="[&_tr]:border-b"><tr class="border-b transition-colors hover:bg-muted/50"><th class="h-10 px-4 text-left align-middle font-medium text-muted-foreground">Week Name</th><th class="h-10 px-4 text-left align-middle font-medium text-muted-foreground">Rainfall (mm)</th></tr></thead><tbody>${rows}</tbody></table>`;
}

function getRainfallMapFromInputs() {
    const rainfallMap = {};
    document.querySelectorAll(".rain-input").forEach((input) => { rainfallMap[input.dataset.week] = input.value.trim() === "" ? NaN : Number(input.value.trim()); });
    return rainfallMap;
}

function parseScenarioInput(text) {
    const validValues = [...new Set(String(text || "").split(",").map(i => Number(i.trim())).filter(v => Number.isFinite(v) && v >= 0))];
    if (!validValues.length) throw new Error("Scenario rainfall harus diisi, misalnya 0,50.");
    return validValues;
}

function handleProcess() {
    try {
        if (!state.rawRows.length || !state.detectedCols) throw new Error("Upload CSV terlebih dahulu.");
        const p = processData(state.rawRows, state.detectedCols, getRainfallMapFromInputs(), parseScenarioInput(scenarioInputEl.value), baselineWeekEl.value);
        state.processed = p;
        renderModelSummary(p); renderTables(p); renderCharts(p);
        resultsSectionEl.classList.remove("hidden"); exportExcelBtnEl.disabled = false;
        setStatus(`Process selesai. Baseline week: ${p.baselineWeek}.`, "success");
    } catch (error) { setStatus(error.message || "Gagal memproses data.", "warn"); }
}

function processData(rawRows, detectedCols, rainfallMap, scenarios, baselineWeek) {
    const rows = rawRows.map((row) => {
        const tmatValue = toNumber(row[detectedCols.tmat]);
        return { ...row, __TMAT_NUM__: tmatValue, TMAT_Class: classifyTMAT(tmatValue) };
    });

    const weeks = getSortedDistinctWeeks(rows, detectedCols.week);
    const weeklyCounts = {}; rows.forEach(r => { const w = String(r[detectedCols.week] || "").trim(); if (w) { weeklyCounts[w] = weeklyCounts[w] || {}; weeklyCounts[w][r.TMAT_Class] = (weeklyCounts[w][r.TMAT_Class] || 0) + 1; } });

    const weeklyPct = {}, weeklySummaryRecords = [];
    weeks.forEach((week) => {
        const counts = ensureAllClasses(weeklyCounts[week] || {});
        const values = rows.filter(r => String(r[detectedCols.week] || "").trim() === week).map(r => r.__TMAT_NUM__).filter(Number.isFinite);
        const total = sumValues(counts);
        weeklyPct[week] = Object.fromEntries(CLASS_ORDER.map(c => [c, total ? (counts[c] / total) * 100 : 0]));
        const basah = counts["Tergenang (0-40)"] + counts["A Tergenang (41-45)"], kering60 = counts["A Kering (61-65)"] + counts["Kering (>65)"];
        weeklySummaryRecords.push({ Week: week, "Total Records": total, "Avg TMAT (cm)": mean(values), "Min TMAT (cm)": min(values), "Max TMAT (cm)": max(values), StdDev: stddev(values), "Basah <=45 (count)": basah, "Basah <=45 (%)": total ? (basah / total) * 100 : 0, "Kering >60 (count)": kering60, "Kering >60 (%)": total ? (kering60 / total) * 100 : 0, "Rain (mm)": rainfallMap[week] ?? NaN });
    });

    const fit = fitRainResponse(weeklySummaryRecords);
    const effectiveBaselineWeek = baselineWeek || weeks[weeks.length - 1];
    const baselineCounts = ensureAllClasses(weeklyCounts[effectiveBaselineWeek] || {});
    const baselineTotal = sumValues(baselineCounts);
    const baselinePct = Object.fromEntries(CLASS_ORDER.map(c => [c, baselineTotal ? (baselineCounts[c] / baselineTotal) * 100 : 0]));
    const baselineAvgTMAT = weeklySummaryRecords.find(r => r.Week === effectiveBaselineWeek)?.["Avg TMAT (cm)"] ?? NaN;

    const scenarioResults = scenarios.map((scenarioMm) => {
        const dAvg = fit.a + fit.b * scenarioMm;
        const counts = forecastCountsFromBaseline(baselineCounts, dAvg, baselineTotal);
        const total = sumValues(counts);
        return { scenarioMm, dAvg, avgNext: baselineAvgTMAT + dAvg, counts, pct: Object.fromEntries(CLASS_ORDER.map(c => [c, total ? (counts[c] / total) * 100 : 0])), summary: summarizeCounts(counts) };
    });

    const forecastRows = CLASS_ORDER.map(c => { const r = { "Kelas TMAT": c, "Baseline Count": baselineCounts[c], "Baseline %": baselinePct[c] }; scenarioResults.forEach(res => { r[`CH${res.scenarioMm} Count`] = res.counts[c]; r[`CH${res.scenarioMm} %`] = res.pct[c]; }); return r; });

    const bSum = summarizeCounts(baselineCounts);
    const forecastSummaryRows = [{ Metric: "Basah <=45 Count", Baseline: bSum["Basah <=45 Count"] }, { Metric: "Basah <=45 %", Baseline: bSum["Basah <=45 %"] }, { Metric: "Kering >60 Count", Baseline: bSum["Kering >60 Count"] }, { Metric: "Kering >60 %", Baseline: bSum["Kering >60 %"] }, { Metric: "Total", Baseline: bSum.Total }];
    scenarioResults.forEach(res => { forecastSummaryRows[0][`CH${res.scenarioMm}`] = res.summary["Basah <=45 Count"]; forecastSummaryRows[1][`CH${res.scenarioMm}`] = res.summary["Basah <=45 %"]; forecastSummaryRows[2][`CH${res.scenarioMm}`] = res.summary["Kering >60 Count"]; forecastSummaryRows[3][`CH${res.scenarioMm}`] = res.summary["Kering >60 %"]; forecastSummaryRows[4][`CH${res.scenarioMm}`] = res.summary.Total; });

    return { rawRows: rows, detectedCols, weeks, rainfallMap, scenarios, baselineWeek: effectiveBaselineWeek, weeklyCounts, weeklyPct, weeklySummaryRecords, fit, baselineCounts, baselinePct, baselineTotal, baselineAvgTMAT, scenarioResults, forecastRows, forecastSummaryRows };
}

function ensureAllClasses(counts) { const out = {}; CLASS_ORDER.forEach(c => out[c] = Number(counts[c] || 0)); return out; }
function classifyTMAT(val) { if (!Number.isFinite(val)) return "No Data"; if (val < 0) return "Banjir (<0)"; if (val <= 40) return "Tergenang (0-40)"; if (val <= 45) return "A Tergenang (41-45)"; if (val <= 60) return "Normal (46-60)"; if (val <= 65) return "A Kering (61-65)"; return "Kering (>65)"; }
function sumValues(obj) { return Object.values(obj).reduce((s, v) => s + Number(v || 0), 0); }
function mean(arr) { return arr.length ? arr.reduce((s, v) => s + v, 0) / arr.length : NaN; }
function min(arr) { return arr.length ? Math.min(...arr) : NaN; }
function max(arr) { return arr.length ? Math.max(...arr) : NaN; }
function stddev(arr) { if (arr.length < 2) return NaN; const m = mean(arr); return Math.sqrt(arr.reduce((s, v) => s + (v - m) ** 2, 0) / (arr.length - 1)); }

function fitRainResponse(records) {
    const lastN = records.slice(-3); const fitRows = [];
    for (let i = 1; i < lastN.length; i++) { if (Number.isFinite(lastN[i - 1]["Avg TMAT (cm)"]) && Number.isFinite(lastN[i]["Avg TMAT (cm)"]) && Number.isFinite(lastN[i]["Rain (mm)"])) fitRows.push({ x: lastN[i]["Rain (mm)"], y: lastN[i]["Avg TMAT (cm)"] - lastN[i - 1]["Avg TMAT (cm)"] }); }
    let a, b, method = "fit";
    if (fitRows.length >= 2 && new Set(fitRows.map(r => String(r.x))).size > 1) {
        const n = fitRows.length, sumX = fitRows.reduce((s, r) => s + r.x, 0), sumY = fitRows.reduce((s, r) => s + r.y, 0), sumXY = fitRows.reduce((s, r) => s + r.x * r.y, 0), sumX2 = fitRows.reduce((s, r) => s + r.x * r.x, 0), denom = n * sumX2 - sumX * sumX;
        if (denom !== 0) { b = (n * sumXY - sumX * sumY) / denom; a = (sumY - b * sumX) / n; }
    }
    if (!Number.isFinite(a) || !Number.isFinite(b)) { const last2 = records.slice(-2); const d = last2.length === 2 ? (last2[1]["Avg TMAT (cm)"] - last2[0]["Avg TMAT (cm)"]) : 0; a = Number.isFinite(d) ? d : 0; b = -0.05; method = "fallback"; }
    return { a, b: Math.min(b, -0.001), fitRows, method };
}

function forecastCountsFromBaseline(counts, dAvg, total) {
    const out = { ...counts }, mag = Math.min(Math.abs(dAvg) / 10, 1);
    if (dAvg >= 0) {
        const m1 = 0.25 * mag, m2 = 0.35 * mag, m3 = 0.4 * mag;
        let s = Math.min(out["Normal (46-60)"] * m1, out["Normal (46-60)"]); out["Normal (46-60)"] -= s; out["A Kering (61-65)"] += s;
        s = Math.min(out["A Kering (61-65)"] * m2, out["A Kering (61-65)"]); out["A Kering (61-65)"] -= s; out["Kering (>65)"] += s;
        [["Tergenang (0-40)", "A Tergenang (41-45)"], ["A Tergenang (41-45)", "Normal (46-60)"]].forEach(([src, dst]) => { const s2 = Math.min(out[src] * m3, out[src]); out[src] -= s2; out[dst] += s2; });
    } else {
        const m1 = 0.3 * mag, m2 = 0.25 * mag, m3 = 0.15 * mag;
        let s = Math.min(out["Kering (>65)"] * m1, out["Kering (>65)"]); out["Kering (>65)"] -= s; out["A Kering (61-65)"] += s;
        s = Math.min(out["A Kering (61-65)"] * m2, out["A Kering (61-65)"]); out["A Kering (61-65)"] -= s; out["Normal (46-60)"] += s;
        s = Math.min(out["Normal (46-60)"] * m3, out["Normal (46-60)"]); out["Normal (46-60)"] -= s; out["A Tergenang (41-45)"] += s * 0.6; out["Tergenang (0-40)"] += s * 0.4;
    }
    CLASS_ORDER.forEach(c => out[c] = Math.round(out[c]));
    const diff = total - sumValues(out);
    if (diff !== 0) { const adj = CLASS_ORDER.filter(n => !["No Data", "Banjir (<0)"].includes(n)); const best = adj.reduce((b, c) => !b ? c : (out[c] > out[b] ? c : b), null); if (best) out[best] += diff; }
    return ensureAllClasses(out);
}

function summarizeCounts(c) { const tot = sumValues(c), basah = c["Tergenang (0-40)"] + c["A Tergenang (41-45)"], krg = c["A Kering (61-65)"] + c["Kering (>65)"]; return { "Basah <=45 Count": basah, "Basah <=45 %": tot ? (basah / tot) * 100 : 0, "Kering >60 Count": krg, "Kering >60 %": tot ? (krg / tot) * 100 : 0, Total: tot }; }
function formatNumber(v, d = 1) { return !Number.isFinite(v) ? "-" : new Intl.NumberFormat("en-US", { minimumFractionDigits: d, maximumFractionDigits: d }).format(v); }
function escapeHtml(v) { return String(v ?? "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&#39;"); }
function escapeHtmlAttr(v) { return escapeHtml(v); }
function toNumber(v) { if (v == null) return NaN; if (typeof v === "number") return Number.isFinite(v) && Math.abs(v) !== 999 ? v : NaN; const c = String(v).replace(/,/g, "").trim().toLowerCase(); if (["", "null", "na", "n/a", "nan", "none", "-", "--"].includes(c)) return NaN; const n = Number(c); return Number.isFinite(n) && Math.abs(n) !== 999 ? n : NaN; }

// Rendering UI Shadcn Tables
function renderModelSummary(p) {
    modelSummaryEl.innerHTML = [["Baseline Week", p.baselineWeek], ["Baseline Avg TMAT", formatNumber(p.baselineAvgTMAT, 2)], ["Koefisien a", formatNumber(p.fit.a, 3)], ["Koefisien b", formatNumber(p.fit.b, 4)], ["Metode", p.fit.method]]
        .map(([l, v]) => `<div class="flex flex-col gap-1 p-4 rounded-xl border bg-muted/50"><span class="text-xs font-medium text-muted-foreground uppercase tracking-wider">${escapeHtml(l)}</span><span class="text-xl font-bold">${escapeHtml(String(v))}</span></div>`).join("");
}

function renderTables(p) {
    weeklySummaryWrapEl.innerHTML = renderTable(p.weeklySummaryRecords);
    baselineWrapEl.innerHTML = renderTable(CLASS_ORDER.map(c => ({ "Kelas TMAT": c, Count: p.baselineCounts[c], "%": p.baselinePct[c] })));
    forecastWrapEl.innerHTML = renderTable(p.forecastRows);
    forecastSummaryWrapEl.innerHTML = renderTable(p.forecastSummaryRows);
}

function renderTable(rows) {
    if (!rows.length) return '<div class="p-6 text-sm text-muted-foreground italic">Tidak ada data.</div>';
    const cols = Object.keys(rows[0]);
    return `<table class="w-full caption-bottom text-sm"><thead class="[&_tr]:border-b"><tr class="border-b transition-colors hover:bg-muted/50">${cols.map(c => `<th class="h-10 px-4 text-left align-middle font-medium text-muted-foreground">${escapeHtml(c)}</th>`).join("")}</tr></thead><tbody class="[&_tr:last-child]:border-0">${rows.map(r => `<tr class="border-b transition-colors hover:bg-muted/50">${cols.map((c, i) => `<td class="p-4 align-middle">${formatCell(r[c], i === 0 && c.toLowerCase().includes("kelas") ? c : null)}</td>`).join("")}</tr>`).join("")}</tbody></table>`;
}

function formatCell(v, classCol) {
    if (classCol && CLASS_COLORS[v]) return `<span class="inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-semibold transition-colors focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2" style="background:${CLASS_COLORS[v]}15;color:${CLASS_COLORS[v]};border-color:${CLASS_COLORS[v]}30">${escapeHtml(String(v))}</span>`;
    return typeof v === "number" ? (Number.isInteger(v) ? escapeHtml(String(v)) : escapeHtml(formatNumber(v, 1))) : escapeHtml(String(v ?? ""));
}

function renderCharts(p) {
    if (state.charts.trend) state.charts.trend.destroy(); if (state.charts.dist) state.charts.dist.destroy();

    const isDark = document.documentElement.classList.contains('dark');
    Chart.defaults.color = isDark ? 'hsl(215 20.2% 65.1%)' : 'hsl(240 3.8% 46.1%)'; // text-muted-foreground
    Chart.defaults.borderColor = isDark ? 'hsla(217.2, 32.6%, 17.5%, 0.5)' : 'hsla(240, 5.9%, 90%, 0.5)'; // border color grid
    const mainLineColor = isDark ? "hsl(210 40% 98%)" : "hsl(240 5.9% 10%)"; // text-foreground
    const barBgColorHover = isDark ? "hsl(217.2 32.6% 17.5%)" : "hsl(210 40% 80%)";
    const barBgColor = isDark ? "hsla(217.2, 32.6%, 17.5%, 0.5)" : "hsl(210 40% 90%)";

    state.charts.trend = new Chart(document.getElementById("trendChart"), { type: "bar", data: { labels: p.weeks, datasets: [{ type: "bar", label: "Rainfall (mm)", data: p.weeklySummaryRecords.map(r => Number.isFinite(r["Rain (mm)"]) ? r["Rain (mm)"] : null), yAxisID: "y1", backgroundColor: barBgColor, hoverBackgroundColor: barBgColorHover }, { type: "line", label: "Avg TMAT (cm)", data: p.weeklySummaryRecords.map(r => r["Avg TMAT (cm)"]), yAxisID: "y", tension: 0.3, borderColor: mainLineColor, backgroundColor: mainLineColor, pointRadius: 4 }] }, options: { responsive: true, maintainAspectRatio: false, interaction: { mode: "index", intersect: false }, plugins: { legend: { position: "top", labels: { usePointStyle: true, boxWidth: 8 } } }, scales: { y: { type: "linear", position: "left", title: { display: true, text: "Avg TMAT (cm)" } }, y1: { type: "linear", position: "right", grid: { drawOnChartArea: false }, title: { display: true, text: "Rainfall (mm)" } } } } });
    state.charts.dist = new Chart(document.getElementById("distChart"), { type: "bar", data: { labels: CLASS_ORDER, datasets: [{ label: "Baseline %", data: CLASS_ORDER.map(c => p.baselinePct[c]), backgroundColor: "hsl(215.4 16.3% 46.9%)" }, ...p.scenarioResults.map((r, i) => ({ label: `CH${r.scenarioMm} %`, data: CLASS_ORDER.map(c => r.pct[c]), backgroundColor: i === 0 ? mainLineColor : "hsl(221.2 83.2% 53.3%)" }))] }, options: { responsive: true, maintainAspectRatio: false, plugins: { legend: { position: "top", labels: { usePointStyle: true, boxWidth: 8 } } }, scales: { y: { beginAtZero: true, title: { display: true, text: "Percent (%)" } } } } });
}

function handleExportExcel() {
    if (!state.processed) return setStatus("Belum ada hasil.", "warn");
    const wb = XLSX.utils.book_new(), p = state.processed, add = (data, name) => { XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(data.length ? data : [{ Info: "No Data" }]), name); };
    add(p.rawRows, "Raw"); add(p.weeklySummaryRecords, "WeeklySummary"); add(p.weeks.map(w => ({ Week: w, ...ensureAllClasses(p.weeklyCounts[w]) })), "WeeklyCounts");
    XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet([["Baseline Week", p.baselineWeek], [], ["Kelas TMAT", "Count", "%"], ...CLASS_ORDER.map(c => [c, p.baselineCounts[c], p.baselinePct[c]])]), "Baseline");
    add(p.forecastRows, "Forecast"); add(p.forecastSummaryRows, "ForecastSummary");
    XLSX.writeFile(wb, `TMAT_Forecast_${String(p.baselineWeek || "file").toLowerCase().replace(/[^a-z0-9]+/g, "_")}.xlsx`); setStatus("Excel exported.", "success");
}

function handleDownloadTemplate() {
    const csv = "Data Taken,Estate,Block,PiezoRecordID,Ketinggian,Indicator Name,Indicator Alias,Week Name,Date\nFrom Android,THP20,64-19,AGT-10,71,>65,Kering(Dry),Apr 2026, W1,04/01/2026 08:27:00";
    const a = document.createElement("a"); a.href = URL.createObjectURL(new Blob([csv], { type: "text/csv" })); a.download = "TMAT_Header_Guide.csv"; document.body.appendChild(a); a.click(); a.remove();
}

// =========================================================================
// AI REPORT GENERATOR (BAHASA INDONESIA)
// =========================================================================
async function handleGenerateAIReport() {
    if (!state.processed) return alert("Proses data CSV terlebih dahulu!");

    aiOutputContentEl.innerHTML = "<span class='animate-pulse'>Menganalisis kondisi dominan dan menghubungi server, mohon tunggu...</span>";
    aiOutputWrapEl.classList.remove("hidden");
    translateModuleEl.classList.add("hidden");
    generateAiBtnEl.disabled = true;

    try {
        const p = state.processed;
        const userNotes = userContextEl.value || "Kondisi curah hujan bervariasi.";
        const wmActions = wmActionsEl.value || "tim operasional WM terus memantau level air kanal melalui patroli rutin.";

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

        const response = await fetch('/api/generate', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ prompt: promptText })
        });

        const data = await response.json();
        if (!response.ok) throw new Error(data.error || "Terjadi kesalahan pada server backend.");

        // Tampilkan Hasil Utama
        const hasilLaporan = data.text.replace(/\n/g, '<br>');
        aiOutputContentEl.innerHTML = hasilLaporan;

        // Aktifkan modul translasi dan isi otomatis dengan laporan yang baru dibuat
        translateInputEl.value = data.text;
        translateModuleEl.classList.remove("hidden");
        translateOutputWrapEl.classList.add("hidden");

    } catch (error) {
        console.error(error);
        aiOutputContentEl.innerHTML = `<span class="text-red-600 font-medium">Gagal membuat laporan AI: ${error.message}</span>`;
    } finally {
        generateAiBtnEl.disabled = false;
    }
}

// =========================================================================
// AI TRANSLATION & REWRITE MODULE (BAHASA INGGRIS)
// =========================================================================
async function handleTranslateReport() {
    const textToTranslate = translateInputEl.value.trim();
    if (!textToTranslate) return alert("Silakan masukkan teks yang ingin ditranslate!");

    translateOutputContentEl.innerHTML = "<span class='animate-pulse text-green-700'>Memperbaiki grammar dan menerjemahkan, mohon tunggu...</span>";
    translateOutputWrapEl.classList.remove("hidden");
    translateBtnEl.disabled = true;

    try {
        const promptText = `
      Rewrite this text to fix grammar, remove redundancies, improve readability, and strengthen the message. 
      Keep it simple, clean, and professional and short. 
      Semua output harus dalam bahasa Inggris. 
      WAJIB terjemahkan istilah teknis berikut:
      - tanggul menjadi embankment
      - TMAS menjadi Water level
      - TMAT menjadi ground water
      
      TEXT TO TRANSLATE AND REWRITE:
      """
      ${textToTranslate}
      """
    `;

        // Gunakan backend endpoint API yang sama!
        const response = await fetch('/api/generate', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ prompt: promptText })
        });

        const data = await response.json();
        if (!response.ok) throw new Error(data.error || "Terjadi kesalahan pada server backend.");

        translateOutputContentEl.innerHTML = data.text.replace(/\n/g, '<br>');

    } catch (error) {
        console.error(error);
        translateOutputContentEl.innerHTML = `<span class="text-red-600 font-medium">Gagal menerjemahkan: ${error.message}</span>`;
    } finally {
        translateBtnEl.disabled = false;
    }
}