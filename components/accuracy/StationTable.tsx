"use client";

import { useMemo, useState } from 'react';
import Link from 'next/link';
import { ArrowDown, ArrowUp, ArrowUpDown, ExternalLink } from 'lucide-react';
import { formatWibDateTime } from '@/lib/analysis/date';
import type { AnalyzedStationSnapshot, SparklinePoint } from '@/lib/types';
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

export default function StationTable({
  stations,
}: {
  stations: AnalyzedStationSnapshot[];
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

  return (
    <section
      aria-label="Daftar evaluasi stasiun IoT TMAT"
      className="bg-white rounded-2xl border border-gray-200 overflow-hidden shadow-xs"
    >
      <div className="px-5 py-4 border-b border-gray-200 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-base font-bold text-gray-900">
            Evaluasi Stasiun ({stations.length})
          </h2>
          <p className="text-xs text-gray-600 mt-0.5">
            Klik ID stasiun untuk melihat grafik 2-panel, diagnosis teknis, dan riwayat pengukuran.
          </p>
        </div>

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
            className="min-h-11 px-3 rounded-xl border border-gray-500 bg-white text-xs font-semibold text-gray-900"
          >
            <option value="priority">Prioritas Anomali</option>
            <option value="latest_diff_cm">Selisih Terbesar</option>
            <option value="piezo_id">Piezometer ID</option>
            <option value="kebun">Kebun</option>
          </select>
        </div>
      </div>

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
                    href={`/accuracy/${encodeURIComponent(s.piezo_id)}`}
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
                href={`/accuracy/${encodeURIComponent(s.piezo_id)}`}
                className="min-h-11 inline-flex items-center justify-center gap-1.5 px-3.5 rounded-xl bg-black text-white text-xs font-semibold hover:bg-gray-800 transition-colors"
              >
                <span>Detail Grafik</span>
                <ExternalLink size={13} aria-hidden="true" />
              </Link>
            </div>
          </article>
        ))}
      </div>
    </section>
  );
}
