// Konfigurasi & State
const CLASS_ORDER = ["No Data", "Banjir (<0)", "Tergenang (0-40)", "A Tergenang (41-45)", "Normal (46-60)", "A Kering (61-65)", "Kering (>65)"];
const CLASS_COLORS = { "No Data": "#B0B8C2", "Banjir (<0)": "#71717A", "Tergenang (0-40)": "#1D4ED8", "A Tergenang (41-45)": "#60A5FA", "Normal (46-60)": "#22C55E", "A Kering (61-65)": "#F59E0B", "Kering (>65)": "#EF4444" };
const MONTH_MAP = { jan: 1, january: 1, feb: 2, february: 2, mar: 3, march: 3, apr: 4, april: 4, may: 5, jun: 6, june: 6, jul: 7, july: 7, aug: 8, august: 8, sep: 9, sept: 9, september: 9, oct: 10, october: 10, nov: 11, november: 11, dec: 12, december: 12 };
const COL_CANDIDATES = { week: ["week name", "week_name", "week"], estate: ["estate", "nama kebun"], id: ["piezorecordid", "piezorecordid", "id"], tmat: ["ketinggian", "tmat", "value"], block: ["block"], date: ["date"] };

const state = { 
    rawRows: [], 
    detectedCols: null, 
    weeks: [], 
    processed: null, 
    charts: { trend: null, dist: null }, 
    lastFetch: { company: '', range: '' },
    adminKey: ''
};

// DOM Elements
const csvFileEl = document.getElementById("csvFile");
const baselineWeekEl = document.getElementById("baselineWeek");
const scenarioInputEl = document.getElementById("scenarioInput");
const processBtnEl = document.getElementById("processBtn");
const exportExcelBtnEl = document.getElementById("exportExcelBtn");
const statusBoxEl = document.getElementById("statusBox");
const rainfallTableWrapEl = document.getElementById("rainfallTableWrap");
const rainfallInputSectionEl = document.getElementById("rainfallInputSection");
const mappingSummaryEl = document.getElementById("mappingSummary");
const resultsSectionEl = document.getElementById("resultsSection");
const weeklySummaryWrapEl = document.getElementById("weeklySummaryWrap");
const baselineWrapEl = document.getElementById("baselineWrap");
const forecastWrapEl = document.getElementById("forecastWrap");
const forecastSummaryWrapEl = document.getElementById("forecastSummaryWrap");
const modelSummaryEl = document.getElementById("modelSummary");
const downloadTemplateBtnEl = document.getElementById("downloadTemplateBtn");
const syncPiezometerBtnEl = document.getElementById("syncPiezometerBtn");
const syncRainfallBtnEl = document.getElementById("syncRainfallBtn");
const syncStatusTextEl = document.getElementById("syncStatusText");

// DB Mode Elements
const dataSourceTypeEl = document.getElementById("dataSourceType");
const dbCompanyEl = document.getElementById("dbCompany");
const dbRangeEl = document.getElementById("dbRange");
const fetchDbBtnEl = document.getElementById("fetchDbBtn");
const modeDbUi1El = document.getElementById("modeDbUi1");
const modeDbUi2El = document.getElementById("modeDbUi2");
const modeCsvUi1El = document.getElementById("modeCsvUi1");

// Full Resync UI
const fullResyncBtnEl = document.getElementById("fullResyncBtn");
const resyncProgressWrapEl = document.getElementById("resyncProgressWrap");
const resyncStatusBadgeEl = document.getElementById("resyncStatusBadge");
const resyncLogEl = document.getElementById("resyncLog");

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

// Tab Elements
const tabBtns = ['dashboard', 'laporan', 'forecast', 'data'].map(id => document.getElementById(`tabBtn-${id}`));
const tabPanes = ['dashboard', 'laporan', 'forecast', 'data'].map(id => document.getElementById(`tabPane-${id}`));

// Custom Modal Logic
const customModal = document.getElementById("customModal");
const customModalBox = document.getElementById("customModalBox");
const customModalTitle = document.getElementById("customModalTitle");
const customModalMessage = document.getElementById("customModalMessage");
const customModalCancel = document.getElementById("customModalCancel");
const customModalConfirm = document.getElementById("customModalConfirm");

function showModal(title, message, isAlert = false) {
    return new Promise((resolve) => {
        customModalTitle.textContent = title;
        customModalMessage.textContent = message;

        if (isAlert) {
            customModalCancel.classList.add("hidden");
            customModalConfirm.textContent = "Mengerti";
        } else {
            customModalCancel.classList.remove("hidden");
            customModalConfirm.textContent = "Lanjutkan";
        }

        customModal.classList.remove("hidden");
        setTimeout(() => {
            customModalBox.classList.remove("scale-95", "opacity-0");
            customModalBox.classList.add("scale-100", "opacity-100");
        }, 10);

        const close = (result) => {
            customModalBox.classList.remove("scale-100", "opacity-100");
            customModalBox.classList.add("scale-95", "opacity-0");
            setTimeout(() => {
                customModal.classList.add("hidden");
                resolve(result);
            }, 200);

            customModalCancel.removeEventListener("click", onCancel);
            customModalConfirm.removeEventListener("click", onConfirm);
        };

        const onCancel = () => close(false);
        const onConfirm = () => close(true);
        
        customModalCancel.addEventListener("click", onCancel);
        customModalConfirm.addEventListener("click", onConfirm);
    });
}

function getAdminKey() {
    if (!state.adminKey) {
        state.adminKey = window.prompt("Masukkan Admin Key (Dashboard Password) untuk melanjutkan:");
    }
    return state.adminKey;
}

// Event Listeners
if (csvFileEl) {
    csvFileEl.addEventListener("change", (e) => {
        handleFileUpload(e);
        // Otomatis tampilkan bagian rainfall setelah upload
        setTimeout(() => {
            if (state.weeks.length > 0) {
                rainfallInputSectionEl?.classList.remove("hidden");
                processBtnEl.disabled = false;
            }
        }, 500);
    });
}
fetchDbBtnEl?.addEventListener("click", () => {
    const currentCompany = dbCompanyEl?.value || "Semua";
    const currentRange = dbRangeEl?.value || "4";
    handleFetchFromDB(currentCompany, currentRange);
});
processBtnEl.addEventListener("click", handleProcess);
exportExcelBtnEl.addEventListener("click", handleExportExcel);
downloadTemplateBtnEl.addEventListener("click", handleDownloadTemplate);
syncPiezometerBtnEl?.addEventListener("click", handleSyncPiezometer);
syncRainfallBtnEl?.addEventListener("click", handleSyncRainfall);
generateAiBtnEl?.addEventListener("click", handleGenerateAIReport);
translateBtnEl?.addEventListener("click", handleTranslateReport);

