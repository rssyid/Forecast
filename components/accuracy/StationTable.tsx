"use client";

import { useMemo, useState } from 'react';
import Link from 'next/link';
import {
  ArrowDown,
  ArrowUp,
  ArrowUpDown,
  ExternalLink,
  RotateCcw,
  Search,
} from 'lucide-react';
import SearchableSelect from '@/components/SearchableSelect';
import { formatWibDateTime } from '@/lib/analysis/date';
import type {
  AnalyzedStationSnapshot,
  CalibrationStatus,
  DiffBucket,
  RainFilterValue,
  SparklinePoint,
  SummaryFilterOptions,
} from '@/lib/types';
import {
  CalibrationBadge,
  DiffBadge,
  RainStatusBadge,
} from './StatusBadges';

type SortField =
  | 'priority'
  | 'piezo_id'
  | 'kebun'
  | 'latest_manual_cm'
  | 'latest_iot_cm'
  | 'latest_diff_cm';

function Sparkline({
  points,
  piezoId,
}: {
  points: SparklinePoint[];
  piezoId: string;
}) {
  if (!points || points.length < 2) {
    return <span className="text-xs text-gray-600">Belum ada seri</span>;
  }

  const values = points.map((p) => p.v);
  const min = Math.min(...values);
  const max = Math.max(...values);
  const span = max - min || 1;
  const w = 104;
  const h = 30;
  const pad = 3;

  // Smaller depth cm represents higher groundwater, so invert Y to match portal orientation.
  const coords = points.map((pt, idx) => {
    const x = pad + (idx / (points.length - 1)) * (w - pad * 2);
    const y = pad + ((pt.v - min) / span) * (h - pad * 2);
    return `${x.toFixed(1)},${y.toFixed(1)}`;
  });

  return (
    <svg
      width={w}
      height={h}
      viewBox={`0 0 ${w} ${h}`}
      role="img"
      aria-label={`Tren TMAT ${piezoId}: rentang ${min.toFixed(1)} sampai ${max.toFixed(1)} cm`}
      className="overflow-visible shrink-0"
    >
      <polyline
        fill="none"
        stroke="#2563EB"
        strokeWidth="1.75"
        strokeLinejoin="round"
        strokeLinecap="round"
        points={coords.join(' ')}
      />
    </svg>
  );
}

function getPriorityRank(s: AnalyzedStationSnapshot): number {
  if (s.status_kalibrasi === 'PERLU KALIBRASI ULANG') return 0;
  if (s.status_hujan === 'ANOMALI RESPON HUJAN') return 1;
  if (s.status_kalibrasi === 'TIDAK ADA DATA MANUAL') return 2;
  return 3;
}

type QuickChipKey = 'all' | 'recalibration' | 'rain_anomaly' | 'passed' | 'no_manual';

