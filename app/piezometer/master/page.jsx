"use client";

import React, { useState } from 'react';
import * as XLSX from 'xlsx';
import { Upload, CheckCircle2, AlertCircle, Loader2, Database, FileSpreadsheet } from 'lucide-react';

export default function PzoMasterPage() {
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState(null);
  const [error, setError] = useState(null);
  const [adminKey, setAdminKey] = useState('');

  const [progress, setProgress] = useState(0);

  const [status, setStatus] = useState('');

  const handleFileUpload = (e) => {
    const file = e.target.files[0];
    if (!file) return;

    setLoading(true);
    setError(null);
    setResult(null);
    setProgress(0);
    setStatus('Membaca file Excel...');

    const reader = new FileReader();
    reader.onload = async (evt) => {
      try {
        console.log('File loaded, starting parse...');
        const dataArr = new Uint8Array(evt.target.result);
        const wb = XLSX.read(dataArr, { type: 'array' });
        const wsname = wb.SheetNames[0];
        const ws = wb.Sheets[wsname];
        
        setStatus('Memproses struktur data...');
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

        // CHUNKING ON CLIENT
        const chunkSize = 100;
        let processed = 0;
        const totalChunks = Math.ceil(cleanData.length / chunkSize);
        
        for (let i = 0; i < cleanData.length; i += chunkSize) {
          const chunk = cleanData.slice(i, i + chunkSize);
          const isFirst = i === 0;
          const currentChunkNum = Math.floor(i/chunkSize) + 1;
          
          setStatus(`Mengunggah batch ${currentChunkNum} dari ${totalChunks}...`);
          
          const res = await fetch(`/api/pzo-master?clear=${isFirst}`, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'x-admin-key': adminKey || localStorage.getItem('adminKey') || ''
            },
            body: JSON.stringify(chunk)
          });

          const json = await res.json();
          if (json.error) throw new Error(json.error);

          processed += chunk.length;
          setProgress(Math.round((processed / cleanData.length) * 100));
        }

        setStatus('Selesai!');
        setResult({ count: cleanData.length });
      } catch (err) {
        setError(err.message);
      } finally {
        setLoading(false);
      }
    };
    reader.readAsArrayBuffer(file);
  };

  return (
    <div className="max-w-4xl mx-auto space-y-8 animate-in fade-in duration-500">
      <header>
        <h1 className="text-2xl font-bold text-gray-900 tracking-tight">Sinkronisasi Master Piezometer</h1>
        <p className="text-sm text-gray-500 mt-1">Upload file Excel mapping blok untuk normalisasi perhitungan titik PZO.</p>
      </header>

      <div className="glass-card p-8 space-y-6">
        <div className="space-y-4">
          <div className="flex items-center gap-3 p-4 bg-amber-50 border border-amber-200 rounded-xl text-amber-800 text-sm">
            <AlertCircle size={20} className="shrink-0" />
            <div>
              <p className="font-bold">Penting: Format Excel</p>
              <p className="opacity-90">Pastikan file Excel memiliki header kolom: <b>pie_record_id</b>, <b>Mapping</b>, <b>EstCode</b>, <b>EstNewCode</b>, dan <b>IsActive</b>.</p>
            </div>
          </div>

          <div className="space-y-2">
            <label className="text-sm font-semibold text-gray-700">Admin Key</label>
            <input 
              type="password"
              placeholder="Masukkan Admin Key untuk otentikasi..."
              value={adminKey}
              onChange={e => setAdminKey(e.target.value)}
              className="w-full h-11 px-4 rounded-xl border border-gray-200 focus:ring-2 focus:ring-brand-orange/50 outline-none transition-all"
            />
            <p className="text-[10px] text-gray-400">Key ini diperlukan untuk melakukan perubahan pada database.</p>
          </div>

          <div className="relative group">
            <input 
              type="file" 
              accept=".xlsx, .xls, .csv"
              onChange={handleFileUpload}
              disabled={loading}
              className="absolute inset-0 w-full h-full opacity-0 cursor-pointer disabled:cursor-not-allowed z-10"
            />
            <div className={`flex flex-col items-center justify-center p-12 border-2 border-dashed rounded-2xl transition-all ${
              loading ? 'bg-gray-50 border-gray-200' : 'bg-white border-gray-300 group-hover:border-brand-orange group-hover:bg-orange-50/30'
            }`}>
              {loading ? (
                <Loader2 className="animate-spin text-brand-orange mb-4" size={48} />
              ) : (
                <Upload className="text-gray-400 group-hover:text-brand-orange mb-4 transition-colors" size={48} />
              )}
              <p className="text-lg font-bold text-gray-700">
                {loading ? 'Sedang Memproses...' : 'Klik atau Seret File Excel'}
              </p>
              <p className="text-sm text-gray-400 mt-1">Format: .xlsx, .xls, .csv</p>
            </div>
          </div>

          {loading && (
            <div className="space-y-2">
              <div className="flex justify-between text-xs font-bold text-gray-500 uppercase">
                <span>{status}</span>
                <span>{progress}%</span>
              </div>
              <div className="h-2 w-full bg-gray-100 rounded-full overflow-hidden">
                <div 
                  className="h-full bg-brand-orange transition-all duration-300"
                  style={{ width: `${progress}%` }}
                ></div>
              </div>
            </div>
          )}
        </div>

        {error && (
          <div className="p-4 bg-red-50 border border-red-100 rounded-xl flex items-start gap-3 text-red-700 animate-in slide-in-from-top-2">
            <AlertCircle size={18} className="shrink-0 mt-0.5" />
            <p className="text-sm font-medium">{error}</p>
          </div>
        )}

        {result && (
          <div className="p-6 bg-green-50 border border-green-100 rounded-xl flex items-start gap-4 text-green-800 animate-in zoom-in-95">
            <CheckCircle2 size={24} className="shrink-0 text-green-500" />
            <div>
              <p className="font-bold text-lg">Berhasil Sinkronisasi!</p>
              <p className="text-sm opacity-90 mt-1">
                Telah memproses <b>{result.totalRows}</b> data master. 
                Seluruh mapping blok kini telah diperbarui di database.
              </p>
              <div className="flex gap-2 mt-4">
                <button 
                  onClick={() => window.location.href = '/piezometer/comparison'}
                  className="px-4 py-2 bg-green-600 text-white rounded-lg text-xs font-bold hover:bg-green-700 transition-colors"
                >
                  Lihat Perbandingan
                </button>
              </div>
            </div>
          </div>
        )}
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div className="glass-card p-6">
          <div className="flex items-center gap-3 mb-4 text-gray-800">
            <Database className="text-brand-orange" size={20} />
            <h3 className="font-bold">Status Database</h3>
          </div>
          <p className="text-sm text-gray-600 leading-relaxed">
            Data mapping yang Anda unggah akan disimpan secara permanen. Sistem akan menggunakan mapping ini untuk menghitung jumlah "Blok" secara akurat di Dashboard dan Tabel Perbandingan.
          </p>
        </div>
        <div className="glass-card p-6">
          <div className="flex items-center gap-3 mb-4 text-gray-800">
            <FileSpreadsheet className="text-green-600" size={20} />
            <h3 className="font-bold">Tips Excel</h3>
          </div>
          <ul className="text-sm text-gray-600 space-y-2 list-disc list-inside">
            <li>Gunakan nama header yang persis (Case Sensitive)</li>
            <li>Kolom <b>Mapping</b> bisa diisi lebih dari satu blok (pisahkan dengan koma)</li>
            <li>Pastikan tidak ada baris kosong di tengah data</li>
          </ul>
        </div>
      </div>
    </div>
  );
}
