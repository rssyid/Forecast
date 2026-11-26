import { NextResponse } from 'next/server';
import { z } from 'zod';
import { getStationDetail } from '@/lib/db-accuracy';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const QuerySchema = z.object({
  runId: z.string().max(120).optional(),
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
    const parsedQuery = QuerySchema.safeParse(
      runIdRaw ? { runId: runIdRaw } : {}
    );
    if (!parsedQuery.success) {
      return NextResponse.json(
        { error: 'Parameter runId tidak valid.' },
        { status: 400 }
      );
    }

    const detail = await getStationDetail(decodedId, parsedQuery.data.runId);
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