themeToggleBtn?.addEventListener("click", handleThemeToggle);
copyAiBtn?.addEventListener("click", () => handleCopy(aiOutputContentEl, copyAiBtn));
copyTranslateBtn?.addEventListener("click", () => handleCopy(translateOutputContentEl, copyTranslateBtn));
fullResyncBtnEl?.addEventListener("click", handleFullResync);

// Data Source Mode Toggle
if (dataSourceTypeEl) {
    dataSourceTypeEl.addEventListener("change", () => {
        const isDb = dataSourceTypeEl.value === "db";
        // Tampilkan/sembunyikan UI yang relevan
        modeDbUi1El?.classList.toggle("hidden", !isDb);
        modeDbUi2El?.classList.toggle("hidden", !isDb);
        modeCsvUi1El?.classList.toggle("hidden", isDb);
        // Reset state setiap kali mode diganti
        state.rawRows = []; state.detectedCols = null; state.weeks = [];
        state.processed = null;
        state.lastFetch = { company: '', range: '' };
        
        processBtnEl.disabled = true; 
        rainfallInputSectionEl?.classList.add("hidden");
        exportExcelBtnEl.disabled = true;
        resultsSectionEl.classList.add("hidden");
        if (rainfallTableWrapEl) rainfallTableWrapEl.innerHTML = '';
        if (mappingSummaryEl) mappingSummaryEl.innerHTML = '';
        setStatus(isDb ? "Mode Database Server aktif. Pilih Company & Range, lalu klik Proses." : "Mode CSV aktif. Upload file untuk memulai.", "neutral");
    });
    // Jalankan sekali untuk set initial state sesuai default pilihan HTML
    dataSourceTypeEl.dispatchEvent(new Event('change'));
}

// Tab Functionality
tabBtns.forEach((btn, index) => {
    btn?.addEventListener("click", () => {
        // Reset all buttons
        tabBtns.forEach(b => {
            if (!b) return;
            b.classList.remove('font-semibold', 'border-primary', 'text-primary');
            b.classList.add('font-medium', 'border-transparent', 'text-muted-foreground');
        });
        // Set active button
        btn.classList.add('font-semibold', 'border-primary', 'text-primary');
        btn.classList.remove('font-medium', 'border-transparent', 'text-muted-foreground');

        // Toggle panes
        tabPanes.forEach(p => {
            if (!p) return;
            p.classList.add('hidden');
            p.classList.remove('block');
        });
        if (tabPanes[index]) {
            tabPanes[index].classList.remove('hidden');
            tabPanes[index].classList.add('block');
        }
    });
});

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

