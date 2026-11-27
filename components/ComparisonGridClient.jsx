"use client";

import { useState, useEffect, useRef } from 'react';
import Link from 'next/link';
import { CalendarDays, RefreshCw, AlertCircle, TrendingUp, CheckCircle2, CloudRain, Database, FileImage, FileText } from 'lucide-react';
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
        <div className="space-y-6">
            {/* Header Section */}
            <header className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
                <div>
                    <h1 className="text-2xl sm:text-3xl font-bold text-gray-900 tracking-tight">
                        Executive Dashboard
                    </h1>
                    <p className="text-sm text-gray-600 mt-1 tabular-nums">
                        {week || 'Memuat periode...'} <span className="font-semibold text-gray-900 ml-1">· ID: {weekId || '---'}</span>
                    </p>
                </div>

                {lastSyncTime && (
                    <span className="inline-flex items-center self-start lg:self-auto px-3 py-2 rounded-xl bg-white border border-gray-300 text-xs font-semibold text-gray-800">
                        Last update: {lastSyncTime}
                    </span>
                )}
            </header>

            {/* Filter & Action Panel */}
            <section aria-label="Kontrol periode dan sinkronisasi" className="bg-white p-4 sm:p-5 rounded-2xl border border-gray-200 shadow-xs space-y-4">
                <div className="flex flex-wrap items-end justify-between gap-3">
                    <div className="w-full sm:w-72">
                        <label className="block text-xs font-semibold text-gray-700 mb-1">
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

                    <div className="flex flex-wrap items-center gap-2.5">
                        <button
                            type="button"
                            onClick={handleSync}
                            disabled={syncing || loading}
                            className="min-h-11 inline-flex items-center justify-center gap-2 px-4 py-2.5 bg-black hover:bg-gray-800 text-white font-semibold text-sm rounded-xl transition-colors disabled:opacity-50 whitespace-nowrap"
                            title="Sinkronisasi curah hujan dan data GIS dari server"
                        >
                            <RefreshCw size={16} className={syncing ? 'animate-spin' : ''} aria-hidden="true" />
                            <span>{syncing ? 'Syncing…' : 'Sync Data'}</span>
                        </button>

                        <button
                            type="button"
                            onClick={() => setShowReport(true)}
                            disabled={!data || data.length === 0 || loading}
                            className="min-h-11 inline-flex items-center justify-center gap-2 px-4 py-2.5 bg-white border border-gray-300 hover:bg-gray-50 text-gray-900 font-semibold text-sm rounded-xl transition-colors disabled:opacity-50 whitespace-nowrap"
                            title="Buat report gambar semua PT"
                        >
                            <FileImage size={16} aria-hidden="true" />
                            <span>Report</span>
                        </button>

                        <Link
                            href={week ? `/analysis/weekly-report?week=${encodeURIComponent(week)}` : '/analysis/weekly-report'}
                            className="min-h-11 inline-flex items-center justify-center gap-2 px-4 py-2.5 bg-white border border-gray-300 hover:bg-gray-50 text-gray-900 font-semibold text-sm rounded-xl transition-colors whitespace-nowrap"
                            title="Buka narasi laporan mingguan week-by-week"
                        >
                            <FileText size={16} aria-hidden="true" />
                            <span>Laporan Mingguan</span>
                        </Link>
                    </div>
                </div>

                {/* Progress Panel */}
                {syncing && (
                    <div className="w-full space-y-3 pt-3 border-t border-gray-200">
                        <div className="flex items-center gap-4">
                            <div className={`flex items-center gap-2 text-sm font-semibold transition-colors ${
                                syncStepDone.includes('rainfall') ? 'text-emerald-800'
                                : syncPhase === 'rainfall' ? 'text-gray-900'
                                : 'text-gray-500'
                            }`}>
                                {syncStepDone.includes('rainfall')
                                    ? <CheckCircle2 size={16} aria-hidden="true" />
                                    : <CloudRain size={16} className={syncPhase === 'rainfall' ? 'animate-pulse' : ''} aria-hidden="true" />}
                                <span>Curah Hujan</span>
                            </div>
                            <span className="text-gray-400 font-bold" aria-hidden="true">→</span>
                            <div className={`flex items-center gap-2 text-sm font-semibold transition-colors ${
                                syncStepDone.includes('gis') ? 'text-emerald-800'
                                : syncPhase === 'gis' ? 'text-gray-900'
                                : 'text-gray-500'
                            }`}>
                                {syncStepDone.includes('gis')
                                    ? <CheckCircle2 size={16} aria-hidden="true" />
                                    : <Database size={16} className={syncPhase === 'gis' ? 'animate-pulse' : ''} aria-hidden="true" />}
                                <span>Data GIS</span>
                            </div>
                        </div>

                        <div className="w-full bg-gray-100 rounded-full h-2.5 overflow-hidden border border-gray-200">
                            <div
                                className="h-full rounded-full transition-all duration-300"
                                style={{
                                    width: `${syncProgress}%`,
                                    backgroundColor: syncProgress === 100 ? '#059669' : '#111827'
                                }}
                            />
                        </div>

                        <p className="text-xs text-gray-700 font-medium truncate tabular-nums">
                            {syncProgress}% · {syncMessage}
                        </p>
                    </div>
                )}
            </section>

            {error && (
                <div role="alert" className="p-4 bg-red-50 border border-red-300 rounded-2xl flex items-center gap-3 text-red-900 text-sm font-medium">
                    <AlertCircle size={18} className="shrink-0 text-red-700" aria-hidden="true" />
                    <p>{error}</p>
                </div>
            )}

            {/* Cards */}
            <div className="flex flex-col gap-8">
                {loading ? (
                    Array.from({ length: 3 }).map((_, i) => (
                        <div key={i} className="h-[480px] bg-white rounded-2xl border border-gray-200 animate-pulse shadow-xs" />
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
                <div className="bg-white rounded-2xl border border-gray-200 p-12 text-center space-y-3 shadow-xs">
                    <div className="w-14 h-14 bg-gray-100 rounded-xl flex items-center justify-center mx-auto text-gray-600">
                        <Database size={28} aria-hidden="true" />
                    </div>
                    <p className="text-gray-700 font-semibold text-base">Tidak ada data untuk periode ini.</p>
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

