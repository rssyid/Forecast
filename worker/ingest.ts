import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import dotenv from 'dotenv';
import pg from 'pg';
import { analyzeCoverageDataset } from '../lib/analysis/analyze';
import { getWibDateRange } from '../lib/analysis/date';
import { PortalClient } from '../lib/portal/client';
import { DEFAULT_DAYS_BACK, type CoverageAnalysisResult } from '../lib/types';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const envLocalPath = path.resolve(__dirname, '..', '.env.local');
if (!process.env.DATABASE_URL && fs.existsSync(envLocalPath)) {
  dotenv.config({ path: envLocalPath });
}

interface CliArgs {
  mode: 'ingest' | 'finalize';
  coverage: string;
  runId: string;
  dateFrom: string;
  dateTo: string;
  retainRuns: number;
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
  if (modeRaw !== 'ingest' && modeRaw !== 'finalize') {
    throw new Error(`Mode worker tidak valid: ${modeRaw}`);
  }

  const defaultRange = getWibDateRange(DEFAULT_DAYS_BACK);
  const dateFrom = map.get('from') || defaultRange.dateFrom;
  const dateTo = map.get('to') || defaultRange.dateTo;
  const runId = map.get('run-id') || `manual-${dateTo}`;
  const coverage = map.get('coverage') || '';
  const retainRuns = Number(map.get('retain-runs') || '12');

  if (modeRaw === 'ingest' && !coverage) {
    throw new Error('Argumen --coverage="..." wajib diisi pada mode ingest.');
  }

  return {
    mode: modeRaw,
    coverage,
    runId,
    dateFrom,
    dateTo,
    retainRuns: Number.isFinite(retainRuns) && retainRuns > 0 ? retainRuns : 12,
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

async function runIngest(args: CliArgs, pool: pg.Pool): Promise<void> {
  const username = process.env.PORTAL_USERNAME?.trim();
  const password = process.env.PORTAL_PASSWORD;

  if (!username || !password) {
    throw new Error(
      'PORTAL_USERNAME dan PORTAL_PASSWORD wajib tersedia di environment.'
    );
  }

  await pool.query(
    `
    INSERT INTO run_meta (run_id, period_from, period_to, status)
    VALUES ($1, $2::date, $3::date, 'running')
    ON CONFLICT (run_id) DO NOTHING
    `,
    [args.runId, args.dateFrom, args.dateTo]
  );

  await pool.query(
    `
    INSERT INTO coverage_run (run_id, coverage, period_from, period_to, status, started_at)
    VALUES ($1, $2, $3::date, $4::date, 'running', NOW())
    ON CONFLICT (run_id, coverage) DO UPDATE SET
      period_from = EXCLUDED.period_from,
      period_to = EXCLUDED.period_to,
      status = 'running',
      started_at = NOW(),
      finished_at = NULL,
      error = NULL
    `,
    [args.runId, args.coverage, args.dateFrom, args.dateTo]
  );

  try {
    console.log(
      `[Ingest] Memulai coverage="${args.coverage}" run="${args.runId}" (${args.dateFrom} s.d. ${args.dateTo})`
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

  // Prune raw time-series rows from runs older than latest N completed runs.
  const keepRes = await pool.query(
    `
    SELECT run_id
    FROM run_meta
    WHERE status IN ('success', 'partial')
    ORDER BY started_at DESC
    LIMIT $1
    `,
    [args.retainRuns]
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
    `[Finalize] run="${args.runId}" status=${finalStatus} (${succeeded}/${total} coverage berhasil)`
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
    if (args.mode === 'ingest') {
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
