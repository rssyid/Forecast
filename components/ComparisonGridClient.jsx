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

    return (
        <div className="max-w-[1600px] mx-auto space-y-8 animate-in fade-in duration-700">
            {/* Header Section */}
            <header className="flex flex-col md:flex-row md:items-end justify-between gap-6 bg-white p-6 rounded-3xl shadow-sm border border-gray-100">
                <div className="space-y-1">
                    <h1 className="text-3xl font-black text-gray-900 tracking-tight flex items-center gap-3">
                        <TrendingUp className="text-blue-600" size={32} />
                        Executive Comparison
                    </h1>
                    <p className="text-gray-500 font-medium pl-1">
                        Monitoring pergerakan status TMAT & Curah Hujan antar perusahaan (Week-over-Week).
                    </p>
                </div>

                <div className="flex items-center gap-4">
                    <div className="w-64">
                        <label className="text-[10px] font-black text-gray-400 uppercase tracking-wider ml-1 mb-1 block">
                            Target Minggu
                        </label>
                        <SearchableSelect 
                            options={weekList}
                            value={week}
                            onChange={setWeek}
                            placeholder="Pilih Minggu"
                            icon={<CalendarDays size={14} />}
                            autoSort={false}
                        />
                    </div>
                    <button 
                        onClick={fetchBulkData}
                        disabled={loading}
                        className="p-3 mt-5 bg-gray-50 hover:bg-gray-100 border border-gray-200 rounded-2xl transition-all text-gray-600 disabled:opacity-50"
                    >
                        <RefreshCw size={20} className={loading ? 'animate-spin' : ''} />
                    </button>
                </div>
            </header>

            {error && (
                <div className="p-6 bg-red-50 border border-red-100 rounded-3xl flex items-center gap-4 text-red-700 shadow-sm">
                    <AlertCircle size={24} />
                    <p className="font-bold">{error}</p>
                </div>
            )}

            {/* Grid Section */}
            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-8">
                {loading ? (
                    // Skeleton Loaders
                    Array.from({ length: 6 }).map((_, i) => (
                        <div key={i} className="h-[450px] bg-white rounded-3xl border border-gray-100 animate-pulse shadow-sm" />
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
