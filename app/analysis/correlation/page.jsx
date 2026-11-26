"use client";

import { useState, useEffect, useCallback } from 'react';
import { Chart as ChartJS, LinearScale, PointElement, LineElement, Tooltip, Legend } from 'chart.js';
import { Scatter } from 'react-chartjs-2';
import { Activity, CloudRain, Droplets, Filter, Info, TrendingDown, TrendingUp } from 'lucide-react';
import SearchableSelect from '../../../components/SearchableSelect';

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
        <div className="space-y-6">
            <header className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
                <div>
                    <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-gray-900">
                        Analisis Korelasi
                    </h1>
                    <p className="text-sm text-gray-600 mt-1">Studi hubungan antara intensitas curah hujan dengan fluktuasi level air tanah (TMAT).</p>
                </div>

                <div className="flex items-center gap-2 flex-wrap bg-white p-2 rounded-2xl shadow-xs border border-gray-200">
                    <SearchableSelect
                        options={companyList.map(c => ({ value: c, label: c }))}
                        value={company}
                        onChange={setCompany}
                        placeholder="Company"
                        className="min-w-[140px]"
                    />
                    <SearchableSelect
                        options={estateList.map(e => ({ value: e, label: e }))}
                        value={estate}
                        onChange={setEstate}
                        placeholder="Estate"
                        className="min-w-[140px]"
                    />
                    <label htmlFor="corr-days" className="sr-only">Rentang hari analisis</label>
                    <select
                        id="corr-days"
                        value={days}
                        onChange={e => setDays(e.target.value)}
                        className="min-h-11 text-sm font-medium text-gray-900 bg-white border border-gray-300 rounded-xl px-3"
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
                <div className="lg:col-span-1 space-y-4">
                    <div className="bg-white rounded-2xl border border-gray-200 p-5 shadow-xs">
                        <div className="flex items-center gap-2.5 mb-3">
                            <TrendingUp size={18} className="text-gray-700" aria-hidden="true" />
                            <h2 className="text-xs font-semibold uppercase tracking-wide text-gray-600">Koefisien Korelasi</h2>
                        </div>
                        <div className="text-3xl font-bold text-gray-900 tabular-nums">
                            {loading ? '...' : (data?.correlation || 0)}
                        </div>
                        <p className="text-xs text-gray-600 mt-2 leading-relaxed">
                            {data?.correlation > 0.7 ? 'Korelasi sangat kuat. Hujan sangat dominan mempengaruhi TMAT.' :
                             data?.correlation > 0.4 ? 'Korelasi moderat. Ada faktor lain selain hujan yang mempengaruhi TMAT.' :
                             'Korelasi lemah. Fluktuasi TMAT mungkin lebih dipengaruhi oleh manajemen pintu air atau drainase.'}
                        </p>
                    </div>

                    <div className="bg-white rounded-2xl border border-gray-200 p-5 shadow-xs">
                        <div className="flex items-center gap-2.5 mb-3">
                            <Droplets size={18} className="text-gray-700" aria-hidden="true" />
                            <h2 className="text-xs font-semibold uppercase tracking-wide text-gray-600">Efektivitas Resapan</h2>
                        </div>
                        <div className="text-2xl font-bold text-gray-900 tabular-nums">
                            {loading ? '...' : `10mm ➔ ${Math.abs(data?.slope * 10 || 0).toFixed(1)} cm`}
                        </div>
                        <p className="text-xs text-gray-600 mt-2">
                            Estimasi kenaikan level air tanah untuk setiap 10mm curah hujan harian.
                        </p>
                    </div>

                    <div className="bg-white rounded-2xl border border-gray-200 p-5 shadow-xs">
                        <div className="flex items-start gap-2.5">
                            <Info size={16} className="text-gray-600 mt-0.5 shrink-0" aria-hidden="true" />
                            <div className="text-xs text-gray-600 space-y-2 leading-relaxed">
                                <p><strong>Cara Membaca:</strong> Sumbu X adalah jumlah hujan hari ini, Sumbu Y adalah perubahan tinggi air tanah dibanding kemarin.</p>
                                <p>Titik yang mengumpul di garis regresi menunjukkan konsistensi respon lahan terhadap hujan.</p>
                            </div>
                        </div>
                    </div>
                </div>

                {/* Main Chart */}
                <div className="lg:col-span-2 bg-white rounded-2xl border border-gray-200 p-5 sm:p-6 shadow-xs flex flex-col min-h-[450px]">
                    <div className="flex items-center justify-between mb-4">
                        <h2 className="font-bold text-gray-900 flex items-center gap-2 text-base">
                            <CloudRain size={18} className="text-gray-700" aria-hidden="true" />
                            <span>Scatter Plot: Hujan vs Perubahan TMAT</span>
                        </h2>
                    </div>

                    <div className="flex-1 relative">
                        {loading ? (
                            <div className="absolute inset-0 flex items-center justify-center bg-white/80 z-10">
                                <Activity className="animate-spin text-gray-700" size={32} aria-hidden="true" />
                            </div>
                        ) : data?.data?.length > 0 ? (
                            <Scatter data={scatterData} options={chartOptions} />
                        ) : (
                            <div className="h-full flex flex-col items-center justify-center text-gray-600 text-sm">
                                Tidak ada data yang cukup untuk analisis korelasi pada periode ini.
                            </div>
                        )}
                    </div>
                </div>
            </div>

            {/* Detailed Table */}
            <div className="bg-white rounded-2xl border border-gray-200 shadow-xs overflow-hidden">
                <div className="p-5 border-b border-gray-200 bg-gray-50">
                    <h2 className="text-sm font-bold text-gray-900">Data Observasi Harian</h2>
                </div>
                <div className="overflow-x-auto">
                    <table className="w-full text-left text-sm">
                        <thead>
                            <tr className="bg-gray-50 text-gray-700 text-xs uppercase font-semibold tracking-wider border-b border-gray-200">
                                <th className="px-5 py-3">Tanggal</th>
                                <th className="px-5 py-3">Estate</th>
                                <th className="px-5 py-3">Rainfall (mm)</th>
                                <th className="px-5 py-3">Avg TMAT (cm)</th>
                                <th className="px-5 py-3">Δ TMAT (cm)</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-100 tabular-nums">
                            {data?.data?.slice(0, 15).map((row, i) => (
                                <tr key={i} className="hover:bg-gray-50 transition-colors">
                                    <td className="px-5 py-3.5 font-medium text-gray-900">{new Date(row.day_date).toLocaleDateString('id-ID', { day: '2-digit', month: 'short', year: 'numeric' })}</td>
                                    <td className="px-5 py-3.5 text-gray-700">{row.est_code}</td>
                                    <td className="px-5 py-3.5 text-blue-800 font-semibold">{row.rainfall_mm} mm</td>
                                    <td className="px-5 py-3.5 text-gray-900 font-medium">{parseFloat(row.avg_tmat).toFixed(1)} cm</td>
                                    <td className={`px-5 py-3.5 font-bold ${row.delta_tmat < 0 ? 'text-emerald-800' : 'text-red-700'}`}>
                                        {row.delta_tmat > 0 ? '+' : ''}{parseFloat(row.delta_tmat).toFixed(1)} cm
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
                {data?.data?.length > 15 && (
                    <div className="p-4 text-center border-t border-gray-200 text-xs text-gray-600 font-medium">
                        Menampilkan 15 data observasi terbaru dari total {data.data.length} data.
                    </div>
                )}
            </div>
        </div>
    );
}
