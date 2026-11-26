"use client";

import { useState, useEffect } from 'react';
import { Settings, Database, RefreshCw, AlertTriangle, CheckCircle2, Lock, CalendarDays, Building2, Activity, Upload, FileSpreadsheet, Loader2, Globe, Info } from 'lucide-react';
import * as XLSX from 'xlsx';

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

    // Master Sync State
    const [masterLoading, setMasterLoading] = useState(false);
    const [masterProgress, setMasterProgress] = useState(0);
    const [masterStatus, setMasterStatus] = useState('');
    const [masterResult, setMasterResult] = useState(null);
    const [masterError, setMasterError] = useState(null);

    // GeoJSON Upload State
    const [geoLoading, setGeoLoading] = useState(false);
    const [geoStatus, setGeoStatus] = useState('');
    const [geoResult, setGeoResult] = useState(null);
    const [geoError, setGeoError] = useState(null);
    const [replaceMode, setReplaceMode] = useState(false);

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

    const handleMasterUpload = (e) => {
        const file = e.target.files[0];
        if (!file) return;

        setMasterLoading(true);
        setMasterError(null);
        setMasterResult(null);
        setMasterProgress(0);
        setMasterStatus('Membaca file Excel...');

        const reader = new FileReader();
        reader.onload = async (evt) => {
            try {
                const dataArr = new Uint8Array(evt.target.result);
                const wb = XLSX.read(dataArr, { type: 'array' });
                const wsname = wb.SheetNames[0];
                const ws = wb.Sheets[wsname];
                
                setMasterStatus('Memproses struktur data...');
                const rawData = XLSX.utils.sheet_to_json(ws, { header: 1 });
                if (rawData.length < 2) throw new Error("File excel kosong atau tidak memiliki data.");

                const headers = rawData[0].map(h => String(h || '').trim().toLowerCase());
                const rows = rawData.slice(1).map(row => {
                    const obj = {};
                    row.forEach((cell, idx) => {
                        if (headers[idx]) obj[headers[idx]] = cell;
                    });
                    return obj;
                });

                const cleanData = rows.map(r => ({
                    pie_record_id: r.pie_record_id || r['pie record id'] || r['pie record_id'] || r.pierecordid,
                    Mapping: r.mapping || r.maping || r.block_mapping,
                    EstCode: r.estcode || r.est_code || r['est code'],
                    EstNewCode: r.estnewcode || r.est_new_code || r['est new code'],
                    deviceNameIOT: r.devicenameiot || r['device name iot'] || r.device_name,
                    IsActive: r.isactive !== undefined ? r.isactive : true
                })).filter(r => r.pie_record_id);

                if (cleanData.length === 0) throw new Error("Kolom 'pie_record_id' tidak ditemukan atau data kosong.");

                const chunkSize = 100;
                let processed = 0;
                const totalChunks = Math.ceil(cleanData.length / chunkSize);
                
                for (let i = 0; i < cleanData.length; i += chunkSize) {
                    const chunk = cleanData.slice(i, i + chunkSize);
                    const isFirst = i === 0;
                    const currentChunkNum = Math.floor(i/chunkSize) + 1;
                    
                    setMasterStatus(`Mengunggah batch ${currentChunkNum} dari ${totalChunks}...`);
                    
                    const res = await fetch(`/api/pzo-master?clear=${isFirst}`, {
                        method: 'POST',
                        headers: {
                            'Content-Type': 'application/json',
                            'x-admin-key': adminKey
                        },
                        body: JSON.stringify(chunk)
                    });

                    const json = await res.json();
                    if (json.error) throw new Error(json.error);

                    processed += chunk.length;
                    setMasterProgress(Math.round((processed / cleanData.length) * 100));
                }

                setMasterStatus('Selesai!');
                setMasterResult({ count: cleanData.length });
            } catch (err) {
                setMasterError(err.message);
            } finally {
                setMasterLoading(false);
            }
        };
        reader.readAsArrayBuffer(file);
    };

    const handleGeoUpload = async (e) => {
        const file = e.target.files[0];
        if (!file) return;

        setGeoLoading(true);
        setGeoError(null);
        setGeoResult(null);
        setGeoStatus('Membaca file GeoJSON...');

        const reader = new FileReader();
        reader.onload = async (evt) => {
            try {
                const geojson = JSON.parse(evt.target.result);
                setGeoStatus('Mengunggah data spasial ke server...');
                
                const res = await fetch(`/api/pzo-geometries?clear=${replaceMode}`, {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                        'x-admin-key': adminKey
                    },
                    body: JSON.stringify(geojson)
                });

                const json = await res.json();
                if (!res.ok) throw new Error(json.error || 'Gagal mengunggah GeoJSON');

                setGeoStatus('Selesai!');
                setGeoResult({ count: json.count });
            } catch (err) {
                setGeoError(err.message);
            } finally {
                setGeoLoading(false);
            }
        };
        reader.readAsText(file);
    };

    if (!isAuthenticated) {
        return (
            <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4">
                <div className="bg-white p-6 sm:p-8 rounded-2xl border border-gray-200 shadow-xl max-w-sm w-full">
                    <div className="flex flex-col items-center text-center space-y-4">
                        <div className="p-3.5 bg-gray-100 border border-gray-200 rounded-xl">
                            <Lock size={28} className="text-gray-900" aria-hidden="true" />
                        </div>
                        <div>
                            <h1 className="text-xl font-bold text-gray-900">Otentikasi Diperlukan</h1>
                            <p className="text-xs text-gray-600 mt-1.5 leading-relaxed">Halaman pengaturan berisi kontrol sinkronisasi dan manajemen unit. Masukkan Admin Key untuk melanjutkan.</p>
                        </div>
                        <form onSubmit={handleAuthenticate} className="w-full space-y-4 pt-2">
                            <div>
                                <label htmlFor="settings-admin-key" className="sr-only">Admin Key</label>
                                <input
                                    id="settings-admin-key"
                                    type="password"
                                    value={adminKey}
                                    onChange={e => setAdminKey(e.target.value)}
                                    placeholder="Masukkan Admin Key"
                                    className="w-full min-h-11 px-4 py-2.5 rounded-xl border border-gray-300 bg-white text-sm text-gray-900 text-center tracking-widest"
                                    autoFocus
                                />
                            </div>
                            {authError && <p role="alert" className="text-xs font-semibold text-red-800 bg-red-50 py-2 px-3 rounded-xl border border-red-200">{authError}</p>}
                            <button
                                type="submit"
                                disabled={authLoading || !adminKey}
                                className="w-full min-h-11 py-2.5 rounded-xl font-semibold text-sm bg-black text-white hover:bg-gray-800 disabled:opacity-50 transition-colors"
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
        <div className="space-y-6">
            {/* Header */}
            <header>
                <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-gray-900">
                    Pengaturan Sistem
                </h1>
                <p className="text-sm text-gray-600 mt-1">Kelola sinkronisasi data, master piezometer, dan konfigurasi unit aktif.</p>
            </header>

            {/* Company Management Section */}
            <div className="bg-white rounded-2xl border border-gray-200 shadow-xs overflow-hidden">
                <div className="p-5 sm:p-6 border-b border-gray-200 bg-gray-50">
                    <h2 className="text-sm font-bold text-gray-900 flex items-center gap-2">
                        <Building2 size={16} className="text-gray-700" aria-hidden="true" />
                        <span>Manajemen Unit (Company) Aktif</span>
                    </h2>
                    <p className="text-xs text-gray-600 mt-1">
                        Pilih unit yang diaktifkan dan ditampilkan di dashboard serta laporan.
                    </p>
                </div>
                <div className="p-5 sm:p-6">
                    {compLoading ? (
                        <div className="flex items-center justify-center p-8">
                            <RefreshCw className="animate-spin text-gray-400" size={24} aria-hidden="true" />
                        </div>
                    ) : (
                        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
                            {companies.map(comp => (
                                <label
                                    key={comp.code}
                                    className={`flex items-center gap-3 min-h-11 px-3.5 py-2.5 rounded-xl border cursor-pointer transition-colors
                                        ${comp.is_active
                                            ? 'bg-gray-50 border-gray-900 text-gray-900'
                                            : 'bg-white border-gray-200 text-gray-600 hover:border-gray-300'}
                                    `}
                                >
                                    <input
                                        type="checkbox"
                                        className="w-4 h-4 rounded accent-black"
                                        checked={comp.is_active || false}
                                        onChange={() => handleToggleCompany(comp.code, comp.is_active)}
                                    />
                                    <span className="text-xs font-bold">
                                        {comp.code}
                                    </span>
                                </label>
                            ))}
                        </div>
                    )}
                </div>
            </div>

            {/* Master Sync Section */}
            <div className="bg-white rounded-2xl border border-gray-200 shadow-xs overflow-hidden">
                <div className="p-5 sm:p-6 border-b border-gray-200 bg-gray-50">
                    <h2 className="text-sm font-bold text-gray-900 flex items-center gap-2">
                        <FileSpreadsheet size={16} className="text-gray-700" aria-hidden="true" />
                        <span>Sinkronisasi Master Piezometer (Excel)</span>
                    </h2>
                    <p className="text-xs text-gray-600 mt-1">
                        Upload file Excel mapping blok untuk normalisasi perhitungan titik PZO.
                    </p>
                </div>
                <div className="p-5 sm:p-6 space-y-6">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        <div className="space-y-4">
                            <div className="flex items-center gap-3 p-4 bg-amber-50 border border-amber-300 rounded-xl text-amber-900 text-xs">
                                <AlertTriangle size={18} className="shrink-0 text-amber-800" aria-hidden="true" />
                                <div>
                                    <p className="font-bold">Penting: Format Excel</p>
                                    <p className="mt-0.5">Header wajib: pie_record_id, Mapping, EstCode, EstNewCode, IsActive</p>
                                </div>
                            </div>

                            <div className="relative group">
                                <input
                                    type="file"
                                    accept=".xlsx, .xls"
                                    onChange={handleMasterUpload}
                                    disabled={masterLoading}
                                    aria-label="Upload file Excel master piezometer"
                                    className="absolute inset-0 w-full h-full opacity-0 cursor-pointer disabled:cursor-not-allowed z-10"
                                />
                                <div className={`flex flex-col items-center justify-center p-10 border-2 border-dashed rounded-2xl transition-colors ${
                                    masterLoading ? 'bg-gray-50 border-gray-200' : 'bg-white border-gray-300 group-hover:border-gray-900 group-hover:bg-gray-50'
                                }`}>
                                    {masterLoading ? (
                                        <Loader2 className="animate-spin text-gray-800 mb-2" size={28} aria-hidden="true" />
                                    ) : (
                                        <Upload className="text-gray-500 group-hover:text-gray-900 mb-2 transition-colors" size={28} aria-hidden="true" />
                                    )}
                                    <p className="text-sm font-semibold text-gray-900">
                                        {masterLoading ? 'Sedang Memproses...' : 'Klik atau Seret File Excel Master'}
                                    </p>
                                </div>
                            </div>
                        </div>

                        <div className="space-y-4">
                            {masterLoading && (
                                <div className="space-y-2">
                                    <div className="flex justify-between text-xs font-semibold text-gray-700">
                                        <span>{masterStatus}</span>
                                        <span className="tabular-nums">{masterProgress}%</span>
                                    </div>
                                    <div className="h-2 w-full bg-gray-100 rounded-full overflow-hidden border border-gray-200">
                                        <div
                                            className="h-full bg-black transition-all duration-300"
                                            style={{ width: `${masterProgress}%` }}
                                        ></div>
                                    </div>
                                </div>
                            )}

                            {masterError && (
                                <div role="alert" className="p-4 bg-red-50 border border-red-300 rounded-xl flex items-start gap-3 text-red-900">
                                    <AlertTriangle size={18} className="shrink-0 mt-0.5 text-red-700" aria-hidden="true" />
                                    <p className="text-xs font-medium">{masterError}</p>
                                </div>
                            )}

                            {masterResult && (
                                <div role="status" className="p-4 bg-emerald-50 border border-emerald-300 rounded-xl flex items-start gap-3 text-emerald-900">
                                    <CheckCircle2 size={20} className="shrink-0 text-emerald-700" aria-hidden="true" />
                                    <div>
                                        <p className="font-bold text-sm">Update Master Berhasil!</p>
                                        <p className="text-xs mt-1">
                                            Berhasil memproses <strong>{masterResult.count}</strong> data master piezometer.
                                        </p>
                                    </div>
                                </div>
                            )}

                            {!masterLoading && !masterError && !masterResult && (
                                <div className="h-full flex flex-col items-center justify-center text-center py-10 border border-dashed border-gray-300 rounded-2xl bg-gray-50">
                                    <FileSpreadsheet size={36} className="text-gray-400 mb-2" aria-hidden="true" />
                                    <p className="text-xs font-medium text-gray-600">Belum ada file yang diunggah.</p>
                                </div>
                            )}
                        </div>
                    </div>
                </div>
            </div>

            {/* GIS / Map Data Section */}
            <div className="bg-white rounded-2xl border border-gray-200 shadow-xs overflow-hidden">
                <div className="p-5 sm:p-6 border-b border-gray-200 bg-gray-50 flex flex-wrap items-center justify-between gap-4">
                    <div>
                        <h2 className="text-sm font-bold text-gray-900 flex items-center gap-2">
                            <Globe size={16} className="text-gray-700" aria-hidden="true" />
                            <span>Manajemen Data Spasial (GIS)</span>
                        </h2>
                        <p className="text-xs text-gray-600 mt-1">
                            Upload file GeoJSON blok untuk visualisasi peta. Support: PT.JJP &amp; PT.THIP.
                        </p>
                    </div>
                    <label className="flex items-center gap-2.5 min-h-11 px-3 py-1.5 bg-white border border-gray-300 rounded-xl cursor-pointer">
                        <div className="text-right">
                            <p className="text-xs font-bold text-gray-900 leading-none">Hapus Data Lama</p>
                            <p className="text-[10px] text-gray-600 font-semibold uppercase tracking-wide mt-0.5">Replace Mode</p>
                        </div>
                        <input
                            type="checkbox"
                            checked={replaceMode}
                            onChange={e => setReplaceMode(e.target.checked)}
                            className="w-4 h-4 rounded accent-black cursor-pointer"
                        />
                    </label>
                </div>
                <div className="p-5 sm:p-6 space-y-6">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        <div className="space-y-4">
                            <div className="flex items-center gap-3 p-4 bg-gray-50 border border-gray-200 rounded-xl text-gray-800 text-xs">
                                <Info size={18} className="shrink-0 text-gray-700" aria-hidden="true" />
                                <div>
                                    <p className="font-bold">Penyiapan GeoJSON</p>
                                    <p className="mt-0.5 text-gray-600">Pastikan setiap feature memiliki properti <strong>PieRecordID</strong>.</p>
                                </div>
                            </div>

                            <div className="relative group">
                                <input
                                    type="file"
                                    accept=".geojson, .json"
                                    onChange={handleGeoUpload}
                                    disabled={geoLoading}
                                    aria-label="Upload file GeoJSON peta"
                                    className="absolute inset-0 w-full h-full opacity-0 cursor-pointer disabled:cursor-not-allowed z-10"
                                />
                                <div className={`flex flex-col items-center justify-center p-10 border-2 border-dashed rounded-2xl transition-colors ${
                                    geoLoading ? 'bg-gray-50 border-gray-200' : 'bg-white border-gray-300 group-hover:border-gray-900 group-hover:bg-gray-50'
                                }`}>
                                    {geoLoading ? (
                                        <Loader2 className="animate-spin text-gray-800 mb-2" size={28} aria-hidden="true" />
                                    ) : (
                                        <Upload className="text-gray-500 group-hover:text-gray-900 mb-2 transition-colors" size={28} aria-hidden="true" />
                                    )}
                                    <p className="text-sm font-semibold text-gray-900">
                                        {geoLoading ? 'Sedang Mengunggah...' : 'Upload GeoJSON Peta'}
                                    </p>
                                </div>
                            </div>
                        </div>

                        <div className="space-y-4">
                            {geoLoading && (
                                <div className="space-y-2">
                                    <div className="flex justify-between text-xs font-semibold text-gray-700">
                                        <span>{geoStatus}</span>
                                    </div>
                                    <div className="h-2 w-full bg-gray-100 rounded-full overflow-hidden border border-gray-200">
                                        <div className="h-full bg-black animate-pulse w-full"></div>
                                    </div>
                                </div>
                            )}

                            {geoError && (
                                <div role="alert" className="p-4 bg-red-50 border border-red-300 rounded-xl flex items-start gap-3 text-red-900">
                                    <AlertTriangle size={18} className="shrink-0 mt-0.5 text-red-700" aria-hidden="true" />
                                    <p className="text-xs font-medium">{geoError}</p>
                                </div>
                            )}

                            {geoResult && (
                                <div role="status" className="p-4 bg-emerald-50 border border-emerald-300 rounded-xl flex items-start gap-3 text-emerald-900">
                                    <CheckCircle2 size={20} className="shrink-0 text-emerald-700" aria-hidden="true" />
                                    <div>
                                        <p className="font-bold text-sm">Upload Spasial Berhasil!</p>
                                        <p className="text-xs mt-1">
                                            Berhasil menyimpan <strong>{geoResult.count}</strong> poligon blok ke database.
                                        </p>
                                    </div>
                                </div>
                            )}

                            {!geoLoading && !geoError && !geoResult && (
                                <div className="h-full flex flex-col items-center justify-center text-center py-10 border border-dashed border-gray-300 rounded-2xl bg-gray-50">
                                    <Globe size={36} className="text-gray-400 mb-2" aria-hidden="true" />
                                    <p className="text-xs font-medium text-gray-600">Gunakan file GeoJSON untuk mapping blok.</p>
                                </div>
                            )}
                        </div>
                    </div>
                </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {/* Sync Card */}
                <div className="bg-white rounded-2xl border border-gray-200 shadow-xs overflow-hidden flex flex-col">
                    <div className="p-5 sm:p-6 border-b border-gray-200 bg-gray-50">
                        <h2 className="text-sm font-bold text-gray-900 flex items-center gap-2">
                            <RefreshCw size={16} className="text-gray-700" aria-hidden="true" />
                            <span>Update Data Piezometer &amp; Rainfall</span>
                        </h2>
                    </div>
                    <div className="p-5 sm:p-6 space-y-4 flex-1 flex flex-col">
                        <p className="text-xs text-gray-600 leading-relaxed">
                            Tarik data terbaru dari server GIS untuk Piezometer (2 minggu terakhir) dan Rainfall (4 minggu terakhir) untuk seluruh unit aktif.
                        </p>

                        <div className="bg-gray-50 border border-gray-200 p-4 rounded-xl">
                            <h3 className="text-xs font-bold text-gray-800 uppercase tracking-wide mb-2">Informasi Update</h3>
                            <ul className="space-y-1.5 text-xs text-gray-700">
                                <li>· Piezometer: Update data TMAT real-time.</li>
                                <li>· Rainfall: Update data curah hujan harian.</li>
                                <li>· Cakupan: Seluruh estate di bawah unit aktif.</li>
                            </ul>
                        </div>

                        <div className="pt-2 mt-auto">
                            <button
                                type="button"
                                onClick={handleSync}
                                disabled={loading}
                                className="w-full min-h-11 flex items-center justify-center gap-2 py-2.5 rounded-xl font-semibold text-sm transition-colors bg-black text-white hover:bg-gray-800 disabled:opacity-50"
                            >
                                <RefreshCw size={15} className={loading ? 'animate-spin' : ''} aria-hidden="true" />
                                <span>{loading ? 'Memproses Update...' : 'Mulai Update Data'}</span>
                            </button>
                        </div>
                    </div>
                </div>

                {/* Progress / Status Section */}
                <div className="flex flex-col gap-4 h-full">
                    <div className="bg-white rounded-2xl border border-gray-200 shadow-xs flex-1 overflow-hidden flex flex-col">
                        <div className="p-4 border-b border-gray-200 bg-gray-50 flex items-center justify-between">
                            <h2 className="text-xs font-bold text-gray-700 uppercase tracking-wider flex items-center gap-2">
                                <Activity size={14} className="text-gray-700" aria-hidden="true" />
                                <span>Log Aktivitas Update</span>
                            </h2>
                            {loading && <span className="text-xs text-emerald-800 font-bold">LIVE</span>}
                        </div>
                        <div className="p-4 flex-1 overflow-y-auto max-h-[300px] bg-gray-900 font-mono text-xs space-y-1">
                            {progress.length === 0 && !loading && (
                                <div className="h-full flex flex-col items-center justify-center text-gray-400">
                                    Siap untuk melakukan update data...
                                </div>
                            )}
                            {progress.map((line, i) => (
                                <div key={i} className="text-gray-200 border-l-2 border-gray-600 pl-2 py-0.5">
                                    <span className="text-gray-400 mr-2">[{new Date().toLocaleTimeString([], { hour12: false })}]</span>
                                    {line}
                                </div>
                            ))}
                            {loading && (
                                <div className="text-emerald-400 animate-pulse pl-2 mt-2">
                                    _ Menunggu data selanjutnya...
                                </div>
                            )}
                            <div id="progress-end" />
                        </div>
                    </div>

                    {result && !loading && (
                        <div role="status" className="bg-emerald-50 border border-emerald-300 text-emerald-900 p-4 rounded-2xl flex items-center gap-3">
                            <CheckCircle2 size={20} className="shrink-0 text-emerald-700" aria-hidden="true" />
                            <div>
                                <h3 className="text-sm font-bold">Sinkronisasi Selesai</h3>
                                <p className="text-xs mt-0.5">Data berhasil diperbarui ke database lokal.</p>
                            </div>
                        </div>
                    )}

                    {error && (
                        <div role="alert" className="bg-red-50 border border-red-300 text-red-900 p-4 rounded-2xl flex items-center gap-3">
                            <AlertTriangle size={20} className="shrink-0 text-red-700" aria-hidden="true" />
                            <div>
                                <h3 className="text-sm font-bold">Gagal Update</h3>
                                <p className="text-xs mt-0.5">{error}</p>
                            </div>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}
