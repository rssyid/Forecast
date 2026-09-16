"use client";

import { useState, useEffect, useRef } from 'react';
import { CalendarDays, RefreshCw, AlertCircle, TrendingUp, CheckCircle2, CloudRain, Database, FileImage } from 'lucide-react';
import SearchableSelect from './SearchableSelect';
import CompanyComparisonCard from './CompanyComparisonCard';
import ReportModal from './ReportModal';

export default function ComparisonGridClient() {
    const [week, setWeek] = useState('');
    const [weekList, setWeekList] = useState([]);
    const [data, setData] = useState(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);
    const [prevWeekName, setPrevWeekName] = useState('');
    const [serverWeekId, setServerWeekId] = useState(null);

    // Sync state
    const [syncing, setSyncing] = useState(false);
    const [syncProgress, setSyncProgress] = useState(0);
    const [syncMessage, setSyncMessage] = useState('');
    const [syncPhase, setSyncPhase] = useState(null);
    const [syncStepDone, setSyncStepDone] = useState([]);
    const [lastSyncTime, setLastSyncTime] = useState('');
    const esRef = useRef(null);

    // Report modal
    const [showReport, setShowReport] = useState(false);

    const formatDateTime = (dateInput) => {
        if (!dateInput) return null;
        const d = new Date(dateInput);
        if (isNaN(d.getTime())) return null;
        const dateStr = d.toLocaleDateString('id-ID', { day: 'numeric', month: 'short', year: 'numeric' });
        const timeStr = d.toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' }).replace('.', ':');
        return `${dateStr}, ${timeStr} WIB`;
    };

    // Load initial cached last sync timestamp from localStorage
    useEffect(() => {
        try {
            const saved = localStorage.getItem('forecast_last_sync');
            if (saved) setLastSyncTime(saved);
        } catch (_) {}
    }, []);

    // 1. Fetch weeks list
    useEffect(() => {
        fetch('/api/calendar-weeks')
            .then(r => r.json())
            .then(json => {
                if (json.weeks) {
                    const names = json.weeks.map(w => w.formatted_name);
                    setWeekList(names);
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
            setPrevWeekName(json.weeks?.prev || '');
            if (json.currentWeekId) setServerWeekId(json.currentWeekId);
            if (json.lastSyncTime) {
                const formatted = formatDateTime(json.lastSyncTime);
                if (formatted) {
                    setLastSyncTime(formatted);
                    try { localStorage.setItem('forecast_last_sync', formatted); } catch (_) {}
                }
            }
        } catch (err) {
            setError(err.message);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        if (week) fetchBulkData();
    }, [week]);

    // 3. Handle Sync – uses SSE for live progress
    const handleSync = () => {
        if (syncing) return;
        setSyncing(true);
        setSyncProgress(0);
        setSyncMessage('Memulai sinkronisasi…');
        setSyncPhase('rainfall');
        setSyncStepDone([]);
        setError(null);

        const url = `/api/sync-all?week=${encodeURIComponent(week)}`;
        const es = new EventSource(url);
        esRef.current = es;

        es.onmessage = (e) => {
            try {
                const d = JSON.parse(e.data);

                if (d.error) {
                    setError(`Sync error: ${d.error}`);
                    es.close();
                    setSyncing(false);
                    setSyncPhase(null);
                    return;
                }

                setSyncProgress(d.progress ?? 0);
                setSyncMessage(d.message || '');
                if (d.phase) setSyncPhase(d.phase);

                if (d.stepDone === 'rainfall') {
                    setSyncStepDone(prev => [...prev, 'rainfall']);
                }

                if (d.completed) {
                    setSyncStepDone(['rainfall', 'gis']);
                    es.close();
                    const nowFormatted = formatDateTime(new Date());
                    if (nowFormatted) {
                        setLastSyncTime(nowFormatted);
                        try { localStorage.setItem('forecast_last_sync', nowFormatted); } catch (_) {}
                    }
                    // Refresh data after sync
                    setTimeout(() => {
                        setSyncing(false);
                        setSyncPhase(null);
                        setSyncProgress(0);
                        setSyncMessage('');
                        setSyncStepDone([]);
                        fetchBulkData();
                    }, 1500);
                }
            } catch (_) {}
        };

        es.onerror = () => {
            es.close();
            setSyncing(false);
            setSyncPhase(null);
            if (syncProgress < 100) setError('Koneksi SSE terputus. Coba lagi.');
        };
    };

    // Cleanup EventSource on unmount
    useEffect(() => {
        return () => { if (esRef.current) esRef.current.close(); };
    }, []);

    // Computed week ID
    const anchorWeek = 'Apr 2026, W4';
    const anchorId = 503;
    const anchorIdx = weekList.indexOf(anchorWeek);
    const currentIdx = weekList.indexOf(week);
    const computedWeekId = (anchorIdx !== -1 && currentIdx !== -1)
        ? anchorId + (anchorIdx - currentIdx) : null;
    const weekId = serverWeekId || computedWeekId;

    return (
        <div className="max-w-[900px] mx-auto space-y-12 animate-in fade-in duration-1000 pb-20">
            {/* Header Section */}
            <header className="flex flex-col gap-6 bg-white p-8 rounded-[42px] border border-gray-100 shadow-sm">
                <div className="flex flex-col md:flex-row md:items-end justify-between gap-6">
                    <div className="space-y-1">
                        <h1 className="text-4xl font-black text-gray-900 tracking-[-0.04em] flex items-center gap-3">
                            <TrendingUp className="text-blue-600" size={36} />
                            Executive Dashboard
                        </h1>
                        <p className="text-gray-400 font-medium pl-1 text-lg">
                            {week} <span className="text-blue-500 font-black ml-2">ID: {weekId || '---'}</span>
                        </p>
                    </div>

                    <div className="flex items-start gap-3">
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

                        <div className="flex flex-col items-center">
                            <button
                                onClick={handleSync}
                                disabled={syncing || loading}
                                className="flex items-center gap-2 px-5 py-4 mt-6 bg-blue-600 hover:bg-blue-700 text-white font-bold text-sm rounded-2xl transition-all shadow-sm disabled:opacity-50 whitespace-nowrap cursor-pointer"
                                title="Sinkronisasi curah hujan dan data GIS dari server"
                            >
                                <RefreshCw size={18} className={syncing ? 'animate-spin' : ''} />
                                <span>{syncing ? 'Syncing…' : 'Sync Data'}</span>
                            </button>
                            {lastSyncTime && (
                                <span className="text-[11px] font-bold text-gray-400 mt-1.5 whitespace-nowrap">
                                    Last update: {lastSyncTime}
                                </span>
                            )}
                        </div>

                        <button
                            onClick={() => setShowReport(true)}
                            disabled={!data || data.length === 0 || loading}
                            className="flex items-center gap-2 px-5 py-4 mt-6 bg-gray-800 hover:bg-gray-900 text-white font-bold text-sm rounded-2xl transition-all shadow-sm disabled:opacity-40 whitespace-nowrap cursor-pointer"
                            title="Buat report gambar semua PT"
                        >
                            <FileImage size={18} />
                            <span>Report</span>
                        </button>
                    </div>
                </div>

                {/* ── Progress Panel ── shown only while syncing */}
                {syncing && (
                    <div className="w-full space-y-3 pt-2">
                        {/* Step indicators */}
                        <div className="flex items-center gap-6">
                            {/* Step 1: Rainfall */}
                            <div className={`flex items-center gap-2 text-sm font-bold transition-colors ${
                                syncStepDone.includes('rainfall') ? 'text-emerald-600'
                                : syncPhase === 'rainfall' ? 'text-blue-600'
                                : 'text-gray-300'
                            }`}>
                                {syncStepDone.includes('rainfall')
                                    ? <CheckCircle2 size={16} />
                                    : <CloudRain size={16} className={syncPhase === 'rainfall' ? 'animate-pulse' : ''} />}
                                Curah Hujan
                            </div>
                            <div className="text-gray-200 font-black">→</div>
                            {/* Step 2: GIS */}
                            <div className={`flex items-center gap-2 text-sm font-bold transition-colors ${
                                syncStepDone.includes('gis') ? 'text-emerald-600'
                                : syncPhase === 'gis' ? 'text-blue-600'
                                : 'text-gray-300'
                            }`}>
                                {syncStepDone.includes('gis')
                                    ? <CheckCircle2 size={16} />
                                    : <Database size={16} className={syncPhase === 'gis' ? 'animate-pulse' : ''} />}
                                Data GIS
                            </div>
                        </div>

                        {/* Progress bar */}
                        <div className="w-full bg-gray-100 rounded-full h-2.5 overflow-hidden">
                            <div
                                className="h-2.5 rounded-full transition-all duration-300"
                                style={{
                                    width: `${syncProgress}%`,
                                    backgroundColor: syncProgress === 100 ? '#16a34a' : '#2563eb'
                                }}
                            />
                        </div>

                        {/* Progress text */}
                        <p className="text-xs text-gray-500 font-medium truncate">
                            {syncProgress}% — {syncMessage}
                        </p>
                    </div>
                )}
            </header>

            {error && (
                <div className="p-8 bg-red-50 border border-red-100 rounded-[42px] flex items-center gap-4 text-red-700 shadow-sm">
                    <AlertCircle size={28} />
                    <p className="font-bold text-lg">{error}</p>
                </div>
            )}

            {/* Cards */}
            <div className="flex flex-col gap-12">
                {loading ? (
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
                        <Database size={40} />
                    </div>
                    <p className="text-gray-500 font-bold text-xl">Tidak ada data untuk periode ini.</p>
                </div>
            )}

            {/* Report Modal */}
            {showReport && (
                <ReportModal
                    data={data}
                    currentWeek={week}
                    prevWeek={prevWeekName}
                    onClose={() => setShowReport(false)}
                />
            )}
        </div>
    );
}

