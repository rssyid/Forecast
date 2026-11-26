import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import dotenv from 'dotenv';
import pg from 'pg';
import { analyzeCoverageDataset } from '../lib/analysis/analyze';
import { formatWibDate, getWibDateRange } from '../lib/analysis/date';
import {
  buildFallbackWeekForDate,
  computePeriodForWeek,
  resolveWeekByDate,
  resolveWeekByLabel,
  type CalendarWeekInfo,
} from '../lib/analysis/week';
import { PortalClient } from '../lib/portal/client';
import {
  COVERAGES,
  DEFAULT_DAYS_BACK,
  type CoverageAnalysisResult,
  type TriggerSource,
} from '../lib/types';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const envLocalPath = path.resolve(__dirname, '..', '.env.local');
if (!process.env.DATABASE_URL && fs.existsSync(envLocalPath)) {
  dotenv.config({ path: envLocalPath });
}

interface CliArgs {
  mode: 'prepare' | 'ingest' | 'finalize';
  coverage: string;
  runId: string;
  dateFrom: string;
  dateTo: string;
  hasExplicitFrom: boolean;
  hasExplicitTo: boolean;
  weekLabel: string;
  weekName: string;
  weekStart: string;
  weekEnd: string;
  triggerSource: TriggerSource;
  retainWeeks: number;
  dumpFixture?: string;
}

function parseCliArgs(argv: string[]): CliArgs {
  const map = new Map<string, string>();
  for (const arg of argv) {
    if (!arg.startsWith('--')) continue;
    const eq = arg.indexOf('=');
    if (eq > 2) {
      map.set(arg.slice(2, eq), arg.slice(eq + 1));
    }
  }

  const modeRaw = map.get('mode') ?? 'ingest';
  if (modeRaw !== 'prepare' && modeRaw !== 'ingest' && modeRaw !== 'finalize') {
    throw new Error(`Mode worker tidak valid: ${modeRaw}`);
  }

  const defaultRange = getWibDateRange(DEFAULT_DAYS_BACK);
  const rawFrom = map.get('from')?.trim() || '';
  const rawTo = map.get('to')?.trim() || '';
  const dateFrom = rawFrom || defaultRange.dateFrom;
  const dateTo = rawTo || defaultRange.dateTo;
  const runId = map.get('run-id')?.trim() || `manual-${dateTo}`;
  const coverage = map.get('coverage')?.trim() || '';

  const retainRaw = Number(
    map.get('retain-weeks') || map.get('retain-runs') || '12'
  );
  const trigRaw = map.get('trigger-source')?.trim() || 'cli';
  const triggerSource: TriggerSource =
    trigRaw === 'schedule' || trigRaw === 'manual' ? trigRaw : 'cli';

  if (modeRaw === 'ingest' && !coverage) {
    throw new Error('Argumen --coverage="..." wajib diisi pada mode ingest.');
  }

  return {
    mode: modeRaw,
    coverage,
    runId,
    dateFrom,
    dateTo,
    hasExplicitFrom: Boolean(rawFrom),
    hasExplicitTo: Boolean(rawTo),
    weekLabel: map.get('week-label')?.trim() || '',
    weekName: map.get('week-name')?.trim() || '',
    weekStart: map.get('week-start')?.trim() || '',
    weekEnd: map.get('week-end')?.trim() || '',
    triggerSource,
    retainWeeks: Number.isFinite(retainRaw) && retainRaw > 0 ? retainRaw : 12,
    dumpFixture: map.get('dump-fixture'),
  };
}

