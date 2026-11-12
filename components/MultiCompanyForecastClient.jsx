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
  Info
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
        "Total Titik": c.totalPoints,
        "Baseline Avg TMAT (cm)": Number(c.baselineAvgTmat?.toFixed(1)) || 0,
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

    // Sheet 2: Detail Baseline 6 Kelas
    const baselineDetailRows = [];
    data.companies.forEach(c => {
      CLASS_ORDER.forEach(cls => {
        baselineDetailRows.push({
          "Company": c.company,
          "Baseline Week": c.baselineWeek,
          "Kelas TMAT": cls,
          "Jumlah Titik": c.baselineCounts[cls] || 0,
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
            "Jumlah Titik": scObj.counts[cls] || 0,
            "Persentase (%)": Number(scObj.pct[cls]?.toFixed(2)) || 0,
            "Baseline Titik": c.baselineCounts[cls] || 0,
            "Delta Titik": (scObj.counts[cls] || 0) - (c.baselineCounts[cls] || 0)
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
      {/* Page Title & Controls */}
      <div className="bg-white rounded-2xl p-6 border border-gray-100 shadow-sm flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <span className="p-2 rounded-xl bg-blue-50 text-blue-600 font-semibold">
              <Building2 size={20} />
            </span>
            <h1 className="text-xl font-bold text-gray-900">Komparasi Forecast Multi-PT</h1>
          </div>
          <p className="text-sm text-gray-500 mt-1">
            Matriks komparasi mingguan TMAT titik vs curah hujan dan proyeksi 6 kategori hidrologi untuk seluruh perusahaan.
          </p>
        </div>

        {/* Action Controls */}
        <div className="flex flex-wrap items-center gap-3">
          {/* Baseline Week Selector */}
          <div className="flex items-center gap-2 bg-gray-50 px-3 py-1.5 rounded-xl border border-gray-200">
            <span className="text-xs font-semibold text-gray-600 whitespace-nowrap">Baseline:</span>
            <select
              value={selectedBaselineWeek}
              onChange={(e) => setSelectedBaselineWeek(e.target.value)}
              className="bg-transparent text-xs font-semibold text-gray-800 focus:outline-none cursor-pointer"
            >
              {data?.targetWeeks?.map(w => (
                <option key={w} value={w}>{w}</option>
              ))}
            </select>
          </div>

          {/* Lookback Selector */}
          <div className="flex items-center gap-2 bg-gray-50 px-3 py-1.5 rounded-xl border border-gray-200">
            <span className="text-xs font-semibold text-gray-600 whitespace-nowrap">Lookback:</span>
            <select
              value={lookbackWeeks}
              onChange={(e) => setLookbackWeeks(e.target.value)}
              className="bg-transparent text-xs font-semibold text-gray-800 focus:outline-none cursor-pointer"
            >
              <option value="4">4 Minggu</option>
              <option value="8">8 Minggu</option>
              <option value="12">12 Minggu</option>
            </select>
          </div>

          {/* Scenarios Input */}
          <div className="flex items-center gap-2 bg-gray-50 px-3 py-1.5 rounded-xl border border-gray-200">
            <span className="text-xs font-semibold text-gray-600 whitespace-nowrap">Skenario (mm):</span>
            <input
              type="text"
              value={scenarioInput}
              onChange={(e) => setScenarioInput(e.target.value)}
              placeholder="0,50"
              className="w-20 bg-transparent text-xs font-semibold text-gray-800 focus:outline-none"
            />
          </div>

          {/* Calculate / Refresh Button */}
          <button
            onClick={handleApplyFilters}
            disabled={loading}
            className="flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 disabled:bg-blue-300 text-white rounded-xl text-xs font-semibold shadow-sm transition-all"
          >
            <RefreshCw size={14} className={loading ? "animate-spin" : ""} />
            <span>{loading ? "Memproses..." : "Hitung Proyeksi"}</span>
          </button>

          {/* Export Excel Button */}
          <button
            onClick={handleExportExcel}
            disabled={loading || !data?.companies?.length}
            className="flex items-center gap-2 px-4 py-2 bg-emerald-600 hover:bg-emerald-700 disabled:bg-emerald-300 text-white rounded-xl text-xs font-semibold shadow-sm transition-all"
          >
            <Download size={14} />
            <span>Export Excel</span>
          </button>
        </div>
      </div>

      {error && (
        <div className="p-4 bg-red-50 border border-red-200 text-red-700 rounded-xl flex items-center gap-3 text-sm">
          <AlertTriangle size={18} className="shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {/* Top Executive Stats */}
      {data?.overall && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <div className="bg-white p-5 rounded-2xl border border-gray-100 shadow-sm">
            <div className="text-xs font-medium text-gray-500 uppercase tracking-wider">Total Perusahaan</div>
            <div className="text-2xl font-bold text-gray-900 mt-2 flex items-baseline gap-2">
              {data.overall.totalCompanies}
              <span className="text-xs font-medium text-gray-400">PT Aktif</span>
            </div>
            <div className="text-xs text-gray-400 mt-1">Diproses serentak</div>
          </div>

          <div className="bg-white p-5 rounded-2xl border border-gray-100 shadow-sm">
            <div className="text-xs font-medium text-gray-500 uppercase tracking-wider">Total Titik Pantau</div>
            <div className="text-2xl font-bold text-blue-600 mt-2 flex items-baseline gap-2">
              {data.overall.totalPoints.toLocaleString('id-ID')}
              <span className="text-xs font-medium text-gray-400">Piezometer</span>
            </div>
            <div className="text-xs text-gray-400 mt-1">Pada minggu {data.baselineWeek}</div>
          </div>

          <div className="bg-white p-5 rounded-2xl border border-gray-100 shadow-sm">
            <div className="text-xs font-medium text-gray-500 uppercase tracking-wider">Rata-rata TMAT Group</div>
            <div className="text-2xl font-bold text-gray-900 mt-2 flex items-baseline gap-2">
              {formatNumber(data.overall.baselineAvgTmat, 1)}
              <span className="text-xs font-medium text-gray-400">cm</span>
            </div>
            <div className="text-xs text-gray-400 mt-1">Rata-rata tertimbang nasional</div>
          </div>

          <div className="bg-white p-5 rounded-2xl border border-gray-100 shadow-sm">
            <div className="text-xs font-medium text-gray-500 uppercase tracking-wider">Status Normal Baseline</div>
            <div className="text-2xl font-bold text-emerald-600 mt-2 flex items-baseline gap-2">
              {formatNumber(data.overall.baselinePct["Normal (46-60)"], 1)}%
              <span className="text-xs font-medium text-gray-400">
                ({(data.overall.baselineCounts["Normal (46-60)"] || 0).toLocaleString('id-ID')} titik)
              </span>
            </div>
            <div className="text-xs text-gray-400 mt-1">Target zona ideal (46-60 cm)</div>
          </div>
        </div>
      )}

      {/* Tabs & Search Filter */}
      <div className="bg-white rounded-2xl p-4 border border-gray-100 shadow-sm flex flex-col md:flex-row md:items-center justify-between gap-4">
        {/* Navigation Tabs */}
        <div className="flex items-center gap-2 p-1 bg-gray-100 rounded-xl">
          <button
            onClick={() => setActiveTab('matrix')}
            className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all flex items-center gap-1.5 ${
              activeTab === 'matrix' ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500 hover:text-gray-900'
            }`}
          >
            <Layers size={14} />
            <span>Matriks 6 Kategori</span>
          </button>

          <button
            onClick={() => setActiveTab('shift')}
            className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all flex items-center gap-1.5 ${
              activeTab === 'shift' ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500 hover:text-gray-900'
            }`}
          >
            <TrendingUp size={14} />
            <span>Pergeseran Status (Shift)</span>
          </button>

          <button
            onClick={() => setActiveTab('history')}
            className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all flex items-center gap-1.5 ${
              activeTab === 'history' ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500 hover:text-gray-900'
            }`}
          >
            <BarChart2 size={14} />
            <span>Tren TMAT vs Hujan</span>
          </button>
        </div>

        {/* Search & Scenario Filter */}
        <div className="flex flex-wrap items-center gap-3">
          {/* Active Scenario Selector (for shift or comparison view) */}
          {data?.scenarios && data.scenarios.length > 0 && (
            <div className="flex items-center gap-1 bg-gray-50 p-1 rounded-xl border border-gray-200">
              <span className="text-[11px] font-semibold text-gray-500 px-2">Skenario Aktif:</span>
              {data.scenarios.map(scMm => (
                <button
                  key={scMm}
                  onClick={() => setSelectedScenarioMm(scMm)}
                  className={`px-2.5 py-1 rounded-lg text-xs font-semibold transition-all ${
                    selectedScenarioMm === scMm
                      ? 'bg-blue-600 text-white shadow-sm'
                      : 'text-gray-600 hover:bg-gray-200'
                  }`}
                >
                  {scMm} mm
                </button>
              ))}
            </div>
          )}

          {/* Search Box */}
          <div className="relative">
            <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Cari PT..."
              className="pl-8 pr-3 py-1.5 bg-gray-50 border border-gray-200 rounded-xl text-xs font-medium text-gray-800 placeholder-gray-400 focus:outline-none focus:ring-1 focus:ring-blue-500 w-40"
            />
          </div>
        </div>
      </div>

      {/* Main Table Content */}
      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
        {loading ? (
          <div className="p-16 flex flex-col items-center justify-center text-gray-400 gap-3">
            <RefreshCw size={28} className="animate-spin text-blue-500" />
            <span className="text-sm font-medium">Memuat data dan mengkalkulasi skenario proyeksi seluruh PT...</span>
          </div>
        ) : filteredCompanies.length === 0 ? (
          <div className="p-16 text-center text-gray-400 text-sm">
            Tidak ada data perusahaan yang cocok dengan pencarian.
          </div>
        ) : activeTab === 'matrix' ? (
          /* TAB 1: Matriks 6 Kategori Hidrologi */
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs border-collapse">
              <thead>
                <tr className="bg-gray-50/80 border-b border-gray-100 text-gray-600 font-semibold">
                  <th className="py-3.5 px-4 sticky left-0 bg-gray-50/90 backdrop-blur z-10 w-28">Perusahaan</th>
                  <th className="py-3.5 px-3 text-center w-20">Titik</th>
                  <th className="py-3.5 px-3 text-right w-24">TMAT (cm)</th>
                  <th className="py-3.5 px-3 text-center">Distribusi Status</th>
                  <th className="py-3.5 px-3 text-center text-zinc-600 bg-zinc-50/50">Banjir (&lt;0)</th>
                  <th className="py-3.5 px-3 text-center text-blue-700 bg-blue-50/50">Tergenang (0-40)</th>
                  <th className="py-3.5 px-3 text-center text-blue-500 bg-blue-50/30">A Tergenang (41-45)</th>
                  <th className="py-3.5 px-3 text-center text-emerald-700 bg-emerald-50/50 font-bold">Normal (46-60)</th>
                  <th className="py-3.5 px-3 text-center text-amber-600 bg-amber-50/50">A Kering (61-65)</th>
                  <th className="py-3.5 px-3 text-center text-red-600 bg-red-50/50">Kering (&gt;65)</th>
                  <th className="py-3.5 px-4 text-center">Detail</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100 font-medium">
                {filteredCompanies.map(c => {
                  const scObj = c.scenarios.find(s => s.scenarioMm === selectedScenarioMm) || c.scenarios[0];
                  return (
                    <tr key={c.company} className="hover:bg-blue-50/30 transition-colors group">
                      {/* Company Name */}
                      <td className="py-3 px-4 font-bold text-gray-900 sticky left-0 bg-white group-hover:bg-blue-50/30 z-10 whitespace-nowrap">
                        <span className="px-2.5 py-1 bg-gray-100 rounded-lg text-gray-800 font-mono text-[11px]">
                          {c.company}
                        </span>
                      </td>

                      {/* Total Points */}
                      <td className="py-3 px-3 text-center text-gray-600">
                        {c.totalPoints}
                      </td>

                      {/* Avg TMAT Baseline vs Scenario */}
                      <td className="py-3 px-3 text-right font-mono">
                        <div className="font-bold text-gray-900">{formatNumber(c.baselineAvgTmat, 1)}</div>
                        {scObj && (
                          <div className="text-[10px] text-gray-500 flex items-center justify-end gap-1">
                            <span>➔ {formatNumber(scObj.avgNext, 1)}</span>
                          </div>
                        )}
                      </td>

                      {/* Stacked Mini Bar */}
                      <td className="py-3 px-3 w-48">
                        <div className="w-full h-3 bg-gray-100 rounded-full overflow-hidden flex shadow-inner">
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
                        <div className="text-[10px] text-gray-400 mt-1 flex justify-between">
                          <span>Basah: {formatNumber(scObj?.summary["Basah <=45 %"] || (c.baselinePct["Tergenang (0-40)"] + c.baselinePct["A Tergenang (41-45)"]), 0)}%</span>
                          <span className="font-semibold text-emerald-600">Norm: {formatNumber(scObj?.pct["Normal (46-60)"] || c.baselinePct["Normal (46-60)"], 0)}%</span>
                          <span>Krg: {formatNumber(scObj?.summary["Kering >60 %"] || (c.baselinePct["A Kering (61-65)"] + c.baselinePct["Kering (>65)"]), 0)}%</span>
                        </div>
                      </td>

                      {/* 6 Category Columns (Showing Baseline & Proyeksi Skenario) */}
                      {CLASS_ORDER.filter(cls => cls !== "No Data").map(cls => {
                        const baseCount = c.baselineCounts[cls] || 0;
                        const basePct = c.baselinePct[cls] || 0;
                        const scCount = scObj ? (scObj.counts[cls] || 0) : baseCount;
                        const scPct = scObj ? (scObj.pct[cls] || 0) : basePct;
                        const delta = scCount - baseCount;

                        return (
                          <td key={cls} className="py-3 px-3 text-center">
                            <div className="font-semibold text-gray-900">
                              {scCount} <span className="text-[10px] text-gray-500 font-normal">({formatNumber(scPct, 0)}%)</span>
                            </div>
                            {delta !== 0 && (
                              <div className={`text-[10px] font-mono ${delta > 0 ? 'text-red-500' : 'text-blue-500'}`}>
                                {delta > 0 ? `+${delta}` : delta}
                              </div>
                            )}
                          </td>
                        );
                      })}

                      {/* Detail Modal Trigger */}
                      <td className="py-3 px-4 text-center">
                        <button
                          onClick={() => setModalCompany(c)}
                          className="p-1.5 hover:bg-gray-100 rounded-lg text-gray-500 hover:text-blue-600 transition-colors"
                          title="Lihat riwayat mingguan & kurva regresi"
                        >
                          <ChevronRight size={16} />
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        ) : activeTab === 'shift' ? (
          /* TAB 2: Shift / Analisis Pergeseran Risiko */
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs border-collapse">
              <thead>
                <tr className="bg-gray-50/80 border-b border-gray-100 text-gray-600 font-semibold">
                  <th className="py-3.5 px-4 sticky left-0 bg-gray-50/90 backdrop-blur z-10 w-28">Perusahaan</th>
                  <th className="py-3.5 px-3 text-center w-20">Titik</th>
                  <th className="py-3.5 px-3 text-center">Skenario Hujan</th>
                  <th className="py-3.5 px-3 text-center">TMAT Baseline ➔ Proyeksi</th>
                  <th className="py-3.5 px-3 text-center text-blue-700 bg-blue-50/30">Basah (&le;45 cm)</th>
                  <th className="py-3.5 px-3 text-center text-emerald-700 bg-emerald-50/30">Normal (46-60 cm)</th>
                  <th className="py-3.5 px-3 text-center text-red-700 bg-red-50/30">Kering (&gt;60 cm)</th>
                  <th className="py-3.5 px-3 text-center">Model Slope (b)</th>
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
                    <tr key={c.company} className="hover:bg-blue-50/30 transition-colors group">
                      <td className="py-3 px-4 font-bold text-gray-900 sticky left-0 bg-white group-hover:bg-blue-50/30 z-10 whitespace-nowrap">
                        <span className="px-2.5 py-1 bg-gray-100 rounded-lg text-gray-800 font-mono text-[11px]">
                          {c.company}
                        </span>
                      </td>

                      <td className="py-3 px-3 text-center text-gray-600">{c.totalPoints}</td>

                      <td className="py-3 px-3 text-center">
                        <span className="px-2 py-0.5 rounded-full bg-blue-100 text-blue-700 font-semibold text-[11px]">
                          CH {scObj?.scenarioMm} mm
                        </span>
                      </td>

                      <td className="py-3 px-3 text-center font-mono">
                        <span className="text-gray-500">{formatNumber(c.baselineAvgTmat, 1)}</span>
                        <span className="mx-1 text-gray-400">➔</span>
                        <span className="font-bold text-gray-900">{formatNumber(scObj?.avgNext, 1)} cm</span>
                      </td>

                      {/* Basah */}
                      <td className="py-3 px-3 text-center">
                        <div className="font-semibold text-blue-700">{scBasah} titik</div>
                        <div className={`text-[10px] font-mono ${deltaBasah > 0 ? 'text-blue-600 font-bold' : 'text-gray-400'}`}>
                          {deltaBasah > 0 ? `+${deltaBasah} titik` : deltaBasah === 0 ? '0' : `${deltaBasah} titik`}
                        </div>
                      </td>

                      {/* Normal */}
                      <td className="py-3 px-3 text-center">
                        <div className="font-semibold text-emerald-700">{scNormal} titik</div>
                        <div className={`text-[10px] font-mono ${deltaNormal > 0 ? 'text-emerald-600 font-bold' : deltaNormal < 0 ? 'text-amber-600' : 'text-gray-400'}`}>
                          {deltaNormal > 0 ? `+${deltaNormal} titik` : deltaNormal === 0 ? '0' : `${deltaNormal} titik`}
                        </div>
                      </td>

                      {/* Kering */}
                      <td className="py-3 px-3 text-center">
                        <div className="font-semibold text-red-700">{scKering} titik</div>
                        <div className={`text-[10px] font-mono ${deltaKering > 0 ? 'text-red-600 font-bold' : 'text-gray-400'}`}>
                          {deltaKering > 0 ? `+${deltaKering} titik` : deltaKering === 0 ? '0' : `${deltaKering} titik`}
                        </div>
                      </td>

                      {/* Model Regression info */}
                      <td className="py-3 px-3 text-center text-gray-500 font-mono text-[11px]">
                        {c.fit.b ? `${formatNumber(c.fit.b, 3)} cm/mm` : '-'}
                      </td>

                      <td className="py-3 px-4 text-center">
                        <button
                          onClick={() => setModalCompany(c)}
                          className="p-1.5 hover:bg-gray-100 rounded-lg text-gray-500 hover:text-blue-600 transition-colors"
                        >
                          <ChevronRight size={16} />
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
          <div className="p-4 space-y-4">
            <div className="text-xs text-gray-500 mb-2">
              Menampilkan riwayat rata-rata TMAT (cm) dan akumulasi curah hujan mingguan (mm) selama periode lookback:
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {filteredCompanies.map(c => (
                <div key={c.company} className="p-4 bg-gray-50 rounded-xl border border-gray-100 hover:shadow-sm transition-all">
                  <div className="flex items-center justify-between mb-3">
                    <span className="font-bold text-gray-900 font-mono">{c.company}</span>
                    <span className="text-[11px] text-gray-400">{c.totalPoints} titik pantau</span>
                  </div>
                  <div className="space-y-1.5">
                    {c.weeklyHistory.map(h => (
                      <div key={h.week} className="flex items-center justify-between text-xs py-1 border-b border-gray-200/50 last:border-0">
                        <span className="font-medium text-gray-600">{h.week}</span>
                        <div className="flex items-center gap-3">
                          <span className="text-blue-600 font-mono text-[11px]">
                            {formatNumber(h.rainMm, 1)} mm
                          </span>
                          <span className="font-bold text-gray-800 font-mono text-[11px]">
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
        <div className="fixed inset-0 bg-black/40 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl max-w-2xl w-full border border-gray-100 shadow-2xl overflow-hidden animate-in fade-in zoom-in-95 duration-200">
            {/* Modal Header */}
            <div className="p-6 border-b border-gray-100 flex items-center justify-between bg-gray-50/50">
              <div className="flex items-center gap-3">
                <span className="p-2.5 rounded-xl bg-blue-100 text-blue-700 font-bold font-mono">
                  {modalCompany.company}
                </span>
                <div>
                  <h3 className="font-bold text-gray-900 text-base">Detail Proyeksi & Histori Hidrologi</h3>
                  <p className="text-xs text-gray-500">Baseline Week: {modalCompany.baselineWeek} ({modalCompany.totalPoints} titik)</p>
                </div>
              </div>
              <button
                onClick={() => setModalCompany(null)}
                className="p-1.5 text-gray-400 hover:text-gray-700 hover:bg-gray-100 rounded-full transition-colors"
              >
                <X size={18} />
              </button>
            </div>

            {/* Modal Body */}
            <div className="p-6 space-y-6 max-h-[75vh] overflow-y-auto">
              {/* Regression Info */}
              <div className="p-4 bg-blue-50/60 rounded-2xl border border-blue-100 text-xs space-y-1">
                <div className="font-semibold text-blue-900 flex items-center gap-1.5">
                  <Info size={14} />
                  <span>Model Respons Hujan (Estate Granular Regression):</span>
                </div>
                <div className="font-mono text-blue-800 pl-5">
                  &Delta;TMAT = {formatNumber(modalCompany.fit.a, 2)} + ({formatNumber(modalCompany.fit.b, 3)} &times; Curah Hujan)
                </div>
                <div className="text-blue-600 text-[11px] pl-5">
                  Metode: {modalCompany.fit.method} | Kebun Valid: {modalCompany.fit.validEstates} dari {modalCompany.fit.totalEstates} estate
                </div>
              </div>

              {/* Scenarios Comparison Cards */}
              <div>
                <h4 className="text-xs font-semibold text-gray-600 uppercase tracking-wider mb-3">
                  Proyeksi Distribusi per Skenario Hujan
                </h4>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  {modalCompany.scenarios.map(sc => (
                    <div key={sc.scenarioMm} className="p-4 rounded-xl border border-gray-200 bg-gray-50/60 space-y-3">
                      <div className="flex items-center justify-between">
                        <span className="font-bold text-blue-700 text-sm">Skenario CH {sc.scenarioMm} mm</span>
                        <span className="text-xs font-mono font-bold text-gray-900">
                          Avg: {formatNumber(sc.avgNext, 1)} cm
                        </span>
                      </div>
                      <div className="space-y-1 text-xs">
                        <div className="flex justify-between text-blue-700">
                          <span>Basah (&le;45 cm):</span>
                          <span className="font-semibold">{sc.summary["Basah <=45 Count"]} titik ({formatNumber(sc.summary["Basah <=45 %"], 1)}%)</span>
                        </div>
                        <div className="flex justify-between text-emerald-700">
                          <span>Normal (46-60 cm):</span>
                          <span className="font-semibold">{sc.counts["Normal (46-60)"]} titik ({formatNumber(sc.pct["Normal (46-60)"], 1)}%)</span>
                        </div>
                        <div className="flex justify-between text-red-700">
                          <span>Kering (&gt;60 cm):</span>
                          <span className="font-semibold">{sc.summary["Kering >60 Count"]} titik ({formatNumber(sc.summary["Kering >60 %"], 1)}%)</span>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* History Table */}
              <div>
                <h4 className="text-xs font-semibold text-gray-600 uppercase tracking-wider mb-3">
                  Riwayat Mingguan ({modalCompany.weeklyHistory.length} Minggu Terakhir)
                </h4>
                <div className="rounded-xl border border-gray-200 overflow-hidden">
                  <table className="w-full text-left text-xs">
                    <thead className="bg-gray-50 border-b border-gray-200 text-gray-600 font-semibold">
                      <tr>
                        <th className="py-2.5 px-3">Minggu</th>
                        <th className="py-2.5 px-3 text-right">Curah Hujan (mm)</th>
                        <th className="py-2.5 px-3 text-right">Rata-rata TMAT (cm)</th>
                        <th className="py-2.5 px-3 text-center">Jumlah Titik</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100 font-medium">
                      {modalCompany.weeklyHistory.map(h => (
                        <tr key={h.week} className="hover:bg-gray-50">
                          <td className="py-2 px-3 text-gray-800">{h.week}</td>
                          <td className="py-2 px-3 text-right text-blue-600 font-mono">{formatNumber(h.rainMm, 1)}</td>
                          <td className="py-2 px-3 text-right text-gray-900 font-mono font-bold">{formatNumber(h.avgTmat, 1)}</td>
                          <td className="py-2 px-3 text-center text-gray-500">{h.totalRecords}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>

            {/* Modal Footer */}
            <div className="p-4 bg-gray-50 border-t border-gray-100 flex justify-end">
              <button
                onClick={() => setModalCompany(null)}
                className="px-4 py-2 bg-gray-200 hover:bg-gray-300 text-gray-800 font-semibold rounded-xl text-xs transition-colors"
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
