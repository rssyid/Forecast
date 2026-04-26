"use client";

import { useState, useEffect } from 'react';
import { Settings, Database, RefreshCw, AlertTriangle, CheckCircle2, Lock, CalendarDays, Building2, Activity } from 'lucide-react';

export default function SettingsClient() {
    const [isAuthenticated, setIsAuthenticated] = useState(false);
    const [authLoading, setAuthLoading] = useState(false);
    const [authError, setAuthError] = useState(null);

    const [adminKey, setAdminKey] = useState('');
    const [endingDate, setEndingDate] = useState(new Date().toISOString().split('T')[0]);
    const [weeks, setWeeks] = useState('6');
    const [loading, setLoading] = useState(false);
    const [result, setResult] = useState(null);
    const [error, setError] = useState(null);

    const [companies, setCompanies] = useState([]);
    const [compLoading, setCompLoading] = useState(false);

    const fetchCompanies = () => {
        setCompLoading(true);
        fetch('/api/companies')
            .then(r => r.json())
            .then(json => {
                if (json.companies) setCompanies(json.companies);
            })
            .finally(() => setCompLoading(false));
    };

    const handleAuthenticate = async (e) => {
        e.preventDefault();
        setAuthLoading(true);
        setAuthError(null);
        try {
            const res = await fetch('/api/auth/verify', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ key: adminKey })
            });
            if (res.ok) {
                setIsAuthenticated(true);
                fetchCompanies();
            } else {
                const json = await res.json();
                setAuthError(json.error || 'Otentikasi gagal');
            }
        } catch (err) {
            setAuthError(err.message);
        } finally {
            setAuthLoading(false);
        }
    };

    const handleToggleCompany = async (code, currentStatus) => {
        if (!adminKey) {
            setError('Admin Key wajib diisi untuk mengubah status unit.');
            return;
        }
        setError(null);

        try {
            const nextStatus = !currentStatus;
            const res = await fetch('/api/companies', {
                method: 'PATCH',
                headers: {
                    'Content-Type': 'application/json',
                    'x-admin-key': adminKey
                },
                body: JSON.stringify({ code, is_active: nextStatus })
            });
            
            if (res.ok) {
                setCompanies(prev => prev.map(c => c.code === code ? { ...c, is_active: nextStatus } : c));
            } else {
                const json = await res.json();
                setError(json.error || 'Gagal mengubah status unit');
            }
        } catch (e) {
            console.error(e);
            setError(e.message);
        }
    };

    const [progress, setProgress] = useState([]);

    const handleSync = async () => {
        if (!adminKey) {
            setError('Admin Key wajib diisi untuk sinkronisasi.');
            return;
        }

        setLoading(true);
        setError(null);
        setResult(null);
        setProgress([]);

        try {
            const url = `/api/update-recent?stream=true&key=${encodeURIComponent(adminKey)}`;
            const response = await fetch(url);
            
            if (!response.ok) {
                const json = await response.json();
                throw new Error(json.error || 'Gagal memulai sinkronisasi');
            }

            const reader = response.body.getReader();
            const decoder = new TextDecoder();
            let buffer = '';

            while (true) {
                const { value, done } = await reader.read();
                if (done) break;

                const text = decoder.decode(value);
                buffer += text;

                const lines = buffer.split('\n\n');
                buffer = lines.pop() || '';

                for (const line of lines) {
                    if (line.startsWith('data: ')) {
                        try {
                            const data = JSON.parse(line.slice(6));
                            if (data.msg === 'DONE') {
                                // Handled by done
                            } else {
                                setProgress(prev => [...prev, data.msg]);
                                // Auto scroll
                                setTimeout(() => {
                                    const el = document.getElementById('progress-end');
                                    if (el) el.scrollIntoView({ behavior: 'smooth' });
                                }, 10);
                            }
                        } catch (e) {
                            console.error('Parse error', e);
                        }
                    }
                }
            }
            setResult({ success: true });
        } catch (e) {
            setError(e.message);
        } finally {
            setLoading(false);
        }
    };

    if (!isAuthenticated) {
        return (
            <div className="fixed inset-0 z-50 flex items-center justify-center bg-gray-900/20 backdrop-blur-md px-4">
                <div className="bg-white p-8 rounded-3xl shadow-2xl max-w-sm w-full animate-in zoom-in-95 duration-300">
                    <div className="flex flex-col items-center text-center space-y-4">
                        <div className="p-4 bg-amber-50 border border-amber-100 rounded-full">
                            <Lock size={32} className="text-amber-500" />
                        </div>
                        <div>
                            <h2 className="text-xl font-bold text-gray-900">Otentikasi Diperlukan</h2>
                            <p className="text-xs text-gray-500 mt-2 leading-relaxed">Halaman pengaturan berisi kontrol sinkronisasi dan manajemen unit. Masukkan Admin Key untuk melanjutkan.</p>
                        </div>
                        <form onSubmit={handleAuthenticate} className="w-full space-y-4 pt-4">
                            <input 
                                type="password" 
                                value={adminKey}
                                onChange={e => setAdminKey(e.target.value)}
                                placeholder="Masukkan Admin Key"
                                className="w-full px-4 py-3 rounded-xl border border-gray-200 bg-gray-50 focus:bg-white outline-none focus:ring-2 focus:ring-amber-500/20 transition-all text-sm text-center tracking-widest"
                                autoFocus
                            />
                            {authError && <p className="text-[11px] font-bold text-red-500 bg-red-50 py-2 rounded-lg border border-red-100">{authError}</p>}
                            <button 
                                type="submit" 
                                disabled={authLoading || !adminKey}
                                className={`w-full py-3 rounded-xl font-bold text-xs uppercase tracking-wide transition-all
                                    ${(authLoading || !adminKey) ? 'bg-gray-100 text-gray-400' : 'bg-amber-500 text-white hover:bg-amber-600 shadow-lg shadow-amber-200'}
                                `}
                            >
                                {authLoading ? 'Memverifikasi...' : 'Buka Pengaturan'}
                            </button>
                        </form>
                    </div>
                </div>
            </div>
        );
    }

    return (
        <div className="max-w-4xl mx-auto space-y-8 pb-20 animate-in fade-in duration-500">
            {/* Header */}
            <div>
                <h1 className="text-3xl font-bold tracking-tight text-gray-900 flex items-center gap-3">
                    <Settings className="text-gray-400" size={32} />
                    Pengaturan Sistem
                </h1>
                <p className="text-sm text-gray-500 mt-1">Kelola sinkronisasi data dan konfigurasi admin.</p>
            </div>

            {/* Company Management Section */}
            <div className="glass-card overflow-hidden border-t-4 border-amber-400">
                <div className="p-6 border-b border-gray-100 bg-gray-50/50">
                    <h3 className="text-sm font-bold text-gray-800 flex items-center gap-2">
                        <Building2 size={16} className="text-blue-500" />
                        Manajemen Unit (Company) Aktif
                    </h3>
                    <p className="text-xs text-gray-500 mt-1">
                        Pilih unit mana saja yang ingin diaktifkan dan ditampilkan di dashboard serta laporan.
                    </p>
                </div>
                <div className="p-6">
                    {compLoading ? (
                        <div className="flex items-center justify-center p-8">
                            <RefreshCw className="animate-spin text-gray-300" size={24} />
                        </div>
                    ) : (
                        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                            {companies.map(comp => (
                                <label 
                                    key={comp.code} 
                                    className={`flex items-center gap-3 p-3 rounded-xl border cursor-pointer transition-all
                                        ${comp.is_active 
                                            ? 'bg-blue-50/50 border-blue-200 shadow-sm' 
                                            : 'bg-gray-50 border-gray-200 opacity-60 hover:opacity-100'}
                                    `}
                                >
                                    <input 
                                        type="checkbox" 
                                        className="w-4 h-4 rounded text-blue-600 focus:ring-blue-500"
                                        checked={comp.is_active || false}
                                        onChange={() => handleToggleCompany(comp.code, comp.is_active)}
                                    />
                                    <div className="flex flex-col">
                                        <span className={`text-xs font-bold ${comp.is_active ? 'text-blue-900' : 'text-gray-600'}`}>
                                            {comp.code}
                                        </span>
                                    </div>
                                </label>
                            ))}
                        </div>
                    )}
                </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {/* Sync Card */}
                <div className="glass-card overflow-hidden flex flex-col">
                    <div className="p-6 border-b border-gray-100 bg-gray-50/50">
                        <h3 className="text-sm font-bold text-gray-800 flex items-center gap-2">
                            <RefreshCw size={16} className="text-blue-500" />
                            Update Data Piezometer & Rainfall
                        </h3>
                    </div>
                    <div className="p-6 space-y-4 flex-1">
                        <p className="text-xs text-gray-500 leading-relaxed">
                            Tarik data terbaru dari server GIS untuk Piezometer (2 minggu terakhir) dan Rainfall (4 minggu terakhir) untuk seluruh unit aktif.
                        </p>
                        
                        <div className="bg-blue-50 border border-blue-100 p-4 rounded-xl">
                            <h4 className="text-[10px] font-bold text-blue-700 uppercase mb-2">Informasi Update</h4>
                            <ul className="space-y-1.5">
                                <li className="text-[11px] text-blue-800 flex items-center gap-2">
                                    <div className="w-1.5 h-1.5 rounded-full bg-blue-400" />
                                    Piezometer: Update data TMAT real-time.
                                </li>
                                <li className="text-[11px] text-blue-800 flex items-center gap-2">
                                    <div className="w-1.5 h-1.5 rounded-full bg-blue-400" />
                                    Rainfall: Update data curah hujan harian.
                                </li>
                                <li className="text-[11px] text-blue-800 flex items-center gap-2">
                                    <div className="w-1.5 h-1.5 rounded-full bg-blue-400" />
                                    Cakupan: Seluruh estate di bawah unit aktif.
                                </li>
                            </ul>
                        </div>

                        <div className="pt-4 mt-auto">
                            <button 
                                onClick={handleSync}
                                disabled={loading}
                                className={`w-full flex items-center justify-center gap-2 py-4 rounded-xl font-bold text-xs transition-all uppercase tracking-wider
                                    ${loading ? 'bg-gray-100 text-gray-400' : 'bg-blue-600 text-white hover:bg-blue-700 shadow-lg shadow-blue-200'}
                                `}
                            >
                                {loading ? <RefreshCw size={14} className="animate-spin" /> : <RefreshCw size={14} />}
                                {loading ? 'Memproses Update...' : 'Mulai Update Data'}
                            </button>
                        </div>
                    </div>
                </div>

                {/* Progress / Status Section */}
                <div className="flex flex-col gap-4 h-full">
                    <div className="glass-card flex-1 overflow-hidden flex flex-col">
                        <div className="p-4 border-b border-gray-100 bg-gray-50/50 flex items-center justify-between">
                            <h3 className="text-[10px] font-bold text-gray-500 uppercase tracking-wider flex items-center gap-2">
                                <Activity size={12} className="text-blue-500" />
                                Log Aktivitas Update
                            </h3>
                            {loading && <span className="text-[10px] text-blue-600 animate-pulse font-bold">LIVE</span>}
                        </div>
                        <div className="p-4 flex-1 overflow-y-auto max-h-[300px] bg-gray-900 font-mono text-[11px] space-y-1">
                            {progress.length === 0 && !loading && (
                                <div className="h-full flex flex-col items-center justify-center text-gray-600 italic">
                                    Siap untuk melakukan update data...
                                </div>
                            )}
                            {progress.map((line, i) => (
                                <div key={i} className="text-gray-300 border-l-2 border-blue-500/30 pl-2 py-0.5">
                                    <span className="text-gray-600 mr-2">[{new Date().toLocaleTimeString([], { hour12: false })}]</span>
                                    {line}
                                </div>
                            ))}
                            {loading && (
                                <div className="text-blue-400 animate-pulse pl-2 mt-2">
                                    _ Menunggu data selanjutnya...
                                </div>
                            )}
                            <div id="progress-end" />
                        </div>
                    </div>

                    {result && !loading && (
                        <div className="bg-green-600 text-white p-4 rounded-2xl flex items-center gap-3 shadow-lg shadow-green-100 animate-in zoom-in duration-300">
                            <CheckCircle2 size={24} />
                            <div>
                                <h4 className="text-sm font-bold">Sinkronisasi Selesai</h4>
                                <p className="text-[11px] opacity-90">Data berhasil diperbarui ke database lokal.</p>
                            </div>
                        </div>
                    )}

                    {error && (
                        <div className="bg-red-600 text-white p-4 rounded-2xl flex items-center gap-3 shadow-lg shadow-red-100 animate-in zoom-in duration-300">
                            <AlertTriangle size={24} />
                            <div>
                                <h4 className="text-sm font-bold">Gagal Update</h4>
                                <p className="text-[11px] opacity-90">{error}</p>
                            </div>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}
