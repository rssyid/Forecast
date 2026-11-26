"use client";

import { useCallback, useEffect, useState, type KeyboardEvent } from 'react';
import Link from 'next/link';
import { ArrowLeft, Printer, RefreshCw } from 'lucide-react';
import { formatWibDateTimeId } from '@/lib/analysis/date';
import type { StationDetailApiResponse } from '@/lib/types';
import DiagnosisBox from './DiagnosisBox';
import PointsTable from './PointsTable';
import RainTable from './RainTable';
import StationChart from './StationChart';
import {
  CalibrationBadge,
  DiffBadge,
  RainStatusBadge,
} from './StatusBadges';

type DetailTab = 'summary' | 'points' | 'rain';

const TABS: Array<{ id: DetailTab; label: string }> = [
  { id: 'summary', label: 'Ringkasan Stasiun' },
  { id: 'points', label: 'Titik Pengukuran' },
  { id: 'rain', label: 'Respon Hujan' },
];

export default function StationDetailClient({
  piezoId,
}: {
  piezoId: string;
}) {
  const [detail, setDetail] = useState<StationDetailApiResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<DetailTab>('summary');

  const fetchDetail = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(
        `/api/accuracy/${encodeURIComponent(piezoId)}`,
        { cache: 'no-store' }
      );
      const json = await res.json();
      if (!res.ok) {
        throw new Error(json?.error || `Data stasiun ${piezoId} gagal dimuat.`);
      }
      setDetail(json as StationDetailApiResponse);
    } catch (err) {
      setError(
        err instanceof Error ? err.message : 'Terjadi kesalahan saat memuat detail.'
      );
    } finally {
      setLoading(false);
    }
  }, [piezoId]);

  useEffect(() => {
    fetchDetail();
  }, [fetchDetail]);

  const handleTabKeyDown = (event: KeyboardEvent<HTMLButtonElement>, idx: number) => {
    if (event.key === 'ArrowRight') {
      event.preventDefault();
      setActiveTab(TABS[(idx + 1) % TABS.length].id);
    } else if (event.key === 'ArrowLeft') {
      event.preventDefault();
      setActiveTab(TABS[(idx - 1 + TABS.length) % TABS.length].id);
    }
  };

  if (loading && !detail) {
    return (
      <div aria-live="polite" className="space-y-4">
        <p className="text-sm font-medium text-gray-700">
          Memuat detail stasiun {piezoId}...
        </p>
        <div className="h-32 bg-white rounded-2xl border border-gray-200 animate-pulse" />
        <div className="h-96 bg-white rounded-2xl border border-gray-200 animate-pulse" />
      </div>
    );
  }

  if (error || !detail) {
    return (
      <div className="space-y-4">
        <Link
          href="/accuracy"
          className="min-h-11 inline-flex items-center gap-2 px-3 rounded-xl border border-gray-400 bg-white text-sm font-semibold text-gray-900 hover:bg-gray-100"
        >
          <ArrowLeft size={16} aria-hidden="true" />
          <span>Kembali ke Ringkasan</span>
        </Link>

        <div
          role="alert"
          className="bg-red-50 border border-red-300 rounded-2xl p-6 flex flex-col sm:flex-row sm:items-center justify-between gap-4"
        >
          <div>
            <h1 className="text-lg font-bold text-red-900">
              Data Stasiun Tidak Tersedia
            </h1>
            <p className="text-sm text-red-800 mt-1">
              {error || `Stasiun ${piezoId} belum ditemukan di snapshot terbaru.`}
            </p>
          </div>
          <button
            type="button"
            onClick={fetchDetail}
            className="min-h-11 inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-black text-white text-sm font-semibold hover:bg-gray-800 shrink-0"
          >
            <RefreshCw size={15} aria-hidden="true" />
            <span>Coba Lagi</span>
          </button>
        </div>
      </div>
    );
  }

  const { snapshot, points, rain_events, series_iot, series_rain } = detail;

  return (
    <div className="space-y-5 print:space-y-3">
      {/* Screen Header */}
      <header className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 print:hidden">
        <div className="flex flex-wrap items-center gap-3">
          <Link
            href="/accuracy"
            className="min-h-11 inline-flex items-center gap-2 px-3.5 rounded-xl border border-gray-500 bg-white text-sm font-semibold text-gray-900 hover:bg-gray-100"
          >
            <ArrowLeft size={16} aria-hidden="true" />
            <span>Kembali</span>
          </Link>
          <div>
            <h1 className="text-2xl font-bold text-gray-900 tracking-tight">
              Audit Stasiun {snapshot.piezo_id}
            </h1>
            <p className="text-xs text-gray-600">
              {snapshot.coverage} | Kebun {snapshot.kebun || '-'} | Blok{' '}
              {snapshot.block || '-'} | Periode {snapshot.period_from} s.d.{' '}
              {snapshot.period_to}
            </p>
          </div>
        </div>

        <button
          type="button"
          onClick={() => window.print()}
          className="min-h-11 inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-black text-white text-sm font-semibold hover:bg-gray-800"
        >
          <Printer size={16} aria-hidden="true" />
          <span>Cetak / Simpan PDF</span>
        </button>
      </header>

      {/* Print-only Compact Header */}
      <div className="hidden print:flex items-center justify-between border-b-2 border-gray-800 pb-2">
        <div>
          <h1 className="text-base font-bold text-gray-900">
            AUDIT ANOMALI & AKURASI TMAT: {snapshot.piezo_id} ({snapshot.kebun} / {snapshot.block})
          </h1>
          <p className="text-xs text-gray-700">
            Coverage: {snapshot.coverage} | Periode: {snapshot.period_from} s.d. {snapshot.period_to}
          </p>
        </div>
        <div className="text-right text-xs text-gray-700">
          Diperbarui: {formatWibDateTimeId(snapshot.created_at)} WIB
        </div>
      </div>

      {/* Station Identity Card */}
      <section
        aria-label="Identitas stasiun piezometer"
        className="bg-white rounded-2xl border border-gray-200 p-4 sm:p-5 print:p-3 shadow-xs print-avoid-break"
      >
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 print:gap-2 text-xs sm:text-sm">
          <div>
            <span className="text-xs text-gray-600 block">Piezometer ID</span>
            <span className="font-bold text-gray-900">{snapshot.piezo_id}</span>
          </div>
          <div>
            <span className="text-xs text-gray-600 block">Kebun / Blok</span>
            <span className="font-semibold text-gray-900">
              {snapshot.kebun || '-'} / {snapshot.block || '-'}
            </span>
          </div>
          <div>
            <span className="text-xs text-gray-600 block">Jenis UP</span>
            <span className="font-semibold text-gray-900">
              {snapshot.jenis || '-'}
            </span>
          </div>
          <div>
            <span className="text-xs text-gray-600 block">Coverage</span>
            <span className="font-semibold text-gray-900">
              {snapshot.coverage}
            </span>
          </div>
          <div>
            <span className="text-xs text-gray-600 block">ID Perangkat</span>
            <span className="font-semibold text-gray-900 tabular-nums">
              {snapshot.device_id || '-'}
            </span>
          </div>
          <div className="col-span-2 sm:col-span-1">
            <span className="text-xs text-gray-600 block">Nama Station</span>
            <span className="font-semibold text-gray-900 break-words">
              {snapshot.device_name || '-'}
            </span>
          </div>
          <div>
            <span className="text-xs text-gray-600 block">Kalibrasi Awal</span>
            <span className="font-semibold text-gray-900 tabular-nums">
              {snapshot.kalibrasi !== null ? snapshot.kalibrasi.toFixed(2) : '-'}
            </span>
          </div>
          <div>
            <span className="text-xs text-gray-600 block">Stasiun Hujan Kebun</span>
            <span className="font-semibold text-gray-900">
              {snapshot.has_rain_station
                ? snapshot.rain_station_id || `Kebun ${snapshot.kebun}`
                : 'Tidak ada di kebun ini'}
            </span>
          </div>
        </div>
      </section>

      <StationChart
        piezoId={snapshot.piezo_id}
        seriesIot={series_iot}
        seriesRain={series_rain}
        points={points}
        hasRainStation={snapshot.has_rain_station}
      />

      <DiagnosisBox
        statusKalibrasi={snapshot.status_kalibrasi}
        statusHujan={snapshot.status_hujan}
        narrative={snapshot.narrative}
      />

      {/* Interactive Tabs (Screen Only) */}
      <section aria-label="Rincian data audit" className="space-y-4 print:hidden">
        <div
          role="tablist"
          aria-label="Tab rincian audit stasiun"
          className="inline-flex flex-wrap gap-2 bg-white p-1.5 rounded-xl border border-gray-200"
        >
          {TABS.map((tab, idx) => {
            const selected = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                id={`tab-${tab.id}`}
                type="button"
                role="tab"
                aria-selected={selected}
                aria-controls={`panel-${tab.id}`}
                onClick={() => setActiveTab(tab.id)}
                onKeyDown={(e) => handleTabKeyDown(e, idx)}
                className={`min-h-11 px-4 py-2 rounded-lg text-xs sm:text-sm font-semibold transition-colors ${
                  selected
                    ? 'bg-black text-white'
                    : 'text-gray-700 hover:bg-gray-100'
                }`}
              >
                {tab.label}
                {tab.id === 'points' ? ` (${points.length})` : ''}
                {tab.id === 'rain' ? ` (${rain_events.length})` : ''}
              </button>
            );
          })}
        </div>

        <div
          id="panel-summary"
          role="tabpanel"
          aria-labelledby="tab-summary"
          hidden={activeTab !== 'summary'}
        >
          <div className="bg-white rounded-2xl border border-gray-200 p-5 grid grid-cols-2 sm:grid-cols-4 gap-4">
            <div>
              <span className="text-xs text-gray-600 block">Manual Terakhir</span>
              <span className="text-base font-bold text-gray-900 tabular-nums">
                {snapshot.latest_manual_cm !== null
                  ? `${snapshot.latest_manual_cm.toFixed(1)} cm`
                  : '-'}
              </span>
              <span className="text-[11px] text-gray-600 block">
                {formatWibDateTimeId(snapshot.latest_manual_at)}
              </span>
            </div>
            <div>
              <span className="text-xs text-gray-600 block">IoT Terakhir</span>
              <span className="text-base font-bold text-gray-900 tabular-nums">
                {snapshot.latest_iot_cm !== null
                  ? `${snapshot.latest_iot_cm.toFixed(1)} cm`
                  : '-'}
              </span>
            </div>
            <div>
              <span className="text-xs text-gray-600 block">Selisih Terakhir</span>
              <div className="mt-0.5">
                <DiffBadge
                  diffCm={snapshot.latest_diff_cm}
                  signedDiffCm={snapshot.signed_diff_cm}
                />
              </div>
            </div>
            <div>
              <span className="text-xs text-gray-600 block">Rata-rata / Maks Selisih</span>
              <span className="text-base font-bold text-gray-900 tabular-nums">
                {snapshot.avg_diff_cm !== null
                  ? `${snapshot.avg_diff_cm.toFixed(1)} / ${snapshot.max_diff_cm?.toFixed(1) ?? '-'} cm`
                  : '-'}
              </span>
            </div>
            <div className="col-span-2">
              <span className="text-xs text-gray-600 block mb-1">Status Kalibrasi</span>
              <CalibrationBadge status={snapshot.status_kalibrasi} />
            </div>
            <div className="col-span-2">
              <span className="text-xs text-gray-600 block mb-1">Status Respon Hujan</span>
              <RainStatusBadge
                status={snapshot.status_hujan}
                hasRainStation={snapshot.has_rain_station}
              />
            </div>
          </div>
        </div>

        <div
          id="panel-points"
          role="tabpanel"
          aria-labelledby="tab-points"
          hidden={activeTab !== 'points'}
        >
          <PointsTable points={points} />
        </div>

        <div
          id="panel-rain"
          role="tabpanel"
          aria-labelledby="tab-rain"
          hidden={activeTab !== 'rain'}
        >
          <RainTable
            rainEvents={rain_events}
            hasRainStation={snapshot.has_rain_station}
          />
        </div>
      </section>

      {/* Print-only compact stacked audit tables */}
      <div className="hidden print:block space-y-3">
        <div className="grid grid-cols-6 gap-2 border border-gray-300 rounded-lg p-2 text-xs">
          <div>
            <span className="text-gray-600 block">Manual Terakhir</span>
            <span className="font-bold">
              {snapshot.latest_manual_cm !== null
                ? `${snapshot.latest_manual_cm.toFixed(1)} cm`
                : '-'}
            </span>
          </div>
          <div>
            <span className="text-gray-600 block">IoT Terakhir</span>
            <span className="font-bold">
              {snapshot.latest_iot_cm !== null
                ? `${snapshot.latest_iot_cm.toFixed(1)} cm`
                : '-'}
            </span>
          </div>
          <div>
            <span className="text-gray-600 block">Selisih</span>
            <span className="font-bold">
              {snapshot.latest_diff_cm !== null
                ? `${snapshot.latest_diff_cm.toFixed(1)} cm`
                : '-'}
            </span>
          </div>
          <div>
            <span className="text-gray-600 block">Avg / Maks</span>
            <span className="font-bold">
              {snapshot.avg_diff_cm !== null
                ? `${snapshot.avg_diff_cm.toFixed(1)} / ${snapshot.max_diff_cm?.toFixed(1) ?? '-'} cm`
                : '-'}
            </span>
          </div>
          <div>
            <span className="text-gray-600 block">Kalibrasi</span>
            <span className="font-bold">{snapshot.status_kalibrasi}</span>
          </div>
          <div>
            <span className="text-gray-600 block">Respon Hujan</span>
            <span className="font-bold">
              {snapshot.status_hujan} ({snapshot.rain_responded}/{snapshot.rain_events})
            </span>
          </div>
        </div>

        <div>
          <h3 className="text-xs font-bold uppercase text-gray-800 mb-1">
            Tabel 1: Riwayat Titik Pengukuran Mingguan (Manual vs IoT)
          </h3>
          <PointsTable points={points} />
        </div>

        <div>
          <h3 className="text-xs font-bold uppercase text-gray-800 mb-1">
            Tabel 2: Evaluasi Respon Hujan
          </h3>
          <RainTable
            rainEvents={rain_events.slice(0, 6)}
            hasRainStation={snapshot.has_rain_station}
          />
        </div>
      </div>
    </div>
  );
}
