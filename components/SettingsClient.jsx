"use client";

import { useState, useEffect } from 'react';
import { Settings, Database, RefreshCw, AlertTriangle, CheckCircle2, Lock, CalendarDays, Building2 } from 'lucide-react';

export default function SettingsClient() {
    const [adminKey, setAdminKey] = useState('');
    const [endingDate, setEndingDate] = useState(new Date().toISOString().split('T')[0]);
    const [weeks, setWeeks] = useState('6');
    const [loading, setLoading] = useState(false);
    const [result, setResult] = useState(null);
    const [error, setError] = useState(null);

    const [companies, setCompanies] = useState([]);
    const [compLoading, setCompLoading] = useState(false);

    // Fetch companies list
    useEffect(() => {
        setCompLoading(true);
        fetch('/api/companies')
            .then(r => r.json())
            .then(json => {
                if (json.companies) setCompanies(json.companies);
            })
            .finally(() => setCompLoading(false));
    }, []);

    const handleToggleCompany = async (code, currentStatus) => {
        try {
            const nextStatus = !currentStatus;
            const res = await fetch('/api/companies', {
                method: 'PATCH',
                body: JSON.stringify({ code, is_active: nextStatus })
            });
            if (res.ok) {
                setCompanies(prev => prev.map(c => c.code === code ? { ...c, is_active: nextStatus } : c));
            }
        } catch (e) {
            console.error(e);
        }
    };

    const handleSync = async () => {
        if (!adminKey) {
            setError('Admin Key wajib diisi untuk sinkronisasi.');
            return;
        }

        setLoading(true);
        setError(null);
        setResult(null);

        try {
            const res = await fetch('/api/sync-rainfall', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'x-admin-key': adminKey
                },
                body: JSON.stringify({
                    endingDate: endingDate,
                    weeks: weeks
                })
            });

            const json = await res.json();
            if (!res.ok) throw new Error(json.error || 'Terjadi kesalahan saat sinkronisasi');
            
            setResult(json);
        } catch (e) {
            setError(e.message);
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="max-w-4xl mx-auto space-y-8 pb-20">
            {/* Header */}
            <div>
                <h1 className="text-3xl font-bold tracking-tight text-gray-900 flex items-center gap-3">
                    <Settings className="text-gray-400" size={32} />
                    Pengaturan Sistem
                </h1>
                <p className="text-sm text-gray-500 mt-1">Kelola sinkronisasi data dan konfigurasi admin.</p>
            </div>

            {/* Security Section */}
            <div className="glass-card p-6 border-l-4 border-amber-400 bg-amber-50/30">
                <div className="flex gap-4">
                    <div className="p-2 bg-amber-100 rounded-lg shrink-0 h-fit">
                        <Lock className="text-amber-600" size={20} />
                    </div>
                    <div className="space-y-1">
                        <h3 className="text-sm font-bold text-amber-900">Otentikasi Admin</h3>
                        <p className="text-xs text-amber-700/70">Masukkan Admin Key Anda untuk menjalankan perintah administratif sensitif.</p>
                        <div className="pt-3">
                            <input 
                                type="password" 
                                value={adminKey}
                                onChange={e => setAdminKey(e.target.value)}
                                placeholder="Masukkan Admin Key..."
                                className="w-full max-w-sm px-4 py-2 rounded-xl border border-amber-200 bg-white/50 focus:bg-white outline-none focus:ring-2 focus:ring-amber-500/20 transition-all text-sm"
                            />
                        </div>
                    </div>
                </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {/* Historical Sync Card */}
                <div className="glass-card overflow-hidden flex flex-col">
                    <div className="p-6 border-b border-gray-100 bg-gray-50/50">
                        <h3 className="text-sm font-bold text-gray-800 flex items-center gap-2">
                            <Database size={16} className="text-blue-500" />
                            Sinkronisasi Curah Hujan Historis
                        </h3>
                    </div>
                    <div className="p-6 space-y-4 flex-1">
                        <p className="text-xs text-gray-500 leading-relaxed">
                            Ambil data curah hujan dari server IoT untuk periode waktu tertentu dan simpan ke database lokal.
                        </p>
                        
                        <div className="space-y-3 pt-2">
                            <div className="flex flex-col gap-1.5">
                                <label className="text-[10px] font-bold text-gray-400 uppercase">Tanggal Akhir (Ending Date)</label>
                                <div className="flex items-center gap-2 px-3 py-2 border border-gray-100 bg-gray-50 rounded-xl">
                                    <CalendarDays size={14} className="text-gray-400" />
                                    <input 
                                        type="date" 
                                        value={endingDate}
                                        onChange={e => setEndingDate(e.target.value)}
                                        className="text-xs font-medium bg-transparent outline-none w-full"
                                    />
                                </div>
                            </div>

                            <div className="flex flex-col gap-1.5">
                                <label className="text-[10px] font-bold text-gray-400 uppercase">Durasi (Minggu ke Belakang)</label>
                                <select 
                                    value={weeks}
                                    onChange={e => setWeeks(e.target.value)}
                                    className="text-xs font-medium border border-gray-100 bg-gray-50 p-2.5 rounded-xl outline-none"
                                >
                                    <option value="1">1 Minggu</option>
                                    <option value="2">2 Minggu</option>
                                    <option value="4">4 Minggu (1 Bulan)</option>
                                    <option value="6">6 Minggu</option>
                                    <option value="8">8 Minggu (2 Bulan)</option>
                                    <option value="12">12 Minggu (3 Bulan)</option>
                                </select>
                            </div>
                        </div>

                        <div className="pt-4 mt-auto">
                            <button 
                                onClick={handleSync}
                                disabled={loading}
                                className={`w-full flex items-center justify-center gap-2 py-3 rounded-xl font-bold text-xs transition-all
                                    ${loading ? 'bg-gray-100 text-gray-400' : 'bg-blue-600 text-white hover:bg-blue-700 shadow-lg shadow-blue-200'}
                                `}
                            >
                                {loading ? <RefreshCw size={14} className="animate-spin" /> : <RefreshCw size={14} />}
                                {loading ? 'Menyinkronkan...' : 'Jalankan Sinkronisasi'}
                            </button>
                        </div>
                    </div>
                </div>

                {/* Status / Feedback Section */}
                <div className="space-y-4">
                    {result && (
                        <div className="glass-card p-6 border-l-4 border-green-500 bg-green-50/30 animate-in slide-in-from-right-4 duration-300">
                            <div className="flex gap-3">
                                <CheckCircle2 className="text-green-500 shrink-0" size={20} />
                                <div>
                                    <h4 className="text-sm font-bold text-green-900">Sinkronisasi Berhasil!</h4>
                                    <p className="text-xs text-green-700/80 mt-1">
                                        Berhasil memasukkan/memperbarui <span className="font-bold">{result.inserted}</span> rekaman data curah hujan.
                                    </p>
                                    {result.errors && (
                                        <div className="mt-3 p-2 bg-red-50 rounded-lg text-[10px] text-red-600 border border-red-100 max-h-32 overflow-y-auto">
                                            <p className="font-bold mb-1">Beberapa Company Gagal:</p>
                                            <ul className="list-disc pl-3">
                                                {result.errors.map((err, i) => (
                                                    <li key={i}>{err.company}: {err.error}</li>
                                                ))}
                                            </ul>
                                        </div>
                                    )}
                                </div>
                            </div>
                        </div>
                    )}

                    {error && (
                        <div className="glass-card p-6 border-l-4 border-red-500 bg-red-50/30 animate-in slide-in-from-right-4 duration-300">
                            <div className="flex gap-3">
                                <AlertTriangle className="text-red-500 shrink-0" size={20} />
                                <div>
                                    <h4 className="text-sm font-bold text-red-900">Gagal Sinkronisasi</h4>
                                    <p className="text-xs text-red-700/80 mt-1">{error}</p>
                                </div>
                            </div>
                        </div>
                    )}

                    {!result && !error && !loading && (
                        <div className="glass-card p-10 flex flex-col items-center justify-center text-center opacity-40">
                            <Database size={48} className="text-gray-300 mb-4" />
                            <p className="text-xs font-medium text-gray-500 italic">Belum ada aktivitas sinkronisasi dijalankan.</p>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}
