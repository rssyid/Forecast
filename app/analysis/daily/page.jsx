"use client";

import React, { useState, useEffect, useRef } from 'react';
import { CalendarDays, Building2, RefreshCw, AlertCircle, FileText, Image as ImageIcon, Copy, Check } from 'lucide-react';
import { domToBlob } from 'modern-screenshot';
import SearchableSelect from '../../../components/SearchableSelect';

export default function DailyReportPage() {
    const [ptName, setPtName] = useState('PT.PTW');
    const [week, setWeek] = useState('');
    const [weekList, setWeekList] = useState([]);
    const [companyList, setCompanyList] = useState([]);
    const [data, setData] = useState(null);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState(null);
    const [copying, setCopying] = useState(false);
    const [copied, setCopied] = useState(false);
    const dashboardRef = useRef(null);

    // 1. Fetch weeks and companies list
    useEffect(() => {
        // Fetch Weeks
        fetch('/api/calendar-weeks')
            .then(r => r.json())
            .then(json => {
                if (json.weeks) {
                    setWeekList(json.weeks);
                    if (json.weeks.length > 0) setWeek(json.weeks[0].formatted_name);
                }
            });

        // Fetch Companies
        fetch('/api/companies?active=true')
            .then(r => r.json())
            .then(json => {
                if (json.companies) {
                    setCompanyList(json.companies.map(c => c.code));
                }
            });
    }, []);

    // Calculate Week ID using the anchor point from ComparisonGridClient
    const anchorWeek = 'Apr 2026, W4';
    const anchorId = 503;
    
    const weekNames = weekList.map(w => w.formatted_name);
    const anchorIdx = weekNames.indexOf(anchorWeek);
    const currentIdx = weekNames.indexOf(week);
    
    const weekId = (anchorIdx !== -1 && currentIdx !== -1) 
        ? anchorId + (anchorIdx - currentIdx) 
        : null;

    const fetchReport = async () => {
        if (!ptName || !weekId) return;
        setLoading(true);
        setError(null);
        try {
            const params = new URLSearchParams({ ptName, weekId: String(weekId) });
            const res = await fetch(`/api/daily-pzo-report?${params}`);
            const json = await res.json();
            if (!res.ok) throw new Error(json.error || 'Gagal mengambil data laporan harian');
            setData(json.data);
        } catch (err) {
            setError(err.message);
        } finally {
            setLoading(false);
        }
    };

    const handleCopyAll = async () => {
        if (!dashboardRef.current) return;
        setCopying(true);
        try {
            const blob = await domToBlob(dashboardRef.current, {
                backgroundColor: '#ffffff',
                scale: 2
            });
            if (blob) {
                const item = new ClipboardItem({ [blob.type]: blob });
                await navigator.clipboard.write([item]);
                setCopied(true);
                setTimeout(() => setCopied(false), 2000);
            }
        } catch (err) {
            console.error('Failed to copy dashboard:', err);
        } finally {
            setCopying(false);
        }
    };

    useEffect(() => {
        if (ptName && weekId) fetchReport();
    }, [ptName, weekId]);

    return (
        <div className="space-y-6">
            {/* Header Section */}
            <header className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
                <div>
                    <h1 className="text-2xl sm:text-3xl font-bold text-gray-900 tracking-tight">
                        Laporan Piezometer Harian
                    </h1>
                    <p className="text-sm text-gray-600 mt-1">
                        Visualisasi perbandingan mingguan &amp; statistik TMAT per company.
                    </p>
                </div>

                {data && (
                    <button
                        type="button"
                        onClick={handleCopyAll}
                        disabled={copying}
                        className={`min-h-11 inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl text-sm font-semibold border transition-colors shrink-0 ${
                            copied
                            ? 'bg-emerald-50 text-emerald-800 border-emerald-300'
                            : 'bg-black text-white border-black hover:bg-gray-800'
                        }`}
                    >
                        {copying ? <RefreshCw size={16} className="animate-spin" aria-hidden="true" /> : (copied ? <Check size={16} aria-hidden="true" /> : <ImageIcon size={16} aria-hidden="true" />)}
                        <span>{copied ? 'Dashboard Copied!' : 'Copy Dashboard Image'}</span>
                    </button>
                )}
            </header>

            {/* Filter Bar */}
            <section aria-label="Filter laporan harian piezometer" className="bg-white p-4 sm:p-5 rounded-2xl border border-gray-200 shadow-xs">
                <div className="flex flex-wrap items-end gap-3">
                    <div className="w-full sm:w-64">
                        <label className="block text-xs font-semibold text-gray-700 mb-1">
                            Pilih Company
                        </label>
                        <SearchableSelect
                            options={companyList}
                            value={ptName}
                            onChange={setPtName}
                            placeholder="PT Name"
                            icon={<Building2 size={14} />}
                        />
                    </div>
                    <div className="w-full sm:w-64">
                        <label className="block text-xs font-semibold text-gray-700 mb-1">
                            Pilih Periode
                        </label>
                        <SearchableSelect
                            options={weekNames}
                            value={week}
                            onChange={setWeek}
                            placeholder="Pilih Minggu"
                            icon={<CalendarDays size={14} />}
                            autoSort={false}
                        />
                    </div>
                    <button
                        type="button"
                        onClick={fetchReport}
                        disabled={loading}
                        aria-label="Muat ulang laporan harian"
                        title="Refresh Data"
                        className="min-h-11 min-w-11 inline-flex items-center justify-center bg-white hover:bg-gray-50 border border-gray-300 rounded-xl transition-colors text-gray-900 disabled:opacity-50"
                    >
                        <RefreshCw size={16} className={loading ? 'animate-spin' : ''} aria-hidden="true" />
                    </button>
                </div>
            </section>

            {error && (
                <div role="alert" className="p-4 bg-red-50 border border-red-300 rounded-2xl flex items-center gap-3 text-red-900 text-sm font-medium">
                    <AlertCircle size={18} className="shrink-0 text-red-700" aria-hidden="true" />
                    <p>{error}</p>
                </div>
            )}

            {loading ? (
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                    <SkeletonColumn />
                    <SkeletonColumn />
                </div>
            ) : data ? (
                <div className="space-y-6">
                    <ReportSummary data={data} ptName={ptName} />

                    <div className="bg-white rounded-2xl border border-gray-200 p-4 shadow-xs overflow-x-auto">
                        <div ref={dashboardRef} className="bg-white p-6 min-w-[1600px]">
                            <div className="grid grid-cols-2 gap-16">
                                <ReportColumn data={data.w1} />
                                <ReportColumn data={data.w2} />
                            </div>
                        </div>
                    </div>
                </div>
            ) : (
                <div className="bg-white rounded-2xl border border-gray-200 p-12 text-center shadow-xs">
                    <div className="w-14 h-14 bg-gray-100 rounded-xl flex items-center justify-center mx-auto mb-3 text-gray-600">
                        <ImageIcon size={28} aria-hidden="true" />
                    </div>
                    <p className="text-gray-700 font-semibold text-base">Pilih Company dan Minggu untuk melihat laporan.</p>
                </div>
            )}
        </div>
    );
}

