"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  AlertTriangle,
  CalendarClock,
  CheckCircle2,
  Download,
  Loader2,
  Play,
  RefreshCw,
  RotateCcw,
} from 'lucide-react';
import SearchableSelect from '@/components/SearchableSelect';
import { formatWibDateTime } from '@/lib/analysis/date';
import { applyStationTableFilters } from '@/lib/analysis/filters';
import {
  COVERAGES,
  type AccuracyStatusApiResponse,
  type CalibrationStatus,
  type DiffBucket,
  type RainFilterValue,
  type SummaryApiResponse,
} from '@/lib/types';
import CoverageTable from './CoverageTable';
import KpiCards from './KpiCards';
import ManualTriggerModal from './ManualTriggerModal';
import StationTable from './StationTable';

export default function AccuracyDashboardClient({
  initialWeek = '',
  initialRunId = '',
}: {
  initialWeek?: string;
  initialRunId?: string;
}) {
  const [data, setData] = useState<SummaryApiResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Scope filters
  const [week, setWeek] = useState<string>(initialWeek);
  const [runId, setRunId] = useState<string>(initialRunId);
  const [coverage, setCoverage] = useState<string>('all');
  const [dateFrom, setDateFrom] = useState<string>('');
  const [dateTo, setDateTo] = useState<string>('');

  // Table-level filters
  const [kebun, setKebun] = useState<string>('all');
  const [jenis, setJenis] = useState<string>('all');
  const [calibrationStatus, setCalibrationStatus] = useState<CalibrationStatus | ''>('');
  const [rainStatus, setRainStatus] = useState<RainFilterValue>('all');
  const [diffBucket, setDiffBucket] = useState<DiffBucket>('all');
  const [anomalyOnly, setAnomalyOnly] = useState<boolean>(false);
  const [searchInput, setSearchInput] = useState<string>('');
  const [debouncedSearch, setDebouncedSearch] = useState<string>('');

  // Manual trigger & sync polling state
  const [syncStatus, setSyncStatus] = useState<AccuracyStatusApiResponse | null>(null);
  const [triggerModalOpen, setTriggerModalOpen] = useState(false);
  const [justTriggeredInfo, setJustTriggeredInfo] = useState<{
    week_label: string;
    coverage: string;
  } | null>(null);
  const [syncCompletedNotice, setSyncCompletedNotice] = useState<string | null>(null);
  const wasSyncingRef = useRef(false);

  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSearch(searchInput.trim());
    }, 220);
    return () => clearTimeout(timer);
  }, [searchInput]);

  // Reset kebun filter when coverage changes and kebun is no longer in scope.
  useEffect(() => {
    if (
      kebun !== 'all' &&
      data?.filter_options?.kebuns &&
      !data.filter_options.kebuns.includes(kebun)
    ) {
      setKebun('all');
    }
  }, [coverage, data?.filter_options?.kebuns, kebun]);

  const scopeQueryString = useMemo(() => {
    const params = new URLSearchParams();
    if (runId) {
      params.set('runId', runId);
    } else if (week) {
      params.set('week', week);
    }
    if (coverage && coverage !== 'all') params.set('coverage', coverage);
    if (dateFrom) params.set('dateFrom', dateFrom);
    if (dateTo) params.set('dateTo', dateTo);
    return params.toString();
  }, [runId, week, coverage, dateFrom, dateTo]);

  const queryString = useMemo(() => {
    const params = new URLSearchParams(scopeQueryString);
    if (kebun && kebun !== 'all') params.set('kebun', kebun);
    if (jenis && jenis !== 'all') params.set('jenis', jenis);
    if (calibrationStatus) params.set('calibrationStatus', calibrationStatus);
    if (rainStatus && rainStatus !== 'all') params.set('rainStatus', rainStatus);
    if (diffBucket && diffBucket !== 'all') params.set('diffBucket', diffBucket);
    if (anomalyOnly) params.set('anomalyOnly', 'true');
    if (debouncedSearch) params.set('search', debouncedSearch);
    return params.toString();
  }, [
    scopeQueryString,
    kebun,
    jenis,
    calibrationStatus,
    rainStatus,
    diffBucket,
    anomalyOnly,
    debouncedSearch,
  ]);

  const fetchAbortRef = useRef<AbortController | null>(null);

  const fetchSummary = useCallback(async () => {
    fetchAbortRef.current?.abort();
    const controller = new AbortController();
    fetchAbortRef.current = controller;

    setLoading(true);
    setError(null);
    try {
      const url = scopeQueryString
        ? `/api/accuracy/summary?${scopeQueryString}`
        : '/api/accuracy/summary';
      const res = await fetch(url, {
        cache: 'no-store',
        signal: controller.signal,
      });
      const json = await res.json();
      if (!res.ok) {
        throw new Error(json?.error || 'Gagal memuat data akurasi IoT TMAT.');
      }
      const typed = json as SummaryApiResponse;
      setData(typed);
      if (!week && !runId && typed.meta.active_week_label) {
        setWeek(typed.meta.active_week_label);
      }
    } catch (err) {
      if (err instanceof Error && err.name === 'AbortError') {
        return;
      }
      setError(
        err instanceof Error ? err.message : 'Terjadi gangguan jaringan.'
      );
    } finally {
      if (fetchAbortRef.current === controller) {
        setLoading(false);
      }
    }
  }, [scopeQueryString, week, runId]);

  useEffect(() => {
    fetchSummary();
    return () => {
      fetchAbortRef.current?.abort();
    };
  }, [fetchSummary]);

  // Keep URL query synchronized with selected week so detail back/share works cleanly.
  useEffect(() => {
    if (typeof window === 'undefined') return;
    const url = new URL(window.location.href);
    if (runId) {
      url.searchParams.set('runId', runId);
      url.searchParams.delete('week');
    } else if (week) {
      url.searchParams.set('week', week);
      url.searchParams.delete('runId');
    } else {
      url.searchParams.delete('week');
      url.searchParams.delete('runId');
    }
    window.history.replaceState({}, '', `${url.pathname}${url.search}`);
  }, [week, runId]);

  const fetchSyncStatus = useCallback(async () => {
    try {
      const res = await fetch('/api/accuracy/status', { cache: 'no-store' });
      if (!res.ok) return;
      const json = (await res.json()) as AccuracyStatusApiResponse;
      setSyncStatus(json);
    } catch {
      // Non-fatal status check; dashboard remains usable.
    }
  }, []);

  useEffect(() => {
    fetchSyncStatus();
  }, [fetchSyncStatus]);

  const isSyncRunning = useMemo(() => {
    const ghaActive =
      syncStatus?.github_workflow.state === 'queued' ||
      syncStatus?.github_workflow.state === 'in_progress';
    const dbActive = syncStatus?.active_run?.status === 'running';
    return Boolean(ghaActive || dbActive || justTriggeredInfo);
  }, [syncStatus, justTriggeredInfo]);

  useEffect(() => {
    if (!isSyncRunning) {
      if (wasSyncingRef.current) {
        wasSyncingRef.current = false;
        setSyncCompletedNotice(
          'Penarikan data akurasi IoT selesai. Data terbaru telah dimuat.'
        );
        fetchSummary();
      }
      return;
    }

    wasSyncingRef.current = true;
    const interval = setInterval(() => {
      fetchSyncStatus();
    }, 6000);

    return () => clearInterval(interval);
  }, [isSyncRunning, fetchSyncStatus, fetchSummary]);

  // Clear optimistic justTriggeredInfo once DB/GHA catches up or completes.
  useEffect(() => {
    if (!justTriggeredInfo) return;
    const timer = setTimeout(() => {
      setJustTriggeredInfo(null);
    }, 30000);
    return () => clearTimeout(timer);
  }, [justTriggeredInfo]);

  const hasTableFilters =
    kebun !== 'all' ||
    jenis !== 'all' ||
    Boolean(calibrationStatus) ||
    rainStatus !== 'all' ||
    diffBucket !== 'all' ||
    anomalyOnly ||
    Boolean(searchInput.trim());

  const hasScopeFilters =
    coverage !== 'all' || Boolean(dateFrom) || Boolean(dateTo) || Boolean(runId);

  const hasAnyFilters = hasTableFilters || hasScopeFilters;

  const resetTableFilters = () => {
    setKebun('all');
    setJenis('all');
    setCalibrationStatus('');
    setRainStatus('all');
    setDiffBucket('all');
    setAnomalyOnly(false);
    setSearchInput('');
    setDebouncedSearch('');
  };

  const resetAllFilters = () => {
    setRunId('');
    setCoverage('all');
    setDateFrom('');
    setDateTo('');
    resetTableFilters();
  };

  const handleSelectWeek = (nextWeek: string) => {
    setRunId('');
    setWeek(nextWeek);
  };

  const weekOptions = useMemo(() => {
    const list = data?.meta.available_weeks ?? [];
    if (list.length === 0) {
      return week ? [{ value: week, label: week }] : [];
    }
    return list.map((w) => {
      const partialNote =
        w.coverage_ok < w.coverage_total
          ? ` (${w.coverage_ok}/${w.coverage_total} cov)`
          : '';
      return {
        value: w.week_label,
        label: `${w.week_label} (${w.week_start} s.d. ${w.week_end})${partialNote}`,
      };
    });
  }, [data?.meta.available_weeks, week]);

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

  const filteredStations = useMemo(() => {
    if (!data?.stations) return [];
    return applyStationTableFilters(data.stations, {
      kebun,
      jenis,
      calibrationStatus,
      rainStatus,
      diffBucket,
      anomalyOnly,
      search: debouncedSearch,
    });
  }, [
    data?.stations,
    kebun,
    jenis,
    calibrationStatus,
    rainStatus,
    diffBucket,
    anomalyOnly,
    debouncedSearch,
  ]);

  const activeRunCoverages = syncStatus?.active_run?.coverages ?? [];
  const completedCount = activeRunCoverages.filter(
    (c) => c.status === 'success' || c.status === 'failed'
  ).length;
  const totalExpectedCov = COVERAGES.length;

  const activeWeekLabel = data?.meta.active_week_label ?? (week || null);

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
          <p className="inline-flex items-center gap-1.5 text-xs text-gray-600 mt-1.5 font-medium">
            <CalendarClock size={14} aria-hidden="true" />
            <span>
              Jadwal otomatis: setiap Kamis pukul 07:00 WIB (terkunci per Week)
              {data?.meta.last_updated_at
                ? ` | Terakhir diperbarui ${formatWibDateTime(data.meta.last_updated_at)} WIB`
                : ''}
            </span>
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          <button
            type="button"
            onClick={() => setTriggerModalOpen(true)}
            disabled={isSyncRunning}
            className="min-h-11 inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl border border-gray-300 bg-white text-sm font-semibold text-gray-900 hover:bg-gray-100 transition-colors disabled:opacity-60"
          >
            {isSyncRunning ? (
              <>
                <Loader2 size={15} className="animate-spin" aria-hidden="true" />
                <span>Menarik Data ({completedCount}/{totalExpectedCov})...</span>
              </>
            ) : (
              <>
                <Play size={14} aria-hidden="true" />
                <span>Update Data</span>
              </>
            )}
          </button>

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

      {/* Live Sync Progress Banner */}
      {isSyncRunning && (
        <section
          aria-live="polite"
          aria-label="Status penarikan data akurasi IoT"
          className="bg-white border border-gray-300 rounded-2xl p-4 sm:p-5 shadow-xs space-y-3"
        >
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div className="flex items-center gap-2.5">
              <Loader2 size={18} className="animate-spin text-gray-900" aria-hidden="true" />
              <div>
                <p className="text-sm font-bold text-gray-900">
                  Penarikan Data Portal GIS-IoT Sedang Berjalan
                </p>
                <p className="text-xs text-gray-600">
                  Target: {syncStatus?.active_run?.week_label || justTriggeredInfo?.week_label || 'Week berjalan'}
                  {' | '}
                  {activeRunCoverages.length > 0
                    ? `${completedCount} dari ${totalExpectedCov} coverage selesai diproses`
                    : syncStatus?.github_workflow.state === 'queued'
                      ? 'Menunggu runner GitHub Actions...'
                      : 'Mempersiapkan worker ingest...'}
                </p>
              </div>
            </div>
            {syncStatus?.github_workflow.html_url && (
              <a
                href={syncStatus.github_workflow.html_url}
                target="_blank"
                rel="noreferrer"
                className="min-h-10 inline-flex items-center px-3 py-1.5 rounded-xl border border-gray-300 text-xs font-semibold text-gray-800 hover:bg-gray-100"
              >
                Lihat Log GitHub Actions
              </a>
            )}
          </div>

          {activeRunCoverages.length > 0 && (
            <div className="flex flex-wrap gap-2">
              {activeRunCoverages.map((cov) => (
                <span
                  key={cov.coverage}
                  className={`px-2.5 py-1 rounded-lg text-xs font-semibold border ${
                    cov.status === 'success'
                      ? 'bg-emerald-50 text-emerald-800 border-emerald-300'
                      : cov.status === 'failed'
                        ? 'bg-red-50 text-red-800 border-red-300'
                        : 'bg-gray-100 text-gray-800 border-gray-300'
                  }`}
                >
                  {cov.coverage}: {cov.status === 'success' ? `${cov.station_count} stasiun` : cov.status}
                </span>
              ))}
            </div>
          )}
        </section>
      )}

      {syncCompletedNotice && !isSyncRunning && (
        <div
          role="status"
          className="bg-emerald-50 border border-emerald-300 rounded-2xl p-4 flex items-center justify-between gap-3 text-sm text-emerald-900"
        >
          <div className="flex items-center gap-2.5">
            <CheckCircle2 size={18} aria-hidden="true" className="shrink-0 text-emerald-700" />
            <span className="font-semibold">{syncCompletedNotice}</span>
          </div>
          <button
            type="button"
            onClick={() => setSyncCompletedNotice(null)}
            className="min-h-10 px-3 rounded-lg border border-emerald-300 bg-white text-xs font-semibold text-emerald-900 hover:bg-emerald-100"
          >
            Tutup
          </button>
        </div>
      )}

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
              Sebagian coverage menggunakan snapshot valid terakhir pada week ini
            </p>
            <p className="text-xs text-amber-800 mt-0.5">
              Penarikan terbaru gagal untuk:{' '}
              {staleCoverages.map((c) => c.coverage).join(', ')}. Data stabil sebelumnya tetap ditampilkan.
            </p>
          </div>
        </div>
      )}

      {/* Scope Filter Panel (Week Lock, Coverage, Manual Date Window) */}
      <section
        aria-label="Filter periode week dan wilayah akurasi"
        className="bg-white rounded-2xl border border-gray-200 p-4 sm:p-5 shadow-xs space-y-3"
      >
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-12 gap-3 items-end">
          <div className="lg:col-span-4">
            <span
              id="filter-week-label"
              className="block text-xs font-semibold text-gray-700 mb-1"
            >
              Periode Week (Terkunci seperti Piezometer)
            </span>
            <div role="group" aria-labelledby="filter-week-label">
              {weekOptions.length > 0 ? (
                <SearchableSelect
                  options={weekOptions}
                  value={activeWeekLabel || ''}
                  onChange={handleSelectWeek}
                  placeholder="Pilih Week..."
                  autoSort={false}
                  className="w-full"
                />
              ) : (
                <div className="min-h-11 px-3 py-2 rounded-xl border border-gray-200 bg-gray-50 text-sm text-gray-500 flex items-center">
                  Belum ada week tersimpan
                </div>
              )}
            </div>
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

          <div className="lg:col-span-1 flex items-center justify-end gap-2">
            <button
              type="button"
              onClick={() => {
                fetchSummary();
                fetchSyncStatus();
              }}
              disabled={loading}
              aria-label="Muat ulang data akurasi"
              title="Muat ulang"
              className="w-full min-h-11 min-w-11 inline-flex items-center justify-center gap-1.5 px-3 rounded-xl border border-gray-300 bg-white text-xs font-semibold text-gray-800 hover:bg-gray-100 disabled:opacity-60"
            >
              <RefreshCw
                size={15}
                aria-hidden="true"
                className={loading ? 'animate-spin' : ''}
              />
              <span className="lg:hidden">Muat Ulang</span>
            </button>
          </div>
        </div>

        {hasAnyFilters && (
          <div className="flex flex-wrap items-center justify-between gap-2 pt-2 border-t border-gray-100 text-xs text-gray-600">
            <span>
              Filter aktif sedang menyaring ringkasan atau tabel stasiun.
            </span>
            <button
              type="button"
              onClick={resetAllFilters}
              className="min-h-10 inline-flex items-center gap-1.5 px-3 rounded-xl border border-gray-300 bg-white text-xs font-semibold text-gray-800 hover:bg-gray-100"
            >
              <RotateCcw size={13} aria-hidden="true" />
              <span>Reset Semua Filter</span>
            </button>
          </div>
        )}
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
            Database belum memiliki hasil penarikan portal GIS-IoT. Klik tombol &quot;Update Data&quot; di atas atau tunggu jadwal otomatis Kamis 07:00 WIB.
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
            weekLabel={activeWeekLabel}
            weekComparison={data.week_comparison}
          />

          <CoverageTable
            stats={data.coverage_stats}
            freshness={data.meta.coverage_freshness}
            selectedCoverage={coverage}
            onSelectCoverage={setCoverage}
          />

          {coverage !== 'all' &&
          selectedCoverageStat &&
          selectedCoverageStat.total_stations === 0 ? (
            <div className="bg-white rounded-2xl border border-gray-200 p-8 text-center space-y-3">
              <h2 className="text-base font-bold text-gray-900">
                Coverage {coverage} Belum Memiliki Stasiun Aktif
              </h2>
              <p className="text-sm text-gray-600 max-w-lg mx-auto">
                Portal mengembalikan 0 stasiun piezometer IoT pada coverage {coverage} untuk week {activeWeekLabel || 'ini'}.
              </p>
              <button
                type="button"
                onClick={() => setCoverage('all')}
                className="min-h-11 px-4 py-2 rounded-xl bg-black text-white text-sm font-semibold hover:bg-gray-800"
              >
                Tampilkan Semua Coverage
              </button>
            </div>
          ) : (
            <StationTable
              stations={filteredStations}
              filterOptions={data.filter_options}
              activeWeekLabel={activeWeekLabel}
              activeRunId={data.meta.active_run_id}
              kebun={kebun}
              onKebunChange={setKebun}
              jenis={jenis}
              onJenisChange={setJenis}
              calibrationStatus={calibrationStatus}
              onCalibrationStatusChange={setCalibrationStatus}
              rainStatus={rainStatus}
              onRainStatusChange={setRainStatus}
              diffBucket={diffBucket}
              onDiffBucketChange={setDiffBucket}
              anomalyOnly={anomalyOnly}
              onAnomalyOnlyChange={setAnomalyOnly}
              searchInput={searchInput}
              onSearchInputChange={setSearchInput}
              hasTableFilters={hasTableFilters}
              onResetTableFilters={resetTableFilters}
            />
          )}
        </div>
      )}

      <ManualTriggerModal
        open={triggerModalOpen}
        onClose={() => setTriggerModalOpen(false)}
        selectableWeeks={syncStatus?.selectable_weeks ?? []}
        defaultWeekLabel={
          syncStatus?.default_week?.week_label || activeWeekLabel || ''
        }
        onTriggered={(res) => {
          setSyncCompletedNotice(null);
          setJustTriggeredInfo({
            week_label: res.week_label,
            coverage: res.coverage,
          });
          fetchSyncStatus();
        }}
      />
    </div>
  );
}