function renderRainfallInputs(weeks, rainfallMap = {}) {
    if (!weeks.length) { rainfallTableWrapEl.innerHTML = '<div class="p-6 text-sm text-muted-foreground italic">Week Name tidak ditemukan.</div>'; return; }
    const rows = weeks.map((week) => {
        const val = rainfallMap[week] !== undefined ? rainfallMap[week].toFixed(2) : "";
        return `<tr class="border-b transition-colors hover:bg-muted/50"><td class="p-4 align-middle font-medium">${escapeHtml(week)}</td><td class="p-4 align-middle"><input type="number" class="rain-input flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring" step="any" data-week="${escapeHtmlAttr(week)}" placeholder="0" value="${val}" /></td></tr>`;
    }).join("");
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

async function handleProcess() {
    runProcessing();
}

function runProcessing() {
    try {
        const isDbMode = dataSourceTypeEl?.value === "db";
        if (!isDbMode && (!state.rawRows.length || !state.detectedCols)) throw new Error("Upload CSV terlebih dahulu.");
        if (isDbMode && !state.rawRows.length) throw new Error("Ambil data database terlebih dahulu.");

        const p = processData(state.rawRows, state.detectedCols, getRainfallMapFromInputs(), parseScenarioInput(scenarioInputEl.value), baselineWeekEl.value);
        state.processed = p;
        renderModelSummary(p); renderTables(p); renderCharts(p);
        resultsSectionEl.classList.remove("hidden"); exportExcelBtnEl.disabled = false;
        setStatus(`Process selesai. Baseline week: ${p.baselineWeek}.`, "success");
    } catch (error) { 
        setStatus(error.message || "Gagal memproses data.", "warn"); 
    }
}

async function handleFetchFromDB(companyCode, lookbackWeeks) {
    processBtnEl.disabled = true;
    processBtnEl.textContent = "Mengambil data...";
    setStatus(`Menghubungi database untuk company "${companyCode}"...`, "neutral");

    try {
        const params = new URLSearchParams({ companyCode, lookbackWeeks });
        const res = await fetch(`/api/get-piezometer?${params}`);
        if (!res.ok) throw new Error(`HTTP Error ${res.status}`);
        const { data, rainfall } = await res.json();

        if (!data || data.length === 0) throw new Error(`Tidak ada data untuk company "${companyCode}".`);

        const DB_COL_MAP = { week: "month_name", tmat: "ketinggian", estate: "est_code", id: "pie_record_id", block: "block", date: "date_timestamp" };

        state.rawRows = data;
        state.detectedCols = DB_COL_MAP;
        state.weeks = getSortedDistinctWeeks(data, DB_COL_MAP.week);
        state.lastFetch = { company: companyCode, range: lookbackWeeks };

        if (mappingSummaryEl) renderColumnMapping(DB_COL_MAP, Object.values(DB_COL_MAP));
        renderRainfallInputs(state.weeks, rainfall || {});
        renderBaselineOptions(state.weeks);

        // Tampilkan input rainfall dan aktifkan tombol proses
        rainfallInputSectionEl?.classList.remove("hidden");
        processBtnEl.disabled = false;
        setStatus(`Data berhasil diambil: ${data.length} baris. Silakan isi rainfall lalu klik 'Proses Data'.`, "success");
    } catch (error) {
        setStatus(error.message, "warn");
    } finally {
        processBtnEl.disabled = false;
        processBtnEl.textContent = "Proses Data";
    }
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
    const lastN = records.slice(-4); 
    const fitRows = [];
    for (let i = 1; i < lastN.length; i++) { 
        if (Number.isFinite(lastN[i - 1]["Avg TMAT (cm)"]) && Number.isFinite(lastN[i]["Avg TMAT (cm)"]) && Number.isFinite(lastN[i]["Rain (mm)"])) {
            fitRows.push({ 
                x: lastN[i]["Rain (mm)"], 
                y: lastN[i]["Avg TMAT (cm)"] - lastN[i - 1]["Avg TMAT (cm)"] 
            }); 
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
            
            // Calculate R2
            const numR = (n * sumXY - sumX * sumY);
            const denR = Math.sqrt((n * sumX2 - sumX * sumX) * (n * sumY2 - sumY * sumY));
            const tempR2 = denR !== 0 ? Math.pow(numR / denR, 2) : 0;

            // Sanity check for peatland hydrology: b must be negative (rain makes it wetter)
            // If b is positive, it's likely noise, use fallback or cap it.
            if (tempB < 0) {
                a = tempA;
                b = Math.max(tempB, -0.8); // Cap b to -0.8 (extreme response)
                r2 = tempR2;
                method = "fit";
            }
        }
    }

    // Double sanity check for 'a' (natural drop): should usually be positive 
    // unless the estate is actively flooding from groundwater rise.
    return { a, b: Math.min(b, -0.001), r2, fitRows, method };
}

function forecastCountsFromBaseline(counts, dAvg, total) {
    const out = { ...counts };
    // Damping factor: prevent drastic jumps for small dAvg
    const mag = Math.min(Math.abs(dAvg) / 12, 1); 
    
    if (dAvg >= 0) {
        // Drier (Deeper)
        const m1 = 0.20 * mag, m2 = 0.30 * mag, m3 = 0.35 * mag;
        let s = Math.min(out["Normal (46-60)"] * m1, out["Normal (46-60)"]); out["Normal (46-60)"] -= s; out["A Kering (61-65)"] += s;
        s = Math.min(out["A Kering (61-65)"] * m2, out["A Kering (61-65)"]); out["A Kering (61-65)"] -= s; out["Kering (>65)"] += s;
        [["Tergenang (0-40)", "A Tergenang (41-45)"], ["A Tergenang (41-45)", "Normal (46-60)"]].forEach(([src, dst]) => { 
            const s2 = Math.min(out[src] * m3, out[src]); out[src] -= s2; out[dst] += s2; 
        });
    } else {
        // Wetter (Shallower)
        const m1 = 0.25 * mag, m2 = 0.20 * mag, m3 = 0.12 * mag;
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
    const accuracy = p.fit.method === 'fit' ? Math.round(p.fit.r2 * 100) : 0;
    const accuracyLabel = p.fit.method === 'fit' ? `${accuracy}%` : 'Low (N/A)';

    modelSummaryEl.innerHTML = [
        ["Baseline Week", p.baselineWeek], 
        ["Baseline Avg TMAT", formatNumber(p.baselineAvgTMAT, 2)], 
        ["Koefisien a", formatNumber(p.fit.a, 3)], 
        ["Koefisien b", formatNumber(p.fit.b, 4)], 
        ["Akurasi (R²)", accuracyLabel]
    ]
        .map(([l, v]) => `
          <div class="flex flex-col gap-1 p-4 rounded-xl border bg-muted/50">
            <span class="text-xs font-medium text-muted-foreground uppercase tracking-wider">${escapeHtml(l)}</span>
            <span class="text-xl font-bold ${l.includes('R²') && accuracy < 50 ? 'text-yellow-600' : ''}">${escapeHtml(String(v))}</span>
          </div>`).join("");
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

    state.charts.trend = new Chart(document.getElementById("trendChart"), { type: "bar", data: { labels: p.weeks, datasets: [{ type: "bar", label: "Rainfall (mm)", order: 2, data: p.weeklySummaryRecords.map(r => Number.isFinite(r["Rain (mm)"]) ? r["Rain (mm)"] : null), yAxisID: "y1", backgroundColor: barBgColor, hoverBackgroundColor: barBgColorHover }, { type: "line", label: "Avg TMAT (cm)", order: 1, data: p.weeklySummaryRecords.map(r => r["Avg TMAT (cm)"]), yAxisID: "y", tension: 0.3, borderColor: mainLineColor, backgroundColor: mainLineColor, pointRadius: 4 }] }, options: { responsive: true, maintainAspectRatio: false, interaction: { mode: "index", intersect: false }, plugins: { legend: { position: "top", labels: { usePointStyle: true, boxWidth: 8 } } }, scales: { y: { type: "linear", position: "left", title: { display: true, text: "Avg TMAT (cm)" } }, y1: { type: "linear", position: "right", grid: { drawOnChartArea: false }, title: { display: true, text: "Rainfall (mm)" } } } } });
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
    if (!state.processed) return await showModal("Peringatan", "Proses data CSV terlebih dahulu!", true);

    if (userContextEl.value.trim().length < 10) {
        userContextEl.focus();
        return await showModal("Konteks Terlalu Singkat", "Harap isi minimal 10 karakter untuk Konteks Cuaca agar AI dapat menganalisis dengan relevan!", true);
    }

    const isConfirmed = await showModal("Konfirmasi Laporan", "Apakah Anda yakin ingin men-generate laporan? (Tindakan ini akan memanggil AI dan mengonsumsi sebagian kuota API Token)");
    if (!isConfirmed) return;

    generateAiBtnEl.innerHTML = "<span class='animate-pulse'>Generating Laporan...</span>";
    generateAiBtnEl.disabled = true;

    aiOutputContentEl.innerHTML = "<span class='animate-pulse'>Menganalisis kondisi dominan dan menghubungi server, mohon tunggu...</span>";
    aiOutputWrapEl.classList.remove("hidden");
    translateModuleEl.classList.add("hidden");

    try {
        const p = state.processed;
        const userNotes = userContextEl.value;
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

        let dominan = "Normal", instruksiAI = "", arahanPenutup = "";

        // UBAH arahanPenutup agar AI merangkai bahasanya sendiri secara dinamis
        if (pctKering >= Math.max(pctBasah, pctNormal)) {
            dominan = "Kering";
            instruksiAI = `Focus Para 1 on executive risk assessment regarding severe drought, fire hazards, and critical water deficit impacts on plantation yield, since data is ${Math.round(pctKering)}% DRY.`;
            arahanPenutup = `Para 4: Write a strong concluding paragraph addressed to "Manajemen dan Pimpinan Operasional". Summarize that the landscape is experiencing a dominant water deficit. Include the TMAT movement (${prevTmat}cm to ${currTmat}cm) and the change in critical red blocks (${prevRedPct}% to ${currRedPct}%). Naturally integrate the user's weather context: "${userNotes}". Conclude with this specific operational instruction to mitigate risks: "${wmActions}".`;
        } else if (pctBasah >= Math.max(pctKering, pctNormal)) {
            dominan = "Basah";
            instruksiAI = `Focus Para 1 on executive risk assessment regarding inundation, operational access disruption, and urgent drainage priorities, since data is ${Math.round(pctBasah)}% WET/FLOODED.`;
            arahanPenutup = `Para 4: Write a strong concluding paragraph addressed to "Manajemen dan Pimpinan Operasional". Summarize that the landscape is waterlogged with high inundation risks. Include the TMAT movement (${prevTmat}cm to ${currTmat}cm) and the change in wet blocks (${prevWetPct}% to ${currWetPct}%). Naturally integrate the user's weather context: "${userNotes}". Conclude with this specific operational instruction to manage excess water: "${wmActions}".`;
        } else {
            instruksiAI = `Focus Para 1 on executive summary of water stability, maintained ideal moisture for palm productivity, and standard operational readiness, since data is ${Math.round(pctNormal)}% NORMAL.`;
            arahanPenutup = `Para 4: Write a strong concluding paragraph addressed to "Manajemen dan Pimpinan Operasional". Summarize that the water management is stable and under control. Include the TMAT movement (${prevTmat}cm to ${currTmat}cm). Naturally integrate the user's weather context: "${userNotes}". Conclude with this specific operational instruction to maintain current stability: "${wmActions}".`;
        }

        const sc0 = p.scenarioResults.find(s => s.scenarioMm === 0) || p.scenarioResults[0];
        const sc50 = p.scenarioResults.find(s => s.scenarioMm === 50) || p.scenarioResults[1];

        // Prompt Text yang lebih "bebas" namun tetap terkontrol datanya
        const promptText = `
Role: Senior Hydrology Advisor to COO and Plantation Operations Managers.
Task: Write a 4-paragraph TMAT Executive Analysis Report.
Language: STRICTLY INDONESIAN.
Tone: Executive, analytical, risk-focused, and actionable. 
Style Instruction: VARY your vocabulary, sentence structure, and transitions each time you generate this report. Avoid sounding like a rigid template. Make it read naturally like a human expert's dynamic analysis.
Constraint: Output ONLY the 4 paragraphs. No conversational fillers, no markdown.

DATA:
- TMAT: Prev=${prevTmat}cm, Curr=${currTmat}cm.
- Dry(>60cm): ${currentSummary["Kering >60 (count)"]} blk (${Math.round(currentSummary["Kering >60 (%)"])}%).
- Wet(<=45cm): ${currentSummary["Basah <=45 (count)"]} blk (${Math.round(currentSummary["Basah <=45 (%)"])}%).
- Normal(46-60cm): ${countNormal} blk (${Math.round(pctNormal)}%).
- Fcst 0mm: TMAT=${Math.round(Math.abs(sc0.avgNext))}cm, Dry(>65cm)=${sc0.counts["Kering (>65)"]}, Wet(<=45cm)=${sc0.summary["Basah <=45 Count"]}.
- Fcst 50mm: TMAT=${Math.round(Math.abs(sc50.avgNext))}cm, Dry(>65cm)=${sc50.counts["Kering (>65)"]}, Wet(<=45cm)=${sc50.summary["Basah <=45 Count"]}, Normal(46-60cm)=${sc50.counts["Normal (46-60)"]}.

FORMAT INSTRUCTIONS:
Para 1: ${instruksiAI} Compare Prev vs Curr TMAT naturally.
Para 2: Analyze the 0 mm rain projection. Integrate the data naturally into sentences discussing operational risks or recovery.
Para 3: Analyze the 50 mm rain projection. Integrate the data naturally into sentences discussing operational risks or recovery.
${arahanPenutup}
    `;

        const response = await fetch('/api/generate', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ prompt: promptText })
        });

        const data = await response.json();
        if (!response.ok) throw new Error(data.error || "Terjadi kesalahan pada server backend.");

        // Tampilkan Hasil Utama
        const hasilLaporan = data.text.replace(/\*\*/g, '').replace(/\n/g, '<br>');
        aiOutputContentEl.innerHTML = hasilLaporan;

        // Aktifkan modul translasi dan isi otomatis dengan laporan yang baru dibuat
        translateInputEl.value = data.text.replace(/\*\*/g, '');
        translateModuleEl.classList.remove("hidden");
        translateOutputWrapEl.classList.add("hidden");

    } catch (error) {
        console.error(error);
        aiOutputContentEl.innerHTML = `<span class="text-red-600 font-medium">Gagal membuat laporan AI: ${error.message}</span>`;
    } finally {
        generateAiBtnEl.disabled = false;
        generateAiBtnEl.innerHTML = "Generate Laporan (Bahasa Indonesia)";
    }
}