async function insertInBatches(
  client: pg.PoolClient,
  table: string,
  columns: string[],
  rows: unknown[][],
  chunkSize = 500
): Promise<void> {
  if (rows.length === 0) return;

  const colList = columns.join(', ');
  for (let i = 0; i < rows.length; i += chunkSize) {
    const chunk = rows.slice(i, i + chunkSize);
    const params: unknown[] = [];
    const valueTuples = chunk.map((row) => {
      const placeholders = row.map((val) => {
        params.push(val);
        return `$${params.length}`;
      });
      return `(${placeholders.join(', ')})`;
    });

    const sql = `INSERT INTO ${table} (${colList}) VALUES ${valueTuples.join(', ')}`;
    await client.query(sql, params);
  }
}

export async function saveCoverageAnalysis(
  pool: pg.Pool,
  runId: string,
  analysis: CoverageAnalysisResult
): Promise<void> {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    await client.query(
      `DELETE FROM point_check WHERE run_id = $1 AND coverage = $2`,
      [runId, analysis.coverage]
    );
    await client.query(
      `DELETE FROM rain_check WHERE run_id = $1 AND coverage = $2`,
      [runId, analysis.coverage]
    );
    await client.query(
      `DELETE FROM series_iot WHERE run_id = $1 AND coverage = $2`,
      [runId, analysis.coverage]
    );
    await client.query(
      `DELETE FROM series_rain WHERE run_id = $1 AND coverage = $2`,
      [runId, analysis.coverage]
    );
    await client.query(
      `DELETE FROM station_snapshot WHERE run_id = $1 AND coverage = $2`,
      [runId, analysis.coverage]
    );

    const snapshotRows = analysis.stations.map(({ snapshot }) => [
      runId,
      snapshot.coverage,
      snapshot.piezo_id,
      snapshot.kebun,
      snapshot.block,
      snapshot.jenis,
      snapshot.device_id,
      snapshot.device_name,
      snapshot.kalibrasi,
      snapshot.status_kalibrasi,
      snapshot.status_hujan,
      snapshot.has_rain_station,
      snapshot.rain_station_id,
      snapshot.latest_manual_at,
      snapshot.latest_manual_cm,
      snapshot.latest_iot_cm,
      snapshot.latest_diff_cm,
      snapshot.signed_diff_cm,
      snapshot.total_points,
      snapshot.avg_diff_cm,
      snapshot.max_diff_cm,
      snapshot.rain_events,
      snapshot.rain_responded,
      snapshot.narrative,
      JSON.stringify(snapshot.sparkline_json),
      snapshot.period_from,
      snapshot.period_to,
    ]);

    await insertInBatches(
      client,
      'station_snapshot',
      [
        'run_id',
        'coverage',
        'piezo_id',
        'kebun',
        'block',
        'jenis',
        'device_id',
        'device_name',
        'kalibrasi',
        'status_kalibrasi',
        'status_hujan',
        'has_rain_station',
        'rain_station_id',
        'latest_manual_at',
        'latest_manual_cm',
        'latest_iot_cm',
        'latest_diff_cm',
        'signed_diff_cm',
        'total_points',
        'avg_diff_cm',
        'max_diff_cm',
        'rain_events',
        'rain_responded',
        'narrative',
        'sparkline_json',
        'period_from',
        'period_to',
      ],
      snapshotRows,
      200
    );

    const pointRows = analysis.stations.flatMap((st) =>
      st.points.map((pt) => [
        runId,
        pt.coverage,
        pt.piezo_id,
        pt.manual_at,
        pt.manual_cm,
        pt.iot_at,
        pt.iot_cm,
        pt.delta_hours,
        pt.diff_cm,
        pt.exceeded,
        pt.is_latest,
      ])
    );

    await insertInBatches(
      client,
      'point_check',
      [
        'run_id',
        'coverage',
        'piezo_id',
        'manual_at',
        'manual_cm',
        'iot_at',
        'iot_cm',
        'delta_hours',
        'diff_cm',
        'exceeded',
        'is_latest',
      ],
      pointRows,
      500
    );

    const rainRows = analysis.stations.flatMap((st) =>
      st.rainChecks.map((rc) => [
        runId,
        rc.coverage,
        rc.piezo_id,
        rc.rain_at,
        rc.rain_mm,
        rc.base_cm,
        rc.min_cm,
        rc.rise_cm,
        rc.responded,
      ])
    );

    await insertInBatches(
      client,
      'rain_check',
      [
        'run_id',
        'coverage',
        'piezo_id',
        'rain_at',
        'rain_mm',
        'base_cm',
        'min_cm',
        'rise_cm',
        'responded',
      ],
      rainRows,
      500
    );

    const iotSeriesRows = analysis.stations.flatMap((st) =>
      st.seriesIot.map((pt) => [
        runId,
        st.snapshot.coverage,
        st.snapshot.piezo_id,
        pt.ts,
        pt.cm,
      ])
    );

    await insertInBatches(
      client,
      'series_iot',
      ['run_id', 'coverage', 'piezo_id', 'ts', 'cm'],
      iotSeriesRows,
      500
    );

    const rainSeriesRows = analysis.stations.flatMap((st) =>
      st.seriesRain.map((pt) => [
        runId,
        st.snapshot.coverage,
        st.snapshot.piezo_id,
        pt.ts,
        pt.mm,
      ])
    );

    await insertInBatches(
      client,
      'series_rain',
      ['run_id', 'coverage', 'piezo_id', 'ts', 'mm'],
      rainSeriesRows,
      500
    );

    await client.query(
      `
      UPDATE coverage_run
      SET status = 'success',
          station_count = $3,
          finished_at = NOW(),
          error = NULL
      WHERE run_id = $1 AND coverage = $2
      `,
      [runId, analysis.coverage, analysis.stations.length]
    );

    await client.query('COMMIT');
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
}

