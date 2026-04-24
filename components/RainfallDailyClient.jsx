"use client";

import { useState, useCallback, useMemo } from 'react';
import { Building2, Calendar, FileDown, Copy, FileSpreadsheet, FileText, AlertTriangle, RefreshCw, TrendingUp } from 'lucide-react';
import SearchableSelect from './SearchableSelect';
import { Chart as ChartJS, CategoryScale, LinearScale, PointElement, LineElement, BarElement, Title, Tooltip, Legend, Filler } from 'chart.js';
import { Bar } from 'react-chartjs-2';

ChartJS.register(CategoryScale, LinearScale, PointElement, LineElement, BarElement, Title, Tooltip, Legend, Filler);

const COMPANIES = ['PT.THIP', 'PT.PTW', 'PT.SUMS', 'PT.WKN', 'PT.PANPS', 'PT.SAM', 'PT.NJP', 'PT.PLDK', 'PT.SUMK', 'PT.BAS', 'PT.AAN', 'PT.GAN', 'PT.AJP', 'PT.JJP', 'PT.SIP', 'PT.WSM'];

const MONTHS = [
    { value: '1', label: 'Januari' }, { value: '2', label: 'Februari' }, { value: '3', label: 'Maret' },
    { value: '4', label: 'April' }, { value: '5', label: 'Mei' }, { value: '6', label: 'Juni' },
    { value: '7', label: 'Juli' }, { value: '8', label: 'Agustus' }, { value: '9', label: 'September' },
    { value: '10', label: 'Oktober' }, { value: '11', label: 'November' }, { value: '12', label: 'Desember' }
];

