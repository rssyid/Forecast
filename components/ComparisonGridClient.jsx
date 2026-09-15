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

    const [serverWeekId, setServerWeekId] = useState(null);
    const [syncing, setSyncing] = useState(false);

    // 2. Fetch bulk data when week changes
    const fetchBulkData = async (forceSync = false) => {
        if (!week) return;
        setLoading(true);
        if (forceSync) setSyncing(true);
        setError(null);
        try {
            const url = forceSync 
                ? `/api/comparison-bulk?week=${encodeURIComponent(week)}&forceSync=true`
                : `/api/comparison-bulk?week=${encodeURIComponent(week)}`;
            const res = await fetch(url);
            const json = await res.json();
            if (!res.ok) throw new Error(json.error || 'Failed to fetch comparison data');
            setData(json.data);
            setPrevWeekName(json.weeks.prev);
            if (json.currentWeekId) setServerWeekId(json.currentWeekId);
        } catch (err) {
            setError(err.message);
        } finally {
            setLoading(false);
            setSyncing(false);
        }
    };

    useEffect(() => {
        if (week) fetchBulkData(false);
    }, [week]);

    // Calculate Week ID for display using an anchor point or server value
    const anchorWeek = 'Apr 2026, W4';
    const anchorId = 503;
    const anchorIdx = weekList.indexOf(anchorWeek);
    const currentIdx = weekList.indexOf(week);
    
    const computedWeekId = (anchorIdx !== -1 && currentIdx !== -1) 
        ? anchorId + (anchorIdx - currentIdx) 
        : null;
    const weekId = serverWeekId || computedWeekId;

    return (
        <div className="max-w-[900px] mx-auto space-y-12 animate-in fade-in duration-1000 pb-20">
            {/* Header Section */}
            <header className="flex flex-col md:flex-row md:items-end justify-between gap-6 bg-white p-8 rounded-[42px] border border-gray-100 shadow-sm">
                <div className="space-y-1">
                    <h1 className="text-4xl font-black text-gray-900 tracking-[-0.04em] flex items-center gap-3">
                        <TrendingUp className="text-blue-600" size={36} />
                        Executive Dashboard
                    </h1>
                    <p className="text-gray-400 font-medium pl-1 text-lg">
                        {week} <span className="text-blue-500 font-black ml-2">ID: {weekId || '---'}</span>
                    </p>
                </div>

                <div className="flex items-center gap-3">
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
                        onClick={() => fetchBulkData(true)}
                        disabled={loading || syncing}
                        className="flex items-center gap-2 px-5 py-4 mt-6 bg-blue-600 hover:bg-blue-700 text-white font-bold text-sm rounded-2xl transition-all shadow-sm disabled:opacity-50 whitespace-nowrap cursor-pointer"
                        title="Sinkronisasi data langsung dari server GIS-DIV"
                    >
                        <RefreshCw size={18} className={syncing ? 'animate-spin' : ''} />
                        <span>{syncing ? 'Syncing...' : 'Sync GIS'}</span>
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
