"use client";

import { useState, useEffect, useCallback, useMemo } from 'react';
import { CloudRain, Building2, CalendarDays, RefreshCw, AlertTriangle, TrendingUp, Map, Filter, Search, ChevronUp, ChevronDown } from 'lucide-react';
import SearchableSelect from './SearchableSelect';
import { Chart as ChartJS, CategoryScale, LinearScale, PointElement, LineElement, BarElement, Title, Tooltip, Legend, Filler, LineController, BarController } from 'chart.js';
import { Line } from 'react-chartjs-2';

ChartJS.register(CategoryScale, LinearScale, PointElement, LineElement, BarElement, Title, Tooltip, Legend, Filler, LineController, BarController);

const COMPANIES = ['Semua', 'PT.THIP', 'PT.PTW', 'PT.SUMS', 'PT.WKN', 'PT.PANPS', 'PT.SAM', 'PT.NJP', 'PT.PLDK', 'PT.SUMK', 'PT.BAS', 'PT.AAN', 'PT.GAN', 'PT.AJP', 'PT.JJP', 'PT.SIP', 'PT.WSM'];

// Helper to generate ALL days of 2026
function generateFullYear2026() {
    const days = [];
    const start = new Date('2026-01-01');
    const end = new Date('2026-12-31');
    for (let d = new Date(start); d <= end; d.setDate(d.getDate() + 1)) {
        days.push(d.toISOString().split('T')[0]);
    }
    return days;
}

