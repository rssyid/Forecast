import pg from 'pg';
import { applyStationTableFilters } from './analysis/filters';
import { isDateWithinWeek } from './analysis/week';

export { applyStationTableFilters };
import {
  COVERAGES,
  type AccuracyKpi,
  type AccuracyWeekOption,
  type AnalyzedPointCheck,
  type AnalyzedRainCheck,
  type AnalyzedStationSnapshot,
  type CalibrationStatus,
  type CoverageFreshness,
  type CoverageRunStatus,
  type CoverageStat,
  type DiffBucket,
  type RainFilterValue,
  type RainStatus,
  type RunMetaSummary,
  type RunStatus,
  type SeriesIotPoint,
  type SeriesRainPoint,
  type SparklinePoint,
  type StationDetailApiResponse,
  type SummaryApiResponse,
  type SummaryFilterOptions,
  type TriggerSource,
  type WeekComparisonDelta,
} from './types';

const { Pool } = pg;

declare global {
  // eslint-disable-next-line no-var
  var __forecastAccuracyPool: pg.Pool | undefined;
}

export function getAccuracyPool(): pg.Pool {
  if (!process.env.DATABASE_URL) {
    throw new Error('DATABASE_URL belum dikonfigurasi.');
  }
  if (!globalThis.__forecastAccuracyPool) {
    globalThis.__forecastAccuracyPool = new Pool({
      connectionString: process.env.DATABASE_URL,
      ssl: { rejectUnauthorized: false },
      max: 10,
    });
  }
  return globalThis.__forecastAccuracyPool;
}

function toNum(val: unknown): number | null {
  if (val === null || val === undefined || val === '') return null;
  const n = Number(val);
  return Number.isFinite(n) ? n : null;
}

function toIso(val: unknown): string | null {
  if (!val) return null;
  if (val instanceof Date) {
    return Number.isNaN(val.getTime()) ? null : val.toISOString();
  }
  const d = new Date(String(val));
  return Number.isNaN(d.getTime()) ? null : d.toISOString();
}

function parseSparkline(raw: unknown): SparklinePoint[] {
  if (!Array.isArray(raw)) return [];
  return raw
    .filter(
      (item): item is { d: unknown; v: unknown } =>
        typeof item === 'object' && item !== null && 'd' in item && 'v' in item
    )
    .map((item) => ({
      d: String(item.d),
      v: Number(item.v),
    }))
    .filter((item) => Number.isFinite(item.v));
}

function mapSnapshotRow(row: Record<string, unknown>): AnalyzedStationSnapshot {
  const latestManualCm = toNum(row.latest_manual_cm);
  const latestIotCm = toNum(row.latest_iot_cm);
  const storedSigned = toNum(row.signed_diff_cm);
  const signedDiff =
    storedSigned !== null
      ? storedSigned
      : latestIotCm !== null && latestManualCm !== null
        ? Math.round((latestIotCm - latestManualCm) * 100) / 100
        : null;

  return {
    coverage: String(row.coverage),
    piezo_id: String(row.piezo_id),
    kebun: String(row.kebun ?? ''),
    block: String(row.block ?? ''),
    jenis: String(row.jenis ?? ''),
    device_id: String(row.device_id ?? ''),
    device_name: String(row.device_name ?? ''),
    kalibrasi: toNum(row.kalibrasi),
    status_kalibrasi: String(row.status_kalibrasi) as CalibrationStatus,
    status_hujan: String(row.status_hujan) as RainStatus,
    has_rain_station: Boolean(row.has_rain_station),
    rain_station_id: row.rain_station_id ? String(row.rain_station_id) : null,
    latest_manual_at: toIso(row.latest_manual_at),
    latest_manual_cm: latestManualCm,
    latest_iot_cm: latestIotCm,
    latest_diff_cm: toNum(row.latest_diff_cm),
    signed_diff_cm: signedDiff,
    total_points: Number(row.total_points ?? 0),
    avg_diff_cm: toNum(row.avg_diff_cm),
    max_diff_cm: toNum(row.max_diff_cm),
    rain_events: Number(row.rain_events ?? 0),
    rain_responded: Number(row.rain_responded ?? 0),
    narrative: String(row.narrative ?? ''),
    sparkline_json: parseSparkline(row.sparkline_json),
    period_from: String(row.period_from ?? ''),
    period_to: String(row.period_to ?? ''),
  };
}

export async function getAvailableRuns(limit = 20): Promise<RunMetaSummary[]> {
  const pool = getAccuracyPool();
  const res = await pool.query(
    `
    SELECT
      run_id,
      period_from::text AS period_from,
      period_to::text AS period_to,
      started_at,
      finished_at,
      status,
      week_name,
      week_label,
      week_start::text AS week_start,
      week_end::text AS week_end,
      COALESCE(trigger_source, 'cli') AS trigger_source
    FROM run_meta
    WHERE status IN ('success', 'partial')
    ORDER BY started_at DESC
    LIMIT $1
    `,
    [limit]
  );

  return res.rows.map((r) => ({
    run_id: String(r.run_id),
    period_from: String(r.period_from),
    period_to: String(r.period_to),
    started_at: toIso(r.started_at) ?? new Date().toISOString(),
    finished_at: toIso(r.finished_at),
    status: String(r.status) as RunStatus,
    week_name: r.week_name ? String(r.week_name) : null,
    week_label: r.week_label ? String(r.week_label) : null,
    week_start: r.week_start ? String(r.week_start) : null,
    week_end: r.week_end ? String(r.week_end) : null,
    trigger_source: (r.trigger_source ? String(r.trigger_source) : 'cli') as TriggerSource,
  }));
}

