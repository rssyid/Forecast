"use client";

import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  BarElement,
  Title,
  Tooltip,
  Legend,
} from 'chart.js';
import { Bar } from 'react-chartjs-2';
import { TrendingUp, TrendingDown, CloudRain, Info, ArrowUpRight, ArrowDownRight } from 'lucide-react';

ChartJS.register(
  CategoryScale,
  LinearScale,
  BarElement,
  Title,
  Tooltip,
  Legend
);

const CATEGORIES = [
  { key: 'cnt_banjir', label: 'Banjir', color: '#6b7280' },
  { key: 'cnt_tergenang', label: 'Tergenang', color: '#2563eb' },
  { key: 'cnt_a_tergenang', label: 'A. Terg', color: '#60a5fa' },
  { key: 'cnt_normal', label: 'Normal', color: '#22c55e' },
  { key: 'cnt_a_kering', label: 'A. Kering', color: '#f59e0b' },
  { key: 'cnt_kering', label: 'Kering', color: '#ef4444' }
];

export default function CompanyComparisonCard({ item, currentWeek, prevWeek }) {
  const { companyName, currentWeek: current, prevWeek: prev, rainfall } = item;

  // Calculate overall trend
  // Improving if Kering/A.Kering decrease OR Normal increases
  const currentRisk = (current?.cnt_kering || 0) + (current?.cnt_a_kering || 0);
  const prevRisk = (prev?.cnt_kering || 0) + (prev?.cnt_a_kering || 0);
  const isImproving = currentRisk < prevRisk || (current?.cnt_normal || 0) > (prev?.cnt_normal || 0);
  const isDegrading = currentRisk > prevRisk;

  const data = {
    labels: CATEGORIES.map(c => c.label),
    datasets: [
      {
        label: 'Minggu Lalu',
        data: CATEGORIES.map(c => prev?.[c.key] || 0),
        backgroundColor: '#e5e7eb', // Soft grey for historical
        borderRadius: 6,
      },
      {
        label: 'Minggu Ini',
        data: CATEGORIES.map(c => current?.[c.key] || 0),
        backgroundColor: CATEGORIES.map(c => c.color),
        borderRadius: 6,
      }
    ],
  };

  const options = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: { display: false },
      tooltip: {
        backgroundColor: '#1f2937',
        padding: 12,
        titleFont: { size: 14, weight: 'bold' },
        bodyFont: { size: 12 },
        cornerRadius: 8,
        displayColors: true
      }
    },
    scales: {
      y: { 
        beginAtZero: true,
        grid: { color: '#f3f4f6' },
        ticks: { font: { size: 10 } }
      },
      x: { 
        grid: { display: false },
        ticks: { font: { size: 9, weight: 'bold' } }
      }
    },
  };

  return (
    <div className="bg-white rounded-[2rem] border border-gray-100 shadow-sm hover:shadow-xl transition-all duration-500 overflow-hidden group">
      {/* Card Header */}
      <div className="p-6 pb-4 border-b border-gray-50 flex justify-between items-start">
        <div className="space-y-1">
          <h3 className="text-xl font-black text-gray-800 tracking-tight">{companyName}</h3>
          <div className="flex items-center gap-2">
            <span className="px-2 py-0.5 bg-blue-50 text-blue-600 rounded-full text-[10px] font-bold uppercase tracking-wider">
              {currentWeek}
            </span>
            <span className="text-gray-300 text-[10px] font-bold">vs</span>
            <span className="text-gray-400 text-[10px] font-medium italic">
              {prevWeek || 'N/A'}
            </span>
          </div>
        </div>

        {/* Trend Badge */}
        {isDegrading ? (
          <div className="flex items-center gap-1.5 px-3 py-1.5 bg-red-50 text-red-600 rounded-xl border border-red-100 animate-pulse">
            <TrendingDown size={14} />
            <span className="text-[10px] font-black uppercase">Degrading</span>
          </div>
        ) : isImproving ? (
          <div className="flex items-center gap-1.5 px-3 py-1.5 bg-green-50 text-green-600 rounded-xl border border-green-100">
            <TrendingUp size={14} />
            <span className="text-[10px] font-black uppercase">Improving</span>
          </div>
        ) : (
          <div className="flex items-center gap-1.5 px-3 py-1.5 bg-gray-50 text-gray-500 rounded-xl border border-gray-100">
            <Minus size={14} />
            <span className="text-[10px] font-black uppercase">Stable</span>
          </div>
        )}
      </div>

      {/* Rainfall Context */}
      <div className="px-6 py-4 bg-gray-50/50 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl bg-blue-100 flex items-center justify-center text-blue-600">
            <CloudRain size={18} />
          </div>
          <div>
            <p className="text-[10px] font-bold text-gray-400 uppercase leading-none mb-1">Curah Hujan (CH)</p>
            <div className="flex items-center gap-2">
              <span className="text-sm font-black text-gray-800">{rainfall.current} mm / {rainfall.currentHH} HH</span>
              {rainfall.delta !== 0 && (
                <span className={`text-[10px] font-bold flex items-center ${rainfall.delta > 0 ? 'text-blue-500' : 'text-orange-500'}`}>
                  {rainfall.delta > 0 ? <ArrowUpRight size={10} /> : <ArrowDownRight size={10} />}
                  {Math.abs(rainfall.delta).toFixed(1)}
                </span>
              )}
            </div>
          </div>
        </div>

        <div className="text-right">
          <p className="text-[10px] font-bold text-gray-400 uppercase leading-none mb-1">Total Blok</p>
          <p className="text-sm font-black text-gray-800">{current?.total_blocks || 0}</p>
        </div>
      </div>

      {/* Chart Section */}
      <div className="p-6 h-[220px]">
        <Bar data={data} options={options} />
      </div>

      {/* Quick Insight Footer */}
      <div className="px-6 py-4 bg-white border-t border-gray-50 flex items-center gap-3">
        <Info className="text-blue-400 shrink-0" size={14} />
        <p className="text-[10px] text-gray-500 font-medium leading-relaxed italic">
          {currentRisk > prevRisk 
            ? `Peringatan: Kategori Kering meningkat ${currentRisk - prevRisk} blok dibanding minggu lalu.`
            : currentRisk < prevRisk
            ? `Kondisi membaik: Kategori Kering berkurang ${prevRisk - currentRisk} blok.`
            : `Kondisi stabil: Tidak ada pergerakan signifikan pada kategori berisiko.`}
        </p>
      </div>
    </div>
  );
}

function Minus({ size, className }) {
    return <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" className={className}><line x1="5" y1="12" x2="19" y2="12" /></svg>;
}
