import { NextResponse } from 'next/server';
import { z } from 'zod';
import { getSummaryData } from '@/lib/db-accuracy';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const QuerySchema = z.object({
  runId: z.string().max(120).optional(),
  coverage: z.string().max(120).optional(),
  dateFrom: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/)
    .optional(),
  dateTo: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/)
    .optional(),
  anomalyOnly: z
    .enum(['true', 'false', '1', '0'])
    .optional()
    .transform((v) => v === 'true' || v === '1'),
  search: z.string().max(120).optional(),
});

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const raw: Record<string, string | undefined> = {};
    for (const key of [
      'runId',
      'coverage',
      'dateFrom',
      'dateTo',
      'anomalyOnly',
      'search',
    ]) {
      const val = searchParams.get(key);
      if (val !== null && val.trim() !== '') {
        raw[key] = val.trim();
      }
    }

    const parsed = QuerySchema.safeParse(raw);
    if (!parsed.success) {
      return NextResponse.json(
        { error: 'Parameter filter tidak valid.', details: parsed.error.issues },
        { status: 400 }
      );
    }

    const data = await getSummaryData(parsed.data);
    return NextResponse.json(data);
  } catch (err) {
    console.error('[GET /api/accuracy/summary]', err);
    return NextResponse.json(
      { error: 'Gagal memuat ringkasan akurasi IoT TMAT.' },
      { status: 500 }
    );
  }
}