// =========================================================================
// AI TRANSLATION & REWRITE MODULE (BAHASA INGGRIS)
// =========================================================================
async function handleTranslateReport() {
    const textToTranslate = translateInputEl.value.trim();
    if (!textToTranslate) return await showModal("Peringatan", "Silakan masukkan teks yang ingin ditranslate!", true);

    const isConfirmed = await showModal("Konfirmasi Translate", "Apakah Anda yakin ingin melakukan Rewrite & Translate? (Tindakan ini akan memanggil API AI dan mengonsumsi token)");
    if (!isConfirmed) return;

    translateBtnEl.innerHTML = "<span class='animate-pulse'>Processing...</span>";
    translateBtnEl.disabled = true;

    translateOutputContentEl.innerHTML = "<span class='animate-pulse text-green-700'>Memperbaiki grammar dan menerjemahkan, mohon tunggu...</span>";
    translateOutputWrapEl.classList.remove("hidden");

    try {
        // Prompt Translasi Berbahasa Inggris (Executive Tone)
        const promptText = `
Role: Senior Executive Translator & Hydrology Advisor.
Task: Translate and rewrite the following Indonesian Executive Report into formal, C-Suite level English. Ensure the tone is authoritative, risk-focused, and highly professional.
Constraint: Output ONLY the translated English text. No conversational fillers, no markdown, no bold text.
Terminology Mapping:
- "tanggul" -> "embankment"
- "TMAS" -> "water level"
- "TMAT" -> "ground water"

TEXT TO TRANSLATE:
${textToTranslate}
    `;

        // Gunakan backend endpoint API yang sama!
        const response = await fetch('/api/generate', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ prompt: promptText })
        });

        const data = await response.json();
        if (!response.ok) throw new Error(data.error || "Terjadi kesalahan pada server backend.");

        translateOutputContentEl.innerHTML = data.text.replace(/\*\*/g, '').replace(/\n/g, '<br>');

    } catch (error) {
        console.error(error);
        translateOutputContentEl.innerHTML = `<span class="text-red-600 font-medium">Gagal menerjemahkan: ${error.message}</span>`;
    } finally {
        translateBtnEl.disabled = false;
        translateBtnEl.innerHTML = "Rewrite & Translate";
    }
}