export async function getAvailableAccuracyWeeks(
  pool: pg.Pool,
  limit = 24
): Promise<AccuracyWeekOption[]> {
  const res = await pool.query(
    `
    WITH cov_ok AS (
      SELECT DISTINCT ON (week_label, coverage)
        week_label,
        coverage,
        run_id,
        finished_at,
        started_at
      FROM coverage_run
      WHERE status = 'success' AND week_label IS NOT NULL
      ORDER BY week_label, coverage, finished_at DESC NULLS LAST, started_at DESC
    ),
    week_runs AS (
      SELECT
        rm.week_label,
        MAX(rm.week_name) AS week_name,
        MIN(rm.week_start)::text AS week_start,
        MAX(rm.week_end)::text AS week_end,
        (ARRAY_AGG(rm.run_id ORDER BY rm.started_at DESC))[1] AS latest_run_id,
        MAX(COALESCE(rm.finished_at, rm.started_at)) AS last_updated_at,
        (ARRAY_AGG(rm.status ORDER BY rm.started_at DESC))[1] AS latest_status
      FROM run_meta rm
      WHERE rm.week_label IS NOT NULL
        AND rm.status IN ('success', 'partial')
      GROUP BY rm.week_label
    )
    SELECT
      wr.week_name,
      wr.week_label,
      wr.week_start,
      wr.week_end,
      wr.latest_run_id,
      wr.last_updated_at,
      wr.latest_status,
      COUNT(co.coverage)::int AS coverage_ok
    FROM week_runs wr
    INNER JOIN cov_ok co ON co.week_label = wr.week_label
    GROUP BY
      wr.week_name,
      wr.week_label,
      wr.week_start,
      wr.week_end,
      wr.latest_run_id,
      wr.last_updated_at,
      wr.latest_status
    ORDER BY wr.week_start DESC NULLS LAST, wr.last_updated_at DESC
    LIMIT $1
    `,
    [limit]
  );

  return res.rows.map((r) => ({
    week_name: String(r.week_name ?? r.week_label),
    week_label: String(r.week_label),
    week_start: String(r.week_start ?? ''),
    week_end: String(r.week_end ?? ''),
    latest_run_id: r.latest_run_id ? String(r.latest_run_id) : null,
    last_updated_at: toIso(r.last_updated_at),
    status: r.latest_status ? (String(r.latest_status) as RunStatus) : null,
    coverage_ok: Number(r.coverage_ok ?? 0),
    coverage_total: COVERAGES.length,
  }));
}

async function getCoverageFreshness(
  pool: pg.Pool,
  scope?: { runId?: string; weekLabel?: string | null }
): Promise<CoverageFreshness[]> {
  const runId = scope?.runId;
  const weekLabel = scope?.weekLabel ?? null;

  const latestSuccessRes = runId
    ? await pool.query(
        `
        SELECT
          coverage,
          run_id,
          status,
          station_count,
          period_from::text AS period_from,
          period_to::text AS period_to,
          finished_at,
          started_at,
          error
        FROM coverage_run
        WHERE run_id = $1
        `,
        [runId]
      )
    : weekLabel
      ? await pool.query(
          `
          SELECT DISTINCT ON (coverage)
            coverage,
            run_id,
            status,
            station_count,
            period_from::text AS period_from,
            period_to::text AS period_to,
            finished_at,
            started_at,
            error
          FROM coverage_run
          WHERE status = 'success' AND week_label = $1
          ORDER BY coverage, finished_at DESC NULLS LAST, started_at DESC
          `,
          [weekLabel]
        )
      : await pool.query(
          `
          SELECT DISTINCT ON (coverage)
            coverage,
            run_id,
            status,
            station_count,
            period_from::text AS period_from,
            period_to::text AS period_to,
            finished_at,
            started_at,
            error
          FROM coverage_run
          WHERE status = 'success'
          ORDER BY coverage, finished_at DESC NULLS LAST, started_at DESC
          `
        );

  const latestAttemptRes = weekLabel && !runId
    ? await pool.query(
        `
        SELECT DISTINCT ON (coverage)
          coverage,
          run_id,
          status,
          station_count,
          finished_at,
          started_at,
          error
        FROM coverage_run
        WHERE week_label = $1
        ORDER BY coverage, started_at DESC
        `,
        [weekLabel]
      )
    : await pool.query(`
        SELECT DISTINCT ON (coverage)
          coverage,
          run_id,
          status,
          station_count,
          finished_at,
          started_at,
          error
        FROM coverage_run
        ORDER BY coverage, started_at DESC
      `);

  const successByCov = new Map<string, Record<string, unknown>>();
  for (const row of latestSuccessRes.rows) {
    successByCov.set(String(row.coverage), row);
  }

  const attemptByCov = new Map<string, Record<string, unknown>>();
  for (const row of latestAttemptRes.rows) {
    attemptByCov.set(String(row.coverage), row);
  }

  const allCovs = Array.from(
    new Set([...COVERAGES, ...successByCov.keys(), ...attemptByCov.keys()])
  );

  return allCovs.map((cov) => {
    const succ = successByCov.get(cov);
    const att = attemptByCov.get(cov);
    const attStatus = att ? (String(att.status) as CoverageRunStatus) : null;
    const isStaleFallback =
      !runId &&
      Boolean(att) &&
      attStatus === 'failed' &&
      Boolean(succ) &&
      succ?.run_id !== att?.run_id;

    return {
      coverage: cov,
      latest_attempt_run_id: att ? String(att.run_id) : null,
      latest_attempt_status: attStatus,
      latest_attempt_at: att ? toIso(att.finished_at ?? att.started_at) : null,
      latest_attempt_error: att?.error ? String(att.error) : null,
      serving_run_id: succ ? String(succ.run_id) : null,
      serving_finished_at: succ ? toIso(succ.finished_at ?? succ.started_at) : null,
      serving_period_from: succ?.period_from ? String(succ.period_from) : null,
      serving_period_to: succ?.period_to ? String(succ.period_to) : null,
      station_count: succ ? Number(succ.station_count ?? 0) : 0,
      is_stale_fallback: isStaleFallback,
    };
  });
}