async function resolveCliWeek(
  args: CliArgs,
  pool: pg.Pool
): Promise<CalendarWeekInfo> {
  if (args.weekLabel && args.weekName && args.weekStart && args.weekEnd) {
    return {
      week_label: args.weekLabel,
      week_name: args.weekName,
      week_start: args.weekStart,
      week_end: args.weekEnd,
    };
  }
  if (args.weekLabel) {
    const found = await resolveWeekByLabel(pool, args.weekLabel);
    if (found) return found;
  }
  const targetDate = args.hasExplicitTo
    ? args.dateTo
    : formatWibDate(new Date());
  try {
    return await resolveWeekByDate(pool, targetDate);
  } catch {
    return buildFallbackWeekForDate(targetDate);
  }
}

async function runPrepare(args: CliArgs, pool: pg.Pool): Promise<void> {
  const todayWib = formatWibDate(new Date());
  let week: CalendarWeekInfo;
  if (args.weekLabel) {
    const found = await resolveWeekByLabel(pool, args.weekLabel);
    week = found ?? (await resolveWeekByDate(pool, todayWib));
  } else if (args.hasExplicitTo) {
    week = await resolveWeekByDate(pool, args.dateTo);
  } else {
    week = await resolveWeekByDate(pool, todayWib);
  }

  const computed = computePeriodForWeek(week, todayWib, DEFAULT_DAYS_BACK);
  const dateTo = args.hasExplicitTo ? args.dateTo : computed.dateTo;
  const dateFrom = args.hasExplicitFrom
    ? args.dateFrom
    : args.hasExplicitTo
      ? getWibDateRange(DEFAULT_DAYS_BACK, new Date(`${dateTo}T12:00:00+07:00`))
          .dateFrom
      : computed.dateFrom;

  const selCov = args.coverage;
  const coverages =
    !selCov || selCov === 'all' ? [...COVERAGES] : [selCov];

  const outputLines = [
    `run_id=${args.runId}`,
    `date_from=${dateFrom}`,
    `date_to=${dateTo}`,
    `week_name=${week.week_name}`,
    `week_label=${week.week_label}`,
    `week_start=${week.week_start}`,
    `week_end=${week.week_end}`,
    `trigger_source=${args.triggerSource}`,
    `coverages=${JSON.stringify(coverages)}`,
  ];

  const githubOutput = process.env.GITHUB_OUTPUT;
  if (githubOutput) {
    fs.appendFileSync(githubOutput, `${outputLines.join('\n')}\n`);
  }

  console.log(
    `[Prepare] run="${args.runId}" week="${week.week_label}" (${week.week_start}..${week.week_end}) period=${dateFrom}..${dateTo} source=${args.triggerSource} coverages=${coverages.length}`
  );
}