// =========================================================================
// PIEZOMETER DATA SYNC MODULE
// =========================================================================
const WEEK_CALENDAR = [
  {"Month":1,"Year":2025,"Week":1,"StartDate":"2024-12-30","EndDate":"2025-01-05","WeekName":"W112025"},
  {"Month":1,"Year":2025,"Week":2,"StartDate":"2025-01-06","EndDate":"2025-01-12","WeekName":"W212025"},
  {"Month":1,"Year":2025,"Week":3,"StartDate":"2025-01-13","EndDate":"2025-01-19","WeekName":"W312025"},
  {"Month":1,"Year":2025,"Week":4,"StartDate":"2025-01-20","EndDate":"2025-01-26","WeekName":"W412025"},
  {"Month":1,"Year":2025,"Week":5,"StartDate":"2025-01-27","EndDate":"2025-02-02","WeekName":"W512025"},
  {"Month":2,"Year":2025,"Week":1,"StartDate":"2025-02-03","EndDate":"2025-02-09","WeekName":"W122025"},
  {"Month":2,"Year":2025,"Week":2,"StartDate":"2025-02-10","EndDate":"2025-02-16","WeekName":"W222025"},
  {"Month":2,"Year":2025,"Week":3,"StartDate":"2025-02-17","EndDate":"2025-02-23","WeekName":"W322025"},
  {"Month":2,"Year":2025,"Week":4,"StartDate":"2025-02-24","EndDate":"2025-03-02","WeekName":"W42025"},
  {"Month":3,"Year":2025,"Week":1,"StartDate":"2025-03-03","EndDate":"2025-03-09","WeekName":"W132025"},
  {"Month":3,"Year":2025,"Week":2,"StartDate":"2025-03-10","EndDate":"2025-03-16","WeekName":"W232025"},
  {"Month":3,"Year":2025,"Week":3,"StartDate":"2025-03-17","EndDate":"2025-03-23","WeekName":"W332025"},
  {"Month":3,"Year":2025,"Week":4,"StartDate":"2025-03-24","EndDate":"2025-03-30","WeekName":"W432025"},
  {"Month":4,"Year":2025,"Week":1,"StartDate":"2025-03-31","EndDate":"2025-04-06","WeekName":"W142025"},
  {"Month":4,"Year":2025,"Week":2,"StartDate":"2025-04-07","EndDate":"2025-04-13","WeekName":"W242025"},
  {"Month":4,"Year":2025,"Week":3,"StartDate":"2025-04-14","EndDate":"2025-04-20","WeekName":"W342025"},
  {"Month":4,"Year":2025,"Week":4,"StartDate":"2025-04-21","EndDate":"2025-04-27","WeekName":"W442025"},
  {"Month":5,"Year":2025,"Week":1,"StartDate":"2025-04-28","EndDate":"2025-05-04","WeekName":"W152025"},
  {"Month":5,"Year":2025,"Week":2,"StartDate":"2025-05-05","EndDate":"2025-05-11","WeekName":"W252025"},
  {"Month":5,"Year":2025,"Week":3,"StartDate":"2025-05-12","EndDate":"2025-05-18","WeekName":"W352025"},
  {"Month":5,"Year":2025,"Week":4,"StartDate":"2025-05-19","EndDate":"2025-05-25","WeekName":"W452025"},
  {"Month":5,"Year":2025,"Week":5,"StartDate":"2025-05-26","EndDate":"2025-06-01","WeekName":"W552025"},
  {"Month":6,"Year":2025,"Week":1,"StartDate":"2025-06-02","EndDate":"2025-06-08","WeekName":"W162025"},
  {"Month":6,"Year":2025,"Week":2,"StartDate":"2025-06-09","EndDate":"2025-06-15","WeekName":"W262025"},
  {"Month":6,"Year":2025,"Week":3,"StartDate":"2025-06-16","EndDate":"2025-06-22","WeekName":"W362025"},
  {"Month":6,"Year":2025,"Week":4,"StartDate":"2025-06-23","EndDate":"2025-06-29","WeekName":"W462025"},
  {"Month":7,"Year":2025,"Week":1,"StartDate":"2025-06-30","EndDate":"2025-07-06","WeekName":"W172025"},
  {"Month":7,"Year":2025,"Week":2,"StartDate":"2025-07-07","EndDate":"2025-07-13","WeekName":"W272025"},
  {"Month":7,"Year":2025,"Week":3,"StartDate":"2025-07-14","EndDate":"2025-07-20","WeekName":"W372025"},
  {"Month":7,"Year":2025,"Week":4,"StartDate":"2025-07-21","EndDate":"2025-07-27","WeekName":"W472025"},
  {"Month":7,"Year":2025,"Week":5,"StartDate":"2025-07-28","EndDate":"2025-08-03","WeekName":"W572025"},
  {"Month":8,"Year":2025,"Week":1,"StartDate":"2025-08-04","EndDate":"2025-08-10","WeekName":"W182025"},
  {"Month":8,"Year":2025,"Week":2,"StartDate":"2025-08-11","EndDate":"2025-08-17","WeekName":"W282025"},
  {"Month":8,"Year":2025,"Week":3,"StartDate":"2025-08-18","EndDate":"2025-08-24","WeekName":"W382025"},
  {"Month":8,"Year":2025,"Week":4,"StartDate":"2025-08-25","EndDate":"2025-08-31","WeekName":"W482025"},
  {"Month":9,"Year":2025,"Week":1,"StartDate":"2025-09-01","EndDate":"2025-09-07","WeekName":"W192025"},
  {"Month":9,"Year":2025,"Week":2,"StartDate":"2025-09-08","EndDate":"2025-09-14","WeekName":"W292025"},
  {"Month":9,"Year":2025,"Week":3,"StartDate":"2025-09-15","EndDate":"2025-09-21","WeekName":"W392025"},
  {"Month":9,"Year":2025,"Week":4,"StartDate":"2025-09-22","EndDate":"2025-09-28","WeekName":"W492025"},
  {"Month":10,"Year":2025,"Week":1,"StartDate":"2025-09-29","EndDate":"2025-10-05","WeekName":"W1102025"},
  {"Month":10,"Year":2025,"Week":2,"StartDate":"2025-10-06","EndDate":"2025-10-12","WeekName":"W2102025"},
  {"Month":10,"Year":2025,"Week":3,"StartDate":"2025-10-13","EndDate":"2025-10-19","WeekName":"W3102025"},
  {"Month":10,"Year":2025,"Week":4,"StartDate":"2025-10-20","EndDate":"2025-10-26","WeekName":"W4102025"},
  {"Month":10,"Year":2025,"Week":5,"StartDate":"2025-10-27","EndDate":"2025-11-02","WeekName":"W5102025"},
  {"Month":11,"Year":2025,"Week":1,"StartDate":"2025-11-03","EndDate":"2025-11-09","WeekName":"W1112025"},
  {"Month":11,"Year":2025,"Week":2,"StartDate":"2025-11-10","EndDate":"2025-11-16","WeekName":"W2112025"},
  {"Month":11,"Year":2025,"Week":3,"StartDate":"2025-11-17","EndDate":"2025-11-23","WeekName":"W3112025"},
  {"Month":11,"Year":2025,"Week":4,"StartDate":"2025-11-24","EndDate":"2025-11-30","WeekName":"W4112025"},
  {"Month":12,"Year":2025,"Week":1,"StartDate":"2025-12-01","EndDate":"2025-12-07","WeekName":"W1122025"},
  {"Month":12,"Year":2025,"Week":2,"StartDate":"2025-12-08","EndDate":"2025-12-14","WeekName":"W2122025"},
  {"Month":12,"Year":2025,"Week":3,"StartDate":"2025-12-15","EndDate":"2025-12-21","WeekName":"W3122025"},
  {"Month":12,"Year":2025,"Week":4,"StartDate":"2025-12-22","EndDate":"2025-12-28","WeekName":"W4122025"},
  {"Month":1,"Year":2026,"Week":1,"StartDate":"2025-12-29","EndDate":"2026-01-04","WeekName":"W112026"},
  {"Month":1,"Year":2026,"Week":2,"StartDate":"2026-01-05","EndDate":"2026-01-11","WeekName":"W212026"},
  {"Month":1,"Year":2026,"Week":3,"StartDate":"2026-01-12","EndDate":"2026-01-18","WeekName":"W312026"},
  {"Month":1,"Year":2026,"Week":4,"StartDate":"2026-01-19","EndDate":"2026-01-25","WeekName":"W412026"},
  {"Month":1,"Year":2026,"Week":5,"StartDate":"2026-01-26","EndDate":"2026-02-01","WeekName":"W512026"},
  {"Month":2,"Year":2026,"Week":1,"StartDate":"2026-02-02","EndDate":"2026-02-08","WeekName":"W122026"},
  {"Month":2,"Year":2026,"Week":2,"StartDate":"2026-02-09","EndDate":"2026-02-15","WeekName":"W222026"},
  {"Month":2,"Year":2026,"Week":3,"StartDate":"2026-02-16","EndDate":"2026-02-22","WeekName":"W322026"},
  {"Month":2,"Year":2026,"Week":4,"StartDate":"2026-02-23","EndDate":"2026-03-01","WeekName":"W422026"},
  {"Month":3,"Year":2026,"Week":1,"StartDate":"2026-03-02","EndDate":"2026-03-08","WeekName":"W132026"},
  {"Month":3,"Year":2026,"Week":2,"StartDate":"2026-03-09","EndDate":"2026-03-15","WeekName":"W232026"},
  {"Month":3,"Year":2026,"Week":3,"StartDate":"2026-03-16","EndDate":"2026-03-22","WeekName":"W332026"},
  {"Month":3,"Year":2026,"Week":4,"StartDate":"2026-03-23","EndDate":"2026-03-29","WeekName":"W432026"},
  {"Month":4,"Year":2026,"Week":1,"StartDate":"2026-03-30","EndDate":"2026-04-05","WeekName":"W142026"},
  {"Month":4,"Year":2026,"Week":2,"StartDate":"2026-04-06","EndDate":"2026-04-12","WeekName":"W242026"},
  {"Month":4,"Year":2026,"Week":3,"StartDate":"2026-04-13","EndDate":"2026-04-19","WeekName":"W342026"},
  {"Month":4,"Year":2026,"Week":4,"StartDate":"2026-04-20","EndDate":"2026-04-26","WeekName":"W442026"},
  {"Month":4,"Year":2026,"Week":5,"StartDate":"2026-04-27","EndDate":"2026-05-03","WeekName":"W542026"},
  {"Month":5,"Year":2026,"Week":1,"StartDate":"2026-05-04","EndDate":"2026-05-10","WeekName":"W152026"},
  {"Month":5,"Year":2026,"Week":2,"StartDate":"2026-05-11","EndDate":"2026-05-17","WeekName":"W252026"},
  {"Month":5,"Year":2026,"Week":3,"StartDate":"2026-05-18","EndDate":"2026-05-24","WeekName":"W352026"},
  {"Month":5,"Year":2026,"Week":4,"StartDate":"2026-05-25","EndDate":"2026-05-31","WeekName":"W452026"},
  {"Month":6,"Year":2026,"Week":1,"StartDate":"2026-06-01","EndDate":"2026-06-07","WeekName":"W162026"},
  {"Month":6,"Year":2026,"Week":2,"StartDate":"2026-06-08","EndDate":"2026-06-14","WeekName":"W262026"},
  {"Month":6,"Year":2026,"Week":3,"StartDate":"2026-06-15","EndDate":"2026-06-21","WeekName":"W362026"},
  {"Month":6,"Year":2026,"Week":4,"StartDate":"2026-06-22","EndDate":"2026-06-28","WeekName":"W462026"},
  {"Month":7,"Year":2026,"Week":1,"StartDate":"2026-06-29","EndDate":"2026-07-05","WeekName":"W172026"},
  {"Month":7,"Year":2026,"Week":2,"StartDate":"2026-07-06","EndDate":"2026-07-12","WeekName":"W272026"},
  {"Month":7,"Year":2026,"Week":3,"StartDate":"2026-07-13","EndDate":"2026-07-19","WeekName":"W372026"},
  {"Month":7,"Year":2026,"Week":4,"StartDate":"2026-07-20","EndDate":"2026-07-26","WeekName":"W472026"},
  {"Month":7,"Year":2026,"Week":5,"StartDate":"2026-07-27","EndDate":"2026-08-02","WeekName":"W572026"},
  {"Month":8,"Year":2026,"Week":1,"StartDate":"2026-08-03","EndDate":"2026-08-09","WeekName":"W182026"},
  {"Month":8,"Year":2026,"Week":2,"StartDate":"2026-08-10","EndDate":"2026-08-16","WeekName":"W282026"},
  {"Month":8,"Year":2026,"Week":3,"StartDate":"2026-08-17","EndDate":"2026-08-23","WeekName":"W382026"},
  {"Month":8,"Year":2026,"Week":4,"StartDate":"2026-08-24","EndDate":"2026-08-30","WeekName":"W482026"},
  {"Month":9,"Year":2026,"Week":1,"StartDate":"2026-08-31","EndDate":"2026-09-06","WeekName":"W192026"},
  {"Month":9,"Year":2026,"Week":2,"StartDate":"2026-09-07","EndDate":"2026-09-13","WeekName":"W292026"},
  {"Month":9,"Year":2026,"Week":3,"StartDate":"2026-09-14","EndDate":"2026-09-20","WeekName":"W392026"},
  {"Month":9,"Year":2026,"Week":4,"StartDate":"2026-09-21","EndDate":"2026-09-27","WeekName":"W492026"},
  {"Month":10,"Year":2026,"Week":1,"StartDate":"2026-09-28","EndDate":"2026-10-04","WeekName":"W1102026"},
  {"Month":10,"Year":2026,"Week":2,"StartDate":"2026-10-05","EndDate":"2026-10-11","WeekName":"W2102026"},
  {"Month":10,"Year":2026,"Week":3,"StartDate":"2026-10-12","EndDate":"2026-10-18","WeekName":"W3102026"},
  {"Month":10,"Year":2026,"Week":4,"StartDate":"2026-10-19","EndDate":"2026-10-25","WeekName":"W4102026"},
  {"Month":10,"Year":2026,"Week":5,"StartDate":"2026-10-26","EndDate":"2026-11-01","WeekName":"W5102026"},
  {"Month":11,"Year":2026,"Week":1,"StartDate":"2026-11-02","EndDate":"2026-11-08","WeekName":"W1112026"},
  {"Month":11,"Year":2026,"Week":2,"StartDate":"2026-11-09","EndDate":"2026-11-15","WeekName":"W2112026"},
  {"Month":11,"Year":2026,"Week":3,"StartDate":"2026-11-16","EndDate":"2026-11-22","WeekName":"W3112026"},
  {"Month":11,"Year":2026,"Week":4,"StartDate":"2026-11-23","EndDate":"2026-11-29","WeekName":"W4112026"},
  {"Month":12,"Year":2026,"Week":1,"StartDate":"2026-11-30","EndDate":"2026-12-06","WeekName":"W1122026"},
  {"Month":12,"Year":2026,"Week":2,"StartDate":"2026-12-07","EndDate":"2026-12-13","WeekName":"W2122026"},
  {"Month":12,"Year":2026,"Week":3,"StartDate":"2026-12-14","EndDate":"2026-12-20","WeekName":"W3122026"},
  {"Month":12,"Year":2026,"Week":4,"StartDate":"2026-12-21","EndDate":"2026-12-27","WeekName":"W4122026"},
  {"Month":12,"Year":2026,"Week":5,"StartDate":"2026-12-28","EndDate":"2027-01-03","WeekName":"W5122026"}
];

