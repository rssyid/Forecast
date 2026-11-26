'use client';

import React, { useState, useEffect, useMemo } from 'react';
import { 
  TrendingDown, TrendingUp, Droplets, Map, Activity, AlertCircle, CloudRain, CheckCircle2, Waves, ArrowRight, ArrowDownRight, ArrowUpRight 
} from 'lucide-react';
import { 
  Chart as ChartJS, CategoryScale, LinearScale, PointElement, LineElement, BarElement, Title, Tooltip, Legend, ArcElement, Filler
} from 'chart.js';
import { Bar, Line, Doughnut } from 'react-chartjs-2';
import { processData } from '../lib/forecastEngine';

ChartJS.register(CategoryScale, LinearScale, PointElement, LineElement, BarElement, Title, Tooltip, Legend, ArcElement, Filler);

export default function OverviewClient() {
  const [data, setData] = useState(null);
  const [forecastData, setForecastData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  
  const [selectedCompany, setSelectedCompany] = useState('Semua');
  const [companies, setCompanies] = useState([]);

  useEffect(() => {
    // Fetch active companies for filter
    fetch('/api/companies?active=true')
      .then(r => r.json())
      .then(d => setCompanies(d.companies || []))
      .catch(console.error);
  }, []);

  useEffect(() => {
    fetchDashboardData();
  }, [selectedCompany]);

  const fetchDashboardData = async () => {
    setLoading(true);
    setError(null);
    try {
      // 1. Fetch Summary Data
      const summaryRes = await fetch(`/api/dashboard-summary?company=${encodeURIComponent(selectedCompany)}&week=`);
      if (!summaryRes.ok) throw new Error('Failed to fetch overview data');
      const summary = await summaryRes.json();
      setData(summary);

      // 2. Fetch Piezometer Data for Auto Forecast (8 weeks)
      const pzoRes = await fetch(`/api/get-piezometer?companyCode=${encodeURIComponent(selectedCompany)}&lookbackWeeks=8`);
      if (pzoRes.ok) {
        const pzoData = await pzoRes.json();
        
        // Prepare for forecast engine
        const DB_COL_MAP = { week: "month_name", tmat: "ketinggian", estate: "est_code", id: "pie_record_id", block: "block", date: "date_timestamp" };
        const baselineWeek = summary.currentWeek?.week;
        
        if (pzoData.data && pzoData.data.length > 0 && baselineWeek) {
            const engineResult = processData(
                pzoData.data, 
                DB_COL_MAP, 
                pzoData.rainfall || {}, 
                [0], // Predict for 0mm rain scenario
                baselineWeek
            );
            setForecastData({ ...engineResult, rawRainfall: pzoData.rainfall });
        } else {
            setForecastData(null);
        }
      }

    } catch (err) {
      console.error(err);
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  // --- KPI Logic ---
  const currentWeek = data?.currentWeek;
  const prevWeek = data?.prevWeek;
  
  // TMAT Arrow Logic: higher number = water level dropped = worse (red down arrow)
  const tmatDiff = currentWeek && prevWeek ? (parseFloat(currentWeek.avg_tmat) - parseFloat(prevWeek.avg_tmat)).toFixed(1) : 0;
  const isTmatWorse = parseFloat(tmatDiff) > 0;
  const isTmatBetter = parseFloat(tmatDiff) < 0;

  // Rainfall Logic
  const currentRain = data?.rainfallData?.reduce((sum, e) => sum + (parseFloat(e.total_mm) || 0), 0) || 0;
  
  // Status Distribution (Exact 6 Categories)
  const totalBlocks = currentWeek?.total_block || 0;
  const pBanjir = totalBlocks ? Math.round((currentWeek?.cnt_banjir || 0) / totalBlocks * 100) : 0;
  const pTergenang = totalBlocks ? Math.round((currentWeek?.cnt_tergenang || 0) / totalBlocks * 100) : 0;
  const pATergenang = totalBlocks ? Math.round((currentWeek?.cnt_a_tergenang || 0) / totalBlocks * 100) : 0;
  const pNormal = totalBlocks ? Math.round((currentWeek?.cnt_normal || 0) / totalBlocks * 100) : 0;
  const pAKering = totalBlocks ? Math.round((currentWeek?.cnt_a_kering || 0) / totalBlocks * 100) : 0;
  const pKering = totalBlocks ? Math.round((currentWeek?.cnt_kering || 0) / totalBlocks * 100) : 0;
  
  // For dominant status, we can group them logically or find the actual max
  const groupKering = pKering + pAKering;
  const groupBasah = pBanjir + pTergenang + pATergenang;
  
  let dominantStatus = 'Normal';
  if (groupKering > groupBasah && groupKering > pNormal) dominantStatus = 'Cenderung Kering';
  else if (groupBasah > groupKering && groupBasah > pNormal) dominantStatus = 'Cenderung Basah';

  // Forecast Logic
  let forecastDelta = 0;
  let forecastAvgTmat = 0;
  if (forecastData && currentWeek) {
      forecastDelta = parseFloat(forecastData.fit?.a || 0);
      forecastAvgTmat = parseFloat(currentWeek.avg_tmat) + forecastDelta;
  }

  // --- Chart Configurations ---
  const trendLabels = data?.weeklyData?.map(w => w.week.split(',')[0] + ' ' + w.week.split(',')[1].trim().slice(0,2)) || [];
  
  // Dual-Axis Chart Data
  const trendData = {
    labels: trendLabels,
    datasets: [
      {
        type: 'line',
        label: 'Avg TMAT (cm)',
        data: data?.weeklyData?.map(w => w.avg_tmat) || [],
        borderColor: '#3b82f6',
        backgroundColor: '#3b82f6',
        yAxisID: 'y1',
        borderWidth: 2,
        tension: 0.3,
        pointRadius: 4,
      },
      {
        type: 'bar',
        label: 'Total Hujan (mm)',
        data: trendLabels.map(label => {
            // label is like "W12 Mar" but pzoData.rainfall keys are like "W12, Mar-25"
            // We need to match the week.
            const fullWeekName = data?.weeklyData?.find(w => w.week.includes(label.split(' ')[0]))?.week;
            return (forecastData?.rawRainfall && fullWeekName) ? (forecastData.rawRainfall[fullWeekName] || 0) : 0;
        }), 
        backgroundColor: 'rgba(16, 185, 129, 0.3)',
        borderColor: 'rgba(16, 185, 129, 0.8)',
        borderWidth: 1,
        yAxisID: 'y',
        borderRadius: 4,
      }
    ]
  };

  const chartOptions = {
    responsive: true,
    maintainAspectRatio: false,
    interaction: { mode: 'index', intersect: false },
    scales: {
      x: { grid: { display: false } },
      y: { 
        type: 'linear', display: true, position: 'left',
        title: { display: true, text: 'Curah Hujan (mm)', font: { size: 10 } },
        grid: { color: '#f3f4f6' }
      },
      y1: { 
        type: 'linear', display: true, position: 'right',
        title: { display: true, text: 'TMAT (cm)', font: { size: 10 } },
        reverse: true, // TMAT: deeper is higher number, but visually we want deeper to go down? Or standard axis? Let's use reverse=true so 0 is top.
        grid: { drawOnChartArea: false }
      }
    },
    plugins: {
      legend: { position: 'top', labels: { usePointStyle: true, boxWidth: 6 } },
      tooltip: { backgroundColor: 'rgba(17, 24, 39, 0.9)' }
    }
  };

  const donutData = {
    labels: ['Banjir (<0)', 'Tergenang (0-40)', 'A Tergenang (41-45)', 'Normal (46-60)', 'A Kering (61-65)', 'Kering (>65)'],
    datasets: [{
      data: [pBanjir, pTergenang, pATergenang, pNormal, pAKering, pKering],
      backgroundColor: ['#000000', '#4170B0', '#1CB8E0', '#5A732A', '#FFFB00', '#FF0D0D'],
      borderWidth: 0,
      hoverOffset: 4
    }]
  };

  return (
    <div className="space-y-6">
      {/* Header & Filter */}
      <header className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold text-gray-900 tracking-tight">Command Center</h1>
          <p className="text-sm text-gray-600 mt-1">
            Ikhtisar Hidrologi &amp; Prediksi TMAT ({currentWeek ? currentWeek.week : 'Memuat...'})
          </p>
        </div>
        <div className="flex items-center gap-2">
          <label htmlFor="overview-company" className="text-xs font-semibold text-gray-700">
            Company
          </label>
          <select
            id="overview-company"
            className="h-11 py-2 px-3 rounded-xl border border-gray-300 bg-white text-sm font-medium text-gray-900"
            value={selectedCompany}
            onChange={(e) => setSelectedCompany(e.target.value)}
          >
            <option value="Semua">Seluruh Company</option>
            {companies.map(c => <option key={c.code} value={c.code}>{c.code}</option>)}
          </select>
        </div>
      </header>

      {loading ? (
        <div aria-live="polite" className="space-y-6">
          <p className="text-sm font-medium text-gray-700">Memuat data Command Center...</p>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {[1, 2, 3, 4].map((i) => (
              <div key={i} className="h-32 bg-white rounded-2xl border border-gray-200 animate-pulse" />
            ))}
          </div>
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            <div className="h-80 bg-white rounded-2xl border border-gray-200 animate-pulse lg:col-span-2" />
            <div className="h-80 bg-white rounded-2xl border border-gray-200 animate-pulse" />
          </div>
        </div>
      ) : error ? (
        <div role="alert" className="bg-red-50 text-red-900 p-4 rounded-2xl border border-red-300 flex items-center gap-2 text-sm font-medium">
          <AlertCircle className="w-5 h-5 shrink-0 text-red-700" aria-hidden="true" />
          <span>{error}</span>
        </div>
      ) : (
        <div className="space-y-6">
          {/* KPI Cards */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {/* TMAT KPI */}
            <div className="bg-white rounded-2xl p-5 border border-gray-200 shadow-xs flex flex-col justify-between">
              <div className="flex justify-between items-start gap-2">
                <span className="text-xs font-semibold text-gray-600 uppercase tracking-wide">Rata-rata TMAT</span>
                {tmatDiff !== 0 && (
                  <span className={`inline-flex items-center text-xs font-semibold px-2 py-0.5 rounded-md border tabular-nums ${isTmatWorse ? 'bg-red-50 text-red-800 border-red-200' : isTmatBetter ? 'bg-emerald-50 text-emerald-800 border-emerald-200' : 'bg-gray-100 text-gray-700 border-gray-200'}`}>
                    {isTmatWorse ? <ArrowDownRight className="w-3 h-3 mr-1" aria-hidden="true" /> : isTmatBetter ? <ArrowUpRight className="w-3 h-3 mr-1" aria-hidden="true" /> : null}
                    {Math.abs(tmatDiff)} cm
                  </span>
                )}
              </div>
              <div className="mt-3">
                <div className="flex items-baseline gap-1">
                  <span className="text-3xl font-bold text-gray-900 tabular-nums tracking-tight">{currentWeek?.avg_tmat || 0}</span>
                  <span className="text-sm font-medium text-gray-600">cm</span>
                </div>
                <p className="text-xs text-gray-600 mt-1">Minggu {currentWeek?.week || '-'}</p>
              </div>
            </div>

            {/* Rainfall KPI */}
            <div className="bg-white rounded-2xl p-5 border border-gray-200 shadow-xs flex flex-col justify-between">
              <div className="flex justify-between items-start gap-2">
                <span className="text-xs font-semibold text-gray-600 uppercase tracking-wide">Curah Hujan (Total)</span>
                <CloudRain className="w-4 h-4 text-gray-500 shrink-0" aria-hidden="true" />
              </div>
              <div className="mt-3">
                <div className="flex items-baseline gap-1">
                  <span className="text-3xl font-bold text-gray-900 tabular-nums tracking-tight">{currentRain.toFixed(1)}</span>
                  <span className="text-sm font-medium text-gray-600">mm</span>
                </div>
                <p className="text-xs text-gray-600 mt-1">Akumulasi seluruh estate</p>
              </div>
            </div>

            {/* Status KPI */}
            <div className="bg-white rounded-2xl p-5 border border-gray-200 shadow-xs flex flex-col justify-between">
              <div className="flex justify-between items-start gap-2">
                <span className="text-xs font-semibold text-gray-600 uppercase tracking-wide">Status Dominan</span>
                <span className="text-xs font-semibold bg-gray-100 text-gray-800 border border-gray-200 px-2 py-0.5 rounded-md tabular-nums">
                  {totalBlocks} Blok
                </span>
              </div>
              <div className="mt-3">
                <div className="text-2xl font-bold text-gray-900 truncate tracking-tight">{dominantStatus}</div>
                <p className="text-xs text-gray-600 mt-1">Distribusi kelas TMAT terkini</p>
              </div>
            </div>

            {/* Forecast KPI */}
            <div className="bg-white rounded-2xl p-5 border border-gray-300 shadow-xs flex flex-col justify-between">
              <div className="flex justify-between items-start gap-2">
                <span className="text-xs font-semibold text-gray-600 uppercase tracking-wide">Prediksi Minggu Depan</span>
                <span className="text-xs font-semibold bg-gray-900 text-white px-2 py-0.5 rounded-md">
                  Skenario 0mm
                </span>
              </div>
              <div className="mt-3">
                <div className="flex items-baseline gap-1">
                  <span className="text-3xl font-bold text-gray-900 tabular-nums tracking-tight">{forecastAvgTmat.toFixed(1)}</span>
                  <span className="text-sm font-medium text-gray-600">cm</span>
                </div>
                <div className="mt-1 text-xs text-gray-600 flex items-center gap-1 tabular-nums">
                  <ArrowRight className="w-3 h-3 shrink-0" aria-hidden="true" />
                  <span>Perubahan {(forecastDelta > 0 ? '+' : '')}{forecastDelta.toFixed(1)} cm</span>
                </div>
              </div>
            </div>
          </div>

          {/* Charts Row */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* Trend Line Chart */}
            <div className="bg-white rounded-2xl border border-gray-200 shadow-xs p-5 lg:col-span-2 flex flex-col">
              <div className="mb-4">
                <h2 className="text-base font-bold text-gray-900">Tren Curah Hujan &amp; TMAT (8 Minggu)</h2>
                <p className="text-xs text-gray-600 mt-0.5">Perbandingan rata-rata TMAT terhadap total curah hujan mingguan</p>
              </div>
              <div className="flex-1 min-h-[300px]">
                <Bar data={trendData} options={chartOptions} />
              </div>
            </div>

            {/* Donut Chart */}
            <div className="bg-white rounded-2xl border border-gray-200 shadow-xs p-5 flex flex-col justify-between">
              <div className="mb-4">
                <h2 className="text-base font-bold text-gray-900">Distribusi Status (Minggu Ini)</h2>
                <p className="text-xs text-gray-600 mt-0.5">Proporsi blok menurut kategori kedalaman TMAT</p>
              </div>
              <div className="flex-1 flex justify-center items-center min-h-[200px] relative">
                <Doughnut data={donutData} options={{ maintainAspectRatio: false, plugins: { legend: { display: false } }, cutout: '70%' }} />
                <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
                  <span className="text-3xl font-bold text-gray-900 tabular-nums">{pKering}%</span>
                  <span className="text-xs font-semibold text-red-700">Kering</span>
                </div>
              </div>
              <div className="mt-6 flex flex-col gap-2 text-sm">
                <div className="flex justify-between items-center"><div className="flex items-center text-gray-700"><span className="w-3 h-3 rounded-sm mr-2" style={{backgroundColor: '#000000'}}></span>Banjir</div><span className="font-semibold text-gray-900 tabular-nums">{pBanjir}%</span></div>
                <div className="flex justify-between items-center"><div className="flex items-center text-gray-700"><span className="w-3 h-3 rounded-sm mr-2" style={{backgroundColor: '#4170B0'}}></span>Tergenang</div><span className="font-semibold text-gray-900 tabular-nums">{pTergenang}%</span></div>
                <div className="flex justify-between items-center"><div className="flex items-center text-gray-700"><span className="w-3 h-3 rounded-sm mr-2" style={{backgroundColor: '#1CB8E0'}}></span>A Tergenang</div><span className="font-semibold text-gray-900 tabular-nums">{pATergenang}%</span></div>
                <div className="flex justify-between items-center"><div className="flex items-center text-gray-700"><span className="w-3 h-3 rounded-sm mr-2" style={{backgroundColor: '#5A732A'}}></span>Normal</div><span className="font-semibold text-gray-900 tabular-nums">{pNormal}%</span></div>
                <div className="flex justify-between items-center"><div className="flex items-center text-gray-700"><span className="w-3 h-3 rounded-sm mr-2 border border-gray-300" style={{backgroundColor: '#FFFB00'}}></span>A Kering</div><span className="font-semibold text-gray-900 tabular-nums">{pAKering}%</span></div>
                <div className="flex justify-between items-center"><div className="flex items-center text-gray-700"><span className="w-3 h-3 rounded-sm mr-2" style={{backgroundColor: '#FF0D0D'}}></span>Kering</div><span className="font-semibold text-gray-900 tabular-nums">{pKering}%</span></div>
              </div>
            </div>
          </div>

          {/* Tables Row */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 pb-4">
            {/* Last Rain Table */}
            <div className="bg-white rounded-2xl border border-gray-200 shadow-xs overflow-hidden flex flex-col">
              <div className="p-5 border-b border-gray-200 flex justify-between items-center">
                <h2 className="text-base font-bold text-gray-900 flex items-center gap-2">
                  <AlertCircle className="w-4 h-4 text-amber-700 shrink-0" aria-hidden="true" />
                  <span>Peringatan Kekeringan (Hari Sejak Hujan Terakhir)</span>
                </h2>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-sm text-left">
                  <thead className="bg-gray-50 text-gray-600 text-xs font-semibold uppercase tracking-wider border-b border-gray-200">
                    <tr>
                      <th className="px-5 py-3">Estate</th>
                      <th className="px-5 py-3">Tgl Hujan Terakhir</th>
                      <th className="px-5 py-3 text-right">Durasi (Hari)</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {data?.lastRainData?.slice(0, 10).map((r, i) => (
                      <tr key={i} className="hover:bg-gray-50 transition-colors">
                        <td className="px-5 py-3 font-medium text-gray-900">{r.est_code}</td>
                        <td className="px-5 py-3 text-gray-600">
                          {new Date(r.last_rain_date).toLocaleDateString('id-ID', { day: 'numeric', month: 'short' })}
                        </td>
                        <td className="px-5 py-3 text-right tabular-nums">
                          <span className={`font-bold ${r.days_since_rain > 7 ? 'text-red-700' : r.days_since_rain > 3 ? 'text-amber-700' : 'text-emerald-700'}`}>
                            {r.days_since_rain} Hari
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            {/* Estate Breakdown Table */}
            <div className="bg-white rounded-2xl border border-gray-200 shadow-xs overflow-hidden flex flex-col">
              <div className="p-5 border-b border-gray-200 flex justify-between items-center">
                <h2 className="text-base font-bold text-gray-900 flex items-center gap-2">
                  <Map className="w-4 h-4 text-gray-700 shrink-0" aria-hidden="true" />
                  <span>Breakdown TMAT Estate (Top 10 Terkering)</span>
                </h2>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-sm text-left">
                  <thead className="bg-gray-50 text-gray-600 text-xs font-semibold uppercase tracking-wider border-b border-gray-200">
                    <tr>
                      <th className="px-5 py-3">Estate</th>
                      <th className="px-5 py-3">Avg TMAT</th>
                      <th className="px-5 py-3 text-right">Blok Kering</th>
                      <th className="px-5 py-3 text-right">Blok Banjir</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {data?.estateBreakdown?.slice(0, 10).map((r, i) => (
                      <tr key={i} className="hover:bg-gray-50 transition-colors">
                        <td className="px-5 py-3 font-medium text-gray-900">{r.estate}</td>
                        <td className="px-5 py-3 font-semibold text-gray-800 tabular-nums">{r.avg_tmat} cm</td>
                        <td className="px-5 py-3 text-right text-red-700 font-semibold tabular-nums">{r.cnt_kering}</td>
                        <td className="px-5 py-3 text-right text-blue-700 font-semibold tabular-nums">{r.cnt_banjir}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
