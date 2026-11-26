import { AlertCircle } from 'lucide-react';
import type { CoverageFreshness, CoverageStat } from '@/lib/types';

export default function CoverageTable({
  stats,
  freshness,
  selectedCoverage,
  onSelectCoverage,
}: {
  stats: CoverageStat[];
  freshness: CoverageFreshness[];
  selectedCoverage: string;
  onSelectCoverage: (cov: string) => void;
}) {
  const freshnessMap = new Map(freshness.map((f) => [f.coverage, f]));

  const toggleCoverage = (cov: string) => {
    onSelectCoverage(selectedCoverage === cov ? 'all' : cov);
  };

  return (
    <section
      aria-label="Rekapitulasi akurasi per coverage"
      className="bg-white rounded-2xl border border-gray-200 overflow-hidden shadow-xs"
    >
      <div className="px-5 py-4 border-b border-gray-200 flex flex-wrap items-center justify-between gap-2">
        <div>
          <h2 className="text-base font-bold text-gray-900">
            Rekapitulasi per Coverage
          </h2>
          <p className="text-xs text-gray-600 mt-0.5">
            Pilih nama coverage untuk memfilter daftar stasiun di bawah.
          </p>
        </div>
        {selectedCoverage !== 'all' && (
          <button
            type="button"
            onClick={() => onSelectCoverage('all')}
            className="min-h-10 px-3 rounded-lg border border-gray-400 text-xs font-semibold text-gray-800 hover:bg-gray-100"
          >
            Tampilkan Semua Coverage
          </button>
        )}
      </div>

      {/* Desktop and tablet table */}
      <div className="hidden sm:block overflow-x-auto">
        <table className="w-full text-sm text-left">
          <thead className="bg-gray-50 border-b border-gray-200 text-xs font-semibold text-gray-700">
            <tr>
              <th className="py-3 px-4">Coverage</th>
              <th className="py-3 px-3 text-center">Total</th>
              <th className="py-3 px-3 text-center">Lolos</th>
              <th className="py-3 px-3 text-center">Perlu Kalibrasi</th>
              <th className="py-3 px-3 text-center">Tanpa Manual</th>
              <th className="py-3 px-3 text-center">Akurasi</th>
              <th className="py-3 px-4 text-center">Anomali Hujan</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-200">
            {stats.map((row) => {
              const isSelected = selectedCoverage === row.coverage;
              const fresh = freshnessMap.get(row.coverage);
              const isEmpty = row.total_stations === 0;
              return (
                <tr
                  key={row.coverage}
                  className={
                    isSelected
                      ? 'bg-gray-100'
                      : 'hover:bg-gray-50 transition-colors'
                  }
                >
                  <td className="py-3 px-4">
                    <div className="flex flex-wrap items-center gap-2">
                      <button
                        type="button"
                        onClick={() => toggleCoverage(row.coverage)}
                        aria-pressed={isSelected}
                        className={`text-left font-semibold min-h-10 px-2.5 py-1 rounded-lg transition-colors ${
                          isSelected
                            ? 'bg-black text-white'
                            : 'text-gray-900 hover:bg-gray-200/70'
                        }`}
                      >
                        {row.coverage}
                      </button>
                      {isEmpty && (
                        <span className="px-2 py-0.5 rounded text-[11px] font-medium bg-gray-100 text-gray-700 border border-gray-300">
                          0 stasiun
                        </span>
                      )}
                      {fresh?.is_stale_fallback && (
                        <span
                          title={`Penarikan terbaru gagal: ${fresh.latest_attempt_error || 'Error portal'}`}
                          className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[11px] font-semibold bg-amber-50 text-amber-800 border border-amber-300"
                        >
                          <AlertCircle size={12} aria-hidden="true" />
                          <span>Snapshot lama</span>
                        </span>
                      )}
                    </div>
                  </td>
                  <td className="py-3 px-3 text-center font-semibold text-gray-900 tabular-nums">
                    {row.total_stations}
                  </td>
                  <td className="py-3 px-3 text-center font-semibold text-emerald-800 tabular-nums">
                    {isEmpty ? '-' : row.passed_stations}
                  </td>
                  <td
                    className={`py-3 px-3 text-center font-semibold tabular-nums ${
                      row.failed_stations > 0 ? 'text-red-800' : 'text-gray-700'
                    }`}
                  >
                    {isEmpty ? '-' : row.failed_stations}
                  </td>
                  <td className="py-3 px-3 text-center text-gray-700 tabular-nums">
                    {isEmpty ? '-' : row.no_manual_stations}
                  </td>
                  <td className="py-3 px-3 text-center font-bold text-gray-900 tabular-nums">
                    {isEmpty ? '-' : `${row.accuracy_pct.toFixed(1)}%`}
                  </td>
                  <td
                    className={`py-3 px-4 text-center font-semibold tabular-nums ${
                      row.rain_anomaly_stations > 0
                        ? 'text-red-800'
                        : 'text-gray-700'
                    }`}
                  >
                    {isEmpty ? '-' : row.rain_anomaly_stations}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {/* Mobile card list */}
      <div className="sm:hidden divide-y divide-gray-200">
        {stats.map((row) => {
          const isSelected = selectedCoverage === row.coverage;
          const isEmpty = row.total_stations === 0;
          return (
            <div
              key={row.coverage}
              className={`p-4 space-y-2 ${isSelected ? 'bg-gray-100' : 'bg-white'}`}
            >
              <div className="flex items-center justify-between gap-2">
                <button
                  type="button"
                  onClick={() => toggleCoverage(row.coverage)}
                  aria-pressed={isSelected}
                  className={`min-h-11 px-3 py-1.5 rounded-lg text-sm font-bold ${
                    isSelected
                      ? 'bg-black text-white'
                      : 'bg-gray-100 text-gray-900 border border-gray-300'
                  }`}
                >
                  {row.coverage}
                </button>
                <span className="text-sm font-bold text-gray-900 tabular-nums">
                  {isEmpty ? '0 stasiun' : `${row.accuracy_pct.toFixed(1)}%`}
                </span>
              </div>
              {!isEmpty && (
                <div className="grid grid-cols-3 gap-2 text-xs text-gray-700 pt-1">
                  <div>Total: {row.total_stations}</div>
                  <div className="text-emerald-800 font-semibold">
                    Lolos: {row.passed_stations}
                  </div>
                  <div
                    className={
                      row.failed_stations > 0
                        ? 'text-red-800 font-semibold'
                        : ''
                    }
                  >
                    Kalibrasi: {row.failed_stations}
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </section>
  );
}
