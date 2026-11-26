import { NextResponse } from 'next/server';
import { formatWibDate } from '@/lib/analysis/date';
import {
  getSelectableCalendarWeeks,
  resolveWeekByDate,
} from '@/lib/analysis/week';
import { getAccuracyPool } from '@/lib/db-accuracy';
import type {
  AccuracyStatusApiResponse,
  AccuracyStatusCoverageProgress,
  CoverageRunStatus,
  RunMetaSummary,
  RunStatus,
  TriggerSource,
} from '@/lib/types';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

function toIso(val: unknown): string | null {
  if (!val) return null;
  if (val instanceof Date) {
    return Number.isNaN(val.getTime()) ? null : val.toISOString();
  }
  const d = new Date(String(val));
  return Number.isNaN(d.getTime()) ? null : d.toISOString();
}

function mapRunRow(r: Record<string, unknown>): RunMetaSummary {
  return {
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
  };
}

async function fetchLatestGhaWorkflow(): Promise<
  AccuracyStatusApiResponse['github_workflow']
> {
  const pat = process.env.GITHUB_PAT?.trim();
  if (!pat) {
    return { state: 'unknown', html_url: null, updated_at: null };
  }

  const repo = process.env.GITHUB_REPO?.trim() || 'rssyid/Forecast';
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 4000);

  try {
    const res = await fetch(
      `https://api.github.com/repos/${repo}/actions/workflows/ingest.yml/runs?per_page=1`,
      {
        headers: {
          Authorization: `Bearer ${pat}`,
          Accept: 'application/vnd.github+json',
          'X-GitHub-Api-Version': '2022-11-28',
          'User-Agent': 'Forecast-App',
        },
        signal: controller.signal,
        cache: 'no-store',
      }
    );

    if (!res.ok) {
      return { state: 'unknown', html_url: null, updated_at: null };
    }

    const json = (await res.json()) as {
      workflow_runs?: Array<{
        status?: string;
        html_url?: string;
        updated_at?: string;
      }>;
    };
    const latest = json.workflow_runs?.[0];
    if (!latest) {
      return { state: 'idle', html_url: null, updated_at: null };
    }

    const state =
      latest.status === 'queued'
        ? 'queued'
        : latest.status === 'in_progress'
          ? 'in_progress'
          : 'idle';

    return {
      state,
      html_url: latest.html_url ?? null,
      updated_at: latest.updated_at ?? null,
    };
  } catch {
    return { state: 'unknown', html_url: null, updated_at: null };
  } finally {
    clearTimeout(timer);
  }
}

export async function GET() {
  try {
    const pool = getAccuracyPool();
    const todayWib = formatWibDate(new Date());

    const [selectableWeeks, defaultWeek, activeRes, latestRes, ghaWorkflow] =
      await Promise.all([
        getSelectableCalendarWeeks(pool, todayWib, 24),
        resolveWeekByDate(pool, todayWib),
        pool.query(
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
          WHERE status = 'running'
            AND started_at > NOW() - INTERVAL '30 minutes'
          ORDER BY started_at DESC
          LIMIT 1
          `
        ),
        pool.query(
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
          ORDER BY started_at DESC
          LIMIT 1
          `
        ),
        fetchLatestGhaWorkflow(),
      ]);

    const loadCoverages = async (
      runId: string
    ): Promise<AccuracyStatusCoverageProgress[]> => {
      const covRes = await pool.query(
        `
        SELECT coverage, status, station_count, finished_at, error
        FROM coverage_run
        WHERE run_id = $1
        ORDER BY coverage ASC
        `,
        [runId]
      );
      return covRes.rows.map((c) => ({
        coverage: String(c.coverage),
        status: String(c.status) as CoverageRunStatus,
        station_count: Number(c.station_count ?? 0),
        finished_at: toIso(c.finished_at),
        error: c.error ? String(c.error) : null,
      }));
    };

    const activeRow = activeRes.rows[0] ? mapRunRow(activeRes.rows[0]) : null;
    const latestRow = latestRes.rows[0] ? mapRunRow(latestRes.rows[0]) : null;

    const [activeCoverages, latestCoverages] = await Promise.all([
      activeRow ? loadCoverages(activeRow.run_id) : Promise.resolve([]),
      latestRow
        ? activeRow && latestRow.run_id === activeRow.run_id
          ? Promise.resolve([])
          : loadCoverages(latestRow.run_id)
        : Promise.resolve([]),
    ]);

    const payload: AccuracyStatusApiResponse = {
      active_run: activeRow
        ? { ...activeRow, coverages: activeCoverages }
        : null,
      latest_run: latestRow
        ? {
            ...latestRow,
            coverages:
              activeRow && latestRow.run_id === activeRow.run_id
                ? activeCoverages
                : latestCoverages,
          }
        : null,
      github_workflow: ghaWorkflow,
      selectable_weeks: selectableWeeks,
      default_week: defaultWeek,
    };

    return NextResponse.json(payload, {
      headers: { 'Cache-Control': 'no-store' },
    });
  } catch (err) {
    console.error('[GET /api/accuracy/status]', err);
    return NextResponse.json(
      { error: 'Gagal memuat status sinkronisasi IoT TMAT.' },
      { status: 500 }
    );
  }
}
