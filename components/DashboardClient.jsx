"use client";

import { useState, useEffect, useCallback } from 'react';
import { RefreshCw, Droplets, Activity, Building2, CloudRain, AlertTriangle, CheckCircle, Database, CalendarDays } from 'lucide-react';
import SearchableSelect from './SearchableSelect';
import { Chart as ChartJS, CategoryScale, LinearScale, PointElement, LineElement, BarElement, ArcElement, Title, Tooltip, Legend, LineController, BarController, DoughnutController } from 'chart.js';
import { Bar, Line, Doughnut } from 'react-chartjs-2';

ChartJS.register(CategoryScale, LinearScale, PointElement, LineElement, BarElement, ArcElement, Title, Tooltip, Legend, LineController, BarController, DoughnutController);

const COMPANIES = ['Semua', 'PT.THIP', 'PT.PTW', 'PT.SUMS', 'PT.WKN', 'PT.PANPS', 'PT.SAM', 'PT.NJP', 'PT.PLDK', 'PT.SUMK', 'PT.BAS', 'PT.AAN', 'PT.GAN', 'PT.AJP', 'PT.JJP', 'PT.SIP', 'PT.WSM'];

// Format YYYY-MM-DD → DD-MM-YYYY
function fmtDate(str) {
    if (!str) return '';
    const [y, m, d] = str.split('-');
    return `${d}-${m}-${y}`;
}

const CLASS_COLORS = {
    'Banjir': '#71717A', 'Tergenang': '#1D4ED8', 'A Tergenang': '#60A5FA',
    'Normal': '#22C55E', 'A Kering': '#F59E0B', 'Kering': '#EF4444'
};

function StatCard({ label, value, sub, icon, color = 'black', loading }) {
    return (
        <div className="glass-card p-5 flex flex-col gap-3">
            <div className="flex items-start justify-between">
                <span className="text-xs font-semibold text-gray-500 uppercase tracking-wider">{label}</span>
                <div className={`w-8 h-8 rounded-lg flex items-center justify-center`} style={{ background: `${color}15` }}>
                    <span style={{ color }}>{icon}</span>
                </div>
            </div>
            {loading ? (
                <div className="h-8 w-24 bg-gray-100 animate-pulse rounded-lg" />
            ) : (
                <div>
                    <div className="text-3xl font-bold text-gray-900 tracking-tight">{value ?? '–'}</div>
                    {sub && <div className="text-xs text-gray-500 mt-0.5">{sub}</div>}
                </div>
            )}
        </div>
    );
}

// Panah indikator delta TMAT:
// Nilai negatif = TMAT turun = air naik = BAIK (hijau ↑)
// Nilai positif = TMAT naik = air turun = BURUK (merah ↓)
function TrendArrow({ delta }) {
    if (delta === null || delta === undefined) return null;
    const isGood = parseFloat(delta) < 0;
    const isNeutral = parseFloat(delta) === 0;
    if (isNeutral) return <span className="text-gray-400 text-xs">→ {delta} cm dari minggu lalu</span>;
    return (
        <span className={`flex items-center gap-0.5 text-xs font-medium ${ isGood ? 'text-green-600' : 'text-red-500' }`}>
            {isGood
                ? <svg width="10" height="10" viewBox="0 0 10 10"><polygon points="5,0 10,10 0,10" fill="currentColor"/></svg>
                : <svg width="10" height="10" viewBox="0 0 10 10"><polygon points="0,0 10,0 5,10" fill="currentColor"/></svg>
            }
            {delta > 0 ? '+' : ''}{delta} cm dari minggu lalu
        </span>
    );
}

function classifyStatus(avgTmat) {
    if (!avgTmat) return { label: 'No Data', color: '#B0B8C2', range: '–' };
    if (avgTmat < 0)   return { label: 'Banjir',      color: '#71717A', range: '< 0 cm' };
    if (avgTmat <= 40) return { label: 'Tergenang',   color: '#1D4ED8', range: '0 – 40 cm' };
    if (avgTmat <= 45) return { label: 'A Tergenang', color: '#60A5FA', range: '41 – 45 cm' };
    if (avgTmat <= 60) return { label: 'Normal',      color: '#22C55E', range: '46 – 60 cm' };
    if (avgTmat <= 65) return { label: 'A Kering',    color: '#F59E0B', range: '61 – 65 cm' };
    return              { label: 'Kering',      color: '#EF4444', range: '> 65 cm' };
}

