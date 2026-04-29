"use client";

import { useState, useEffect } from 'react';
import { CalendarDays, RefreshCw, AlertCircle, TrendingUp, TrendingDown, Minus } from 'lucide-react';
import SearchableSelect from './SearchableSelect';
import CompanyComparisonCard from './CompanyComparisonCard';

export default function ComparisonGridClient() {
    const [week, setWeek] = useState('');
    const [weekList, setWeekList] = useState([]);
    const [data, setData] = useState(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);
    const [prevWeekName, setPrevWeekName] = useState('');

    // 1. Fetch weeks list
    useEffect(() => {
        fetch('/api/calendar-weeks')
            .then(r => r.json())
            .then(json => {
                if (json.weeks) {
                    const names = json.weeks.map(w => w.formatted_name);
                    setWeekList(names);
                    // Default to latest week
                    if (names.length > 0) setWeek(names[0]);
                }
            });
    }, []);

    // 2. Fetch bulk data when week changes
    const fetchBulkData = async () => {
        if (!week) return;
        setLoading(true);
        setError(null);
        try {
            const res = await fetch(`/api/comparison-bulk?week=${encodeURIComponent(week)}`);
            const json = await res.json();
            if (!res.ok) throw new Error(json.error || 'Failed to fetch comparison data');
            setData(json.data);
            setPrevWeekName(json.weeks.prev);
        } catch (err) {
            setError(err.message);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        if (week) fetchBulkData();
    }, [week]);

    // Calculate Week ID for display using an anchor point
    const anchorWeek = 'Apr 2026, W4';
    const anchorId = 503;
    const anchorIdx = weekList.indexOf(anchorWeek);
    const currentIdx = weekList.indexOf(week);
    
    const weekId = (anchorIdx !== -1 && currentIdx !== -1) 
        ? anchorId + (anchorIdx - currentIdx) 
        : null;

    return (
        <div className="max-w-[900px] mx-auto space-y-12 animate-in fade-in duration-1000 pb-20">
            {/* Header Section */}
            <header className="flex flex-col md:flex-row md:items-end justify-between gap-6 bg-[#FAFAFA] p-8 rounded-[42px] border border-gray-100 shadow-sm">
                <div className="space-y-1">
                    <h1 className="text-4xl font-black text-gray-900 tracking-[-0.04em] flex items-center gap-3">
                        <TrendingUp className="text-blue-600" size={36} />
                        Executive Dashboard
                    </h1>
                    <p className="text-gray-400 font-medium pl-1 text-lg">
                        {week} <span className="text-blue-500 font-black ml-2">ID: {weekId || '---'}</span>
                    </p>
                </div>

                <div className="flex items-center gap-4">
                    <div className="w-72">
                        <label className="text-[11px] font-black text-gray-400 uppercase tracking-widest ml-2 mb-2 block">
                            Pilih Periode Analisis
                        </label>
                        <SearchableSelect 
                            options={weekList}
                            value={week}
                            onChange={setWeek}
                            placeholder="Pilih Minggu"
                            icon={<CalendarDays size={16} />}
                            autoSort={false}
                        />
                    </div>
                    <button 
                        onClick={fetchBulkData}
                        disabled={loading}
                        className="p-4 mt-6 bg-white hover:bg-gray-50 border border-gray-200 rounded-2xl transition-all text-gray-600 shadow-sm disabled:opacity-50"
                    >
                        <RefreshCw size={24} className={loading ? 'animate-spin' : ''} />
                    </button>
                </div>
            </header>

            {error && (
                <div className="p-8 bg-red-50 border border-red-100 rounded-[42px] flex items-center gap-4 text-red-700 shadow-sm">
                    <AlertCircle size={28} />
                    <p className="font-bold text-lg">{error}</p>
                </div>
            )}

            {/* Single Column Grid for the new larger cards */}
            <div className="flex flex-col gap-12">
                {loading ? (
                    // Skeleton Loaders
                    Array.from({ length: 3 }).map((_, i) => (
                        <div key={i} className="h-[600px] bg-white rounded-[42px] border border-gray-100 animate-pulse shadow-sm" />
                    ))
                ) : data && data.map((item) => (
                    <CompanyComparisonCard 
                        key={item.companyCode} 
                        item={item} 
                        currentWeek={week}
                        prevWeek={prevWeekName}
                    />
                ))}
            </div>

            {!loading && data?.length === 0 && (
                <div className="py-20 text-center space-y-4">
                    <div className="w-20 h-20 bg-gray-100 rounded-full flex items-center justify-center mx-auto text-gray-400">
                        <Minus size={40} />
                    </div>
                    <p className="text-gray-500 font-bold text-xl">Tidak ada data untuk periode ini.</p>
                </div>
            )}
        </div>
    );
}
