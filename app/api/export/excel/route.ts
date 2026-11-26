import { NextResponse } from 'next/server';
import { z } from 'zod';
import { formatWibDate } from '@/lib/analysis/date';
import { getExportBundle } from '@/lib/db-accuracy';
import { buildAccuracyExcelBuffer } from '@/lib/export/excel';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const QuerySchema = z.object({
  week: z.string().max(60).optional(),
  runId: z.string().max(120).optional(),
  coverage: z.string().max(120).optional(),
  kebun: z.string().max(80).optional(),
  jenis: z.string().max(80).optional(),
  calibrationStatus: z
    .enum([
      'LOLOS / AKURAT',
      'PERLU KALIBRASI ULANG',
      'TIDAK ADA DATA MANUAL',
    ])
    .optional(),
  rainStatus: z
    .enum([
      'all',
      'NORMAL',
      'ANOMALI RESPON HUJAN',
      'TIDAK ADA HUJAN',
      'NO_RAIN_STATION',
    ])
    .optional(),
  diffBucket: z.enum(['all', 'gt3', '1to3', 'lte1', 'na']).optional(),
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

const QUERY_KEYS = [
  'week',
  'runId',
  'coverage',
  'kebun',
  'jenis',
  'calibrationStatus',
  'rainStatus',
  'diffBucket',
  'dateFrom',
  'dateTo',
  'anomalyOnly',
  'search',
] as const;

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const raw: Record<string, string | undefined> = {};
    for (const key of QUERY_KEYS) {
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

    const weekSlug = bundle.summary.meta.active_week_label
      ? bundle.summary.meta.active_week_label.replace(/[^a-zA-Z0-9_-]+/g, '_')
      : null;
    const covSlug =
      parsed.data.coverage && parsed.data.coverage !== 'all'
        ? parsed.data.coverage.replace(/[^a-zA-Z0-9_-]+/g, '_')
        : 'Semua_Coverage';
    const dateStamp =
      bundle.summary.meta.period_to || formatWibDate(new Date());
    const filename = weekSlug
      ? `Laporan_Akurasi_TMAT_${weekSlug}_${covSlug}.xlsx`
      : `Laporan_Akurasi_TMAT_${covSlug}_${dateStamp}.xlsx`;

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
