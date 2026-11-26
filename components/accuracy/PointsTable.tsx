import { formatWibDateTimeId } from '@/lib/analysis/date';
import type { AnalyzedPointCheck } from '@/lib/types';

export default function PointsTable({ points }: { points: AnalyzedPointCheck[] }) {
  if (points.length === 0) {
    return (
      <div className="bg-white rounded-2xl border border-gray-200 p-6 text-center text-sm text-gray-600">
        Tidak ditemukan pasangan titik pengukuran manual dan IoT (batas jarak waktu maksimal 12 jam) pada periode ini.
      </div>
    );
  }

  return (
    <div className="bg-white rounded-2xl border border-gray-200 overflow-hidden print-avoid-break">
      {/* Desktop and print table */}
      <div className="hidden sm:block print:block overflow-x-auto">
        <table className="w-full text-xs sm:text-sm text-left">
          <thead className="bg-gray-50 border-b border-gray-200 text-xs font-semibold text-gray-700">
            <tr>
              <th className="py-2.5 px-3 text-center">No</th>
              <th className="py-2.5 px-3">Waktu Manual (WIB)</th>
              <th className="py-2.5 px-3 text-right">Manual (cm)</th>
              <th className="py-2.5 px-3">Waktu IoT Terdekat (WIB)</th>
              <th className="py-2.5 px-3 text-right">IoT (cm)</th>
              <th className="py-2.5 px-3 text-center">Delta Jam</th>
              <th className="py-2.5 px-3 text-right">Selisih (cm)</th>
              <th className="py-2.5 px-3 text-center">Evaluasi (3 cm)</th>
              <th className="py-2.5 px-3 text-center">Acuan</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-200">
            {points.map((pt, idx) => (
              <tr
                key={`${pt.manual_at}-${idx}`}
                className={pt.exceeded ? 'bg-red-50/75' : 'bg-white'}
              >
                <td className="py-2.5 px-3 text-center text-gray-700 tabular-nums">
                  {idx + 1}
                </td>
                <td className="py-2.5 px-3 text-gray-900 tabular-nums">
                  {formatWibDateTimeId(pt.manual_at)}
                </td>
                <td className="py-2.5 px-3 text-right font-semibold text-gray-900 tabular-nums">
                  {pt.manual_cm.toFixed(1)}
                </td>
                <td className="py-2.5 px-3 text-gray-700 tabular-nums">
                  {formatWibDateTimeId(pt.iot_at)}
                </td>
                <td className="py-2.5 px-3 text-right font-semibold text-gray-900 tabular-nums">
                  {pt.iot_cm.toFixed(1)}
                </td>
                <td className="py-2.5 px-3 text-center text-gray-700 tabular-nums">
                  {pt.delta_hours.toFixed(1)} jam
                </td>
                <td
                  className={`py-2.5 px-3 text-right font-bold tabular-nums ${
                    pt.exceeded ? 'text-red-800' : 'text-emerald-800'
                  }`}
                >
                  {pt.diff_cm.toFixed(1)}
                </td>
                <td className="py-2.5 px-3 text-center">
                  <span
                    className={`inline-flex px-2 py-0.5 rounded text-[11px] font-semibold border ${
                      pt.exceeded
                        ? 'bg-red-100 text-red-800 border-red-300'
                        : 'bg-emerald-50 text-emerald-800 border-emerald-300'
                    }`}
                  >
                    {pt.exceeded ? 'Melebihi (> 3 cm)' : 'Aman (<= 3 cm)'}
                  </span>
                </td>
                <td className="py-2.5 px-3 text-center">
                  {pt.is_latest ? (
                    <span className="inline-flex px-2 py-0.5 rounded text-[11px] font-bold bg-black text-white">
                      ACUAN
                    </span>
                  ) : (
                    <span className="text-gray-600">-</span>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Mobile card list */}
      <div className="sm:hidden print:hidden divide-y divide-gray-200">
        {points.map((pt, idx) => (
          <div
            key={`${pt.manual_at}-${idx}`}
            className={`p-4 space-y-2 ${pt.exceeded ? 'bg-red-50/75' : 'bg-white'}`}
          >
            <div className="flex items-center justify-between gap-2">
              <span className="text-xs font-bold text-gray-900 tabular-nums">
                #{idx + 1} | {formatWibDateTimeId(pt.manual_at)}
              </span>
              {pt.is_latest && (
                <span className="px-2 py-0.5 rounded text-[11px] font-bold bg-black text-white">
                  ACUAN
                </span>
              )}
            </div>
            <div className="grid grid-cols-3 gap-2 text-xs">
              <div>
                <span className="text-gray-600 block">Manual</span>
                <span className="font-bold text-gray-900 tabular-nums">
                  {pt.manual_cm.toFixed(1)} cm
                </span>
              </div>
              <div>
                <span className="text-gray-600 block">IoT</span>
                <span className="font-bold text-gray-900 tabular-nums">
                  {pt.iot_cm.toFixed(1)} cm
                </span>
              </div>
              <div>
                <span className="text-gray-600 block">Selisih</span>
                <span
                  className={`font-bold tabular-nums ${
                    pt.exceeded ? 'text-red-800' : 'text-emerald-800'
                  }`}
                >
                  {pt.diff_cm.toFixed(1)} cm
                </span>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
