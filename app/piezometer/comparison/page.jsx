"use client";

import React, { useState, useEffect } from 'react';
import { ClipboardCopy, Check, ChevronDown, Loader2 } from 'lucide-react';

const CLASS_ROWS = [
  { key: 'banjir', label: '< 0', color: '#71717A', bg: '#71717A' },
  { key: 'tergenang', label: '0 - 40 cm', color: '#1D4ED8', bg: '#1D4ED8' },
  { key: 'a_kering', label: '61 - 65 cm', color: '#F59E0B', bg: '#F59E0B' },
  { key: 'kering', label: '> 65 cm', color: '#EF4444', bg: '#EF4444' },
];

export default function PzoComparisonPage() {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [selectedWeek, setSelectedWeek] = useState('');
  const [availableWeeks, setAvailableWeeks] = useState([]);
  const [copied, setCopied] = useState(false);

  const fetchData = async (week) => {
    setLoading(true);
    try {
      const params = week ? `?week=${encodeURIComponent(week)}` : '';
      const res = await fetch(`/api/pzo-comparison${params}`);
      const json = await res.json();
      setData(json);
      setAvailableWeeks(json.availableWeeks || []);
      
      if (!week) {
        // Default logic: find current calendar week if exists in availableWeeks
        // The API now returns selectedWeek which already has some default logic
        setSelectedWeek(json.selectedWeek);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchData(selectedWeek); }, []);

  const handleWeekChange = (w) => {
    setSelectedWeek(w);
    fetchData(w);
  };

  const handleCopy = () => {
    if (!data?.rows) return;
    const sw = data.selectedWeek || '';
    const pw = data.prevWeek || '';
    // Build TSV
    let tsv = `No\tCompany\tTMAT PZO\t${pw}\t\t\t${sw}\t\t\n`;
    tsv += `\t\t\tCH\tBlok\t%\tCH\tBlok\t%\n`;
    data.rows.forEach(row => {
      CLASS_ROWS.forEach((cls, ci) => {
        const prevTotal = row.previous?.total || 1;
        const selTotal = row.selected?.total || 1;
        const prevBlok = row.previous?.[cls.key] || 0;
        const selBlok = row.selected?.[cls.key] || 0;
        const prevPct = prevTotal > 0 ? ((prevBlok / prevTotal) * 100).toFixed(0) : '0';
        const selPct = selTotal > 0 ? ((selBlok / selTotal) * 100).toFixed(0) : '0';
        
        const noCol = ci === 0 ? row.no : '';
        const compCol = ci === 0 ? row.company : '';
        const prevCH = ci === 0 && row.previous ? `${row.previous.ch}/${row.previous.hh} HH` : '';
        const selCH = ci === 0 ? `${row.selected.ch}/${row.selected.hh} HH` : '';
        
        tsv += `${noCol}\t${compCol}\t${cls.label}\t${prevCH}\t${prevBlok}\t${prevPct}\t${selCH}\t${selBlok}\t${selPct}\n`;
      });
    });
    navigator.clipboard.writeText(tsv).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  };

  return (
    <div className="space-y-6">
      <header className="flex flex-col lg:flex-row lg:items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold text-gray-900 tracking-tight">Perbandingan Piezometer</h1>
          <p className="text-sm text-gray-600 mt-1">Table Summary CH &amp; PZO · Perbandingan antar minggu</p>
        </div>
        <div className="flex flex-wrap items-end gap-3">
          <div className="space-y-1">
            <label htmlFor="pzo-comp-week" className="block text-xs font-semibold text-gray-700">Pilih Minggu</label>
            <div className="relative">
              <select
                id="pzo-comp-week"
                value={selectedWeek}
                onChange={e => handleWeekChange(e.target.value)}
                className="min-h-11 pl-3 pr-9 rounded-xl border border-gray-300 bg-white text-sm font-medium text-gray-900 appearance-none"
              >
                {availableWeeks.map(w => <option key={w} value={w}>{w}</option>)}
              </select>
              <ChevronDown className="absolute right-3 top-3.5 text-gray-500 pointer-events-none" size={14} aria-hidden="true" />
            </div>
          </div>
          <button
            type="button"
            onClick={handleCopy}
            className={`min-h-11 inline-flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-semibold border transition-colors ${
              copied
                ? 'bg-emerald-50 text-emerald-800 border-emerald-300'
                : 'bg-white text-gray-900 border-gray-300 hover:bg-gray-50'
            }`}
          >
            {copied ? <><Check size={16} aria-hidden="true" /> Tersalin!</> : <><ClipboardCopy size={16} aria-hidden="true" /> Copy Tabel</>}
          </button>
        </div>
      </header>

      {loading ? (
        <div className="flex items-center justify-center h-64 bg-white rounded-2xl border border-gray-200 shadow-xs">
          <Loader2 className="animate-spin text-gray-500" size={32} aria-hidden="true" />
        </div>
      ) : data?.rows?.length > 0 ? (
        <div className="bg-white rounded-2xl overflow-hidden border-2 border-gray-800 shadow-xs">
          <div className="bg-[#B91C1C] p-3 text-center border-b-2 border-gray-800">
            <h3 className="font-bold text-white text-base">Table Summary CH & PZO (Last Update: {new Date().toLocaleDateString('id-ID', { day: 'numeric', month: 'short', year: 'numeric' })})</h3>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm text-center border-collapse">
              <thead>
                <tr className="bg-[#B91C1C] text-white border-b-2 border-gray-800">
                  <th rowSpan={3} className="p-2 border border-gray-800 font-bold w-10">No</th>
                  <th rowSpan={3} className="p-2 border border-gray-800 font-bold w-24">Company</th>
                  <th rowSpan={3} className="p-2 border border-gray-800 font-bold w-32 uppercase tracking-tighter">THIP PZO</th>
                  <th colSpan={6} className="p-1 border border-gray-800 font-bold text-xs uppercase tracking-widest bg-[#991B1B]">
                    {new Date().toLocaleDateString('id-ID', { month: 'long', year: 'numeric' })}
                  </th>
                </tr>
                <tr className="bg-[#B91C1C] text-white border-b-2 border-gray-800">
                  {data.prevWeek && (
                    <th colSpan={3} className="p-2 border border-gray-800 font-bold">
                      {data.prevWeek}
                    </th>
                  )}
                  <th colSpan={3} className="p-2 border border-gray-800 font-bold">
                    {data.selectedWeek}
                  </th>
                </tr>
                <tr className="bg-[#B91C1C] text-white border-b-2 border-gray-800">
                  {data.prevWeek && (
                    <>
                      <th className="p-2 border border-gray-800 text-xs font-bold w-24">CH</th>
                      <th className="p-2 border border-gray-800 text-xs font-bold w-16">Blok</th>
                      <th className="p-2 border border-gray-800 text-xs font-bold w-12">%</th>
                    </>
                  )}
                  <th className="p-2 border border-gray-800 text-xs font-bold w-24">CH</th>
                  <th className="p-2 border border-gray-800 text-xs font-bold w-16">Blok</th>
                  <th className="p-2 border border-gray-800 text-xs font-bold w-12">%</th>
                </tr>
              </thead>
              <tbody>
                {data.rows.map((row) => (
                  CLASS_ROWS.map((cls, ci) => {
                    const selTotal = row.selected?.total || 1;
                    const prevTotal = row.previous?.total || 1;
                    const selBlok = row.selected?.[cls.key] || 0;
                    const prevBlok = row.previous?.[cls.key] || 0;
                    const selPct = selTotal > 0 ? Math.round((selBlok / selTotal) * 100) : 0;
                    const prevPct = prevTotal > 0 ? Math.round((prevBlok / prevTotal) * 100) : 0;
                    
                    return (
                      <tr key={`${row.companyCode}-${cls.key}`} className={`border-b ${ci === CLASS_ROWS.length - 1 ? 'border-b-2 border-gray-800' : 'border-gray-300'} hover:bg-gray-50/50`}>
                        {ci === 0 && (
                          <>
                            <td rowSpan={CLASS_ROWS.length} className="p-2 border border-gray-400 font-bold text-gray-700 align-middle">{row.no}</td>
                            <td rowSpan={CLASS_ROWS.length} className="p-2 border border-gray-400 font-bold text-gray-900 align-middle">{row.company}</td>
                          </>
                        )}
                        <td className="p-1.5 border border-gray-400">
                          <span 
                            className="inline-block w-full px-2 py-1 text-xs font-black text-white"
                            style={{ backgroundColor: cls.bg }}
                          >
                            {cls.label}
                          </span>
                        </td>
                        {data.prevWeek && (
                          <>
                            {ci === 0 ? (
                              <td rowSpan={CLASS_ROWS.length} className="p-2 border border-gray-400 text-xs font-medium text-gray-900 align-middle">
                                {row.previous ? `${row.previous.ch}/${row.previous.hh} HH` : '0 mm/0 HH'}
                              </td>
                            ) : null}
                            <td className="p-2 border border-gray-400 text-sm font-medium">{prevBlok}</td>
                            <td className="p-2 border border-gray-400 text-sm font-medium text-gray-700">{prevPct}</td>
                          </>
                        )}
                        {ci === 0 ? (
                          <td rowSpan={CLASS_ROWS.length} className="p-2 border border-gray-400 text-xs font-medium text-gray-900 align-middle">
                            {`${row.selected.ch}/${row.selected.hh} HH`}
                          </td>
                        ) : null}
                        <td className="p-2 border border-gray-400 text-sm font-medium">{selBlok}</td>
                        <td className="p-2 border border-gray-400 text-sm font-medium text-gray-700">{selPct}</td>
                      </tr>
                    );
                  })
                ))}
              </tbody>
            </table>
          </div>
        </div>
      ) : (
        <div className="bg-white rounded-2xl border border-gray-200 p-12 text-center text-gray-600 shadow-xs">
          <p>Tidak ada data piezometer yang tersedia.</p>
        </div>
      )}
    </div>
  );
}
