"use client";

import { useState, useEffect, useCallback, useMemo } from 'react';
import { RefreshCw, Droplets, Activity, Building2, CloudRain, AlertTriangle, CheckCircle, Database, CalendarDays } from 'lucide-react';
import SearchableSelect from './SearchableSelect';
import { rankEstatesByDryness, rankEstatesByWetness } from '../lib/estateRanking';
import { Chart as ChartJS, CategoryScale, LinearScale, PointElement, LineElement, BarElement, ArcElement, Title, Tooltip, Legend, LineController, BarController, DoughnutController } from 'chart.js';
import { Bar, Line, Doughnut } from 'react-chartjs-2';

ChartJS.register(CategoryScale, LinearScale, PointElement, LineElement, BarElement, ArcElement, Title, Tooltip, Legend, LineController, BarController, DoughnutController);

// Format YYYY-MM-DD → DD-MM-YYYY
function fmtDate(str) {
    if (!str) return '';
    const [y, m, d] = str.split('-');
    return `${d}-${m}-${y}`;
}

// Format YYYY-MM-DD HH:mm
const fmtDateTime = (str) => {
    if (!str) return '–';
    try {
        const d = new Date(str);
        if (isNaN(d.getTime())) return '–';
        return d.toLocaleString('id-ID', { 
            day: '2-digit', month: 'short', year: 'numeric', 
            hour: '2-digit', minute: '2-digit' 
        });
    } catch { return '–'; }
};

const CLASS_COLORS = {
    'Banjir': '#71717A', 'Tergenang': '#1D4ED8', 'A Tergenang': '#60A5FA',
    'Normal': '#22C55E', 'A Kering': '#F59E0B', 'Kering': '#EF4444'
};

