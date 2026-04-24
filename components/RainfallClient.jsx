"use client";

import { useState, useEffect, useCallback } from 'react';
import { CloudRain, Building2, CalendarDays, RefreshCw, AlertTriangle, TrendingUp, Droplets, Map } from 'lucide-react';
import SearchableSelect from './SearchableSelect';
import { Chart as ChartJS, CategoryScale, LinearScale, PointElement, LineElement, BarElement, Title, Tooltip, Legend, Filler } from 'chart.js';
import { Line, Bar } from 'react-chartjs-2';

ChartJS.register(CategoryScale, LinearScale, PointElement, LineElement, BarElement, Title, Tooltip, Legend, Filler);

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
    const [loading, setLoading] = useState(true);
    const [data, setData] = useState(null);
    const [error, setError] = useState(null);

    const fetchData = useCallback(async (selectedCompany) => {
        setLoading(true);
        setError(null);
        try {
            const params = new URLSearchParams({ company: selectedCompany });
            // Using existing dashboard-summary for now as it contains rainfallData
            const res = await fetch(`/api/dashboard-summary?${params}`);
            if (!res.ok) throw new Error(`Error: ${res.status}`);
            const json = await res.json();
            setData(json);
        } catch (e) {
            setError(e.message);
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => {
        fetchData(company);
    }, [company, fetchData]);

    // Trend Chart Data (Mocking daily trend if not fully available, or use weekly)
    const trendData = data?.weeklyData ? {
        labels: data.weeklyData.map(w => w.week),
        datasets: [{
            label: 'Avg Rainfall (mm)',
            data: data.weeklyData.map(() => Math.floor(Math.random() * 50)), // Mocking daily variations for now
            borderColor: '#3B82F6',
            backgroundColor: 'rgba(59, 130, 246, 0.1)',
            fill: true,
            tension: 0.4,
            pointRadius: 4,
        }]
    } : null;

    return (
        <div className="space-y-6">
            {/* Header */}
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div>
                    <h1 className="text-3xl font-bold tracking-tight text-gray-900 flex items-center gap-3">
                        Rainfall Analysis
                    </h1>
                    <p className="text-sm text-gray-500 mt-1">Monitoring intensitas dan distribusi curah hujan per estate.</p>
                </div>
                <div className="flex items-center gap-3">
                    <SearchableSelect
                        icon={<Building2 size={14} />}
                        options={COMPANIES}
                        value={company}
                        onChange={setCompany}
                        placeholder="Pilih Company..."
                        className="min-w-[180px]"
                    />
                    <button
                        onClick={() => fetchData(company)}
                        className="p-2 rounded-xl border border-gray-200 bg-white hover:bg-gray-50 transition-colors"
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
                    label="Total Rainfall (Current Period)"
                    value={data?.rainfallData ? `${data.rainfallData.reduce((acc, curr) => acc + (parseFloat(curr.total_mm) || 0), 0).toFixed(0)} mm` : '–'}
                    sub="Cumulative across all estates"
                    icon={<CloudRain size={16} />}
                    color="#3B82F6"
                    loading={loading}
                />
                <RainCard
                    label="Avg Daily Intensity"
                    value={data?.rainfallData ? `${(data.rainfallData.reduce((acc, curr) => acc + (parseFloat(curr.avg_daily_mm) || 0), 0) / (data.rainfallData.length || 1)).toFixed(1)} mm` : '–'}
                    sub="Daily average for selected company"
                    icon={<TrendingUp size={16} />}
                    color="#10B981"
                    loading={loading}
                />
                <RainCard
                    label="Wettest Estate"
                    value={data?.rainfallData?.length > 0 ? data.rainfallData.sort((a,b) => b.total_mm - a.total_mm)[0].est_code : '–'}
                    sub={data?.rainfallData?.length > 0 ? `${data.rainfallData[0].total_mm} mm total` : 'No data'}
                    icon={<Map size={16} />}
                    color="#8B5CF6"
                    loading={loading}
                />
            </div>

            {/* Charts Section */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                <div className="glass-card p-6 lg:col-span-2">
                    <h3 className="text-sm font-bold text-gray-800 mb-4">Rainfall Trend (Recent Weeks)</h3>
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
                        ) : <div className="h-full flex items-center justify-center text-gray-400">No data available</div>}
                    </div>
                </div>

                <div className="glass-card p-6 flex flex-col">
                    <h3 className="text-sm font-bold text-gray-800 mb-4">Rain Days Distribution</h3>
                    <div className="flex-1 flex flex-col justify-center">
                        {loading ? (
                            <div className="h-48 flex items-center justify-center">
                                <RefreshCw className="animate-spin text-gray-200" size={32} />
                            </div>
                        ) : data?.rainfallData ? (
                            <div className="space-y-4">
                                {data.rainfallData.slice(0, 5).map((r, i) => (
                                    <div key={i} className="space-y-1">
                                        <div className="flex justify-between text-xs font-medium text-gray-600">
                                            <span>{r.est_code}</span>
                                            <span>{r.hari_hujan} / {r.total_hari} days</span>
                                        </div>
                                        <div className="w-full bg-gray-100 rounded-full h-1.5 overflow-hidden">
                                            <div
                                                className="bg-blue-500 h-full rounded-full"
                                                style={{ width: `${(r.hari_hujan / (r.total_hari || 1)) * 100}%` }}
                                            />
                                        </div>
                                    </div>
                                ))}
                            </div>
                        ) : <div className="text-gray-400 text-center">No data available</div>}
                    </div>
                </div>
            </div>

            {/* Estate Detail Table */}
            <div className="glass-card overflow-hidden">
                <div className="p-6 border-b border-gray-100 bg-gray-50/30">
                    <h3 className="text-sm font-bold text-gray-800">Rainfall Detail per Estate</h3>
                </div>
                <div className="overflow-x-auto">
                    <table className="w-full text-sm text-left">
                        <thead className="text-xs text-gray-500 uppercase bg-gray-50">
                            <tr>
                                <th className="px-6 py-3">Estate</th>
                                <th className="px-6 py-3">Company</th>
                                <th className="px-6 py-3 text-right">Total (mm)</th>
                                <th className="px-6 py-3 text-right">Rainy Days</th>
                                <th className="px-6 py-3 text-right">Avg Daily</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-100 bg-white">
                            {data?.rainfallData?.map((r, i) => (
                                <tr key={i} className="hover:bg-gray-50 transition-colors">
                                    <td className="px-6 py-4 font-semibold text-gray-900">{r.est_code}</td>
                                    <td className="px-6 py-4 text-gray-500 text-xs">{r.company_code}</td>
                                    <td className="px-6 py-4 text-right font-medium text-blue-600">{r.total_mm} mm</td>
                                    <td className="px-6 py-4 text-right">
                                        <span className="px-2 py-1 bg-blue-50 text-blue-700 rounded-lg text-xs font-bold">
                                            {r.hari_hujan} days
                                        </span>
                                    </td>
                                    <td className="px-6 py-4 text-right text-gray-500">{r.avg_daily_mm} mm</td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            </div>
        </div>
    );
}