export interface SummaryFilters {
  week?: string;
  runId?: string;
  coverage?: string;
  kebun?: string;
  jenis?: string;
  calibrationStatus?: CalibrationStatus;
  rainStatus?: RainFilterValue;
  diffBucket?: DiffBucket;
  dateFrom?: string;
  dateTo?: string;
  anomalyOnly?: boolean;
  search?: string;
}

function buildCoverageStats(
  stations: AnalyzedStationSnapshot[],
  allCoverages: readonly string[]
): CoverageStat[] {
  const grouped = new Map<string, AnalyzedStationSnapshot[]>();
  for (const cov of allCoverages) {
    grouped.set(cov, []);
  }
  for (const st of stations) {
    const arr = grouped.get(st.coverage);
    if (arr) arr.push(st);
    else grouped.set(st.coverage, [st]);
  }

  return Array.from(grouped.entries()).map(([cov, list]) => {
    const passed = list.filter(
      (s) => s.status_kalibrasi === 'LOLOS / AKURAT'
    ).length;
    const failed = list.filter(
      (s) => s.status_kalibrasi === 'PERLU KALIBRASI ULANG'
    ).length;
    const noManual = list.filter(
      (s) => s.status_kalibrasi === 'TIDAK ADA DATA MANUAL'
    ).length;
    const rainAnom = list.filter(
      (s) => s.status_hujan === 'ANOMALI RESPON HUJAN'
    ).length;
    const evaluated = passed + failed;
    const accuracyPct =
      evaluated > 0 ? Math.round((passed / evaluated) * 1000) / 10 : 0;

    return {
      coverage: cov,
      total_stations: list.length,
      passed_stations: passed,
      failed_stations: failed,
      no_manual_stations: noManual,
      accuracy_pct: accuracyPct,
      rain_anomaly_stations: rainAnom,
    };
  });
}

function computeKpi(stations: AnalyzedStationSnapshot[]): AccuracyKpi {
  const total = stations.length;
  const passed = stations.filter(
    (s) => s.status_kalibrasi === 'LOLOS / AKURAT'
  ).length;
  const failed = stations.filter(
    (s) => s.status_kalibrasi === 'PERLU KALIBRASI ULANG'
  ).length;
  const noManual = stations.filter(
    (s) => s.status_kalibrasi === 'TIDAK ADA DATA MANUAL'
  ).length;
  const rainAnom = stations.filter(
    (s) => s.status_hujan === 'ANOMALI RESPON HUJAN'
  ).length;
  const noRainStation = stations.filter((s) => !s.has_rain_station).length;
  const evaluated = passed + failed;
  const accuracyPct =
    evaluated > 0 ? Math.round((passed / evaluated) * 1000) / 10 : 0;

  return {
    total_stations: total,
    evaluated_stations: evaluated,
    passed_stations: passed,
    recalibration_needed: failed,
    no_manual_data: noManual,
    accuracy_pct: accuracyPct,
    rain_anomaly_count: rainAnom,
    no_rain_station_count: noRainStation,
  };
}