function StatCard({ label, value, sub, icon, color = '#111827', loading }) {
    return (
        <div className="bg-white rounded-2xl border border-gray-200 p-5 flex flex-col gap-3 shadow-xs">
            <div className="flex items-start justify-between gap-2">
                <span className="text-xs font-semibold text-gray-600 uppercase tracking-wide">{label}</span>
                <div className="w-8 h-8 rounded-lg flex items-center justify-center shrink-0" style={{ background: `${color}15` }}>
                    <span style={{ color }} aria-hidden="true">{icon}</span>
                </div>
            </div>
            {loading ? (
                <div className="h-8 w-24 bg-gray-100 animate-pulse rounded-lg" />
            ) : (
                <div>
                    <div className="text-2xl sm:text-[26px] font-bold text-gray-900 tracking-tight tabular-nums leading-snug">{value ?? '–'}</div>
                    {sub && <div className="text-xs text-gray-600 mt-0.5">{sub}</div>}
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
    if (isNeutral) return <span className="text-gray-600 text-xs tabular-nums">→ {delta} cm dari minggu lalu</span>;
    return (
        <span className={`flex items-center gap-0.5 text-xs font-semibold tabular-nums ${ isGood ? 'text-emerald-700' : 'text-red-700' }`}>
            {isGood
                ? <svg width="10" height="10" viewBox="0 0 10 10" aria-hidden="true"><polygon points="5,0 10,10 0,10" fill="currentColor"/></svg>
                : <svg width="10" height="10" viewBox="0 0 10 10" aria-hidden="true"><polygon points="0,0 10,0 5,10" fill="currentColor"/></svg>
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
    const [data, setData] = useState(null);
    const [loading, setLoading] = useState(true);
    const [company, setCompany] = useState('Semua');
    const [companyList, setCompanyList] = useState(['Semua']);
    const [week, setWeek] = useState(null);
    const [weekList, setWeekList] = useState([]);
    const [error, setError] = useState(null);

    // Fetch active companies
    useEffect(() => {
        fetch('/api/companies?active=true')
            .then(r => r.json())
            .then(json => {
                if (json.companies) {
                    const codes = json.companies.map(c => c.code);
                    setCompanyList(['Semua', ...codes]);
                }
            })
            .catch(() => {});
    }, []);

    // Fetch available weeks from calendar_weeks
    useEffect(() => {
        fetch('/api/calendar-weeks')
            .then(r => r.json())
            .then(json => {
                if (json.weeks && json.weeks.length > 0) {
                    setWeekList(json.weeks);
                    
                    const now = new Date();
                    const currentWeek = json.weeks.find(w => {
                        const start = new Date(w.start_date);
                        const end = new Date(w.end_date);
                        return now >= start && now <= end;
                    });

                    if (currentWeek) {
                        setWeek(currentWeek.formatted_name);
                    } else {
                        setWeek(json.weeks[0].formatted_name);
                    }
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
            
            if (json.selectedWeek && json.selectedWeek !== week) {
                setWeek(json.selectedWeek);
            }
        } catch (e) {
            setError(e.message);
        } finally {
            setLoading(false);
        }
    }, [week]);

    useEffect(() => {
        if (week !== null) fetchData(company, week);
    }, [company, week, fetchData]);

    const cw = data?.currentWeek;
    const pw = data?.prevWeek;

    const tmatDelta = (cw && pw) ? (cw.avg_tmat - pw.avg_tmat).toFixed(1) : null;
    const status = classifyStatus(cw?.avg_tmat);

    const dryEstates = useMemo(
        () => rankEstatesByDryness(data?.estateBreakdown),
        [data?.estateBreakdown]
    );
    const wetEstates = useMemo(
        () => rankEstatesByWetness(data?.estateBreakdown),
        [data?.estateBreakdown]
    );
    const { sortedRainfall, maxRain } = useMemo(() => {
        if (!Array.isArray(data?.rainfallData) || data.rainfallData.length === 0) {
            return { sortedRainfall: [], maxRain: 0 };
        }
        const sorted = [...data.rainfallData].sort((a, b) => {
            if (b.total_mm !== a.total_mm) return b.total_mm - a.total_mm;
            return String(a.est_code || '').localeCompare(String(b.est_code || ''), undefined, {
                numeric: true,
                sensitivity: 'base',
            });
        });
        const max = Math.max(...sorted.map((d) => Number(d.total_mm) || 0));
        return { sortedRainfall: sorted, maxRain: max };
    }, [data?.rainfallData]);

    const sortedLastRain = useMemo(() => {
        if (!Array.isArray(data?.lastRainData) || data.lastRainData.length === 0) return [];
        return [...data.lastRainData].sort((a, b) => {
            if (b.days_since_rain !== a.days_since_rain) return b.days_since_rain - a.days_since_rain;
            return String(a.est_code || '').localeCompare(String(b.est_code || ''), undefined, {
                numeric: true,
                sensitivity: 'base',
            });
        });
    }, [data?.lastRainData]);

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
            label: 'Total Blok',
            data: data.weeklyData.map(w => w.total_block),
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
            <header className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
                <div>
                    <div className="flex items-baseline gap-3 flex-wrap">
                        <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-gray-900">Dashboard</h1>
                        {cw && (
                            <span className="text-sm font-medium text-gray-600">
                                ({cw.week})&nbsp;
                                {cw.week_start && cw.week_end
                                    ? `${fmtDate(cw.week_start)} - ${fmtDate(cw.week_end)}`
                                    : ''}
                            </span>
                        )}
                    </div>
                    <div className="flex flex-wrap items-center gap-3 mt-1">
                        <p className="text-sm text-gray-600">Monitoring kondisi piezometer &amp; curah hujan secara real-time.</p>
                        {data?.syncInfo?.last_sync && (
                            <span className="inline-flex items-center gap-1.5 text-xs font-semibold bg-white text-gray-800 px-2.5 py-1 rounded-lg border border-gray-300">
                                <RefreshCw size={12} className={loading ? 'animate-spin' : ''} aria-hidden="true" />
                                Update: {fmtDateTime(data.syncInfo.last_sync)}
                            </span>
                        )}
                    </div>
                </div>
                <div className="flex items-center gap-2 flex-wrap">
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
                        options={companyList}
                        value={company}
                        onChange={setCompany}
                        placeholder="Pilih Company..."
                        className="min-w-[150px]"
                    />
                    <button
                        type="button"
                        onClick={() => fetchData(company, week)}
                        disabled={loading}
                        aria-label="Muat ulang data dashboard"
                        title="Muat ulang data"
                        className="min-h-11 min-w-11 inline-flex items-center justify-center rounded-xl border border-gray-300 bg-white text-gray-900 hover:bg-gray-50 transition-colors disabled:opacity-50"
                    >
                        <RefreshCw size={16} className={loading ? 'animate-spin text-gray-500' : 'text-gray-800'} aria-hidden="true" />
                    </button>
                </div>
            </header>

            {error && (
                <div role="alert" className="bg-red-50 border border-red-300 text-red-900 text-sm px-4 py-3 rounded-2xl flex items-center gap-2 font-medium">
                    <AlertTriangle size={16} className="shrink-0 text-red-700" aria-hidden="true" />
                    <span>{error}</span>
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
                    label="Jumlah Titik / Blok"
                    value={cw ? `${cw.total_pzo?.toLocaleString('id-ID')} / ${cw.total_block?.toLocaleString('id-ID')}` : '–'}
                    sub={`${data?.syncInfo?.total_estates ?? '–'} Estate`}
                    icon={<Droplets size={16} />}
                    color="#1D4ED8"
                    loading={loading}
                />
                <StatCard
                    label="Piezometer Kering (>65cm)"
                    value={cw ? `${(((cw.cnt_kering) / cw.total_block) * 100).toFixed(1)}%` : '–'}
                    sub={`${cw?.cnt_kering ?? 0} blok kering`}
                    icon={<AlertTriangle size={16} />}
                    color="#EF4444"
                    loading={loading}
                />
            </div>

            {/* Charts Row */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                {/* Trend Chart - spans 2 cols */}
                <div className="bg-white rounded-2xl border border-gray-200 shadow-xs p-5 lg:col-span-2 flex flex-col">
                    <h2 className="text-base font-bold text-gray-900 mb-0.5">Trend Rata-rata TMAT &amp; Volume Data</h2>
                    <p className="text-xs text-gray-600 mb-4">8 Minggu terakhir</p>
                    <div className="flex-1 relative" style={{ minHeight: '240px' }}>
                        {loading ? (
                            <div className="absolute inset-0 flex items-center justify-center">
                                <RefreshCw size={24} className="animate-spin text-gray-400" aria-hidden="true" />
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
                            <div className="absolute inset-0 flex items-center justify-center text-sm text-gray-600">Tidak ada data</div>
                        )}
                    </div>
                </div>

                {/* Donut Distribution */}
                <div className="bg-white rounded-2xl border border-gray-200 shadow-xs p-5 flex flex-col">
                    <h2 className="text-base font-bold text-gray-900 mb-0.5">Distribusi TMAT</h2>
                    <p className="text-xs text-gray-600 mb-4">{cw?.week ?? 'Minggu terkini'}</p>
                    <div className="flex-1 relative flex items-center justify-center" style={{ minHeight: '240px' }}>
                        {loading ? (
                            <RefreshCw size={24} className="animate-spin text-gray-400" aria-hidden="true" />
                        ) : distChartData ? (
                            <Doughnut data={distChartData} options={{
                                responsive: true, maintainAspectRatio: false, cutout: '65%',
                                plugins: {
                                    legend: { position: 'right', labels: { usePointStyle: true, boxWidth: 8, font: { size: 10 } } }
                                }
                            }} />
                        ) : (
                            <span className="text-sm text-gray-600">Tidak ada data</span>
                        )}
                    </div>
                </div>
            </div>

            {/* Bottom Row: Estate Tables (2x2 Grid) */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                {/* Top Estate by Kering */}
                <div className="bg-white rounded-2xl border border-gray-200 shadow-xs overflow-hidden flex flex-col">
                    <div className="p-5 border-b border-gray-200">
                        <h2 className="text-sm font-bold text-gray-900">Estate Paling Kering</h2>
                        <p className="text-xs text-gray-600 mt-0.5">Persentase Piezometer Kering &gt; 65cm</p>
                    </div>
                    <div className="overflow-auto flex-1 max-h-80">
                        {loading ? (
                            <div aria-live="polite" className="p-6 space-y-3">
                                <span className="sr-only">Memuat data estate paling kering...</span>
                                {[1,2,3].map(i => <div key={i} className="h-8 bg-gray-100 animate-pulse rounded-lg" />)}
                            </div>
                        ) : (dryEstates.length > 0) ? (
                            <table className="w-full text-sm">
                                <caption className="sr-only">Peringkat estate berdasarkan persentase blok kering (&gt; 65 cm)</caption>
                                <thead className="bg-gray-50 text-xs text-gray-600 uppercase tracking-wider sticky top-0 z-10 border-b border-gray-200">
                                    <tr>
                                        <th scope="col" className="px-4 py-3 text-left">Estate</th>
                                        <th scope="col" className="px-4 py-3 text-right">Avg TMAT</th>
                                        <th scope="col" className="px-4 py-3 text-right">Kering</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-gray-100">
                                    {dryEstates.map((e, i) => {
                                            const pct = Math.round(e.keringPct);
                                            return (
                                                <tr key={i} className="hover:bg-gray-50 transition-colors">
                                                    <td className="px-4 py-3">
                                                        <div className="font-semibold text-gray-900 text-xs">{e.estate}</div>
                                                        <div className="text-[11px] text-gray-600 uppercase">{e.company}</div>
                                                    </td>
                                                <td className="px-4 py-3 text-right tabular-nums">
                                                    <span className="text-xs font-semibold px-2 py-0.5 rounded-md border border-gray-200 bg-gray-50 text-gray-900">
                                                        {e.avg_tmat != null ? `${e.avg_tmat} cm` : '-'}
                                                    </span>
                                                </td>
                                                <td className="px-4 py-3 text-right tabular-nums">
                                                    <div className="flex items-center justify-end gap-1.5">
                                                        <div className="w-8 bg-gray-100 rounded-full h-1.5">
                                                            <div className="h-1.5 rounded-full bg-red-600" style={{ width: `${Math.min(pct, 100)}%` }} />
                                                        </div>
                                                        <span className="text-xs font-bold text-gray-800">{pct}%</span>
                                                    </div>
                                                </td>
                                            </tr>
                                        );
                                    })}
                                </tbody>
                            </table>
                        ) : (
                            <p className="text-sm text-gray-600 p-6 text-center">Belum ada data estate kering untuk minggu dan company yang dipilih.</p>
                        )}
                    </div>
                </div>

                {/* Top Estate by Tergenang & Banjir */}
                <div className="bg-white rounded-2xl border border-gray-200 shadow-xs overflow-hidden flex flex-col">
                    <div className="p-5 border-b border-gray-200 flex flex-wrap items-start justify-between gap-2">
                        <div>
                            <h2 className="text-sm font-bold text-gray-900">Estate Paling Tergenang &amp; Banjir</h2>
                            <p className="text-xs text-gray-600 mt-0.5">Persentase Blok TMAT 0-40 cm &amp; &lt;0 cm</p>
                        </div>
                        <div className="flex items-center gap-3 pt-0.5 text-xs text-gray-700 font-medium">
                            <span className="inline-flex items-center gap-1.5">
                                <span className="w-2.5 h-2.5 rounded-xs bg-zinc-700 shrink-0" aria-hidden="true" />
                                <span>Banjir (&lt;0)</span>
                            </span>
                            <span className="inline-flex items-center gap-1.5">
                                <span className="w-2.5 h-2.5 rounded-xs bg-blue-700 shrink-0" aria-hidden="true" />
                                <span>Tergenang (0-40)</span>
                            </span>
                        </div>
                    </div>
                    <div className="overflow-auto flex-1 max-h-80">
                        {loading ? (
                            <div aria-live="polite" className="p-6 space-y-3">
                                <span className="sr-only">Memuat data estate tergenang dan banjir...</span>
                                {[1,2,3].map(i => <div key={i} className="h-8 bg-gray-100 animate-pulse rounded-lg" />)}
                            </div>
                        ) : (wetEstates.length > 0) ? (
                            <table className="w-full text-sm">
                                <caption className="sr-only">Peringkat estate berdasarkan persentase blok tergenang (0-40 cm) dan banjir (&lt;0 cm)</caption>
                                <thead className="bg-gray-50 text-xs text-gray-600 uppercase tracking-wider sticky top-0 z-10 border-b border-gray-200">
                                    <tr>
                                        <th scope="col" className="px-4 py-3 text-left">Estate</th>
                                        <th scope="col" className="px-4 py-3 text-right">Avg TMAT</th>
                                        <th scope="col" className="px-4 py-3 text-right">Rincian Blok</th>
                                        <th scope="col" className="px-4 py-3 text-right">Total (&le;40)</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-gray-100">
                                    {wetEstates.map((e, i) => {
                                        const pct = Math.round(e.combinedPct);
                                        const titleText = `${e.cntCombined}/${e.totalBlock} blok terdampak (Tergenang 0-40: ${e.cntTergenang}, Banjir <0: ${e.cntBanjir})`;
                                        return (
                                            <tr key={i} className="hover:bg-gray-50 transition-colors">
                                                <td className="px-4 py-3">
                                                    <div className="font-semibold text-gray-900 text-xs">{e.estate}</div>
                                                    <div className="text-[11px] text-gray-600 uppercase">{e.company}</div>
                                                </td>
                                                <td className="px-4 py-3 text-right tabular-nums whitespace-nowrap">
                                                    <span className="text-xs font-semibold px-2 py-0.5 rounded-md border border-gray-200 bg-gray-50 text-gray-900">
                                                        {e.avg_tmat != null ? `${e.avg_tmat} cm` : '-'}
                                                    </span>
                                                </td>
                                                <td className="px-4 py-3 text-right tabular-nums whitespace-nowrap">
                                                    <div className="inline-flex items-center justify-end gap-1.5">
                                                        <span className="text-[11px] font-semibold px-2 py-0.5 rounded-md bg-blue-50 text-blue-800">
                                                            0-40: {e.cntTergenang}
                                                        </span>
                                                        <span className="text-[11px] font-semibold px-2 py-0.5 rounded-md bg-zinc-100 text-zinc-700">
                                                            &lt;0: {e.cntBanjir}
                                                        </span>
                                                    </div>
                                                </td>
                                                <td className="px-4 py-3 text-right tabular-nums whitespace-nowrap" title={titleText}>
                                                    <div className="flex items-center justify-end gap-1.5">
                                                        <div className="w-12 bg-gray-100 rounded-full h-1.5 overflow-hidden flex shrink-0">
                                                            <div
                                                                className="h-1.5 bg-zinc-700"
                                                                style={{ width: `${e.banjirBarPct}%` }}
                                                            />
                                                            <div
                                                                className="h-1.5 bg-blue-700"
                                                                style={{ width: `${e.tergenangBarPct}%` }}
                                                            />
                                                        </div>
                                                        <span className="text-xs font-bold text-gray-900 w-9 text-right">{pct}%</span>
                                                    </div>
                                                </td>
                                            </tr>
                                        );
                                    })}
                                </tbody>
                            </table>
                        ) : (
                            <p className="text-sm text-gray-600 p-6 text-center">Belum ada data blok tergenang atau banjir untuk minggu dan company yang dipilih.</p>
                        )}
                    </div>
                </div>

                {/* Rainfall Summary */}
                <div className="bg-white rounded-2xl border border-gray-200 shadow-xs overflow-hidden flex flex-col">
                    <div className="p-5 border-b border-gray-200">
                        <h2 className="text-sm font-bold text-gray-900">Curah Hujan Tertinggi</h2>
                        <p className="text-xs text-gray-600 mt-0.5">Akumulasi CH Periode Minggu Ini</p>
                    </div>
                    <div className="overflow-auto flex-1 max-h-80">
                        {loading ? (
                            <div aria-live="polite" className="p-6 space-y-3">
                                <span className="sr-only">Memuat data curah hujan tertinggi...</span>
                                {[1,2,3].map(i => <div key={i} className="h-8 bg-gray-100 animate-pulse rounded-lg" />)}
                            </div>
                        ) : (sortedRainfall.length > 0) ? (
                            <table className="w-full text-sm">
                                <caption className="sr-only">Peringkat estate berdasarkan curah hujan tertinggi minggu ini</caption>
                                <thead className="bg-gray-50 text-xs text-gray-600 uppercase tracking-wider sticky top-0 z-10 border-b border-gray-200">
                                    <tr>
                                        <th scope="col" className="px-4 py-3 text-left">Estate</th>
                                        <th scope="col" className="px-4 py-3 text-right">Total CH</th>
                                        <th scope="col" className="px-4 py-3 text-right">HH</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-gray-100">
                                    {sortedRainfall.map((r, i) => {
                                        const pct = maxRain > 0 ? ((Number(r.total_mm) || 0) / maxRain * 100) : 0;
                                        return (
                                            <tr key={i} className="hover:bg-gray-50 transition-colors">
                                                <td className="px-4 py-3">
                                                    <div className="font-semibold text-gray-900 text-xs">{r.est_code || '–'}</div>
                                                    <div className="text-[11px] text-gray-600 uppercase">{r.company_code}</div>
                                                </td>
                                                <td className="px-4 py-3 text-right tabular-nums">
                                                    <div className="flex items-center justify-end gap-1.5">
                                                        <div className="w-8 bg-gray-100 rounded-full h-1.5">
                                                            <div className="h-1.5 rounded-full bg-blue-600" style={{ width: `${pct}%` }} />
                                                        </div>
                                                        <span className="text-xs font-bold text-gray-800">{r.total_mm} mm</span>
                                                    </div>
                                                </td>
                                                <td className="px-4 py-3 text-right tabular-nums">
                                                    <span className="text-xs font-bold text-blue-800">{r.hari_hujan}<span className="text-gray-500 font-normal">/7</span></span>
                                                </td>
                                            </tr>
                                        );
                                    })}
                                </tbody>
                            </table>
                        ) : (
                            <div className="p-6 text-center">
                                <CloudRain size={32} className="mx-auto text-gray-400 mb-2" aria-hidden="true" />
                                <p className="text-xs text-gray-600">Belum ada data CH.</p>
                            </div>
                        )}
                    </div>
                </div>

                {/* Estate Tanpa Hujan Terlama */}
                <div className="bg-white rounded-2xl border border-gray-200 shadow-xs overflow-hidden flex flex-col">
                    <div className="p-5 border-b border-gray-200">
                        <h2 className="text-sm font-bold text-gray-900">Tanpa Hujan Terlama</h2>
                        <p className="text-xs text-gray-600 mt-0.5">Hari sejak hujan terakhir (Kondisi Terkini)</p>
                    </div>
                    <div className="overflow-auto flex-1 max-h-80">
                        {loading ? (
                            <div aria-live="polite" className="p-6 space-y-3">
                                <span className="sr-only">Memuat data tanpa hujan terlama...</span>
                                {[1,2,3].map(i => <div key={i} className="h-8 bg-gray-100 animate-pulse rounded-lg" />)}
                            </div>
                        ) : (sortedLastRain.length > 0) ? (
                            <table className="w-full text-sm">
                                <caption className="sr-only">Peringkat estate berdasarkan durasi hari tanpa hujan terlama</caption>
                                <thead className="bg-gray-50 text-xs text-gray-600 uppercase tracking-wider sticky top-0 z-10 border-b border-gray-200">
                                    <tr>
                                        <th scope="col" className="px-4 py-3 text-left">Estate</th>
                                        <th scope="col" className="px-4 py-3 text-right">Hujan Terakhir</th>
                                        <th scope="col" className="px-4 py-3 text-right">Lama (Hari)</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-gray-100">
                                    {sortedLastRain.map((r, i) => {
                                            const days = r.days_since_rain;
                                            const color = days > 14 ? 'text-red-700' : days > 7 ? 'text-amber-700' : 'text-gray-700';
                                            return (
                                                <tr key={i} className="hover:bg-gray-50 transition-colors">
                                                    <td className="px-4 py-3">
                                                        <div className="font-semibold text-gray-900 text-xs">{r.est_code || '–'}</div>
                                                        <div className="text-[11px] text-gray-600 uppercase">{r.company_code}</div>
                                                    </td>
                                                    <td className="px-4 py-3 text-right">
                                                        <div className="text-xs font-medium text-gray-600">{fmtDate(r.last_rain_date)}</div>
                                                    </td>
                                                    <td className="px-4 py-3 text-right tabular-nums">
                                                        <div className="flex items-center justify-end gap-2">
                                                            <div className={`text-xs font-bold ${color}`}>{days} <span className="text-[11px] font-normal text-gray-600">hari</span></div>
                                                            <div className="w-2 h-2 rounded-full" style={{ backgroundColor: days > 14 ? '#DC2626' : days > 7 ? '#D97706' : '#16A34A' }} aria-hidden="true" />
                                                        </div>
                                                    </td>
                                                </tr>
                                            );
                                        })}
                                </tbody>
                            </table>
                        ) : (
                            <div className="p-6 text-center">
                                <AlertTriangle size={32} className="mx-auto text-gray-400 mb-2" aria-hidden="true" />
                                <p className="text-xs text-gray-600">Data analisis kekeringan tidak tersedia.</p>
                            </div>
                        )}
                    </div>
                </div>
            </div>

            {/* DB Sync Status Footer */}
            {data?.syncInfo && (
                <div className="flex flex-wrap items-center gap-3 px-4 py-3 bg-white rounded-2xl border border-gray-200 shadow-xs text-xs text-gray-600 tabular-nums">
                    <Database size={14} className="text-gray-500" aria-hidden="true" />
                    <span>Total di DB: <strong className="text-gray-900">{data.syncInfo.total_records?.toLocaleString('id-ID')}</strong> record</span>
                    <span aria-hidden="true">·</span>
                    <span><strong className="text-gray-900">{data.syncInfo.total_companies}</strong> Company</span>
                    <span aria-hidden="true">·</span>
                    <span><strong className="text-gray-900">{data.syncInfo.total_estates}</strong> Estate</span>
                </div>
            )}
        </div>
    );
}
