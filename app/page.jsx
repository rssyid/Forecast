import React from 'react';
import { ArrowUpRight, Plus, Droplets, Activity, ChevronDown } from 'lucide-react';

export default function Dashboard() {
  return (
    <div className="space-y-6">
      
      {/* Top Grid - Metrics */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        
        {/* Metric 1 */}
        <div className="glass-card p-6 flex flex-col justify-between">
          <div className="flex justify-between items-start mb-4">
            <h3 className="text-lg font-semibold text-gray-800">Rata-rata TMAT</h3>
            <button className="w-8 h-8 rounded-full border border-gray-200 flex items-center justify-center hover:bg-gray-50 transition-colors">
              <ArrowUpRight size={16} className="text-gray-500" />
            </button>
          </div>
          <div>
            <div className="flex items-end gap-3 mb-2">
              <span className="text-5xl font-bold tracking-tighter text-gray-900">42.5</span>
              <span className="text-sm font-medium bg-brand-green/20 text-green-700 px-2 py-0.5 rounded-full mb-1">Aman</span>
            </div>
            <p className="text-xs text-gray-500 max-w-[200px] leading-relaxed">
              Level air rata-rata dalam batas normal bulan ini.
            </p>
          </div>
        </div>

        {/* Metric 2 */}
        <div className="glass-card p-6 flex flex-col justify-between">
          <div className="flex justify-between items-start mb-4">
            <h3 className="text-lg font-semibold text-gray-800">Akurasi Model</h3>
            <button className="w-8 h-8 rounded-full border border-gray-200 flex items-center justify-center hover:bg-gray-50 transition-colors">
              <ArrowUpRight size={16} className="text-gray-500" />
            </button>
          </div>
          <div>
            <div className="flex items-end gap-3 mb-2">
              <span className="text-5xl font-bold tracking-tighter text-gray-900">96%</span>
              <span className="text-sm font-medium bg-brand-green/20 text-green-700 px-2 py-0.5 rounded-full mb-1">High</span>
            </div>
            <p className="text-xs text-gray-500 max-w-[200px] leading-relaxed">
              Akurasi regresi Estate-Based meningkat 12% dari minggu lalu.
            </p>
          </div>
        </div>

      </div>

      {/* Middle Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        
        {/* Monitoring Estate (Tasks equivalent) */}
        <div className="glass-card p-6 lg:col-span-5 flex flex-col">
          <div className="flex justify-between items-center mb-6">
            <h3 className="text-lg font-semibold text-gray-800">Monitoring Estate</h3>
            <button className="w-8 h-8 rounded-full border border-gray-200 flex items-center justify-center hover:bg-gray-50 transition-colors">
              <Plus size={16} className="text-gray-500" />
            </button>
          </div>
          
          <div className="flex gap-2 mb-6">
            <button className="px-4 py-1.5 bg-black text-white text-sm font-medium rounded-full">All Estates</button>
            <button className="px-4 py-1.5 border border-gray-200 text-gray-600 text-sm font-medium rounded-full hover:bg-gray-50 transition-colors">Kritis</button>
            <button className="px-4 py-1.5 border border-gray-200 text-gray-600 text-sm font-medium rounded-full hover:bg-gray-50 transition-colors">Aman</button>
          </div>

          <div className="space-y-4 flex-1">
            <div className="p-4 rounded-xl border border-gray-100 bg-white/40 hover:bg-white/60 transition-colors cursor-pointer">
              <div className="flex justify-between items-start mb-2">
                <h4 className="font-semibold text-sm">PT.THIP - Estate Pelita</h4>
                <span className="text-[10px] font-bold px-2 py-1 bg-blue-100 text-blue-600 rounded-full uppercase tracking-wider">Perlu Cek</span>
              </div>
              <p className="text-xs text-gray-500 mb-3">Terindikasi penurunan TMA > 10cm dalam 3 hari terakhir akibat defisit hujan.</p>
              <div className="flex justify-between items-center">
                <span className="text-[10px] text-gray-400">Update: Hari ini</span>
                <span className="text-[10px] font-medium text-gray-500">2 Anomali</span>
              </div>
            </div>

            <div className="p-4 rounded-xl border border-brand-orange/20 bg-gradient-orange hover:bg-brand-orange/10 transition-colors cursor-pointer">
              <div className="flex justify-between items-start mb-2">
                <h4 className="font-semibold text-sm">PT.SUMS - Estate Kencana</h4>
                <span className="text-[10px] font-bold px-2 py-1 bg-brand-orange text-white rounded-full uppercase tracking-wider">Kritis</span>
              </div>
              <p className="text-xs text-gray-500 mb-3">Area blok A12 memasuki zona Kering (>65cm). Rekomendasi penutupan pintu air.</p>
              <div className="flex justify-between items-center">
                <span className="text-[10px] text-gray-400">Update: Kemarin</span>
                <span className="text-[10px] font-medium text-gray-500">5 Tindakan</span>
              </div>
            </div>
          </div>
        </div>

        {/* Status Piezometer per Hari (Calendar equivalent) */}
        <div className="glass-card p-6 lg:col-span-7">
           <div className="flex justify-between items-center mb-8">
            <h3 className="text-lg font-semibold text-gray-800">Status Piezometer Harian</h3>
            <button className="flex items-center gap-2 px-3 py-1.5 bg-black text-white text-xs font-medium rounded-full">
              Bulan ini <ChevronDown size={14} />
            </button>
          </div>

          <div className="grid grid-cols-7 gap-y-6 text-center">
            {/* Days Header */}
            {['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'].map(d => (
              <div key={d} className="text-xs font-medium text-gray-500 mb-4">{d}</div>
            ))}

            {/* Dummy grid representing status: Green check = aman, Orange cross = peringatan, Gray cross = no data */}
            {Array.from({ length: 4 }).map((_, rowIndex) => (
              <React.Fragment key={rowIndex}>
                {Array.from({ length: 7 }).map((_, colIndex) => {
                  const isPast = rowIndex < 2 || (rowIndex === 2 && colIndex < 5);
                  const isWarning = rowIndex === 1 && colIndex === 0;
                  const isNoData = !isPast;
                  
                  let circleClass = "w-8 h-8 rounded-full flex items-center justify-center mx-auto ";
                  let icon = null;

                  if (isNoData) {
                    circleClass += "bg-gray-100/50 text-gray-400";
                    icon = <span className="text-xs font-bold">×</span>;
                  } else if (isWarning) {
                    circleClass += "bg-brand-orange text-white shadow-sm";
                    icon = <span className="text-xs font-bold">×</span>;
                  } else {
                    circleClass += "bg-brand-green text-green-800 shadow-sm";
                    icon = <span className="text-xs font-bold">✓</span>;
                  }

                  return (
                    <div key={colIndex}>
                      <div className={circleClass}>{icon}</div>
                    </div>
                  );
                })}
              </React.Fragment>
            ))}
          </div>
        </div>

      </div>
    </div>
  );
}