function buildFilterOptions(
  coverageScoped: AnalyzedStationSnapshot[]
): SummaryFilterOptions {
  const kebuns = Array.from(
    new Set(
      coverageScoped
        .map((s) => s.kebun.trim())
        .filter((k) => k.length > 0)
    )
  ).sort((a, b) => a.localeCompare(b));

  const jenisList = Array.from(
    new Set(
      coverageScoped
        .map((s) => s.jenis.trim())
        .filter((j) => j.length > 0)
    )
  ).sort((a, b) => a.localeCompare(b));

  return {
    kebuns,
    jenis_list: jenisList,
    total_unfiltered_in_scope: coverageScoped.length,
    status_counts: {
      all: coverageScoped.length,
      recalibration: coverageScoped.filter(
        (s) => s.status_kalibrasi === 'PERLU KALIBRASI ULANG'
      ).length,
      rain_anomaly: coverageScoped.filter(
        (s) => s.status_hujan === 'ANOMALI RESPON HUJAN'
      ).length,
      passed: coverageScoped.filter(
        (s) => s.status_kalibrasi === 'LOLOS / AKURAT'
      ).length,
      no_manual: coverageScoped.filter(
        (s) => s.status_kalibrasi === 'TIDAK ADA DATA MANUAL'
      ).length,
    },
  };
}

async function computeWeekComparison(
  pool: pg.Pool,
  currentStations: AnalyzedStationSnapshot[],
  currentKpi: AccuracyKpi,
  prevWeek: AccuracyWeekOption | undefined,
  cleanCoverage?: string
): Promise<WeekComparisonDelta | null> {
  if (!prevWeek) return null;

  const args: unknown[] = [prevWeek.week_label];
  const covClause = cleanCoverage ? `AND s.coverage = $2` : '';
  if (cleanCoverage) args.push(cleanCoverage);

  const prevRes = await pool.query(
    `
    WITH prev_cov_run AS (
      SELECT DISTINCT ON (coverage) coverage, run_id
      FROM coverage_run
      WHERE status = 'success' AND week_label = $1
      ORDER BY coverage, finished_at DESC NULLS LAST, started_at DESC
    )
    SELECT s.piezo_id, s.status_kalibrasi, s.status_hujan, s.has_rain_station
    FROM station_snapshot s
    INNER JOIN prev_cov_run pcr
      ON pcr.run_id = s.run_id AND pcr.coverage = s.coverage
    WHERE 1=1 ${covClause}
    `,
    args
  );

  if (prevRes.rows.length === 0) return null;

  const prevRows = prevRes.rows.map((r) => ({
    piezo_id: String(r.piezo_id),
    status_kalibrasi: String(r.status_kalibrasi) as CalibrationStatus,
    status_hujan: String(r.status_hujan) as RainStatus,
    has_rain_station: Boolean(r.has_rain_station),
  }));

  const prevPassed = prevRows.filter(
    (s) => s.status_kalibrasi === 'LOLOS / AKURAT'
  ).length;
  const prevFailed = prevRows.filter(
    (s) => s.status_kalibrasi === 'PERLU KALIBRASI ULANG'
  ).length;
  const prevEvaluated = prevPassed + prevFailed;
  const prevAccuracyPct =
    prevEvaluated > 0 ? Math.round((prevPassed / prevEvaluated) * 1000) / 10 : 0;
  const prevRainAnom = prevRows.filter(
    (s) => s.status_hujan === 'ANOMALI RESPON HUJAN'
  ).length;

  const prevFailedIds = new Set(
    prevRows
      .filter((s) => s.status_kalibrasi === 'PERLU KALIBRASI ULANG')
      .map((s) => s.piezo_id)
  );
  const currFailedIds = new Set(
    currentStations
      .filter((s) => s.status_kalibrasi === 'PERLU KALIBRASI ULANG')
      .map((s) => s.piezo_id)
  );
  const currPassedIds = new Set(
    currentStations
      .filter((s) => s.status_kalibrasi === 'LOLOS / AKURAT')
      .map((s) => s.piezo_id)
  );

  let newlyFailedCount = 0;
  for (const id of currFailedIds) {
    if (!prevFailedIds.has(id)) newlyFailedCount += 1;
  }

  let resolvedCount = 0;
  for (const id of prevFailedIds) {
    if (currPassedIds.has(id)) resolvedCount += 1;
  }

  return {
    previous_week_label: prevWeek.week_label,
    previous_accuracy_pct: prevAccuracyPct,
    accuracy_pct_delta:
      Math.round((currentKpi.accuracy_pct - prevAccuracyPct) * 10) / 10,
    previous_recalibration_needed: prevFailed,
    recalibration_delta: currentKpi.recalibration_needed - prevFailed,
    previous_rain_anomaly_count: prevRainAnom,
    rain_anomaly_delta: currentKpi.rain_anomaly_count - prevRainAnom,
    newly_failed_count: newlyFailedCount,
    resolved_count: resolvedCount,
  };
}