function ReportSummary({ data, ptName }) {
    const [copied, setCopied] = useState(false);
    
    // 1. Format Datetime
    const now = new Date();
    const months = ["Jan", "Feb", "Mar", "Apr", "Mei", "Jun", "Jul", "Agt", "Sep", "Okt", "Nov", "Des"];
    const formattedDate = `${now.getDate()} ${months[now.getMonth()]} ${now.getFullYear()}, ${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')} WIB`;

    // 2. Extract Meta info
    const w1 = data.w1.meta;
    const w2 = data.w2.meta;
    
    // Helper to get short month
    const getShortMonth = (name) => {
        if (!name) return "";
        const m = name.toLowerCase();
        if (m.includes("jan")) return "Jan";
        if (m.includes("feb")) return "Feb";
        if (m.includes("mar")) return "Mar";
        if (m.includes("apr")) return "Apr";
        if (m.includes("mei") || m.includes("may")) return "Mei";
        if (m.includes("jun")) return "Jun";
        if (m.includes("jul")) return "Jul";
        if (m.includes("agt") || m.includes("aug")) return "Agt";
        if (m.includes("sep")) return "Sep";
        if (m.includes("okt") || m.includes("oct")) return "Okt";
        if (m.includes("nov")) return "Nov";
        if (m.includes("des") || m.includes("dec")) return "Des";
        return name.substring(0, 3);
    };

    const w1Label = `W${w1.Week} ${getShortMonth(w1.nameOfMonth)}`;
    const w2Label = `W${w2.Week} ${getShortMonth(w2.nameOfMonth)}`;
    
    // 3. Calculate Progress
    const recordStat = data.w2.stats?.find(s => s.Statistic === 'Σ Record');
    const progress = recordStat && recordStat.mingguLalu > 0 
        ? Math.round((recordStat.mingguIni / recordStat.mingguLalu) * 100)
        : 0;

    const summaryText = `Berikut terlampirkan Peta Perbandingan Kondisi Piezometer ${w1Label} dan ${w2Label} ${w2.Year}. Update ${formattedDate}. Progres Pendataan Piezometer ${ptName.replace('PT.', '')} Minggu ke-${w2.Week} ${getShortMonth(w2.nameOfMonth)} sudah ${progress}%. \nTerimakasih.`;

    const handleCopyText = async () => {
        try {
            await navigator.clipboard.writeText(summaryText);
            setCopied(true);
            setTimeout(() => setCopied(false), 2000);
        } catch (err) {
            console.error('Failed to copy text:', err);
        }
    };

    return (
        <div className="bg-white border border-gray-200 rounded-2xl p-5 shadow-xs">
            <div className="flex flex-col sm:flex-row justify-between items-start gap-4">
                <p className="text-sm text-gray-800 font-medium leading-relaxed whitespace-pre-wrap">
                    {summaryText}
                </p>
                <button
                    type="button"
                    onClick={handleCopyText}
                    className={`min-h-11 shrink-0 inline-flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-semibold transition-colors border ${
                        copied
                        ? 'bg-emerald-50 text-emerald-800 border-emerald-300'
                        : 'bg-white text-gray-900 border-gray-300 hover:bg-gray-50'
                    }`}
                >
                    {copied ? <Check size={14} aria-hidden="true" /> : <Copy size={14} aria-hidden="true" />}
                    <span>{copied ? 'Teks Tersalin!' : 'Copy Teks'}</span>
                </button>
            </div>
        </div>
    );
}