async function handleSyncPiezometer() {
    const today = new Date();
    today.setHours(0,0,0,0);
    
    // Temukan minggu ini dari array WEEK_CALENDAR
    let currentWeek = WEEK_CALENDAR[WEEK_CALENDAR.length - 1]; // default akhir tahun 2026
    for (const w of WEEK_CALENDAR) {
        const sd = new Date(w.StartDate); sd.setHours(0,0,0,0);
        const ed = new Date(w.EndDate); ed.setHours(23,59,59,999);
        if (today >= sd && today <= ed) {
            currentWeek = w;
            break;
        }
    }

    const monthNames = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
    const formattedWeek = `${monthNames[currentWeek.Month - 1]} ${currentWeek.Year}, W${currentWeek.Week}`;

    const isConfirmed = await showModal("Konfirmasi Update Data", `Sesuai prosedur, seluruh data lama telah dimigrasikan dari CLI. Proses ini hanya akan menarik data pada minggu ini (${formattedWeek}) rentang ${currentWeek.StartDate} - ${currentWeek.EndDate}. Lanjutkan?`);
    if (!isConfirmed) return;

    syncPiezometerBtnEl.disabled = true;
    syncPiezometerBtnEl.classList.add("opacity-50", "pointer-events-none");
    syncPiezometerBtnEl.querySelector("svg")?.classList.add("animate-spin");
    
    syncStatusTextEl.classList.remove("hidden");
    syncStatusTextEl.textContent = "Menyiapkan sinkronisasi...";

    const companies = [
        "PT.THIP", "PT.PTW", "PT.SUMS", "PT.WKN", "PT.PANPS", "PT.SAM", 
        "PT.NJP", "PT.PLDK", "PT.SUMK", "PT.BAS", "PT.AAN", "PT.GAN", 
        "PT.AJP", "PT.JJP", "PT.SIP", "PT.WSM"
    ];

    let totalInserted = 0;
    
    try {
        let i = 0;
        const totalSteps = companies.length;

        for (const company of companies) {
            i++;
            syncStatusTextEl.textContent = `Syncing [${i}/${totalSteps}]: ${company} (${formattedWeek})`;
            
            try {
                const response = await fetch('/api/sync-piezometer', {
                    method: 'POST',
                    headers: { 
                        'Content-Type': 'application/json',
                        'x-admin-key': getAdminKey() 
                    },
                    body: JSON.stringify({
                        companyCode: company,
                        startDate: currentWeek.StartDate,
                        endDate: currentWeek.EndDate
                    })
                });

                if (response.status === 401) {
                    state.adminKey = ''; // Reset key if unauthorized
                    throw new Error("Admin Key salah atau tidak valid.");
                }

                if (response.ok) {
                    const data = await response.json();
                    if (data.inserted) {
                        totalInserted += data.inserted;
                    }
                } else {
                    console.error("Gagal menarik", company, currentWeek.StartDate);
                }
            } catch (e) {
                console.error("Fetch Error:", e);
            }
            
            // Jeda 400ms agar server API / remote API stabil
            await new Promise(r => setTimeout(r, 400));
        }
        syncStatusTextEl.textContent = `Data ${formattedWeek} selesai! Ditambahkan ${totalInserted} baris.`;
        syncStatusTextEl.classList.add("text-green-600");
    } catch (err) {
        console.error(err);
        syncStatusTextEl.textContent = "Sinkronisasi gagal, periksa koneksi.";
        syncStatusTextEl.classList.add("text-red-500");
    } finally {
        syncPiezometerBtnEl.disabled = false;
        syncPiezometerBtnEl.classList.remove("opacity-50", "pointer-events-none");
        syncPiezometerBtnEl.querySelector("svg")?.classList.remove("animate-spin");
        setTimeout(() => {
            syncStatusTextEl.classList.add("hidden");
            syncStatusTextEl.classList.remove("text-green-600", "text-red-500");
            syncStatusTextEl.textContent = "";
        }, 8000);
    }
}

