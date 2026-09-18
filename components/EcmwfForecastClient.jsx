"use client";

import { useState, useEffect, useCallback, useRef } from 'react';
import dynamic from 'next/dynamic';
import { 
  CloudRain, Download, Check, Loader2, ChevronLeft, ChevronRight, 
  RefreshCw, Layers, Info, AlertTriangle, Map as MapIcon, 
  FileText, SlidersHorizontal 
} from 'lucide-react';
import EcmwfSettingsTab from './EcmwfSettingsTab';

// Dynamic imports
const EcmwfLeafletMap = dynamic(() => import('./EcmwfLeafletMap'), { ssr: false });
const EcmwfBulletinCanvas = dynamic(() => import('./EcmwfBulletinCanvas'), { ssr: false });

// ========== CONSTANTS ==========
const CATEGORY_LEGEND = [
  { label: '0.1-1', color: '#e6d7b6', desc: 'Sangat Ringan' },
  { label: '1-2', color: '#a8e89a', desc: 'Ringan' },
  { label: '2-5', color: '#72e467', desc: 'Ringan-Sedang' },
  { label: '5-10', color: '#addbe6', desc: 'Sedang' },
  { label: '10-15', color: '#78addf', desc: 'Sedang' },
  { label: '15-20', color: '#4e92df', desc: 'Sedang-Lebat' },
  { label: '20-30', color: '#2f6ee8', desc: 'Lebat' },
  { label: '30-40', color: '#e9d96c', desc: 'Lebat' },
  { label: '40-50', color: '#f7a600', desc: 'Sangat Lebat' },
  { label: '50-100', color: '#ff0d0d', desc: 'Sangat Lebat' },
  { label: '100-300', color: '#a32323', desc: 'Ekstrem' },
  { label: '300-1000+', color: '#ef23ff', desc: 'Ekstrem' },
];

const DAY_NAMES = ['Min', 'Sen', 'Sel', 'Rab', 'Kam', 'Jum', 'Sab'];
const MONTH_NAMES = [
  'Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni',
  'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember'
];

