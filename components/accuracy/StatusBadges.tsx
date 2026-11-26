import { AlertTriangle, CheckCircle2, CloudOff, HelpCircle } from 'lucide-react';
import type { CalibrationStatus, RainStatus } from '@/lib/types';

export function CalibrationBadge({ status }: { status: CalibrationStatus }) {
  if (status === 'LOLOS / AKURAT') {
    return (
      <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-semibold bg-emerald-50 text-emerald-800 border border-emerald-300 whitespace-nowrap">
        <CheckCircle2 size={13} aria-hidden="true" />
        <span>Lolos / Akurat</span>
      </span>
    );
  }
  if (status === 'PERLU KALIBRASI ULANG') {
    return (
      <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-semibold bg-red-50 text-red-800 border border-red-300 whitespace-nowrap">
        <AlertTriangle size={13} aria-hidden="true" />
        <span>Perlu Kalibrasi Ulang</span>
      </span>
    );
  }
  return (
    <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-semibold bg-amber-50 text-amber-800 border border-amber-300 whitespace-nowrap">
      <HelpCircle size={13} aria-hidden="true" />
      <span>Tanpa Data Manual</span>
    </span>
  );
}

export function RainStatusBadge({
  status,
  hasRainStation,
}: {
  status: RainStatus;
  hasRainStation: boolean;
}) {
  if (status === 'NORMAL') {
    return (
      <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-semibold bg-emerald-50 text-emerald-800 border border-emerald-300 whitespace-nowrap">
        <CheckCircle2 size={13} aria-hidden="true" />
        <span>Normal</span>
      </span>
    );
  }
  if (status === 'ANOMALI RESPON HUJAN') {
    return (
      <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-semibold bg-red-50 text-red-800 border border-red-300 whitespace-nowrap">
        <AlertTriangle size={13} aria-hidden="true" />
        <span>Anomali Respon Hujan</span>
      </span>
    );
  }
  return (
    <div className="inline-flex flex-col items-start gap-0.5">
      <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-semibold bg-amber-50 text-amber-800 border border-amber-300 whitespace-nowrap">
        <CloudOff size={13} aria-hidden="true" />
        <span>Tidak Ada Hujan</span>
      </span>
      {!hasRainStation && (
        <span className="text-[11px] font-medium text-amber-800">
          Tidak ada stasiun hujan di kebun ini
        </span>
      )}
    </div>
  );
}

export function DiffBadge({
  diffCm,
  signedDiffCm,
}: {
  diffCm: number | null;
  signedDiffCm: number | null;
}) {
  if (diffCm === null) {
    return (
      <span className="inline-flex items-center px-2 py-1 rounded-md text-xs font-semibold bg-gray-100 text-gray-700 border border-gray-300">
        N/A
      </span>
    );
  }

  const exceeded = diffCm > 3.0;
  const directionLabel =
    signedDiffCm === null || signedDiffCm === 0
      ? 'tepat'
      : signedDiffCm < 0
        ? 'lebih dangkal'
        : 'lebih dalam';

  return (
    <div className="inline-flex flex-col items-start gap-0.5">
      <span
        className={`inline-flex items-center px-2.5 py-1 rounded-md text-xs font-bold tabular-nums border ${
          exceeded
            ? 'bg-red-50 text-red-800 border-red-300'
            : 'bg-emerald-50 text-emerald-800 border-emerald-300'
        }`}
      >
        {diffCm.toFixed(1)} cm
      </span>
      {signedDiffCm !== null && signedDiffCm !== 0 && (
        <span className="text-[11px] text-gray-600">
          {signedDiffCm > 0 ? '+' : ''}
          {signedDiffCm.toFixed(1)} cm ({directionLabel})
        </span>
      )}
    </div>
  );
}
