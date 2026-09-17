"use client";

import { useEffect, useRef, useState, useMemo } from 'react';
import dynamic from 'next/dynamic';
import { Download, FileText, Loader2, Maximize2, RefreshCw } from 'lucide-react';
import { domToPng } from 'modern-screenshot';
import jsPDF from 'jspdf';

// Dynamic import for Leaflet maps to prevent SSR issues
const MapContainer = dynamic(() => import('react-leaflet').then(mod => mod.MapContainer), { ssr: false });
const GeoJSON = dynamic(() => import('react-leaflet').then(mod => mod.GeoJSON), { ssr: false });
const Rectangle = dynamic(() => import('react-leaflet').then(mod => mod.Rectangle), { ssr: false });
const useMap = dynamic(() => import('react-leaflet').then(mod => mod.useMap), { ssr: false });

// 12-level ECMWF palette
const LEVELS = [0.1, 1, 2, 5, 10, 15, 20, 30, 40, 50, 100, 300, 1000];
const COLORS = [
  "#e6d7b6", "#a8e89a", "#72e467", "#addbe6", "#78addf", "#4e92df",
  "#2f6ee8", "#e9d96c", "#f7a600", "#ff0d0d", "#a32323", "#ef23ff"
];

// Fallback boundaries for default 5 PTs if user hasn't uploaded custom GIS yet
const DEFAULT_PT_COORDS = {
  'SIP': [
    [0.15, 101.85], [0.15, 102.15], [0.35, 102.15], [0.35, 102.25], 
    [0.25, 102.25], [0.25, 102.35], [0.05, 102.35], [0.05, 102.05], 
    [-0.05, 102.05], [-0.05, 101.85]
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

// Component to dynamically fit map bounds inside Leaflet
function MapController({ bounds, padding = [10, 10] }) {
  const map = useMap();
  useEffect(() => {
    if (bounds && map) {
      try {
        map.fitBounds(bounds, { padding, animate: false });
        map.invalidateSize();
      } catch (e) {
        console.error('Fit bounds error:', e);
      }
    }
  }, [bounds, map, padding]);
  return null;
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

  // Settings with defaults
  const regionalBufferKm = Number(settings.regional_buffer_km) || 150;
  const localPaddingPct = Number(settings.local_padding_pct) || 20;
  const logoData = settings.logo_data || null;
  const logoWidth = Number(settings.logo_width_px) || 130;
  const colors = settings.colors || {
    water: '#9fc5e8',
    land: '#e4decb',
    pt_outline: '#0040ff',
    pt_rect: '#e60000'
  };

  // Fetch PT geometry from DB or use default coords
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
            // Build polygon GeoJSON from default coordinates
            const coords = DEFAULT_PT_COORDS[selectedCompany] || DEFAULT_PT_COORDS['SIP'];
            // GeoJSON expects [lon, lat]
            const lonLat = coords.map(([lat, lon]) => [lon, lat]);
            lonLat.push(lonLat[0]); // close polygon
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

  // Calculate Bounding Box of selected PT
  const ptBBox = useMemo(() => {
    if (!ptGeom?.features?.length) {
      const coords = DEFAULT_PT_COORDS[selectedCompany] || DEFAULT_PT_COORDS['SIP'];
      const lats = coords.map(c => c[0]);
      const lons = coords.map(c => c[1]);
      return {
        minLat: Math.min(...lats),
        maxLat: Math.max(...lats),
        minLon: Math.min(...lons),
        maxLon: Math.max(...lons)
      };
    }

    let minLat = 90, maxLat = -90, minLon = 180, maxLon = -180;
    function scanCoords(arr) {
      if (typeof arr[0] === 'number') {
        const [lon, lat] = arr;
        if (lat < minLat) minLat = lat;
        if (lat > maxLat) maxLat = lat;
        if (lon < minLon) minLon = lon;
        if (lon > maxLon) maxLon = lon;
      } else {
        arr.forEach(scanCoords);
      }
    }
    ptGeom.features.forEach(f => {
      if (f.geometry?.coordinates) scanCoords(f.geometry.coordinates);
    });

    return { minLat, maxLat, minLon, maxLon };
  }, [ptGeom, selectedCompany]);

  // Macro Extent: SE Asia & Indonesia [lon 90-141, lat -12 to 24]
  const macroBounds = useMemo(() => [
    [-12, 90],
    [24, 141]
  ], []);

  // Regional Extent: PT Bounding Box + buffer km (1 deg lat ≈ 111 km)
  const regionalBounds = useMemo(() => {
    const bufferDeg = regionalBufferKm / 111;
    return [
      [ptBBox.minLat - bufferDeg, ptBBox.minLon - bufferDeg * 1.2],
      [ptBBox.maxLat + bufferDeg, ptBBox.maxLon + bufferDeg * 1.2]
    ];
  }, [ptBBox, regionalBufferKm]);

  // Local Extent: PT Concession + padding %
  const localBounds = useMemo(() => {
    const latSpan = Math.max(0.05, ptBBox.maxLat - ptBBox.minLat);
    const lonSpan = Math.max(0.05, ptBBox.maxLon - ptBBox.minLon);
    const padLat = latSpan * (localPaddingPct / 100);
    const padLon = lonSpan * (localPaddingPct / 100);
    return [
      [ptBBox.minLat - padLat, ptBBox.minLon - padLon],
      [ptBBox.maxLat + padLat, ptBBox.maxLon + padLon]
    ];
  }, [ptBBox, localPaddingPct]);

  // Rectangle bounds for Red PT Indicator Box
  const ptRectBounds = useMemo(() => [
    [ptBBox.minLat, ptBBox.minLon],
    [ptBBox.maxLat, ptBBox.maxLon]
  ], [ptBBox]);

  // Date strings formatting for Header & Footer
  const headerDates = useMemo(() => {
    const d = new Date(forecastDate + 'T00:00:00Z');
    const days = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
    const months = ['Jan', 'Feb', 'Mar', 'Sep', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
    
    // Base time: e.g. Wed 16 Sep 2026 00 UTC
    const baseDay = days[d.getUTCDay()];
    const baseDate = d.getUTCDate();
    const baseMonth = months[d.getUTCMonth()];
    const baseYear = d.getUTCFullYear();
    const baseStr = `Base time: ${baseDay} ${baseDate} ${baseMonth} ${baseYear} 00 UTC`;

    // Valid time (+162h = 6 days + 18h)
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
      link.download = `ECMWF_AIFS_${selectedCompany}_${forecastDate}.png`;
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

      // A4 dimensions: 297mm x 210mm
      pdf.addImage(dataUrl, 'PNG', 0, 0, 297, 210, undefined, 'FAST');
      pdf.save(`ECMWF_AIFS_${selectedCompany}_${forecastDate}.pdf`);
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
            className="px-3 py-2 text-sm font-semibold bg-gray-50 border border-gray-300 rounded-xl focus:ring-2 focus:ring-blue-500 focus:outline-none transition-all shadow-xs"
          >
            {companyList.map(c => (
              <option key={c} value={c}>{c}</option>
            ))}
          </select>
          <span className="text-xs text-gray-400">
            (Menyesuaikan 2 peta di kanan)
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

      {/* Main Poster Container (Styled exactly like official ECMWF Bulletin) */}
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
            className="grid grid-cols-12 border-2 border-black" 
            style={{ height: '510px' }}
          >
            {/* Pane 1: Macro View (Southeast Asia & Indonesia) */}
            <div 
              className="col-span-7 border-r-2 border-black relative overflow-hidden" 
              style={{ backgroundColor: colors.water }}
            >
              <MapContainer
                bounds={macroBounds}
                zoomControl={false}
                attributionControl={false}
                dragging={false}
                scrollWheelZoom={false}
                doubleClickZoom={false}
                className="w-full h-full"
                style={{ backgroundColor: colors.water }}
              >
                <MapController bounds={macroBounds} padding={[0, 0]} />

                {/* Rainfall categorized polygons */}
                {geojsonData && (
                  <GeoJSON
                    key={`macro-rain-${JSON.stringify(geojsonData).slice(0, 40)}`}
                    data={geojsonData}
                    style={(f) => ({
                      fillColor: f.properties?.color || '#ccc',
                      fillOpacity: 0.85,
                      weight: 0.1,
                      color: '#444'
                    })}
                  />
                )}

                {/* Black Coastline */}
                {coastlineGeom && (
                  <GeoJSON
                    key="macro-coastline"
                    data={coastlineGeom}
                    style={{
                      fillColor: 'transparent',
                      weight: 0.7,
                      color: '#000',
                      opacity: 0.9
                    }}
                  />
                )}
              </MapContainer>
            </div>

            {/* Right Column: 2 Panes (Regional Zoom & Local Concession) */}
            <div className="col-span-5 grid grid-rows-2 h-full">
              {/* Pane 2: Top-Right Regional Zoom with Red PT Indicator Box */}
              <div 
                className="border-b-2 border-black relative overflow-hidden" 
                style={{ backgroundColor: colors.water }}
              >
                <MapContainer
                  bounds={regionalBounds}
                  zoomControl={false}
                  attributionControl={false}
                  dragging={false}
                  scrollWheelZoom={false}
                  doubleClickZoom={false}
                  className="w-full h-full"
                  style={{ backgroundColor: colors.water }}
                >
                  <MapController bounds={regionalBounds} padding={[5, 5]} />

                  {/* Rainfall polygons */}
                  {geojsonData && (
                    <GeoJSON
                      key={`reg-rain-${JSON.stringify(geojsonData).slice(0, 40)}`}
                      data={geojsonData}
                      style={(f) => ({
                        fillColor: f.properties?.color || '#ccc',
                        fillOpacity: 0.85,
                        weight: 0.1,
                        color: '#444'
                      })}
                    />
                  )}

                  {/* Coastline */}
                  {coastlineGeom && (
                    <GeoJSON
                      key="reg-coastline"
                      data={coastlineGeom}
                      style={{
                        fillColor: 'transparent',
                        weight: 0.8,
                        color: '#000',
                        opacity: 0.95
                      }}
                    />
                  )}

                  {/* Red Solid Rectangle Bounding Box of selected PT */}
                  <Rectangle
                    bounds={ptRectBounds}
                    pathOptions={{
                      color: colors.pt_rect || '#e60000',
                      weight: 2,
                      fillColor: colors.pt_rect || '#e60000',
                      fillOpacity: 0.75
                    }}
                  />
                </MapContainer>
              </div>

              {/* Pane 3: Bottom-Right Local PT Concession Outline + Badge */}
              <div 
                className="relative overflow-hidden" 
                style={{ backgroundColor: colors.water }}
              >
                <MapContainer
                  bounds={localBounds}
                  zoomControl={false}
                  attributionControl={false}
                  dragging={false}
                  scrollWheelZoom={false}
                  doubleClickZoom={false}
                  className="w-full h-full"
                  style={{ backgroundColor: colors.water }}
                >
                  <MapController bounds={localBounds} padding={[15, 15]} />

                  {/* Coastline in local view */}
                  {coastlineGeom && (
                    <GeoJSON
                      key="local-coastline"
                      data={coastlineGeom}
                      style={{
                        fillColor: colors.land,
                        fillOpacity: 0.9,
                        weight: 1.0,
                        color: '#000',
                        opacity: 1
                      }}
                    />
                  )}

                  {/* Thick Blue Concession Outline */}
                  {ptGeom && (
                    <GeoJSON
                      key={`local-pt-${selectedCompany}`}
                      data={ptGeom}
                      style={{
                        fillColor: '#0040ff',
                        fillOpacity: 0.08,
                        weight: 2.8,
                        color: colors.pt_outline || '#0040ff',
                        opacity: 1
                      }}
                    />
                  )}
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
