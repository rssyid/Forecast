"use client";

import { useState, useEffect, useMemo } from 'react';
import { 
    CalendarDays, CloudRain, TrendingUp, TrendingDown, Minus, 
    Search, RefreshCw, AlertCircle, Building2, Table, LayoutGrid, CheckCircle2 
} from 'lucide-react';
import SearchableSelect from './SearchableSelect';

function getRainCategory(totalMm) {
    const val = Number(totalMm) || 0;
    if (val === 0) return { label: 'Kering', color: '#9CA3AF', bg: '#F3F4F6' };
    if (val <= 50) return { label: 'Rendah', color: '#2563EB', bg: '#EFF6FF' };
    if (val <= 100) return { label: 'Sedang', color: '#D97706', bg: '#FEF3C7' };
    if (val <= 150) return { label: 'Tinggi', color: '#DC2626', bg: '#FEE2E2' };
    return { label: 'Sangat Tinggi', color: '#7F1D1D', bg: '#FEE2E2' };
}

function MetricCard({ title, value, sub, icon, color = '#2563EB', loading }) {
    return (
        <div className="bg-white border border-gray-100 p-5 rounded-2xl shadow-sm flex flex-col gap-2">
            <div className="flex items-center justify-between">
                <span className="text-[11px] font-bold text-gray-400 uppercase tracking-wider">{title}</span>
                <div className="w-8 h-8 rounded-xl flex items-center justify-center" style={{ backgroundColor: `${color}15`, color }}>
                    {icon}
                </div>
            </div>
            {loading ? (
                <div className="h-7 w-28 bg-gray-100 animate-pulse rounded-lg mt-1" />
            ) : (
                <div>
                    <div className="text-2xl font-black text-gray-900 tracking-tight">{value ?? '–'}</div>
                    {sub && <div className="text-xs text-gray-500 font-medium mt-0.5">{sub}</div>}
                </div>
            )}
        </div>
    );
}

