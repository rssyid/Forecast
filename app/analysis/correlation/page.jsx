"use client";

import { useState, useEffect, useCallback } from 'react';
import { Chart as ChartJS, LinearScale, PointElement, LineElement, Tooltip, Legend } from 'chart.js';
import { Scatter } from 'react-chartjs-2';
import { Activity, CloudRain, Droplets, Filter, Info, TrendingDown, TrendingUp } from 'lucide-react';
import SearchableSelect from '@/components/SearchableSelect';

ChartJS.register(LinearScale, PointElement, LineElement, Tooltip, Legend);

export default function CorrelationPage() {
    const [data, setData] = useState(null);
    const [loading, setLoading] = useState(true);
    const [company, setCompany] = useState('Semua');
    const [estate, setEstate] = useState('Semua');
    const [days, setDays] = useState('30');
    
    const [companyList, setCompanyList] = useState(['Semua']);
    const [estateList, setEstateList] = useState(['Semua']);

    // Fetch initial filter data
    useEffect(() => {
        fetch('/api/companies?active=true')
            .then(r => r.json())
            .then(json => {
                if (json.companies) {
                    setCompanyList(['Semua', ...json.companies.map(c => c.code)]);
                }
            });
    }, []);

    // Fetch estates when company changes
    useEffect(() => {
        if (company === 'Semua') {
            setEstateList(['Semua']);
            setEstate('Semua');
            return;
        }
        fetch(`/api/estates?company=${company}`)
            .then(r => r.json())
            .then(json => {
                if (json.estates) {
                    setEstateList(['Semua', ...json.estates.map(e => e.code)]);
                }
            });
    }, [company]);

    const fetchAnalysis = useCallback(async () => {
        setLoading(true);
        try {
            const params = new URLSearchParams({ company, estate, days });
            const res = await fetch(`/api/correlation?${params}`);
            const json = await res.json();
            setData(json);
        } catch (e) {
            console.error(e);
        } finally {
            setLoading(false);
        }
    }, [company, estate, days]);

    useEffect(() => {
        fetchAnalysis();
    }, [fetchAnalysis]);

    const scatterData = data?.data ? {
        datasets: [
            {
                label: 'Data Harian (Hujan vs ΔTMAT)',
                data: data.data.map(d => ({ x: d.rainfall_mm, y: d.delta_tmat })),
                backgroundColor: 'rgba(59, 130, 246, 0.6)',
                pointRadius: 5,
                pointHoverRadius: 8
            },
            {
                label: 'Garis Regresi',
                data: [
                    { x: 0, y: data.intercept },
                    { x: Math.max(...data.data.map(d => d.rainfall_mm)) || 50, y: data.intercept + (data.slope * (Math.max(...data.data.map(d => d.rainfall_mm)) || 50)) }
                ],
                type: 'line',
                borderColor: 'rgba(239, 68, 68, 0.8)',
                borderWidth: 2,
                pointRadius: 0,
                fill: false,
                tension: 0
            }
        ]
    } : null;

    const chartOptions = {
        responsive: true,
        maintainAspectRatio: false,
        scales: {
            x: {
                title: { display: true, text: 'Curah Hujan (mm)', font: { weight: 'bold' } },
                grid: { color: 'rgba(0,0,0,0.05)' }
            },
            y: {
                title: { display: true, text: 'Perubahan TMAT (cm)', font: { weight: 'bold' } },
                grid: { color: 'rgba(0,0,0,0.05)' }
            }
        },
        plugins: {
            legend: { position: 'top' },
            tooltip: {
                callbacks: {
                    label: (context) => `Hujan: ${context.parsed.x}mm, ΔTMAT: ${context.parsed.y}cm`
                }
            }
        }
    };

    return (
        <div className="max-w-6xl mx-auto space-y-8 pb-20 animate-in fade-in duration-500">
            <header className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div>
                    <h1 className="text-3xl font-bold tracking-tight text-gray-900 flex items-center gap-3">
                        <Activity className="text-blue-500" size={32} />
                        Analisis Korelasi
                    </h1>
                    <p className="text-sm text-gray-500 mt-1">Studi hubungan antara intensitas curah hujan dengan fluktuasi level air tanah (TMAT).</p>
                </div>

                <div className="flex items-center gap-2 flex-wrap bg-white p-2 rounded-2xl shadow-sm border border-gray-100">
                    <SearchableSelect 
                        options={companyList.map(c => ({ value: c, label: c }))}
                        value={company}
                        onChange={setCompany}
                        placeholder="Company"
                        className="min-w-[120px]"
                    />
                    <SearchableSelect 
                        options={estateList.map(e => ({ value: e, label: e }))}
                        value={estate}
                        onChange={setEstate}
                        placeholder="Estate"
                        className="min-w-[120px]"
                    />
                    <select 
                        value={days}
                        onChange={e => setDays(e.target.value)}
                        className="text-xs font-bold bg-gray-50 border-none rounded-xl px-4 py-2.5 outline-none focus:ring-2 focus:ring-blue-500/20"
                    >
                        <option value="14">14 Hari Terakhir</option>
                        <option value="30">30 Hari Terakhir</option>
                        <option value="60">60 Hari Terakhir</option>
                        <option value="90">90 Hari Terakhir</option>
                    </select>
                </div>
            </header>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                {/* Insights Cards */}
                <div className="lg:col-span-1 space-y-6">
                    <div className="glass-card p-6 border-l-4 border-blue-500">
                        <div className="flex items-center gap-3 mb-4">
                            <div className="p-2 bg-blue-50 rounded-lg text-blue-600">
                                <TrendingUp size={20} />
                            </div>
                            <h3 className="font-bold text-gray-800">Koefisien Korelasi</h3>
                        </div>
                        <div className="text-4xl font-black text-gray-900">
                            {loading ? '...' : (data?.correlation || 0)}
                        </div>
                        <p className="text-xs text-gray-500 mt-2 leading-relaxed">
                            {data?.correlation > 0.7 ? 'Korelasi sangat kuat. Hujan sangat dominan mempengaruhi TMAT.' : 
                             data?.correlation > 0.4 ? 'Korelasi moderat. Ada faktor lain selain hujan yang mempengaruhi TMAT.' :
                             'Korelasi lemah. Fluktuasi TMAT mungkin lebih dipengaruhi oleh manajemen pintu air atau drainase.'}
                        </p>
                    </div>

                    <div className="glass-card p-6 border-l-4 border-emerald-500">
                        <div className="flex items-center gap-3 mb-4">
                            <div className="p-2 bg-emerald-50 rounded-lg text-emerald-600">
                                <Droplets size={20} />
                            </div>
                            <h3 className="font-bold text-gray-800">Efektivitas Resapan</h3>
                        </div>
                        <div className="text-2xl font-bold text-gray-900">
                            {loading ? '...' : `10mm ➔ ${Math.abs(data?.slope * 10 || 0).toFixed(1)} cm`}
                        </div>
                        <p className="text-[11px] text-gray-500 mt-2">
                            Estimasi kenaikan level air tanah untuk setiap 10mm curah hujan harian.
                        </p>
                    </div>

                    <div className="glass-card p-6 bg-gray-50 border-dashed border-2 border-gray-200">
                        <div className="flex items-start gap-3">
                            <Info size={16} className="text-gray-400 mt-0.5 shrink-0" />
                            <div className="text-[11px] text-gray-500 space-y-2">
                                <p><b>Cara Membaca:</b> Sumbu X adalah jumlah hujan hari ini, Sumbu Y adalah seberapa banyak air tanah naik/turun dibanding kemarin.</p>
                                <p>Titik yang mengumpul di garis regresi menunjukkan konsistensi respon lahan terhadap hujan.</p>
                            </div>
                        </div>
                    </div>
                </div>

                {/* Main Chart */}
                <div className="lg:col-span-2 glass-card p-6 flex flex-col min-h-[450px]">
                    <div className="flex items-center justify-between mb-6">
                        <h3 className="font-bold text-gray-800 flex items-center gap-2">
                            <CloudRain size={18} className="text-blue-500" />
                            Scatter Plot: Hujan vs Perubahan TMAT
                        </h3>
                    </div>
                    
                    <div className="flex-1 relative">
                        {loading ? (
                            <div className="absolute inset-0 flex items-center justify-center bg-white/50 z-10">
                                <Activity className="animate-spin text-blue-500" size={32} />
                            </div>
                        ) : data?.data?.length > 0 ? (
                            <Scatter data={scatterData} options={chartOptions} />
                        ) : (
                            <div className="h-full flex flex-col items-center justify-center text-gray-400 italic text-sm">
                                Tidak ada data yang cukup untuk analisis korelasi pada periode ini.
                            </div>
                        )}
                    </div>
                </div>
            </div>

            {/* Detailed Table */}
            <div className="glass-card overflow-hidden">
                <div className="p-6 border-b border-gray-100 bg-gray-50/50">
                    <h3 className="text-sm font-bold text-gray-800">Data Observasi Harian</h3>
                </div>
                <div className="overflow-x-auto">
                    <table className="w-full text-left text-sm">
                        <thead>
                            <tr className="bg-gray-50 text-gray-500 text-[10px] uppercase font-bold tracking-wider">
                                <th className="px-6 py-3">Tanggal</th>
                                <th className="px-6 py-3">Estate</th>
                                <th className="px-6 py-3">Rainfall (mm)</th>
                                <th className="px-6 py-3">Avg TMAT (cm)</th>
                                <th className="px-6 py-3">Δ TMAT (cm)</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-100">
                            {data?.data?.slice(0, 15).map((row, i) => (
                                <tr key={i} className="hover:bg-gray-50 transition-colors">
                                    <td className="px-6 py-4 font-medium text-gray-900">{new Date(row.day_date).toLocaleDateString('id-ID', { day: '2-digit', month: 'short', year: 'numeric' })}</td>
                                    <td className="px-6 py-4 text-gray-600">{row.est_code}</td>
                                    <td className="px-6 py-4 text-blue-600 font-bold">{row.rainfall_mm} mm</td>
                                    <td className="px-6 py-4 text-gray-900 font-medium">{parseFloat(row.avg_tmat).toFixed(1)} cm</td>
                                    <td className={`px-6 py-4 font-bold ${row.delta_tmat < 0 ? 'text-green-600' : 'text-red-500'}`}>
                                        {row.delta_tmat > 0 ? '+' : ''}{parseFloat(row.delta_tmat).toFixed(1)} cm
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
                {data?.data?.length > 15 && (
                    <div className="p-4 text-center border-t border-gray-100 text-[10px] text-gray-400 font-medium">
                        Menampilkan 15 data observasi terbaru dari total {data.data.length} data.
                    </div>
                )}
            </div>
        </div>
    );
}
