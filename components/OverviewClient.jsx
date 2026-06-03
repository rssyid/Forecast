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
import Topbar from './Topbar';
import Sidebar from './Sidebar';

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
    fetch('/api/companies')
      .then(r => r.json())
      .then(d => setCompanies(d.data || []))
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
  
  // Status Distribution
  const totalBlocks = currentWeek?.total_block || 0;
  const pKering = totalBlocks ? Math.round(((currentWeek?.cnt_kering || 0) + (currentWeek?.cnt_a_kering || 0)) / totalBlocks * 100) : 0;
  const pBanjir = totalBlocks ? Math.round(((currentWeek?.cnt_banjir || 0) + (currentWeek?.cnt_tergenang || 0) + (currentWeek?.cnt_a_tergenang || 0)) / totalBlocks * 100) : 0;
  const pNormal = totalBlocks ? Math.round((currentWeek?.cnt_normal || 0) / totalBlocks * 100) : 0;
  
  let dominantStatus = 'Normal';
  if (pKering > pBanjir && pKering > pNormal) dominantStatus = 'Cenderung Kering';
  else if (pBanjir > pKering && pBanjir > pNormal) dominantStatus = 'Cenderung Basah';

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
    labels: ['Banjir & Tergenang', 'Normal', 'Kering & Agak Kering'],
    datasets: [{
      data: [pBanjir, pNormal, pKering],
      backgroundColor: ['#3b82f6', '#10b981', '#ef4444'],
      borderWidth: 0,
      hoverOffset: 4
    }]
  };

  return (
    <div className="flex h-screen bg-slate-50 text-slate-800 font-sans overflow-hidden">
      <Sidebar />
      <div className="flex-1 flex flex-col h-screen overflow-hidden">
        <Topbar />
        <main className="flex-1 overflow-y-auto p-4 md:p-6 lg:p-8 scroll-smooth">
          
          {/* Header & Filter */}
          <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-8 gap-4">
            <div>
              <h1 className="text-2xl font-bold text-slate-900 tracking-tight">Command Center</h1>
              <p className="text-sm text-slate-500 mt-1">
                Ikhtisar Hidrologi & Prediksi TMAT ({currentWeek ? currentWeek.week : 'Memuat...'})
              </p>
            </div>
            <div className="flex items-center gap-3 bg-white p-2 rounded-xl shadow-sm border border-slate-100">
              <Map className="w-4 h-4 text-slate-400 ml-2" />
              <select 
                className="bg-transparent border-none text-sm font-medium focus:ring-0 cursor-pointer pr-8"
                value={selectedCompany}
                onChange={(e) => setSelectedCompany(e.target.value)}
              >
                <option value="Semua">Seluruh Company</option>
                {companies.map(c => <option key={c.code} value={c.code}>{c.name}</option>)}
              </select>
            </div>
          </div>

          {loading ? (
            <div className="flex h-64 items-center justify-center">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
            </div>
          ) : error ? (
            <div className="bg-red-50 text-red-600 p-4 rounded-xl border border-red-100 flex items-center">
              <AlertCircle className="w-5 h-5 mr-2" /> {error}
            </div>
          ) : (
            <div className="space-y-6">
              
              {/* KPI Cards */}
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                
                {/* TMAT KPI */}
                <div className="bg-white rounded-2xl p-5 border border-slate-100 shadow-sm hover:shadow-md transition-all">
                  <div className="flex justify-between items-start">
                    <div className="p-2 bg-blue-50 text-blue-600 rounded-lg">
                      <Waves className="w-5 h-5" />
                    </div>
                    {tmatDiff !== 0 && (
                      <span className={`flex items-center text-xs font-semibold px-2 py-1 rounded-full ${isTmatWorse ? 'bg-red-100 text-red-700' : isTmatBetter ? 'bg-emerald-100 text-emerald-700' : 'bg-slate-100 text-slate-600'}`}>
                        {isTmatWorse ? <ArrowDownRight className="w-3 h-3 mr-1" /> : isTmatBetter ? <ArrowUpRight className="w-3 h-3 mr-1" /> : null}
                        {Math.abs(tmatDiff)} cm
                      </span>
                    )}
                  </div>
                  <div className="mt-4">
                    <h3 className="text-slate-500 text-xs font-medium uppercase tracking-wider">Rata-rata TMAT</h3>
                    <div className="flex items-baseline mt-1">
                      <span className="text-3xl font-bold text-slate-900">{currentWeek?.avg_tmat || 0}</span>
                      <span className="text-sm font-medium text-slate-500 ml-1">cm</span>
                    </div>
                  </div>
                </div>

                {/* Rainfall KPI */}
                <div className="bg-white rounded-2xl p-5 border border-slate-100 shadow-sm hover:shadow-md transition-all">
                  <div className="flex justify-between items-start">
                    <div className="p-2 bg-emerald-50 text-emerald-600 rounded-lg">
                      <CloudRain className="w-5 h-5" />
                    </div>
                  </div>
                  <div className="mt-4">
                    <h3 className="text-slate-500 text-xs font-medium uppercase tracking-wider">Curah Hujan (Total Semua)</h3>
                    <div className="flex items-baseline mt-1">
                      <span className="text-3xl font-bold text-slate-900">{currentRain.toFixed(1)}</span>
                      <span className="text-sm font-medium text-slate-500 ml-1">mm</span>
                    </div>
                  </div>
                </div>

                {/* Status KPI */}
                <div className="bg-white rounded-2xl p-5 border border-slate-100 shadow-sm hover:shadow-md transition-all">
                  <div className="flex justify-between items-start">
                    <div className="p-2 bg-purple-50 text-purple-600 rounded-lg">
                      <Activity className="w-5 h-5" />
                    </div>
                    <span className="text-xs font-medium bg-purple-100 text-purple-700 px-2 py-1 rounded-full">
                      {totalBlocks} Blok
                    </span>
                  </div>
                  <div className="mt-4">
                    <h3 className="text-slate-500 text-xs font-medium uppercase tracking-wider">Status Dominan</h3>
                    <div className="flex items-baseline mt-1">
                      <span className="text-xl font-bold text-slate-900 truncate">{dominantStatus}</span>
                    </div>
                  </div>
                </div>

                {/* Forecast KPI */}
                <div className="bg-gradient-to-br from-slate-900 to-slate-800 rounded-2xl p-5 shadow-lg border border-slate-700 text-white relative overflow-hidden group">
                  <div className="absolute top-0 right-0 p-3 opacity-20 group-hover:scale-110 transition-transform duration-500">
                    <TrendingUp className="w-16 h-16" />
                  </div>
                  <div className="flex justify-between items-start relative z-10">
                    <div className="p-2 bg-white/10 rounded-lg">
                      <Activity className="w-5 h-5" />
                    </div>
                    <span className="text-xs font-medium bg-white/20 px-2 py-1 rounded-full backdrop-blur-sm">
                      Skenario 0mm
                    </span>
                  </div>
                  <div className="mt-4 relative z-10">
                    <h3 className="text-slate-400 text-xs font-medium uppercase tracking-wider">Prediksi Minggu Depan</h3>
                    <div className="flex items-baseline mt-1">
                      <span className="text-3xl font-bold text-white">{forecastAvgTmat.toFixed(1)}</span>
                      <span className="text-sm font-medium text-slate-400 ml-1">cm</span>
                    </div>
                    <div className="mt-1 text-xs text-slate-300 flex items-center">
                      <ArrowRight className="w-3 h-3 mr-1" />
                      Berubah {(forecastDelta > 0 ? '+' : '')}{forecastDelta.toFixed(1)} cm
                    </div>
                  </div>
                </div>

              </div>

              {/* Charts Row */}
              <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                
                {/* Trend Line Chart */}
                <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-5 lg:col-span-2 flex flex-col">
                  <div className="flex justify-between items-center mb-4">
                    <h2 className="text-base font-bold text-slate-900">Tren Curah Hujan & TMAT (8 Minggu)</h2>
                  </div>
                  <div className="flex-1 min-h-[300px]">
                    <Bar data={trendData} options={chartOptions} />
                  </div>
                </div>

                {/* Donut Chart */}
                <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-5 flex flex-col justify-between">
                  <div className="mb-4">
                    <h2 className="text-base font-bold text-slate-900">Distribusi Status (Minggu Ini)</h2>
                  </div>
                  <div className="flex-1 flex justify-center items-center min-h-[200px] relative">
                     <Doughnut data={donutData} options={{ maintainAspectRatio: false, plugins: { legend: { display: false } }, cutout: '70%' }} />
                     <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
                       <span className="text-3xl font-bold text-slate-900">{pKering}%</span>
                       <span className="text-xs font-medium text-red-500">Kering</span>
                     </div>
                  </div>
                  <div className="mt-6 flex flex-col gap-2 text-sm">
                    <div className="flex justify-between items-center"><div className="flex items-center"><span className="w-3 h-3 rounded-full bg-blue-500 mr-2"></span>Banjir/Tergenang</div><span className="font-semibold">{pBanjir}%</span></div>
                    <div className="flex justify-between items-center"><div className="flex items-center"><span className="w-3 h-3 rounded-full bg-emerald-500 mr-2"></span>Normal</div><span className="font-semibold">{pNormal}%</span></div>
                    <div className="flex justify-between items-center"><div className="flex items-center"><span className="w-3 h-3 rounded-full bg-red-500 mr-2"></span>Kering/Agak Kering</div><span className="font-semibold">{pKering}%</span></div>
                  </div>
                </div>

              </div>

              {/* Tables Row */}
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 pb-8">
                
                {/* Last Rain Table */}
                <div className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden flex flex-col">
                  <div className="p-5 border-b border-slate-100 flex justify-between items-center bg-slate-50/50">
                    <h2 className="text-base font-bold text-slate-900 flex items-center">
                      <AlertCircle className="w-4 h-4 mr-2 text-amber-500" />
                      Peringatan Kekeringan (Hari Sejak Hujan Terakhir)
                    </h2>
                  </div>
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm text-left">
                      <thead className="bg-slate-50 text-slate-500 text-xs uppercase tracking-wider">
                        <tr>
                          <th className="px-5 py-3">Estate</th>
                          <th className="px-5 py-3">Tgl Hujan Terakhir</th>
                          <th className="px-5 py-3 text-right">Durasi (Hari)</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100">
                        {data?.lastRainData?.slice(0, 10).map((r, i) => (
                          <tr key={i} className="hover:bg-slate-50/50 transition-colors">
                            <td className="px-5 py-3 font-medium text-slate-900">{r.est_code}</td>
                            <td className="px-5 py-3 text-slate-600">
                                {new Date(r.last_rain_date).toLocaleDateString('id-ID', { day: 'numeric', month: 'short' })}
                            </td>
                            <td className="px-5 py-3 text-right">
                              <span className={`font-bold ${r.days_since_rain > 7 ? 'text-red-600' : r.days_since_rain > 3 ? 'text-amber-500' : 'text-emerald-600'}`}>
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
                <div className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden flex flex-col">
                  <div className="p-5 border-b border-slate-100 flex justify-between items-center bg-slate-50/50">
                    <h2 className="text-base font-bold text-slate-900 flex items-center">
                      <Map className="w-4 h-4 mr-2 text-blue-500" />
                      Breakdown TMAT Estate (Top 10 Terkering)
                    </h2>
                  </div>
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm text-left">
                      <thead className="bg-slate-50 text-slate-500 text-xs uppercase tracking-wider">
                        <tr>
                          <th className="px-5 py-3">Estate</th>
                          <th className="px-5 py-3">Avg TMAT</th>
                          <th className="px-5 py-3 text-right">Blok Kering</th>
                          <th className="px-5 py-3 text-right">Blok Banjir</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100">
                        {data?.estateBreakdown?.slice(0, 10).map((r, i) => (
                          <tr key={i} className="hover:bg-slate-50/50 transition-colors">
                            <td className="px-5 py-3 font-medium text-slate-900">{r.estate}</td>
                            <td className="px-5 py-3 font-semibold text-slate-700">{r.avg_tmat} cm</td>
                            <td className="px-5 py-3 text-right text-red-600 font-medium">{r.cnt_kering}</td>
                            <td className="px-5 py-3 text-right text-blue-600 font-medium">{r.cnt_basah}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>

              </div>

            </div>
          )}
        </main>
      </div>
    </div>
  );
}
