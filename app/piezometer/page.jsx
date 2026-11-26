"use client";

import React, { useState, useEffect, useCallback } from 'react';
import { Loader2, TrendingUp, TrendingDown, Minus, Droplets, ThermometerSun, Building2, CalendarDays, RefreshCw, Activity, CheckCircle, AlertTriangle } from 'lucide-react';
import SearchableSelect from '../../components/SearchableSelect';

const CLASS_CONFIG = [
  { key: 'cnt_banjir', label: 'Banjir (<0)', color: '#71717A' },
  { key: 'cnt_tergenang', label: 'Tergenang (0-40)', color: '#1D4ED8' },
  { key: 'cnt_a_tergenang', label: 'A. Tergenang (41-45)', color: '#60A5FA' },
  { key: 'cnt_normal', label: 'Normal (46-60)', color: '#22C55E' },
  { key: 'cnt_a_kering', label: 'A. Kering (61-65)', color: '#F59E0B' },
  { key: 'cnt_kering', label: 'Kering (>65)', color: '#EF4444' },
];

function fmtDate(str) {
    if (!str) return '';
    const [y, m, d] = str.split('-');
    return `${d}-${m}-${y}`;
}

export default function PzoOverviewPage() {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [company, setCompany] = useState('Semua');
  const [week, setWeek] = useState('');
  const [weekList, setWeekList] = useState([]);
  const [companyList, setCompanyList] = useState(['Semua']);

  // Fetch Filters
  useEffect(() => {
    fetch('/api/companies?active=true')
      .then(r => r.json())
      .then(json => {
        if (json.companies) setCompanyList(['Semua', ...json.companies.map(c => c.code)]);
      });

    fetch('/api/calendar-weeks')
      .then(r => r.json())
      .then(json => {
        if (json.weeks?.length > 0) {
          setWeekList(json.weeks);
          
          // Default to current week (where today is between start and end)
          const now = new Date();
          const currentWeek = json.weeks.find(w => {
              const start = new Date(w.start_date);
              const end = new Date(w.end_date);
              return now >= start && now <= end;
          });

          if (currentWeek) {
            setWeek(currentWeek.formatted_name);
          } else {
            // Fallback: latest week (first item in DESC list)
            setWeek(json.weeks[0].formatted_name);
          }
        }
      });
  }, []);

  const fetchData = useCallback(async (selectedCompany, selectedWeek) => {
    setLoading(true);
    try {
      const params = new URLSearchParams({ company: selectedCompany });
      if (selectedWeek) params.set('week', selectedWeek);
      const res = await fetch(`/api/dashboard-summary?${params}`);
      const json = await res.json();
      setData(json);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (week !== '') fetchData(company, week);
  }, [company, week, fetchData]);

  if (!data && loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="animate-spin text-gray-400" size={32} />
      </div>
    );
  }

  const cur = data?.currentWeek;
  const prev = data?.prevWeek;
  if (!cur) return <div className="bg-white rounded-2xl border border-gray-200 p-12 text-center text-gray-600 shadow-xs">Tidak ada data piezometer.</div>;

  const total = cur.total_block || 1;
  const tmatDiff = prev ? (parseFloat(cur.avg_tmat) - parseFloat(prev.avg_tmat)).toFixed(1) : null;
  const isGood = tmatDiff !== null && parseFloat(tmatDiff) < 0;
  const isBad = tmatDiff !== null && parseFloat(tmatDiff) > 0;
  const trendColor = isGood ? 'text-emerald-700' : isBad ? 'text-red-700' : 'text-gray-600';

  const basahCount = (cur.cnt_tergenang || 0) + (cur.cnt_a_tergenang || 0) + (cur.cnt_banjir || 0);
  const keringCount = (cur.cnt_a_kering || 0) + (cur.cnt_kering || 0);
  const basahPct = ((basahCount / total) * 100).toFixed(1);
  const keringPct = ((keringCount / total) * 100).toFixed(1);

  return (
    <div className="space-y-6">
      <header className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold text-gray-900 tracking-tight">Overview Piezometer</h1>
          <p className="text-sm text-gray-600 mt-1">
            Kondisi TMAT terkini untuk {company} · {cur.week} {cur.week_start && cur.week_end ? `(${fmtDate(cur.week_start)} - ${fmtDate(cur.week_end)})` : ''}
          </p>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
            <SearchableSelect
                icon={<CalendarDays size={14} />}
                options={weekList.map(w => ({ value: w.formatted_name, label: w.formatted_name }))}
                value={week}
                onChange={setWeek}
                placeholder="Pilih Minggu..."
                className="min-w-[180px]"
                autoSort={false}
            />
            <SearchableSelect
                icon={<Building2 size={14} />}
                options={companyList}
                value={company}
                onChange={setCompany}
                placeholder="Pilih Company..."
                className="min-w-[150px]"
            />
            <button
                type="button"
                onClick={() => fetchData(company, week)}
                disabled={loading}
                aria-label="Muat ulang data piezometer"
                title="Muat ulang data"
                className="min-h-11 min-w-11 inline-flex items-center justify-center rounded-xl border border-gray-300 bg-white hover:bg-gray-50 transition-colors disabled:opacity-50"
            >
                <RefreshCw size={16} className={loading ? 'animate-spin text-gray-500' : 'text-gray-800'} aria-hidden="true" />
            </button>
        </div>
      </header>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-5 gap-4">
        <div className="bg-white rounded-2xl border border-gray-200 p-5 shadow-xs">
          <span className="text-xs font-semibold text-gray-600 uppercase tracking-wide block mb-1">Populasi</span>
          <p className="text-xl font-bold text-gray-900 tabular-nums">{cur.total_pzo} / {cur.total_block}</p>
          <span className="text-xs text-gray-600">Titik / Blok</span>
        </div>

        <div className="bg-white rounded-2xl border border-gray-200 p-5 shadow-xs">
          <span className="text-xs font-semibold text-gray-600 uppercase tracking-wide block mb-1">Rata-rata</span>
          <div className="flex items-center gap-2">
            <p className="text-xl font-bold text-gray-900 tabular-nums">{cur.avg_tmat} cm</p>
            {tmatDiff !== null && parseFloat(tmatDiff) !== 0 && (
              <span className={`flex items-center gap-0.5 text-xs font-bold tabular-nums ${trendColor}`}>
                {isGood ? (
                  <svg width="8" height="8" viewBox="0 0 10 10" aria-hidden="true"><polygon points="5,0 10,10 0,10" fill="currentColor"/></svg>
                ) : (
                  <svg width="8" height="8" viewBox="0 0 10 10" aria-hidden="true"><polygon points="0,0 10,0 5,10" fill="currentColor"/></svg>
                )}
                {Math.abs(tmatDiff)}
              </span>
            )}
          </div>
          <span className="text-xs text-gray-600">TMAT ({cur.week})</span>
        </div>

        <div className="bg-white rounded-2xl border border-gray-200 p-5 shadow-xs">
          <span className="text-xs font-semibold text-gray-600 uppercase tracking-wide block mb-1">Basah (&le;45)</span>
          <p className="text-xl font-bold text-blue-800 tabular-nums">{basahCount} <span className="text-xs font-medium text-gray-600">({basahPct}%)</span></p>
          <span className="text-xs text-gray-600">Kondisi Tergenang</span>
        </div>

        <div className="bg-white rounded-2xl border border-red-200 p-5 shadow-xs">
          <span className="text-xs font-semibold text-gray-600 uppercase tracking-wide block mb-1">Kering (&gt;60)</span>
          <p className="text-xl font-bold text-red-800 tabular-nums">{keringCount} <span className="text-xs font-medium text-gray-600">({keringPct}%)</span></p>
          <span className="text-xs text-gray-600">Resiko Kebakaran</span>
        </div>

        <div className="bg-white rounded-2xl border border-gray-200 p-5 shadow-xs">
          <span className="text-xs font-semibold text-gray-600 uppercase tracking-wide block mb-1">Normal</span>
          <p className="text-xl font-bold text-emerald-800 tabular-nums">{cur.cnt_normal || 0}</p>
          <span className="text-xs text-gray-600">Kondisi Ideal</span>
        </div>
      </div>

      {/* Distribution Bar */}
      <div className={`bg-white rounded-2xl border border-gray-200 p-5 shadow-xs ${loading ? 'opacity-50 pointer-events-none' : ''}`}>
        <h2 className="text-base font-bold text-gray-900 mb-4">Distribusi Kondisi Blok</h2>
        <div className="flex rounded-xl overflow-hidden h-10 bg-gray-100 border border-gray-200">
          {CLASS_CONFIG.map(cls => {
            const count = cur[cls.key] || 0;
            const pct = (count / total) * 100;
            if (pct === 0) return null;
            return (
              <div
                key={cls.key}
                className="flex items-center justify-center text-white text-xs font-bold tabular-nums"
                style={{ width: `${pct}%`, backgroundColor: cls.color }}
                title={`${cls.label}: ${count} blok (${pct.toFixed(1)}%)`}
              >
                {pct > 5 && `${pct.toFixed(0)}%`}
              </div>
            );
          })}
        </div>
        <div className="flex flex-wrap gap-4 mt-3">
          {CLASS_CONFIG.map(cls => {
            const count = cur[cls.key] || 0;
            return (
              <div key={cls.key} className="flex items-center gap-1.5 text-xs tabular-nums">
                <span className="w-3 h-3 rounded-sm shrink-0" style={{ backgroundColor: cls.color }}></span>
                <span className="font-medium text-gray-800">{cls.label}</span>
                <span className="text-gray-600">({count} blok)</span>
              </div>
            );
          })}
        </div>
      </div>

      {/* Top Estates Table */}
      {data.estateBreakdown?.length > 0 && (
        <div className={`bg-white rounded-2xl border border-gray-200 shadow-xs overflow-hidden ${loading ? 'opacity-50' : ''}`}>
          <div className="bg-gray-50 p-4 border-b border-gray-200">
            <h2 className="font-bold text-gray-900 text-base">Top Estate: Blok Kering Terbanyak</h2>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm text-left">
              <thead className="text-gray-700 text-xs font-semibold uppercase tracking-wider border-b border-gray-200 bg-gray-50">
                <tr>
                  <th className="p-3">Estate</th>
                  <th className="p-3">Company</th>
                  <th className="p-3 text-center">Titik PZO</th>
                  <th className="p-3 text-center">Blok</th>
                  <th className="p-3 text-center text-red-800">Kering</th>
                  <th className="p-3 text-center text-blue-800">Basah</th>
                  <th className="p-3 text-center">Avg TMAT</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100 tabular-nums">
                {data.estateBreakdown.map((est, i) => (
                  <tr key={i} className="hover:bg-gray-50">
                    <td className="p-3 font-bold text-gray-900">{est.estate}</td>
                    <td className="p-3 text-gray-700">{est.company}</td>
                    <td className="p-3 text-center text-gray-800">{est.total_pzo}</td>
                    <td className="p-3 text-center font-bold text-gray-900">{est.total_block}</td>
                    <td className="p-3 text-center font-bold text-red-800">{est.cnt_kering}</td>
                    <td className="p-3 text-center font-bold text-blue-800">{est.cnt_basah}</td>
                    <td className="p-3 text-center font-medium text-gray-900">{est.avg_tmat} cm</td>
                  </tr>
                ))}
              </tbody>
              <tfoot className="bg-gray-50 font-bold border-t border-gray-200 tabular-nums">
                <tr>
                  <td className="p-3 text-gray-900" colSpan={2}>TOTAL</td>
                  <td className="p-3 text-center text-gray-900">{data.estateBreakdown.reduce((s, e) => s + (e.total_pzo || 0), 0)}</td>
                  <td className="p-3 text-center text-gray-900">{data.estateBreakdown.reduce((s, e) => s + (e.total_block || 0), 0)}</td>
                  <td className="p-3 text-center text-red-800">{data.estateBreakdown.reduce((s, e) => s + (e.cnt_kering || 0), 0)}</td>
                  <td className="p-3 text-center text-blue-800">{data.estateBreakdown.reduce((s, e) => s + (e.cnt_basah || 0), 0)}</td>
                  <td className="p-3 text-center text-gray-900">
                    {(data.estateBreakdown.reduce((s, e) => s + parseFloat(e.avg_tmat || 0), 0) / data.estateBreakdown.length).toFixed(1)} cm
                  </td>
                </tr>
              </tfoot>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
