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
            else if (s === 'TERGENANG') tergenang++;
            else if (s.includes('A. TERGENANG')) a_tergenang++;
            else if (s.includes('NORMAL')) normal++;
            else if (s.includes('A. KERING')) a_kering++;
            else if (s.includes('KERING')) kering++;
        });

        const noData = total - (banjir + tergenang + a_tergenang + normal + a_kering + kering);
        return { total, banjir, tergenang, a_tergenang, normal, a_kering, kering, noData };
    }, [geoData]);

    return (
        <div className="max-w-[1600px] mx-auto space-y-6 animate-in fade-in duration-700">
            <header className="relative z-[1001] flex flex-col xl:flex-row xl:items-center justify-between gap-4">
                <div className="flex items-center gap-4">
                    <div className="p-3 bg-white rounded-2xl shadow-sm border border-gray-100 text-blue-600">
                        <MapIcon size={24} />
                    </div>
                    <div>
                        <h1 className="text-2xl font-bold text-gray-900 tracking-tight">Visualisasi Spasial (GIS)</h1>
                        <p className="text-sm text-gray-500 font-medium">Pemantauan status TMAT berbasis blok secara real-time.</p>
                    </div>
                </div>

                <div className="flex flex-wrap items-center gap-3 bg-white/50 p-2 rounded-2xl backdrop-blur-sm border border-white/50">
                    {/* Search Input */}
                    <div className="relative w-full md:w-64">
                        <input 
                            type="text"
                            value={searchTerm}
                            onChange={e => setSearchTerm(e.target.value)}
                            placeholder="Cari ID PZO / Blok..."
                            className="w-full h-11 pl-10 pr-4 bg-white border border-gray-200 rounded-xl text-sm focus:ring-2 focus:ring-blue-500/20 outline-none transition-all font-medium"
                        />
                        <Filter className="absolute left-3.5 top-3.5 text-gray-400" size={14} />
                    </div>

                    <div className="w-44">
                        <SearchableSelect 
                            options={COMPANIES}
                            value={company}
                            onChange={setCompany}
                            placeholder="Pilih Company"
                            icon={<Globe size={14} />}
                            autoSort={false}
                        />
                    </div>
                    <div className="w-52">
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
                    <div className="flex bg-gray-100 p-1 rounded-xl border border-gray-200">
                        <button 
                            onClick={() => setBaseLayer('dark')}
                            className={`px-3 py-1.5 rounded-lg text-[10px] font-black transition-all ${baseLayer === 'dark' ? 'bg-white text-blue-600 shadow-sm' : 'text-gray-500 hover:text-gray-700'}`}
                        >
                            DARK
                        </button>
                        <button 
                            onClick={() => setBaseLayer('satellite')}
                            className={`px-3 py-1.5 rounded-lg text-[10px] font-black transition-all ${baseLayer === 'satellite' ? 'bg-white text-blue-600 shadow-sm' : 'text-gray-500 hover:text-gray-700'}`}
                        >
                            SATELIT
                        </button>
                    </div>

                    <button 
                        onClick={fetchData}
                        disabled={loading}
                        className="p-2.5 bg-white border border-gray-200 rounded-xl hover:bg-gray-50 transition-all text-gray-600 disabled:opacity-50"
                    >
                        <RefreshCw size={18} className={loading ? 'animate-spin' : ''} />
                    </button>
                </div>
            </header>

            <div className="relative z-0 grid grid-cols-1 lg:grid-cols-4 gap-6 h-[calc(100vh-220px)] min-h-[600px]">
                {/* Stats Sidebar */}
                <div className="lg:col-span-1 space-y-6 overflow-y-auto pr-1">
                    {stats && (
                        <div className="glass-card p-6 space-y-6">
                            <h3 className="text-sm font-bold text-gray-800 flex items-center gap-2 border-b pb-4">
                                <Layers size={16} className="text-blue-600" />
                                Ringkasan Data Spasial
                            </h3>
                            
                            <div className="space-y-4">
                                <div className="p-4 bg-gray-50 rounded-2xl border border-gray-100">
                                    <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">Total Blok Terdaftar</p>
                                    <p className="text-3xl font-black text-gray-900 mt-1">{stats.total}</p>
                                </div>

                                <div className="grid grid-cols-1 gap-2">
                                    <div className="flex items-center justify-between p-2.5 bg-red-50 border border-red-100 rounded-xl">
                                        <div className="flex items-center gap-2">
                                            <div className="w-2 h-2 rounded-full bg-[#ef4444]"></div>
                                            <span className="text-[10px] font-bold text-red-800">Kering (&gt;65cm)</span>
                                        </div>
                                        <span className="text-xs font-black text-red-900">{stats.kering}</span>
                                    </div>
                                    <div className="flex items-center justify-between p-2.5 bg-amber-50 border border-amber-100 rounded-xl">
                                        <div className="flex items-center gap-2">
                                            <div className="w-2 h-2 rounded-full bg-[#f59e0b]"></div>
                                            <span className="text-[10px] font-bold text-amber-800">A. Kering (61-65cm)</span>
                                        </div>
                                        <span className="text-xs font-black text-amber-900">{stats.a_kering}</span>
                                    </div>
                                    <div className="flex items-center justify-between p-2.5 bg-emerald-50 border border-emerald-100 rounded-xl">
                                        <div className="flex items-center gap-2">
                                            <div className="w-2 h-2 rounded-full bg-[#22c55e]"></div>
                                            <span className="text-[10px] font-bold text-emerald-800">Normal (46-60cm)</span>
                                        </div>
                                        <span className="text-xs font-black text-emerald-900">{stats.normal}</span>
                                    </div>
                                    <div className="flex items-center justify-between p-2.5 bg-blue-50 border border-blue-100 rounded-xl">
                                        <div className="flex items-center gap-2">
                                            <div className="w-2 h-2 rounded-full bg-[#60a5fa]"></div>
                                            <span className="text-[10px] font-bold text-blue-800">A. Tergenang (41-45cm)</span>
                                        </div>
                                        <span className="text-xs font-black text-blue-900">{stats.a_tergenang}</span>
                                    </div>
                                    <div className="flex items-center justify-between p-2.5 bg-blue-100/50 border border-blue-200 rounded-xl">
                                        <div className="flex items-center gap-2">
                                            <div className="w-2 h-2 rounded-full bg-[#2563eb]"></div>
                                            <span className="text-[10px] font-bold text-blue-900">Tergenang (0-40cm)</span>
                                        </div>
                                        <span className="text-xs font-black text-blue-900">{stats.tergenang}</span>
                                    </div>
                                    <div className="flex items-center justify-between p-2.5 bg-gray-100 border border-gray-200 rounded-xl">
                                        <div className="flex items-center gap-2">
                                            <div className="w-2 h-2 rounded-full bg-[#6b7280]"></div>
                                            <span className="text-[10px] font-bold text-gray-700">Banjir (&lt;0cm)</span>
                                        </div>
                                        <span className="text-xs font-black text-gray-900">{stats.banjir}</span>
                                    </div>
                                </div>
                            </div>
                        </div>
                    )}
                </div>

                {/* Map Container */}
                <div className="lg:col-span-3 relative glass-card p-2">
                    {error ? (
                        <div className="w-full h-full bg-red-50 rounded-2xl flex flex-col items-center justify-center text-red-600 p-10 text-center gap-3 border border-red-100">
                            <RefreshCw size={48} className="opacity-20" />
                            <p className="font-bold">Gagal memuat data spasial</p>
                            <p className="text-xs opacity-80">{error}</p>
                            <button onClick={fetchData} className="mt-4 px-6 py-2 bg-red-600 text-white rounded-xl text-xs font-bold hover:bg-red-700 transition-all">Coba Lagi</button>
                        </div>
                    ) : (
                        <div className="w-full h-full relative overflow-hidden rounded-2xl border border-gray-200 shadow-inner">
                            <LeafletMap 
                                data={filteredGeoData} 
                                baseLayer={baseLayer}
                            />
                            
                            {/* Legend Overlay */}
                            <div className="absolute bottom-6 left-6 z-[1000] bg-gray-900/90 backdrop-blur-md p-4 rounded-2xl border border-white/10 shadow-2xl">
                                <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-3">Legenda TMAT</p>
                                <div className="grid grid-cols-2 gap-x-4 gap-y-2">
                                    <div className="flex items-center gap-2">
                                        <div className="w-3 h-3 rounded-full bg-[#ef4444]"></div>
                                        <span className="text-[9px] font-bold text-white whitespace-nowrap">KERING (&gt;65cm)</span>
                                    </div>
                                    <div className="flex items-center gap-2">
                                        <div className="w-3 h-3 rounded-full bg-[#f59e0b]"></div>
                                        <span className="text-[9px] font-bold text-white whitespace-nowrap">A. KERING (61-65cm)</span>
                                    </div>
                                    <div className="flex items-center gap-2">
                                        <div className="w-3 h-3 rounded-full bg-[#22c55e]"></div>
                                        <span className="text-[9px] font-bold text-white whitespace-nowrap">NORMAL (46-60cm)</span>
                                    </div>
                                    <div className="flex items-center gap-2">
                                        <div className="w-3 h-3 rounded-full bg-[#60a5fa]"></div>
                                        <span className="text-[9px] font-bold text-white whitespace-nowrap">A. TERGENANG (41-45cm)</span>
                                    </div>
                                    <div className="flex items-center gap-2">
                                        <div className="w-3 h-3 rounded-full bg-[#2563eb]"></div>
                                        <span className="text-[9px] font-bold text-white whitespace-nowrap">TERGENANG (0-40cm)</span>
                                    </div>
                                    <div className="flex items-center gap-2">
                                        <div className="w-3 h-3 rounded-full bg-[#6b7280]"></div>
                                        <span className="text-[9px] font-bold text-white whitespace-nowrap">BANJIR (&lt;0cm)</span>
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
