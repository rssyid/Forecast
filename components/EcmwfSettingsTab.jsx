"use client";

import { useState } from 'react';
import { Upload, Save, Check, AlertCircle, Loader2, Image as ImageIcon, Sliders, MapPin, Eye } from 'lucide-react';

export default function EcmwfSettingsTab({
  settings = {},
  onSettingsSaved,
  availableCompanies = ['SIP', 'THIP', 'JJP', 'KALBAR A', 'KALBAR B']
}) {
  // Local state for settings form
  const [regionalBufferKm, setRegionalBufferKm] = useState(settings.regional_buffer_km || 150);
  const [localPaddingPct, setLocalPaddingPct] = useState(settings.local_padding_pct || 20);
  const [logoData, setLogoData] = useState(settings.logo_data || null);
  const [logoWidthPx, setLogoWidthPx] = useState(settings.logo_width_px || 130);
  const [colors, setColors] = useState(settings.colors || {
    water: '#9fc5e8',
    land: '#e4decb',
    pt_outline: '#0040ff',
    pt_rect: '#000000'
  });
  const [selectedCompanies, setSelectedCompanies] = useState(
    settings.selected_companies || ['SIP', 'THIP', 'JJP', 'KALBAR A', 'KALBAR B']
  );

  // Status states
  const [saving, setSaving] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState(false);
  const [ptUploadStatus, setPtUploadStatus] = useState(null);
  const [coastlineUploadStatus, setCoastlineUploadStatus] = useState(null);
  const [uploadingPt, setUploadingPt] = useState(false);
  const [uploadingCoastline, setUploadingCoastline] = useState(false);

  // Handle GIS file upload: PT boundaries
  const handlePtUpload = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setUploadingPt(true);
    setPtUploadStatus(null);

    try {
      const text = await file.text();
      const geojson = JSON.parse(text);

      const res = await fetch('/api/ecmwf-gis', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          layer_type: 'pt_boundaries',
          geojson
        })
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Gagal mengunggah layer PT');

      setPtUploadStatus({
        success: true,
        message: `Berhasil menyimpan ${data.feature_count} fitur untuk PT: ${data.companies.join(', ')}`
      });

      // Automatically add new companies to selected list if not present
      const combined = Array.from(new Set([...selectedCompanies, ...data.companies]));
      setSelectedCompanies(combined);
    } catch (err) {
      setPtUploadStatus({
        success: false,
        message: err.message
      });
    } finally {
      setUploadingPt(false);
    }
  };

  // Handle GIS file upload: Coastline
  const handleCoastlineUpload = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setUploadingCoastline(true);
    setCoastlineUploadStatus(null);

    try {
      const text = await file.text();
      const geojson = JSON.parse(text);

      const res = await fetch('/api/ecmwf-gis', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          layer_type: 'coastline',
          geojson
        })
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Gagal mengunggah coastline');

      setCoastlineUploadStatus({
        success: true,
        message: 'Garis pantai (coastline) berhasil diperbarui di database!'
      });
    } catch (err) {
      setCoastlineUploadStatus({
        success: false,
        message: err.message
      });
    } finally {
      setUploadingCoastline(false);
    }
  };

  // Handle Logo Upload (converts to Base64)
  const handleLogoUpload = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (ev) => {
      setLogoData(ev.target.result);
    };
    reader.readAsDataURL(file);
  };

  // Save Settings
  const handleSaveSettings = async () => {
    setSaving(true);
    setSaveSuccess(false);

    try {
      const payload = {
        selected_companies: selectedCompanies,
        regional_buffer_km: Number(regionalBufferKm),
        local_padding_pct: Number(localPaddingPct),
        logo_data: logoData,
        logo_width_px: Number(logoWidthPx),
        colors
      };

      const res = await fetch('/api/ecmwf-settings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Gagal menyimpan pengaturan');

      setSaveSuccess(true);
      if (onSettingsSaved) onSettingsSaved(data.settings);
      setTimeout(() => setSaveSuccess(false), 4000);
    } catch (err) {
      alert('Error: ' + err.message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Top Banner */}
      <div className="bg-white/80 backdrop-blur-sm p-6 rounded-2xl border border-gray-200/80 shadow-sm flex flex-wrap items-center justify-between gap-4">
        <div>
          <h2 className="text-lg font-bold text-gray-900 flex items-center gap-2">
            <Sliders size={20} className="text-blue-600" />
            Pengaturan Bulletin & Layer GIS
          </h2>
          <p className="text-xs text-gray-500 mt-1">
            Unggah data spasial GeoJSON (batas PT & garis pantai) serta sesuaikan parameter kartografi bulletin.
          </p>
        </div>

        <button
          onClick={handleSaveSettings}
          disabled={saving}
          className="flex items-center gap-2 px-5 py-2.5 bg-blue-600 hover:bg-blue-700 active:scale-95 text-white text-xs font-bold rounded-xl shadow-md transition-all cursor-pointer disabled:opacity-50"
        >
          {saving ? <Loader2 size={16} className="animate-spin" /> : saveSuccess ? <Check size={16} /> : <Save size={16} />}
          {saveSuccess ? 'Tersimpan!' : 'Simpan Pengaturan'}
        </button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Card 1: Upload GIS Layers */}
        <div className="bg-white/80 backdrop-blur-sm p-6 rounded-2xl border border-gray-200/80 shadow-sm space-y-5">
          <h3 className="text-sm font-bold text-gray-900 flex items-center gap-2 uppercase tracking-wider">
            <MapPin size={16} className="text-blue-600" />
            1. Upload Layer GIS
          </h3>

          {/* PT Boundaries Upload */}
          <div className="space-y-2">
            <label className="block text-xs font-bold text-gray-700">
              GeoJSON Batas Konsesi PT (Multi-PT)
            </label>
            <p className="text-[11px] text-gray-500">
              Menerima file <code className="bg-gray-100 px-1 py-0.5 rounded text-gray-700">.geojson</code> gabungan. Properti yang dikenali otomatis: <code className="text-blue-600">company_code</code>, <code className="text-blue-600">company</code>, atau <code className="text-blue-600">pt_name</code>.
            </p>
            <div className="flex items-center gap-3">
              <label className="flex-1 flex items-center justify-center gap-2 px-4 py-3 bg-gray-50 hover:bg-gray-100 border border-dashed border-gray-300 rounded-xl text-xs font-semibold text-gray-600 cursor-pointer transition-colors">
                {uploadingPt ? <Loader2 size={16} className="animate-spin text-blue-600" /> : <Upload size={16} className="text-blue-600" />}
                <span>{uploadingPt ? 'Mengunggah & Memproses...' : 'Pilih File GeoJSON PT'}</span>
                <input
                  type="file"
                  accept=".geojson,.json"
                  onChange={handlePtUpload}
                  className="hidden"
                  disabled={uploadingPt}
                />
              </label>
            </div>
            {ptUploadStatus && (
              <div className={`p-3 rounded-xl text-xs flex items-start gap-2 ${ptUploadStatus.success ? 'bg-green-50 text-green-700 border border-green-200' : 'bg-red-50 text-red-700 border border-red-200'}`}>
                {ptUploadStatus.success ? <Check size={15} className="shrink-0 mt-0.5" /> : <AlertCircle size={15} className="shrink-0 mt-0.5" />}
                <span>{ptUploadStatus.message}</span>
              </div>
            )}
          </div>

          <hr className="border-gray-100" />

          {/* Coastline Upload */}
          <div className="space-y-2">
            <label className="block text-xs font-bold text-gray-700">
              GeoJSON Garis Pantai (Coastline)
            </label>
            <p className="text-[11px] text-gray-500">
              Unggah garis pantai resolusi tinggi kepulauan Indonesia untuk overlay hitam tajam di atas peta.
            </p>
            <div className="flex items-center gap-3">
              <label className="flex-1 flex items-center justify-center gap-2 px-4 py-3 bg-gray-50 hover:bg-gray-100 border border-dashed border-gray-300 rounded-xl text-xs font-semibold text-gray-600 cursor-pointer transition-colors">
                {uploadingCoastline ? <Loader2 size={16} className="animate-spin text-blue-600" /> : <Upload size={16} className="text-blue-600" />}
                <span>{uploadingCoastline ? 'Mengunggah...' : 'Pilih File GeoJSON Coastline'}</span>
                <input
                  type="file"
                  accept=".geojson,.json"
                  onChange={handleCoastlineUpload}
                  className="hidden"
                  disabled={uploadingCoastline}
                />
              </label>
            </div>
            {coastlineUploadStatus && (
              <div className={`p-3 rounded-xl text-xs flex items-start gap-2 ${coastlineUploadStatus.success ? 'bg-green-50 text-green-700 border border-green-200' : 'bg-red-50 text-red-700 border border-red-200'}`}>
                {coastlineUploadStatus.success ? <Check size={15} className="shrink-0 mt-0.5" /> : <AlertCircle size={15} className="shrink-0 mt-0.5" />}
                <span>{coastlineUploadStatus.message}</span>
              </div>
            )}
          </div>
        </div>

        {/* Card 2: Extent Zoom & Buffer Settings */}
        <div className="bg-white/80 backdrop-blur-sm p-6 rounded-2xl border border-gray-200/80 shadow-sm space-y-5">
          <h3 className="text-sm font-bold text-gray-900 flex items-center gap-2 uppercase tracking-wider">
            <Sliders size={16} className="text-blue-600" />
            2. Aturan Zoom 2 Jendela Kanan
          </h3>

          {/* Regional Buffer Slider */}
          <div className="space-y-2">
            <div className="flex justify-between items-center">
              <label className="text-xs font-bold text-gray-700">
                Peta Kanan Atas: Buffer Regional
              </label>
              <span className="text-xs font-mono font-bold text-blue-600 bg-blue-50 px-2 py-0.5 rounded-md border border-blue-100">
                {regionalBufferKm} km
              </span>
            </div>
            <p className="text-[11px] text-gray-500">
              Jarak batas luar sekitar PT untuk menampilkan konteks pulau/provinsi dan pola curah hujan regional.
            </p>
            <input
              type="range"
              min="50"
              max="400"
              step="10"
              value={regionalBufferKm}
              onChange={(e) => setRegionalBufferKm(e.target.value)}
              className="w-full accent-blue-600 cursor-pointer"
            />
            <div className="flex justify-between text-[10px] text-gray-400">
              <span>50 km (Lebih Dekat)</span>
              <span>200 km (Sedang)</span>
              <span>400 km (Lebar)</span>
            </div>
          </div>

          <hr className="border-gray-100" />

          {/* Local Concession Padding Slider */}
          <div className="space-y-2">
            <div className="flex justify-between items-center">
              <label className="text-xs font-bold text-gray-700">
                Peta Kanan Bawah: FitBounds Padding
              </label>
              <span className="text-xs font-mono font-bold text-blue-600 bg-blue-50 px-2 py-0.5 rounded-md border border-blue-100">
                {localPaddingPct}%
              </span>
            </div>
            <p className="text-[11px] text-gray-500">
              Margin ruang kosong di sekeliling outline batas biru konsesi PT.
            </p>
            <input
              type="range"
              min="5"
              max="60"
              step="5"
              value={localPaddingPct}
              onChange={(e) => setLocalPaddingPct(e.target.value)}
              className="w-full accent-blue-600 cursor-pointer"
            />
            <div className="flex justify-between text-[10px] text-gray-400">
              <span>5% (Ketat)</span>
              <span>20% (Standar)</span>
              <span>60% (Leluasa)</span>
            </div>
          </div>
        </div>

        {/* Card 3: Custom Colors */}
        <div className="bg-white/80 backdrop-blur-sm p-6 rounded-2xl border border-gray-200/80 shadow-sm space-y-4">
          <h3 className="text-sm font-bold text-gray-900 flex items-center gap-2 uppercase tracking-wider">
            <Eye size={16} className="text-blue-600" />
            3. Palet Warna Kartografi
          </h3>

          <div className="grid grid-cols-2 gap-4 text-xs">
            <div>
              <label className="block text-gray-600 font-semibold mb-1">Warna Air / Laut</label>
              <div className="flex items-center gap-2">
                <input
                  type="color"
                  value={colors.water}
                  onChange={(e) => setColors({ ...colors, water: e.target.value })}
                  className="w-8 h-8 rounded-lg cursor-pointer border border-gray-300"
                />
                <span className="font-mono text-gray-700">{colors.water}</span>
              </div>
            </div>

            <div>
              <label className="block text-gray-600 font-semibold mb-1">Warna Daratan (Lokal)</label>
              <div className="flex items-center gap-2">
                <input
                  type="color"
                  value={colors.land}
                  onChange={(e) => setColors({ ...colors, land: e.target.value })}
                  className="w-8 h-8 rounded-lg cursor-pointer border border-gray-300"
                />
                <span className="font-mono text-gray-700">{colors.land}</span>
              </div>
            </div>

            <div>
              <label className="block text-gray-600 font-semibold mb-1">Garis Batas PT (Kanan Bawah)</label>
              <div className="flex items-center gap-2">
                <input
                  type="color"
                  value={colors.pt_outline}
                  onChange={(e) => setColors({ ...colors, pt_outline: e.target.value })}
                  className="w-8 h-8 rounded-lg cursor-pointer border border-gray-300"
                />
                <span className="font-mono text-gray-700">{colors.pt_outline}</span>
              </div>
            </div>

            <div>
              <label className="block text-gray-600 font-semibold mb-1">Kotak Penanda PT (Kanan Atas)</label>
              <div className="flex items-center gap-2">
                <input
                  type="color"
                  value={colors.pt_rect}
                  onChange={(e) => setColors({ ...colors, pt_rect: e.target.value })}
                  className="w-8 h-8 rounded-lg cursor-pointer border border-gray-300"
                />
                <span className="font-mono text-gray-700">{colors.pt_rect}</span>
              </div>
            </div>
          </div>
        </div>

        {/* Card 4: Custom Logo & Sizing */}
        <div className="bg-white/80 backdrop-blur-sm p-6 rounded-2xl border border-gray-200/80 shadow-sm space-y-4">
          <h3 className="text-sm font-bold text-gray-900 flex items-center gap-2 uppercase tracking-wider">
            <ImageIcon size={16} className="text-blue-600" />
            4. Logo Footer Bulletin
          </h3>

          <div className="space-y-3">
            <p className="text-[11px] text-gray-500">
              Ganti logo ECMWF bawaan dengan logo perusahaan Anda (format PNG/SVG transparan direkomendasikan).
            </p>

            <div className="flex items-center gap-4">
              <div className="w-24 h-16 bg-gray-50 border border-gray-200 rounded-xl flex items-center justify-center p-2 overflow-hidden">
                {logoData ? (
                  <img src={logoData} alt="Preview" className="max-w-full max-h-full object-contain" />
                ) : (
                  <span className="text-[10px] font-bold text-[#004f9f]">ECMWF</span>
                )}
              </div>

              <div className="flex-1 space-y-2">
                <label className="inline-block px-3 py-1.5 bg-gray-100 hover:bg-gray-200 text-gray-700 text-xs font-semibold rounded-lg cursor-pointer transition-colors">
                  Pilih File Logo
                  <input type="file" accept="image/*" onChange={handleLogoUpload} className="hidden" />
                </label>
                {logoData && (
                  <button
                    onClick={() => setLogoData(null)}
                    className="block text-[10px] text-red-600 hover:underline cursor-pointer"
                  >
                    Reset ke Logo ECMWF
                  </button>
                )}
              </div>
            </div>

            {/* Logo Width Slider */}
            <div className="space-y-1 pt-2">
              <div className="flex justify-between items-center text-xs">
                <span className="font-semibold text-gray-700">Lebar Logo:</span>
                <span className="font-mono font-bold text-gray-600">{logoWidthPx} px</span>
              </div>
              <input
                type="range"
                min="80"
                max="220"
                step="5"
                value={logoWidthPx}
                onChange={(e) => setLogoWidthPx(e.target.value)}
                className="w-full accent-blue-600 cursor-pointer"
              />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