export default function RainfallWeeklySummary() {
    const [mode, setMode] = useState('single'); // 'single' | 'matrix'
    const [selectedWeek, setSelectedWeek] = useState('');
    const [matrixLimit, setMatrixLimit] = useState(8);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);
    const [data, setData] = useState(null);
    const [searchTerm, setSearchTerm] = useState('');
    const [sortConfig, setSortConfig] = useState({ key: 'total_ch_mm', direction: 'desc' });

    // Fetch data
    const fetchSummary = async () => {
        setLoading(true);
        setError(null);
        try {
            const params = new URLSearchParams({
                mode,
                ...(mode === 'single' && selectedWeek ? { week: selectedWeek } : {}),
                ...(mode === 'matrix' ? { limit: String(matrixLimit) } : {})
            });
            const res = await fetch(`/api/rainfall-weekly?${params}`);
            if (!res.ok) throw new Error(`HTTP ${res.status}: Gagal memuat data mingguan`);
            const json = await res.json();
            setData(json);

            // Set default selected week if empty
            if (mode === 'single' && !selectedWeek && json.week) {
                setSelectedWeek(json.week.formatted_name);
            }
        } catch (err) {
            setError(err.message);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchSummary();
    }, [mode, selectedWeek, matrixLimit]);

    // Available weeks for dropdown
    const weekOptions = useMemo(() => {
        if (!data?.availableWeeks) return [];
        return data.availableWeeks.map(w => w.formatted_name);
    }, [data?.availableWeeks]);

    // Filtered & Sorted for Single Mode
    const filteredSingleData = useMemo(() => {
        if (!data?.data) return [];
        let list = data.data.filter(item => 
            item.company_code.toLowerCase().includes(searchTerm.toLowerCase()) ||
            item.company_name.toLowerCase().includes(searchTerm.toLowerCase())
        );

        if (sortConfig.key) {
            list.sort((a, b) => {
                let aVal = a[sortConfig.key];
                let bVal = b[sortConfig.key];
                if (typeof aVal === 'string') {
                    const res = aVal.localeCompare(bVal);
                    return sortConfig.direction === 'asc' ? res : -res;
                }
                aVal = Number(aVal) || 0;
                bVal = Number(bVal) || 0;
                return sortConfig.direction === 'asc' ? aVal - bVal : bVal - aVal;
            });
        }
        return list;
    }, [data?.data, searchTerm, sortConfig]);

    // Filtered for Matrix Mode
    const filteredMatrixCompanies = useMemo(() => {
        if (!data?.companies) return [];
        return data.companies.filter(c => 
            c.code.toLowerCase().includes(searchTerm.toLowerCase()) ||
            c.name.toLowerCase().includes(searchTerm.toLowerCase())
        );
    }, [data?.companies, searchTerm]);

    // Averages for Single Week View (Footer Row)
    const singleAverages = useMemo(() => {
        if (!filteredSingleData || filteredSingleData.length === 0) return null;
        const n = filteredSingleData.length;
        const avgWeekly = Number((filteredSingleData.reduce((acc, r) => acc + r.total_ch_mm, 0) / n).toFixed(1));
        const avgDaily = Number((filteredSingleData.reduce((acc, r) => acc + r.avg_daily_mm, 0) / n).toFixed(1));
        const avgHH = Number((filteredSingleData.reduce((acc, r) => acc + r.hari_hujan, 0) / n).toFixed(1));
        const prevAvgWeekly = Number((filteredSingleData.reduce((acc, r) => acc + r.prev_total_ch_mm, 0) / n).toFixed(1));
        const delta = Number((avgWeekly - prevAvgWeekly).toFixed(1));
        const category = getRainCategory(avgWeekly);
        return {
            avgWeekly,
            avgDaily,
            avgHH,
            delta,
            category
        };
    }, [filteredSingleData]);

    // Averages for Matrix View (Row Averages, Column Averages, and Overall)
    const matrixAverages = useMemo(() => {
        if (!data?.weeks || !filteredMatrixCompanies || filteredMatrixCompanies.length === 0) return null;
        const weeks = data.weeks;
        const comps = filteredMatrixCompanies;
        const nComps = comps.length;
        const nWeeks = weeks.length;

        // 1. Column averages (per week across all PT)
        const weekAverages = {};
        weeks.forEach(w => {
            let sumTotal = 0;
            let sumDaily = 0;
            let sumHH = 0;
            comps.forEach(c => {
                const cell = data.matrix?.[c.code]?.[w.formatted_name];
                sumTotal += cell?.total_ch_mm || 0;
                sumDaily += cell?.avg_daily_mm || 0;
                sumHH += cell?.hari_hujan || 0;
            });
            weekAverages[w.formatted_name] = {
                avgWeekly: Number((sumTotal / nComps).toFixed(1)),
                avgDaily: Number((sumDaily / nComps).toFixed(1)),
                avgHH: Number((sumHH / nComps).toFixed(1))
            };
        });

        // 2. Row averages (per PT across all weeks)
        const companyAverages = {};
        comps.forEach(c => {
            let sumTotal = 0;
            let sumDaily = 0;
            let sumHH = 0;
            weeks.forEach(w => {
                const cell = data.matrix?.[c.code]?.[w.formatted_name];
                sumTotal += cell?.total_ch_mm || 0;
                sumDaily += cell?.avg_daily_mm || 0;
                sumHH += cell?.hari_hujan || 0;
            });
            companyAverages[c.code] = {
                avgWeekly: Number((sumTotal / nWeeks).toFixed(1)),
                avgDaily: Number((sumDaily / nWeeks).toFixed(1)),
                avgHH: Number((sumHH / nWeeks).toFixed(1))
            };
        });

        // 3. Overall grand average
        let grandTotal = 0;
        let grandDaily = 0;
        let grandHH = 0;
        comps.forEach(c => {
            const ca = companyAverages[c.code];
            grandTotal += ca.avgWeekly;
            grandDaily += ca.avgDaily;
            grandHH += ca.avgHH;
        });
        const overall = {
            avgWeekly: Number((grandTotal / nComps).toFixed(1)),
            avgDaily: Number((grandDaily / nComps).toFixed(1)),
            avgHH: Number((grandHH / nComps).toFixed(1))
        };

        return {
            weekAverages,
            companyAverages,
            overall
        };
    }, [data?.weeks, data?.matrix, filteredMatrixCompanies]);

    const handleSort = (key) => {
        setSortConfig(prev => ({
            key,
            direction: prev.key === key && prev.direction === 'desc' ? 'asc' : 'desc'
        }));
    };

    const formatDateRange = (start, end) => {
        if (!start || !end) return '';
        const d1 = new Date(start);
        const d2 = new Date(end);
        const f1 = d1.toLocaleDateString('id-ID', { day: 'numeric', month: 'short' });
        const f2 = d2.toLocaleDateString('id-ID', { day: 'numeric', month: 'short', year: 'numeric' });
        return `${f1} – ${f2}`;
    };

    return (
        <div className="bg-white border border-gray-100 rounded-3xl p-6 lg:p-8 shadow-sm space-y-8">
            {/* Header Title & Controls */}
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-6 pb-6 border-b border-gray-100">
                <div>
                    <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-2xl bg-blue-50 text-blue-600 flex items-center justify-center font-black">
                            <CloudRain size={22} />
                        </div>
                        <div>
                            <h2 className="text-xl font-black text-gray-900 tracking-tight">
                                Summary Curah Hujan Mingguan per PT
                            </h2>
                            <p className="text-xs text-gray-400 font-medium mt-0.5">
                                Agregasi rata-rata harian dan jumlah hari hujan berdasarkan periode <span className="font-bold text-gray-600">calendar_weeks</span>.
                            </p>
                        </div>
                    </div>
                </div>

                {/* View Mode Toggle & Actions */}
                <div className="flex flex-wrap items-center gap-3">
                    {/* Mode Toggle */}
                    <div className="flex items-center p-1 bg-gray-100 rounded-2xl border border-gray-200/60">
                        <button
                            onClick={() => setMode('single')}
                            className={`flex items-center gap-2 px-3.5 py-1.5 rounded-xl text-xs font-bold transition-all ${
                                mode === 'single'
                                    ? 'bg-white text-gray-900 shadow-sm'
                                    : 'text-gray-500 hover:text-gray-900'
                            }`}
                        >
                            <Table size={14} />
                            <span>Detail 1 Minggu</span>
                        </button>
                        <button
                            onClick={() => setMode('matrix')}
                            className={`flex items-center gap-2 px-3.5 py-1.5 rounded-xl text-xs font-bold transition-all ${
                                mode === 'matrix'
                                    ? 'bg-white text-gray-900 shadow-sm'
                                    : 'text-gray-500 hover:text-gray-900'
                            }`}
                        >
                            <LayoutGrid size={14} />
                            <span>Matriks Multi-Minggu</span>
                        </button>
                    </div>

                    <button
                        onClick={fetchSummary}
                        disabled={loading}
                        className="p-2.5 bg-gray-50 hover:bg-gray-100 text-gray-600 border border-gray-200 rounded-xl transition-all cursor-pointer"
                        title="Segarkan data"
                    >
                        <RefreshCw size={15} className={loading ? 'animate-spin' : ''} />
                    </button>
                </div>
            </div>

            {error && (
                <div className="p-4 bg-red-50 border border-red-100 rounded-2xl text-red-700 text-xs font-bold flex items-center gap-3">
                    <AlertCircle size={18} />
                    <span>{error}</span>
                </div>
            )}

            {/* ---------------------------------------------------- */}
            {/* VIEW MODE 1: DETAIL 1 MINGGU */}
            {/* ---------------------------------------------------- */}
            {mode === 'single' && (
                <div className="space-y-6">
                    {/* Control Row: Select Week & Search */}
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                        <div className="flex items-center gap-3">
                            <div className="w-64">
                                <SearchableSelect
                                    options={weekOptions}
                                    value={selectedWeek}
                                    onChange={setSelectedWeek}
                                    placeholder="Pilih Minggu Kalender..."
                                    icon={<CalendarDays size={14} />}
                                    autoSort={false}
                                />
                            </div>
                            {data?.week && (
                                <span className="text-xs font-bold text-gray-500 hidden sm:inline">
                                    📅 {formatDateRange(data.week.start_date, data.week.end_date)}
                                </span>
                            )}
                        </div>

                        {/* Search Input */}
                        <div className="relative w-full sm:w-64">
                            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={14} />
                            <input
                                type="text"
                                value={searchTerm}
                                onChange={e => setSearchTerm(e.target.value)}
                                placeholder="Cari PT..."
                                className="w-full pl-9 pr-4 py-2 bg-gray-50 border border-gray-200 rounded-xl text-xs font-medium outline-none focus:border-blue-400 focus:bg-white transition-all"
                            />
                        </div>
                    </div>

                    {/* Metrics Banner */}
                    <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                        <MetricCard
                            title="Rata-rata CH Semua PT"
                            value={data?.metrics ? `${data.metrics.avgCHAllPT} mm` : '–'}
                            sub="Akumulasi rata-rata per minggu"
                            icon={<CloudRain size={16} />}
                            color="#2563EB"
                            loading={loading}
                        />
                        <MetricCard
                            title="Rata-rata Harian"
                            value={data?.metrics ? `${data.metrics.avgDailyAllPT} mm/hari` : '–'}
                            sub="Intensitas harian rata-rata"
                            icon={<TrendingUp size={16} />}
                            color="#10B981"
                            loading={loading}
                        />
                        <MetricCard
                            title="Rata-rata Hari Hujan"
                            value={data?.metrics ? `${data.metrics.avgHHAllPT} Hari` : '–'}
                            sub="Dari 7 hari dalam minggu"
                            icon={<CalendarDays size={16} />}
                            color="#8B5CF6"
                            loading={loading}
                        />
                        <MetricCard
                            title="PT Terbasah"
                            value={data?.metrics?.wettestPT ? data.metrics.wettestPT.code : '–'}
                            sub={data?.metrics?.wettestPT ? `${data.metrics.wettestPT.total_mm} mm · ${data.metrics.wettestPT.hh} HH` : 'Tidak ada hujan'}
                            icon={<Building2 size={16} />}
                            color="#F59E0B"
                            loading={loading}
                        />
                    </div>

                    {/* Single Week Table */}
                    <div className="overflow-x-auto border border-gray-100 rounded-2xl shadow-sm">
                        <table className="w-full text-left text-xs border-collapse">
                            <thead>
                                <tr className="bg-gray-50/80 border-b border-gray-100 text-gray-500 uppercase text-[10px] font-black tracking-wider">
                                    <th className="py-4 px-4 text-center w-12">No</th>
                                    <th 
                                        className="py-4 px-4 cursor-pointer hover:text-gray-900 select-none"
                                        onClick={() => handleSort('company_code')}
                                    >
                                        <div className="flex items-center gap-1.5">
                                            <span>Perusahaan (PT)</span>
                                            {sortConfig.key === 'company_code' && (sortConfig.direction === 'asc' ? '▲' : '▼')}
                                        </div>
                                    </th>
                                    <th 
                                        className="py-4 px-4 text-right cursor-pointer hover:text-gray-900 select-none"
                                        onClick={() => handleSort('total_ch_mm')}
                                    >
                                        <div className="flex items-center justify-end gap-1.5">
                                            <span>Total Mingguan (mm)</span>
                                            {sortConfig.key === 'total_ch_mm' && (sortConfig.direction === 'asc' ? '▲' : '▼')}
                                        </div>
                                    </th>
                                    <th 
                                        className="py-4 px-4 text-right cursor-pointer hover:text-gray-900 select-none"
                                        onClick={() => handleSort('avg_daily_mm')}
                                    >
                                        <div className="flex items-center justify-end gap-1.5">
                                            <span>Rata-rata per Hari</span>
                                            {sortConfig.key === 'avg_daily_mm' && (sortConfig.direction === 'asc' ? '▲' : '▼')}
                                        </div>
                                    </th>
                                    <th 
                                        className="py-4 px-4 text-center cursor-pointer hover:text-gray-900 select-none"
                                        onClick={() => handleSort('hari_hujan')}
                                    >
                                        <div className="flex items-center justify-center gap-1.5">
                                            <span>Hari Hujan (HH)</span>
                                            {sortConfig.key === 'hari_hujan' && (sortConfig.direction === 'asc' ? '▲' : '▼')}
                                        </div>
                                    </th>
                                    <th className="py-4 px-4 text-center">Status / Kategori</th>
                                    <th className="py-4 px-4 text-right">Tren vs W-1</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-gray-100 font-medium text-gray-700">
                                {loading ? (
                                    Array.from({ length: 5 }).map((_, i) => (
                                        <tr key={i} className="animate-pulse">
                                            <td colSpan={7} className="py-4 px-4 text-center text-gray-300">
                                                Memuat data...
                                            </td>
                                        </tr>
                                    ))
                                ) : filteredSingleData.length === 0 ? (
                                    <tr>
                                        <td colSpan={7} className="py-8 text-center text-gray-400 italic">
                                            Tidak ada data untuk periode ini.
                                        </td>
                                    </tr>
                                ) : (
                                    filteredSingleData.map((row, idx) => {
                                        const delta = row.delta_ch_mm;
                                        return (
                                            <tr key={row.company_code} className="hover:bg-blue-50/40 transition-colors">
                                                <td className="py-3.5 px-4 text-center text-gray-400 font-bold">{idx + 1}</td>
                                                <td className="py-3.5 px-4">
                                                    <div className="flex flex-col">
                                                        <span className="font-bold text-gray-900 text-sm">{row.company_code}</span>
                                                        <span className="text-[10px] text-gray-400 truncate max-w-[200px]">{row.company_name}</span>
                                                    </div>
                                                </td>
                                                <td className="py-3.5 px-4 text-right">
                                                    <span className="text-sm font-black text-gray-900">{row.total_ch_mm}</span>
                                                    <span className="text-[10px] text-gray-400 ml-1">mm</span>
                                                </td>
                                                <td className="py-3.5 px-4 text-right">
                                                    <span className="text-xs font-bold text-blue-700 bg-blue-50 px-2 py-1 rounded-lg">
                                                        {row.avg_daily_mm} mm/hari
                                                    </span>
                                                </td>
                                                <td className="py-3.5 px-4 text-center">
                                                    <span className="text-xs font-bold text-gray-800">
                                                        {row.hari_hujan} <span className="text-gray-400 font-normal">/ 7 Hari</span>
                                                    </span>
                                                </td>
                                                <td className="py-3.5 px-4 text-center">
                                                    <span 
                                                        className="inline-block px-2.5 py-1 rounded-full text-[10px] font-black uppercase tracking-wider"
                                                        style={{ 
                                                            backgroundColor: row.category?.bg || '#F3F4F6', 
                                                            color: row.category?.color || '#374151' 
                                                        }}
                                                    >
                                                        {row.category?.label || '–'}
                                                    </span>
                                                </td>
                                                <td className="py-3.5 px-4 text-right">
                                                    {delta > 0 ? (
                                                        <span className="inline-flex items-center gap-1 text-xs font-bold text-emerald-600">
                                                            <TrendingUp size={13} /> +{delta} mm
                                                        </span>
                                                    ) : delta < 0 ? (
                                                        <span className="inline-flex items-center gap-1 text-xs font-bold text-red-500">
                                                            <TrendingDown size={13} /> {delta} mm
                                                        </span>
                                                    ) : (
                                                        <span className="inline-flex items-center gap-1 text-xs font-medium text-gray-400">
                                                            <Minus size={13} /> 0.0 mm
                                                        </span>
                                                    )}
                                                </td>
                                            </tr>
                                        );
                                    })
                                )}
                            </tbody>
                            {singleAverages && !loading && filteredSingleData.length > 0 && (
                                <tfoot className="bg-gray-100/90 border-t-2 border-gray-200 font-black text-xs text-gray-900">
                                    <tr>
                                        <td className="py-4 px-4 text-center text-gray-400 font-bold">#</td>
                                        <td className="py-4 px-4">
                                            <div className="flex flex-col">
                                                <span className="text-xs font-black text-blue-900 uppercase tracking-wider">
                                                    RATA-RATA SEMUA PT
                                                </span>
                                                <span className="text-[10px] text-gray-500 font-normal">
                                                    Rata-rata seluruh perusahaan
                                                </span>
                                            </div>
                                        </td>
                                        <td className="py-4 px-4 text-right">
                                            <span className="text-sm font-black text-blue-900">{singleAverages.avgWeekly}</span>
                                            <span className="text-[10px] text-gray-500 ml-1">mm</span>
                                        </td>
                                        <td className="py-4 px-4 text-right">
                                            <span className="text-xs font-black text-blue-800 bg-blue-100/80 px-2 py-1 rounded-lg">
                                                {singleAverages.avgDaily} mm/hari
                                            </span>
                                        </td>
                                        <td className="py-4 px-4 text-center">
                                            <span className="text-xs font-black text-purple-900">
                                                {singleAverages.avgHH} <span className="text-gray-500 font-normal">/ 7 Hari</span>
                                            </span>
                                        </td>
                                        <td className="py-4 px-4 text-center">
                                            <span 
                                                className="inline-block px-2.5 py-1 rounded-full text-[10px] font-black uppercase tracking-wider"
                                                style={{ 
                                                    backgroundColor: singleAverages.category?.bg || '#F3F4F6', 
                                                    color: singleAverages.category?.color || '#374151' 
                                                }}
                                            >
                                                {singleAverages.category?.label || '–'}
                                            </span>
                                        </td>
                                        <td className="py-4 px-4 text-right">
                                            {singleAverages.delta > 0 ? (
                                                <span className="inline-flex items-center gap-1 text-xs font-bold text-emerald-600">
                                                    <TrendingUp size={13} /> +{singleAverages.delta} mm
                                                </span>
                                            ) : singleAverages.delta < 0 ? (
                                                <span className="inline-flex items-center gap-1 text-xs font-bold text-red-500">
                                                    <TrendingDown size={13} /> {singleAverages.delta} mm
                                                </span>
                                            ) : (
                                                <span className="inline-flex items-center gap-1 text-xs font-medium text-gray-400">
                                                    <Minus size={13} /> 0.0 mm
                                                </span>
                                            )}
                                        </td>
                                    </tr>
                                </tfoot>
                            )}
                        </table>
                    </div>
                </div>
            )}

            {/* ---------------------------------------------------- */}
            {/* VIEW MODE 2: MATRIKS MULTI-MINGGU */}
            {/* ---------------------------------------------------- */}
            {mode === 'matrix' && (
                <div className="space-y-6">
                    {/* Matrix Controls */}
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                        <div className="flex items-center gap-3">
                            <span className="text-xs font-bold text-gray-500">Tampilkan:</span>
                            <div className="flex items-center gap-1.5">
                                {[4, 6, 8, 12].map(n => (
                                    <button
                                        key={n}
                                        onClick={() => setMatrixLimit(n)}
                                        className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                                            matrixLimit === n
                                                ? 'bg-blue-600 text-white shadow-sm'
                                                : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                                        }`}
                                    >
                                        {n} Minggu
                                    </button>
                                ))}
                            </div>
                        </div>

                        {/* Search Input */}
                        <div className="relative w-full sm:w-64">
                            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={14} />
                            <input
                                type="text"
                                value={searchTerm}
                                onChange={e => setSearchTerm(e.target.value)}
                                placeholder="Cari PT..."
                                className="w-full pl-9 pr-4 py-2 bg-gray-50 border border-gray-200 rounded-xl text-xs font-medium outline-none focus:border-blue-400 focus:bg-white transition-all"
                            />
                        </div>
                    </div>

                    {/* Matrix Table */}
                    <div className="overflow-x-auto border border-gray-100 rounded-2xl shadow-sm">
                        <table className="w-full text-left text-xs border-collapse">
                            <thead>
                                <tr className="bg-gray-50/90 border-b border-gray-100 text-gray-500 uppercase text-[10px] font-black tracking-wider">
                                    <th className="py-4 px-4 sticky left-0 bg-gray-50 z-10 w-36 shadow-[1px_0_0_#f1f5f9]">
                                        Perusahaan (PT)
                                    </th>
                                    {data?.weeks?.map(w => (
                                        <th key={w.id} className="py-4 px-3 text-center min-w-[130px] border-l border-gray-100">
                                            <div className="flex flex-col items-center">
                                                <span className="text-gray-900 font-black">{w.formatted_name}</span>
                                                <span className="text-[9px] text-gray-400 font-medium lowercase">
                                                    {formatDateRange(w.start_date, w.end_date)}
                                                </span>
                                            </div>
                                        </th>
                                    ))}
                                    {/* Summary Column for Row Averages */}
                                    <th className="py-4 px-3 text-center min-w-[140px] border-l-2 border-blue-200 bg-blue-50/80 text-blue-900 font-black">
                                        <div className="flex flex-col items-center">
                                            <span>Rata-rata Mingguan</span>
                                            <span className="text-[9px] text-blue-600 font-medium">
                                                ({data?.weeks?.length || 0} Minggu Terpilih)
                                            </span>
                                        </div>
                                    </th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-gray-100 font-medium text-gray-700">
                                {loading ? (
                                    Array.from({ length: 5 }).map((_, i) => (
                                        <tr key={i} className="animate-pulse">
                                            <td colSpan={(data?.weeks?.length || 8) + 2} className="py-4 px-4 text-center text-gray-300">
                                                Memuat matriks mingguan...
                                            </td>
                                        </tr>
                                    ))
                                ) : filteredMatrixCompanies.length === 0 ? (
                                    <tr>
                                        <td colSpan={(data?.weeks?.length || 8) + 2} className="py-8 text-center text-gray-400 italic">
                                            Tidak ada data.
                                        </td>
                                    </tr>
                                ) : (
                                    filteredMatrixCompanies.map(comp => {
                                        const compAvg = matrixAverages?.companyAverages?.[comp.code];
                                        return (
                                            <tr key={comp.code} className="hover:bg-blue-50/30 transition-colors">
                                                <td className="py-3.5 px-4 sticky left-0 bg-white z-10 font-bold text-gray-900 shadow-[1px_0_0_#f1f5f9]">
                                                    {comp.code}
                                                </td>
                                                {data?.weeks?.map(w => {
                                                    const cell = data.matrix?.[comp.code]?.[w.formatted_name];
                                                    const total = cell?.total_ch_mm || 0;
                                                    const avg = cell?.avg_daily_mm || 0;
                                                    const hh = cell?.hari_hujan || 0;

                                                    return (
                                                        <td key={w.id} className="py-3 px-3 text-center border-l border-gray-100">
                                                            <div className="flex flex-col items-center gap-0.5">
                                                                <div className="flex items-center gap-1">
                                                                    <span className="text-xs font-black text-gray-900">
                                                                        {total}
                                                                    </span>
                                                                    <span className="text-[9px] text-gray-400">mm</span>
                                                                </div>
                                                                <div className="flex items-center gap-1 text-[10px] text-gray-500 font-semibold">
                                                                    <span className="text-blue-600 font-bold">{avg} mm/hr</span>
                                                                    <span>·</span>
                                                                    <span className="text-purple-700 font-bold">{hh} HH</span>
                                                                </div>
                                                            </div>
                                                        </td>
                                                    );
                                                })}
                                                {/* Per-Company Average across all selected weeks */}
                                                <td className="py-3 px-3 text-center border-l-2 border-blue-200 bg-blue-50/40">
                                                    <div className="flex flex-col items-center gap-0.5">
                                                        <div className="flex items-center gap-1">
                                                            <span className="text-xs font-black text-blue-900">
                                                                {compAvg?.avgWeekly ?? 0}
                                                            </span>
                                                            <span className="text-[9px] text-blue-600 font-bold">mm/mgg</span>
                                                        </div>
                                                        <div className="flex items-center gap-1 text-[10px] text-blue-800 font-semibold">
                                                            <span>{compAvg?.avgDaily ?? 0} mm/hr</span>
                                                            <span>·</span>
                                                            <span>{compAvg?.avgHH ?? 0} HH</span>
                                                        </div>
                                                    </div>
                                                </td>
                                            </tr>
                                        );
                                    })
                                )}
                            </tbody>
                            {matrixAverages && !loading && filteredMatrixCompanies.length > 0 && (
                                <tfoot className="bg-gray-100/90 border-t-2 border-gray-200 text-xs font-black">
                                    <tr>
                                        <td className="py-3.5 px-4 sticky left-0 bg-gray-100 z-10 font-black text-blue-900 uppercase tracking-wider shadow-[1px_0_0_#e2e8f0]">
                                            RATA-RATA SEMUA PT
                                        </td>
                                        {data?.weeks?.map(w => {
                                            const wAvg = matrixAverages.weekAverages?.[w.formatted_name];
                                            return (
                                                <td key={w.id} className="py-3 px-3 text-center border-l border-gray-200">
                                                    <div className="flex flex-col items-center gap-0.5">
                                                        <div className="flex items-center gap-1">
                                                            <span className="text-xs font-black text-blue-900">
                                                                {wAvg?.avgWeekly ?? 0}
                                                            </span>
                                                            <span className="text-[9px] text-gray-500">mm</span>
                                                        </div>
                                                        <div className="flex items-center gap-1 text-[10px] text-gray-600 font-bold">
                                                            <span className="text-blue-700">{wAvg?.avgDaily ?? 0} mm/hr</span>
                                                            <span>·</span>
                                                            <span className="text-purple-800">{wAvg?.avgHH ?? 0} HH</span>
                                                        </div>
                                                    </div>
                                                </td>
                                            );
                                        })}
                                        {/* Grand Overall Average */}
                                        <td className="py-3 px-3 text-center border-l-2 border-blue-200 bg-blue-100/80">
                                            <div className="flex flex-col items-center gap-0.5">
                                                <div className="flex items-center gap-1">
                                                    <span className="text-xs font-black text-blue-950">
                                                        {matrixAverages.overall?.avgWeekly ?? 0}
                                                    </span>
                                                    <span className="text-[9px] text-blue-800 font-bold">mm/mgg</span>
                                                </div>
                                                <div className="flex items-center gap-1 text-[10px] text-blue-900 font-black">
                                                    <span>{matrixAverages.overall?.avgDaily ?? 0} mm/hr</span>
                                                    <span>·</span>
                                                    <span>{matrixAverages.overall?.avgHH ?? 0} HH</span>
                                                </div>
                                            </div>
                                        </td>
                                    </tr>
                                </tfoot>
                            )}
                        </table>
                    </div>

                    <div className="flex flex-wrap items-center gap-4 text-[10px] text-gray-400 font-bold pt-1">
                        <span>💡 Keterangan sel matriks:</span>
                        <span className="text-gray-700 font-black">Total Curah Hujan (mm)</span>
                        <span>·</span>
                        <span className="text-blue-600 font-bold">Rata-rata per Hari (mm/hr)</span>
                        <span>·</span>
                        <span className="text-purple-700 font-bold">Hari Hujan (HH)</span>
                        <span>·</span>
                        <span className="text-blue-900 font-black bg-blue-50 px-2 py-0.5 rounded">Kolom/Baris Biru: Rata-rata Mingguan</span>
                    </div>
                </div>
            )}
        </div>
    );
}

