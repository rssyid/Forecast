"use client";

import React, { useState, useEffect, useMemo } from 'react';
import * as XLSX from 'xlsx';
import { 
  Building2, 
  CloudRain, 
  Download, 
  RefreshCw, 
  Search, 
  BarChart2, 
  Layers, 
  AlertTriangle, 
  CheckCircle2, 
  TrendingDown, 
  TrendingUp, 
  Sliders, 
  ChevronRight,
  X,
  Info,
  Zap,
  Activity
} from 'lucide-react';
import { CLASS_ORDER, CLASS_COLORS, formatNumber } from '../lib/forecastEngine';

export default function MultiCompanyForecastClient() {
  const [lookbackWeeks, setLookbackWeeks] = useState('8');
  const [scenarioInput, setScenarioInput] = useState('0,50');
  const [selectedBaselineWeek, setSelectedBaselineWeek] = useState('');
  
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [data, setData] = useState(null);

  const [searchQuery, setSearchQuery] = useState('');
  const [activeTab, setActiveTab] = useState('matrix'); // 'matrix' | 'shift' | 'history'
  const [selectedScenarioMm, setSelectedScenarioMm] = useState(null);
  const [modalCompany, setModalCompany] = useState(null);

  const fetchData = async (overrideBaseline = null) => {
    setLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams({
        lookbackWeeks,
        scenarios: scenarioInput,
      });
      if (overrideBaseline || selectedBaselineWeek) {
        params.set('baselineWeek', overrideBaseline || selectedBaselineWeek);
      }
      const res = await fetch(`/api/forecast-multi-company?${params.toString()}`);
      if (!res.ok) {
        const errJson = await res.json().catch(() => ({}));
        throw new Error(errJson.error || `HTTP Error ${res.status}`);
      }
      const json = await res.json();
      setData(json);
      if (!selectedBaselineWeek && json.baselineWeek) {
        setSelectedBaselineWeek(json.baselineWeek);
      }
      if (json.scenarios && json.scenarios.length > 0 && selectedScenarioMm === null) {
        setSelectedScenarioMm(json.scenarios[0]);
      }
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  useEffect(() => {
    if (!modalCompany) return;
    const handleKeyDown = (e) => {
      if (e.key === 'Escape') setModalCompany(null);
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [modalCompany]);

  const handleApplyFilters = () => {
    fetchData(selectedBaselineWeek);
  };

  // Filtered companies based on search
  const filteredCompanies = useMemo(() => {
    if (!data?.companies) return [];
    if (!searchQuery.trim()) return data.companies;
    const q = searchQuery.toLowerCase();
    return data.companies.filter(c => c.company.toLowerCase().includes(q));
  }, [data, searchQuery]);

  // Handle Export Excel
  const handleExportExcel = () => {
    if (!data || !data.companies) return;

    const wb = XLSX.utils.book_new();

    // Sheet 1: Ringkasan Matriks
    const summaryRows = data.companies.map(c => {
      const row = {
        "Company": c.company,
        "Total Blok": c.totalBlocks || c.totalPoints,
        "Baseline Avg TMAT (cm)": Number(c.baselineAvgTmat?.toFixed(1)) || 0,
        "Akurasi Model R² (%)": Number(((c.fit.r2 || 0) * 100).toFixed(1)),
        "MAE (cm)": Number((c.fit.mae || 0).toFixed(1)),
        "Hujan Riil Baseline (mm)": Number((c.fit.antecedentRainCurrent || 0).toFixed(1)),
        "Hujan Riil Lag 1 (mm)": Number((c.fit.antecedentRainLag1 || 0).toFixed(1)),
        "Baseline Banjir (<0) %": Number(c.baselinePct["Banjir (<0)"]?.toFixed(1)) || 0,
        "Baseline Tergenang (0-40) %": Number(c.baselinePct["Tergenang (0-40)"]?.toFixed(1)) || 0,
        "Baseline A Tergenang (41-45) %": Number(c.baselinePct["A Tergenang (41-45)"]?.toFixed(1)) || 0,
        "Baseline Normal (46-60) %": Number(c.baselinePct["Normal (46-60)"]?.toFixed(1)) || 0,
        "Baseline A Kering (61-65) %": Number(c.baselinePct["A Kering (61-65)"]?.toFixed(1)) || 0,
        "Baseline Kering (>65) %": Number(c.baselinePct["Kering (>65)"]?.toFixed(1)) || 0,
      };

      c.scenarios.forEach(sc => {
        row[`CH ${sc.scenarioMm}mm Avg TMAT`] = Number(sc.avgNext?.toFixed(1)) || 0;
        row[`CH ${sc.scenarioMm}mm Normal %`] = Number(sc.pct["Normal (46-60)"]?.toFixed(1)) || 0;
        row[`CH ${sc.scenarioMm}mm Kering (>60) %`] = Number((sc.pct["A Kering (61-65)"] + sc.pct["Kering (>65)"])?.toFixed(1)) || 0;
        row[`CH ${sc.scenarioMm}mm Basah (<=45) %`] = Number((sc.pct["Banjir (<0)"] + sc.pct["Tergenang (0-40)"] + sc.pct["A Tergenang (41-45)"])?.toFixed(1)) || 0;
      });

      return row;
    });
    XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(summaryRows), "Ringkasan_Komparasi");

    // Sheet 2: Parameter Model Regresi Multivariat
    const modelParamRows = data.companies.map(c => ({
      "Company": c.company,
      "Tipe Model": c.fit.modelType,
      "R² Score (%)": Number(((c.fit.r2 || 0) * 100).toFixed(1)),
      "MAE (cm)": Number((c.fit.mae || 0).toFixed(2)),
      "Konstanta a (Laju Kering)": Number((c.fit.a || 0).toFixed(2)),
      "Bobot b0 (Hujan Minggu Berjalan)": Number((c.fit.b0 || 0).toFixed(4)),
      "Bobot b1 (Hujan Lag 1 Minggu Lalu)": Number((c.fit.b1 || 0).toFixed(4)),
      "Bobot b2 (Hujan Lag 2 Minggu Lalu)": Number((c.fit.b2 || 0).toFixed(4)),
      "Hujan Riil Baseline Week (mm)": Number((c.fit.antecedentRainCurrent || 0).toFixed(1)),
      "Hujan Riil 1 Minggu Sebelumnya (mm)": Number((c.fit.antecedentRainLag1 || 0).toFixed(1)),
    }));
    XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(modelParamRows), "Parameter_Model_OLS");

    // Sheet 3: Detail Baseline 6 Kelas
    const baselineDetailRows = [];
    data.companies.forEach(c => {
      CLASS_ORDER.forEach(cls => {
        baselineDetailRows.push({
          "Company": c.company,
          "Baseline Week": c.baselineWeek,
          "Kelas TMAT": cls,
          "Jumlah Blok": c.baselineCounts[cls] || 0,
          "Persentase (%)": Number(c.baselinePct[cls]?.toFixed(2)) || 0
        });
      });
    });
    XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(baselineDetailRows), "Baseline_6_Kelas");

    // Sheet per Skenario
    data.scenarios.forEach(scMm => {
      const scRows = [];
      data.companies.forEach(c => {
        const scObj = c.scenarios.find(s => s.scenarioMm === scMm);
        if (!scObj) return;
        CLASS_ORDER.forEach(cls => {
          scRows.push({
            "Company": c.company,
            "Skenario Curah Hujan (mm)": scMm,
            "Kelas TMAT": cls,
            "Jumlah Blok": scObj.counts[cls] || 0,
            "Persentase (%)": Number(scObj.pct[cls]?.toFixed(2)) || 0,
            "Baseline Blok": c.baselineCounts[cls] || 0,
            "Delta Blok": (scObj.counts[cls] || 0) - (c.baselineCounts[cls] || 0)
          });
        });
      });
      XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(scRows), `Forecast_CH_${scMm}mm`);
    });

    // Sheet Histori Mingguan
    const histRows = [];
    data.companies.forEach(c => {
      c.weeklyHistory.forEach(h => {
        histRows.push({
          "Company": c.company,
          "Week": h.week,
          "Rainfall (mm)": h.rainMm,
          "Avg TMAT (cm)": Number(h.avgTmat?.toFixed(1)) || 0,
          "Total Records": h.totalRecords
        });
      });
    });
    XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(histRows), "Histori_TMAT_Hujan");

    XLSX.writeFile(wb, `Komparasi_Forecast_Multi_PT_${(data.baselineWeek || 'all').replace(/[^a-zA-Z0-9]/g, '_')}.xlsx`);
  };

  return (
    <div className="space-y-6">
      {/* Page Title */}
      <header className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
        <div>
          <div className="flex flex-wrap items-center gap-2.5">
            <h1 className="text-2xl sm:text-3xl font-bold text-gray-900 tracking-tight">
              Komparasi Forecast Multi-PT
            </h1>
            <span className="px-2.5 py-0.5 rounded-md bg-white text-gray-800 text-xs font-semibold border border-gray-300">
              3-Week Memory OLS
            </span>
          </div>
          <p className="text-sm text-gray-600 mt-1">
            Matriks komparasi TMAT blok vs curah hujan dengan model kelembaban tanah 3 minggu dari 48 minggu historis.
          </p>
        </div>

        <button
          type="button"
          onClick={handleExportExcel}
          disabled={loading || !data?.companies?.length}
          className="min-h-11 inline-flex items-center justify-center gap-2 px-4 py-2.5 bg-white border border-gray-300 hover:bg-gray-50 text-gray-900 rounded-xl text-sm font-semibold transition-colors disabled:opacity-50 shrink-0"
        >
          <Download size={16} aria-hidden="true" />
          <span>Export Excel</span>
        </button>
      </header>

      {/* Filter Panel */}
      <section aria-label="Filter proyeksi multi perusahaan" className="bg-white rounded-2xl p-4 sm:p-5 border border-gray-200 shadow-xs">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-12 gap-3 items-end">
          <div className="lg:col-span-3">
            <label htmlFor="mc-baseline-week" className="block text-xs font-semibold text-gray-700 mb-1">
              Baseline Week
            </label>
            <select
              id="mc-baseline-week"
              value={selectedBaselineWeek}
              onChange={(e) => setSelectedBaselineWeek(e.target.value)}
              className="w-full h-11 py-2 px-3 rounded-xl border border-gray-300 bg-white text-sm font-medium text-gray-900"
            >
              {data?.targetWeeks?.map(w => (
                <option key={w} value={w}>{w}</option>
              ))}
            </select>
          </div>

          <div className="lg:col-span-3">
            <label htmlFor="mc-lookback" className="block text-xs font-semibold text-gray-700 mb-1">
              Lookback Historis
            </label>
            <select
              id="mc-lookback"
              value={lookbackWeeks}
              onChange={(e) => setLookbackWeeks(e.target.value)}
              className="w-full h-11 py-2 px-3 rounded-xl border border-gray-300 bg-white text-sm font-medium text-gray-900"
            >
              <option value="4">4 Minggu</option>
              <option value="8">8 Minggu</option>
              <option value="12">12 Minggu</option>
            </select>
          </div>

          <div className="lg:col-span-3">
            <label htmlFor="mc-scenarios" className="block text-xs font-semibold text-gray-700 mb-1">
              Skenario Hujan (mm)
            </label>
            <input
              id="mc-scenarios"
              type="text"
              value={scenarioInput}
              onChange={(e) => setScenarioInput(e.target.value)}
              placeholder="0,50"
              className="w-full min-h-11 px-3 rounded-xl border border-gray-300 bg-white text-sm font-medium text-gray-900"
            />
          </div>

          <div className="lg:col-span-3">
            <button
              type="button"
              onClick={handleApplyFilters}
              disabled={loading}
              className="w-full min-h-11 inline-flex items-center justify-center gap-2 px-4 py-2.5 bg-black hover:bg-gray-800 disabled:opacity-50 text-white rounded-xl text-sm font-semibold transition-colors"
            >
              <RefreshCw size={16} className={loading ? "animate-spin" : ""} aria-hidden="true" />
              <span>{loading ? "Memproses..." : "Hitung Proyeksi"}</span>
            </button>
          </div>
        </div>
      </section>

      {error && (
        <div role="alert" className="p-4 bg-red-50 border border-red-300 text-red-900 rounded-2xl flex items-center gap-3 text-sm font-medium">
          <AlertTriangle size={18} className="shrink-0 text-red-700" aria-hidden="true" />
          <span>{error}</span>
        </div>
      )}

      {/* Top Executive Stats */}
      {data?.overall && (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
          <div className="bg-white p-5 rounded-2xl border border-gray-200 shadow-xs">
            <div className="text-xs font-semibold text-gray-600 uppercase tracking-wide">Total Perusahaan</div>
            <div className="text-2xl font-bold text-gray-900 mt-2 flex items-baseline gap-2 tabular-nums">
              {data.overall.totalCompanies}
              <span className="text-xs font-medium text-gray-600">PT Aktif</span>
            </div>
            <div className="text-xs text-gray-600 mt-1">Diproses serentak</div>
          </div>

          <div className="bg-white p-5 rounded-2xl border border-gray-200 shadow-xs">
            <div className="text-xs font-semibold text-gray-600 uppercase tracking-wide">Total Blok Pantau</div>
            <div className="text-2xl font-bold text-gray-900 mt-2 flex items-baseline gap-2 tabular-nums">
              {(data.overall.totalBlocks || data.overall.totalPoints).toLocaleString('id-ID')}
              <span className="text-xs font-medium text-gray-600">Blok</span>
            </div>
            <div className="text-xs text-gray-600 mt-1">Pada minggu {data.baselineWeek}</div>
          </div>

          <div className="bg-white p-5 rounded-2xl border border-gray-200 shadow-xs">
            <div className="text-xs font-semibold text-gray-600 uppercase tracking-wide">Rata-rata TMAT Group</div>
            <div className="text-2xl font-bold text-gray-900 mt-2 flex items-baseline gap-2 tabular-nums">
              {formatNumber(data.overall.baselineAvgTmat, 1)}
              <span className="text-xs font-medium text-gray-600">cm</span>
            </div>
            <div className="text-xs text-gray-600 mt-1">Rata-rata tertimbang nasional</div>
          </div>

          <div className="bg-white p-5 rounded-2xl border border-gray-200 shadow-xs">
            <div className="text-xs font-semibold text-gray-600 uppercase tracking-wide">Status Normal Baseline</div>
            <div className="text-2xl font-bold text-emerald-800 mt-2 flex items-baseline gap-2 tabular-nums">
              {formatNumber(data.overall.baselinePct["Normal (46-60)"], 1)}%
              <span className="text-xs font-medium text-gray-600">
                ({(data.overall.baselineCounts["Normal (46-60)"] || 0).toLocaleString('id-ID')} blok)
              </span>
            </div>
            <div className="text-xs text-gray-600 mt-1">Target zona ideal (46-60 cm)</div>
          </div>

          <div className="bg-white p-5 rounded-2xl border border-gray-200 shadow-xs">
            <div className="text-xs font-semibold text-gray-600 uppercase tracking-wide">Akurasi Model OLS</div>
            <div className="text-2xl font-bold text-gray-900 mt-2 flex items-baseline gap-2 tabular-nums">
              {formatNumber((data.overall.modelInfo?.avgR2 || 0) * 100, 1)}%
              <span className="text-xs font-medium text-gray-600">R² Score</span>
            </div>
            <div className="text-xs text-gray-600 mt-1">
              Basis {data.overall.modelInfo?.trainingWeeks || 48} minggu historis
            </div>
          </div>
        </div>
      )}

      {/* Tabs & Search Filter */}
      <div className="bg-white rounded-2xl p-4 border border-gray-200 shadow-xs flex flex-col xl:flex-row xl:items-center justify-between gap-4">
        {/* Navigation Tabs */}
        <div className="flex flex-wrap items-center gap-1.5 p-1 bg-gray-100 rounded-xl" role="tablist" aria-label="Tampilan komparasi">
          <button
            type="button"
            role="tab"
            aria-selected={activeTab === 'matrix'}
            onClick={() => setActiveTab('matrix')}
            className={`min-h-10 px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors inline-flex items-center gap-1.5 whitespace-nowrap ${
              activeTab === 'matrix' ? 'bg-black text-white' : 'text-gray-700 hover:text-gray-900 hover:bg-white'
            }`}
          >
            <Layers size={14} aria-hidden="true" />
            <span>Matriks 6 Kategori</span>
          </button>

          <button
            type="button"
            role="tab"
            aria-selected={activeTab === 'shift'}
            onClick={() => setActiveTab('shift')}
            className={`min-h-10 px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors inline-flex items-center gap-1.5 whitespace-nowrap ${
              activeTab === 'shift' ? 'bg-black text-white' : 'text-gray-700 hover:text-gray-900 hover:bg-white'
            }`}
          >
            <TrendingUp size={14} aria-hidden="true" />
            <span>Pergeseran &amp; Parameter OLS</span>
          </button>

          <button
            type="button"
            role="tab"
            aria-selected={activeTab === 'history'}
            onClick={() => setActiveTab('history')}
            className={`min-h-10 px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors inline-flex items-center gap-1.5 whitespace-nowrap ${
              activeTab === 'history' ? 'bg-black text-white' : 'text-gray-700 hover:text-gray-900 hover:bg-white'
            }`}
          >
            <BarChart2 size={14} aria-hidden="true" />
            <span>Tren TMAT vs Hujan</span>
          </button>
        </div>

        {/* Search & Scenario Filter */}
        <div className="flex flex-wrap items-center gap-3">
          {/* Active Scenario Selector */}
          {data?.scenarios && data.scenarios.length > 0 && (
            <div className="flex flex-wrap items-center gap-1 bg-gray-100 p-1 rounded-xl border border-gray-200">
              <span className="text-xs font-semibold text-gray-700 px-2">Skenario:</span>
              {data.scenarios.map(scMm => (
                <button
                  key={scMm}
                  type="button"
                  onClick={() => setSelectedScenarioMm(scMm)}
                  className={`min-h-9 px-3 py-1 rounded-lg text-xs font-semibold transition-colors ${
                    selectedScenarioMm === scMm
                      ? 'bg-black text-white'
                      : 'text-gray-700 hover:bg-white'
                  }`}
                >
                  {scMm} mm
                </button>
              ))}
            </div>
          )}

          {/* Search Box */}
          <div className="relative">
            <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500 pointer-events-none" aria-hidden="true" />
            <label htmlFor="mc-search-pt" className="sr-only">Cari perusahaan</label>
            <input
              id="mc-search-pt"
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Cari PT..."
              className="min-h-11 pl-9 pr-3 bg-white border border-gray-300 rounded-xl text-sm font-medium text-gray-900 placeholder-gray-500 w-44"
            />
          </div>
        </div>
      </div>

      {/* Main Table Content */}
      <div className="bg-white rounded-2xl border border-gray-200 shadow-xs overflow-hidden">
        {loading ? (
          <div aria-live="polite" className="p-16 flex flex-col items-center justify-center text-gray-600 gap-3">
            <RefreshCw size={28} className="animate-spin text-gray-700" aria-hidden="true" />
            <span className="text-sm font-medium">Melatih model regresi multivariat 48 minggu dan memproses skenario seluruh PT...</span>
          </div>
        ) : filteredCompanies.length === 0 ? (
          <div className="p-16 text-center text-gray-600 text-sm">
            Tidak ada data perusahaan yang cocok dengan pencarian.
          </div>
        ) : activeTab === 'matrix' ? (
          /* TAB 1: Matriks 6 Kategori Hidrologi */
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs border-collapse">
              <thead>
                <tr className="bg-gray-50 border-b border-gray-200 text-gray-700 font-semibold">
                  <th className="py-3.5 px-4 sticky left-0 bg-gray-50 z-10 w-28">Perusahaan</th>
                  <th className="py-3.5 px-3 text-center w-20">Blok</th>
                  <th className="py-3.5 px-3 text-right w-24">TMAT (cm)</th>
                  <th className="py-3.5 px-3 text-center">Distribusi Status</th>
                  <th className="py-3.5 px-3 text-center text-zinc-700 bg-zinc-50">Banjir (&lt;0)</th>
                  <th className="py-3.5 px-3 text-center text-blue-800 bg-blue-50">Tergenang (0-40)</th>
                  <th className="py-3.5 px-3 text-center text-blue-700 bg-blue-50/60">A Tergenang (41-45)</th>
                  <th className="py-3.5 px-3 text-center text-emerald-800 bg-emerald-50 font-bold">Normal (46-60)</th>
                  <th className="py-3.5 px-3 text-center text-amber-800 bg-amber-50">A Kering (61-65)</th>
                  <th className="py-3.5 px-3 text-center text-red-800 bg-red-50">Kering (&gt;65)</th>
                  <th className="py-3.5 px-4 text-center">Detail</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100 font-medium">
                {filteredCompanies.map(c => {
                  const scObj = c.scenarios.find(s => s.scenarioMm === selectedScenarioMm) || c.scenarios[0];
                  return (
                    <tr key={c.company} className="hover:bg-gray-50 transition-colors group">
                      {/* Company Name */}
                      <td className="py-3 px-4 font-bold text-gray-900 sticky left-0 bg-white group-hover:bg-gray-50 z-10 whitespace-nowrap">
                        <span className="px-2.5 py-1 bg-gray-100 border border-gray-200 rounded-lg text-gray-900 font-mono text-xs">
                          {c.company}
                        </span>
                      </td>

                      {/* Total Blocks */}
                      <td className="py-3 px-3 text-center text-gray-700 tabular-nums">
                        {c.totalBlocks || c.totalPoints}
                      </td>

                      {/* Avg TMAT Baseline vs Scenario */}
                      <td className="py-3 px-3 text-right font-mono tabular-nums">
                        <div className="font-bold text-gray-900">{formatNumber(c.baselineAvgTmat, 1)}</div>
                        {scObj && (
                          <div className="text-[11px] text-gray-600 flex items-center justify-end gap-1">
                            <span>➔ {formatNumber(scObj.avgNext, 1)}</span>
                          </div>
                        )}
                      </td>

                      {/* Stacked Mini Bar */}
                      <td className="py-3 px-3 w-48">
                        <div className="w-full h-3 bg-gray-100 rounded-full overflow-hidden flex border border-gray-200">
                          {CLASS_ORDER.map(cls => {
                            const pct = scObj ? scObj.pct[cls] : c.baselinePct[cls];
                            if (!pct || pct <= 0) return null;
                            return (
                              <div
                                key={cls}
                                style={{
                                  width: `${pct}%`,
                                  backgroundColor: CLASS_COLORS[cls]
                                }}
                                title={`${cls}: ${formatNumber(pct, 1)}%`}
                              />
                            );
                          })}
                        </div>
                        <div className="text-[11px] text-gray-600 mt-1 flex justify-between tabular-nums">
                          <span>Basah: {formatNumber(scObj?.summary["Basah <=45 %"] || (c.baselinePct["Tergenang (0-40)"] + c.baselinePct["A Tergenang (41-45)"]), 0)}%</span>
                          <span className="font-semibold text-emerald-800">Norm: {formatNumber(scObj?.pct["Normal (46-60)"] || c.baselinePct["Normal (46-60)"], 0)}%</span>
                          <span>Krg: {formatNumber(scObj?.summary["Kering >60 %"] || (c.baselinePct["A Kering (61-65)"] + c.baselinePct["Kering (>65)"]), 0)}%</span>
                        </div>
                      </td>

                      {/* 6 Category Columns */}
                      {CLASS_ORDER.filter(cls => cls !== "No Data").map(cls => {
                        const baseCount = c.baselineCounts[cls] || 0;
                        const basePct = c.baselinePct[cls] || 0;
                        const scCount = scObj ? (scObj.counts[cls] || 0) : baseCount;
                        const scPct = scObj ? (scObj.pct[cls] || 0) : basePct;
                        const delta = scCount - baseCount;

                        return (
                          <td key={cls} className="py-3 px-3 text-center tabular-nums">
                            <div className="font-semibold text-gray-900">
                              {scCount} <span className="text-[11px] text-gray-600 font-normal">({formatNumber(scPct, 0)}%)</span>
                            </div>
                            {delta !== 0 && (
                              <div className={`text-[11px] font-mono ${delta > 0 ? 'text-red-700' : 'text-blue-700'}`}>
                                {delta > 0 ? `+${delta}` : delta}
                              </div>
                            )}
                          </td>
                        );
                      })}

                      {/* Detail Modal Trigger */}
                      <td className="py-3 px-4 text-center">
                        <button
                          type="button"
                          onClick={() => setModalCompany(c)}
                          aria-label={`Lihat detail proyeksi ${c.company}`}
                          title="Lihat riwayat mingguan & kurva regresi"
                          className="min-h-10 min-w-10 inline-flex items-center justify-center hover:bg-gray-100 rounded-xl text-gray-700 hover:text-gray-900 transition-colors"
                        >
                          <ChevronRight size={16} aria-hidden="true" />
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        ) : activeTab === 'shift' ? (
          /* TAB 2: Shift / Analisis Pergeseran & Parameter OLS */
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs border-collapse">
              <thead>
                <tr className="bg-gray-50 border-b border-gray-200 text-gray-700 font-semibold">
                  <th className="py-3.5 px-4 sticky left-0 bg-gray-50 z-10 w-28">Perusahaan</th>
                  <th className="py-3.5 px-3 text-center w-20">Blok</th>
                  <th className="py-3.5 px-3 text-center">Skenario Hujan</th>
                  <th className="py-3.5 px-3 text-center">TMAT Baseline ➔ Proyeksi</th>
                  <th className="py-3.5 px-3 text-center text-blue-800 bg-blue-50">Basah (&le;45 cm)</th>
                  <th className="py-3.5 px-3 text-center text-emerald-800 bg-emerald-50">Normal (46-60 cm)</th>
                  <th className="py-3.5 px-3 text-center text-red-800 bg-red-50">Kering (&gt;60 cm)</th>
                  <th className="py-3.5 px-3 text-center bg-gray-100 text-gray-800">Akurasi R²</th>
                  <th className="py-3.5 px-3 text-center bg-gray-100 text-gray-800 font-mono">b0 (Now) / b1 (Lag1)</th>
                  <th className="py-3.5 px-4 text-center">Detail</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100 font-medium">
                {filteredCompanies.map(c => {
                  const scObj = c.scenarios.find(s => s.scenarioMm === selectedScenarioMm) || c.scenarios[0];
                  const baseBasah = (c.baselineCounts["Tergenang (0-40)"] || 0) + (c.baselineCounts["A Tergenang (41-45)"] || 0) + (c.baselineCounts["Banjir (<0)"] || 0);
                  const scBasah = scObj ? (scObj.counts["Tergenang (0-40)"] || 0) + (scObj.counts["A Tergenang (41-45)"] || 0) + (scObj.counts["Banjir (<0)"] || 0) : baseBasah;
                  const deltaBasah = scBasah - baseBasah;

                  const baseNormal = c.baselineCounts["Normal (46-60)"] || 0;
                  const scNormal = scObj ? (scObj.counts["Normal (46-60)"] || 0) : baseNormal;
                  const deltaNormal = scNormal - baseNormal;

                  const baseKering = (c.baselineCounts["A Kering (61-65)"] || 0) + (c.baselineCounts["Kering (>65)"] || 0);
                  const scKering = scObj ? (scObj.counts["A Kering (61-65)"] || 0) + (scObj.counts["Kering (>65)"] || 0) : baseKering;
                  const deltaKering = scKering - baseKering;

                  return (
                    <tr key={c.company} className="hover:bg-gray-50 transition-colors group">
                      <td className="py-3 px-4 font-bold text-gray-900 sticky left-0 bg-white group-hover:bg-gray-50 z-10 whitespace-nowrap">
                        <span className="px-2.5 py-1 bg-gray-100 border border-gray-200 rounded-lg text-gray-900 font-mono text-xs">
                          {c.company}
                        </span>
                      </td>

                      <td className="py-3 px-3 text-center text-gray-700 tabular-nums">{c.totalBlocks || c.totalPoints}</td>

                      <td className="py-3 px-3 text-center tabular-nums">
                        <span className="px-2 py-0.5 rounded-md bg-gray-100 border border-gray-200 text-gray-900 font-semibold text-xs">
                          CH {scObj?.scenarioMm} mm
                        </span>
                      </td>

                      <td className="py-3 px-3 text-center font-mono tabular-nums">
                        <span className="text-gray-600">{formatNumber(c.baselineAvgTmat, 1)}</span>
                        <span className="mx-1 text-gray-500">➔</span>
                        <span className="font-bold text-gray-900">{formatNumber(scObj?.avgNext, 1)} cm</span>
                      </td>

                      {/* Basah */}
                      <td className="py-3 px-3 text-center tabular-nums">
                        <div className="font-semibold text-blue-800">{scBasah} blok</div>
                        <div className={`text-[11px] font-mono ${deltaBasah > 0 ? 'text-blue-700 font-bold' : 'text-gray-600'}`}>
                          {deltaBasah > 0 ? `+${deltaBasah} blok` : deltaBasah === 0 ? '0' : `${deltaBasah} blok`}
                        </div>
                      </td>

                      {/* Normal */}
                      <td className="py-3 px-3 text-center tabular-nums">
                        <div className="font-semibold text-emerald-800">{scNormal} blok</div>
                        <div className={`text-[11px] font-mono ${deltaNormal > 0 ? 'text-emerald-700 font-bold' : deltaNormal < 0 ? 'text-amber-700' : 'text-gray-600'}`}>
                          {deltaNormal > 0 ? `+${deltaNormal} blok` : deltaNormal === 0 ? '0' : `${deltaNormal} blok`}
                        </div>
                      </td>

                      {/* Kering */}
                      <td className="py-3 px-3 text-center tabular-nums">
                        <div className="font-semibold text-red-800">{scKering} blok</div>
                        <div className={`text-[11px] font-mono ${deltaKering > 0 ? 'text-red-700 font-bold' : 'text-gray-600'}`}>
                          {deltaKering > 0 ? `+${deltaKering} blok` : deltaKering === 0 ? '0' : `${deltaKering} blok`}
                        </div>
                      </td>

                      {/* R2 score */}
                      <td className="py-3 px-3 text-center font-bold text-gray-900 tabular-nums">
                        {formatNumber((c.fit.r2 || 0) * 100, 1)}%
                      </td>

                      {/* b0 and b1 weights */}
                      <td className="py-3 px-3 text-center text-gray-700 font-mono text-xs tabular-nums">
                        <span>{formatNumber(c.fit.b0, 3)}</span>
                        <span className="text-gray-500 mx-1">/</span>
                        <span className="text-gray-900 font-bold">{formatNumber(c.fit.b1, 3)}</span>
                      </td>

                      <td className="py-3 px-4 text-center">
                        <button
                          type="button"
                          onClick={() => setModalCompany(c)}
                          aria-label={`Lihat detail proyeksi ${c.company}`}
                          className="min-h-10 min-w-10 inline-flex items-center justify-center hover:bg-gray-100 rounded-xl text-gray-700 hover:text-gray-900 transition-colors"
                        >
                          <ChevronRight size={16} aria-hidden="true" />
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        ) : (
          /* TAB 3: Riwayat Mingguan */
          <div className="p-4 sm:p-5 space-y-4">
            <div className="text-xs text-gray-600">
              Menampilkan riwayat rata-rata TMAT (cm) dan akumulasi curah hujan mingguan (mm) selama periode lookback:
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {filteredCompanies.map(c => (
                <div key={c.company} className="p-4 bg-gray-50 rounded-xl border border-gray-200">
                  <div className="flex items-center justify-between mb-3">
                    <span className="font-bold text-gray-900 font-mono">{c.company}</span>
                    <span className="text-xs text-gray-600 tabular-nums">{c.totalBlocks || c.totalPoints} blok pantau</span>
                  </div>
                  <div className="space-y-1.5">
                    {c.weeklyHistory.map(h => (
                      <div key={h.week} className="flex items-center justify-between text-xs py-1 border-b border-gray-200 last:border-0 tabular-nums">
                        <span className="font-medium text-gray-700">{h.week}</span>
                        <div className="flex items-center gap-3">
                          <span className="text-blue-800 font-mono">
                            {formatNumber(h.rainMm, 1)} mm
                          </span>
                          <span className="font-bold text-gray-900 font-mono">
                            {formatNumber(h.avgTmat, 1)} cm
                          </span>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Modal Detail Perusahaan */}
      {modalCompany && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div
            role="dialog"
            aria-modal="true"
            aria-labelledby="mc-modal-title"
            className="bg-white rounded-2xl max-w-2xl w-full border border-gray-200 shadow-xl overflow-hidden"
          >
            {/* Modal Header */}
            <div className="p-5 border-b border-gray-200 flex items-center justify-between bg-gray-50">
              <div className="flex items-center gap-3">
                <span className="px-3 py-1.5 rounded-xl bg-black text-white font-bold font-mono text-sm">
                  {modalCompany.company}
                </span>
                <div>
                  <h2 id="mc-modal-title" className="font-bold text-gray-900 text-base">Detail Proyeksi &amp; Model Memori Air Tanah</h2>
                  <p className="text-xs text-gray-600">Baseline Week: {modalCompany.baselineWeek} ({modalCompany.totalBlocks || modalCompany.totalPoints} blok)</p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setModalCompany(null)}
                aria-label="Tutup modal detail"
                className="min-h-11 min-w-11 inline-flex items-center justify-center text-gray-700 hover:text-gray-900 hover:bg-gray-200 rounded-xl transition-colors"
              >
                <X size={18} aria-hidden="true" />
              </button>
            </div>

            {/* Modal Body */}
            <div className="p-5 sm:p-6 space-y-6 max-h-[75vh] overflow-y-auto">
              {/* Regression Info & Formula */}
              <div className="p-4 bg-gray-50 rounded-xl border border-gray-200 text-xs space-y-2">
                <div className="font-semibold text-gray-900 flex items-center gap-1.5">
                  <Zap size={15} aria-hidden="true" />
                  <span>Formula Regresi Multivariat 3-Week Memory (Antecedent Moisture):</span>
                </div>
                <div className="font-mono text-gray-900 px-3 py-2 bg-white rounded-lg border border-gray-200 text-xs leading-relaxed">
                  &Delta;TMAT = {formatNumber(modalCompany.fit.a, 2)} + ({formatNumber(modalCompany.fit.b0, 4)} &times; CH_next) + ({formatNumber(modalCompany.fit.b1, 4)} &times; CH_curr) + ({formatNumber(modalCompany.fit.b2, 4)} &times; CH_prev)
                </div>

                {/* Antecedent Real Rain Values */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs pt-1 tabular-nums">
                  <div className="text-gray-700">
                    • Hujan Riil Minggu Ini (CH_curr): <span className="font-bold font-mono text-gray-900">{formatNumber(modalCompany.fit.antecedentRainCurrent, 1)} mm</span>
                  </div>
                  <div className="text-gray-700">
                    • Hujan Riil Minggu Lalu (CH_prev): <span className="font-bold font-mono text-gray-900">{formatNumber(modalCompany.fit.antecedentRainLag1, 1)} mm</span>
                  </div>
                </div>

                <div className="text-gray-700 text-xs pt-2 flex flex-wrap items-center justify-between gap-2 border-t border-gray-200 tabular-nums">
                  <span>Akurasi Model: <strong>R² = {formatNumber((modalCompany.fit.r2 || 0) * 100, 1)}%</strong> | MAE: <strong>{formatNumber(modalCompany.fit.mae, 2)} cm</strong></span>
                  <span>Kebun Valid: <strong>{modalCompany.fit.validEstates}</strong> dari {modalCompany.fit.totalEstates} estate</span>
                </div>
              </div>

              {/* Scenarios Comparison Cards */}
              <div>
                <h3 className="text-xs font-semibold text-gray-600 uppercase tracking-wider mb-3">
                  Proyeksi Distribusi per Skenario Hujan
                </h3>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  {modalCompany.scenarios.map(sc => (
                    <div key={sc.scenarioMm} className="p-4 rounded-xl border border-gray-200 bg-gray-50 space-y-3 tabular-nums">
                      <div className="flex items-center justify-between">
                        <span className="font-bold text-gray-900 text-sm">Skenario CH {sc.scenarioMm} mm</span>
                        <span className="text-xs font-mono font-bold text-gray-900">
                          Avg: {formatNumber(sc.avgNext, 1)} cm
                        </span>
                      </div>
                      <div className="space-y-1 text-xs">
                        <div className="flex justify-between text-blue-800">
                          <span>Basah (&le;45 cm):</span>
                          <span className="font-semibold">{sc.summary["Basah <=45 Count"]} blok ({formatNumber(sc.summary["Basah <=45 %"], 1)}%)</span>
                        </div>
                        <div className="flex justify-between text-emerald-800">
                          <span>Normal (46-60 cm):</span>
                          <span className="font-semibold">{sc.counts["Normal (46-60)"]} blok ({formatNumber(sc.pct["Normal (46-60)"], 1)}%)</span>
                        </div>
                        <div className="flex justify-between text-red-800">
                          <span>Kering (&gt;60 cm):</span>
                          <span className="font-semibold">{sc.summary["Kering >60 Count"]} blok ({formatNumber(sc.summary["Kering >60 %"], 1)}%)</span>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* History Table */}
              <div>
                <h3 className="text-xs font-semibold text-gray-600 uppercase tracking-wider mb-3">
                  Riwayat Mingguan ({modalCompany.weeklyHistory.length} Minggu Terakhir)
                </h3>
                <div className="rounded-xl border border-gray-200 overflow-hidden">
                  <table className="w-full text-left text-xs">
                    <thead className="bg-gray-50 border-b border-gray-200 text-gray-700 font-semibold">
                      <tr>
                        <th className="py-2.5 px-3">Minggu</th>
                        <th className="py-2.5 px-3 text-right">Curah Hujan (mm)</th>
                        <th className="py-2.5 px-3 text-right">Rata-rata TMAT (cm)</th>
                        <th className="py-2.5 px-3 text-center">Jumlah Blok</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100 font-medium tabular-nums">
                      {modalCompany.weeklyHistory.map(h => (
                        <tr key={h.week} className="hover:bg-gray-50">
                          <td className="py-2 px-3 text-gray-900">{h.week}</td>
                          <td className="py-2 px-3 text-right text-blue-800 font-mono">{formatNumber(h.rainMm, 1)}</td>
                          <td className="py-2 px-3 text-right text-gray-900 font-mono font-bold">{formatNumber(h.avgTmat, 1)}</td>
                          <td className="py-2 px-3 text-center text-gray-600">{h.totalRecords}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>

            {/* Modal Footer */}
            <div className="p-4 bg-gray-50 border-t border-gray-200 flex justify-end">
              <button
                type="button"
                onClick={() => setModalCompany(null)}
                className="min-h-11 px-5 py-2 bg-black hover:bg-gray-800 text-white font-semibold rounded-xl text-sm transition-colors"
              >
                Tutup
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