export async function getSummaryData(
  filters: SummaryFilters = {}
): Promise<SummaryApiResponse & { _resolvedWeekLabel?: string | null }> {
  const pool = getAccuracyPool();
  const cleanRunId = filters.runId?.trim() || undefined;
  const cleanWeekInput = filters.week?.trim() || undefined;
  const cleanCoverage =
    filters.coverage && filters.coverage !== 'all'
      ? filters.coverage.trim()
      : undefined;

  const [availableRuns, availableWeeks] = await Promise.all([
    getAvailableRuns(20),
    getAvailableAccuracyWeeks(pool, 24),
  ]);

  let activeWeek: AccuracyWeekOption | null = null;
  if (cleanRunId) {
    const matchedRun = availableRuns.find((r) => r.run_id === cleanRunId);
    if (matchedRun?.week_label) {
      activeWeek =
        availableWeeks.find((w) => w.week_label === matchedRun.week_label) ?? {
          week_name: matchedRun.week_name ?? matchedRun.week_label,
          week_label: matchedRun.week_label,
          week_start: matchedRun.week_start ?? '',
          week_end: matchedRun.week_end ?? '',
          latest_run_id: matchedRun.run_id,
          last_updated_at: matchedRun.finished_at ?? matchedRun.started_at,
          status: matchedRun.status,
          coverage_ok: 0,
          coverage_total: COVERAGES.length,
        };
    }
  } else if (cleanWeekInput) {
    activeWeek =
      availableWeeks.find(
        (w) => w.week_label === cleanWeekInput || w.week_name === cleanWeekInput
      ) ?? null;
  } else if (availableWeeks.length > 0) {
    activeWeek = availableWeeks[0];
  }

  const targetWeekLabel = !cleanRunId
    ? activeWeek?.week_label ?? cleanWeekInput ?? null
    : null;

  const coverageFreshness = await getCoverageFreshness(pool, {
    runId: cleanRunId,
    weekLabel: targetWeekLabel,
  });

  const params: unknown[] = [];
  const whereClauses: string[] = [];
  let baseCte: string;

  if (cleanRunId) {
    params.push(cleanRunId);
    whereClauses.push(`s.run_id = $${params.length}`);
    baseCte = `
      SELECT
        s.*,
        s.period_from::text AS period_from_txt,
        s.period_to::text AS period_to_txt
      FROM station_snapshot s
    `;
  } else if (targetWeekLabel) {
    params.push(targetWeekLabel);
    baseCte = `
      WITH latest_coverage_run AS (
        SELECT DISTINCT ON (coverage)
          coverage,
          run_id
        FROM coverage_run
        WHERE status = 'success' AND week_label = $1
        ORDER BY coverage, finished_at DESC NULLS LAST, started_at DESC
      )
      SELECT
        s.*,
        s.period_from::text AS period_from_txt,
        s.period_to::text AS period_to_txt
      FROM station_snapshot s
      INNER JOIN latest_coverage_run lcr
        ON lcr.run_id = s.run_id AND lcr.coverage = s.coverage
    `;
  } else {
    baseCte = `
      WITH latest_coverage_run AS (
        SELECT DISTINCT ON (coverage)
          coverage,
          run_id
        FROM coverage_run
        WHERE status = 'success'
        ORDER BY coverage, finished_at DESC NULLS LAST, started_at DESC
      )
      SELECT
        s.*,
        s.period_from::text AS period_from_txt,
        s.period_to::text AS period_to_txt
      FROM station_snapshot s
      INNER JOIN latest_coverage_run lcr
        ON lcr.run_id = s.run_id AND lcr.coverage = s.coverage
    `;
  }

  if (filters.dateFrom) {
    params.push(filters.dateFrom);
    whereClauses.push(
      `s.latest_manual_at IS NOT NULL AND (s.latest_manual_at AT TIME ZONE 'Asia/Jakarta')::date >= $${params.length}::date`
    );
  }

  if (filters.dateTo) {
    params.push(filters.dateTo);
    whereClauses.push(
      `s.latest_manual_at IS NOT NULL AND (s.latest_manual_at AT TIME ZONE 'Asia/Jakarta')::date <= $${params.length}::date`
    );
  }

  const whereSql =
    whereClauses.length > 0 ? `WHERE ${whereClauses.join(' AND ')}` : '';

  const snapshotRes = await pool.query(
    `
    ${baseCte}
    ${whereSql}
    ORDER BY
      CASE WHEN s.status_kalibrasi = 'PERLU KALIBRASI ULANG' THEN 0
           WHEN s.status_hujan = 'ANOMALI RESPON HUJAN' THEN 1
           WHEN s.status_kalibrasi = 'TIDAK ADA DATA MANUAL' THEN 2
           ELSE 3 END,
      COALESCE(s.latest_diff_cm, -1) DESC,
      s.coverage ASC,
      s.piezo_id ASC
    `,
    params
  );

  const activeWeekStart = activeWeek?.week_start || null;
  const activeWeekEnd = activeWeek?.week_end || null;

  const snapshotAll = snapshotRes.rows.map((r) => {
    const mapped = mapSnapshotRow({
      ...r,
      period_from: r.period_from_txt,
      period_to: r.period_to_txt,
    });
    return {
      ...mapped,
      manual_in_active_week:
        activeWeekStart && activeWeekEnd
          ? isDateWithinWeek(mapped.latest_manual_at, activeWeekStart, activeWeekEnd)
          : undefined,
    };
  });

  const coverageList = Array.from(
    new Set([...COVERAGES, ...snapshotAll.map((s) => s.coverage)])
  );
  const coverageStats = buildCoverageStats(snapshotAll, coverageList);

  const coverageScoped = cleanCoverage
    ? snapshotAll.filter((s) => s.coverage === cleanCoverage)
    : snapshotAll;

  const kpi = computeKpi(coverageScoped);
  const filterOptions = buildFilterOptions(coverageScoped);
  const stations = applyStationTableFilters(coverageScoped, filters);

  const currentWeekIdx = activeWeek
    ? availableWeeks.findIndex((w) => w.week_label === activeWeek?.week_label)
    : -1;
  const prevWeek =
    !cleanRunId && currentWeekIdx >= 0 && currentWeekIdx + 1 < availableWeeks.length
      ? availableWeeks[currentWeekIdx + 1]
      : undefined;

  const weekComparison = await computeWeekComparison(
    pool,
    coverageScoped,
    kpi,
    prevWeek,
    cleanCoverage
  );

  const servingDates = coverageFreshness
    .map((f) => f.serving_finished_at)
    .filter((v): v is string => Boolean(v))
    .sort();
  const lastUpdatedAt =
    servingDates.length > 0 ? servingDates[servingDates.length - 1] : null;

  const periodFrom =
    snapshotAll[0]?.period_from ??
    coverageFreshness.find((f) => f.serving_period_from)?.serving_period_from ??
    availableRuns[0]?.period_from ??
    null;
  const periodTo =
    snapshotAll[0]?.period_to ??
    coverageFreshness.find((f) => f.serving_period_to)?.serving_period_to ??
    availableRuns[0]?.period_to ??
    null;

  const hasData =
    availableWeeks.length > 0 ||
    coverageFreshness.some((f) => f.serving_run_id !== null) ||
    snapshotAll.length > 0;

  return {
    meta: {
      has_data: hasData,
      active_run_id:
        cleanRunId ?? activeWeek?.latest_run_id ?? availableRuns[0]?.run_id ?? null,
      active_week_label: activeWeek?.week_label ?? cleanWeekInput ?? null,
      active_week_name: activeWeek?.week_name ?? null,
      active_week_start: activeWeekStart,
      active_week_end: activeWeekEnd,
      last_updated_at: lastUpdatedAt,
      period_from: periodFrom,
      period_to: periodTo,
      available_runs: availableRuns,
      available_weeks: availableWeeks,
      coverage_freshness: coverageFreshness,
    },
    kpi,
    week_comparison: weekComparison,
    filter_options: filterOptions,
    coverage_stats: coverageStats,
    stations,
    _resolvedWeekLabel: targetWeekLabel,
  };
}

