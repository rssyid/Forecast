import { AlertTriangle, CheckCircle2, Info } from 'lucide-react';
import type { CalibrationStatus, RainStatus } from '@/lib/types';

export default function DiagnosisBox({
  statusKalibrasi,
  statusHujan,
  narrative,
}: {
  statusKalibrasi: CalibrationStatus;
  statusHujan: RainStatus;
  narrative: string;
}) {
  const isCritical =
    statusKalibrasi === 'PERLU KALIBRASI ULANG' ||
    statusHujan === 'ANOMALI RESPON HUJAN';
  const isWarning = !isCritical && statusKalibrasi === 'TIDAK ADA DATA MANUAL';

  const containerStyle = isCritical
    ? 'bg-red-50 border-red-300 text-red-950'
    : isWarning
      ? 'bg-amber-50 border-amber-300 text-amber-950'
      : 'bg-emerald-50 border-emerald-300 text-emerald-950';

  const headingStyle = isCritical
    ? 'text-red-900'
    : isWarning
      ? 'text-amber-900'
      : 'text-emerald-900';

  const Icon = isCritical
    ? AlertTriangle
    : isWarning
      ? Info
      : CheckCircle2;

  return (
    <section
      aria-label="Diagnosis teknis berbasis aturan"
      className={`rounded-2xl border p-4 sm:p-5 print-avoid-break ${containerStyle}`}
    >
      <div className="flex items-start gap-3">
        <Icon size={20} aria-hidden="true" className="shrink-0 mt-0.5" />
        <div className="space-y-1.5">
          <h2 className={`text-sm font-bold uppercase tracking-wide ${headingStyle}`}>
            Diagnosis Teknis & Rekomendasi Lapangan
          </h2>
          <p className="text-sm leading-relaxed">{narrative}</p>
        </div>
      </div>
    </section>
  );
}
