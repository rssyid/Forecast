"use client";

import { useEffect, useRef, useState, useMemo } from 'react';
import { MapContainer, GeoJSON, Rectangle, useMap } from 'react-leaflet';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { Download, FileText, Loader2 } from 'lucide-react';
import { domToPng } from 'modern-screenshot';
import jsPDF from 'jspdf';

// 12-level ECMWF palette
const LEVELS = [0.1, 1, 2, 5, 10, 15, 20, 30, 40, 50, 100, 300, 1000];
const COLORS = [
  "#e6d7b6", "#a8e89a", "#72e467", "#addbe6", "#78addf", "#4e92df",
  "#2f6ee8", "#e9d96c", "#f7a600", "#ff0d0d", "#a32323", "#ef23ff"
];

// Fallback coordinates for default 5 PTs if DB has no record
const DEFAULT_PT_COORDS = {
  'SIP': [
    [-2.83, 104.56], [-2.83, 104.70], [-2.70, 104.70], [-2.70, 104.60],
    [-2.75, 104.60], [-2.75, 104.56]
  ],
  'THIP': [
    [-0.30, 103.10], [-0.30, 103.45], [-0.05, 103.45], [-0.05, 103.25],
    [-0.15, 103.25], [-0.15, 103.10]
  ],
  'JJP': [
    [-1.65, 103.40], [-1.65, 103.75], [-1.40, 103.75], [-1.40, 103.50],
    [-1.50, 103.50], [-1.50, 103.40]
  ],
  'KALBAR A': [
    [0.10, 109.20], [0.10, 109.60], [0.35, 109.60], [0.35, 109.40],
    [0.25, 109.40], [0.25, 109.20]
  ],
  'KALBAR B': [
    [-0.50, 110.10], [-0.50, 110.55], [-0.20, 110.55], [-0.20, 110.30],
    [-0.35, 110.30], [-0.35, 110.10]
  ]
};

// Map controller for Pane 1: Fixed Macro extent
function MacroFitController({ bounds }) {
  const map = useMap();
  useEffect(() => {
    if (bounds && map) {
      try {
        map.fitBounds(bounds, { padding: [0, 0], animate: false });
        setTimeout(() => map.invalidateSize(), 50);
      } catch (e) {
        console.error('Macro fit error:', e);
      }
    }
  }, [bounds, map]);
  return null;
}

// Map controller for Pane 2: Regional zoom with buffer km around PT
function RegionalFitController({ ptGeom, bufferKm = 150 }) {
  const map = useMap();
  useEffect(() => {
    if (ptGeom && map) {
      try {
        const layer = L.geoJSON(ptGeom);
        const bounds = layer.getBounds();
        if (bounds.isValid()) {
          const bufferDeg = bufferKm / 111;
          const regBounds = [
            [bounds.getSouth() - bufferDeg, bounds.getWest() - bufferDeg * 1.3],
            [bounds.getNorth() + bufferDeg, bounds.getEast() + bufferDeg * 1.3]
          ];
          map.fitBounds(regBounds, { animate: false });
          setTimeout(() => map.invalidateSize(), 50);
        }
      } catch (e) {
        console.error('Regional fit error:', e);
      }
    }
  }, [ptGeom, map, bufferKm]);
  return null;
}

// Map controller for Pane 3: Direct zoom to PT concession with padding %
function LocalPtFitController({ ptGeom, paddingPct = 20 }) {
  const map = useMap();
  useEffect(() => {
    if (ptGeom && map) {
      try {
        const layer = L.geoJSON(ptGeom);
        const bounds = layer.getBounds();
        if (bounds.isValid()) {
          const padRatio = Math.max(0.08, paddingPct / 100);
          map.fitBounds(bounds.pad(padRatio), { animate: false });
          setTimeout(() => map.invalidateSize(), 50);
        }
      } catch (e) {
        console.error('Local PT fit error:', e);
      }
    }
  }, [ptGeom, map, paddingPct]);
  return null;
}