export default function StationTable({
  stations,
  filterOptions,
  activeWeekLabel,
  activeRunId,
  kebun,
  onKebunChange,
  jenis,
  onJenisChange,
  calibrationStatus,
  onCalibrationStatusChange,
  rainStatus,
  onRainStatusChange,
  diffBucket,
  onDiffBucketChange,
  anomalyOnly,
  onAnomalyOnlyChange,
  searchInput,
  onSearchInputChange,
  hasTableFilters,
  onResetTableFilters,
}: {
  stations: AnalyzedStationSnapshot[];
  filterOptions: SummaryFilterOptions;
  activeWeekLabel: string | null;
  activeRunId: string | null;
  kebun: string;
  onKebunChange: (val: string) => void;
  jenis: string;
  onJenisChange: (val: string) => void;
  calibrationStatus: CalibrationStatus | '';
  onCalibrationStatusChange: (val: CalibrationStatus | '') => void;
  rainStatus: RainFilterValue;
  onRainStatusChange: (val: RainFilterValue) => void;
  diffBucket: DiffBucket;
  onDiffBucketChange: (val: DiffBucket) => void;
  anomalyOnly: boolean;
  onAnomalyOnlyChange: (val: boolean) => void;
  searchInput: string;
  onSearchInputChange: (val: string) => void;
  hasTableFilters: boolean;
  onResetTableFilters: () => void;
}) {
  const [sortField, setSortField] = useState<SortField>('priority');
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('asc');

  const toggleSort = (field: SortField) => {
    if (sortField === field) {
      setSortDir((prev) => (prev === 'asc' ? 'desc' : 'asc'));
    } else {
      setSortField(field);
      setSortDir(field === 'latest_diff_cm' ? 'desc' : 'asc');
    }
  };

  const sortedStations = useMemo(() => {
    const list = [...stations];
    list.sort((a, b) => {
      let cmp = 0;
      if (sortField === 'priority') {
        cmp = getPriorityRank(a) - getPriorityRank(b);
        if (cmp === 0) {
          cmp = (b.latest_diff_cm ?? -1) - (a.latest_diff_cm ?? -1);
        }
        if (cmp === 0) {
          cmp = a.piezo_id.localeCompare(b.piezo_id);
        }
        return sortDir === 'asc' ? cmp : -cmp;
      }
      if (sortField === 'piezo_id') {
        cmp = a.piezo_id.localeCompare(b.piezo_id);
      } else if (sortField === 'kebun') {
        cmp = a.kebun.localeCompare(b.kebun);
      } else if (sortField === 'latest_manual_cm') {
        cmp = (a.latest_manual_cm ?? -9999) - (b.latest_manual_cm ?? -9999);
      } else if (sortField === 'latest_iot_cm') {
        cmp = (a.latest_iot_cm ?? -9999) - (b.latest_iot_cm ?? -9999);
      } else if (sortField === 'latest_diff_cm') {
        cmp = (a.latest_diff_cm ?? -1) - (b.latest_diff_cm ?? -1);
      }
      return sortDir === 'asc' ? cmp : -cmp;
    });
    return list;
  }, [stations, sortField, sortDir]);

  const kebunOptions = useMemo(
    () => [
      { value: 'all', label: 'Semua Kebun' },
      ...filterOptions.kebuns.map((k) => ({ value: k, label: k })),
    ],
    [filterOptions.kebuns]
  );

  const activeChip: QuickChipKey = useMemo(() => {
    if (calibrationStatus === 'PERLU KALIBRASI ULANG') return 'recalibration';
    if (calibrationStatus === 'LOLOS / AKURAT') return 'passed';
    if (calibrationStatus === 'TIDAK ADA DATA MANUAL') return 'no_manual';
    if (rainStatus === 'ANOMALI RESPON HUJAN') return 'rain_anomaly';
    return 'all';
  }, [calibrationStatus, rainStatus]);

  const handleQuickChip = (chip: QuickChipKey) => {
    if (chip === 'all') {
      onCalibrationStatusChange('');
      onRainStatusChange('all');
      onAnomalyOnlyChange(false);
      return;
    }
    if (chip === 'recalibration') {
      onCalibrationStatusChange('PERLU KALIBRASI ULANG');
      onRainStatusChange('all');
      onAnomalyOnlyChange(false);
      return;
    }
    if (chip === 'rain_anomaly') {
      onCalibrationStatusChange('');
      onRainStatusChange('ANOMALI RESPON HUJAN');
      onAnomalyOnlyChange(false);
      return;
    }
    if (chip === 'passed') {
      onCalibrationStatusChange('LOLOS / AKURAT');
      onRainStatusChange('all');
      onAnomalyOnlyChange(false);
      return;
    }
    if (chip === 'no_manual') {
      onCalibrationStatusChange('TIDAK ADA DATA MANUAL');
      onRainStatusChange('all');
      onAnomalyOnlyChange(false);
    }
  };

  const buildDetailHref = (piezoId: string) => {
    const params = new URLSearchParams();
    if (activeWeekLabel) {
      params.set('week', activeWeekLabel);
    } else if (activeRunId) {
      params.set('runId', activeRunId);
    }
    const qs = params.toString();
    return qs
      ? `/accuracy/${encodeURIComponent(piezoId)}?${qs}`
      : `/accuracy/${encodeURIComponent(piezoId)}`;
  };

  const SortIcon = ({ field }: { field: SortField }) => {
    if (sortField !== field) {
      return <ArrowUpDown size={13} aria-hidden="true" className="text-gray-600" />;
    }
    return sortDir === 'asc' ? (
      <ArrowUp size={13} aria-hidden="true" className="text-gray-900" />
    ) : (
      <ArrowDown size={13} aria-hidden="true" className="text-gray-900" />
    );
  };

  const counts = filterOptions.status_counts;

  return (
    <section
      aria-label="Daftar evaluasi stasiun IoT TMAT"
      className="bg-white rounded-2xl border border-gray-200 overflow-hidden shadow-xs"
    >
      <div className="px-5 py-4 border-b border-gray-200 space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="text-base font-bold text-gray-900">
              Evaluasi Stasiun ({stations.length} dari {filterOptions.total_unfiltered_in_scope})
            </h2>
            <p className="text-xs text-gray-600 mt-0.5">
              Filter tabel untuk menyaring kebun, status kalibrasi, respon hujan, jenis UP, atau rentang selisih.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            {hasTableFilters && (
              <button
                type="button"
                onClick={onResetTableFilters}
                className="min-h-11 inline-flex items-center gap-1.5 px-3.5 rounded-xl border border-gray-300 bg-white text-xs font-semibold text-gray-800 hover:bg-gray-100"
              >
                <RotateCcw size={14} aria-hidden="true" />
                <span>Reset Filter Tabel</span>
              </button>
            )}

            <div className="flex items-center gap-2 lg:hidden">
              <label htmlFor="mobile-sort" className="text-xs font-semibold text-gray-700">
                Urutkan:
              </label>
              <select
                id="mobile-sort"
                value={sortField}
                onChange={(e) => {
                  const next = e.target.value as SortField;
                  setSortField(next);
                  setSortDir(next === 'latest_diff_cm' ? 'desc' : 'asc');
                }}
                className="min-h-11 px-3 rounded-xl border border-gray-300 bg-white text-xs font-semibold text-gray-900"
              >
                <option value="priority">Prioritas Anomali</option>
                <option value="latest_diff_cm">Selisih Terbesar</option>
                <option value="piezo_id">Piezometer ID</option>
                <option value="kebun">Kebun</option>
              </select>
            </div>
          </div>
        </div>

        {/* Quick Status Filter Chips */}
        <div
          role="group"
          aria-label="Filter cepat status stasiun"
          className="flex flex-wrap items-center gap-2"
        >
          {(
            [
              { key: 'all', label: 'Semua', count: counts.all },
              { key: 'recalibration', label: 'Perlu Kalibrasi', count: counts.recalibration },
              { key: 'rain_anomaly', label: 'Anomali Hujan', count: counts.rain_anomaly },
              { key: 'passed', label: 'Lolos / Akurat', count: counts.passed },
              { key: 'no_manual', label: 'Tanpa Manual', count: counts.no_manual },
            ] as Array<{ key: QuickChipKey; label: string; count: number }>
          ).map((chip) => {
            const selected = activeChip === chip.key && !anomalyOnly;
            return (
              <button
                key={chip.key}
                type="button"
                aria-pressed={selected}
                onClick={() => handleQuickChip(chip.key)}
                className={`min-h-11 inline-flex items-center gap-2 px-3.5 py-2 rounded-xl border text-xs font-semibold transition-colors ${
                  selected
                    ? 'bg-black text-white border-black'
                    : 'bg-gray-50 text-gray-800 border-gray-300 hover:bg-gray-100'
                }`}
              >
                <span>{chip.label}</span>
                <span
                  className={`px-1.5 py-0.5 rounded text-[11px] tabular-nums ${
                    selected
                      ? 'bg-white/20 text-white'
                      : 'bg-white text-gray-700 border border-gray-200'
                  }`}
                >
                  {chip.count}
                </span>
              </button>
            );
          })}

          <button
            type="button"
            role="switch"
            aria-checked={anomalyOnly}
            onClick={() => {
              if (!anomalyOnly) {
                onCalibrationStatusChange('');
                onRainStatusChange('all');
              }
              onAnomalyOnlyChange(!anomalyOnly);
            }}
            className={`min-h-11 inline-flex items-center gap-2 px-3.5 py-2 rounded-xl border text-xs font-semibold transition-colors ${
              anomalyOnly
                ? 'bg-red-50 text-red-800 border-red-400'
                : 'bg-white text-gray-800 border-gray-300 hover:bg-gray-50'
            }`}
          >
            <span
              aria-hidden="true"
              className={`w-4 h-4 rounded border flex items-center justify-center text-[10px] font-bold ${
                anomalyOnly
                  ? 'bg-red-700 border-red-700 text-white'
                  : 'border-gray-500 bg-white'
              }`}
            >
              {anomalyOnly ? '✓' : ''}
            </span>
            <span>Semua Anomali Saja</span>
          </button>
        </div>

        {/* Column-level Filter Controls */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-12 gap-3 pt-2 border-t border-gray-100 items-end">
          <div className="lg:col-span-3">
            <label
              htmlFor="table-filter-search"
              className="block text-xs font-semibold text-gray-700 mb-1"
            >
              Cari Stasiun / Blok / Device
            </label>
            <div className="relative">
              <Search
                size={15}
                aria-hidden="true"
                className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-600 pointer-events-none"
              />
              <input
                id="table-filter-search"
                type="search"
                value={searchInput}
                onChange={(e) => onSearchInputChange(e.target.value)}
                placeholder="KSA-133, KTR, Blok..."
                className="w-full min-h-11 pl-9 pr-3 rounded-xl border border-gray-300 bg-white text-sm text-gray-900 placeholder:text-gray-500"
              />
            </div>
          </div>

          <div className="lg:col-span-3">
            <span
              id="table-filter-kebun-label"
              className="block text-xs font-semibold text-gray-700 mb-1"
            >
              Kebun (Estate)
            </span>
            <div role="group" aria-labelledby="table-filter-kebun-label">
              <SearchableSelect
                options={kebunOptions}
                value={kebun}
                onChange={onKebunChange}
                placeholder="Semua Kebun"
                autoSort={false}
                className="w-full"
              />
            </div>
          </div>

          <div className="lg:col-span-2">
            <label
              htmlFor="table-filter-rain"
              className="block text-xs font-semibold text-gray-700 mb-1"
            >
              Respon Hujan
            </label>
            <select
              id="table-filter-rain"
              value={rainStatus}
              onChange={(e) => onRainStatusChange(e.target.value as RainFilterValue)}
              className="w-full min-h-11 px-3 py-2 rounded-xl border border-gray-300 bg-white text-sm font-medium text-gray-900"
            >
              <option value="all">Semua Respon</option>
              <option value="NORMAL">Normal</option>
              <option value="ANOMALI RESPON HUJAN">Anomali Respon Hujan</option>
              <option value="TIDAK ADA HUJAN">Tidak Ada Hujan</option>
              <option value="NO_RAIN_STATION">Tanpa Stasiun Hujan</option>
            </select>
          </div>

          <div className="lg:col-span-2">
            <label
              htmlFor="table-filter-jenis"
              className="block text-xs font-semibold text-gray-700 mb-1"
            >
              Jenis UP
            </label>
            <select
              id="table-filter-jenis"
              value={jenis}
              onChange={(e) => onJenisChange(e.target.value)}
              className="w-full min-h-11 px-3 py-2 rounded-xl border border-gray-300 bg-white text-sm font-medium text-gray-900"
            >
              <option value="all">Semua Jenis</option>
              {filterOptions.jenis_list.map((j) => (
                <option key={j} value={j}>
                  {j}
                </option>
              ))}
            </select>
          </div>

          <div className="lg:col-span-2">
            <label
              htmlFor="table-filter-diff"
              className="block text-xs font-semibold text-gray-700 mb-1"
            >
              Selisih Terakhir
            </label>
            <select
              id="table-filter-diff"
              value={diffBucket}
              onChange={(e) => onDiffBucketChange(e.target.value as DiffBucket)}
              className="w-full min-h-11 px-3 py-2 rounded-xl border border-gray-300 bg-white text-sm font-medium text-gray-900"
            >
              <option value="all">Semua Selisih</option>
              <option value="gt3">&gt; 3.0 cm (Melebihi Batas)</option>
              <option value="1to3">1.0 s.d. 3.0 cm</option>
              <option value="lte1">&lt; 1.0 cm (Ketat)</option>
              <option value="na">Belum Ada Manual</option>
            </select>
          </div>
        </div>
      </div>

      {sortedStations.length === 0 ? (
        <div className="p-8 text-center space-y-3">
          <h3 className="text-base font-bold text-gray-900">
            Tidak Ada Stasiun yang Cocok dengan Filter Tabel
          </h3>
          <p className="text-sm text-gray-600 max-w-lg mx-auto">
            Kombinasi filter di atas tidak menemukan stasiun pada periode ini. Ubah salah satu kriteria atau reset filter tabel.
          </p>
          {hasTableFilters && (
            <button
              type="button"
              onClick={onResetTableFilters}
              className="min-h-11 px-4 py-2 rounded-xl bg-black text-white text-sm font-semibold hover:bg-gray-800"
            >
              Reset Filter Tabel
            </button>
          )}
        </div>
      ) : (
        <>
          {/* Desktop data table */}
          <div className="hidden lg:block overflow-x-auto">
            <table className="w-full text-sm text-left">
              <thead className="bg-gray-50 border-b border-gray-200 text-xs font-semibold text-gray-700">
                <tr>
                  <th className="py-3 px-4">
                    <button
                      type="button"
                      onClick={() => toggleSort('piezo_id')}
                      className="inline-flex items-center gap-1.5 font-semibold text-gray-700 hover:text-gray-900 min-h-9"
                    >
                      <span>Stasiun</span>
                      <SortIcon field="piezo_id" />
                    </button>
                  </th>
                  <th className="py-3 px-3">
                    <button
                      type="button"
                      onClick={() => toggleSort('kebun')}
                      className="inline-flex items-center gap-1.5 font-semibold text-gray-700 hover:text-gray-900 min-h-9"
                    >
                      <span>Coverage / Kebun</span>
                      <SortIcon field="kebun" />
                    </button>
                  </th>
                  <th className="py-3 px-3 text-right">
                    <button
                      type="button"
                      onClick={() => toggleSort('latest_manual_cm')}
                      className="inline-flex items-center gap-1.5 font-semibold text-gray-700 hover:text-gray-900 min-h-9"
                    >
                      <span>Manual</span>
                      <SortIcon field="latest_manual_cm" />
                    </button>
                  </th>
                  <th className="py-3 px-3 text-right">
                    <button
                      type="button"
                      onClick={() => toggleSort('latest_iot_cm')}
                      className="inline-flex items-center gap-1.5 font-semibold text-gray-700 hover:text-gray-900 min-h-9"
                    >
                      <span>IoT</span>
                      <SortIcon field="latest_iot_cm" />
                    </button>
                  </th>
                  <th className="py-3 px-3">
                    <button
                      type="button"
                      onClick={() => toggleSort('latest_diff_cm')}
                      className="inline-flex items-center gap-1.5 font-semibold text-gray-700 hover:text-gray-900 min-h-9"
                    >
                      <span>Selisih</span>
                      <SortIcon field="latest_diff_cm" />
                    </button>
                  </th>
                  <th className="py-3 px-3">Status Kalibrasi</th>
                  <th className="py-3 px-3">Respon Hujan</th>
                  <th className="py-3 px-4">Tren 30 Hari</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200">
                {sortedStations.map((s) => (
                  <tr
                    key={s.piezo_id}
                    className={
                      s.status_kalibrasi === 'PERLU KALIBRASI ULANG'
                        ? 'bg-red-50/35 hover:bg-red-50/60 transition-colors'
                        : 'hover:bg-gray-50 transition-colors'
                    }
                  >
                    <td className="py-3.5 px-4 align-top">
                      <Link
                        href={buildDetailHref(s.piezo_id)}
                        className="inline-flex items-center gap-1.5 font-bold text-gray-900 hover:underline underline-offset-4"
                      >
                        <span>{s.piezo_id}</span>
                        <ExternalLink size={12} aria-hidden="true" className="text-gray-600" />
                      </Link>
                      <p className="text-xs text-gray-600 mt-0.5 max-w-[190px] truncate">
                        {s.device_name || s.jenis || '-'}
                      </p>
                    </td>
                    <td className="py-3.5 px-3 align-top">
                      <p className="font-semibold text-gray-900">{s.coverage}</p>
                      <p className="text-xs text-gray-600">
                        {s.kebun || '-'} / Blok {s.block || '-'}
                      </p>
                    </td>
                    <td className="py-3.5 px-3 align-top text-right tabular-nums">
                      <p className="font-semibold text-gray-900">
                        {s.latest_manual_cm !== null
                          ? `${s.latest_manual_cm.toFixed(1)} cm`
                          : '-'}
                      </p>
                      <p className="text-[11px] text-gray-600">
                        {s.latest_manual_at
                          ? formatWibDateTime(s.latest_manual_at)
                          : 'Tidak ada data'}
                      </p>
                      {s.latest_manual_at && s.manual_in_active_week === false && (
                        <span className="inline-block mt-1 px-1.5 py-0.5 rounded text-[10px] font-semibold bg-amber-50 text-amber-800 border border-amber-300">
                          Manual minggu sebelumnya
                        </span>
                      )}
                    </td>
                    <td className="py-3.5 px-3 align-top text-right tabular-nums font-semibold text-gray-900">
                      {s.latest_iot_cm !== null ? `${s.latest_iot_cm.toFixed(1)} cm` : '-'}
                    </td>
                    <td className="py-3.5 px-3 align-top">
                      <DiffBadge
                        diffCm={s.latest_diff_cm}
                        signedDiffCm={s.signed_diff_cm}
                      />
                    </td>
                    <td className="py-3.5 px-3 align-top">
                      <CalibrationBadge status={s.status_kalibrasi} />
                    </td>
                    <td className="py-3.5 px-3 align-top">
                      <RainStatusBadge
                        status={s.status_hujan}
                        hasRainStation={s.has_rain_station}
                      />
                    </td>
                    <td className="py-3.5 px-4 align-top">
                      <Sparkline points={s.sparkline_json} piezoId={s.piezo_id} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Tablet (2 cols) and mobile (1 col) responsive cards */}
          <div className="lg:hidden grid grid-cols-1 sm:grid-cols-2 gap-4 p-4 bg-gray-50/70">
            {sortedStations.map((s) => (
              <article
                key={s.piezo_id}
                className="bg-white rounded-xl border border-gray-200 p-4 space-y-3 flex flex-col justify-between"
              >
                <div className="space-y-2.5">
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <h3 className="text-base font-bold text-gray-900">
                        {s.piezo_id}
                      </h3>
                      <p className="text-xs text-gray-600">
                        {s.coverage} | {s.kebun || '-'} / Blok {s.block || '-'}
                      </p>
                    </div>
                    <DiffBadge
                      diffCm={s.latest_diff_cm}
                      signedDiffCm={s.signed_diff_cm}
                    />
                  </div>

                  <div className="grid grid-cols-2 gap-2 pt-2 border-t border-gray-100 text-xs">
                    <div>
                      <span className="text-gray-600 block">Manual Terakhir</span>
                      <span className="font-bold text-gray-900 tabular-nums">
                        {s.latest_manual_cm !== null
                          ? `${s.latest_manual_cm.toFixed(1)} cm`
                          : '-'}
                      </span>
                      {s.latest_manual_at && s.manual_in_active_week === false && (
                        <span className="inline-block mt-1 px-1.5 py-0.5 rounded text-[10px] font-semibold bg-amber-50 text-amber-800 border border-amber-300">
                          Manual minggu sebelumnya
                        </span>
                      )}
                    </div>
                    <div>
                      <span className="text-gray-600 block">IoT Terakhir</span>
                      <span className="font-bold text-gray-900 tabular-nums">
                        {s.latest_iot_cm !== null
                          ? `${s.latest_iot_cm.toFixed(1)} cm`
                          : '-'}
                      </span>
                    </div>
                  </div>

                  <div className="flex flex-wrap gap-2 pt-1">
                    <CalibrationBadge status={s.status_kalibrasi} />
                    <RainStatusBadge
                      status={s.status_hujan}
                      hasRainStation={s.has_rain_station}
                    />
                  </div>
                </div>

                <div className="pt-3 border-t border-gray-100 flex items-center justify-between gap-2">
                  <Sparkline points={s.sparkline_json} piezoId={s.piezo_id} />
                  <Link
                    href={buildDetailHref(s.piezo_id)}
                    className="min-h-11 inline-flex items-center justify-center gap-1.5 px-3.5 rounded-xl bg-black text-white text-xs font-semibold hover:bg-gray-800 transition-colors"
                  >
                    <span>Detail Grafik</span>
                    <ExternalLink size={13} aria-hidden="true" />
                  </Link>
                </div>
              </article>
            ))}
          </div>
        </>
      )}
    </section>
  );
}
