import type { AccuracyKpi } from '@/lib/types';

export default function KpiCards({
  kpi,
  periodFrom,
  periodTo,
}: {
  kpi: AccuracyKpi;
  periodFrom: string | null;
  periodTo: string | null;
}) {
  const pctClamped = Math.max(0, Math.min(100, kpi.accuracy_pct));

  return (
    <section
      aria-label="Ringkasan metrik akurasi IoT TMAT"
      className="grid grid-cols-1 lg:grid-cols-12 gap-4"
    >
      <div className="lg:col-span-5 bg-white rounded-2xl border border-gray-200 p-5 flex flex-col justify-between shadow-xs">
        <div className="flex items-start justify-between gap-4">
          <div>
            <p className="text-xs font-semibold uppercase tracking-wide text-gray-600">
              Tingkat Akurasi Kalibrasi
            </p>
            <p className="mt-2 text-3xl sm:text-4xl font-bold text-gray-900 tabular-nums tracking-tight">
              {kpi.evaluated_stations > 0 ? `${kpi.accuracy_pct.toFixed(1)}%` : '0.0%'}
            </p>
          </div>
          <span
            className={`px-2.5 py-1 rounded-md text-xs font-semibold border ${
              kpi.recalibration_needed === 0
                ? 'bg-emerald-50 text-emerald-800 border-emerald-300'
                : 'bg-amber-50 text-amber-800 border-amber-300'
            }`}
          >
            Batas &lt;= 3.0 cm
          </span>
        </div>

        <div className="mt-4 space-y-2">
          <div
            className="w-full h-2.5 bg-gray-100 rounded-full overflow-hidden border border-gray-200"
            role="progressbar"
            aria-valuenow={pctClamped}
            aria-valuemin={0}
            aria-valuemax={100}
            aria-label="Persentase stasiun akurat"
          >
            <div
              className="h-full bg-emerald-600 transition-all duration-300"
              style={{ width: `${pctClamped}%` }}
            />
          </div>
          <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-gray-600">
            <span className="font-medium tabular-nums">
              {kpi.passed_stations} dari {kpi.evaluated_stations} stasiun lolos
            </span>
            {periodFrom && periodTo && (
              <span>
                Periode {periodFrom} s.d. {periodTo}
              </span>
            )}
          </div>
        </div>
      </div>

      <div className="lg:col-span-7 grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="bg-white rounded-2xl border border-gray-200 p-5 flex flex-col justify-between shadow-xs">
          <p className="text-xs font-semibold uppercase tracking-wide text-gray-600">
            Total Stasiun
          </p>
          <p className="mt-2 text-3xl font-bold text-gray-900 tabular-nums">
            {kpi.total_stations}
          </p>
          <p className="mt-2 text-xs text-gray-600">
            {kpi.no_manual_data > 0
              ? `${kpi.no_manual_data} tanpa data manual`
              : `${kpi.evaluated_stations} terevaluasi manual`}
          </p>
        </div>

        <div
          className={`bg-white rounded-2xl border p-5 flex flex-col justify-between shadow-xs ${
            kpi.recalibration_needed > 0
              ? 'border-red-300'
              : 'border-gray-200'
          }`}
        >
          <p className="text-xs font-semibold uppercase tracking-wide text-gray-600">
            Perlu Kalibrasi
          </p>
          <p
            className={`mt-2 text-3xl font-bold tabular-nums ${
              kpi.recalibration_needed > 0 ? 'text-red-800' : 'text-emerald-800'
            }`}
          >
            {kpi.recalibration_needed}
          </p>
          <p className="mt-2 text-xs text-gray-600">
            {kpi.recalibration_needed > 0
              ? 'Selisih titik manual terakhir > 3 cm'
              : 'Semua titik terakhir dalam toleransi'}
          </p>
        </div>

        <div
          className={`bg-white rounded-2xl border p-5 flex flex-col justify-between shadow-xs ${
            kpi.rain_anomaly_count > 0 ? 'border-amber-300' : 'border-gray-200'
          }`}
        >
          <p className="text-xs font-semibold uppercase tracking-wide text-gray-600">
            Anomali Hujan
          </p>
          <p
            className={`mt-2 text-3xl font-bold tabular-nums ${
              kpi.rain_anomaly_count > 0 ? 'text-red-800' : 'text-gray-900'
            }`}
          >
            {kpi.rain_anomaly_count}
          </p>
          <p className="mt-2 text-xs text-gray-600">
            {kpi.no_rain_station_count > 0
              ? `${kpi.no_rain_station_count} tanpa stasiun hujan kebun`
              : 'Kenaikan < 1 cm setelah hujan'}
          </p>
        </div>
      </div>
    </section>
  );
}