export async function getStationDetail(
  piezoId: string,
  options?: string | { runId?: string; week?: string }
): Promise<StationDetailApiResponse | null> {
  const pool = getAccuracyPool();
  const cleanId = piezoId.trim();
  if (!cleanId) return null;

  const runId = typeof options === 'string' ? options : options?.runId?.trim();
  const week = typeof options === 'string' ? undefined : options?.week?.trim();

  let snapQuery: string;
  let snapParams: unknown[];

  if (runId) {
    snapQuery = `
      SELECT s.*, s.period_from::text AS period_from_txt, s.period_to::text AS period_to_txt,
             rm.week_name, rm.week_label, rm.week_start::text AS week_start, rm.week_end::text AS week_end
      FROM station_snapshot s
      INNER JOIN run_meta rm ON rm.run_id = s.run_id
      WHERE s.run_id = $1 AND s.piezo_id = $2
      LIMIT 1
    `;
    snapParams = [runId, cleanId];
  } else if (week) {
    snapQuery = `
      SELECT s.*, s.period_from::text AS period_from_txt, s.period_to::text AS period_to_txt,
             rm.week_name, rm.week_label, rm.week_start::text AS week_start, rm.week_end::text AS week_end
      FROM station_snapshot s
      INNER JOIN coverage_run cr
        ON cr.run_id = s.run_id AND cr.coverage = s.coverage
      INNER JOIN run_meta rm ON rm.run_id = s.run_id
      WHERE s.piezo_id = $1
        AND cr.status = 'success'
        AND (cr.week_label = $2 OR cr.week_name = $2)
      ORDER BY cr.finished_at DESC NULLS LAST, s.created_at DESC
      LIMIT 1
    `;
    snapParams = [cleanId, week];
  } else {
    snapQuery = `
      SELECT s.*, s.period_from::text AS period_from_txt, s.period_to::text AS period_to_txt,
             rm.week_name, rm.week_label, rm.week_start::text AS week_start, rm.week_end::text AS week_end
      FROM station_snapshot s
      INNER JOIN coverage_run cr
        ON cr.run_id = s.run_id AND cr.coverage = s.coverage
      INNER JOIN run_meta rm ON rm.run_id = s.run_id
      WHERE s.piezo_id = $1 AND cr.status = 'success'
      ORDER BY cr.finished_at DESC NULLS LAST, s.created_at DESC
      LIMIT 1
    `;
    snapParams = [cleanId];
  }

  const snapRes = await pool.query(snapQuery, snapParams);

  if (snapRes.rows.length === 0) {
    return null;
  }

  const rawSnap = snapRes.rows[0];
  const resolvedRunId = String(rawSnap.run_id);
  const snapshotBase = mapSnapshotRow({
    ...rawSnap,
    period_from: rawSnap.period_from_txt,
    period_to: rawSnap.period_to_txt,
  });
  const weekStart = rawSnap.week_start ? String(rawSnap.week_start) : null;
  const weekEnd = rawSnap.week_end ? String(rawSnap.week_end) : null;

  const [pointsRes, rainRes, iotSeriesRes, rainSeriesRes, freshnessAll] =
    await Promise.all([
      pool.query(
        `
        SELECT coverage, piezo_id, manual_at, manual_cm, iot_at, iot_cm,
               delta_hours, diff_cm, exceeded, is_latest
        FROM point_check
        WHERE run_id = $1 AND piezo_id = $2
        ORDER BY manual_at ASC
        `,
        [resolvedRunId, cleanId]
      ),
      pool.query(
        `
        SELECT coverage, piezo_id, rain_at, rain_mm, base_cm, min_cm, rise_cm, responded
        FROM rain_check
        WHERE run_id = $1 AND piezo_id = $2
        ORDER BY rain_at ASC
        `,
        [resolvedRunId, cleanId]
      ),
      pool.query(
        `
        SELECT ts, cm
        FROM series_iot
        WHERE run_id = $1 AND piezo_id = $2
        ORDER BY ts ASC
        `,
        [resolvedRunId, cleanId]
      ),
      pool.query(
        `
        SELECT ts, mm
        FROM series_rain
        WHERE run_id = $1 AND piezo_id = $2
        ORDER BY ts ASC
        `,
        [resolvedRunId, cleanId]
      ),
      getCoverageFreshness(pool, {
        runId,
        weekLabel: rawSnap.week_label ? String(rawSnap.week_label) : null,
      }),
    ]);

  const points: AnalyzedPointCheck[] = pointsRes.rows.map((r) => ({
    coverage: String(r.coverage),
    piezo_id: String(r.piezo_id),
    manual_at: toIso(r.manual_at) ?? '',
    manual_cm: Number(r.manual_cm),
    iot_at: toIso(r.iot_at) ?? '',
    iot_cm: Number(r.iot_cm),
    delta_hours: Number(r.delta_hours),
    diff_cm: Number(r.diff_cm),
    exceeded: Boolean(r.exceeded),
    is_latest: Boolean(r.is_latest),
  }));

  const rainEvents: AnalyzedRainCheck[] = rainRes.rows.map((r) => ({
    coverage: String(r.coverage),
    piezo_id: String(r.piezo_id),
    rain_at: toIso(r.rain_at) ?? '',
    rain_mm: Number(r.rain_mm),
    base_cm: Number(r.base_cm),
    min_cm: Number(r.min_cm),
    rise_cm: Number(r.rise_cm),
    responded: Boolean(r.responded),
  }));

  const seriesIot: SeriesIotPoint[] = iotSeriesRes.rows.map((r) => ({
    ts: toIso(r.ts) ?? '',
    cm: Number(r.cm),
  }));

  const seriesRain: SeriesRainPoint[] = rainSeriesRes.rows.map((r) => ({
    ts: toIso(r.ts) ?? '',
    mm: Number(r.mm),
  }));

  const freshness =
    freshnessAll.find((f) => f.coverage === snapshotBase.coverage) ?? null;

  return {
    snapshot: {
      ...snapshotBase,
      manual_in_active_week:
        weekStart && weekEnd
          ? isDateWithinWeek(snapshotBase.latest_manual_at, weekStart, weekEnd)
          : undefined,
      run_id: resolvedRunId,
      created_at: toIso(rawSnap.created_at) ?? new Date().toISOString(),
      week_name: rawSnap.week_name ? String(rawSnap.week_name) : null,
      week_label: rawSnap.week_label ? String(rawSnap.week_label) : null,
      week_start: weekStart,
      week_end: weekEnd,
    },
    points,
    rain_events: rainEvents,
    series_iot: seriesIot,
    series_rain: seriesRain,
    freshness,
  };
}

