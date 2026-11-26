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
    <div className="bg-white rounded-2xl border border-gray-200 p-5 shadow-xs">
      {/* Month navigation */}
      <div className="flex items-center justify-between mb-4">
        <button
          type="button"
          onClick={prevMonth}
          aria-label="Bulan sebelumnya"
          className="min-h-10 min-w-10 inline-flex items-center justify-center rounded-xl hover:bg-gray-100 text-gray-700 transition-colors"
        >
          <ChevronLeft size={18} aria-hidden="true" />
        </button>
        <span className="text-sm font-bold text-gray-900">
          {MONTH_NAMES[viewMonth]} {viewYear}
        </span>
        <button
          type="button"
          onClick={nextMonth}
          aria-label="Bulan berikutnya"
          className="min-h-10 min-w-10 inline-flex items-center justify-center rounded-xl hover:bg-gray-100 text-gray-700 transition-colors"
        >
          <ChevronRight size={18} aria-hidden="true" />
        </button>
      </div>

      {/* Day headers */}
      <div className="grid grid-cols-7 gap-1 mb-2">
        {DAY_NAMES.map(d => (
          <div key={d} className={`text-center text-[11px] font-bold uppercase tracking-wider py-1 ${d === 'Rab' ? 'text-gray-900' : 'text-gray-600'}`}>
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
                <span className="text-xs text-gray-400">{date.getDate()}</span>
              </div>
            );
          }

          return (
            <button
              key={dateStr}
              type="button"
              onClick={() => !isFuture && onSelect(dateStr)}
              disabled={isFuture}
              aria-label={`Pilih tanggal ${dateStr}`}
              aria-pressed={isSelected}
              className={`h-9 flex items-center justify-center rounded-lg text-xs font-semibold transition-colors relative
                ${isSelected
                  ? 'bg-black text-white'
                  : hasData
                    ? 'bg-emerald-50 text-emerald-800 hover:bg-emerald-100 border border-emerald-300'
                    : isFuture
                      ? 'bg-gray-50 text-gray-400'
                      : 'bg-gray-100 text-gray-800 hover:bg-gray-200 border border-gray-300'
                }
              `}
            >
              {date.getDate()}
              {hasData && !isSelected && (
                <span className="absolute -top-0.5 -right-0.5 w-2 h-2 bg-emerald-600 rounded-full" aria-hidden="true" />
              )}
            </button>
          );
        })}
      </div>

      {/* Legend */}
      <div className="mt-4 pt-3 border-t border-gray-200 flex flex-wrap items-center gap-4 text-[11px] text-gray-600">
        <div className="flex items-center gap-1.5">
          <span className="w-3 h-3 rounded bg-emerald-50 border border-emerald-300 inline-block relative">
            <span className="absolute -top-0.5 -right-0.5 w-1.5 h-1.5 bg-emerald-600 rounded-full" />
          </span>
          Data ada
        </div>
        <div className="flex items-center gap-1.5">
          <span className="w-3 h-3 rounded bg-gray-100 border border-gray-300 inline-block" />
          Belum ada
        </div>
        <div className="flex items-center gap-1.5">
          <span className="w-3 h-3 rounded bg-black inline-block" />
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

      setDownloadStatus('Sedang memproses data di cloud, biasanya selesai dalam 1-2 menit.');

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
      <header className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold text-gray-900 tracking-tight">
            ECMWF AIFS: Prakiraan Curah Hujan
          </h1>
          <p className="text-sm text-gray-600 mt-1">
            Model AIFS Single · Step 162 (7 hari) · Resolusi Tinggi
          </p>
        </div>

        {/* Tab Switcher */}
        <div className="flex flex-wrap items-center p-1 bg-white rounded-2xl border border-gray-200 shadow-xs gap-1" role="tablist" aria-label="Mode tampilan ECMWF">
          <button
            type="button"
            role="tab"
            aria-selected={activeTab === 'bulletin'}
            onClick={() => setActiveTab('bulletin')}
            className={`min-h-10 flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-semibold transition-colors ${
              activeTab === 'bulletin'
                ? 'bg-black text-white'
                : 'text-gray-700 hover:text-gray-900 hover:bg-gray-100'
            }`}
          >
            <FileText size={15} aria-hidden="true" />
            <span>Bulletin ECMWF</span>
          </button>

          <button
            type="button"
            role="tab"
            aria-selected={activeTab === 'interactive'}
            onClick={() => setActiveTab('interactive')}
            className={`min-h-10 flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-semibold transition-colors ${
              activeTab === 'interactive'
                ? 'bg-black text-white'
                : 'text-gray-700 hover:text-gray-900 hover:bg-gray-100'
            }`}
          >
            <MapIcon size={15} aria-hidden="true" />
            <span>Peta Interaktif</span>
          </button>

          <button
            type="button"
            role="tab"
            aria-selected={activeTab === 'settings'}
            onClick={() => setActiveTab('settings')}
            className={`min-h-10 flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-semibold transition-colors ${
              activeTab === 'settings'
                ? 'bg-black text-white'
                : 'text-gray-700 hover:text-gray-900 hover:bg-gray-100'
            }`}
          >
            <SlidersHorizontal size={15} aria-hidden="true" />
            <span>Pengaturan &amp; GIS</span>
          </button>
        </div>
      </header>

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
              <div className="bg-white rounded-2xl border border-gray-200 p-5 shadow-xs">
                <div className="text-xs font-bold text-gray-600 uppercase tracking-wider mb-3 tabular-nums">
                  {selectedDate}
                </div>

                {loading ? (
                  <div className="flex items-center gap-2 text-sm text-gray-600">
                    <Loader2 size={16} className="animate-spin" aria-hidden="true" />
                    <span>Memuat data...</span>
                  </div>
                ) : geojsonData ? (
                  <div className="space-y-3">
                    <div className="flex items-center gap-2 text-sm text-emerald-800 font-semibold">
                      <Check size={16} aria-hidden="true" />
                      <span>Data tersedia</span>
                    </div>
                    {dataInfo && (
                      <div className="space-y-1.5 text-xs text-gray-600 tabular-nums">
                        <div>Fitur: <span className="font-semibold text-gray-900">{dataInfo.feature_count}</span></div>
                        <div>Diunduh: <span className="font-semibold text-gray-900">
                          {new Date(dataInfo.created_at).toLocaleDateString('id-ID', {
                            day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit'
                          })}
                        </span></div>
                      </div>
                    )}
                    <button
                      type="button"
                      onClick={() => loadData(selectedDate)}
                      className="w-full min-h-11 flex items-center justify-center gap-2 px-3 py-2 text-xs font-semibold text-gray-900 bg-white border border-gray-300 hover:bg-gray-50 rounded-xl transition-colors"
                    >
                      <RefreshCw size={14} aria-hidden="true" />
                      <span>Refresh Data</span>
                    </button>
                  </div>
                ) : downloading ? (
                  <div className="space-y-3">
                    <div className="flex items-center gap-2 text-sm text-gray-900 font-semibold">
                      <Loader2 size={16} className="animate-spin" aria-hidden="true" />
                      <span>Sedang memproses...</span>
                    </div>
                    <p className="text-xs text-gray-600">{downloadStatus}</p>
                    <div className="w-full bg-gray-200 rounded-full h-2 overflow-hidden">
                      <div className="bg-black h-full rounded-full animate-pulse" style={{ width: '60%' }} />
                    </div>
                  </div>
                ) : (
                  <div className="space-y-3">
                    <div className="flex items-center gap-2 text-sm text-amber-800 font-semibold">
                      <AlertTriangle size={16} aria-hidden="true" />
                      <span>Data belum tersedia</span>
                    </div>
                    <button
                      type="button"
                      onClick={handleDownload}
                      className="w-full min-h-11 flex items-center justify-center gap-2 px-4 py-2.5 text-sm font-semibold text-white bg-black hover:bg-gray-800 rounded-xl transition-colors"
                    >
                      <Download size={16} aria-hidden="true" />
                      <span>Download &amp; Proses Data</span>
                    </button>
                    <p className="text-xs text-gray-600 text-center">
                      Proses download via cloud butuh sekitar 1-2 menit
                    </p>
                  </div>
                )}

                {error && (
                  <div role="alert" className="mt-3 p-3 bg-red-50 border border-red-300 rounded-xl text-xs text-red-900 font-medium">
                    {error}
                  </div>
                )}
              </div>
            )}

            {/* Base layer toggle for interactive mode */}
            {activeTab === 'interactive' && geojsonData && (
              <div className="bg-white rounded-2xl border border-gray-200 p-4 shadow-xs">
                <div className="text-xs font-bold text-gray-600 uppercase tracking-wider mb-2.5 flex items-center gap-1.5">
                  <Layers size={13} aria-hidden="true" />
                  <span>Base Map</span>
                </div>
                <div className="flex gap-1.5">
                  {[
                    { key: 'dark', label: 'Dark' },
                    { key: 'light', label: 'Light' },
                    { key: 'satellite', label: 'Satelit' },
                  ].map(l => (
                    <button
                      key={l.key}
                      type="button"
                      onClick={() => setBaseLayer(l.key)}
                      aria-pressed={baseLayer === l.key}
                      className={`flex-1 min-h-10 px-2 py-1.5 text-xs font-semibold rounded-xl transition-colors
                        ${baseLayer === l.key
                          ? 'bg-black text-white'
                          : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
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
                <div className="bg-white rounded-2xl border border-gray-200 p-12 shadow-xs flex flex-col items-center justify-center min-h-[550px] text-gray-600">
                  <CloudRain size={48} className="mb-4 text-gray-400" aria-hidden="true" />
                  <p className="text-sm font-medium text-center">
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
              <div className="bg-white rounded-2xl border border-gray-200 shadow-xs overflow-hidden relative" style={{ minHeight: '550px' }}>
                {geojsonData ? (
                  <>
                    <EcmwfLeafletMap data={geojsonData} baseLayer={baseLayer} />

                    {showLegend && (
                      <div className="absolute bottom-4 right-4 z-[1000] bg-white rounded-xl border border-gray-300 shadow-md p-3 max-w-[190px]">
                        <div className="flex items-center justify-between mb-2">
                          <span className="text-[11px] font-bold text-gray-800 uppercase tracking-wider">Curah Hujan (mm)</span>
                          <button
                            type="button"
                            onClick={() => setShowLegend(false)}
                            aria-label="Sembunyikan legenda"
                            className="text-gray-600 hover:text-gray-900 text-xs px-1.5 py-0.5 rounded"
                          >
                            ✕
                          </button>
                        </div>
                        <div className="space-y-0.5">
                          {CATEGORY_LEGEND.map(cat => (
                            <div key={cat.label} className="flex items-center gap-2">
                              <span
                                className="w-4 h-3 rounded-sm border border-black/15 shrink-0"
                                style={{ backgroundColor: cat.color }}
                              />
                              <span className="text-[11px] text-gray-800 font-medium">{cat.label}</span>
                              <span className="text-[10px] text-gray-600 ml-auto">{cat.desc}</span>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}

                    {!showLegend && (
                      <button
                        type="button"
                        onClick={() => setShowLegend(true)}
                        className="absolute bottom-4 right-4 z-[1000] min-h-10 bg-white px-3 py-2 rounded-xl shadow-md text-xs font-semibold text-gray-900 hover:bg-gray-50 border border-gray-300 inline-flex items-center gap-1.5"
                      >
                        <Info size={14} aria-hidden="true" />
                        <span>Legend</span>
                      </button>
                    )}
                  </>
                ) : (
                  <div className="flex flex-col items-center justify-center h-full min-h-[550px] text-gray-600 p-6 text-center">
                    <CloudRain size={48} className="mb-4 text-gray-400" aria-hidden="true" />
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
