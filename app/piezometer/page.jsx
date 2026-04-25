"use client";

import React, { useState, useEffect } from 'react';
import { Loader2, TrendingUp, TrendingDown, Minus, Droplets, ThermometerSun } from 'lucide-react';

const CLASS_CONFIG = [
  { key: 'cnt_banjir', label: 'Banjir (<0)', color: '#71717A' },
  { key: 'cnt_tergenang', label: 'Tergenang (0-40)', color: '#1D4ED8' },
  { key: 'cnt_a_tergenang', label: 'A. Tergenang (41-45)', color: '#60A5FA' },
  { key: 'cnt_normal', label: 'Normal (46-60)', color: '#22C55E' },
  { key: 'cnt_a_kering', label: 'A. Kering (61-65)', color: '#F59E0B' },
  { key: 'cnt_kering', label: 'Kering (>65)', color: '#EF4444' },
];

export default function PzoOverviewPage() {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch('/api/dashboard-summary?company=Semua')
      .then(r => r.json())
      .then(json => setData(json))
      .catch(console.error)
      .finally(() => setLoading(false));
  }, []);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="animate-spin text-gray-400" size={32} />
      </div>
    );
  }

  if (!data || !data.currentWeek) {
    return <div className="glass-card p-12 text-center text-gray-400">Tidak ada data piezometer yang tersedia.</div>;
  }

  const cur = data.currentWeek;
  const prev = data.prevWeek;
  const total = cur.total || 1;
  const prevTotal = prev?.total || 1;

  const tmatDiff = prev ? (parseFloat(cur.avg_tmat) - parseFloat(prev.avg_tmat)).toFixed(1) : null;
  const TrendIcon = tmatDiff > 0 ? TrendingUp : tmatDiff < 0 ? TrendingDown : Minus;
  const trendColor = tmatDiff > 0 ? 'text-red-500' : tmatDiff < 0 ? 'text-blue-500' : 'text-gray-400';

  // Basah & Kering percentages
  const basahCount = (cur.cnt_tergenang || 0) + (cur.cnt_a_tergenang || 0) + (cur.cnt_banjir || 0);
  const keringCount = (cur.cnt_a_kering || 0) + (cur.cnt_kering || 0);
  const basahPct = ((basahCount / total) * 100).toFixed(1);
  const keringPct = ((keringCount / total) * 100).toFixed(1);

  return (
    <div className="space-y-6 animate-in fade-in duration-500">
      <header>
        <h1 className="text-2xl font-bold text-gray-900 tracking-tight">Overview Piezometer</h1>
        <p className="text-sm text-gray-500 mt-1">Ringkasan kondisi TMAT terkini untuk seluruh company aktif — Minggu: <b>{cur.week}</b></p>
      </header>

      {/* Summary Cards */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
        <div className="glass-card p-4">
          <span className="text-xs font-semibold text-gray-500 uppercase tracking-wider">Minggu</span>
          <p className="text-lg font-bold text-gray-900 mt-1">{cur.week}</p>
        </div>
        <div className="glass-card p-4">
          <span className="text-xs font-semibold text-gray-500 uppercase tracking-wider">Total Titik PZO</span>
          <p className="text-lg font-bold text-gray-900 mt-1">{cur.total?.toLocaleString()}</p>
        </div>
        <div className="glass-card p-4">
          <span className="text-xs font-semibold text-gray-500 uppercase tracking-wider">Avg TMAT</span>
          <div className="flex items-center gap-2 mt-1">
            <p className="text-lg font-bold text-gray-900">{cur.avg_tmat} cm</p>
            {tmatDiff !== null && (
              <span className={`flex items-center gap-0.5 text-xs font-bold ${trendColor}`}>
                <TrendIcon size={14} /> {tmatDiff > 0 ? '+' : ''}{tmatDiff}
              </span>
            )}
          </div>
        </div>
        <div className="glass-card p-4 border-l-4 border-blue-500">
          <span className="text-xs font-semibold text-blue-600 uppercase tracking-wider flex items-center gap-1"><Droplets size={12} /> Basah (≤45)</span>
          <p className="text-lg font-bold text-blue-700 mt-1">{basahCount} <span className="text-sm font-normal text-blue-400">({basahPct}%)</span></p>
        </div>
        <div className="glass-card p-4 border-l-4 border-red-500">
          <span className="text-xs font-semibold text-red-600 uppercase tracking-wider flex items-center gap-1"><ThermometerSun size={12} /> Kering (&gt;60)</span>
          <p className="text-lg font-bold text-red-700 mt-1">{keringCount} <span className="text-sm font-normal text-red-400">({keringPct}%)</span></p>
        </div>
      </div>

      {/* Distribution Bar */}
      <div className="glass-card p-5">
        <h3 className="text-sm font-bold text-gray-800 mb-4">Distribusi Kelas TMAT</h3>
        <div className="flex rounded-xl overflow-hidden h-10 bg-gray-100">
          {CLASS_CONFIG.map(cls => {
            const count = cur[cls.key] || 0;
            const pct = (count / total) * 100;
            if (pct === 0) return null;
            return (
              <div 
                key={cls.key}
                className="flex items-center justify-center text-white text-[10px] font-bold transition-all duration-500"
                style={{ width: `${pct}%`, backgroundColor: cls.color, minWidth: pct > 3 ? 'auto' : '0' }}
                title={`${cls.label}: ${count} (${pct.toFixed(1)}%)`}
              >
                {pct > 5 && `${pct.toFixed(0)}%`}
              </div>
            );
          })}
        </div>
        <div className="flex flex-wrap gap-3 mt-3">
          {CLASS_CONFIG.map(cls => {
            const count = cur[cls.key] || 0;
            return (
              <div key={cls.key} className="flex items-center gap-1.5 text-xs">
                <span className="w-3 h-3 rounded-sm shrink-0" style={{ backgroundColor: cls.color }}></span>
                <span className="font-medium text-gray-700">{cls.label}</span>
                <span className="text-gray-400">({count})</span>
              </div>
            );
          })}
        </div>
      </div>

      {/* Comparison with Previous Week */}
      {prev && (
        <div className="glass-card p-5">
          <h3 className="text-sm font-bold text-gray-800 mb-4">Perubahan dari {prev.week} → {cur.week}</h3>
          <div className="grid grid-cols-2 md:grid-cols-6 gap-3">
            {CLASS_CONFIG.map(cls => {
              const curCount = cur[cls.key] || 0;
              const prevCount = prev[cls.key] || 0;
              const diff = curCount - prevCount;
              return (
                <div key={cls.key} className="rounded-xl border border-gray-100 p-3 text-center bg-white/40">
                  <span className="block w-full h-1.5 rounded-full mb-2" style={{ backgroundColor: cls.color }}></span>
                  <p className="text-lg font-bold text-gray-900">{curCount}</p>
                  <p className={`text-xs font-bold ${diff > 0 ? 'text-red-500' : diff < 0 ? 'text-green-500' : 'text-gray-400'}`}>
                    {diff > 0 ? `+${diff}` : diff === 0 ? '±0' : diff}
                  </p>
                  <p className="text-[10px] text-gray-400 mt-1">{cls.label.split(' ')[0]}</p>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Top Estates Table */}
      {data.estateBreakdown?.length > 0 && (
        <div className="glass-card overflow-hidden">
          <div className="bg-gray-50/50 p-4 border-b border-gray-100">
            <h3 className="font-bold text-gray-800">Top Estate — Blok Kering Terbanyak</h3>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm text-left">
              <thead className="text-gray-500 border-b border-gray-200 bg-gray-50/30">
                <tr>
                  <th className="p-3">Estate</th>
                  <th className="p-3">Company</th>
                  <th className="p-3 text-center">Total PZO</th>
                  <th className="p-3 text-center text-red-600">Kering</th>
                  <th className="p-3 text-center text-blue-600">Basah</th>
                  <th className="p-3 text-center">Avg TMAT</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {data.estateBreakdown.map((est, i) => (
                  <tr key={i} className="hover:bg-gray-50/50">
                    <td className="p-3 font-bold text-gray-900">{est.estate}</td>
                    <td className="p-3 text-gray-600">{est.company}</td>
                    <td className="p-3 text-center">{est.total}</td>
                    <td className="p-3 text-center font-bold text-red-600">{est.cnt_kering}</td>
                    <td className="p-3 text-center font-bold text-blue-600">{est.cnt_basah}</td>
                    <td className="p-3 text-center font-medium">{est.avg_tmat} cm</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