async function runIngest(args: CliArgs, pool: pg.Pool): Promise<void> {
  const username = process.env.PORTAL_USERNAME?.trim();
  const password = process.env.PORTAL_PASSWORD;

  if (!username || !password) {
    throw new Error(
      'PORTAL_USERNAME dan PORTAL_PASSWORD wajib tersedia di environment.'
    );
  }

  const week = await resolveCliWeek(args, pool);

  await pool.query(
    `
    INSERT INTO run_meta (
      run_id, period_from, period_to, status,
      week_name, week_label, week_start, week_end, trigger_source
    )
    VALUES ($1, $2::date, $3::date, 'running', $4, $5, $6::date, $7::date, $8)
    ON CONFLICT (run_id) DO UPDATE SET
      week_name = COALESCE(run_meta.week_name, EXCLUDED.week_name),
      week_label = COALESCE(run_meta.week_label, EXCLUDED.week_label),
      week_start = COALESCE(run_meta.week_start, EXCLUDED.week_start),
      week_end = COALESCE(run_meta.week_end, EXCLUDED.week_end),
      trigger_source = COALESCE(NULLIF(run_meta.trigger_source, 'cli'), EXCLUDED.trigger_source)
    `,
    [
      args.runId,
      args.dateFrom,
      args.dateTo,
      week.week_name,
      week.week_label,
      week.week_start,
      week.week_end,
      args.triggerSource,
    ]
  );

  await pool.query(
    `
    INSERT INTO coverage_run (
      run_id, coverage, period_from, period_to, status, started_at, week_name, week_label
    )
    VALUES ($1, $2, $3::date, $4::date, 'running', NOW(), $5, $6)
    ON CONFLICT (run_id, coverage) DO UPDATE SET
      period_from = EXCLUDED.period_from,
      period_to = EXCLUDED.period_to,
      status = 'running',
      started_at = NOW(),
      finished_at = NULL,
      error = NULL,
      week_name = EXCLUDED.week_name,
      week_label = EXCLUDED.week_label
    `,
    [
      args.runId,
      args.coverage,
      args.dateFrom,
      args.dateTo,
      week.week_name,
      week.week_label,
    ]
  );

  try {
    console.log(
      `[Ingest] Memulai coverage="${args.coverage}" week="${week.week_label}" run="${args.runId}" (${args.dateFrom} s.d. ${args.dateTo})`
    );
    const client = new PortalClient({ username, password });
    await client.login();
    const dataset = await client.getCoverageData(
      args.coverage,
      args.dateFrom,
      args.dateTo
    );

    if (args.dumpFixture) {
      fs.mkdirSync(path.dirname(args.dumpFixture), { recursive: true });
      fs.writeFileSync(args.dumpFixture, JSON.stringify(dataset, null, 2));
      console.log(`[Ingest] Fixture tersimpan di ${args.dumpFixture}`);
    }

    const analysis = analyzeCoverageDataset(dataset, args.coverage, {
      periodFrom: args.dateFrom,
      periodTo: args.dateTo,
    });

    await saveCoverageAnalysis(pool, args.runId, analysis);

    console.log(
      `[Ingest] Selesai coverage="${args.coverage}": ${analysis.stations.length} stasiun disimpan.`
    );
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    await pool.query(
      `
      UPDATE coverage_run
      SET status = 'failed', finished_at = NOW(), error = $3
      WHERE run_id = $1 AND coverage = $2
      `,
      [args.runId, args.coverage, message.slice(0, 1000)]
    );
    throw err;
  }
}

