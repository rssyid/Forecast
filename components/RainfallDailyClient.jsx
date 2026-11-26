"use client";

import { useState, useCallback, useMemo, useEffect } from 'react';
import { Building2, Calendar, FileDown, Copy, FileSpreadsheet, FileText, AlertTriangle, RefreshCw, TrendingUp } from 'lucide-react';
import SearchableSelect from './SearchableSelect';
import { Chart as ChartJS, CategoryScale, LinearScale, PointElement, LineElement, BarElement, Title, Tooltip, Legend, Filler } from 'chart.js';
import { Bar } from 'react-chartjs-2';

ChartJS.register(CategoryScale, LinearScale, PointElement, LineElement, BarElement, Title, Tooltip, Legend, Filler);

/**
 * RainfallDailyClient - Features:
 * - Matrix view (Estates vs Days)
 * - Monthly Total column (Right)
 * - Daily Summaries (Total, Average, Hari Hujan Unit >1, Estate Hujan Qty)
 */

const MONTHS = [
    { value: '1', label: 'Januari' }, { value: '2', label: 'Februari' }, { value: '3', label: 'Maret' },
    { value: '4', label: 'April' }, { value: '5', label: 'Mei' }, { value: '6', label: 'Juni' },
    { value: '7', label: 'Juli' }, { value: '8', label: 'Agustus' }, { value: '9', label: 'September' },
    { value: '10', label: 'Oktober' }, { value: '11', label: 'November' }, { value: '12', label: 'Desember' }
];

