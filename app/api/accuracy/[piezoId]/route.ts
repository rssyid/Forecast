import { NextResponse } from 'next/server';
import { z } from 'zod';
import { getStationDetail } from '@/lib/db-accuracy';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const QuerySchema = z.object({
  runId: z.string().max(120).optional(),
  week: z.string().max(60).optional(),
});

export async function GET(
  request: Request,
  context: { params: Promise<{ piezoId: string }> }
) {
  try {
    const { piezoId } = await context.params;
    const decodedId = decodeURIComponent(piezoId).trim();
    if (!decodedId || decodedId.length > 100) {
      return NextResponse.json(
        { error: 'ID stasiun tidak valid.' },
        { status: 400 }
      );
    }

    const { searchParams } = new URL(request.url);
    const runIdRaw = searchParams.get('runId')?.trim();
    const weekRaw = searchParams.get('week')?.trim();
    const raw: Record<string, string> = {};
    if (runIdRaw) raw.runId = runIdRaw;
    if (weekRaw) raw.week = weekRaw;

    const parsedQuery = QuerySchema.safeParse(raw);
    if (!parsedQuery.success) {
      return NextResponse.json(
        { error: 'Parameter query tidak valid.' },
        { status: 400 }
      );
    }

    const detail = await getStationDetail(decodedId, parsedQuery.data);
    if (!detail) {
      return NextResponse.json(
        { error: `Data stasiun "${decodedId}" tidak ditemukan.` },
        { status: 404 }
      );
    }

    return NextResponse.json(detail);
  } catch (err) {
    console.error('[GET /api/accuracy/[piezoId]]', err);
    return NextResponse.json(
      { error: 'Gagal memuat detail stasiun.' },
      { status: 500 }
    );
  }
}