function RainCard({ label, value, sub, icon, color = '#3B82F6', loading }) {
    return (
        <div className="glass-card p-5 flex flex-col gap-3">
            <div className="flex items-start justify-between">
                <span className="text-xs font-semibold text-gray-500 uppercase tracking-wider">{label}</span>
                <div className="w-8 h-8 rounded-lg flex items-center justify-center" style={{ background: `${color}15` }}>
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

function CalendarHeatmap({ yearTrend, loading, onEstateChange, selectedEstate, estates = [] }) {
    const days = generateFullYear2026();
    const dataMap = yearTrend ? Object.fromEntries(yearTrend.map(t => [t.date, t.avg_mm])) : {};
    const todayStr = new Date().toISOString().split('T')[0];

    const months = ['Jan', 'Feb', 'Mar', 'Apr', 'Mei', 'Jun', 'Jul', 'Ags', 'Sep', 'Okt', 'Nov', 'Des'];
    
    const monthGroups = useMemo(() => {
        const groups = [];
        let currentMonth = -1;
        days.forEach(day => {
            const d = new Date(day);
            const m = d.getMonth();
            if (m !== currentMonth) {
                groups.push({ month: months[m], days: [] });
                currentMonth = m;
            }
            groups[groups.length - 1].days.push(day);
        });
        return groups;
    }, [days]);

    const getColor = (val, day) => {
        if (day > todayStr) return '#fafafa'; // Future dates
        const v = parseFloat(val) || 0;
        if (v === 0) return '#9E9E9E'; // Kering
        if (v <= 20) return '#2196F3'; // Ringan
        if (v <= 50) return '#FFC107'; // Sedang
        if (v <= 100) return '#F44336'; // Lebat
        return '#B71C1C'; // Sangat Lebat
    };

    return (
        <div className="glass-card p-6 overflow-x-auto custom-scrollbar">
            <div className="flex flex-col lg:flex-row lg:items-center justify-between mb-8 gap-6">
                <div>
                    <h3 className="text-sm font-bold text-gray-800">Kalender Intensitas Hujan (2026)</h3>
                    <p className="text-xs text-gray-400 mt-0.5">Filter lokal per estate khusus untuk kalender ini.</p>
                </div>
                
                <div className="flex flex-wrap items-center gap-4">
                    {/* Local Estate Filter */}
                    <div className="flex items-center gap-2 bg-gray-50 p-1.5 rounded-xl border border-gray-100">
                        <Map size={12} className="text-gray-400 ml-1" />
                        <SearchableSelect
                            options={['Semua', ...estates]}
                            value={selectedEstate}
                            onChange={onEstateChange}
                            placeholder="Pilih Estate..."
                            className="w-[180px]"
                        />
                    </div>

                    <div className="flex flex-wrap items-center gap-3 text-[10px] text-gray-500 font-bold">
                        <div className="flex items-center gap-1"><div className="w-2.5 h-2.5 rounded-sm" style={{backgroundColor: '#9E9E9E'}}></div> 0mm</div>
                        <div className="flex items-center gap-1"><div className="w-2.5 h-2.5 rounded-sm" style={{backgroundColor: '#2196F3'}}></div> 1-20</div>
                        <div className="flex items-center gap-1"><div className="w-2.5 h-2.5 rounded-sm" style={{backgroundColor: '#FFC107'}}></div> 21-50</div>
                        <div className="flex items-center gap-1"><div className="w-2.5 h-2.5 rounded-sm" style={{backgroundColor: '#F44336'}}></div> 51-100</div>
                        <div className="flex items-center gap-1"><div className="w-2.5 h-2.5 rounded-sm" style={{backgroundColor: '#B71C1C'}}></div> &gt;100</div>
                        <div className="flex items-center gap-1"><div className="w-2.5 h-2.5 rounded-sm" style={{backgroundColor: '#fafafa', border: '1px solid #eee'}}></div> Mendatang</div>
                    </div>
                </div>
            </div>

            <div className="flex gap-6 min-w-max pb-4">
                {monthGroups.map((mg, idx) => (
                    <div key={idx} className="flex flex-col gap-2">
                        <span className="text-[10px] font-bold text-gray-400 uppercase text-center border-b border-gray-50 pb-1">{mg.month}</span>
                        <div className="grid grid-cols-7 gap-1">
                            {mg.days.map(day => {
                                const val = dataMap[day] || 0;
                                return (
                                    <div 
                                        key={day}
                                        title={`${day}: ${day > todayStr ? 'Mendatang' : (val + ' mm')}`}
                                        className={`w-3.5 h-3.5 rounded-[2px] transition-all ${day <= todayStr ? 'hover:scale-150 hover:z-10 cursor-pointer' : ''}`}
                                        style={{ backgroundColor: getColor(val, day) }}
                                    />
                                );
                            })}
                        </div>
                    </div>
                ))}
            </div>
        </div>
    );
}

export default function RainfallClient() {
    const [company, setCompany] = useState('Semua');
    const [startDate, setStartDate] = useState(() => {
        const d = new Date();
        d.setDate(d.getDate() - 30);
        return d.toISOString().split('T')[0];
    });
    const [endDate, setEndDate] = useState(() => new Date().toISOString().split('T')[0]);
    const [showDatePicker, setShowDatePicker] = useState(false);

    // Table States
    const [currentPage, setCurrentPage] = useState(1);
    const [searchTerm, setSearchTerm] = useState('');
    const [sortConfig, setSortConfig] = useState({ key: 'total_mm', direction: 'desc' });

    // Heatmap Local Filter
    const [heatmapEstate, setHeatmapEstate] = useState('Semua');

    const [loading, setLoading] = useState(true);
    const [data, setData] = useState(null);
    const [error, setError] = useState(null);

    const fetchData = useCallback(async (selectedCompany, start, end, hmEstate) => {
        setLoading(true);
        setError(null);
        try {
            const params = new URLSearchParams({ 
                company: selectedCompany,
                start: start,
                end: end,
                hmCompany: selectedCompany,
                hmEstate: hmEstate
            });
            const res = await fetch(`/api/rainfall-history?${params}`);
            if (!res.ok) throw new Error(`Gagal memuat data: ${res.status}`);
            const json = await res.json();
            setData(json);
        } catch (e) {
            setError(e.message);
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => {
        fetchData(company, startDate, endDate, heatmapEstate);
    }, [company, startDate, endDate, heatmapEstate, fetchData]);

    useEffect(() => {
        setHeatmapEstate('Semua');
        setCurrentPage(1);
        setSearchTerm('');
    }, [company]);

    const availableEstates = useMemo(() => {
        if (!data?.summary) return [];
        return [...new Set(data.summary.map(r => r.est_code))].sort((a, b) => 
            a.localeCompare(b, undefined, { numeric: true, sensitivity: 'base' })
        );
    }, [data]);

    // Filtered and Sorted Table Data
    const filteredAndSortedData = useMemo(() => {
        if (!data?.summary) return [];
        
        let processed = data.summary.filter(r => 
            r.est_code.toLowerCase().includes(searchTerm.toLowerCase()) ||
            r.company_code.toLowerCase().includes(searchTerm.toLowerCase())
        );

        if (sortConfig.key) {
            processed.sort((a, b) => {
                if (sortConfig.key === 'est_code' || sortConfig.key === 'company_code') {
                    const res = a[sortConfig.key].localeCompare(b[sortConfig.key], undefined, { numeric: true, sensitivity: 'base' });
                    return sortConfig.direction === 'asc' ? res : -res;
                }
                const aVal = parseFloat(a[sortConfig.key]) || 0;
                const bVal = parseFloat(b[sortConfig.key]) || 0;
                if (aVal < bVal) return sortConfig.direction === 'asc' ? -1 : 1;
                if (aVal > bVal) return sortConfig.direction === 'asc' ? 1 : -1;
                return 0;
            });
        }
        return processed;
    }, [data, searchTerm, sortConfig]);

    const handleSort = (key) => {
        setSortConfig(prev => ({
            key,
            direction: prev.key === key && prev.direction === 'desc' ? 'asc' : 'desc'
        }));
    };

    const trendData = data?.trend ? {
        labels: data.trend.map(t => {
            const d = new Date(t.date);
            return `${d.getDate()}/${d.getMonth() + 1}`;
        }),
        datasets: [{
            label: 'Rata-rata Hujan (mm)',
            data: data.trend.map(t => t.avg_mm),
            borderColor: '#3B82F6',
            backgroundColor: 'rgba(59, 130, 246, 0.1)',
            fill: true,
            tension: 0.4,
            pointRadius: 2,
        }]
    } : null;

    const sortedRainDaysSummary = data?.summary ? [...data.summary].sort((a, b) => b.hari_hujan - a.hari_hujan) : [];

    return (
        <div className="space-y-6">
            {/* Header */}
            <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
                <div>
                    <h1 className="text-3xl font-bold tracking-tight text-gray-900 flex items-center gap-3">
                        Analisis Curah Hujan
                    </h1>
                    <p className="text-sm text-gray-500 mt-1">Monitoring intensitas dan distribusi curah hujan secara mendalam.</p>
                </div>
                
                <div className="flex flex-wrap items-center gap-3">
                    <div className="relative">
                        <button 
                            onClick={() => setShowDatePicker(!showDatePicker)}
                            className="flex items-center gap-3 px-4 py-2.5 bg-white border border-gray-200 rounded-xl shadow-sm text-xs font-bold text-gray-700 hover:border-gray-400 transition-all min-w-[220px] justify-between"
                        >
                            <div className="flex items-center gap-2">
                                <CalendarDays size={14} className="text-gray-400" />
                                <span>{startDate} – {endDate}</span>
                            </div>
                            <RefreshCw size={12} className={`text-gray-300 ${loading ? 'animate-spin' : ''}`} />
                        </button>

                        {showDatePicker && (
                            <div className="absolute z-50 mt-2 right-0 bg-white border border-gray-200 p-5 rounded-2xl shadow-2xl flex flex-col gap-4 min-w-[320px] animate-in fade-in zoom-in duration-200">
                                <h4 className="text-[10px] font-black text-gray-400 uppercase tracking-widest">Pilih Rentang Tanggal</h4>
                                <div className="grid grid-cols-2 gap-4">
                                    <div className="flex flex-col gap-1.5">
                                        <label className="text-[10px] font-bold text-gray-500">Mulai</label>
                                        <input 
                                            type="date" 
                                            value={startDate}
                                            onChange={e => setStartDate(e.target.value)}
                                            className="text-xs font-medium border border-gray-100 p-2 rounded-lg bg-gray-50 outline-none focus:ring-2 focus:ring-black/5"
                                        />
                                    </div>
                                    <div className="flex flex-col gap-1.5">
                                        <label className="text-[10px] font-bold text-gray-500">Selesai</label>
                                        <input 
                                            type="date" 
                                            value={endDate}
                                            onChange={e => setEndDate(e.target.value)}
                                            className="text-xs font-medium border border-gray-100 p-2 rounded-lg bg-gray-50 outline-none focus:ring-2 focus:ring-black/5"
                                        />
                                    </div>
                                </div>
                                <div className="flex gap-2">
                                    <button 
                                        onClick={() => {
                                            const d = new Date();
                                            d.setDate(d.getDate() - 30);
                                            setStartDate(d.toISOString().split('T')[0]);
                                            setEndDate(new Date().toISOString().split('T')[0]);
                                        }}
                                        className="flex-1 bg-gray-100 text-gray-600 text-[10px] font-bold py-2.5 rounded-xl hover:bg-gray-200 transition-colors"
                                    >
                                        30 Hari Terakhir
                                    </button>
                                    <button 
                                        onClick={() => setShowDatePicker(false)}
                                        className="flex-1 bg-black text-white text-[10px] font-bold py-2.5 rounded-xl hover:bg-gray-800 transition-colors"
                                    >
                                        Terapkan
                                    </button>
                                </div>
                            </div>
                        )}
                    </div>

                    <SearchableSelect
                        icon={<Building2 size={14} />}
                        options={COMPANIES}
                        value={company}
                        onChange={setCompany}
                        placeholder="Pilih Company..."
                        className="min-w-[150px]"
                    />
                </div>
            </div>

            {error && (
                <div className="bg-red-50 border border-red-200 text-red-700 text-sm px-4 py-3 rounded-xl flex items-center gap-2">
                    <AlertTriangle size={16} /> {error}
                </div>
            )}

            {/* Metrics */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <RainCard
                    label="Total Curah Hujan"
                    value={data?.summary ? `${data.summary.reduce((acc, curr) => acc + (parseFloat(curr.total_mm) || 0), 0).toFixed(0)} mm` : '–'}
                    sub="Kumulatif periode terpilih"
                    icon={<CloudRain size={16} />}
                    color="#3B82F6"
                    loading={loading}
                />
                <RainCard
                    label="Rata-rata Intensitas"
                    value={data?.summary ? `${(data.summary.reduce((acc, curr) => acc + (parseFloat(curr.avg_daily_mm) || 0), 0) / (data.summary.length || 1)).toFixed(1)} mm` : '–'}
                    sub="Rata-rata harian gabungan"
                    icon={<TrendingUp size={16} />}
                    color="#10B981"
                    loading={loading}
                />
                <RainCard
                    label="Estate Terbasah"
                    value={data?.summary?.length > 0 ? data.summary[0].est_code : '–'}
                    sub={data?.summary?.length > 0 ? `${data.summary[0].total_mm} mm total` : 'Tidak ada data'}
                    icon={<Map size={16} />}
                    color="#8B5CF6"
                    loading={loading}
                />
            </div>

            {/* Calendar Heatmap */}
            <CalendarHeatmap 
                yearTrend={data?.yearTrend} 
                loading={loading} 
                onEstateChange={setHeatmapEstate}
                selectedEstate={heatmapEstate}
                estates={availableEstates}
            />

            {/* Charts Section */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                <div className="glass-card p-6 lg:col-span-2">
                    <h3 className="text-sm font-bold text-gray-800 mb-1">Tren Curah Hujan Harian</h3>
                    <p className="text-xs text-gray-400 mb-4">Rata-rata mm di seluruh area terpilih</p>
                    <div className="h-[300px]">
                        {loading ? (
                            <div className="h-full flex items-center justify-center">
                                <RefreshCw className="animate-spin text-gray-200" size={32} />
                            </div>
                        ) : trendData ? (
                            <Line data={trendData} options={{
                                responsive: true,
                                maintainAspectRatio: false,
                                plugins: { legend: { display: false } },
                                scales: {
                                    y: { beginAtZero: true, grid: { color: '#f3f4f6' } },
                                    x: { grid: { display: false } }
                                }
                            }} />
                        ) : <div className="h-full flex items-center justify-center text-gray-400">Data tidak tersedia</div>}
                    </div>
                </div>

                <div className="glass-card p-6 flex flex-col">
                    <h3 className="text-sm font-bold text-gray-800 mb-1">Distribusi Hari Hujan</h3>
                    <p className="text-xs text-gray-400 mb-4">Urutan estate dengan hari hujan terbanyak</p>
                    <div className="flex-1 overflow-y-auto max-h-[300px] pr-2 custom-scrollbar">
                        {loading ? (
                            <div className="h-48 flex items-center justify-center">
                                <RefreshCw className="animate-spin text-gray-200" size={32} />
                            </div>
                        ) : sortedRainDaysSummary.length > 0 ? (
                            <div className="space-y-4">
                                {sortedRainDaysSummary.map((r, i) => (
                                    <div key={i} className="space-y-1">
                                        <div className="flex justify-between text-[11px] font-semibold text-gray-600">
                                            <span>{r.est_code}</span>
                                            <span>{r.hari_hujan} / {r.total_hari} Hari</span>
                                        </div>
                                        <div className="w-full bg-gray-100 rounded-full h-1.5 overflow-hidden">
                                            <div
                                                className="bg-blue-500 h-full rounded-full transition-all duration-1000"
                                                style={{ width: `${(r.hari_hujan / (r.total_hari || 1)) * 100}%` }}
                                            />
                                        </div>
                                    </div>
                                ))}
                            </div>
                        ) : <div className="text-gray-400 text-center text-sm py-10 italic">Data tidak tersedia</div>}
                    </div>
                </div>
            </div>

            {/* Estate Detail Table */}
            <div className="glass-card overflow-hidden">
                <div className="p-6 border-b border-gray-100 bg-gray-50/30 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                    <div>
                        <h3 className="text-sm font-bold text-gray-800">Detail Curah Hujan per Estate</h3>
                        <p className="text-[10px] text-gray-400 font-bold uppercase mt-0.5">Total: {filteredAndSortedData.length} Estate</p>
                    </div>
                    
                    {/* Search / Typeahead */}
                    <div className="relative w-full sm:w-64">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={14} />
                        <input 
                            type="text" 
                            value={searchTerm}
                            onChange={e => {
                                setSearchTerm(e.target.value);
                                setCurrentPage(1);
                            }}
                            placeholder="Cari Estate atau PT..."
                            className="w-full pl-9 pr-4 py-2 bg-white border border-gray-200 rounded-xl text-xs outline-none focus:border-blue-400 transition-all shadow-sm"
                        />
                    </div>
                </div>

                <div className="overflow-x-auto">
                    <table className="w-full text-sm text-left">
                        <thead className="text-[10px] text-gray-500 uppercase bg-gray-50 font-black">
                            <tr>
                                <th className="px-6 py-4">Estate</th>
                                <th className="px-6 py-4">Company</th>
                                <th 
                                    className="px-6 py-4 text-right cursor-pointer hover:bg-gray-100 transition-colors"
                                    onClick={() => handleSort('total_mm')}
                                >
                                    <div className="flex items-center justify-end gap-1">
                                        Total (mm)
                                        {sortConfig.key === 'total_mm' && (sortConfig.direction === 'desc' ? <ChevronDown size={12} /> : <ChevronUp size={12} />)}
                                    </div>
                                </th>
                                <th 
                                    className="px-6 py-4 text-right cursor-pointer hover:bg-gray-100 transition-colors"
                                    onClick={() => handleSort('hari_hujan')}
                                >
                                    <div className="flex items-center justify-end gap-1">
                                        Hari Hujan
                                        {sortConfig.key === 'hari_hujan' && (sortConfig.direction === 'desc' ? <ChevronDown size={12} /> : <ChevronUp size={12} />)}
                                    </div>
                                </th>
                                <th 
                                    className="px-6 py-4 text-right cursor-pointer hover:bg-gray-100 transition-colors"
                                    onClick={() => handleSort('avg_daily_mm')}
                                >
                                    <div className="flex items-center justify-end gap-1">
                                        Rata-rata Harian
                                        {sortConfig.key === 'avg_daily_mm' && (sortConfig.direction === 'desc' ? <ChevronDown size={12} /> : <ChevronUp size={12} />)}
                                    </div>
                                </th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-100 bg-white">
                            {filteredAndSortedData.slice((currentPage - 1) * 5, currentPage * 5).map((r, i) => (
                                <tr key={i} className="hover:bg-gray-50 transition-colors group">
                                    <td className="px-6 py-4 font-bold text-gray-900 group-hover:text-blue-600 transition-colors">{r.est_code}</td>
                                    <td className="px-6 py-4 text-gray-500 text-[10px] font-bold">{r.company_code}</td>
                                    <td className="px-6 py-4 text-right font-black text-blue-600 bg-blue-50/30">{r.total_mm} mm</td>
                                    <td className="px-6 py-4 text-right">
                                        <span className="px-2.5 py-1 bg-blue-100 text-blue-800 rounded-full text-[10px] font-black uppercase">
                                            {r.hari_hujan} Hari
                                        </span>
                                    </td>
                                    <td className="px-6 py-4 text-right text-gray-500 font-medium">{r.avg_daily_mm} mm/hari</td>
                                </tr>
                            ))}
                            {filteredAndSortedData.length === 0 && (
                                <tr>
                                    <td colSpan="5" className="px-6 py-12 text-center">
                                        <Search className="mx-auto text-gray-200 mb-2" size={32} />
                                        <p className="text-gray-400 text-xs italic">Data tidak ditemukan untuk pencarian "{searchTerm}"</p>
                                    </td>
                                </tr>
                            )}
                        </tbody>
                    </table>
                </div>

                {/* Pagination Controls */}
                {filteredAndSortedData.length > 5 && (
                    <div className="px-6 py-4 bg-gray-50/50 border-t border-gray-100 flex items-center justify-between">
                        <div className="text-[10px] font-bold text-gray-400 uppercase">
                            Halaman {currentPage} dari {Math.ceil(filteredAndSortedData.length / 5)}
                        </div>
                        <div className="flex items-center gap-2">
                            <button 
                                onClick={() => setCurrentPage(prev => Math.max(1, prev - 1))}
                                disabled={currentPage === 1}
                                className="px-3 py-2 text-[10px] font-black uppercase rounded-xl border border-gray-200 bg-white hover:bg-gray-50 disabled:opacity-30 transition-all shadow-sm"
                            >
                                Sebelumnya
                            </button>
                            <button 
                                onClick={() => setCurrentPage(prev => Math.min(Math.ceil(filteredAndSortedData.length / 5), prev + 1))}
                                disabled={currentPage === Math.ceil(filteredAndSortedData.length / 5)}
                                className="px-3 py-2 text-[10px] font-black uppercase rounded-xl border border-gray-200 bg-white hover:bg-gray-50 disabled:opacity-30 transition-all shadow-sm"
                            >
                                Berikutnya
                            </button>
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
}
