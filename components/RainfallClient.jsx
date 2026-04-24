"use client";

import { useState, useEffect, useCallback } from 'react';
import { CloudRain, Building2, CalendarDays, RefreshCw, AlertTriangle, TrendingUp, Map } from 'lucide-react';
import SearchableSelect from './SearchableSelect';
import { Chart as ChartJS, CategoryScale, LinearScale, PointElement, LineElement, BarElement, Title, Tooltip, Legend, Filler, LineController, BarController } from 'chart.js';
import { Line } from 'react-chartjs-2';

ChartJS.register(CategoryScale, LinearScale, PointElement, LineElement, BarElement, Title, Tooltip, Legend, Filler, LineController, BarController);

const COMPANIES = ['Semua', 'PT.THIP', 'PT.PTW', 'PT.SUMS', 'PT.WKN', 'PT.PANPS', 'PT.SAM', 'PT.NJP', 'PT.PLDK', 'PT.SUMK', 'PT.BAS', 'PT.AAN', 'PT.GAN', 'PT.AJP', 'PT.JJP', 'PT.SIP', 'PT.WSM'];

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

export default function RainfallClient() {
    const [company, setCompany] = useState('Semua');
    
    // Default: Last 30 days
    const [startDate, setStartDate] = useState(() => {
        const d = new Date();
        d.setDate(d.getDate() - 30);
        return d.toISOString().split('T')[0];
    });
    const [endDate, setEndDate] = useState(() => new Date().toISOString().split('T')[0]);

    const [loading, setLoading] = useState(true);
    const [data, setData] = useState(null);
    const [error, setError] = useState(null);

    const fetchData = useCallback(async (selectedCompany, start, end) => {
        setLoading(true);
        setError(null);
        try {
            const params = new URLSearchParams({ 
                company: selectedCompany,
                start: start,
                end: end
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
        fetchData(company, startDate, endDate);
    }, [company, startDate, endDate, fetchData]);

    // Trend Chart Data
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

    // Sorted Rain Days: Highest to Lowest
    const sortedRainDays = data?.summary ? [...data.summary].sort((a, b) => b.hari_hujan - a.hari_hujan) : [];

    return (
        <div className="space-y-6">
            {/* Header */}
            <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
                <div>
                    <h1 className="text-3xl font-bold tracking-tight text-gray-900 flex items-center gap-3">
                        Analisis Curah Hujan
                    </h1>
                    <p className="text-sm text-gray-500 mt-1">Monitoring intensitas dan distribusi curah hujan per estate secara real-time.</p>
                </div>
                
                <div className="flex flex-wrap items-center gap-3">
                    {/* Date Filters */}
                    <div className="flex items-center gap-2 bg-white/70 backdrop-blur-sm border border-gray-200 p-1 rounded-xl shadow-sm">
                        <div className="flex items-center gap-2 px-2 border-r border-gray-100">
                            <CalendarDays size={14} className="text-gray-400" />
                            <input 
                                type="date" 
                                value={startDate}
                                onChange={e => setStartDate(e.target.value)}
                                className="text-xs font-medium outline-none bg-transparent py-1"
                            />
                        </div>
                        <div className="flex items-center gap-2 px-2">
                            <input 
                                type="date" 
                                value={endDate}
                                onChange={e => setEndDate(e.target.value)}
                                className="text-xs font-medium outline-none bg-transparent py-1"
                            />
                        </div>
                    </div>

                    <SearchableSelect
                        icon={<Building2 size={14} />}
                        options={COMPANIES}
                        value={company}
                        onChange={setCompany}
                        placeholder="Pilih Company..."
                        className="min-w-[150px]"
                    />
                    <button
                        onClick={() => fetchData(company, startDate, endDate)}
                        className="p-2 rounded-xl border border-gray-200 bg-white hover:bg-gray-50 transition-colors shadow-sm"
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

            {/* Metrics */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <RainCard
                    label="Total Curah Hujan"
                    value={data?.summary ? `${data.summary.reduce((acc, curr) => acc + (parseFloat(curr.total_mm) || 0), 0).toFixed(0)} mm` : '–'}
                    sub="Kumulatif seluruh estate"
                    icon={<CloudRain size={16} />}
                    color="#3B82F6"
                    loading={loading}
                />
                <RainCard
                    label="Rata-rata Intensitas"
                    value={data?.summary ? `${(data.summary.reduce((acc, curr) => acc + (parseFloat(curr.avg_daily_mm) || 0), 0) / (data.summary.length || 1)).toFixed(1)} mm` : '–'}
                    sub="Rata-rata harian per estate"
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

            {/* Charts Section */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                <div className="glass-card p-6 lg:col-span-2">
                    <h3 className="text-sm font-bold text-gray-800 mb-1">Tren Curah Hujan Harian</h3>
                    <p className="text-xs text-gray-400 mb-4">Rata-rata mm di seluruh area aktif</p>
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
                        ) : sortedRainDays.length > 0 ? (
                            <div className="space-y-4">
                                {sortedRainDays.map((r, i) => (
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

            {/* Estate Intensity Heatmap */}
            <div className="glass-card p-6">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between mb-6 gap-3">
                    <div>
                        <h3 className="text-sm font-bold text-gray-800">Estate Intensity Heatmap</h3>
                        <p className="text-xs text-gray-400 mt-0.5">Distribusi spasial intensitas hujan per estate.</p>
                    </div>
                    <div className="flex flex-wrap items-center gap-4 text-[10px] text-gray-500 font-medium">
                        <div className="flex items-center gap-1.5"><div className="w-2.5 h-2.5 rounded-sm bg-gray-100"></div> 0mm</div>
                        <div className="flex items-center gap-1.5"><div className="w-2.5 h-2.5 rounded-sm bg-blue-100"></div> 1-20mm</div>
                        <div className="flex items-center gap-1.5"><div className="w-2.5 h-2.5 rounded-sm bg-blue-400"></div> 21-50mm</div>
                        <div className="flex items-center gap-1.5"><div className="w-2.5 h-2.5 rounded-sm bg-blue-600"></div> 51-100mm</div>
                        <div className="flex items-center gap-1.5"><div className="w-2.5 h-2.5 rounded-sm bg-indigo-800"></div> &gt;100mm</div>
                    </div>
                </div>

                <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 xl:grid-cols-8 gap-3">
                    {loading ? (
                        Array.from({ length: 12 }).map((_, i) => (
                            <div key={i} className="h-16 bg-gray-100 animate-pulse rounded-xl" />
                        ))
                    ) : data?.summary?.length > 0 ? (
                        data.summary.map((r, i) => {
                            const val = parseFloat(r.total_mm) || 0;
                            let colorClass = 'bg-gray-100 text-gray-400';
                            if (val > 100) colorClass = 'bg-indigo-800 text-white shadow-lg shadow-indigo-200';
                            else if (val > 50) colorClass = 'bg-blue-600 text-white shadow-lg shadow-blue-200';
                            else if (val > 20) colorClass = 'bg-blue-400 text-white';
                            else if (val > 0)  colorClass = 'bg-blue-100 text-blue-700';

                            return (
                                <div key={i} className={`${colorClass} p-3 rounded-xl flex flex-col justify-between h-20 transition-all hover:scale-105 cursor-default`}>
                                    <span className="text-[10px] font-bold uppercase tracking-tight opacity-80">{r.est_code}</span>
                                    <div className="flex items-baseline gap-0.5">
                                        <span className="text-lg font-black">{val.toFixed(0)}</span>
                                        <span className="text-[10px] font-medium opacity-70">mm</span>
                                    </div>
                                </div>
                            );
                        })
                    ) : (
                        <div className="col-span-full py-12 text-center text-gray-400 text-sm italic">
                            Belum ada data heatmap untuk periode ini.
                        </div>
                    )}
                </div>
            </div>

            {/* Estate Detail Table */}
            <div className="glass-card overflow-hidden">
                <div className="p-6 border-b border-gray-100 bg-gray-50/30">
                    <h3 className="text-sm font-bold text-gray-800">Detail Curah Hujan per Estate</h3>
                </div>
                <div className="overflow-x-auto">
                    <table className="w-full text-sm text-left">
                        <thead className="text-xs text-gray-500 uppercase bg-gray-50">
                            <tr>
                                <th className="px-6 py-3">Estate</th>
                                <th className="px-6 py-3">Company</th>
                                <th className="px-6 py-3 text-right">Total (mm)</th>
                                <th className="px-6 py-3 text-right">Hari Hujan</th>
                                <th className="px-6 py-3 text-right">Rata-rata Harian</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-100 bg-white">
                            {data?.summary?.map((r, i) => (
                                <tr key={i} className="hover:bg-gray-50 transition-colors">
                                    <td className="px-6 py-4 font-semibold text-gray-900">{r.est_code}</td>
                                    <td className="px-6 py-4 text-gray-500 text-xs">{r.company_code}</td>
                                    <td className="px-6 py-4 text-right font-medium text-blue-600">{r.total_mm} mm</td>
                                    <td className="px-6 py-4 text-right">
                                        <span className="px-2 py-1 bg-blue-50 text-blue-700 rounded-lg text-xs font-bold">
                                            {r.hari_hujan} Hari
                                        </span>
                                    </td>
                                    <td className="px-6 py-4 text-right text-gray-500">{r.avg_daily_mm} mm/hari</td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            </div>
        </div>
    );
}