async function handleSyncRainfall() {
    const adminKey = getAdminKey();
    if (!adminKey) return;

    syncRainfallBtnEl.disabled = true;
    syncRainfallBtnEl.querySelector("svg").classList.add("animate-spin");
    syncStatusTextEl.classList.remove("hidden");
    syncStatusTextEl.textContent = "⌛ Syncing Rainfall (Last 4 weeks)...";

    try {
        const response = await fetch('/api/sync-rainfall', {
            method: 'POST',
            headers: { 
                'Content-Type': 'application/json',
                'x-admin-key': adminKey
            }
        });

        if (response.status === 401) {
            state.adminKey = '';
            throw new Error("Admin Key salah atau tidak valid.");
        }

        const data = await response.json();
        if (!response.ok) throw new Error(data.error || "Gagal sinkronisasi curah hujan.");

        syncStatusTextEl.textContent = `✅ Rainfall Sync sukses! (${data.inserted} dpt).`;
        setTimeout(() => syncStatusTextEl.classList.add("hidden"), 5000);
        await showModal("Sukses", `Berhasil sinkronisasi ${data.inserted} data curah hujan harian.`, true);

    } catch (error) {
        console.error(error);
        syncStatusTextEl.textContent = "❌ Sync Rainfall Gagal.";
        await showModal("Error", error.message, true);
    } finally {
        syncRainfallBtnEl.disabled = false;
        syncRainfallBtnEl.querySelector("svg").classList.remove("animate-spin");
    }
}

