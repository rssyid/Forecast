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

    useEffect(() => {
        if (ptName && weekId) fetchReport();
    }, [ptName, weekId]);

    return (
        <div className="p-4 md:p-8 min-h-screen bg-white">
            <div className="max-w-[1400px] mx-auto space-y-8">
                {/* Header Section */}
                <header className="flex flex-col md:flex-row md:items-end justify-between gap-6 bg-white p-8 rounded-[32px] border border-gray-100 shadow-sm">
                    <div className="space-y-1">
                        <h1 className="text-3xl font-black text-gray-900 tracking-tight flex items-center gap-3">
                            <FileText className="text-brand-orange" size={32} />
                            Laporan Piezometer Harian
                        </h1>
                        <p className="text-gray-400 font-medium text-lg">
                            Visualisasi Perbandingan Mingguan & Statistik TMAT
                        </p>
                    </div>

                    <div className="flex flex-wrap items-center gap-4">
                        <div className="w-64">
                            <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest ml-2 mb-1.5 block">
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
                        <div className="w-64">
                            <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest ml-2 mb-1.5 block">
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
                            onClick={fetchReport}
                            disabled={loading}
                            className="p-3 mt-5.5 bg-white hover:bg-gray-50 border border-gray-200 rounded-xl transition-all text-gray-600 shadow-sm disabled:opacity-50"
                        >
                            <RefreshCw size={20} className={loading ? 'animate-spin' : ''} />
                        </button>
                    </div>
                </header>

                {error && (
                    <div className="p-6 bg-red-50 border border-red-100 rounded-2xl flex items-center gap-4 text-red-700">
                        <AlertCircle size={24} />
                        <p className="font-bold">{error}</p>
                    </div>
                )}

                {loading ? (
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                        <SkeletonColumn />
                        <SkeletonColumn />
                    </div>
                ) : data ? (
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-10">
                        <ReportColumn data={data.w1} />
                        <ReportColumn data={data.w2} />
                    </div>
                ) : (
                    <div className="py-32 text-center">
                        <div className="w-20 h-20 bg-gray-50 rounded-full flex items-center justify-center mx-auto mb-4 text-gray-300">
                            <ImageIcon size={40} />
                        </div>
                        <p className="text-gray-400 font-bold text-xl">Pilih Company dan Minggu untuk melihat laporan.</p>
                    </div>
                )}
            </div>
        </div>
    );
}

function ReportColumn({ data }) {
    if (!data || !data.meta) return null;
    const { meta, legend, imgUrl, stats } = data;
    const [copying, setCopying] = useState(false);
    const [copied, setCopied] = useState(false);
    const reportRef = useRef(null);

    const title = `Week ${meta.Week} ${meta.nameOfMonth} ${meta.Year} (${meta.StartDate} - ${meta.EndDate})`;

    const handleCopyImage = async () => {
        if (!reportRef.current) return;
        setCopying(true);
        try {
            // Using modern-screenshot for high quality export
            const blob = await domToBlob(reportRef.current, {
                backgroundColor: '#ffffff',
                scale: 2 // High DPI
            });
            
            if (blob) {
                const item = new ClipboardItem({ [blob.type]: blob });
                await navigator.clipboard.write([item]);
                setCopied(true);
                setTimeout(() => setCopied(false), 2000);
            }
        } catch (err) {
            console.error('Failed to copy image:', err);
        } finally {
            setCopying(false);
        }
    };

    return (
        <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-700">
            <div className="flex justify-between items-center pr-2">
                <h2 className="text-2xl font-bold text-gray-800 font-sans tracking-tight leading-none">
                    {title}
                </h2>
                <button 
                    onClick={handleCopyImage}
                    disabled={copying}
                    className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-bold transition-all border ${
                        copied 
                        ? 'bg-green-50 text-green-700 border-green-200' 
                        : 'bg-white text-gray-600 border-gray-200 hover:bg-gray-50'
                    }`}
                >
                    {copying ? <RefreshCw size={14} className="animate-spin" /> : (copied ? <Check size={14} /> : <Copy size={14} />)}
                    {copied ? 'Copied!' : 'Copy Image'}
                </button>
            </div>

            <div ref={reportRef} className="bg-white p-4 -m-4 rounded-[4px]">
                <div className="space-y-4">
                    <div className="overflow-hidden border border-[#ddd] shadow-sm">
                        <img 
                            src={imgUrl} 
                            alt={title}
                            crossOrigin="anonymous"
                            className="w-full h-auto block min-h-[400px] object-cover"
                        />
                    </div>

                    <div className="grid grid-cols-1 lg:grid-cols-10 gap-4">
                        <div className="lg:col-span-6">
                            <LegendTable legendData={legend} />
                        </div>
                        <div className="lg:col-span-4">
                            <StatsTable statsData={stats} />
                        </div>
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
                        <th className="border border-[#ddd] px-2 py-1.5 text-center w-[10%]">Warna</th>
                        <th className="border border-[#ddd] px-3 py-1.5 w-[70%]">Keterangan</th>
                        <th className="border border-[#ddd] px-2 py-1.5 text-center w-[10%] whitespace-nowrap">Total Block</th>
                        <th className="border border-[#ddd] px-2 py-1.5 text-center w-[10%]">%</th>
                    </tr>
                </thead>
                <tbody className="text-gray-900 font-bold">
                    {legendData.map((row, i) => {
                        const isSpecial = ["No Data", "Total", "Shade"].includes(row.IndicatorName);
                        return (
                            <tr key={i} className={i % 2 === 0 ? 'bg-[#f9f9f9]' : 'bg-white'}>
                                <td className="border border-[#ddd] p-1 text-center">
                                    <div 
                                        className="h-5 w-full mx-auto"
                                        style={{ 
                                            backgroundColor: isSpecial ? '#ffffff' : row.colorBack,
                                        }}
                                    />
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
                        <th className="border border-[#ddd] px-3 py-1.5 w-[70%] text-center">Statistik</th>
                        <th className="border border-[#ddd] px-2 py-1.5 text-center w-[10%] whitespace-nowrap">Minggu Lalu</th>
                        <th className="border border-[#ddd] px-2 py-1.5 text-center w-[10%] whitespace-nowrap">Minggu Ini</th>
                        <th className="border border-[#ddd] px-2 py-1.5 text-center w-[10%]">Selisih</th>
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
