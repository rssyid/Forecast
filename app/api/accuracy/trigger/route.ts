import { NextResponse } from 'next/server';
import { z } from 'zod';
import { formatWibDate } from '@/lib/analysis/date';
import {
  computePeriodForWeek,
  resolveWeekByDate,
  resolveWeekByLabel,
} from '@/lib/analysis/week';
import { getAccuracyPool } from '@/lib/db-accuracy';
import { COVERAGES, DEFAULT_DAYS_BACK } from '@/lib/types';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const BodySchema = z.object({
  weekLabel: z.string().max(60).optional(),
  coverage: z.string().max(120).optional(),
});

async function getLatestGhaRunState(
  repo: string,
  pat: string
): Promise<'idle' | 'queued' | 'in_progress' | 'unknown'> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 5000);
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
    if (!res.ok) return 'unknown';
    const json = (await res.json()) as {
      workflow_runs?: Array<{ status?: string }>;
    };
    const latest = json.workflow_runs?.[0];
    if (!latest) return 'idle';
    if (latest.status === 'queued') return 'queued';
    if (latest.status === 'in_progress') return 'in_progress';
    return 'idle';
  } catch {
    return 'unknown';
  } finally {
    clearTimeout(timer);
  }
}

export async function POST(request: Request) {
  try {
    const expectedAdminKey = process.env.ADMIN_KEY || 'admin123';
    const providedKey = request.headers.get('x-admin-key')?.trim() || '';
    if (!providedKey || providedKey !== expectedAdminKey) {
      return NextResponse.json(
        { error: 'Admin Key tidak valid atau belum diisi.' },
        { status: 401 }
      );
    }

    const pat = process.env.GITHUB_PAT?.trim();
    if (!pat) {
      return NextResponse.json(
        { error: 'GITHUB_PAT belum dikonfigurasi di environment server.' },
        { status: 500 }
      );
    }

    let rawBody: unknown = {};
    try {
      rawBody = await request.json();
    } catch {
      rawBody = {};
    }

    const parsed = BodySchema.safeParse(rawBody);
    if (!parsed.success) {
      return NextResponse.json(
        { error: 'Payload trigger tidak valid.', details: parsed.error.issues },
        { status: 400 }
      );
    }

    const coverageInput = parsed.data.coverage?.trim() || 'all';
    if (
      coverageInput !== 'all' &&
      !(COVERAGES as readonly string[]).includes(coverageInput)
    ) {
      return NextResponse.json(
        { error: `Coverage "${coverageInput}" tidak dikenal.` },
        { status: 400 }
      );
    }

    const pool = getAccuracyPool();
    const runningRes = await pool.query(
      `
      SELECT run_id, week_label, started_at
      FROM run_meta
      WHERE status = 'running'
        AND started_at > NOW() - INTERVAL '20 minutes'
      ORDER BY started_at DESC
      LIMIT 1
      `
    );

    if (runningRes.rows.length > 0) {
      const active = runningRes.rows[0];
      return NextResponse.json(
        {
          error: `Penarikan data (${active.week_label || active.run_id}) sedang berjalan. Tunggu hingga selesai sebelum memicu ulang.`,
        },
        { status: 409 }
      );
    }

    const repo = process.env.GITHUB_REPO?.trim() || 'rssyid/Forecast';
    const ref = process.env.GITHUB_REF?.trim() || 'main';

    const ghaState = await getLatestGhaRunState(repo, pat);
    if (ghaState === 'queued' || ghaState === 'in_progress') {
      return NextResponse.json(
        {
          error:
            'Workflow GitHub Actions IoT TMAT masih dalam antrean atau sedang berjalan. Tunggu hingga selesai.',
        },
        { status: 409 }
      );
    }

    const todayWib = formatWibDate(new Date());
    let targetWeek = parsed.data.weekLabel
      ? await resolveWeekByLabel(pool, parsed.data.weekLabel)
      : null;

    if (parsed.data.weekLabel && !targetWeek) {
      return NextResponse.json(
        { error: `Week "${parsed.data.weekLabel}" tidak ditemukan di calendar_weeks.` },
        { status: 400 }
      );
    }

    if (!targetWeek) {
      targetWeek = await resolveWeekByDate(pool, todayWib);
    }

    const { dateFrom, dateTo } = computePeriodForWeek(
      targetWeek,
      todayWib,
      DEFAULT_DAYS_BACK
    );

    const dispatchRes = await fetch(
      `https://api.github.com/repos/${repo}/actions/workflows/ingest.yml/dispatches`,
      {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${pat}`,
          Accept: 'application/vnd.github+json',
          'X-GitHub-Api-Version': '2022-11-28',
          'User-Agent': 'Forecast-App',
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          ref,
          inputs: {
            coverage: coverageInput,
            week_label: targetWeek.week_label,
            date_from: dateFrom,
            date_to: dateTo,
            trigger_source: 'manual',
          },
        }),
      }
    );

    if (dispatchRes.status !== 204) {
      const errorText = await dispatchRes.text();
      return NextResponse.json(
        {
          error: `GitHub Actions menolak dispatch (${dispatchRes.status}).`,
          details: errorText.slice(0, 400),
        },
        { status: dispatchRes.status >= 400 ? dispatchRes.status : 500 }
      );
    }

    return NextResponse.json(
      {
        triggered: true,
        week_label: targetWeek.week_label,
        week_name: targetWeek.week_name,
        coverage: coverageInput,
        date_from: dateFrom,
        date_to: dateTo,
        triggered_at: new Date().toISOString(),
      },
      { status: 202 }
    );
  } catch (err) {
    console.error('[POST /api/accuracy/trigger]', err);
    return NextResponse.json(
      { error: 'Gagal memicu penarikan data akurasi IoT.' },
      { status: 500 }
    );
  }
}