// Coastline overlay with dedicated Leaflet pane (z-index 650) to ensure it stays on top of all layers
function CoastlineOverlay({ data, weight = 1.0, opacity = 1.0, paneName = 'coastlinePane' }) {
  const map = useMap();
  const [ready, setReady] = useState(false);

  useEffect(() => {
    if (map) {
      if (!map.getPane(paneName)) {
        const pane = map.createPane(paneName);
        pane.style.zIndex = '650';
        pane.style.pointerEvents = 'none';
      }
      setReady(true);
    }
  }, [map, paneName]);

  if (!ready || !data) return null;

  return (
    <GeoJSON
      key={`${paneName}-${data.features ? data.features.length : 1}`}
      data={data}
      pane={paneName}
      style={{
        fillColor: 'transparent',
        weight: weight,
        color: '#000000',
        opacity: opacity
      }}
    />
  );
}

// Regional company marker component (Pane 2) with 2x stroke weight (5.0px)
function RegionalCompanyMarker({ bounds, geom, color = '#000000', weight = 5.0 }) {
  const map = useMap();
  const [ready, setReady] = useState(false);

  useEffect(() => {
    if (map) {
      if (!map.getPane('regCompanyPane')) {
        const pane = map.createPane('regCompanyPane');
        pane.style.zIndex = '600'; // above rainfall (400), below coastline (650)
      }
      setReady(true);
    }
  }, [map]);

  if (!ready || !bounds) return null;

  return (
    <>
      <Rectangle
        bounds={bounds}
        pane="regCompanyPane"
        pathOptions={{
          color: color,
          weight: weight,
          fillColor: color,
          fillOpacity: 0.25
        }}
      />
      {geom && (
        <GeoJSON
          key={`reg-geom-${JSON.stringify(geom).length}`}
          data={geom}
          pane="regCompanyPane"
          style={{
            color: color,
            weight: weight,
            fillColor: 'transparent',
            opacity: 1
          }}
        />
      )}
    </>
  );
}

// Local PT concession outline (Pane 3)
function LocalPtOutline({ geom, color = '#0040ff', weight = 3.5 }) {
  const map = useMap();
  const [ready, setReady] = useState(false);

  useEffect(() => {
    if (map) {
      if (!map.getPane('localPtPane')) {
        const pane = map.createPane('localPtPane');
        pane.style.zIndex = '600'; // above rainfall (400), below coastline (650)
      }
      setReady(true);
    }
  }, [map]);

  if (!ready || !geom) return null;

  return (
    <GeoJSON
      key={`local-pt-${JSON.stringify(geom).length}`}
      data={geom}
      pane="localPtPane"
      style={{
        fillColor: color,
        fillOpacity: 0.12,
        weight: weight,
        color: color,
        opacity: 1
      }}
    />
  );
}

