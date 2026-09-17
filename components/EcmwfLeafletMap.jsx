"use client";

import { useEffect, useRef, useState } from 'react';
import { MapContainer, TileLayer, GeoJSON, useMap } from 'react-leaflet';
import 'leaflet/dist/leaflet.css';

// Tile layer URLs
const TILES = {
  dark: 'https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png',
  light: 'https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png',
  satellite: 'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}',
};

// Auto-fit map bounds to GeoJSON data
function FitBounds({ data }) {
  const map = useMap();
  useEffect(() => {
    if (data && data.features && data.features.length > 0) {
      const L = require('leaflet');
      const layer = L.geoJSON(data);
      const bounds = layer.getBounds();
      if (bounds.isValid()) {
        map.fitBounds(bounds, { padding: [20, 20] });
      }
    }
  }, [data, map]);
  return null;
}

export default function EcmwfLeafletMap({ data, baseLayer = 'dark' }) {
  const geoJsonRef = useRef(null);

  // Style each feature based on its 'color' property
  const styleFeature = (feature) => ({
    fillColor: feature.properties?.color || '#ccc',
    fillOpacity: 0.7,
    weight: 0.5,
    color: '#333',
    opacity: 0.4,
  });

  // Popup content for each feature
  const onEachFeature = (feature, layer) => {
    const p = feature.properties;
    if (p) {
      const popup = `
        <div style="font-family: sans-serif; font-size: 13px; min-width: 160px;">
          <div style="font-weight: 600; margin-bottom: 6px; color: #1a1a1a;">
            Curah Hujan Forecast
          </div>
          <div style="display: flex; align-items: center; gap: 8px; margin-bottom: 4px;">
            <span style="display: inline-block; width: 14px; height: 14px; border-radius: 3px; background: ${p.color || '#ccc'}; border: 1px solid #00000030;"></span>
            <span style="font-weight: 500;">${p.cat_lbl || '-'}</span>
            <span style="color: #666;">mm</span>
          </div>
          ${p.min_mm !== undefined ? `<div style="color: #888; font-size: 11px;">Min: ${p.min_mm} mm</div>` : ''}
        </div>
      `;
      layer.bindPopup(popup);
    }

    layer.on({
      mouseover: (e) => {
        e.target.setStyle({ weight: 2, color: '#fff', fillOpacity: 0.9 });
        e.target.bringToFront();
      },
      mouseout: (e) => {
        if (geoJsonRef.current) {
          geoJsonRef.current.resetStyle(e.target);
        }
      },
    });
  };

  return (
    <MapContainer
      center={[-2, 115]}
      zoom={5}
      className="w-full h-full rounded-xl"
      style={{ minHeight: '500px' }}
    >
      <TileLayer
        url={TILES[baseLayer] || TILES.dark}
        attribution='&copy; <a href="https://carto.com/">CARTO</a>'
      />
      {data && data.features && data.features.length > 0 && (
        <GeoJSON
          key={JSON.stringify(data).slice(0, 100)}
          ref={geoJsonRef}
          data={data}
          style={styleFeature}
          onEachFeature={onEachFeature}
        />
      )}
      <FitBounds data={data} />
    </MapContainer>
  );
}