export async function getExportBundle(filters: SummaryFilters = {}): Promise<{
  summary: SummaryApiResponse;
  points: AnalyzedPointCheck[];
  rainEvents: AnalyzedRainCheck[];
}> {
  const pool = getAccuracyPool();
  const summaryWithMeta = await getSummaryData(filters);
  const targetWeekLabel = summaryWithMeta._resolvedWeekLabel ?? null;
  const { _resolvedWeekLabel: _omit, ...summary } = summaryWithMeta;
  const cleanRunId = filters.runId?.trim() || undefined;

  if (summary.stations.length === 0) {
    return { summary, points: [], rainEvents: [] };
  }

  const piezoIds = summary.stations.map((s) => s.piezo_id);

  let pointsQuery: string;
  let rainQuery: string;
  let queryArgs: unknown[];

  if (cleanRunId) {
    pointsQuery = `
      SELECT coverage, piezo_id, manual_at, manual_cm, iot_at, iot_cm,
             delta_hours, diff_cm, exceeded, is_latest
      FROM point_check
      WHERE run_id = $1 AND piezo_id = ANY($2::text[])
      ORDER BY coverage ASC, piezo_id ASC, manual_at ASC
    `;
    rainQuery = `
      SELECT coverage, piezo_id, rain_at, rain_mm, base_cm, min_cm, rise_cm, responded
      FROM rain_check
      WHERE run_id = $1 AND piezo_id = ANY($2::text[])
      ORDER BY coverage ASC, piezo_id ASC, rain_at ASC
    `;
    queryArgs = [cleanRunId, piezoIds];
  } else if (targetWeekLabel) {
    pointsQuery = `
      WITH latest_coverage_run AS (
        SELECT DISTINCT ON (coverage) coverage, run_id
        FROM coverage_run
        WHERE status = 'success' AND week_label = $1
        ORDER BY coverage, finished_at DESC NULLS LAST, started_at DESC
      )
      SELECT p.coverage, p.piezo_id, p.manual_at, p.manual_cm, p.iot_at, p.iot_cm,
             p.delta_hours, p.diff_cm, p.exceeded, p.is_latest
      FROM point_check p
      INNER JOIN latest_coverage_run lcr
        ON lcr.run_id = p.run_id AND lcr.coverage = p.coverage
      WHERE p.piezo_id = ANY($2::text[])
      ORDER BY p.coverage ASC, p.piezo_id ASC, p.manual_at ASC
    `;
    rainQuery = `
      WITH latest_coverage_run AS (
        SELECT DISTINCT ON (coverage) coverage, run_id
        FROM coverage_run
        WHERE status = 'success' AND week_label = $1
        ORDER BY coverage, finished_at DESC NULLS LAST, started_at DESC
      )
      SELECT r.coverage, r.piezo_id, r.rain_at, r.rain_mm, r.base_cm, r.min_cm, r.rise_cm, r.responded
      FROM rain_check r
      INNER JOIN latest_coverage_run lcr
        ON lcr.run_id = r.run_id AND lcr.coverage = r.coverage
      WHERE r.piezo_id = ANY($2::text[])
      ORDER BY r.coverage ASC, r.piezo_id ASC, r.rain_at ASC
    `;
    queryArgs = [targetWeekLabel, piezoIds];
  } else {
    pointsQuery = `
      WITH latest_coverage_run AS (
        SELECT DISTINCT ON (coverage) coverage, run_id
        FROM coverage_run
        WHERE status = 'success'
        ORDER BY coverage, finished_at DESC NULLS LAST, started_at DESC
      )
      SELECT p.coverage, p.piezo_id, p.manual_at, p.manual_cm, p.iot_at, p.iot_cm,
             p.delta_hours, p.diff_cm, p.exceeded, p.is_latest
      FROM point_check p
      INNER JOIN latest_coverage_run lcr
        ON lcr.run_id = p.run_id AND lcr.coverage = p.coverage
      WHERE p.piezo_id = ANY($1::text[])
      ORDER BY p.coverage ASC, p.piezo_id ASC, p.manual_at ASC
    `;
    rainQuery = `
      WITH latest_coverage_run AS (
        SELECT DISTINCT ON (coverage) coverage, run_id
        FROM coverage_run
        WHERE status = 'success'
        ORDER BY coverage, finished_at DESC NULLS LAST, started_at DESC
      )
      SELECT r.coverage, r.piezo_id, r.rain_at, r.rain_mm, r.base_cm, r.min_cm, r.rise_cm, r.responded
      FROM rain_check r
      INNER JOIN latest_coverage_run lcr
        ON lcr.run_id = r.run_id AND lcr.coverage = r.coverage
      WHERE r.piezo_id = ANY($1::text[])
      ORDER BY r.coverage ASC, r.piezo_id ASC, r.rain_at ASC
    `;
    queryArgs = [piezoIds];
  }

  const [pointsRes, rainRes] = await Promise.all([
    pool.query(pointsQuery, queryArgs),
    pool.query(rainQuery, queryArgs),
  ]);

  const points: AnalyzedPointCheck[] = pointsRes.rows.map((r) => ({
    coverage: String(r.coverage),
    piezo_id: String(r.piezo_id),
    manual_at: toIso(r.manual_at) ?? '',
    manual_cm: Number(r.manual_cm),
    iot_at: toIso(r.iot_at) ?? '',
    iot_cm: Number(r.iot_cm),
    delta_hours: Number(r.delta_hours),
    diff_cm: Number(r.diff_cm),
    exceeded: Boolean(r.exceeded),
    is_latest: Boolean(r.is_latest),
  }));

  const rainEvents: AnalyzedRainCheck[] = rainRes.rows.map((r) => ({
    coverage: String(r.coverage),
    piezo_id: String(r.piezo_id),
    rain_at: toIso(r.rain_at) ?? '',
    rain_mm: Number(r.rain_mm),
    base_cm: Number(r.base_cm),
    min_cm: Number(r.min_cm),
    rise_cm: Number(r.rise_cm),
    responded: Boolean(r.responded),
  }));

  return { summary, points, rainEvents };
}
