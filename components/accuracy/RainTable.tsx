import { formatWibDateTimeId } from '@/lib/analysis/date';
import type { AnalyzedRainCheck } from '@/lib/types';

export default function RainTable({
  rainEvents,
  hasRainStation,
}: {
  rainEvents: AnalyzedRainCheck[];
  hasRainStation: boolean;
}) {
  if (!hasRainStation) {
    return (
      <div className="bg-amber-50 rounded-2xl border border-amber-300 p-6 text-center text-sm text-amber-900">
        Tidak ada stasiun hujan terdaftar di kebun ini. Evaluasi respon hujan per kebun tidak tersedia.
      </div>
    );
  }

  if (rainEvents.length === 0) {
    return (
      <div className="bg-white rounded-2xl border border-gray-200 p-6 text-center text-sm text-gray-600">
        Tidak tercatat kejadian curah hujan signifikan (&gt;= 1.0 mm) dengan jendela baseline/respon IoT lengkap pada periode ini.
      </div>
    );
  }

  return (
    <div className="bg-white rounded-2xl border border-gray-200 overflow-hidden print-avoid-break">
      <div className="hidden sm:block print:block overflow-x-auto">
        <table className="w-full text-xs sm:text-sm text-left">
          <thead className="bg-gray-50 border-b border-gray-200 text-xs font-semibold text-gray-700">
            <tr>
              <th className="py-2.5 px-3 text-center">No</th>
              <th className="py-2.5 px-3">Waktu Hujan (WIB)</th>
              <th className="py-2.5 px-3 text-right">Hujan (mm)</th>
              <th className="py-2.5 px-3 text-right">TMAT Sebelum (cm)</th>
              <th className="py-2.5 px-3 text-right">Puncak Air (cm)</th>
              <th className="py-2.5 px-3 text-right">Kenaikan (cm)</th>
              <th className="py-2.5 px-3 text-center">Respon (&gt;= 1 cm)</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-200">
            {rainEvents.map((rev, idx) => (
              <tr key={`${rev.rain_at}-${idx}`} className="bg-white">
                <td className="py-2.5 px-3 text-center text-gray-700 tabular-nums">
                  {idx + 1}
                </td>
                <td className="py-2.5 px-3 text-gray-900 tabular-nums">
                  {formatWibDateTimeId(rev.rain_at)}
                </td>
                <td className="py-2.5 px-3 text-right font-semibold text-gray-900 tabular-nums">
                  {rev.rain_mm.toFixed(1)}
                </td>
                <td className="py-2.5 px-3 text-right text-gray-700 tabular-nums">
                  {rev.base_cm.toFixed(1)}
                </td>
                <td className="py-2.5 px-3 text-right text-gray-700 tabular-nums">
                  {rev.min_cm.toFixed(1)}
                </td>
                <td className="py-2.5 px-3 text-right font-bold text-gray-900 tabular-nums">
                  {rev.rise_cm.toFixed(1)}
                </td>
                <td className="py-2.5 px-3 text-center">
                  <span
                    className={`inline-flex px-2 py-0.5 rounded text-[11px] font-semibold border ${
                      rev.responded
                        ? 'bg-emerald-50 text-emerald-800 border-emerald-300'
                        : 'bg-red-50 text-red-800 border-red-300'
                    }`}
                  >
                    {rev.responded ? 'Normal (Naik)' : 'Tidak Merespon'}
                  </span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Mobile card list */}
      <div className="sm:hidden print:hidden divide-y divide-gray-200">
        {rainEvents.map((rev, idx) => (
          <div key={`${rev.rain_at}-${idx}`} className="p-4 space-y-2">
            <div className="flex items-center justify-between gap-2">
              <span className="text-xs font-bold text-gray-900 tabular-nums">
                #{idx + 1} | {formatWibDateTimeId(rev.rain_at)}
              </span>
              <span
                className={`px-2 py-0.5 rounded text-[11px] font-semibold border ${
                  rev.responded
                    ? 'bg-emerald-50 text-emerald-800 border-emerald-300'
                    : 'bg-red-50 text-red-800 border-red-300'
                }`}
              >
                {rev.responded ? 'Normal' : 'Tidak Merespon'}
              </span>
            </div>
            <div className="grid grid-cols-3 gap-2 text-xs">
              <div>
                <span className="text-gray-600 block">Hujan</span>
                <span className="font-bold text-gray-900 tabular-nums">
                  {rev.rain_mm.toFixed(1)} mm
                </span>
              </div>
              <div>
                <span className="text-gray-600 block">Base / Min</span>
                <span className="font-bold text-gray-900 tabular-nums">
                  {rev.base_cm.toFixed(1)} / {rev.min_cm.toFixed(1)}
                </span>
              </div>
              <div>
                <span className="text-gray-600 block">Kenaikan</span>
                <span className="font-bold text-gray-900 tabular-nums">
                  {rev.rise_cm.toFixed(1)} cm
                </span>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