export default function RainfallDailyClient() {
    const [company, setCompany] = useState('');
    const [month, setMonth] = useState('1');
    const [companyList, setCompanyList] = useState([]);
    const [loading, setLoading] = useState(false);
    const [data, setData] = useState(null);
    const [error, setError] = useState(null);

    // Fetch active companies
    useEffect(() => {
        fetch('/api/companies?active=true')
            .then(r => r.json())
            .then(json => {
                if (json.companies) {
                    const codes = json.companies.map(c => c.code);
                    setCompanyList(codes);
                    if (codes.length > 0 && !company) setCompany(codes[0]);
                }
            })
            .catch(() => {});
    }, []);

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
        const header2 = `Estate\t${daysArray.join('\t')}\tTotal\n`;
        let body = '';
        Object.entries(data.matrix)
            .sort((a, b) => a[0].localeCompare(b[0], undefined, { numeric: true, sensitivity: 'base' }))
            .forEach(([est, days]) => {
                const total = daysArray.reduce((acc, d) => acc + (days[d] || 0), 0);
                body += `${est}\t${daysArray.map(d => Math.round(days[d] || 0)).join('\t')}\t${Math.round(total)}\n`;
            });
        
        // Add footer rows to copy
        const footerTotal = `Total (mm)\t${daysArray.map(d => Math.round(Object.values(data.matrix).reduce((acc, est) => acc + (est[d] || 0), 0))).join('\t')}\n`;
        const footerAvg = `Average (mm)\t${daysArray.map(d => Math.round(Object.values(data.matrix).reduce((acc, est) => acc + (est[d] || 0), 0) / (Object.keys(data.matrix).length || 1))).join('\t')}\n`;
        const footerHH_Unit = `Hari Hujan (Unit)\t${daysArray.map(d => Object.values(data.matrix).filter(est => Number(est[d] || 0) > 0).length >= 1 ? 1 : 0).join('\t')}\n`;
        const footerHH_Qty = `Estate Hujan (Qty)\t${daysArray.map(d => Object.values(data.matrix).filter(est => (est[d] || 0) > 0).length).join('\t')}\n`;
        
        navigator.clipboard.writeText(header1 + header2 + body + footerTotal + footerAvg + footerHH_Unit + footerHH_Qty);
        alert('Tabel berhasil disalin ke clipboard!');
    };

    const handleExportCSV = () => {
        if (!data) return;
        let content = `Laporan Curah Hujan Harian - ${company} - ${monthLabel} 2026\n\n`;
        content += `Estate,${daysArray.map(d => String(d).padStart(2, '0')).join(',')},Total\n`;
        Object.entries(data.matrix)
            .sort((a, b) => a[0].localeCompare(b[0], undefined, { numeric: true, sensitivity: 'base' }))
            .forEach(([est, days]) => {
                const total = daysArray.reduce((acc, d) => acc + (days[d] || 0), 0);
                content += `${est},${daysArray.map(d => Math.round(days[d] || 0)).join(',')},${Math.round(total)}\n`;
            });
        
        // Add footer rows to CSV
        content += `Total (mm),${daysArray.map(d => Math.round(Object.values(data.matrix).reduce((acc, est) => acc + (est[d] || 0), 0))).join(',')}\n`;
        content += `Average (mm),${daysArray.map(d => Math.round(Object.values(data.matrix).reduce((acc, est) => acc + (est[d] || 0), 0) / (Object.keys(data.matrix).length || 1))).join(',')}\n`;
        content += `Hari Hujan (Unit),${daysArray.map(d => Object.values(data.matrix).filter(est => Number(est[d] || 0) > 0).length >= 1 ? 1 : 0).join(',')}\n`;
        content += `Estate Hujan (Qty),${daysArray.map(d => Object.values(data.matrix).filter(est => (est[d] || 0) > 0).length).join(',')}\n`;

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
            <header className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
                <div>
                    <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-gray-900">
                        Laporan Curah Hujan Harian
                    </h1>
                    <p className="text-sm text-gray-600 mt-1">Rekapitulasi curah hujan per hari untuk seluruh estate.</p>
                </div>

                <div className="flex flex-wrap items-center gap-2.5">
                    <SearchableSelect
                        icon={<Building2 size={14} />}
                        options={companyList}
                        value={company}
                        onChange={setCompany}
                        placeholder="Pilih Company..."
                        className="min-w-[150px]"
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
                        type="button"
                        onClick={fetchData}
                        disabled={!company || !month || loading}
                        className="min-h-11 px-5 py-2.5 bg-black text-white rounded-xl text-sm font-semibold hover:bg-gray-800 disabled:opacity-50 transition-colors inline-flex items-center gap-2"
                    >
                        {loading ? <RefreshCw size={15} className="animate-spin" aria-hidden="true" /> : <FileText size={15} aria-hidden="true" />}
                        <span>Tampilkan Laporan</span>
                    </button>
                </div>
            </header>

            {error && (
                <div role="alert" className="bg-red-50 border border-red-300 text-red-900 text-sm px-4 py-3 rounded-2xl flex items-center gap-2 font-medium">
                    <AlertTriangle size={16} className="shrink-0 text-red-700" aria-hidden="true" />
                    <span>{error}</span>
                </div>
            )}

            {data ? (
                <div className="space-y-6">
                    {/* Trend Chart */}
                    <div className="bg-white rounded-2xl border border-gray-200 p-5 sm:p-6 shadow-xs">
                        <div className="flex items-center justify-between mb-6">
                            <div>
                                <h2 className="text-base font-bold text-gray-900 flex items-center gap-2">
                                    <TrendingUp size={18} className="text-gray-700" aria-hidden="true" />
                                    <span>Tren Curah Hujan Harian per Estate - {monthLabel} 2026</span>
                                </h2>
                                <p className="text-xs text-gray-600 mt-0.5">Komparasi intensitas hujan antar estate di {company}</p>
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
                                            itemSort: (a, b) => a.dataset.label.localeCompare(b.dataset.label, undefined, { numeric: true, sensitivity: 'base' })
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

                    {/* Table Card */}
                    <div className="bg-white rounded-2xl border border-gray-200 shadow-xs overflow-hidden">
                        {/* Card Header with Title and Tools */}
                        <div className="p-5 sm:p-6 border-b border-gray-200 bg-gray-50 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                            <div>
                                <h2 className="text-base font-bold text-gray-900">Curah Hujan Harian {company} {monthLabel} 2026</h2>
                                <p className="text-xs text-gray-600 mt-0.5">Rekapitulasi intensitas hujan per hari</p>
                            </div>

                            <div className="flex flex-wrap items-center gap-2">
                                <button type="button" onClick={handleCopy} className="min-h-11 inline-flex items-center gap-2 px-4 py-2 bg-white border border-gray-300 rounded-xl text-xs font-semibold text-gray-900 hover:bg-gray-50 transition-colors">
                                    <Copy size={14} aria-hidden="true" />
                                    <span>Salin Tabel</span>
                                </button>
                                <button type="button" onClick={handleExportCSV} className="min-h-11 inline-flex items-center gap-2 px-4 py-2 bg-white border border-gray-300 rounded-xl text-xs font-semibold text-gray-900 hover:bg-gray-50 transition-colors">
                                    <FileSpreadsheet size={14} className="text-emerald-700" aria-hidden="true" />
                                    <span>Export CSV / Excel</span>
                                </button>
                            </div>
                        </div>

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
                                        <th className="bg-gray-800 text-white border border-gray-900 p-2 text-center font-black uppercase tracking-widest sticky right-0 z-10" rowSpan={2}>
                                            Total
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
                                        .map(([est, days]) => {
                                            const estateTotal = daysArray.reduce((acc, d) => acc + Number(days[d] || 0), 0);
                                            return (
                                                <tr key={est} className="hover:bg-blue-50/50 transition-colors group">
                                                    <td className="bg-gray-50 border border-gray-200 p-2 font-black text-gray-900 sticky left-0 group-hover:bg-blue-100/50 shadow-[2px_0_5px_rgba(0,0,0,0.05)]">
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
                                                    <td className="bg-gray-50 border border-gray-200 p-2 text-center font-black text-gray-900 sticky right-0 z-10 group-hover:bg-blue-100/50 shadow-[-2px_0_5px_rgba(0,0,0,0.05)]">
                                                        {Math.round(estateTotal)}
                                                    </td>
                                                </tr>
                                            );
                                        })}
                                </tbody>
                                <tfoot className="bg-gray-50 font-bold text-gray-900">
                                    {/* Row: Total */}
                                    <tr>
                                        <td className="border border-gray-200 p-2 sticky left-0 bg-gray-100 z-10 shadow-[2px_0_5px_rgba(0,0,0,0.05)]">Total (mm)</td>
                                        {daysArray.map(d => {
                                            const dayTotal = Object.values(data.matrix).reduce((acc, estDays) => acc + Number(estDays[d] || 0), 0);
                                            return <td key={d} className="border border-gray-200 p-2 text-center bg-blue-50/30">{Math.round(dayTotal)}</td>;
                                        })}
                                        <td className="border border-gray-200 p-2 text-center sticky right-0 bg-gray-800 text-white z-10 shadow-[-2px_0_5px_rgba(0,0,0,0.05)]">
                                            {Math.round(Object.values(data.matrix).reduce((totalAcc, estDays) => totalAcc + Object.values(estDays).reduce((acc, val) => acc + Number(val || 0), 0), 0))}
                                        </td>
                                    </tr>
                                    {/* Row: Average */}
                                    <tr>
                                        <td className="border border-gray-200 p-2 sticky left-0 bg-gray-100 z-10 shadow-[2px_0_5px_rgba(0,0,0,0.05)]">Average (mm)</td>
                                        {daysArray.map(d => {
                                            const values = Object.values(data.matrix).map(estDays => Number(estDays[d] || 0));
                                            const daySum = values.reduce((acc, v) => acc + v, 0);
                                            const dayAvg = daySum / (values.length || 1);
                                            return <td key={d} className="border border-gray-200 p-2 text-center text-gray-500 font-medium">{Math.round(dayAvg)}</td>;
                                        })}
                                        <td className="border border-gray-200 p-2 text-center sticky right-0 bg-gray-100 z-10 shadow-[-2px_0_5px_rgba(0,0,0,0.05)] font-bold">
                                            {Math.round(daysArray.reduce((acc, d) => {
                                                const values = Object.values(data.matrix).map(estDays => Number(estDays[d] || 0));
                                                const dayAvg = values.reduce((sum, v) => sum + v, 0) / (values.length || 1);
                                                return acc + dayAvg;
                                            }, 0))}
                                        </td>
                                    </tr>
                                    {/* Row: Hari Hujan (Unit) */}
                                    <tr>
                                        <td className="border border-gray-200 p-2 sticky left-0 bg-gray-100 z-10 shadow-[2px_0_5px_rgba(0,0,0,0.05)] text-blue-800">Hari Hujan (Unit)</td>
                                        {daysArray.map(d => {
                                            const rainyEstCount = Object.values(data.matrix).filter(estDays => Number(estDays[d] || 0) > 0).length;
                                            const isRainyDay = rainyEstCount >= 1 ? 1 : 0;
                                            return <td key={d} className={`border border-gray-200 p-2 text-center font-black ${isRainyDay ? 'bg-blue-100 text-blue-700' : 'text-gray-300'}`}>{isRainyDay}</td>;
                                        })}
                                        <td className="border border-gray-200 p-2 text-center sticky right-0 bg-blue-800 text-white z-10 shadow-[-2px_0_5px_rgba(0,0,0,0.05)]">
                                            {daysArray.reduce((acc, d) => {
                                                const rainyEstCount = Object.values(data.matrix).filter(estDays => Number(estDays[d] || 0) > 0).length;
                                                return acc + (rainyEstCount >= 1 ? 1 : 0);
                                            }, 0)}
                                        </td>
                                    </tr>
                                    {/* Row: Estate Hujan */}
                                    <tr>
                                        <td className="border border-gray-200 p-2 sticky left-0 bg-gray-100 z-10 shadow-[2px_0_5px_rgba(0,0,0,0.05)]">Estate Hujan (Qty)</td>
                                        {daysArray.map(d => {
                                            const rainyEstCount = Object.values(data.matrix).filter(estDays => Number(estDays[d] || 0) > 0).length;
                                            return <td key={d} className="border border-gray-200 p-2 text-center text-gray-500 font-medium">{rainyEstCount}</td>;
                                        })}
                                        <td className="border border-gray-200 p-2 text-center sticky right-0 bg-gray-100 z-10 shadow-[-2px_0_5px_rgba(0,0,0,0.05)] font-bold">
                                            {daysArray.reduce((acc, d) => acc + Object.values(data.matrix).filter(estDays => Number(estDays[d] || 0) > 0).length, 0)}
                                        </td>
                                    </tr>
                                </tfoot>
                            </table>
                        </div>
                    </div>
                </div>
            ) : !loading && (
                <div className="bg-white rounded-2xl border border-gray-200 py-16 px-6 flex flex-col items-center justify-center text-center shadow-xs">
                    <FileText size={40} className="text-gray-400 mb-3" aria-hidden="true" />
                    <h2 className="text-base font-bold text-gray-900">Silakan pilih Company dan Bulan</h2>
                    <p className="text-xs text-gray-600 mt-1">Laporan harian tersedia untuk tahun 2026.</p>
                </div>
            )}
        </div>
    );
}
