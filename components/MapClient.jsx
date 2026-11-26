"use client";

import { useState, useEffect, useMemo } from 'react';
import dynamic from 'next/dynamic';
import { Globe, Map as MapIcon, Filter, Info, RefreshCw, Layers, CalendarDays } from 'lucide-react';
import SearchableSelect from './SearchableSelect';

const LeafletMap = dynamic(() => import('./LeafletMap'), { 
    ssr: false,
    loading: () => (
        <div className="w-full h-full bg-gray-900 rounded-2xl flex flex-col items-center justify-center text-gray-500 gap-4 border border-gray-800">
            <RefreshCw className="animate-spin" size={32} />
            <p className="text-sm font-medium animate-pulse">Memuat Peta Interaktif...</p>
        </div>
    )
});

const COMPANIES = ['Semua', 'PT.JJP', 'PT.THIP', 'PT.GAN', 'PT.SML', 'PT.BNS', 'PT.KDP'];

export default function MapClient() {
    const [company, setCompany] = useState('Semua');
    const [week, setWeek] = useState('');
    const [weekList, setWeekList] = useState([]);
    const [geoData, setGeoData] = useState(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);
    const [searchTerm, setSearchTerm] = useState('');
    const [baseLayer, setBaseLayer] = useState('dark'); // 'dark' or 'satellite'

    // Fetch weeks list
    useEffect(() => {
        fetch('/api/calendar-weeks')
            .then(r => r.json())
            .then(json => {
                if (json.weeks) {
                    setWeekList(json.weeks.map(w => w.formatted_name));
                    // Default to latest week
                    if (json.weeks.length > 0) setWeek(json.weeks[0].formatted_name);
                }
            });
    }, []);

    const fetchData = async () => {
        setLoading(true);
        setError(null);
        try {
            const params = new URLSearchParams({ company });
            if (week) params.set('week', week);
            const res = await fetch(`/api/map-data?${params}`);
            const json = await res.json();
            if (!res.ok) throw new Error(json.error || 'Gagal memuat data peta');
            setGeoData(json);
        } catch (err) {
            setError(err.message);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        if (week || company) fetchData();
    }, [company, week]);

    // Derived data for search
    const filteredGeoData = useMemo(() => {
        if (!geoData) return null;
        if (!searchTerm) return geoData;
        const lower = searchTerm.toLowerCase();
        return {
            ...geoData,
            features: geoData.features.filter(f => 
                f.properties.pie_record_id.toLowerCase().includes(lower) ||
                f.properties.est_code.toLowerCase().includes(lower)
            )
        };
    }, [geoData, searchTerm]);

    const stats = useMemo(() => {
        if (!geoData) return null;
        const total = geoData.features.length;
        let banjir = 0, tergenang = 0, a_tergenang = 0, normal = 0, a_kering = 0, kering = 0;
        
        geoData.features.forEach(f => {
            const s = f.properties.status?.toUpperCase() || '';
            if (s.includes('BANJIR')) banjir++;
            else if (s.includes('A') && s.includes('TERGENANG')) a_tergenang++;
            else if (s.includes('TERGENANG')) tergenang++;
            else if (s.includes('NORMAL')) normal++;
            else if (s.includes('A') && s.includes('KERING')) a_kering++;
            else if (s.includes('KERING')) kering++;
        });

        const noData = total - (banjir + tergenang + a_tergenang + normal + a_kering + kering);
        return { total, banjir, tergenang, a_tergenang, normal, a_kering, kering, noData };
    }, [geoData]);

    return (
        <div className="space-y-6">
            <header className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
                <div>
                    <h1 className="text-2xl sm:text-3xl font-bold text-gray-900 tracking-tight">Visualisasi Spasial (GIS)</h1>
                    <p className="text-sm text-gray-600 mt-1">Pemantauan status TMAT berbasis blok secara real-time.</p>
                </div>
            </header>

            <section aria-label="Filter peta interaktif" className="relative z-[1001] flex flex-wrap items-center gap-2.5 bg-white p-3 sm:p-4 rounded-2xl border border-gray-200 shadow-xs">
                {/* Search Input */}
                <div className="relative w-full sm:w-56">
                    <label htmlFor="map-search-pzo" className="sr-only">Cari ID PZO atau Blok</label>
                    <input
                        id="map-search-pzo"
                        type="text"
                        value={searchTerm}
                        onChange={e => setSearchTerm(e.target.value)}
                        placeholder="Cari ID PZO / Blok..."
                        className="w-full h-11 pl-10 pr-4 bg-white border border-gray-300 rounded-xl text-sm font-medium text-gray-900 placeholder-gray-500"
                    />
                    <Filter className="absolute left-3.5 top-3.5 text-gray-500 pointer-events-none" size={15} aria-hidden="true" />
                </div>

                <div className="w-40">
                    <SearchableSelect
                        options={COMPANIES}
                        value={company}
                        onChange={setCompany}
                        placeholder="Company"
                        icon={<Globe size={14} />}
                        autoSort={false}
                    />
                </div>
                <div className="w-48">
                    <SearchableSelect
                        options={weekList}
                        value={week}
                        onChange={setWeek}
                        placeholder="Pilih Minggu"
                        icon={<CalendarDays size={14} />}
                        autoSort={false}
                    />
                </div>

                {/* Layer Toggle */}
                <div className="flex bg-gray-100 p-1 rounded-xl border border-gray-200" role="group" aria-label="Pilih basemap">
                    <button
                        type="button"
                        onClick={() => setBaseLayer('dark')}
                        aria-pressed={baseLayer === 'dark'}
                        className={`min-h-9 px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors whitespace-nowrap ${baseLayer === 'dark' ? 'bg-black text-white' : 'text-gray-700 hover:text-gray-900'}`}
                    >
                        Dark
                    </button>
                    <button
                        type="button"
                        onClick={() => setBaseLayer('light')}
                        aria-pressed={baseLayer === 'light'}
                        className={`min-h-9 px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors whitespace-nowrap ${baseLayer === 'light' ? 'bg-black text-white' : 'text-gray-700 hover:text-gray-900'}`}
                    >
                        Light
                    </button>
                    <button
                        type="button"
                        onClick={() => setBaseLayer('satellite')}
                        aria-pressed={baseLayer === 'satellite'}
                        className={`min-h-9 px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors whitespace-nowrap ${baseLayer === 'satellite' ? 'bg-black text-white' : 'text-gray-700 hover:text-gray-900'}`}
                    >
                        Satelit
                    </button>
                </div>

                <button
                    type="button"
                    onClick={fetchData}
                    disabled={loading}
                    aria-label="Muat ulang data peta"
                    title="Muat ulang data peta"
                    className="min-h-11 min-w-11 inline-flex items-center justify-center bg-white border border-gray-300 rounded-xl hover:bg-gray-50 transition-colors text-gray-900 disabled:opacity-50"
                >
                    <RefreshCw size={16} className={loading ? 'animate-spin' : ''} aria-hidden="true" />
                </button>
            </section>

            <div className="relative z-0 grid grid-cols-1 lg:grid-cols-4 gap-6 items-start">
                {/* Stats Sidebar */}
                <div className="lg:col-span-1 space-y-6">
                    {stats && (
                        <div className="bg-white rounded-2xl border border-gray-200 p-5 shadow-xs space-y-5">
                            <h2 className="text-sm font-bold text-gray-900 flex items-center gap-2 border-b border-gray-200 pb-3">
                                <Layers size={16} className="text-gray-700" aria-hidden="true" />
                                <span>Ringkasan Data Spasial</span>
                            </h2>

                            <div className="space-y-4">
                                <div className="p-4 bg-gray-50 rounded-xl border border-gray-200">
                                    <p className="text-xs font-semibold text-gray-600 uppercase tracking-wide">Total Blok Terdaftar</p>
                                    <p className="text-3xl font-bold text-gray-900 mt-1 tabular-nums">{stats.total}</p>
                                </div>

                                <div className="grid grid-cols-1 gap-2 tabular-nums">
                                    <div className="flex items-center justify-between p-2.5 bg-red-50 border border-red-200 rounded-xl">
                                        <div className="flex items-center gap-2">
                                            <div className="w-2.5 h-2.5 rounded-full bg-[#ef4444]"></div>
                                            <span className="text-xs font-semibold text-red-900">Kering (&gt;65cm)</span>
                                        </div>
                                        <span className="text-sm font-bold text-red-900">{stats.kering}</span>
                                    </div>
                                    <div className="flex items-center justify-between p-2.5 bg-amber-50 border border-amber-200 rounded-xl">
                                        <div className="flex items-center gap-2">
                                            <div className="w-2.5 h-2.5 rounded-full bg-[#f59e0b]"></div>
                                            <span className="text-xs font-semibold text-amber-900">A. Kering (61-65cm)</span>
                                        </div>
                                        <span className="text-sm font-bold text-amber-900">{stats.a_kering}</span>
                                    </div>
                                    <div className="flex items-center justify-between p-2.5 bg-emerald-50 border border-emerald-200 rounded-xl">
                                        <div className="flex items-center gap-2">
                                            <div className="w-2.5 h-2.5 rounded-full bg-[#22c55e]"></div>
                                            <span className="text-xs font-semibold text-emerald-900">Normal (46-60cm)</span>
                                        </div>
                                        <span className="text-sm font-bold text-emerald-900">{stats.normal}</span>
                                    </div>
                                    <div className="flex items-center justify-between p-2.5 bg-blue-50 border border-blue-200 rounded-xl">
                                        <div className="flex items-center gap-2">
                                            <div className="w-2.5 h-2.5 rounded-full bg-[#60a5fa]"></div>
                                            <span className="text-xs font-semibold text-blue-900">A. Tergenang (41-45cm)</span>
                                        </div>
                                        <span className="text-sm font-bold text-blue-900">{stats.a_tergenang}</span>
                                    </div>
                                    <div className="flex items-center justify-between p-2.5 bg-blue-100/70 border border-blue-300 rounded-xl">
                                        <div className="flex items-center gap-2">
                                            <div className="w-2.5 h-2.5 rounded-full bg-[#2563eb]"></div>
                                            <span className="text-xs font-semibold text-blue-950">Tergenang (0-40cm)</span>
                                        </div>
                                        <span className="text-sm font-bold text-blue-950">{stats.tergenang}</span>
                                    </div>
                                    <div className="flex items-center justify-between p-2.5 bg-gray-100 border border-gray-300 rounded-xl">
                                        <div className="flex items-center gap-2">
                                            <div className="w-2.5 h-2.5 rounded-full bg-[#6b7280]"></div>
                                            <span className="text-xs font-semibold text-gray-900">Banjir (&lt;0cm)</span>
                                        </div>
                                        <span className="text-sm font-bold text-gray-900">{stats.banjir}</span>
                                    </div>
                                </div>
                            </div>
                        </div>
                    )}
                </div>

                {/* Map Container */}
                <div className="lg:col-span-3 relative bg-white rounded-2xl border border-gray-200 p-2 shadow-xs h-[540px] lg:h-[620px]">
                    {error ? (
                        <div role="alert" className="w-full h-full bg-red-50 rounded-xl flex flex-col items-center justify-center text-red-900 p-10 text-center gap-3 border border-red-300">
                            <RefreshCw size={40} className="text-red-700" aria-hidden="true" />
                            <p className="font-bold">Gagal memuat data spasial</p>
                            <p className="text-xs text-red-800">{error}</p>
                            <button type="button" onClick={fetchData} className="mt-2 min-h-11 px-6 py-2 bg-black text-white rounded-xl text-sm font-semibold hover:bg-gray-800 transition-colors">Coba Lagi</button>
                        </div>
                    ) : (
                        <div className="w-full h-full relative overflow-hidden rounded-xl border border-gray-200">
                            <LeafletMap
                                data={filteredGeoData}
                                baseLayer={baseLayer}
                            />

                            {/* Legend Overlay */}
                            <div className="absolute bottom-4 left-4 z-[1000] bg-gray-900/95 p-4 rounded-xl border border-gray-700 shadow-lg">
                                <p className="text-[11px] font-bold text-gray-300 uppercase tracking-wider mb-2.5">Legenda TMAT</p>
                                <div className="grid grid-cols-2 gap-x-4 gap-y-2">
                                    <div className="flex items-center gap-2">
                                        <div className="w-3 h-3 rounded-full bg-[#ef4444]"></div>
                                        <span className="text-[11px] font-semibold text-white whitespace-nowrap">Kering (&gt;65cm)</span>
                                    </div>
                                    <div className="flex items-center gap-2">
                                        <div className="w-3 h-3 rounded-full bg-[#f59e0b]"></div>
                                        <span className="text-[11px] font-semibold text-white whitespace-nowrap">A. Kering (61-65cm)</span>
                                    </div>
                                    <div className="flex items-center gap-2">
                                        <div className="w-3 h-3 rounded-full bg-[#22c55e]"></div>
                                        <span className="text-[11px] font-semibold text-white whitespace-nowrap">Normal (46-60cm)</span>
                                    </div>
                                    <div className="flex items-center gap-2">
                                        <div className="w-3 h-3 rounded-full bg-[#60a5fa]"></div>
                                        <span className="text-[11px] font-semibold text-white whitespace-nowrap">A. Tergenang (41-45cm)</span>
                                    </div>
                                    <div className="flex items-center gap-2">
                                        <div className="w-3 h-3 rounded-full bg-[#2563eb]"></div>
                                        <span className="text-[11px] font-semibold text-white whitespace-nowrap">Tergenang (0-40cm)</span>
                                    </div>
                                    <div className="flex items-center gap-2">
                                        <div className="w-3 h-3 rounded-full bg-[#6b7280]"></div>
                                        <span className="text-[11px] font-semibold text-white whitespace-nowrap">Banjir (&lt;0cm)</span>
                                    </div>
                                </div>
                            </div>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}
