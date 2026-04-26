"use client";

import { useState, useEffect, useMemo } from 'react';
import dynamic from 'next/dynamic';
import { Globe, Map as MapIcon, Filter, Info, RefreshCw, Layers } from 'lucide-react';
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
    const [geoData, setGeoData] = useState(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);

    const fetchData = async () => {
        setLoading(true);
        setError(null);
        try {
            const res = await fetch(`/api/map-data?company=${company}`);
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
        fetchData();
    }, [company]);

    // Calculate map center based on data
    const mapConfig = useMemo(() => {
        if (!geoData || geoData.features.length === 0) return { center: [-0.5, 101.5], zoom: 10 };
        
        // Simple center calculation from first feature
        const firstGeom = geoData.features[0].geometry;
        if (firstGeom.type === 'Polygon') {
            return { center: [firstGeom.coordinates[0][0][1], firstGeom.coordinates[0][0][0]], zoom: 12 };
        } else if (firstGeom.type === 'MultiPolygon') {
            return { center: [firstGeom.coordinates[0][0][0][1], firstGeom.coordinates[0][0][0][0]], zoom: 12 };
        }
        return { center: [-0.5, 101.5], zoom: 10 };
    }, [geoData]);

    const stats = useMemo(() => {
        if (!geoData) return null;
        const total = geoData.features.length;
        let banjir = 0, normal = 0, kering = 0;
        
        geoData.features.forEach(f => {
            const s = f.properties.status?.toUpperCase() || '';
            if (s.includes('BANJIR') || s.includes('TERGENANG')) banjir++;
            else if (s.includes('NORMAL')) normal++;
            else if (s.includes('KERING')) kering++;
        });

        const noData = total - (banjir + normal + kering);
        return { total, banjir, normal, kering, noData };
    }, [geoData]);

    return (
        <div className="max-w-[1600px] mx-auto space-y-6 animate-in fade-in duration-700">
            <header className="flex flex-col md:flex-row md:items-center justify-between gap-4">
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
                    <div className="w-48">
                        <SearchableSelect 
                            options={COMPANIES}
                            value={company}
                            onChange={setCompany}
                            placeholder="Pilih Company"
                            icon={<Globe size={14} />}
                        />
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

            <div className="grid grid-cols-1 lg:grid-cols-4 gap-6 h-[calc(100vh-220px)] min-h-[600px]">
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

                                <div className="grid grid-cols-1 gap-3">
                                    <div className="flex items-center justify-between p-3 bg-emerald-50 border border-emerald-100 rounded-xl">
                                        <div className="flex items-center gap-2">
                                            <div className="w-2.5 h-2.5 rounded-full bg-emerald-500"></div>
                                            <span className="text-xs font-bold text-emerald-800 uppercase">Normal</span>
                                        </div>
                                        <span className="text-sm font-black text-emerald-900">{stats.normal}</span>
                                    </div>
                                    <div className="flex items-center justify-between p-3 bg-amber-50 border border-amber-100 rounded-xl">
                                        <div className="flex items-center gap-2">
                                            <div className="w-2.5 h-2.5 rounded-full bg-amber-500"></div>
                                            <span className="text-xs font-bold text-amber-800 uppercase">Kering</span>
                                        </div>
                                        <span className="text-sm font-black text-amber-900">{stats.kering}</span>
                                    </div>
                                    <div className="flex items-center justify-between p-3 bg-red-50 border border-red-100 rounded-xl">
                                        <div className="flex items-center gap-2">
                                            <div className="w-2.5 h-2.5 rounded-full bg-red-500"></div>
                                            <span className="text-xs font-bold text-red-800 uppercase">Banjir</span>
                                        </div>
                                        <span className="text-sm font-black text-red-900">{stats.banjir}</span>
                                    </div>
                                    <div className="flex items-center justify-between p-3 bg-gray-50 border border-gray-200 rounded-xl opacity-60">
                                        <div className="flex items-center gap-2">
                                            <div className="w-2.5 h-2.5 rounded-full bg-gray-400"></div>
                                            <span className="text-xs font-bold text-gray-500 uppercase">No Data</span>
                                        </div>
                                        <span className="text-sm font-black text-gray-600">{stats.noData}</span>
                                    </div>
                                </div>
                            </div>

                            <div className="p-4 bg-blue-50 border border-blue-100 rounded-2xl flex items-start gap-3">
                                <Info size={16} className="text-blue-600 mt-0.5 shrink-0" />
                                <p className="text-[10px] text-blue-800 leading-relaxed italic">
                                    Warna pada peta menunjukkan status TMAT terbaru berdasarkan batas kritis yang telah ditetapkan di master data.
                                </p>
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
                                data={geoData} 
                                center={mapConfig.center} 
                                zoom={mapConfig.zoom} 
                            />
                            
                            {/* Legend Overlay */}
                            <div className="absolute bottom-6 left-6 z-[1000] bg-gray-900/90 backdrop-blur-md p-4 rounded-2xl border border-white/10 shadow-2xl space-y-3">
                                <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-1">Legenda Status</p>
                                <div className="flex items-center gap-4">
                                    <div className="flex items-center gap-2">
                                        <div className="w-3 h-3 rounded-full bg-emerald-500 ring-4 ring-emerald-500/20"></div>
                                        <span className="text-[10px] font-bold text-white">NORMAL</span>
                                    </div>
                                    <div className="flex items-center gap-2">
                                        <div className="w-3 h-3 rounded-full bg-amber-500 ring-4 ring-amber-500/20"></div>
                                        <span className="text-[10px] font-bold text-white">KERING</span>
                                    </div>
                                    <div className="flex items-center gap-2">
                                        <div className="w-3 h-3 rounded-full bg-red-500 ring-4 ring-red-500/20"></div>
                                        <span className="text-[10px] font-bold text-white">BANJIR</span>
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