export default function RainfallDailyClient() {
    const [company, setCompany] = useState('');
    const [month, setMonth] = useState('');
    const [loading, setLoading] = useState(false);
    const [data, setData] = useState(null);
    const [error, setError] = useState(null);

    const fetchData = useCallback(async () => {
        if (!company || !month) return;
        setLoading(true);
        setError(null);
        try {
            const res = await fetch(`/api/rainfall-daily?company=${company}&month=${month}`);
            if (!res.ok) throw new Error('Gagal mengambil data harian');
            const json = await res.json();
            setData(json);
        } catch (e) {
            setError(e.message);
        } finally {
            setLoading(false);
        }
    }, [company, month]);

    const daysArray = useMemo(() => {
        if (!data) return [];
        return Array.from({ length: data.lastDay }, (_, i) => i + 1);
    }, [data]);

    const monthLabel = useMemo(() => {
        return MONTHS.find(m => m.value === month)?.label || '';
    }, [month]);

    const handleCopy = () => {
        if (!data) return;
        const header1 = `\t${monthLabel}\n`;
        const header2 = `Estate\t${daysArray.join('\t')}\n`;
        let body = '';
        Object.entries(data.matrix)
            .sort((a, b) => a[0].localeCompare(b[0], undefined, { numeric: true, sensitivity: 'base' }))
            .forEach(([est, days]) => {
                body += `${est}\t${daysArray.map(d => Math.round(days[d] || 0)).join('\t')}\n`;
            });
        navigator.clipboard.writeText(header1 + header2 + body);
        alert('Tabel berhasil disalin ke clipboard!');
    };

    const handleExportCSV = () => {
        if (!data) return;
        let content = `Laporan Curah Hujan Harian - ${company} - ${monthLabel} 2026\n\n`;
        content += `Estate,${daysArray.map(d => String(d).padStart(2, '0')).join(',')}\n`;
        Object.entries(data.matrix)
            .sort((a, b) => a[0].localeCompare(b[0], undefined, { numeric: true, sensitivity: 'base' }))
            .forEach(([est, days]) => {
                content += `${est},${daysArray.map(d => Math.round(days[d] || 0)).join(',')}\n`;
            });
        const blob = new Blob([content], { type: 'text/csv;charset=utf-8;' });
        const link = document.createElement('a');
        link.href = URL.createObjectURL(blob);
        link.download = `Rainfall_Daily_${company}_${monthLabel}_2026.csv`;
        link.click();
    };

    const chartData = useMemo(() => {
        if (!data || !data.matrix) return null;
        
        const labels = daysArray.map(d => String(d).padStart(2, '0'));
        
        // Generate distinct colors
        const colors = [
            '#3B82F6', '#10B981', '#F59E0B', '#EF4444', '#8B5CF6', 
            '#EC4899', '#06B6D4', '#F97316', '#6366F1', '#84CC16'
        ];

        const datasets = Object.entries(data.matrix)
            .sort((a, b) => a[0].localeCompare(b[0], undefined, { numeric: true, sensitivity: 'base' }))
            .map(([est, days], idx) => ({
                label: est,
                data: daysArray.map(d => days[d] || 0),
                backgroundColor: colors[idx % colors.length],
                borderColor: colors[idx % colors.length],
                borderWidth: 1,
                borderRadius: 2
            }));

        return { labels, datasets };
    }, [data, daysArray]);

    return (
        <div className="space-y-6">
            {/* Header */}
            <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
                <div>
                    <h1 className="text-3xl font-bold tracking-tight text-gray-900 flex items-center gap-3">
                        Laporan Curah Hujan Harian
                    </h1>
                    <p className="text-sm text-gray-500 mt-1">Rekapitulasi curah hujan per hari untuk seluruh estate.</p>
                </div>

                <div className="flex flex-wrap items-center gap-3">
                    <SearchableSelect
                        icon={<Building2 size={14} />}
                        options={COMPANIES}
                        value={company}
                        onChange={setCompany}
                        placeholder="Pilih Company..."
                        className="w-[180px]"
                    />
                    <SearchableSelect
                        icon={<Calendar size={14} />}
                        options={MONTHS.map(m => m.label)}
                        value={MONTHS.find(m => m.value === month)?.label || ''}
                        onChange={(label) => setMonth(MONTHS.find(m => m.label === label)?.value)}
                        placeholder="Pilih Bulan..."
                        className="w-[160px]"
                        autoSort={false}
                    />
                    <button
                        onClick={fetchData}
                        disabled={!company || !month || loading}
                        className="px-6 py-2.5 bg-black text-white rounded-xl text-xs font-bold hover:bg-gray-800 disabled:bg-gray-200 transition-all shadow-lg shadow-black/10 flex items-center gap-2"
                    >
                        {loading ? <RefreshCw size={14} className="animate-spin" /> : <FileText size={14} />}
                        Tampilkan Laporan
                    </button>
                </div>
            </div>

            {error && (
                <div className="bg-red-50 border border-red-200 text-red-700 text-sm px-4 py-3 rounded-xl flex items-center gap-2">
                    <AlertTriangle size={16} /> {error}
                </div>
            )}

            {data ? (
                <div className="space-y-6 animate-in fade-in duration-500">
                    {/* Trend Chart */}
                    <div className="glass-card p-6">
                        <div className="flex items-center justify-between mb-6">
                            <div>
                                <h3 className="text-sm font-bold text-gray-800 flex items-center gap-2">
                                    <TrendingUp size={16} className="text-blue-500" />
                                    Tren Curah Hujan Harian per Estate - {monthLabel} 2026
                                </h3>
                                <p className="text-[10px] text-gray-400 font-bold uppercase mt-0.5">Komparasi intensitas hujan antar estate di {company}</p>
                            </div>
                        </div>
                        <div className="h-[500px]">
                            <Bar 
                                data={chartData} 
                                options={{
                                    responsive: true,
                                    maintainAspectRatio: false,
                                    plugins: { 
                                        legend: { 
                                            display: true,
                                            position: 'bottom',
                                            labels: {
                                                usePointStyle: true,
                                                boxWidth: 6,
                                                font: { size: 10, weight: 'bold' },
                                                padding: 20
                                            }
                                        },
                                        tooltip: {
                                            mode: 'index',
                                            intersect: false,
                                            backgroundColor: 'rgba(255, 255, 255, 0.98)',
                                            titleColor: '#111827',
                                            bodyColor: '#4B5563',
                                            borderColor: '#E5E7EB',
                                            borderWidth: 1,
                                            padding: 8,
                                            boxPadding: 4,
                                            bodySpacing: 2,
                                            bodyFont: { size: 9 },
                                            usePointStyle: true,
                                            itemSort: (a, b) => b.raw - a.raw // Sort by rainfall value desc
                                        }
                                    },
                                    scales: {
                                        y: { beginAtZero: true, grid: { color: '#f3f4f6' }, title: { display: true, text: 'Rainfall (mm)', font: { size: 10, weight: 'bold' } } },
                                        x: { grid: { display: false }, title: { display: true, text: 'Tanggal', font: { size: 10, weight: 'bold' } } }
                                    }
                                }} 
                            />
                        </div>
                    </div>

                    {/* Toolbar */}
                    <div className="flex items-center justify-end gap-2">
                        <button onClick={handleCopy} className="flex items-center gap-2 px-3 py-2 bg-white border border-gray-200 rounded-lg text-[10px] font-bold text-gray-600 hover:bg-gray-50 transition-all">
                            <Copy size={12} /> Salin Tabel
                        </button>
                        <button onClick={handleExportCSV} className="flex items-center gap-2 px-3 py-2 bg-white border border-gray-200 rounded-lg text-[10px] font-bold text-gray-600 hover:bg-gray-50 transition-all">
                            <FileSpreadsheet size={12} className="text-green-600" /> Export CSV / Excel
                        </button>
                    </div>

                    {/* Table Container */}
                    <div className="glass-card overflow-hidden">
                        <div className="overflow-x-auto custom-scrollbar">
                            <table className="w-full text-[11px] border-collapse">
                                <thead>
                                    {/* Month Header (Merged) */}
                                    <tr>
                                        <th className="bg-gray-100 border border-gray-200 p-2 text-center sticky left-0 z-10 min-w-[100px]" rowSpan={2}>
                                            Estate
                                        </th>
                                        <th className="bg-blue-600 text-white border border-blue-700 p-2 text-center font-black uppercase tracking-widest" colSpan={data.lastDay}>
                                            {monthLabel} 2026
                                        </th>
                                    </tr>
                                    {/* Days Header */}
                                    <tr>
                                        {daysArray.map(d => (
                                            <th key={d} className="bg-gray-50 border border-gray-200 p-2 text-center font-bold min-w-[32px]">
                                                {String(d).padStart(2, '0')}
                                            </th>
                                        ))}
                                    </tr>
                                </thead>
                                <tbody className="bg-white">
                                    {Object.entries(data.matrix)
                                        .sort((a, b) => a[0].localeCompare(b[0], undefined, { numeric: true, sensitivity: 'base' }))
                                        .map(([est, days]) => (
                                        <tr key={est} className="hover:bg-blue-50/50 transition-colors group">
                                            <td className="bg-gray-50 border border-gray-200 p-2 font-black text-gray-900 sticky left-0 group-hover:bg-blue-100/50">
                                                {est}
                                            </td>
                                            {daysArray.map(d => {
                                                const val = days[d] || 0;
                                                return (
                                                    <td key={d} className={`border border-gray-100 p-2 text-center font-medium ${val > 0 ? 'text-blue-600 font-bold' : 'text-gray-300'}`}>
                                                        {val > 0 ? Math.round(val) : '0'}
                                                    </td>
                                                );
                                            })}
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    </div>
                </div>
            ) : !loading && (
                <div className="glass-card py-20 flex flex-col items-center justify-center text-center opacity-40">
                    <FileText size={64} className="text-gray-300 mb-4" />
                    <h3 className="text-sm font-bold text-gray-500">Silakan pilih Company dan Bulan</h3>
                    <p className="text-xs text-gray-400 mt-1">Laporan harian hanya tersedia untuk tahun 2026.</p>
                </div>
            )}
        </div>
    );
}