async function runFinalize(args: CliArgs, pool: pg.Pool): Promise<void> {
  const res = await pool.query(
    `SELECT coverage, status, error FROM coverage_run WHERE run_id = $1`,
    [args.runId]
  );

  const rows = res.rows;
  const total = rows.length;
  const succeeded = rows.filter((r) => r.status === 'success').length;
  const failedRows = rows.filter((r) => r.status !== 'success');

  let finalStatus: 'success' | 'partial' | 'failed';
  if (total === 0 || succeeded === 0) {
    finalStatus = 'failed';
  } else if (failedRows.length === 0) {
    finalStatus = 'success';
  } else {
    finalStatus = 'partial';
  }

  const errorSummary =
    failedRows.length > 0
      ? failedRows
          .map((r) => `${r.coverage}: ${r.error || r.status}`)
          .join(' | ')
          .slice(0, 1000)
      : null;

  await pool.query(
    `
    UPDATE run_meta
    SET status = $2, finished_at = NOW(), error = $3
    WHERE run_id = $1
    `,
    [args.runId, finalStatus, errorSummary]
  );

  // Prune raw time-series rows while keeping latest successful coverage runs across the newest N distinct weeks.
  const keepRes = await pool.query(
    `
    WITH recent_weeks AS (
      SELECT DISTINCT week_label, MAX(week_start) AS ws
      FROM run_meta
      WHERE week_label IS NOT NULL AND status IN ('success', 'partial')
      GROUP BY week_label
      ORDER BY ws DESC NULLS LAST
      LIMIT $1
    ),
    keep_cov_runs AS (
      SELECT DISTINCT ON (cr.week_label, cr.coverage) cr.run_id
      FROM coverage_run cr
      INNER JOIN recent_weeks rw ON rw.week_label = cr.week_label
      WHERE cr.status = 'success'
      ORDER BY cr.week_label, cr.coverage, cr.finished_at DESC NULLS LAST, cr.started_at DESC
    ),
    keep_recent_runs AS (
      SELECT run_id
      FROM run_meta
      WHERE status IN ('success', 'partial')
      ORDER BY started_at DESC
      LIMIT $1
    )
    SELECT run_id FROM keep_cov_runs
    UNION
    SELECT run_id FROM keep_recent_runs
    `,
    [args.retainWeeks]
  );
  const keepIds = keepRes.rows.map((r) => String(r.run_id));
  if (keepIds.length > 0) {
    await pool.query(
      `DELETE FROM series_iot WHERE NOT (run_id = ANY($1::text[]))`,
      [keepIds]
    );
    await pool.query(
      `DELETE FROM series_rain WHERE NOT (run_id = ANY($1::text[]))`,
      [keepIds]
    );
  }

  console.log(
    `[Finalize] run="${args.runId}" status=${finalStatus} (${succeeded}/${total} coverage berhasil, retain=${keepIds.length} run_id)`
  );
}

async function main(): Promise<void> {
  if (!process.env.DATABASE_URL) {
    throw new Error('DATABASE_URL wajib tersedia di environment.');
  }

  const args = parseCliArgs(process.argv.slice(2));
  const pool = new pg.Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: { rejectUnauthorized: false },
  });

  try {
    if (args.mode === 'prepare') {
      await runPrepare(args, pool);
    } else if (args.mode === 'ingest') {
      await runIngest(args, pool);
    } else {
      await runFinalize(args, pool);
    }
  } finally {
    await pool.end();
  }
}

const isEntrypoint =
  process.argv[1] &&
  path.resolve(process.argv[1]) === fileURLToPath(import.meta.url);

if (isEntrypoint) {
  main().catch((err) => {
    console.error(
      '[Worker Error]',
      err instanceof Error ? err.message : String(err)
    );
    process.exit(1);
  });
}