export default function DashboardClient() {
    const [company, setCompany] = useState('Semua');
    const [week, setWeek] = useState(''); // formatted_name, empty = latest
    const [weekList, setWeekList] = useState([]); // list from calendar_weeks
    const [data, setData] = useState(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);

    // Fetch available weeks from calendar_weeks
    useEffect(() => {
        fetch('/api/calendar-weeks')
            .then(r => r.json())
            .then(json => {
                if (json.weeks && json.weeks.length > 0) {
                    setWeekList(json.weeks);
                    // Default: latest week (last item since sorted ASC)
                    setWeek(json.weeks[json.weeks.length - 1].formatted_name);
                }
            })
            .catch(() => {});
    }, []);

    const fetchData = useCallback(async (selectedCompany, selectedWeek) => {
        setLoading(true);
        setError(null);
        try {
            const params = new URLSearchParams({ company: selectedCompany });
            if (selectedWeek) params.set('week', selectedWeek);
            const res = await fetch(`/api/dashboard-summary?${params}`);
            if (!res.ok) throw new Error(`Gagal memuat data: ${res.status}`);
            const json = await res.json();
            if (json.error) throw new Error(json.error);
            setData(json);
        } catch (e) {
            setError(e.message);
        } finally {
            setLoading(false);
        }
    }, []);

    // Fetch whenever company or week changes (skip if week not yet loaded)
    useEffect(() => {
        if (week !== null) fetchData(company, week);
    }, [company, week, fetchData]);

    const cw = data?.currentWeek;
    const pw = data?.prevWeek;

    const tmatDelta = (cw && pw) ? (cw.avg_tmat - pw.avg_tmat).toFixed(1) : null;
    const status = classifyStatus(cw?.avg_tmat);

    // --- Chart Datasets ---
    const trendChartData = data?.weeklyData ? {
        labels: data.weeklyData.map(w => w.week),
        datasets: [{
            type: 'line',
            label: 'Avg TMAT (cm)',
            data: data.weeklyData.map(w => w.avg_tmat),
            borderColor: '#111827', backgroundColor: '#111827',
            tension: 0.4, pointRadius: 4, yAxisID: 'y', order: 1
        }, {
            type: 'bar',
            label: 'Total Records',
            data: data.weeklyData.map(w => w.total),
            backgroundColor: 'rgba(34,197,94,0.2)', borderColor: 'rgba(34,197,94,0.5)',
            borderWidth: 1, yAxisID: 'y1', order: 2
        }]
    } : null;

    const distChartData = cw ? {
        labels: [
            `Banjir <0cm (${cw.cnt_banjir})`,
            `Tergenang 0-40cm (${cw.cnt_tergenang})`,
            `A Tergenang 41-45cm (${cw.cnt_a_tergenang})`,
            `Normal 46-60cm (${cw.cnt_normal})`,
            `A Kering 61-65cm (${cw.cnt_a_kering})`,
            `Kering >65cm (${cw.cnt_kering})`
        ],
        datasets: [{
            data: [cw.cnt_banjir, cw.cnt_tergenang, cw.cnt_a_tergenang, cw.cnt_normal, cw.cnt_a_kering, cw.cnt_kering],
            backgroundColor: Object.values(CLASS_COLORS),
            borderWidth: 2, borderColor: '#fff',
            hoverOffset: 8
        }]
    } : null;

    return (
        <div className="space-y-6">
            {/* Header */}
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div>
                    <div className="flex items-baseline gap-3 flex-wrap">
                        <h1 className="text-3xl font-bold tracking-tight text-gray-900">Dashboard</h1>
                        {cw && (
                            <span className="text-sm font-normal text-gray-400">
                                ({cw.week})&nbsp;
                                {cw.week_start && cw.week_end
                                    ? `${fmtDate(cw.week_start)} – ${fmtDate(cw.week_end)}`
                                    : ''}
                            </span>
                        )}
                    </div>
                    <p className="text-sm text-gray-500 mt-1">Monitoring kondisi piezometer &amp; curah hujan secara real-time.</p>
                </div>
                <div className="flex items-center gap-2 flex-wrap">
                    {/* Week Filter */}
                    <SearchableSelect
                        icon={<CalendarDays size={14} />}
                        options={weekList.map(w => ({ value: w.formatted_name, label: w.formatted_name }))}
                        value={week}
                        onChange={setWeek}
                        placeholder="Pilih Minggu..."
                        disabled={weekList.length === 0}
                        className="min-w-[180px]"
                        autoSort={false}
                    />
                    {/* Company Filter */}
                    <SearchableSelect
                        icon={<Building2 size={14} />}
                        options={COMPANIES}
                        value={company}
                        onChange={setCompany}
                        placeholder="Pilih Company..."
                        className="min-w-[150px]"
                    />
                    <button
                        onClick={() => fetchData(company, week)}
                        disabled={loading}
                        className="p-2 rounded-xl border border-gray-200 bg-white/70 hover:bg-white transition-colors disabled:opacity-50"
                    >
                        <RefreshCw size={16} className={loading ? 'animate-spin text-gray-400' : 'text-gray-600'} />
                    </button>
                </div>
            </div>

            {error && (
                <div className="bg-red-50 border border-red-200 text-red-700 text-sm px-4 py-3 rounded-xl flex items-center gap-2">
                    <AlertTriangle size={16} /> {error}
                </div>
            )}

            {/* Stat Cards */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <StatCard
                    label="Avg TMAT Minggu Ini"
                    value={cw ? `${cw.avg_tmat} cm` : '–'}
                    sub={<TrendArrow delta={tmatDelta} />}
                    icon={<Activity size={16} />}
                    color={status.color}
                    loading={loading}
                />
                <StatCard
                    label="Status Dominan"
                    value={status.label}
                    sub={`${status.range} · ${cw?.week ?? '–'}`}
                    icon={<CheckCircle size={16} />}
                    color={status.color}
                    loading={loading}
                />
                <StatCard
                    label="Jumlah Piezometer"
                    value={cw?.total?.toLocaleString('id-ID') ?? '–'}
                    sub={`${data?.syncInfo?.total_estates ?? '–'} Estate`}
                    icon={<Droplets size={16} />}
                    color="#1D4ED8"
                    loading={loading}
                />
                <StatCard
                    label="Piezometer Kering (>65cm)"
                    value={cw ? `${(((cw.cnt_kering) / cw.total) * 100).toFixed(1)}%` : '–'}
                    sub={`${cw?.cnt_kering ?? 0} titik`}
                    icon={<AlertTriangle size={16} />}
                    color="#EF4444"
                    loading={loading}
                />
            </div>

            {/* Charts Row */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                {/* Trend Chart - spans 2 cols */}
                <div className="glass-card p-5 lg:col-span-2 flex flex-col">
                    <h3 className="text-sm font-bold text-gray-800 mb-1">Trend Rata-rata TMAT & Volume Data</h3>
                    <p className="text-xs text-gray-400 mb-4">8 Minggu terakhir</p>
                    <div className="flex-1 relative" style={{ minHeight: '240px' }}>
                        {loading ? (
                            <div className="absolute inset-0 flex items-center justify-center">
                                <RefreshCw size={24} className="animate-spin text-gray-300" />
                            </div>
                        ) : trendChartData ? (
                            <Bar data={trendChartData} options={{
                                responsive: true, maintainAspectRatio: false,
                                interaction: { mode: 'index', intersect: false },
                                plugins: { legend: { position: 'top', labels: { usePointStyle: true, boxWidth: 8, font: { size: 11 } } } },
                                scales: {
                                    y: { position: 'left', title: { display: true, text: 'Avg TMAT (cm)', font: { size: 10 } } },
                                    y1: { position: 'right', grid: { drawOnChartArea: false }, title: { display: true, text: 'Jumlah Titik', font: { size: 10 } } }
                                }
                            }} />
                        ) : (
                            <div className="absolute inset-0 flex items-center justify-center text-sm text-gray-400">Tidak ada data</div>
                        )}
                    </div>
                </div>

                {/* Donut Distribution */}
                <div className="glass-card p-5 flex flex-col">
                    <h3 className="text-sm font-bold text-gray-800 mb-1">Distribusi TMAT</h3>
                    <p className="text-xs text-gray-400 mb-4">{cw?.week ?? 'Minggu terkini'}</p>
                    <div className="flex-1 relative flex items-center justify-center" style={{ minHeight: '240px' }}>
                        {loading ? (
                            <RefreshCw size={24} className="animate-spin text-gray-300" />
                        ) : distChartData ? (
                            <Doughnut data={distChartData} options={{
                                responsive: true, maintainAspectRatio: false, cutout: '65%',
                                plugins: {
                                    legend: { position: 'right', labels: { usePointStyle: true, boxWidth: 8, font: { size: 10 } } }
                                }
                            }} />
                        ) : (
                            <span className="text-sm text-gray-400">Tidak ada data</span>
                        )}
                    </div>
                </div>
            </div>

            {/* Bottom Row: Estate Table + Rainfall */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                {/* Top Estate by Kering */}
                <div className="glass-card overflow-hidden">
                    <div className="p-5 border-b border-gray-100">
                        <h3 className="text-sm font-bold text-gray-800">Estate Paling Kering (Minggu Ini)</h3>
                        <p className="text-xs text-gray-400 mt-0.5">Diurutkan berdasarkan % Piezometer Kering &gt; 65cm</p>
                    </div>
                    <div className="overflow-auto max-h-72">
                        {loading ? (
                            <div className="p-6 space-y-3">
                                {[1,2,3].map(i => <div key={i} className="h-8 bg-gray-100 animate-pulse rounded-lg" />)}
                            </div>
                        ) : (data?.estateBreakdown?.length > 0) ? (
                            <table className="w-full text-sm">
                                <thead className="bg-gray-50/50 text-xs text-gray-500 uppercase tracking-wider">
                                    <tr>
                                        <th className="px-4 py-3 text-left">Estate</th>
                                        <th className="px-4 py-3 text-right">Avg TMAT</th>
                                        <th className="px-4 py-3 text-right">Kering</th>
                                        <th className="px-4 py-3 text-right">Total</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-gray-100">
                                    {data.estateBreakdown
                                        .sort((a, b) => {
                                            const pctA = a.total > 0 ? (a.cnt_kering / a.total) : 0;
                                            const pctB = b.total > 0 ? (b.cnt_kering / b.total) : 0;
                                            if (pctB !== pctA) return pctB - pctA;
                                            return a.estate.localeCompare(b.estate, undefined, { numeric: true, sensitivity: 'base' });
                                        })
                                        .map((e, i) => {
                                            const pct = e.total > 0 ? ((e.cnt_kering / e.total) * 100).toFixed(0) : 0;
                                            const st = classifyStatus(e.avg_tmat);
                                            return (
                                                <tr key={i} className="hover:bg-white/60 transition-colors">
                                                    <td className="px-4 py-3">
                                                        <div className="font-semibold text-gray-800 text-xs">{e.estate}</div>
                                                        <div className="text-[10px] text-gray-400">{e.company}</div>
                                                    </td>
                                                <td className="px-4 py-3 text-right">
                                                    <span className="text-xs font-bold px-2 py-0.5 rounded-full" style={{ background: `${st.color}20`, color: st.color }}>
                                                        {e.avg_tmat} cm
                                                    </span>
                                                </td>
                                                <td className="px-4 py-3 text-right">
                                                    <div className="flex items-center justify-end gap-1">
                                                        <div className="w-12 bg-gray-100 rounded-full h-1.5">
                                                            <div className="h-1.5 rounded-full bg-red-400" style={{ width: `${Math.min(pct, 100)}%` }} />
                                                        </div>
                                                        <span className="text-xs text-gray-600">{pct}%</span>
                                                    </div>
                                                </td>
                                                <td className="px-4 py-3 text-right text-xs text-gray-500">{e.total}</td>
                                            </tr>
                                        );
                                    })}
                                </tbody>
                            </table>
                        ) : (
                            <p className="text-sm text-gray-400 p-6 text-center">Tidak ada data estate.</p>
                        )}
                    </div>
                </div>

                {/* Rainfall Summary */}
                <div className="glass-card overflow-hidden">
                    <div className="p-5 border-b border-gray-100">
                        <h3 className="text-sm font-bold text-gray-800">Curah Hujan Periode Minggu Ini</h3>
                        <p className="text-xs text-gray-400 mt-0.5">
                            {data?.rainfallWeekStart && data?.rainfallWeekEnd
                                ? `${data.rainfallWeekStart} s/d ${data.rainfallWeekEnd}`
                                : 'Periode minggu piezometer terkini'}
                        </p>
                    </div>
                    <div className="overflow-auto max-h-72">
                        {loading ? (
                            <div className="p-6 space-y-3">
                                {[1,2,3].map(i => <div key={i} className="h-8 bg-gray-100 animate-pulse rounded-lg" />)}
                            </div>
                        ) : (data?.rainfallData?.length > 0) ? (
                            <table className="w-full text-sm">
                                <thead className="bg-gray-50/50 text-xs text-gray-500 uppercase tracking-wider">
                                    <tr>
                                        <th className="px-4 py-3 text-left">Estate</th>
                                        <th className="px-4 py-3 text-right">Total CH</th>
                                        <th className="px-4 py-3 text-right">Hari Hujan</th>
                                        <th className="px-4 py-3 text-right">Avg Harian</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-gray-100">
                                    {data.rainfallData
                                        .sort((a, b) => {
                                            if (b.total_mm !== a.total_mm) return b.total_mm - a.total_mm;
                                            return a.est_code.localeCompare(b.est_code, undefined, { numeric: true, sensitivity: 'base' });
                                        })
                                        .map((r, i) => {
                                        const maxRain = Math.max(...data.rainfallData.map(d => d.total_mm));
                                        const pct = maxRain > 0 ? (r.total_mm / maxRain * 100) : 0;
                                        return (
                                            <tr key={i} className="hover:bg-white/60 transition-colors">
                                                <td className="px-4 py-3">
                                                    <div className="font-semibold text-gray-800 text-xs">{r.est_code || '–'}</div>
                                                    <div className="text-[10px] text-gray-400">{r.company_code}</div>
                                                </td>
                                                <td className="px-4 py-3 text-right">
                                                    <div className="flex items-center justify-end gap-1">
                                                        <div className="w-12 bg-gray-100 rounded-full h-1.5">
                                                            <div className="h-1.5 rounded-full bg-blue-400" style={{ width: `${pct}%` }} />
                                                        </div>
                                                        <span className="text-xs font-semibold text-gray-700">{r.total_mm} mm</span>
                                                    </div>
                                                </td>
                                                <td className="px-4 py-3 text-right">
                                                    <div className="flex items-center justify-end gap-1">
                                                        <div className="w-12 bg-gray-100 rounded-full h-1.5">
                                                            <div className="h-1.5 rounded-full bg-blue-600" style={{ width: `${(r.hari_hujan / (r.total_hari || 14)) * 100}%` }} />
                                                        </div>
                                                        <span className="text-xs font-semibold text-blue-700">{r.hari_hujan}<span className="text-gray-400 font-normal">/{r.total_hari}</span></span>
                                                    </div>
                                                </td>
                                                <td className="px-4 py-3 text-right text-xs text-gray-500">{r.avg_daily_mm} mm/hari</td>
                                            </tr>
                                        );
                                    })}
                                </tbody>
                            </table>
                        ) : (
                            <div className="p-6 text-center">
                                <CloudRain size={32} className="mx-auto text-gray-200 mb-2" />
                                <p className="text-sm text-gray-400">Data curah hujan belum tersedia.</p>
                                <p className="text-xs text-gray-300 mt-1">Jalankan Sync Rainfall untuk mengisi data.</p>
                            </div>
                        )}
                    </div>
                </div>
            </div>

            {/* DB Sync Status Footer */}
            {data?.syncInfo && (
                <div className="flex items-center gap-3 px-4 py-3 bg-white/50 rounded-xl border border-gray-100 text-xs text-gray-500">
                    <Database size={14} className="text-gray-400" />
                    <span>Total di DB: <strong className="text-gray-700">{data.syncInfo.total_records?.toLocaleString('id-ID')}</strong> record</span>
                    <span>·</span>
                    <span><strong className="text-gray-700">{data.syncInfo.total_companies}</strong> Company</span>
                    <span>·</span>
                    <span><strong className="text-gray-700">{data.syncInfo.total_estates}</strong> Estate</span>
                </div>
            )}
        </div>
    );
}