async function handleFullResync() {
    const isConfirmed = await showModal(
        "Konfirmasi Full Resync",
        "Tindakan ini akan MENGHAPUS (DROP) semua data di database dan melakukan sync ulang dari awal (2025). Proses ini memakan waktu beberapa menit. Lanjutkan?"
    );

    if (!isConfirmed) return;

    // Reset UI
    fullResyncBtnEl.disabled = true;
    resyncProgressWrapEl.classList.remove("hidden");
    resyncLogEl.innerHTML = '';
    resyncStatusBadgeEl.textContent = "Berjalan...";
    resyncStatusBadgeEl.className = "text-xs px-2 py-0.5 rounded-full bg-orange-200 text-orange-800 animate-pulse";

    try {
        const response = await fetch('/api/full-resync', { 
            method: 'POST',
            headers: { 'x-admin-key': getAdminKey() }
        });
        
        if (response.status === 401) {
            state.adminKey = '';
            throw new Error("Admin Key salah atau tidak valid.");
        }
        
        if (!response.ok) throw new Error("Gagal menghubungi server sync.");

        const reader = response.body.getReader();
        const decoder = new TextDecoder();
        let buffer = '';

        while (true) {
            const { done, value } = await reader.read();
            if (done) break;

            buffer += decoder.decode(value, { stream: true });
            const lines = buffer.split('\n');
            
            // Simpan baris terakhir yang mungkin belum lengkap ke buffer untuk chunk berikutnya
            buffer = lines.pop();

            lines.forEach(line => {
                const trimmedLine = line.trim();
                if (trimmedLine.startsWith('data: ')) {
                    try {
                        const dataString = trimmedLine.substring(6).trim();
                        if (!dataString) return;
                        
                        const data = JSON.parse(dataString);
                        
                        // Tambah log ke panel
                        const logLine = document.createElement('div');
                        logLine.textContent = data.msg;
                        resyncLogEl.appendChild(logLine);
                        resyncLogEl.scrollTop = resyncLogEl.scrollHeight;

                        if (data.msg === 'DONE') {
                            resyncStatusBadgeEl.textContent = "Selesai";
                            resyncStatusBadgeEl.className = "text-xs px-2 py-0.5 rounded-full bg-green-200 text-green-800";
                            setStatus("Full Resync Database selesai.", "success");
                        } else if (data.msg.startsWith('❌ ERROR')) {
                            throw new Error(data.msg);
                        }
                    } catch (e) {
                        console.warn("Gagal parse line:", trimmedLine, e);
                    }
                }
            });
        }
    } catch (error) {
        resyncStatusBadgeEl.textContent = "Error";
        resyncStatusBadgeEl.className = "text-xs px-2 py-0.5 rounded-full bg-red-200 text-red-800";
        const errLine = document.createElement('div');
        errLine.className = "text-red-600 font-bold";
        errLine.textContent = `❌ ERROR: ${error.message}`;
        resyncLogEl.appendChild(errLine);
        setStatus("Resync gagal. Cek log progress.", "warn");
    } finally {
        fullResyncBtnEl.disabled = false;
    }
}