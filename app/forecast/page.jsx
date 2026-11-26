"use client";

import React, { useState, useEffect, useRef } from 'react';
import { processData, parseScenarioInput, parseWeekName, detectColumns, getSortedDistinctWeeks, CLASS_ORDER, CLASS_COLORS, formatNumber } from '../../lib/forecastEngine';
import Papa from 'papaparse';
import * as XLSX from 'xlsx';
import { Database, UploadCloud, Download, Play, RefreshCw, BarChart2, FileText, Table2, DatabaseZap, ChevronDown, ChevronUp, AlertTriangle, ClipboardCopy, Check } from 'lucide-react';
import { Chart as ChartJS, CategoryScale, LinearScale, PointElement, LineElement, BarElement, Title, Tooltip, Legend } from 'chart.js';
import { Chart } from 'react-chartjs-2';

ChartJS.register(CategoryScale, LinearScale, PointElement, LineElement, BarElement, Title, Tooltip, Legend);

const COMPANIES = [
  "PT.THIP", "PT.PTW", "PT.SUMS", "PT.WKN", "PT.PANPS", "PT.SAM",
  "PT.NJP", "PT.PLDK", "PT.SUMK", "PT.BAS", "PT.AAN", "PT.GAN",
  "PT.AJP", "PT.JJP", "PT.SIP", "PT.WSM"
];