export default function EcmwfBulletinCanvas({
  forecastDate = '2026-09-16',
  geojsonData,
  dataInfo,
  selectedCompany = 'SIP',
  onCompanyChange,
  companyList = ['SIP', 'THIP', 'JJP', 'KALBAR A', 'KALBAR B'],
  settings = {}
}) {
  const posterRef = useRef(null);
  const [isExporting, setIsExporting] = useState(false);
  const [exportType, setExportType] = useState('');
  const [ptGeom, setPtGeom] = useState(null);
  const [coastlineGeom, setCoastlineGeom] = useState(null);

  // Settings
  const regionalBufferKm = Number(settings.regional_buffer_km) || 150;
  const localPaddingPct = Number(settings.local_padding_pct) || 20;
  const logoData = settings.logo_data || null;
  const logoWidth = Number(settings.logo_width_px) || 130;

  // Load PT geometry and Coastline from API
  useEffect(() => {
    let isMounted = true;
    async function loadPt() {
      try {
        const res = await fetch(`/api/ecmwf-gis?type=pt_boundaries&company=${encodeURIComponent(selectedCompany)}`);
        const json = await res.json();
        if (isMounted) {
          if (json.found && json.geojson) {
            setPtGeom(json.geojson);
          } else {
            // Fallback default polygon
            const coords = DEFAULT_PT_COORDS[selectedCompany] || DEFAULT_PT_COORDS['SIP'];
            const lonLat = coords.map(([lat, lon]) => [lon, lat]);
            lonLat.push(lonLat[0]);
            setPtGeom({
              type: 'FeatureCollection',
              features: [{
                type: 'Feature',
                properties: { company_code: selectedCompany },
                geometry: {
                  type: 'Polygon',
                  coordinates: [lonLat]
                }
              }]
            });
          }
        }
      } catch (e) {
        console.error('Failed to load PT geometry:', e);
      }
    }

    async function loadCoastline() {
      try {
        const res = await fetch(`/api/ecmwf-gis?type=coastline`);
        const json = await res.json();
        if (isMounted && json.found && json.geojson) {
          setCoastlineGeom(json.geojson);
        }
      } catch (e) {
        console.error('Failed to load coastline:', e);
      }
    }

    loadPt();
    loadCoastline();

    return () => { isMounted = false; };
  }, [selectedCompany]);

  // PT Bounding Box for Red Marker Rectangle in Pane 2
  const ptBounds = useMemo(() => {
    if (!ptGeom) return null;
    try {
      const layer = L.geoJSON(ptGeom);
      const b = layer.getBounds();
      if (b.isValid()) return b;
    } catch (e) {}
    return null;
  }, [ptGeom]);

  // Macro Bounds: SE Asia & Indonesia [lon 90-141, lat -12 to 24]
  const macroBounds = useMemo(() => [
    [-12, 90],
    [24, 141]
  ], []);

  // Format header dates
  const headerDates = useMemo(() => {
    const d = new Date(forecastDate + 'T00:00:00Z');
    const days = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
    const months = ['Jan', 'Feb', 'Mar', 'Sep', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
    
    const baseDay = days[d.getUTCDay()];
    const baseDate = d.getUTCDate();
    const baseMonth = months[d.getUTCMonth()];
    const baseYear = d.getUTCFullYear();
    const baseStr = `Base time: ${baseDay} ${baseDate} ${baseMonth} ${baseYear} 00 UTC`;

    const v = new Date(d.getTime() + 162 * 3600 * 1000);
    const validDay = days[v.getUTCDay()];
    const validDate = v.getUTCDate();
    const validMonth = months[v.getUTCMonth()];
    const validYear = v.getUTCFullYear();
    const validHours = String(v.getUTCHours()).padStart(2, '0');
    const validStr = `Valid time: ${validDay} ${validDate} ${validMonth} ${validYear} ${validHours} UTC (+162h)`;

    return { baseStr, validStr };
  }, [forecastDate]);

  // UTC timestamp for footer
  const footerTimestamp = useMemo(() => {
    if (dataInfo?.created_at) {
      return new Date(dataInfo.created_at).toISOString();
    }
    return new Date().toISOString();
  }, [dataInfo]);

  // Computed filename label: "ECMWF THIP 23 - 29 Sep"
  // Base date = forecastDate, Valid date = forecastDate + 162h
  const fileNameLabel = useMemo(() => {
    const MONTH_SHORT = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
    const base = new Date(forecastDate + 'T00:00:00Z');
    const valid = new Date(base.getTime() + 162 * 3600 * 1000);
    const startDay = base.getUTCDate();
    const endDay = valid.getUTCDate();
    // Use valid month (end of range) for the month label
    const monthName = MONTH_SHORT[valid.getUTCMonth()];
    return `ECMWF ${selectedCompany} ${startDay} - ${endDay} ${monthName}`;
  }, [forecastDate, selectedCompany]);

  // Export handlers
  const handleExportPNG = async () => {
    if (!posterRef.current) return;
    setIsExporting(true);
    setExportType('PNG');
    try {
      const dataUrl = await domToPng(posterRef.current, {
        scale: 2,
        quality: 0.98,
        backgroundColor: '#ffffff'
      });
      const link = document.createElement('a');
      link.download = `${fileNameLabel}.png`;
      link.href = dataUrl;
      link.click();
    } catch (err) {
      console.error('Export PNG failed:', err);
      alert('Gagal mengekspor gambar: ' + err.message);
    } finally {
      setIsExporting(false);
      setExportType('');
    }
  };

  const handleExportPDF = async () => {
    if (!posterRef.current) return;
    setIsExporting(true);
    setExportType('PDF');
    try {
      const dataUrl = await domToPng(posterRef.current, {
        scale: 2,
        quality: 0.98,
        backgroundColor: '#ffffff'
      });

      const pdf = new jsPDF({
        orientation: 'landscape',
        unit: 'mm',
        format: 'a4'
      });

      pdf.addImage(dataUrl, 'PNG', 0, 0, 297, 210, undefined, 'FAST');
      pdf.save(`${fileNameLabel}.pdf`);
    } catch (err) {
      console.error('Export PDF failed:', err);
      alert('Gagal mengekspor PDF: ' + err.message);
    } finally {
      setIsExporting(false);
      setExportType('');
    }
  };

  return (
    <div className="space-y-4">
      {/* Control Bar: PT Dropdown & Export Buttons */}
      <div className="flex flex-wrap items-center justify-between gap-3 bg-white/90 backdrop-blur-sm p-4 rounded-2xl border border-gray-200/80 shadow-sm">
        <div className="flex items-center gap-3">
          <label className="text-xs font-bold uppercase tracking-wider text-gray-600">Pilih Wilayah / PT:</label>
          <select
            value={selectedCompany}
            onChange={(e) => onCompanyChange && onCompanyChange(e.target.value)}
            className="px-3 py-2 text-sm font-semibold bg-gray-50 border border-gray-300 rounded-xl focus:ring-2 focus:ring-blue-500 focus:outline-none transition-all shadow-xs cursor-pointer"
          >
            {companyList.map(c => (
              <option key={c} value={c}>{c}</option>
            ))}
          </select>
          <span className="text-xs text-gray-400">
            (Peta kanan atas & bawah otomatis memusat ke batas PT)
          </span>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={handleExportPNG}
            disabled={isExporting}
            className="flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 active:scale-95 text-white text-xs font-bold rounded-xl shadow-sm transition-all disabled:opacity-50 cursor-pointer"
          >
            {isExporting && exportType === 'PNG' ? (
              <Loader2 size={14} className="animate-spin" />
            ) : (
              <Download size={14} />
            )}
            Download PNG (High-Res)
          </button>

          <button
            onClick={handleExportPDF}
            disabled={isExporting}
            className="flex items-center gap-2 px-4 py-2 bg-gray-900 hover:bg-black active:scale-95 text-white text-xs font-bold rounded-xl shadow-sm transition-all disabled:opacity-50 cursor-pointer"
          >
            {isExporting && exportType === 'PDF' ? (
              <Loader2 size={14} className="animate-spin" />
            ) : (
              <FileText size={14} />
            )}
            Download PDF (A4)
          </button>
        </div>
      </div>

      {/* Main Poster Container (Exact Replica of official ECMWF Bulletin) */}
      <div className="overflow-x-auto pb-4">
        <div
          ref={posterRef}
          className="bg-white text-black p-7 mx-auto shadow-xl select-none"
          style={{
            width: '1080px',
            minHeight: '760px',
            fontFamily: '"Helvetica Neue", Helvetica, Arial, sans-serif'
          }}
        >
          {/* Header */}
          <div className="text-center mb-3">
            <h1 className="text-xl font-bold tracking-tight text-gray-900 leading-tight">
              AIFS Single: Total accumulated precipitation
            </h1>
            <p className="text-[11px] text-gray-800 font-medium mt-0.5 tracking-wide">
              {headerDates.baseStr}&nbsp;&nbsp;{headerDates.validStr}&nbsp;&nbsp;Area : South East Asia & Indonesia
            </p>
          </div>

          {/* 3 Map Panes Container with Crisp Black Grid Border */}
          <div 
            className="grid grid-cols-12 border-2 border-black bg-white" 
            style={{ height: '510px' }}
          >
            {/* Pane 1: Macro View (Southeast Asia & Indonesia) */}
            <div className="col-span-7 border-r-2 border-black relative overflow-hidden bg-white">
              <MapContainer
                bounds={macroBounds}
                zoomControl={false}
                attributionControl={false}
                dragging={false}
                scrollWheelZoom={false}
                doubleClickZoom={false}
                className="w-full h-full bg-white"
              >
                <MacroFitController bounds={macroBounds} />

                {/* Rainfall categorized polygons */}
                {geojsonData && (
                  <GeoJSON
                    key={`macro-rain-${selectedCompany}`}
                    data={geojsonData}
                    style={(f) => ({
                      fillColor: f.properties?.color || '#ccc',
                      fillOpacity: 0.9,
                      weight: 0.1,
                      color: '#444'
                    })}
                  />
                )}

                {/* Black Coastline - Guaranteed on top in dedicated pane (zIndex 650) */}
                <CoastlineOverlay
                  data={coastlineGeom}
                  paneName="macroCoastlinePane"
                  weight={0.85}
                  opacity={1.0}
                />
              </MapContainer>
            </div>

            {/* Right Column: 2 Panes (Regional Zoom & Local Concession) */}
            <div className="col-span-5 grid grid-rows-2 h-full bg-white">
              {/* Pane 2: Top-Right Regional Zoom with Red/Black PT Indicator Box */}
              <div className="border-b-2 border-black relative overflow-hidden bg-white">
                <MapContainer
                  center={ptBounds ? ptBounds.getCenter() : [-2.8, 104.6]}
                  zoom={7}
                  zoomControl={false}
                  attributionControl={false}
                  dragging={false}
                  scrollWheelZoom={false}
                  doubleClickZoom={false}
                  className="w-full h-full bg-white"
                >
                  <RegionalFitController ptGeom={ptGeom} bufferKm={regionalBufferKm} />

                  {/* Rainfall polygons */}
                  {geojsonData && (
                    <GeoJSON
                      key={`reg-rain-${selectedCompany}`}
                      data={geojsonData}
                      style={(f) => ({
                        fillColor: f.properties?.color || '#ccc',
                        fillOpacity: 0.9,
                        weight: 0.1,
                        color: '#444'
                      })}
                    />
                  )}

                  {/* Company Boundary Marker (2x stroke weight = 5.0) */}
                  <RegionalCompanyMarker
                    bounds={ptBounds}
                    geom={ptGeom}
                    color={settings?.colors?.pt_rect || '#000000'}
                    weight={5.0}
                  />

                  {/* Coastline - Guaranteed on top in dedicated pane (zIndex 650) */}
                  <CoastlineOverlay
                    data={coastlineGeom}
                    paneName="regCoastlinePane"
                    weight={1.0}
                    opacity={1.0}
                  />
                </MapContainer>
              </div>

              {/* Pane 3: Bottom-Right Local PT Concession Outline + Badge */}
              <div className="relative overflow-hidden bg-white">
                <MapContainer
                  center={ptBounds ? ptBounds.getCenter() : [-2.8, 104.6]}
                  zoom={11}
                  zoomControl={false}
                  attributionControl={false}
                  dragging={false}
                  scrollWheelZoom={false}
                  doubleClickZoom={false}
                  className="w-full h-full bg-white"
                >
                  <LocalPtFitController ptGeom={ptGeom} paddingPct={localPaddingPct} />

                  {/* ECMWF Rainfall categorized polygons as background */}
                  {geojsonData && (
                    <GeoJSON
                      key={`local-rain-${selectedCompany}`}
                      data={geojsonData}
                      style={(f) => ({
                        fillColor: f.properties?.color || '#ccc',
                        fillOpacity: 0.9,
                        weight: 0.1,
                        color: '#444'
                      })}
                    />
                  )}

                  {/* Thick Blue Concession Outline (in localPtPane, zIndex 600) */}
                  <LocalPtOutline
                    geom={ptGeom}
                    color={settings?.colors?.pt_outline || '#0040ff'}
                    weight={3.5}
                  />

                  {/* Coastline in local view - Guaranteed on top in dedicated pane (zIndex 650) */}
                  <CoastlineOverlay
                    data={coastlineGeom}
                    paneName="localCoastlinePane"
                    weight={1.2}
                    opacity={1.0}
                  />
                </MapContainer>

                {/* White Floating Name Badge in Bottom-Right Corner */}
                <div className="absolute bottom-2 right-2 z-[1000] bg-white border-2 border-black px-5 py-1 shadow-md">
                  <span className="text-2xl font-extrabold tracking-wider text-black">
                    {selectedCompany}
                  </span>
                </div>
              </div>
            </div>
          </div>

          {/* Color Legend Bar (Exact 12 ECMWF Categories) */}
          <div className="mt-3 text-center">
            <div className="text-[11px] font-bold text-gray-900 mb-1.5">
              AIFS Single: Total accumulated precipitation (kg/m2 (mm))
            </div>

            {/* Swatches Container */}
            <div className="inline-flex flex-col items-center">
              {/* Swatch labels */}
              <div className="w-[480px] flex justify-between text-[10px] font-semibold text-gray-800 mb-0.5 px-1">
                {LEVELS.map((lvl) => (
                  <span key={lvl} className="text-center w-8">{lvl}</span>
                ))}
              </div>

              {/* Color Bar */}
              <div className="w-[480px] h-3.5 flex border border-gray-400 overflow-hidden">
                {COLORS.map((col, idx) => (
                  <div
                    key={idx}
                    className="flex-1 h-full"
                    style={{ backgroundColor: col }}
                  />
                ))}
              </div>
            </div>
          </div>

          {/* Footer Bar: Copyright, Metadata & Logo */}
          <div className="mt-4 pt-3 border-t border-gray-200 flex items-end justify-between text-[9px] text-gray-700 leading-tight">
            <div>
              <div className="font-semibold text-gray-800">
                &copy; 2026 European Centre for Medium-Range Weather Forecasts (ECMWF)
              </div>
              <div>Source: <span className="text-blue-700 underline">www.ecmwf.int</span></div>
              <div>
                Licence: <span className="text-blue-700 underline">CC BY 4.0</span> and <span className="text-blue-700 underline">ECMWF Terms of Use</span>
              </div>
              <div className="text-gray-500 font-mono mt-0.5">
                Created at {footerTimestamp}
              </div>
            </div>

            {/* ECMWF or Custom Logo */}
            <div>
              {logoData ? (
                <img
                  src={logoData}
                  alt="Organization Logo"
                  style={{ width: `${logoWidth}px`, objectFit: 'contain' }}
                />
              ) : (
                /* Official style ECMWF SVG vector logo */
                <div className="flex items-center gap-1.5" style={{ width: `${logoWidth}px` }}>
                  <svg viewBox="0 0 100 60" className="w-10 h-7 text-[#004f9f]" fill="currentColor">
                    <circle cx="30" cy="30" r="16" fill="none" stroke="currentColor" strokeWidth="4" />
                    <circle cx="45" cy="30" r="22" fill="none" stroke="currentColor" strokeWidth="3" opacity="0.8" />
                    <circle cx="60" cy="30" r="28" fill="none" stroke="currentColor" strokeWidth="2.5" opacity="0.6" />
                  </svg>
                  <span className="text-lg font-black tracking-tighter text-[#004f9f]">
                    ECMWF
                  </span>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
