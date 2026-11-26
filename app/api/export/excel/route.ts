import { NextResponse } from 'next/server';
import { z } from 'zod';
import { formatWibDate } from '@/lib/analysis/date';
import { getExportBundle } from '@/lib/db-accuracy';
import { buildAccuracyExcelBuffer } from '@/lib/export/excel';

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
        { error: 'Parameter ekspor tidak valid.' },
        { status: 400 }
      );
    }

    const bundle = await getExportBundle(parsed.data);
    const buffer = await buildAccuracyExcelBuffer(bundle);

    const covSlug =
      parsed.data.coverage && parsed.data.coverage !== 'all'
        ? parsed.data.coverage.replace(/[^a-zA-Z0-9_-]+/g, '_')
        : 'Semua_Coverage';
    const dateStamp =
      bundle.summary.meta.period_to || formatWibDate(new Date());
    const filename = `Laporan_Akurasi_TMAT_${covSlug}_${dateStamp}.xlsx`;

    return new NextResponse(new Uint8Array(buffer), {
      status: 200,
      headers: {
        'Content-Type':
          'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        'Content-Disposition': `attachment; filename="${filename}"`,
        'Cache-Control': 'no-store',
      },
    });
  } catch (err) {
    console.error('[GET /api/export/excel]', err);
    return NextResponse.json(
      { error: 'Gagal membuat file laporan Excel.' },
      { status: 500 }
    );
  }
}
