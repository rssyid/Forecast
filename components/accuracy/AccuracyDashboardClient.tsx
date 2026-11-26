"use client";

import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  AlertTriangle,
  Download,
  RefreshCw,
  RotateCcw,
  Search,
} from 'lucide-react';
import SearchableSelect from '@/components/SearchableSelect';
import { formatWibDateTime } from '@/lib/analysis/date';
import { COVERAGES, type SummaryApiResponse } from '@/lib/types';
import CoverageTable from './CoverageTable';
import KpiCards from './KpiCards';
import StationTable from './StationTable';

export default function AccuracyDashboardClient() {
  const [data, setData] = useState<SummaryApiResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [runId, setRunId] = useState<string>('');
  const [coverage, setCoverage] = useState<string>('all');
  const [dateFrom, setDateFrom] = useState<string>('');
  const [dateTo, setDateTo] = useState<string>('');
  const [anomalyOnly, setAnomalyOnly] = useState<boolean>(false);
  const [searchInput, setSearchInput] = useState<string>('');
  const [debouncedSearch, setDebouncedSearch] = useState<string>('');

  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSearch(searchInput.trim());
    }, 220);
    return () => clearTimeout(timer);
  }, [searchInput]);

  const queryString = useMemo(() => {
    const params = new URLSearchParams();
    if (runId) params.set('runId', runId);
    if (coverage && coverage !== 'all') params.set('coverage', coverage);
    if (dateFrom) params.set('dateFrom', dateFrom);
    if (dateTo) params.set('dateTo', dateTo);
    if (anomalyOnly) params.set('anomalyOnly', 'true');
    if (debouncedSearch) params.set('search', debouncedSearch);
    return params.toString();
  }, [runId, coverage, dateFrom, dateTo, anomalyOnly, debouncedSearch]);

  const fetchSummary = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const url = queryString
        ? `/api/accuracy/summary?${queryString}`
        : '/api/accuracy/summary';
      const res = await fetch(url, { cache: 'no-store' });
      const json = await res.json();
      if (!res.ok) {
        throw new Error(json?.error || 'Gagal memuat data akurasi IoT TMAT.');
      }
      setData(json as SummaryApiResponse);
    } catch (err) {
      setError(
        err instanceof Error ? err.message : 'Terjadi gangguan jaringan.'
      );
    } finally {
      setLoading(false);
    }
  }, [queryString]);

  useEffect(() => {
    fetchSummary();
  }, [fetchSummary]);

  const hasActiveFilters =
    Boolean(runId) ||
    coverage !== 'all' ||
    Boolean(dateFrom) ||
    Boolean(dateTo) ||
    anomalyOnly ||
    Boolean(searchInput.trim());

  const resetFilters = () => {
    setRunId('');
    setCoverage('all');
    setDateFrom('');
    setDateTo('');
    setAnomalyOnly(false);
    setSearchInput('');
    setDebouncedSearch('');
  };

  const coverageOptions = useMemo(() => {
    const dynamicNames = data?.coverage_stats.map((c) => c.coverage) ?? [...COVERAGES];
    const unique = Array.from(new Set([...COVERAGES, ...dynamicNames]));
    return [
      { value: 'all', label: 'Semua Coverage' },
      ...unique.map((name) => ({ value: name, label: name })),
    ];
  }, [data]);

  const staleCoverages = useMemo(
    () =>
      (data?.meta.coverage_freshness ?? []).filter((f) => f.is_stale_fallback),
    [data]
  );

  const excelUrl = queryString
    ? `/api/export/excel?${queryString}`
    : '/api/export/excel';

  const selectedCoverageStat = useMemo(
    () => data?.coverage_stats.find((c) => c.coverage === coverage) ?? null,
    [data, coverage]
  );

  return (
    <div className="space-y-6">
      <header className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold text-gray-900 tracking-tight">
            Laporan Akurasi Sensor IoT TMAT
          </h1>
          <p className="text-sm text-gray-600 mt-1">
            Evaluasi selisih pembacaan IoT per jam terhadap pengukuran manual mingguan (toleransi 3.0 cm) dan respon curah hujan per kebun.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          {data?.meta.last_updated_at && (
            <span className="inline-flex items-center px-3 py-2 rounded-xl bg-white border border-gray-300 text-xs font-semibold text-gray-800">
              Data diperbarui {formatWibDateTime(data.meta.last_updated_at)} WIB
            </span>
          )}
          <a
            href={excelUrl}
            download
            className={`min-h-11 inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-black text-white text-sm font-semibold hover:bg-gray-800 transition-colors ${
              !data?.meta.has_data ? 'pointer-events-none opacity-50' : ''
            }`}
            aria-disabled={!data?.meta.has_data}
          >
            <Download size={16} aria-hidden="true" />
            <span>Unduh Excel</span>
          </a>
        </div>
      </header>

      {staleCoverages.length > 0 && (
        <div
          role="status"
          className="bg-amber-50 border border-amber-300 rounded-2xl p-4 flex items-start gap-3 text-sm text-amber-900"
        >
          <AlertTriangle
            size={18}
            aria-hidden="true"
            className="shrink-0 mt-0.5 text-amber-800"
          />
          <div>
            <p className="font-bold">
              Sebagian coverage menggunakan snapshot valid terakhir
            </p>
            <p className="text-xs text-amber-800 mt-0.5">
              Penarikan terbaru gagal untuk:{' '}
              {staleCoverages.map((c) => c.coverage).join(', ')}. Data stabil sebelumnya tetap ditampilkan.
            </p>
          </div>
        </div>
      )}

      {/* Filter Panel */}
      <section
        aria-label="Filter laporan akurasi"
        className="bg-white rounded-2xl border border-gray-200 p-4 sm:p-5 shadow-xs space-y-4"
      >
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-12 gap-3 items-end">
          <div className="lg:col-span-3">
            <label
              htmlFor="filter-run"
              className="block text-xs font-semibold text-gray-700 mb-1"
            >
              Periode Snapshot
            </label>
            <select
              id="filter-run"
              value={runId}
              onChange={(e) => setRunId(e.target.value)}
              className="w-full h-11 py-2 px-3 rounded-xl border border-gray-300 bg-white text-sm font-medium text-gray-900"
            >
              <option value="">Terbaru per Coverage</option>
              {(data?.meta.available_runs ?? []).map((r) => (
                <option key={r.run_id} value={r.run_id}>
                  {r.period_from} s.d. {r.period_to} ({r.status})
                </option>
              ))}
            </select>
          </div>

          <div className="lg:col-span-3">
            <span
              id="filter-coverage-label"
              className="block text-xs font-semibold text-gray-700 mb-1"
            >
              Coverage
            </span>
            <div role="group" aria-labelledby="filter-coverage-label">
              <SearchableSelect
                options={coverageOptions}
                value={coverage}
                onChange={setCoverage}
                placeholder="Pilih Coverage..."
                autoSort={false}
                className="w-full"
              />
            </div>
          </div>

          <div className="lg:col-span-2">
            <label
              htmlFor="filter-date-from"
              className="block text-xs font-semibold text-gray-700 mb-1"
            >
              Manual Dari
            </label>
            <input
              id="filter-date-from"
              type="date"
              value={dateFrom}
              onChange={(e) => setDateFrom(e.target.value)}
              className="w-full min-h-11 px-3 rounded-xl border border-gray-300 bg-white text-sm text-gray-900"
            />
          </div>

          <div className="lg:col-span-2">
            <label
              htmlFor="filter-date-to"
              className="block text-xs font-semibold text-gray-700 mb-1"
            >
              Manual Sampai
            </label>
            <input
              id="filter-date-to"
              type="date"
              value={dateTo}
              onChange={(e) => setDateTo(e.target.value)}
              className="w-full min-h-11 px-3 rounded-xl border border-gray-300 bg-white text-sm text-gray-900"
            />
          </div>

          <div className="lg:col-span-2">
            <label
              htmlFor="filter-search"
              className="block text-xs font-semibold text-gray-700 mb-1"
            >
              Cari Stasiun / Kebun
            </label>
            <div className="relative">
              <Search
                size={15}
                aria-hidden="true"
                className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-600 pointer-events-none"
              />
              <input
                id="filter-search"
                type="search"
                value={searchInput}
                onChange={(e) => setSearchInput(e.target.value)}
                placeholder="KSA-133, KTR..."
                className="w-full min-h-11 pl-9 pr-3 rounded-xl border border-gray-300 bg-white text-sm text-gray-900 placeholder:text-gray-500"
              />
            </div>
          </div>
        </div>

        <div className="flex flex-wrap items-center justify-between gap-3 pt-2 border-t border-gray-100">
          <button
            type="button"
            role="switch"
            aria-checked={anomalyOnly}
            onClick={() => setAnomalyOnly((prev) => !prev)}
            className={`min-h-11 inline-flex items-center gap-2.5 px-3.5 rounded-xl border text-sm font-semibold transition-colors ${
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
            <span>Tampilkan Hanya Anomali</span>
          </button>

          <div className="flex items-center gap-2">
            {hasActiveFilters && (
              <button
                type="button"
                onClick={resetFilters}
                className="min-h-11 inline-flex items-center gap-1.5 px-3.5 rounded-xl border border-gray-300 bg-white text-xs font-semibold text-gray-800 hover:bg-gray-100"
              >
                <RotateCcw size={14} aria-hidden="true" />
                <span>Reset Filter</span>
              </button>
            )}
            <button
              type="button"
              onClick={fetchSummary}
              disabled={loading}
              aria-label="Muat ulang data akurasi"
              className="min-h-11 min-w-11 inline-flex items-center justify-center gap-1.5 px-3.5 rounded-xl border border-gray-300 bg-white text-xs font-semibold text-gray-800 hover:bg-gray-100 disabled:opacity-60"
            >
              <RefreshCw
                size={14}
                aria-hidden="true"
                className={loading ? 'animate-spin' : ''}
              />
              <span>Muat Ulang</span>
            </button>
          </div>
        </div>
      </section>

      {/* Loading skeleton */}
      {loading && !data && (
        <div aria-live="polite" className="space-y-4">
          <p className="text-sm font-medium text-gray-700">
            Memuat laporan akurasi IoT TMAT...
          </p>
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-4">
            <div className="lg:col-span-5 h-36 bg-white rounded-2xl border border-gray-200 p-5 animate-pulse" />
            <div className="lg:col-span-7 grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div className="h-36 bg-white rounded-2xl border border-gray-200 animate-pulse" />
              <div className="h-36 bg-white rounded-2xl border border-gray-200 animate-pulse" />
              <div className="h-36 bg-white rounded-2xl border border-gray-200 animate-pulse" />
            </div>
          </div>
          <div className="h-64 bg-white rounded-2xl border border-gray-200 animate-pulse" />
        </div>
      )}

      {/* Error state */}
      {error && (
        <div
          role="alert"
          className="bg-red-50 border border-red-300 rounded-2xl p-6 flex flex-col sm:flex-row sm:items-center justify-between gap-4"
        >
          <div>
            <h2 className="text-base font-bold text-red-900">
              Gagal Memuat Laporan Akurasi
            </h2>
            <p className="text-sm text-red-800 mt-1">{error}</p>
          </div>
          <button
            type="button"
            onClick={fetchSummary}
            className="min-h-11 px-4 py-2 rounded-xl bg-black text-white text-sm font-semibold hover:bg-gray-800 shrink-0"
          >
            Coba Lagi
          </button>
        </div>
      )}

      {/* First-run empty state (before any workflow run completes) */}
      {!loading && !error && data && !data.meta.has_data && (
        <div className="bg-white rounded-2xl border border-gray-200 p-8 text-center space-y-3">
          <h2 className="text-lg font-bold text-gray-900">
            Belum Ada Snapshot Evaluasi IoT TMAT
          </h2>
          <p className="text-sm text-gray-600 max-w-xl mx-auto">
            Database belum memiliki hasil penarikan portal GIS-IoT. Jalankan workflow GitHub Actions &quot;IoT TMAT Accuracy Ingest&quot; untuk menarik data pertama kali.
          </p>
        </div>
      )}

      {/* Populated view */}
      {data && data.meta.has_data && (
        <div className={`space-y-6 ${loading ? 'opacity-70 transition-opacity' : ''}`}>
          <KpiCards
            kpi={data.kpi}
            periodFrom={data.meta.period_from}
            periodTo={data.meta.period_to}
          />

          <CoverageTable
            stats={data.coverage_stats}
            freshness={data.meta.coverage_freshness}
            selectedCoverage={coverage}
            onSelectCoverage={setCoverage}
          />

          {data.stations.length === 0 ? (
            <div className="bg-white rounded-2xl border border-gray-200 p-8 text-center space-y-3">
              {coverage !== 'all' &&
              selectedCoverageStat &&
              selectedCoverageStat.total_stations === 0 ? (
                <>
                  <h2 className="text-base font-bold text-gray-900">
                    Coverage {coverage} Belum Memiliki Stasiun Aktif
                  </h2>
                  <p className="text-sm text-gray-600 max-w-lg mx-auto">
                    Portal mengembalikan 0 stasiun piezometer IoT pada coverage {coverage} untuk periode evaluasi ini.
                  </p>
                  <button
                    type="button"
                    onClick={() => setCoverage('all')}
                    className="min-h-11 px-4 py-2 rounded-xl bg-black text-white text-sm font-semibold hover:bg-gray-800"
                  >
                    Tampilkan Semua Coverage
                  </button>
                </>
              ) : (
                <>
                  <h2 className="text-base font-bold text-gray-900">
                    Tidak Ada Stasiun yang Cocok dengan Filter
                  </h2>
                  <p className="text-sm text-gray-600 max-w-lg mx-auto">
                    Ubah kata kunci pencarian, rentang tanggal manual, atau matikan filter anomali untuk melihat seluruh stasiun.
                  </p>
                  <button
                    type="button"
                    onClick={resetFilters}
                    className="min-h-11 px-4 py-2 rounded-xl bg-black text-white text-sm font-semibold hover:bg-gray-800"
                  >
                    Reset Semua Filter
                  </button>
                </>
              )}
            </div>
          ) : (
            <StationTable stations={data.stations} />
          )}
        </div>
      )}
    </div>
  );
}