function ReportColumn({ data }) {
    if (!data || !data.meta) return null;
    const { meta, legend, imgUrl, stats } = data;

    const title = `Week ${meta.Week} ${meta.nameOfMonth} ${meta.Year} (${meta.StartDate} - ${meta.EndDate})`;

    return (
        <div className="space-y-6">
            <h2 className="text-2xl font-bold text-gray-800 font-sans tracking-tight leading-none px-1">
                {title}
            </h2>

            <div className="space-y-4">
                <div className="overflow-hidden shadow-xs">
                    <img 
                        src={imgUrl} 
                        alt={title}
                        crossOrigin="anonymous"
                        className="w-full h-auto block min-h-[400px] object-cover"
                    />
                </div>

                <div className="grid grid-cols-1 lg:grid-cols-10 gap-4">
                    <div className="lg:col-span-5">
                        <LegendTable legendData={legend} />
                    </div>
                    <div className="lg:col-span-5">
                        <StatsTable statsData={stats} />
                    </div>
                </div>
            </div>
        </div>
    );
}

function LegendTable({ legendData }) {
    if (!legendData) return null;
    return (
        <div className="border border-[#ddd] overflow-hidden">
            <table className="w-full text-left border-collapse font-['Arial_Narrow',_sans-serif] text-[14px]">
                <thead className="bg-[#f9f9f9] border-b border-[#ddd]">
                    <tr className="text-gray-900">
                        <th className="border border-[#ddd] px-2 py-1.5 text-center w-[12%]">Warna</th>
                        <th className="border border-[#ddd] px-3 py-1.5 w-[58%]">Keterangan</th>
                        <th className="border border-[#ddd] px-2 py-1.5 text-center w-[15%] whitespace-nowrap">Total Block</th>
                        <th className="border border-[#ddd] px-2 py-1.5 text-center w-[15%]">%</th>
                    </tr>
                </thead>
                <tbody className="text-gray-900 font-bold">
                    {legendData.map((row, i) => {
                        const isSpecial = ["No Data", "Total", "Shade"].includes(row.IndicatorName);
                        return (
                            <tr key={i} className={i % 2 === 0 ? 'bg-[#f9f9f9]' : 'bg-white'}>
                                <td 
                                    className="border border-[#ddd] p-0"
                                    style={{ 
                                        backgroundColor: isSpecial ? '#ffffff' : row.colorBack,
                                    }}
                                >
                                    <div className="h-8 w-full" />
                                </td>
                                <td className="border border-[#ddd] px-3 py-1.5">
                                    {row.IndicatorAliasReport ? `${row.IndicatorAliasReport} ( ${row.IndicatorName} )` : `( ${row.IndicatorName} )`}
                                </td>
                                <td className="border border-[#ddd] px-3 py-1.5 text-right">
                                    {row.totalPiezo ?? '-'}
                                </td>
                                <td className="border border-[#ddd] px-3 py-1.5 text-right">
                                    {row.persenPiezo}
                                </td>
                            </tr>
                        );
                    })}
                </tbody>
            </table>
        </div>
    );
}

