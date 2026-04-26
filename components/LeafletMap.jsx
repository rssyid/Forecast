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

function ChangeView({ center, zoom }) {
  const map = useMap();
  useEffect(() => {
    if (center) map.setView(center, zoom);
  }, [center, zoom, map]);
  return null;
}

const getStatusColor = (status) => {
  switch (status?.toLowerCase()) {
    case 'banjir': return '#ef4444'; // red-500
    case 'kering': return '#f59e0b'; // amber-500
    case 'normal': return '#10b981'; // emerald-500
    default: return '#94a3b8'; // slate-400
  }
};

export default function LeafletMap({ data, center, zoom }) {
  useEffect(() => {
    fixLeafletIcon();
  }, []);

  const style = (feature) => {
    return {
      fillColor: getStatusColor(feature.properties.status),
      weight: 1.5,
      opacity: 1,
      color: 'white',
      fillOpacity: 0.7
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
            <span class="font-bold ${getStatusColor(props.status)}">${props.tmat !== null ? props.tmat + ' cm' : 'N/A'}</span>
          </div>
          <div class="flex justify-between">
            <span class="text-gray-500">Status:</span>
            <span class="font-bold uppercase">${props.status || 'Unknown'}</span>
          </div>
          <div class="mt-2 pt-1 border-t text-[9px] text-gray-400 italic">
            Update: ${props.last_update}
          </div>
        </div>
      </div>
    `);

    layer.on({
      mouseover: (e) => {
        const l = e.target;
        l.setStyle({ fillOpacity: 0.9, weight: 3 });
      },
      mouseout: (e) => {
        const l = e.target;
        l.setStyle({ fillOpacity: 0.7, weight: 1.5 });
      }
    });
  };

  return (
    <MapContainer 
      center={center || [-0.5, 101.5]} 
      zoom={zoom || 11} 
      style={{ height: '100%', width: '100%', borderRadius: '1rem' }}
    >
      <TileLayer
        attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors &copy; <a href="https://carto.com/attributions">CARTO</a>'
        url="https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png"
      />
      {data && (
        <GeoJSON 
          key={JSON.stringify(data.features?.length)} 
          data={data} 
          style={style} 
          onEachFeature={onEachFeature}
        />
      )}
      <ChangeView center={center} zoom={zoom} />
    </MapContainer>
  );
}
