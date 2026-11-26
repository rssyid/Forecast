"use client";

import { useEffect, useMemo, useRef, useState, type FormEvent } from 'react';
import { AlertTriangle, CalendarDays, Loader2, Lock, Play, X } from 'lucide-react';
import { formatWibDate } from '@/lib/analysis/date';
import { COVERAGES, DEFAULT_DAYS_BACK } from '@/lib/types';

export interface SelectableWeek {
  week_name: string;
  week_label: string;
  week_start: string;
  week_end: string;
}

const SESSION_KEY_STORAGE = 'accuracy_admin_key';

function computePreviewPeriod(weekEnd: string, todayWib: string): {
  dateFrom: string;
  dateTo: string;
} {
  const dateTo = weekEnd && weekEnd < todayWib ? weekEnd : todayWib;
  const endDt = new Date(`${dateTo}T00:00:00Z`);
  const startDt = new Date(endDt.getTime() - DEFAULT_DAYS_BACK * 86400000);
  const y = startDt.getUTCFullYear();
  const m = String(startDt.getUTCMonth() + 1).padStart(2, '0');
  const d = String(startDt.getUTCDate()).padStart(2, '0');
  return { dateFrom: `${y}-${m}-${d}`, dateTo };
}

export default function ManualTriggerModal({
  open,
  onClose,
  selectableWeeks,
  defaultWeekLabel,
  onTriggered,
}: {
  open: boolean;
  onClose: () => void;
  selectableWeeks: SelectableWeek[];
  defaultWeekLabel: string;
  onTriggered: (result: {
    week_label: string;
    coverage: string;
    date_from: string;
    date_to: string;
  }) => void;
}) {
  const [selectedWeek, setSelectedWeek] = useState(defaultWeekLabel);
  const [selectedCoverage, setSelectedCoverage] = useState('all');
  const [adminKey, setAdminKey] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const closeBtnRef = useRef<HTMLButtonElement | null>(null);
  const previousFocusRef = useRef<HTMLElement | null>(null);
  const submittingRef = useRef(false);
  submittingRef.current = submitting;

  useEffect(() => {
    if (!open) return;
    previousFocusRef.current = document.activeElement as HTMLElement | null;
    setSelectedWeek(defaultWeekLabel || selectableWeeks[0]?.week_label || '');
    setError(null);
    try {
      const saved = sessionStorage.getItem(SESSION_KEY_STORAGE);
      if (saved) setAdminKey(saved);
    } catch {
      // Ignore storage access errors in restricted browsers.
    }

    const focusTimer = setTimeout(() => {
      closeBtnRef.current?.focus();
    }, 10);

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape' && !submittingRef.current) {
        event.preventDefault();
        onClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => {
      clearTimeout(focusTimer);
      window.removeEventListener('keydown', handleKeyDown);
      previousFocusRef.current?.focus();
    };
  }, [open, defaultWeekLabel, selectableWeeks, onClose]);

  const activeWeekMeta = useMemo(
    () => selectableWeeks.find((w) => w.week_label === selectedWeek) ?? null,
    [selectableWeeks, selectedWeek]
  );

  const todayWib = useMemo(() => formatWibDate(new Date()), []);
  const previewPeriod = useMemo(() => {
    if (!activeWeekMeta) return null;
    return computePreviewPeriod(activeWeekMeta.week_end, todayWib);
  }, [activeWeekMeta, todayWib]);

  if (!open) return null;

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (!adminKey.trim()) {
      setError('Admin Key wajib diisi sebelum menjalankan penarikan data.');
      return;
    }
    setSubmitting(true);
    setError(null);

    try {
      const res = await fetch('/api/accuracy/trigger', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-admin-key': adminKey.trim(),
        },
        body: JSON.stringify({
          weekLabel: selectedWeek || undefined,
          coverage: selectedCoverage,
        }),
      });
      const json = await res.json();
      if (!res.ok) {
        throw new Error(json?.error || 'Gagal memicu workflow penarikan data.');
      }
      try {
        sessionStorage.setItem(SESSION_KEY_STORAGE, adminKey.trim());
      } catch {
        // Ignore storage errors.
      }
      onTriggered({
        week_label: json.week_label,
        coverage: json.coverage,
        date_from: json.date_from,
        date_to: json.date_to,
      });
      onClose();
    } catch (err) {
      setError(
        err instanceof Error ? err.message : 'Terjadi kesalahan saat memicu update.'
      );
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div
        className="fixed inset-0 bg-black/45"
        aria-hidden="true"
        onClick={() => {
          if (!submitting) onClose();
        }}
      />

      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="manual-trigger-title"
        className="relative z-10 w-full max-w-lg bg-white rounded-2xl border border-gray-200 shadow-xl overflow-hidden"
      >
        <div className="px-5 py-4 border-b border-gray-200 bg-gray-50 flex items-center justify-between gap-3">
          <div>
            <h2
              id="manual-trigger-title"
              className="text-base font-bold text-gray-900"
            >
              Update Manual Data Akurasi IoT
            </h2>
            <p className="text-xs text-gray-600 mt-0.5">
              Memicu penarikan portal GIS-IoT via GitHub Actions dan menguncinya ke Week terpilih.
            </p>
          </div>
          <button
            ref={closeBtnRef}
            type="button"
            onClick={onClose}
            disabled={submitting}
            aria-label="Tutup dialog update manual"
            className="min-h-11 min-w-11 inline-flex items-center justify-center rounded-xl border border-gray-300 bg-white text-gray-700 hover:bg-gray-100 disabled:opacity-50"
          >
            <X size={18} aria-hidden="true" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-5 space-y-4">
          <div>
            <label
              htmlFor="trigger-week"
              className="flex items-center gap-1.5 text-xs font-semibold text-gray-700 mb-1.5"
            >
              <CalendarDays size={14} aria-hidden="true" />
              <span>Target Week (Mengunci Snapshot)</span>
            </label>
            <select
              id="trigger-week"
              value={selectedWeek}
              onChange={(e) => setSelectedWeek(e.target.value)}
              disabled={submitting}
              className="w-full min-h-11 px-3 py-2 rounded-xl border border-gray-300 bg-white text-sm font-medium text-gray-900"
            >
              {selectableWeeks.map((w) => (
                <option key={w.week_label} value={w.week_label}>
                  {w.week_label} ({w.week_start} s.d. {w.week_end})
                </option>
              ))}
            </select>
          </div>

          <div>
            <label
              htmlFor="trigger-coverage"
              className="block text-xs font-semibold text-gray-700 mb-1.5"
            >
              Cakupan Coverage
            </label>
            <select
              id="trigger-coverage"
              value={selectedCoverage}
              onChange={(e) => setSelectedCoverage(e.target.value)}
              disabled={submitting}
              className="w-full min-h-11 px-3 py-2 rounded-xl border border-gray-300 bg-white text-sm font-medium text-gray-900"
            >
              <option value="all">Semua Coverage (7 Wilayah)</option>
              {COVERAGES.map((cov) => (
                <option key={cov} value={cov}>
                  {cov}
                </option>
              ))}
            </select>
          </div>

          {previewPeriod && (
            <div className="rounded-xl bg-gray-50 border border-gray-200 p-3.5 text-xs text-gray-700 space-y-1">
              <p className="font-semibold text-gray-900">
                Rentang penarikan portal: {previewPeriod.dateFrom} s.d. {previewPeriod.dateTo} WIB
              </p>
              <p>
                Estimasi durasi: 3 sampai 6 menit untuk semua coverage. Minggu lain yang sudah tersimpan tetap terkunci dan tidak tertimpa.
              </p>
            </div>
          )}

          <div>
            <label
              htmlFor="trigger-admin-key"
              className="flex items-center gap-1.5 text-xs font-semibold text-gray-700 mb-1.5"
            >
              <Lock size={14} aria-hidden="true" />
              <span>Admin Key</span>
            </label>
            <input
              id="trigger-admin-key"
              type="password"
              value={adminKey}
              onChange={(e) => setAdminKey(e.target.value)}
              disabled={submitting}
              placeholder="Masukkan Admin Key..."
              autoComplete="current-password"
              className="w-full min-h-11 px-3 py-2 rounded-xl border border-gray-300 bg-white text-sm text-gray-900 placeholder:text-gray-500"
            />
          </div>

          {error && (
            <div
              role="alert"
              className="rounded-xl bg-red-50 border border-red-300 p-3 flex items-start gap-2.5 text-xs text-red-900"
            >
              <AlertTriangle
                size={16}
                aria-hidden="true"
                className="shrink-0 mt-0.5 text-red-700"
              />
              <span className="font-medium">{error}</span>
            </div>
          )}

          <div className="pt-2 flex flex-wrap items-center justify-end gap-2.5 border-t border-gray-100">
            <button
              type="button"
              onClick={onClose}
              disabled={submitting}
              className="min-h-11 px-4 py-2 rounded-xl border border-gray-300 bg-white text-sm font-semibold text-gray-800 hover:bg-gray-100 disabled:opacity-50"
            >
              Batal
            </button>
            <button
              type="submit"
              disabled={submitting}
              className="min-h-11 inline-flex items-center justify-center gap-2 px-4 py-2 rounded-xl bg-black text-white text-sm font-semibold hover:bg-gray-800 disabled:opacity-60"
            >
              {submitting ? (
                <>
                  <Loader2 size={15} className="animate-spin" aria-hidden="true" />
                  <span>Memicu Workflow...</span>
                </>
              ) : (
                <>
                  <Play size={14} aria-hidden="true" />
                  <span>Jalankan Penarikan Data</span>
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
