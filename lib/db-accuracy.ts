import pg from 'pg';
import {
  COVERAGES,
  type AccuracyKpi,
  type AnalyzedPointCheck,
  type AnalyzedRainCheck,
  type AnalyzedStationSnapshot,
  type CalibrationStatus,
  type CoverageFreshness,
  type CoverageRunStatus,
  type CoverageStat,
  type RainStatus,
  type RunMetaSummary,
  type RunStatus,
  type SeriesIotPoint,
  type SeriesRainPoint,
  type SparklinePoint,
  type StationDetailApiResponse,
  type SummaryApiResponse,
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
      status
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
  }));
}

async function getCoverageFreshness(
  pool: pg.Pool,
  runId?: string
): Promise<CoverageFreshness[]> {
  const latestSuccessRes = await pool.query(
    runId
      ? `
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
        `
      : `
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
        `,
    runId ? [runId] : []
  );

  const latestAttemptRes = await pool.query(`
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
  runId?: string;
  coverage?: string;
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
    const accuracyPct = evaluated > 0 ? Math.round((passed / evaluated) * 1000) / 10 : 0;

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
  const accuracyPct = evaluated > 0 ? Math.round((passed / evaluated) * 1000) / 10 : 0;

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

export async function getSummaryData(
  filters: SummaryFilters = {}
): Promise<SummaryApiResponse> {
  const pool = getAccuracyPool();
  const cleanRunId = filters.runId?.trim() || undefined;
  const cleanCoverage =
    filters.coverage && filters.coverage !== 'all'
      ? filters.coverage.trim()
      : undefined;

  const [availableRuns, coverageFreshness] = await Promise.all([
    getAvailableRuns(20),
    getCoverageFreshness(pool, cleanRunId),
  ]);

  const params: unknown[] = [];
  const whereClauses: string[] = [];

  if (cleanRunId) {
    params.push(cleanRunId);
    whereClauses.push(`s.run_id = $${params.length}`);
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

  const baseCte = cleanRunId
    ? `
      SELECT
        s.*,
        s.period_from::text AS period_from_txt,
        s.period_to::text AS period_to_txt
      FROM station_snapshot s
    `
    : `
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

  const snapshotAll = snapshotRes.rows.map((r) =>
    mapSnapshotRow({
      ...r,
      period_from: r.period_from_txt,
      period_to: r.period_to_txt,
    })
  );

  const coverageList = Array.from(
    new Set([...COVERAGES, ...snapshotAll.map((s) => s.coverage)])
  );
  const coverageStats = buildCoverageStats(snapshotAll, coverageList);

  const coverageScoped = cleanCoverage
    ? snapshotAll.filter((s) => s.coverage === cleanCoverage)
    : snapshotAll;

  const kpi = computeKpi(coverageScoped);

  let stations = coverageScoped;
  if (filters.anomalyOnly) {
    stations = stations.filter(
      (s) =>
        s.status_kalibrasi === 'PERLU KALIBRASI ULANG' ||
        s.status_hujan === 'ANOMALI RESPON HUJAN'
    );
  }
  if (filters.search?.trim()) {
    const q = filters.search.trim().toLowerCase();
    stations = stations.filter((s) =>
      [s.piezo_id, s.kebun, s.block, s.device_name, s.device_id, s.coverage]
        .join(' ')
        .toLowerCase()
        .includes(q)
    );
  }

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
    coverageFreshness.some((f) => f.serving_run_id !== null) ||
    snapshotAll.length > 0;

  return {
    meta: {
      has_data: hasData,
      active_run_id: cleanRunId ?? availableRuns[0]?.run_id ?? null,
      last_updated_at: lastUpdatedAt,
      period_from: periodFrom,
      period_to: periodTo,
      available_runs: availableRuns,
      coverage_freshness: coverageFreshness,
    },
    kpi,
    coverage_stats: coverageStats,
    stations,
  };
}

export async function getStationDetail(
  piezoId: string,
  runId?: string
): Promise<StationDetailApiResponse | null> {
  const pool = getAccuracyPool();
  const cleanId = piezoId.trim();
  if (!cleanId) return null;

  const snapQuery = runId
    ? `
      SELECT s.*, s.period_from::text AS period_from_txt, s.period_to::text AS period_to_txt
      FROM station_snapshot s
      WHERE s.run_id = $1 AND s.piezo_id = $2
      LIMIT 1
    `
    : `
      SELECT s.*, s.period_from::text AS period_from_txt, s.period_to::text AS period_to_txt
      FROM station_snapshot s
      INNER JOIN coverage_run cr
        ON cr.run_id = s.run_id AND cr.coverage = s.coverage
      WHERE s.piezo_id = $1 AND cr.status = 'success'
      ORDER BY cr.finished_at DESC NULLS LAST, s.created_at DESC
      LIMIT 1
    `;

  const snapRes = await pool.query(
    snapQuery,
    runId ? [runId, cleanId] : [cleanId]
  );

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
      getCoverageFreshness(pool),
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
      run_id: resolvedRunId,
      created_at: toIso(rawSnap.created_at) ?? new Date().toISOString(),
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
  const summary = await getSummaryData(filters);
  const cleanRunId = filters.runId?.trim() || undefined;

  if (summary.stations.length === 0) {
    return { summary, points: [], rainEvents: [] };
  }

  const piezoIds = summary.stations.map((s) => s.piezo_id);

  const pointsQuery = cleanRunId
    ? `
      SELECT coverage, piezo_id, manual_at, manual_cm, iot_at, iot_cm,
             delta_hours, diff_cm, exceeded, is_latest
      FROM point_check
      WHERE run_id = $1 AND piezo_id = ANY($2::text[])
      ORDER BY coverage ASC, piezo_id ASC, manual_at ASC
    `
    : `
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

  const rainQuery = cleanRunId
    ? `
      SELECT coverage, piezo_id, rain_at, rain_mm, base_cm, min_cm, rise_cm, responded
      FROM rain_check
      WHERE run_id = $1 AND piezo_id = ANY($2::text[])
      ORDER BY coverage ASC, piezo_id ASC, rain_at ASC
    `
    : `
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

  const queryArgs = cleanRunId ? [cleanRunId, piezoIds] : [piezoIds];
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