// ========== HELPER FUNCTIONS ==========
function formatDateStr(d) {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

function isWednesday(date) {
  return date.getDay() === 3;
}

// ========== CALENDAR COMPONENT ==========
function WednesdayCalendar({ selectedDate, onSelect, availableDates }) {
  const today = new Date();
  const [viewYear, setViewYear] = useState(today.getFullYear());
  const [viewMonth, setViewMonth] = useState(today.getMonth());

  const availableSet = new Set(availableDates.map(d => d.date || d));

  const prevMonth = () => {
    if (viewMonth === 0) { setViewMonth(11); setViewYear(viewYear - 1); }
    else { setViewMonth(viewMonth - 1); }
  };

  const nextMonth = () => {
    if (viewMonth === 11) { setViewMonth(0); setViewYear(viewYear + 1); }
    else { setViewMonth(viewMonth + 1); }
  };

  // Build calendar grid
  const firstDay = new Date(viewYear, viewMonth, 1).getDay();
  const daysInMonth = new Date(viewYear, viewMonth + 1, 0).getDate();
  const cells = [];

  for (let i = 0; i < firstDay; i++) {
    cells.push(null);
  }
  for (let d = 1; d <= daysInMonth; d++) {
    cells.push(new Date(viewYear, viewMonth, d));
  }

  return (
    <div className="bg-white/80 backdrop-blur-sm rounded-2xl border border-gray-200/60 p-5 shadow-sm">
      {/* Month navigation */}
      <div className="flex items-center justify-between mb-4">
        <button onClick={prevMonth} className="p-1.5 rounded-lg hover:bg-gray-100 text-gray-500 transition-colors cursor-pointer">
          <ChevronLeft size={18} />
        </button>
        <span className="text-sm font-bold text-gray-800">
          {MONTH_NAMES[viewMonth]} {viewYear}
        </span>
        <button onClick={nextMonth} className="p-1.5 rounded-lg hover:bg-gray-100 text-gray-500 transition-colors cursor-pointer">
          <ChevronRight size={18} />
        </button>
      </div>

      {/* Day headers */}
      <div className="grid grid-cols-7 gap-1 mb-2">
        {DAY_NAMES.map(d => (
          <div key={d} className={`text-center text-[10px] font-bold uppercase tracking-wider py-1 ${d === 'Rab' ? 'text-blue-600' : 'text-gray-400'}`}>
            {d}
          </div>
        ))}
      </div>

      {/* Calendar grid */}
      <div className="grid grid-cols-7 gap-1">
        {cells.map((date, idx) => {
          if (!date) {
            return <div key={`empty-${idx}`} className="h-9" />;
          }

          const dateStr = formatDateStr(date);
          const isWed = isWednesday(date);
          const hasData = availableSet.has(dateStr);
          const isSelected = selectedDate === dateStr;
          const isFuture = date > today;

          if (!isWed) {
            return (
              <div key={dateStr} className="h-9 flex items-center justify-center">
                <span className="text-xs text-gray-300">{date.getDate()}</span>
              </div>
            );
          }

          return (
            <button
              key={dateStr}
              onClick={() => !isFuture && onSelect(dateStr)}
              disabled={isFuture}
              className={`h-9 flex items-center justify-center rounded-lg text-xs font-semibold transition-all relative cursor-pointer
                ${isSelected
                  ? 'bg-blue-600 text-white shadow-md scale-105'
                  : hasData
                    ? 'bg-green-50 text-green-700 hover:bg-green-100 border border-green-200'
                    : isFuture
                      ? 'bg-gray-50 text-gray-300 cursor-not-allowed'
                      : 'bg-blue-50 text-blue-600 hover:bg-blue-100 border border-blue-200'
                }
              `}
            >
              {date.getDate()}
              {hasData && !isSelected && (
                <span className="absolute -top-0.5 -right-0.5 w-2 h-2 bg-green-500 rounded-full" />
              )}
            </button>
          );
        })}
      </div>

      {/* Legend */}
      <div className="mt-4 pt-3 border-t border-gray-100 flex items-center gap-4 text-[10px] text-gray-500">
        <div className="flex items-center gap-1.5">
          <span className="w-3 h-3 rounded bg-green-50 border border-green-200 inline-block relative">
            <span className="absolute -top-0.5 -right-0.5 w-1.5 h-1.5 bg-green-500 rounded-full" />
          </span>
          Data ada
        </div>
        <div className="flex items-center gap-1.5">
          <span className="w-3 h-3 rounded bg-blue-50 border border-blue-200 inline-block" />
          Belum ada
        </div>
        <div className="flex items-center gap-1.5">
          <span className="w-3 h-3 rounded bg-blue-600 inline-block" />
          Dipilih
        </div>
      </div>
    </div>
  );
}

// ========== MAIN COMPONENT ==========
export default function EcmwfForecastClient() {
  // Navigation tabs: 'interactive' | 'bulletin' | 'settings'
  const [activeTab, setActiveTab] = useState('bulletin');

  // State for data
  const [availableDates, setAvailableDates] = useState([]);
  const [selectedDate, setSelectedDate] = useState(null);
  const [geojsonData, setGeojsonData] = useState(null);
  const [dataInfo, setDataInfo] = useState(null);
  const [baseLayer, setBaseLayer] = useState('dark');
  const [loading, setLoading] = useState(false);
  const [downloading, setDownloading] = useState(false);
  const [downloadStatus, setDownloadStatus] = useState('');
  const [error, setError] = useState(null);
  const [showLegend, setShowLegend] = useState(true);

  // Multi-PT & Settings state
  const [selectedCompany, setSelectedCompany] = useState('SIP');
  const [settings, setSettings] = useState({
    selected_companies: ['SIP', 'THIP', 'JJP', 'KALBAR A', 'KALBAR B'],
    regional_buffer_km: 150,
    local_padding_pct: 20,
    logo_data: null,
    logo_width_px: 130,
    colors: {
      water: '#9fc5e8',
      land: '#e4decb',
      pt_outline: '#0040ff',
      pt_rect: '#000000'
    }
  });

  const pollRef = useRef(null);

  // Fetch available dates & bulletin settings on mount
  useEffect(() => {
    fetchDates();
    fetchSettings();
  }, []);

  const fetchDates = async () => {
    try {
      const res = await fetch('/api/ecmwf-dates');
      const data = await res.json();
      const dates = data.dates || [];
      setAvailableDates(dates);

      // Auto select the latest date if available
      if (dates.length > 0 && !selectedDate) {
        const latest = dates[0].date;
        setSelectedDate(latest);
        loadData(latest);
      }
    } catch (err) {
      console.error('Failed to fetch dates:', err);
    }
  };

  const fetchSettings = async () => {
    try {
      const res = await fetch('/api/ecmwf-settings');
      const data = await res.json();
      if (data.settings) {
        setSettings(data.settings);
        if (data.settings.selected_companies?.length) {
          setSelectedCompany(data.settings.selected_companies[0]);
        }
      }
    } catch (err) {
      console.error('Failed to fetch settings:', err);
    }
  };

  // Load data for selected date
  const loadData = useCallback(async (dateStr) => {
    setLoading(true);
    setError(null);
    setGeojsonData(null);
    setDataInfo(null);

    try {
      const res = await fetch(`/api/ecmwf-forecast?date=${dateStr}`);
      const data = await res.json();

      if (data.found) {
        setGeojsonData(data.geojson);
        setDataInfo({
          date: data.date,
          feature_count: data.feature_count,
          created_at: data.created_at,
        });
      }
    } catch (err) {
      setError('Gagal memuat data: ' + err.message);
    } finally {
      setLoading(false);
    }
  }, []);

  // When date is selected
  const handleDateSelect = (dateStr) => {
    if (pollRef.current) {
      clearInterval(pollRef.current);
      pollRef.current = null;
    }
    setDownloading(false);
    setDownloadStatus('');
    setSelectedDate(dateStr);
    loadData(dateStr);
  };

  // Trigger download via GitHub Actions
  const handleDownload = async () => {
    if (!selectedDate) return;

    setDownloading(true);
    setDownloadStatus('Mengirim permintaan download ke GitHub Actions...');
    setError(null);

    try {
      const res = await fetch('/api/ecmwf-forecast/trigger', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ date: selectedDate }),
      });

      const result = await res.json();

      if (!res.ok || !result.triggered) {
        throw new Error(result.error || 'Gagal trigger download');
      }

      setDownloadStatus('⏳ Sedang memproses data di cloud... biasanya selesai dalam 1-2 menit');

      // Start polling every 10 seconds
      pollRef.current = setInterval(async () => {
        try {
          const pollRes = await fetch(`/api/ecmwf-forecast?date=${selectedDate}`);
          const pollData = await pollRes.json();

          if (pollData.found) {
            clearInterval(pollRef.current);
            pollRef.current = null;
            setDownloading(false);
            setDownloadStatus('');
            setGeojsonData(pollData.geojson);
            setDataInfo({
              date: pollData.date,
              feature_count: pollData.feature_count,
              created_at: pollData.created_at,
            });
            fetchDates();
          }
        } catch (err) {
          console.error('Poll error:', err);
        }
      }, 10000);

      // Stop polling after 5 minutes
      setTimeout(() => {
        if (pollRef.current) {
          clearInterval(pollRef.current);
          pollRef.current = null;
          setDownloading(false);
          setDownloadStatus('');
          setError('Timeout: Data belum tersedia setelah 5 menit. Coba refresh halaman.');
        }
      }, 300000);

    } catch (err) {
      setDownloading(false);
      setDownloadStatus('');
      setError(err.message);
    }
  };

  useEffect(() => {
    return () => {
      if (pollRef.current) clearInterval(pollRef.current);
    };
  }, []);

  const companyList = settings.selected_companies || ['SIP', 'THIP', 'JJP', 'KALBAR A', 'KALBAR B'];

  return (
    <div className="space-y-6">
      {/* Header & Mode Tabs */}
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-3">
            <CloudRain className="text-blue-600" size={28} />
            ECMWF AIFS — Prakiraan Curah Hujan
          </h1>
          <p className="text-sm text-gray-500 mt-1">
            Model AIFS Single · Step 162 (≈7 hari) · Resolusi Tinggi
          </p>
        </div>

        {/* Tab Switcher */}
        <div className="flex items-center p-1.5 bg-gray-200/70 backdrop-blur-sm rounded-2xl border border-gray-300/60 shadow-inner">
          <button
            onClick={() => setActiveTab('bulletin')}
            className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer ${
              activeTab === 'bulletin'
                ? 'bg-white text-gray-900 shadow-md scale-[1.02]'
                : 'text-gray-600 hover:text-gray-900 hover:bg-white/40'
            }`}
          >
            <FileText size={15} />
            Bulletin ECMWF
          </button>

          <button
            onClick={() => setActiveTab('interactive')}
            className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer ${
              activeTab === 'interactive'
                ? 'bg-white text-gray-900 shadow-md scale-[1.02]'
                : 'text-gray-600 hover:text-gray-900 hover:bg-white/40'
            }`}
          >
            <MapIcon size={15} />
            Peta Interaktif
          </button>

          <button
            onClick={() => setActiveTab('settings')}
            className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer ${
              activeTab === 'settings'
                ? 'bg-white text-gray-900 shadow-md scale-[1.02]'
                : 'text-gray-600 hover:text-gray-900 hover:bg-white/40'
            }`}
          >
            <SlidersHorizontal size={15} />
            Pengaturan & GIS
          </button>
        </div>
      </div>

      {/* Main Content Layout */}
      {activeTab === 'settings' ? (
        <EcmwfSettingsTab
          settings={settings}
          onSettingsSaved={(newSettings) => setSettings(newSettings)}
          availableCompanies={companyList}
        />
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
          {/* Left Panel: Calendar + Action Box */}
          <div className="lg:col-span-1 space-y-4">
            {/* Calendar */}
            <WednesdayCalendar
              selectedDate={selectedDate}
              onSelect={handleDateSelect}
              availableDates={availableDates}
            />

            {/* Action / Info Panel */}
            {selectedDate && (
              <div className="bg-white/80 backdrop-blur-sm rounded-2xl border border-gray-200/60 p-5 shadow-sm">
                <div className="text-xs font-bold text-gray-500 uppercase tracking-wider mb-3">
                  {selectedDate}
                </div>

                {loading ? (
                  <div className="flex items-center gap-2 text-sm text-gray-500">
                    <Loader2 size={16} className="animate-spin" />
                    Memuat data...
                  </div>
                ) : geojsonData ? (
                  <div className="space-y-3">
                    <div className="flex items-center gap-2 text-sm text-green-700 font-medium">
                      <Check size={16} />
                      Data tersedia
                    </div>
                    {dataInfo && (
                      <div className="space-y-1.5 text-xs text-gray-500">
                        <div>Fitur: <span className="font-semibold text-gray-700">{dataInfo.feature_count}</span></div>
                        <div>Diunduh: <span className="font-semibold text-gray-700">
                          {new Date(dataInfo.created_at).toLocaleDateString('id-ID', { 
                            day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' 
                          })}
                        </span></div>
                      </div>
                    )}
                    <button
                      onClick={() => loadData(selectedDate)}
                      className="w-full flex items-center justify-center gap-2 px-3 py-2 text-xs font-medium text-gray-600 bg-gray-50 hover:bg-gray-100 rounded-xl transition-colors cursor-pointer"
                    >
                      <RefreshCw size={13} /> Refresh Data
                    </button>
                  </div>
                ) : downloading ? (
                  <div className="space-y-3">
                    <div className="flex items-center gap-2 text-sm text-blue-700 font-medium">
                      <Loader2 size={16} className="animate-spin" />
                      Sedang memproses...
                    </div>
                    <p className="text-xs text-gray-500">{downloadStatus}</p>
                    <div className="w-full bg-blue-100 rounded-full h-1.5 overflow-hidden">
                      <div className="bg-blue-500 h-full rounded-full animate-pulse" style={{ width: '60%' }} />
                    </div>
                  </div>
                ) : (
                  <div className="space-y-3">
                    <div className="flex items-center gap-2 text-sm text-amber-700 font-medium">
                      <AlertTriangle size={16} />
                      Data belum tersedia
                    </div>
                    <button
                      onClick={handleDownload}
                      className="w-full flex items-center justify-center gap-2 px-4 py-3 text-sm font-semibold text-white bg-blue-600 hover:bg-blue-700 rounded-xl shadow-md transition-all hover:shadow-lg active:scale-[0.98] cursor-pointer"
                    >
                      <Download size={16} />
                      Download & Proses Data
                    </button>
                    <p className="text-[10px] text-gray-400 text-center">
                      Proses download via cloud butuh ~1-2 menit
                    </p>
                  </div>
                )}

                {error && (
                  <div className="mt-3 p-3 bg-red-50 border border-red-200 rounded-xl text-xs text-red-700">
                    {error}
                  </div>
                )}
              </div>
            )}

            {/* Base layer toggle for interactive mode */}
            {activeTab === 'interactive' && geojsonData && (
              <div className="bg-white/80 backdrop-blur-sm rounded-2xl border border-gray-200/60 p-4 shadow-sm">
                <div className="text-xs font-bold text-gray-500 uppercase tracking-wider mb-2 flex items-center gap-1.5">
                  <Layers size={13} /> Base Map
                </div>
                <div className="flex gap-1">
                  {[
                    { key: 'dark', label: 'Dark' },
                    { key: 'light', label: 'Light' },
                    { key: 'satellite', label: 'Satelit' },
                  ].map(l => (
                    <button
                      key={l.key}
                      onClick={() => setBaseLayer(l.key)}
                      className={`flex-1 px-2 py-1.5 text-[10px] font-bold uppercase rounded-lg transition-all cursor-pointer
                        ${baseLayer === l.key
                          ? 'bg-black text-white shadow'
                          : 'bg-gray-50 text-gray-500 hover:bg-gray-100'
                        }`}
                    >
                      {l.label}
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* Right Panel: Active Tab View */}
          <div className="lg:col-span-3 space-y-4">
            {activeTab === 'bulletin' ? (
              /* BULLETIN VIEW (Option B: Exact Replica of ECMWF Poster) */
              geojsonData ? (
                <EcmwfBulletinCanvas
                  forecastDate={selectedDate || '2026-09-16'}
                  geojsonData={geojsonData}
                  dataInfo={dataInfo}
                  selectedCompany={selectedCompany}
                  onCompanyChange={(c) => setSelectedCompany(c)}
                  companyList={companyList}
                  settings={settings}
                />
              ) : (
                <div className="bg-white/80 backdrop-blur-sm rounded-2xl border border-gray-200/60 p-12 shadow-sm flex flex-col items-center justify-center min-h-[550px] text-gray-400">
                  <CloudRain size={64} className="mb-4 opacity-20" />
                  <p className="text-sm font-medium">
                    {selectedDate 
                      ? loading 
                        ? 'Memuat data bulletin...' 
                        : 'Pilih hari Rabu dengan data tersedia atau klik Download untuk membuat bulletin.' 
                      : 'Pilih tanggal Rabu pada kalender di sebelah kiri.'}
                  </p>
                </div>
              )
            ) : (
              /* INTERACTIVE LEAFLET MAP VIEW */
              <div className="bg-white/80 backdrop-blur-sm rounded-2xl border border-gray-200/60 shadow-sm overflow-hidden relative" style={{ minHeight: '550px' }}>
                {geojsonData ? (
                  <>
                    <EcmwfLeafletMap data={geojsonData} baseLayer={baseLayer} />

                    {showLegend && (
                      <div className="absolute bottom-4 right-4 z-[1000] bg-white/95 backdrop-blur-sm rounded-xl border border-gray-200/80 shadow-lg p-3 max-w-[180px]">
                        <div className="flex items-center justify-between mb-2">
                          <span className="text-[10px] font-bold text-gray-600 uppercase tracking-wider">Curah Hujan (mm)</span>
                          <button onClick={() => setShowLegend(false)} className="text-gray-400 hover:text-gray-600 text-xs cursor-pointer">✕</button>
                        </div>
                        <div className="space-y-0.5">
                          {CATEGORY_LEGEND.map(cat => (
                            <div key={cat.label} className="flex items-center gap-2">
                              <span
                                className="w-4 h-3 rounded-sm border border-black/10 shrink-0"
                                style={{ backgroundColor: cat.color }}
                              />
                              <span className="text-[10px] text-gray-600 font-medium">{cat.label}</span>
                              <span className="text-[9px] text-gray-400 ml-auto">{cat.desc}</span>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}

                    {!showLegend && (
                      <button
                        onClick={() => setShowLegend(true)}
                        className="absolute bottom-4 right-4 z-[1000] bg-white/95 px-3 py-1.5 rounded-lg shadow-md text-[10px] font-bold text-gray-600 hover:bg-gray-50 border border-gray-200 cursor-pointer"
                      >
                        <Info size={12} className="inline mr-1" />
                        Legend
                      </button>
                    )}
                  </>
                ) : (
                  <div className="flex flex-col items-center justify-center h-full min-h-[550px] text-gray-400">
                    <CloudRain size={64} className="mb-4 opacity-20" />
                    <p className="text-sm font-medium">
                      {selectedDate
                        ? loading
                          ? 'Memuat data peta...'
                          : downloading
                            ? 'Menunggu data selesai diproses...'
                            : 'Pilih tanggal Rabu dan klik Download'
                        : 'Pilih tanggal Rabu pada kalender untuk memulai'}
                    </p>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