function StatsTable({ statsData }) {
    if (!statsData) return null;
    return (
        <div className="border border-[#ddd] overflow-hidden">
            <table className="w-full text-left border-collapse font-['Arial_Narrow',_sans-serif] text-[15px]">
                <thead className="bg-[#f9f9f9] border-b border-[#ddd]">
                    <tr className="text-gray-900">
                        <th className="border border-[#ddd] px-3 py-1.5 w-[40%] text-center">Statistik</th>
                        <th className="border border-[#ddd] px-2 py-1.5 text-center w-[20%] whitespace-nowrap">Minggu Lalu</th>
                        <th className="border border-[#ddd] px-2 py-1.5 text-center w-[20%] whitespace-nowrap">Minggu Ini</th>
                        <th className="border border-[#ddd] px-2 py-1.5 text-center w-[20%]">Selisih</th>
                    </tr>
                </thead>
                <tbody className="text-gray-900 font-bold">
                    {statsData.map((row, i) => {
                        const selisih = (row.selisih === 0 && ["Σ Piezo", "Σ Record"].includes(row.Statistic)) ? '' : row.selisih;
                        return (
                            <tr key={i} className={i % 2 === 0 ? 'bg-[#f9f9f9]' : 'bg-white'}>
                                <td className="border border-[#ddd] px-3 py-2">{row.Statistic}</td>
                                <td className="border border-[#ddd] px-3 py-2 text-right">{row.mingguLalu}</td>
                                <td className="border border-[#ddd] px-3 py-2 text-right">{row.mingguIni}</td>
                                <td className="border border-[#ddd] px-3 py-2 text-right">
                                    {selisih}
                                </td>
                            </tr>
                        );
                    })}
                </tbody>
            </table>
        </div>
    );
}

function SkeletonColumn() {
    return (
        <div className="space-y-6 animate-pulse">
            <div className="h-8 w-3/4 bg-gray-100 rounded-lg" />
            <div className="h-[400px] w-full bg-gray-50 rounded-[24px]" />
            <div className="grid grid-cols-10 gap-4">
                <div className="col-span-6 h-64 bg-gray-50 rounded-2xl" />
                <div className="col-span-4 h-64 bg-gray-50 rounded-2xl" />
            </div>
        </div>
    );
}
