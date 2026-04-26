"use client";

import { useEffect } from 'react';
import { MapContainer, TileLayer, GeoJSON, Tooltip, useMap } from 'react-leaflet';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';

// Fix Leaflet icon issue
const fixLeafletIcon = () => {
  delete L.Icon.Default.prototype._getIconUrl;
  L.Icon.Default.mergeOptions({
    iconRetinaUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon-2x.png',
    iconUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon.png',
    shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-shadow.png',
  });
};

function ChangeView({ data }) {
  const map = useMap();
  useEffect(() => {
    if (data && data.features?.length > 0) {
      const geojsonLayer = L.geoJSON(data);
      const bounds = geojsonLayer.getBounds();
      if (bounds.isValid()) {
        map.fitBounds(bounds, { padding: [50, 50], maxZoom: 14 });
      }
    }
  }, [data, map]);
  return null;
}

const getStatusColor = (status) => {
  const s = status?.toUpperCase() || '';
  if (s.includes('BANJIR')) return '#6b7280'; // Grey
  if (s === 'TERGENANG') return '#2563eb';    // Dark Blue
  if (s.includes('A. TERGENANG')) return '#60a5fa'; // Light Blue
  if (s.includes('NORMAL')) return '#22c55e'; // Green
  if (s.includes('A. KERING')) return '#f59e0b'; // Orange
  if (s.includes('KERING')) return '#ef4444'; // Red
  return '#94a3b8'; // Slate
};

export default function LeafletMap({ data, baseLayer = 'dark' }) {
  useEffect(() => {
    fixLeafletIcon();
  }, []);

  const style = (feature) => {
    return {
      fillColor: getStatusColor(feature.properties.status),
      weight: 1.5,
      opacity: 1,
      color: 'white',
      fillOpacity: baseLayer === 'satellite' ? 0.4 : 0.7
    };
  };

  const onEachFeature = (feature, layer) => {
    const props = feature.properties;
    layer.bindPopup(`
      <div class="p-2 min-w-[150px]">
        <h3 class="font-bold text-gray-900 border-b pb-1 mb-1">${props.pie_record_id}</h3>
        <div class="space-y-1 text-[11px]">
          <div class="flex justify-between">
            <span class="text-gray-500">Estate:</span>
            <span class="font-bold">${props.est_code}</span>
          </div>
          <div class="flex justify-between">
            <span class="text-gray-500">TMAT:</span>
            <span class="font-bold" style="color: ${getStatusColor(props.status)}">${props.tmat !== null ? props.tmat + ' cm' : 'N/A'}</span>
          </div>
          <div class="flex justify-between">
            <span class="text-gray-500">Status:</span>
            <span class="font-bold uppercase" style="color: ${getStatusColor(props.status)}">${props.status || 'Unknown'}</span>
          </div>
          <div class="mt-2 pt-1 border-t text-[9px] text-gray-400 italic">
            Update: ${props.last_update}
          </div>
        </div>
      </div>
    `);

    layer.bindTooltip(`
      <div class="font-bold text-[10px]">${props.pie_record_id}</div>
      <div class="text-[9px] opacity-80">${props.status || 'N/A'}</div>
    `, { sticky: true, direction: 'top', opacity: 0.9 });

    layer.on({
      mouseover: (e) => {
        const l = e.target;
        l.setStyle({ fillOpacity: 0.9, weight: 3 });
      },
      mouseout: (e) => {
        const l = e.target;
        l.setStyle({ fillOpacity: baseLayer === 'satellite' ? 0.4 : 0.7, weight: 1.5 });
      }
    });
  };

  return (
    <MapContainer 
      center={[-0.5, 101.5]} 
      zoom={11} 
      style={{ height: '100%', width: '100%', borderRadius: '1rem' }}
    >
      {baseLayer === 'dark' ? (
        <TileLayer
          key="dark-layer"
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors &copy; <a href="https://carto.com/attributions">CARTO</a>'
          url="https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png"
        />
      ) : (
        <TileLayer
          key="satellite-layer"
          attribution='Tiles &copy; Esri &mdash; Source: Esri, i-cubed, USDA, USGS, AEX, GeoEye, Getmapping, Aerogrid, IGN, IGP, UPR-EBP, and the GIS User Community'
          url="https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}"
        />
      )}
      
      {data && (
        <GeoJSON 
          key={JSON.stringify(data.features?.length) + (data.features?.[0]?.properties?.last_update || '') + baseLayer} 
          data={data} 
          style={style} 
          onEachFeature={onEachFeature}
        />
      )}
      <ChangeView data={data} />
    </MapContainer>
  );
}