export default function ForecastPage() {
  const [sourceType, setSourceType] = useState('db'); // 'db' or 'csv'
  const [dbCompany, setDbCompany] = useState('Semua');
  const [dbRange, setDbRange] = useState('4');
  
  const [rawRows, setRawRows] = useState([]);
  const [detectedCols, setDetectedCols] = useState(null);
  const [weeks, setWeeks] = useState([]);
  const [estateRainfall, setEstateRainfall] = useState({});
  const [rainfallMap, setRainfallMap] = useState({}); // user inputs
  
  const [baselineWeek, setBaselineWeek] = useState('');
  const [forecastModel, setForecastModel] = useState('estate');
  const [scenarioInput, setScenarioInput] = useState('0,50');
  
  const [status, setStatus] = useState({ msg: 'Pilih sumber data dan klik Ambil Data.', type: 'neutral' });
  const [isFetching, setIsFetching] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  
  const [processed, setProcessed] = useState(null);
  const [activeTab, setActiveTab] = useState('dashboard');
  const [showRainfall, setShowRainfall] = useState(false);
  const [dataStale, setDataStale] = useState(false);
  const [tableCopied, setTableCopied] = useState(false);

  // AI Laporan States
  const [userContext, setUserContext] = useState('');
  const [wmActions, setWmActions] = useState('');
  const [aiReport, setAiReport] = useState('');
  const [isGenerating, setIsGenerating] = useState(false);
  const [reportCopied, setReportCopied] = useState(false);

  // Translation States
  const [translateText, setTranslateText] = useState('');
  const [translatedReport, setTranslatedReport] = useState('');
  const [isTranslating, setIsTranslating] = useState(false);
  const [translateCopied, setTranslateCopied] = useState(false);

  const handleGenerateAI = async () => {
    if (!processed) return;
    
    if (userContext.trim().length < 10) {
      setStatus({ msg: 'Harap isi minimal 10 karakter untuk Konteks Cuaca agar AI dapat menganalisis dengan relevan!', type: 'error' });
      return;
    }

    setIsGenerating(true);
    setAiReport('');
    try {
      const forecastDataJson = JSON.stringify(processed.forecastRows);
      
      const promptText = `
[WEATHER CONTEXT]: ${userContext}
[FIELD ACTIONS]: ${wmActions || "No specific field actions recorded."}
[FORECAST DATA]: ${forecastDataJson}
      `.trim();

      const res = await fetch('/api/generate-ai-report', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          prompt: promptText
        })
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || 'Gagal generate laporan');
      
      const report = json.text;
      setAiReport(report);
      setTranslateText(report);
      setStatus({ msg: 'Hydrological Forecast Report berhasil dibuat!', type: 'success' });
    } catch (err) {
      setStatus({ msg: err.message, type: 'error' });
    } finally {
      setIsGenerating(false);
    }
  };

  const handleTranslateReport = async () => {
    if (!translateText.trim()) return;
    setIsTranslating(true);
    try {
        const promptText = `
Role: Senior Executive Translator & Hydrology Advisor.
Task: Translate and rewrite the following Indonesian Executive Report into formal, C-Suite level English. Ensure the tone is authoritative, risk-focused, and highly professional.
Constraint: Output ONLY the translated English text. No conversational fillers, no markdown, no bold text.
Terminology Mapping:
- "tanggul" -> "embankment"
- "TMAS" -> "water level"
- "TMAT" -> "ground water"

TEXT TO TRANSLATE:
${translateText}
    `;

        const res = await fetch('/api/generate-ai-report', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ 
                prompt: promptText,
                systemPrompt: "Anda adalah penerjemah eksekutif ahli agronomi."
            })
        });

        const json = await res.json();
        if (!res.ok) throw new Error(json.error || "Terjadi kesalahan pada server backend.");

        setTranslatedReport(json.text);
        setStatus({ msg: 'Laporan berhasil diterjemahkan!', type: 'success' });
    } catch (err) {
        setStatus({ msg: err.message, type: 'error' });
    } finally {
        setIsTranslating(false);
    }
  };

  const handleFetchDB = async () => {
    setIsFetching(true);
    setStatus({ msg: `Menghubungi database untuk company "${dbCompany}"...`, type: 'neutral' });
    try {
        const params = new URLSearchParams({ companyCode: dbCompany, lookbackWeeks: dbRange });
        const res = await fetch(`/api/get-piezometer?${params}`);
        if (!res.ok) throw new Error(`HTTP Error ${res.status}`);
        const responseJson = await res.json();
        const { data, rainfall, estateRainfall: dbEstRain, weekObjects } = responseJson;

        if (!data || data.length === 0) throw new Error(`Tidak ada data untuk company "${dbCompany}".`);

        const DB_COL_MAP = { week: "month_name", tmat: "ketinggian", estate: "est_code", id: "pie_record_id", block: "block", date: "date_timestamp" };
        const foundWeeks = getSortedDistinctWeeks(data, DB_COL_MAP.week);

        setRawRows(data);
        setDetectedCols(DB_COL_MAP);
        setWeeks(foundWeeks);
        setEstateRainfall(dbEstRain || {});
        
        // Setup initial rainfall inputs
        const initialRainMap = {};
        foundWeeks.forEach(w => {
            initialRainMap[w] = rainfall?.[w] !== undefined ? rainfall[w].toFixed(2) : "";
        });
        setRainfallMap(initialRainMap);
        // Default to current week if available in data, else latest
        const now = new Date();
        const currentWeekObj = weekObjects ? weekObjects.find(w => {
          if (!w.start_date || !w.end_date) return false;
          const start = new Date(w.start_date);
          const end = new Date(w.end_date);
          end.setHours(23, 59, 59, 999);
          return now >= start && now <= end;
        }) : null;

        const currentWeekName = currentWeekObj ? currentWeekObj.formatted_name : '';
        const hasCurrentData = foundWeeks.includes(currentWeekName);

        const defaultWeek = hasCurrentData ? currentWeekName : (foundWeeks[foundWeeks.length - 1] || '');
        setBaselineWeek(defaultWeek);
        
        // Check data freshness: is the latest week the current calendar week?
        const latestWeek = foundWeeks[foundWeeks.length - 1] || '';
        const parsed = parseWeekName(latestWeek);
        const currentMonth = now.getMonth() + 1; // 1-indexed
        const currentYear = now.getFullYear();
        const currentWeekOfMonth = Math.ceil(now.getDate() / 7);
        const isStale = parsed.year < currentYear || parsed.month < currentMonth || (parsed.month === currentMonth && parsed.week < currentWeekOfMonth);
        setDataStale(isStale);
        
        setShowRainfall(true);
        setStatus({ msg: `Data berhasil diambil: ${data.length} baris.${isStale ? ' ⚠️ Data belum ter-update minggu ini.' : ' ✅ Data sudah terbaru.'}`, type: isStale ? 'warning' : 'success' });
    } catch (err) {
        setStatus({ msg: err.message, type: 'error' });
    } finally {
        setIsFetching(false);
    }
  };

  const handleFileUpload = (e) => {
    const file = e.target.files[0];
    if (!file) return;

    Papa.parse(file, {
        header: true, skipEmptyLines: true,
        complete: (results) => {
            try {
                if (!Array.isArray(results.data) || !results.data.length) throw new Error("CSV kosong.");
                const cleanedRows = results.data.filter((row) => Object.values(row).some((value) => String(value ?? "").trim() !== ""));
                const cols = detectColumns(results.meta.fields || []);
                if (!cols.week) throw new Error("Kolom Week tidak ditemukan.");
                if (!cols.tmat) throw new Error("Kolom TMAT tidak ditemukan.");

                const foundWeeks = getSortedDistinctWeeks(cleanedRows, cols.week);
                
                setRawRows(cleanedRows);
                setDetectedCols(cols);
                setWeeks(foundWeeks);
                setBaselineWeek(foundWeeks[foundWeeks.length - 1] || '');
                
                const initialRainMap = {};
                foundWeeks.forEach(w => initialRainMap[w] = "");
                setRainfallMap(initialRainMap);
                
                setShowRainfall(true);
                setStatus({ msg: `CSV berhasil dibaca. Total baris: ${cleanedRows.length}.`, type: 'success' });
            } catch (err) {
                setStatus({ msg: err.message, type: 'error' });
            }
        }
    });
  };

  const handleProcess = () => {
    try {
        if (!rawRows.length) throw new Error("Tidak ada data untuk diproses.");
        
        // Data freshness warning
        if (dataStale) {
            const proceed = window.confirm(
                'Data piezometer & curah hujan belum ter-update untuk minggu ini.\n\n'
                + 'Hasil prediksi mungkin tidak akurat karena menggunakan data lama.\n\n'
                + 'Disarankan klik "Update (Minggu Ini)" terlebih dahulu di header halaman ini.\n\n'
                + 'Tetap lanjutkan dengan data lama?'
            );
            if (!proceed) return;
        }
        
        const numericRainMap = {};
        Object.keys(rainfallMap).forEach(k => {
            numericRainMap[k] = rainfallMap[k] === "" ? NaN : Number(rainfallMap[k]);
        });
        
        const scenarios = parseScenarioInput(scenarioInput);
        
        const result = processData(rawRows, detectedCols, numericRainMap, scenarios, baselineWeek, forecastModel, estateRainfall);
        setProcessed(result);
        setStatus({ msg: `Proses selesai. Baseline week: ${result.baselineWeek}.`, type: 'success' });
        setActiveTab('dashboard'); // auto switch to dashboard
    } catch (err) {
        setStatus({ msg: err.message, type: 'error' });
    }
  };

  const handleExportExcel = () => {
    if (!processed) return;
    const wb = XLSX.utils.book_new();
    const add = (data, name) => XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(data.length ? data : [{ Info: "No Data" }]), name);
    
    add(processed.rawRows, "Raw"); 
    add(processed.weeklySummaryRecords, "WeeklySummary"); 
    XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet([["Baseline Week", processed.baselineWeek], [], ["Kelas TMAT", "Count", "%"], ...CLASS_ORDER.map(c => [c, processed.baselineCounts[c], processed.baselinePct[c]])]), "Baseline");
    add(processed.forecastRows, "Forecast"); 
    add(processed.forecastSummaryRows, "ForecastSummary");
    
    XLSX.writeFile(wb, `TMAT_Forecast_${String(processed.baselineWeek || "export").toLowerCase().replace(/[^a-z0-9]+/g, "_")}.xlsx`);
  };

  const handleUpdateRecent = async () => {
    const key = window.prompt("Masukkan Admin Key untuk Update Mingguan:");
    if (!key) return;
    setStatus({ msg: "Memulai Update Data Mingguan...", type: "neutral" });
    try {
      const res = await fetch("/api/update-recent", {
        method: "POST",
        headers: { "x-admin-key": key }
      });
      if (!res.ok) {
          const errData = await res.json().catch(()=>({}));
          throw new Error(errData.error || "Gagal memulai update mingguan");
      }
      
      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      while(true) {
        const {done, value} = await reader.read();
        if (done) break;
        const chunk = decoder.decode(value);
        const lines = chunk.split('\n');
        for(let line of lines) {
           if(line.startsWith('data: ')) {
               try {
                  const data = JSON.parse(line.substring(6));
                  if(data.msg === "DONE") {
                      setStatus({ msg: "Update Data Mingguan Selesai!", type: "success" });
                  } else {
                      setStatus({ msg: data.msg, type: "neutral" });
                  }
               } catch(e){}
           }
        }
      }
    } catch (err) {
      setStatus({ msg: err.message, type: "error" });
    }
  };

  const handleFullSync = async () => {
    const key = window.prompt("PERINGATAN: Menghapus data lama.\nMasukkan Admin Key untuk Full Sync dari 2025:");
    if (!key) return;
    
    if(!window.confirm("Yakin ingin melakukan Full Sync? Proses ini akan memakan waktu beberapa menit dan menghapus tabel Piezometer dan Curah Hujan saat ini.")) return;

    setStatus({ msg: "Memulai Full Sync Piezometer & Curah Hujan (harap tunggu)...", type: "neutral" });
    try {
      const res = await fetch("/api/full-resync", {
        method: "POST",
        headers: { "x-admin-key": key }
      });
      if (!res.ok) {
          const errData = await res.json().catch(()=>({}));
          throw new Error(errData.error || "Gagal memulai full sync");
      }
      
      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      while(true) {
        const {done, value} = await reader.read();
        if (done) break;
        const chunk = decoder.decode(value);
        const lines = chunk.split('\n');
        for(let line of lines) {
           if(line.startsWith('data: ')) {
               try {
                  const data = JSON.parse(line.substring(6));
                  if(data.msg === "DONE") {
                      setStatus({ msg: "Full Sync Selesai! Semua data dari 2025 berhasil diunduh.", type: "success" });
                  } else {
                      setStatus({ msg: data.msg, type: "neutral" });
                  }
               } catch(e){}
           }
        }
      }
    } catch (err) {
      setStatus({ msg: err.message, type: "error" });
    }
  };

  // --- Render Helpers ---

  const renderStatus = () => {
    let baseClass = "text-sm px-4 py-3 rounded-xl font-medium border flex-1 transition-all ";
    if (status.type === 'success') baseClass += "bg-green-50/80 border-green-200 text-green-900";
    else if (status.type === 'error') baseClass += "bg-red-50/80 border-red-200 text-red-900";
    else baseClass += "bg-white/60 border-gray-200 text-gray-700";
    return <div className={baseClass}>{status.msg}</div>;
  };

  const getChartData = () => {
    if (!processed) return { trend: null, dist: null };

    const mainLineColor = "hsl(240 5.9% 10%)";
    const barBgColor = "hsl(210 40% 90%)";

    const trend = {
        labels: processed.weeks,
        datasets: [
            {
                type: "bar",
                label: "Rainfall (mm)",
                data: processed.weeklySummaryRecords.map(r => Number.isFinite(r["Rain (mm)"]) ? r["Rain (mm)"] : null),
                yAxisID: "y1",
                backgroundColor: barBgColor,
                order: 2
            },
            {
                type: "line",
                label: "Avg TMAT (cm)",
                data: processed.weeklySummaryRecords.map(r => r["Avg TMAT (cm)"]),
                yAxisID: "y",
                tension: 0.3,
                borderColor: mainLineColor,
                backgroundColor: mainLineColor,
                pointRadius: 4,
                order: 1
            }
        ]
    };

    const dist = {
        labels: CLASS_ORDER,
        datasets: [
            {
                label: "Baseline %",
                data: CLASS_ORDER.map(c => processed.baselinePct[c]),
                backgroundColor: "hsl(215.4 16.3% 46.9%)"
            },
            ...processed.scenarioResults.map((r, i) => ({
                label: `CH${r.scenarioMm} %`,
                data: CLASS_ORDER.map(c => r.pct[c]),
                backgroundColor: i === 0 ? mainLineColor : "hsl(221.2 83.2% 53.3%)"
            }))
        ]
    };

    return { trend, dist };
  };

  const charts = getChartData();

  return (
    <div className="space-y-6">
      <header className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-gray-900">TMAT Forecast &amp; AI Report</h1>
          <p className="text-sm text-gray-600 mt-1">Sistem Piezometer terintegrasi dengan database dan model regresi estate.</p>
        </div>
        <div className="flex flex-wrap items-center gap-2.5">
          <button
            type="button"
            onClick={handleUpdateRecent}
            className="min-h-11 inline-flex items-center justify-center gap-2 bg-black text-white hover:bg-gray-800 px-4 py-2.5 rounded-xl text-sm font-semibold transition-colors"
          >
            <RefreshCw size={16} aria-hidden="true" />
            <span>Update (Minggu Ini)</span>
          </button>
          <button
            type="button"
            onClick={handleFullSync}
            className="min-h-11 inline-flex items-center justify-center gap-2 bg-red-700 text-white hover:bg-red-800 px-4 py-2.5 rounded-xl text-sm font-semibold transition-colors"
          >
            <Database size={16} aria-hidden="true" />
            <span>Full Sync (2025)</span>
          </button>
          <button
            type="button"
            disabled={!processed}
            onClick={handleExportExcel}
            className="min-h-11 inline-flex items-center justify-center gap-2 bg-white border border-gray-300 text-gray-900 hover:bg-gray-50 px-4 py-2.5 rounded-xl text-sm font-semibold transition-colors disabled:opacity-50"
          >
            <Download size={16} aria-hidden="true" />
            <span>Export Excel</span>
          </button>
        </div>
      </header>

      {/* Input Section */}
      <section aria-label="Konfigurasi model forecast" className="bg-white rounded-2xl border border-gray-200 p-5 sm:p-6 shadow-xs">
        {/* Row 1: Sumber Data, Company, Rentang Historis */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="space-y-1.5">
                <label htmlFor="forecast-source-type" className="block text-xs font-semibold text-gray-700">Sumber Data</label>
                <div className="relative">
                    <select
                        id="forecast-source-type"
                        value={sourceType}
                        onChange={(e) => setSourceType(e.target.value)}
                        className="w-full h-11 py-2 pl-10 pr-4 rounded-xl border border-gray-300 bg-white text-sm font-medium text-gray-900 appearance-none"
                    >
                        <option value="db">Database Server</option>
                        <option value="csv">File CSV Lokal</option>
                    </select>
                    <Database className="absolute left-3 top-3.5 text-gray-500 pointer-events-none" size={16} aria-hidden="true" />
                </div>
            </div>

            {sourceType === 'db' ? (
                <>
                    <div className="space-y-1.5">
                        <label htmlFor="forecast-company" className="block text-xs font-semibold text-gray-700">Company</label>
                        <select
                            id="forecast-company"
                            value={dbCompany} onChange={(e) => setDbCompany(e.target.value)}
                            className="w-full h-11 py-2 px-3 rounded-xl border border-gray-300 bg-white text-sm font-medium text-gray-900"
                        >
                            <option value="Semua">Gabungan (Semua Company)</option>
                            {COMPANIES.map(c => <option key={c} value={c}>{c}</option>)}
                        </select>
                    </div>
                    <div className="space-y-1.5">
                        <label htmlFor="forecast-range" className="block text-xs font-semibold text-gray-700">Rentang Historis</label>
                        <select
                            id="forecast-range"
                            value={dbRange} onChange={(e) => setDbRange(e.target.value)}
                            className="w-full h-11 py-2 px-3 rounded-xl border border-gray-300 bg-white text-sm font-medium text-gray-900"
                        >
                            <option value="8">8 Minggu Terakhir</option>
                            <option value="12">12 Minggu Terakhir</option>
                            <option value="24">24 Minggu Terakhir (6 Bulan)</option>
                            <option value="52">52 Minggu Terakhir (1 Tahun)</option>
                            <option value="999">Seluruh Data (All Time)</option>
                        </select>
                    </div>
                </>
            ) : (
                <div className="space-y-1.5 md:col-span-2">
                    <label htmlFor="forecast-csv-upload" className="block text-xs font-semibold text-gray-700">CSV Piezometer</label>
                    <input
                        id="forecast-csv-upload"
                        type="file" accept=".csv" onChange={handleFileUpload}
                        className="w-full min-h-11 px-3 py-2 rounded-xl border border-gray-300 bg-white text-sm text-gray-900 file:mr-4 file:py-1 file:px-3 file:rounded-lg file:border file:border-gray-300 file:text-xs file:font-semibold file:bg-gray-50 file:text-gray-800 hover:file:bg-gray-100"
                    />
                </div>
            )}
        </div>

        {/* Row 2: Ambil Data Button + Baseline Week + Data Freshness */}
        <div className="mt-4 grid grid-cols-1 md:grid-cols-3 gap-4 items-end">
            {sourceType === 'db' && (
                <button
                    type="button"
                    onClick={handleFetchDB} disabled={isFetching}
                    className="w-full min-h-11 inline-flex items-center justify-center gap-2 bg-black text-white px-5 rounded-xl text-sm font-semibold hover:bg-gray-800 transition-colors disabled:opacity-50 whitespace-nowrap"
                >
                    {isFetching ? <><RefreshCw size={16} className="animate-spin" aria-hidden="true" /> Memuat...</> : <><Database size={16} aria-hidden="true" /> Ambil Data dari Server</>}
                </button>
            )}
            <div className="space-y-1.5">
                <label htmlFor="forecast-baseline-week" className="block text-xs font-semibold text-gray-700">Baseline Week (Minggu Acuan)</label>
                <select
                    id="forecast-baseline-week"
                    disabled={!weeks.length}
                    value={baselineWeek} onChange={(e) => setBaselineWeek(e.target.value)}
                    className="w-full h-11 py-2 px-3 rounded-xl border border-gray-300 bg-white text-sm font-medium text-gray-900 disabled:opacity-50"
                >
                    {weeks.map(w => <option key={w} value={w}>{w}</option>)}
                </select>
            </div>
            {dataStale && weeks.length > 0 && (
                <div role="status" className="flex items-center gap-2 p-3 rounded-xl bg-amber-50 border border-amber-300 text-amber-900 text-xs font-medium">
                    <AlertTriangle size={16} className="shrink-0 text-amber-800" aria-hidden="true" />
                    <span>Data belum ter-update minggu ini. Klik <strong>Update (Minggu Ini)</strong> terlebih dahulu.</span>
                </div>
            )}
        </div>

        <div className="mt-4">
            <div className="space-y-1.5">
                <label htmlFor="forecast-scenario-input" className="block text-xs font-semibold text-gray-700">Scenario Rainfall (mm) untuk Diprediksi (pisahkan dengan koma)</label>
                <input
                    id="forecast-scenario-input"
                    type="text" value={scenarioInput} onChange={(e) => setScenarioInput(e.target.value)}
                    placeholder="0, 50, 100"
                    className="w-full min-h-11 px-3 rounded-xl border border-gray-300 bg-white text-sm font-medium text-gray-900"
                />
            </div>
        </div>

        {/* Rainfall Info Section */}
        {weeks.length > 0 && forecastModel === 'estate' && (
            <div className="mt-5 pt-5 border-t border-gray-200">
                <div className="flex flex-wrap items-center gap-2.5 mb-2">
                    <h2 className="text-sm font-bold text-gray-900">Skenario Hujan Masa Depan</h2>
                    <span className="text-xs bg-emerald-50 text-emerald-800 px-2.5 py-0.5 rounded-md font-semibold border border-emerald-200">
                        Auto Database Mode
                    </span>
                </div>
                <p className="text-sm text-gray-600 p-4 bg-gray-50 rounded-xl border border-gray-200">
                    Sistem telah memuat riwayat curah hujan untuk setiap estate dari database untuk melatih model matematis. Masukkan nilai pada kolom Scenario Rainfall (mm) di atas, lalu klik <strong>Proses Data AI</strong>.
                </p>
            </div>
        )}

        <div className="mt-6 flex flex-col md:flex-row items-stretch md:items-center gap-3">
            {renderStatus()}
            <button
                type="button"
                onClick={handleProcess}
                disabled={!weeks.length}
                className="w-full md:w-auto min-h-11 inline-flex items-center justify-center gap-2 bg-black text-white px-6 py-2.5 rounded-xl text-sm font-semibold hover:bg-gray-800 transition-colors disabled:opacity-50"
            >
                <Play size={16} aria-hidden="true" />
                <span>Proses Data AI</span>
            </button>
        </div>
      </section>

      {/* Results Section */}
      {processed && (
          <section className="space-y-6">
              <div className="flex space-x-2 border-b border-gray-200 overflow-x-auto" role="tablist" aria-label="Hasil analisis forecast">
                  {[
                      { id: 'dashboard', label: 'Dashboard AI', icon: <BarChart2 size={16} aria-hidden="true" /> },
                      { id: 'laporan', label: 'Laporan Teks', icon: <FileText size={16} aria-hidden="true" /> },
                      { id: 'forecast', label: 'Tabel Forecast', icon: <Table2 size={16} aria-hidden="true" /> },
                      { id: 'data', label: 'Data Raw', icon: <DatabaseZap size={16} aria-hidden="true" /> }
                  ].map(tab => (
                      <button
                          key={tab.id}
                          type="button"
                          role="tab"
                          aria-selected={activeTab === tab.id}
                          onClick={() => setActiveTab(tab.id)}
                          className={`min-h-11 flex items-center gap-2 px-4 py-2.5 text-sm font-semibold border-b-2 transition-colors whitespace-nowrap ${activeTab === tab.id ? 'border-black text-gray-900' : 'border-transparent text-gray-600 hover:text-gray-900'}`}
                      >
                          {tab.icon} {tab.label}
                      </button>
                  ))}
              </div>

              {activeTab === 'dashboard' && (
                  <div className="space-y-6">
                      {/* Model Summary Cards */}
                      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
                          {[
                              { label: "Metode AI", val: 'Granular Estate-Based' },
                              { label: "Baseline Week", val: processed.baselineWeek },
                              { label: "Estate Valid", val: `${processed.fit.validEstates || '?'}/${processed.fit.totalEstates || '?'}` },
                              { label: "Akurasi (r²)", val: processed.fit.method === 'fallback' ? 'Low' : `${Math.round(processed.fit.r2 * 100)}%` },
                              { label: "Error (MAE)", val: processed.fit.method === 'fallback' ? '-' : `± ${formatNumber(processed.fit.mae, 1)} cm` },
                              { label: "Max Error (RMSE)", val: processed.fit.method === 'fallback' ? '-' : `± ${formatNumber(processed.fit.rmse, 1)} cm` }
                          ].map(card => (
                              <div key={card.label} className="bg-white rounded-2xl border border-gray-200 p-4 shadow-xs flex flex-col justify-between">
                                  <span className="text-xs font-semibold text-gray-600 uppercase tracking-wide mb-1">{card.label}</span>
                                  <span className="text-lg font-bold text-gray-900 tabular-nums">{card.val}</span>
                              </div>
                          ))}
                      </div>

                      {/* Charts */}
                      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                          <div className="bg-white rounded-2xl border border-gray-200 p-5 shadow-xs h-[400px] flex flex-col">
                              <h2 className="text-sm font-bold text-gray-900 mb-4">Trend Historis (TMAT vs Rainfall)</h2>
                              <div className="flex-1 relative">
                                  {charts.trend && <Chart type="bar" data={charts.trend.data || charts.trend} options={{ responsive: true, maintainAspectRatio: false, scales: { y: { position: "left", title: { display: true, text: "Avg TMAT (cm)" } }, y1: { position: "right", grid: { drawOnChartArea: false }, title: { display: true, text: "Rainfall (mm)" } } } }} />}
                              </div>
                          </div>
                          <div className="bg-white rounded-2xl border border-gray-200 p-5 shadow-xs h-[400px] flex flex-col">
                              <h2 className="text-sm font-bold text-gray-900 mb-4">Distribusi TMAT Forecast</h2>
                              <div className="flex-1 relative">
                                  {charts.dist && <Chart type="bar" data={charts.dist.data || charts.dist} options={{ responsive: true, maintainAspectRatio: false }} />}
                              </div>
                          </div>
                      </div>
                  </div>
              )}

              {activeTab === 'laporan' && (
                  <div className="bg-white rounded-2xl border border-gray-200 p-5 sm:p-6 shadow-xs space-y-6">
                      <div className="pb-4 border-b border-gray-200">
                          <h2 className="text-lg font-bold text-gray-900">AI Report Generator</h2>
                          <p className="text-sm text-gray-600 mt-0.5">Buat ringkasan eksekutif hidrologi dari hasil proyeksi di atas.</p>
                      </div>
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                          <div className="space-y-1.5">
                              <label htmlFor="forecast-weather-ctx" className="block text-xs font-semibold text-gray-700">Konteks Cuaca</label>
                              <textarea
                                  id="forecast-weather-ctx"
                                  value={userContext} onChange={e => setUserContext(e.target.value)}
                                  className="w-full h-24 p-3 rounded-xl border border-gray-300 bg-white text-sm text-gray-900"
                                  placeholder="Contoh: Realisasi hujan aktual lebih rendah..."
                              />
                          </div>
                          <div className="space-y-1.5">
                              <label htmlFor="forecast-wm-actions" className="block text-xs font-semibold text-gray-700">Aksi Water Management</label>
                              <textarea
                                  id="forecast-wm-actions"
                                  value={wmActions} onChange={e => setWmActions(e.target.value)}
                                  className="w-full h-24 p-3 rounded-xl border border-gray-300 bg-white text-sm text-gray-900"
                                  placeholder="Contoh: Menutup pintu air A12..."
                              />
                          </div>
                      </div>
                      <button
                        type="button"
                        onClick={handleGenerateAI}
                        disabled={isGenerating || !processed}
                        className="min-h-11 bg-black text-white font-semibold px-6 py-2.5 rounded-xl text-sm hover:bg-gray-800 transition-colors inline-flex items-center gap-2 disabled:opacity-50"
                      >
                        {isGenerating ? <><RefreshCw size={16} className="animate-spin" aria-hidden="true" /> Generating...</> : <><Play size={16} aria-hidden="true" /> Generate Laporan AI</>}
                      </button>

                      {aiReport && (
                        <div className="p-6 bg-gray-50 rounded-2xl border border-gray-200 space-y-4">
                            <div className="flex flex-wrap justify-between items-center gap-3 pb-4 border-b border-gray-200">
                                <h3 className="text-lg font-bold text-gray-900 flex items-center gap-2">
                                    <FileText className="text-gray-700" size={20} aria-hidden="true" />
                                    <span>Hasil Analisis AI</span>
                                </h3>
                                <button
                                    type="button"
                                    onClick={() => {
                                        navigator.clipboard.writeText(aiReport).then(() => {
                                            setReportCopied(true);
                                            setTimeout(() => setReportCopied(false), 2000);
                                        });
                                    }}
                                    className={`min-h-11 inline-flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-semibold border transition-colors ${
                                        reportCopied
                                            ? 'bg-emerald-50 text-emerald-800 border-emerald-300'
                                            : 'bg-white text-gray-900 border-gray-300 hover:bg-gray-100'
                                    }`}
                                >
                                    {reportCopied ? <><Check size={16} aria-hidden="true" /> Copied!</> : <><ClipboardCopy size={16} aria-hidden="true" /> Salin Laporan</>}
                                </button>
                            </div>
                            <div className="prose prose-slate max-w-none text-gray-800 leading-relaxed">
                                {aiReport.split('\n').map((line, i) => {
                                    const cleaned = line.replace(/\*\*/g, '');
                                    if (cleaned.startsWith('# ')) return <h1 key={i} className="text-2xl font-bold mb-4 mt-6">{cleaned.substring(2)}</h1>;
                                    if (cleaned.startsWith('## ')) return <h2 key={i} className="text-xl font-bold mb-3 mt-5">{cleaned.substring(3)}</h2>;
                                    if (cleaned.startsWith('### ')) return <h3 key={i} className="text-lg font-bold mb-2 mt-4">{cleaned.substring(4)}</h3>;
                                    if (cleaned.startsWith('- ')) return <li key={i} className="ml-4 mb-1">{cleaned.substring(2)}</li>;
                                    return <p key={i} className="mb-3">{cleaned}</p>;
                                })}
                            </div>
                        </div>
                      )}

                      {/* Translation Module */}
                      <div className="pt-6 border-t border-gray-200 space-y-4">
                          <div>
                              <h3 className="text-base font-bold text-gray-900">AI Translation &amp; Rewrite (English)</h3>
                              <p className="text-sm text-gray-600 mt-0.5">Terjemahkan laporan ke Bahasa Inggris formal level eksekutif.</p>
                          </div>

                          <div className="space-y-3">
                              <label htmlFor="forecast-translate-input" className="sr-only">Teks laporan untuk diterjemahkan</label>
                              <textarea
                                  id="forecast-translate-input"
                                  value={translateText}
                                  onChange={e => setTranslateText(e.target.value)}
                                  className="w-full h-48 p-4 rounded-xl border border-gray-300 bg-white text-sm text-gray-900"
                                  placeholder="Tempel teks laporan di sini..."
                              />

                              <button
                                  type="button"
                                  onClick={handleTranslateReport}
                                  disabled={isTranslating || !translateText}
                                  className="min-h-11 bg-black text-white font-semibold px-6 py-2.5 rounded-xl text-sm hover:bg-gray-800 transition-colors inline-flex items-center gap-2 disabled:opacity-50"
                              >
                                  <RefreshCw size={16} className={isTranslating ? 'animate-spin' : ''} aria-hidden="true" />
                                  <span>{isTranslating ? 'Translating...' : 'Rewrite & Translate'}</span>
                              </button>
                          </div>

                          {translatedReport && (
                              <div className="p-6 bg-gray-50 rounded-2xl border border-gray-200 space-y-4">
                                  <div className="flex flex-wrap justify-between items-center gap-3 pb-4 border-b border-gray-200">
                                      <h4 className="text-lg font-bold text-gray-900 flex items-center gap-2">
                                          <FileText className="text-gray-700" size={20} aria-hidden="true" />
                                          <span>English Executive Report</span>
                                      </h4>
                                      <button
                                          type="button"
                                          onClick={() => {
                                              navigator.clipboard.writeText(translatedReport).then(() => {
                                                  setTranslateCopied(true);
                                                  setTimeout(() => setTranslateCopied(false), 2000);
                                              });
                                          }}
                                          className={`min-h-11 inline-flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-semibold border transition-colors ${
                                              translateCopied
                                                  ? 'bg-emerald-50 text-emerald-800 border-emerald-300'
                                                  : 'bg-white text-gray-900 border-gray-300 hover:bg-gray-100'
                                          }`}
                                      >
                                          {translateCopied ? <><Check size={16} aria-hidden="true" /> Copied!</> : <><ClipboardCopy size={16} aria-hidden="true" /> Salin Laporan</>}
                                      </button>
                                  </div>
                                  <div className="prose prose-slate max-w-none text-gray-800 leading-relaxed">
                                      {translatedReport.split('\n').map((line, i) => {
                                          const cleaned = line.replace(/\*\*/g, '');
                                          return <p key={i} className="mb-3">{cleaned}</p>;
                                      })}
                                  </div>
                              </div>
                          )}
                      </div>
                  </div>
              )}

              {activeTab === 'forecast' && (
                  <div className="bg-white rounded-2xl border border-gray-200 shadow-xs overflow-hidden">
                      <div className="bg-gray-50 p-4 border-b border-gray-200 flex items-center justify-between gap-3">
                          <h2 className="font-bold text-gray-900 text-base">Tabel Forecast Distribusi</h2>
                          <button
                              type="button"
                              onClick={() => {
                                  if (!processed) return;
                                  const headers = Object.keys(processed.forecastRows[0]);
                                  const rows = processed.forecastRows.map(r =>
                                      headers.map(h => {
                                          const v = r[h];
                                          return typeof v === 'number' && h.includes('%') ? v.toFixed(1) : v;
                                      }).join('\t')
                                  );
                                  const tsv = [headers.join('\t'), ...rows].join('\n');
                                  navigator.clipboard.writeText(tsv).then(() => {
                                      setTableCopied(true);
                                      setTimeout(() => setTableCopied(false), 2000);
                                  });
                              }}
                              className={`min-h-11 inline-flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-semibold border transition-colors ${
                                  tableCopied
                                      ? 'bg-emerald-50 text-emerald-800 border-emerald-300'
                                      : 'bg-white text-gray-900 border-gray-300 hover:bg-gray-100'
                              }`}
                          >
                              {tableCopied ? <><Check size={14} aria-hidden="true" /> Tersalin!</> : <><ClipboardCopy size={14} aria-hidden="true" /> Copy Tabel</>}
                          </button>
                      </div>
                      <div className="overflow-x-auto p-4">
                          <table className="w-full text-sm text-left">
                              <thead className="text-gray-600 text-xs font-semibold uppercase tracking-wider border-b border-gray-200 bg-gray-50">
                                  <tr>
                                      {Object.keys(processed.forecastRows[0]).map(k => <th key={k} className="p-3">{k}</th>)}
                                  </tr>
                              </thead>
                              <tbody className="divide-y divide-gray-100">
                                  {processed.forecastRows.map((r, i) => (
                                      <tr key={i} className="hover:bg-gray-50">
                                          {Object.entries(r).map(([k, v], j) => (
                                              <td key={k} className="p-3 tabular-nums text-gray-900">
                                                  {j === 0 ? <span className="px-2 py-1 rounded-md text-xs font-bold" style={{ backgroundColor: `${CLASS_COLORS[v]}20`, color: CLASS_COLORS[v] }}>{v}</span> : (typeof v === 'number' && k.includes('%') ? v.toFixed(1) + '%' : v)}
                                              </td>
                                          ))}
                                      </tr>
                                  ))}
                              </tbody>
                          </table>
                      </div>
                  </div>
              )}

              {activeTab === 'data' && (
                  <div className="bg-white rounded-2xl border border-gray-200 p-6 shadow-xs">
                      <h2 className="text-lg font-bold text-gray-900 mb-2">Raw Data Overview</h2>
                      <p className="text-sm text-gray-600">Mode ini digunakan untuk inspeksi data tabel historis. Gunakan tombol Export Excel di bagian atas untuk mengunduh seluruh baris data mentah.</p>
                  </div>
              )}

          </section>
      )}
    </div>
  );
}
