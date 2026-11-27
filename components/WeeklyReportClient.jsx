"use client";

import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import {
    Activity,
    AlertCircle,
    CalendarDays,
    Check,
    ChevronLeft,
    ChevronRight,
    CloudRain,
    Copy,
    Database,
    Edit3,
    RotateCcw,
    Save,
    Sparkles,
    Waves,
} from 'lucide-react';
import {
    BarController,
    BarElement,
    CategoryScale,
    Chart as ChartJS,
    Legend,
    LineController,
    LineElement,
    LinearScale,
    PointElement,
    Tooltip,
} from 'chart.js';
import { Chart } from 'react-chartjs-2';
import SearchableSelect from './SearchableSelect';
import {
    FIELD_ACTION_PRESETS,
    buildWeeklyReport,
    formatShortWeekLabel,
    stripPtPrefix,
} from '../lib/weeklyReportEngine';

ChartJS.register(
    CategoryScale,
    LinearScale,
    PointElement,
    LineElement,
    BarElement,
    LineController,
    BarController,
    Tooltip,
    Legend
);

const STATUS_BADGE_STYLES = {
    Banjir: { bg: '#000000', text: '#FFFFFF', border: '#000000' },
    Tergenang: { bg: '#4170B0', text: '#FFFFFF', border: '#4170B0' },
    'A Tergenang': { bg: '#1CB8E0', text: '#111827', border: '#0EA5E9' },
    Normal: { bg: '#5A732A', text: '#FFFFFF', border: '#5A732A' },
    'A Kering': { bg: '#FFFB00', text: '#111827', border: '#D97706' },
    Kering: { bg: '#B91C1C', text: '#FFFFFF', border: '#B91C1C' },
    'No Data': { bg: '#E5E7EB', text: '#111827', border: '#D1D5DB' },
};

const REGIME_BADGE_STYLES = {
    WET: {
        bgClass: 'bg-[#1E3A8A] text-white border-[#1E3A8A]',
        icon: Waves,
        label: 'Periode Basah: Fokus Tergenang & Banjir',
    },
    DRY: {
        bgClass: 'bg-[#991B1B] text-white border-[#991B1B]',
        icon: AlertCircle,
        label: 'Periode Kering: Fokus Piezometer Merah (>65 cm)',
    },
    TRANSITION: {
        bgClass: 'bg-[#365314] text-white border-[#365314]',
        icon: Activity,
        label: 'Periode Transisi: Fokus Stabilitas Normal',
    },
};

function formatDateRangeId(startIso, endIso) {
    if (!startIso || !endIso) return '';
    const fmt = (iso) => {
        const d = new Date(`${String(iso).slice(0, 10)}T00:00:00Z`);
        if (isNaN(d.getTime())) return iso;
        return d.toLocaleDateString('id-ID', {
            day: 'numeric',
            month: 'short',
            year: 'numeric',
            timeZone: 'UTC',
        });
    };
    return `${fmt(startIso)} - ${fmt(endIso)}`;
}

function formatSavedTimeId(iso) {
    if (!iso) return null;
    const d = new Date(iso);
    if (isNaN(d.getTime())) return null;
    return d.toLocaleString('id-ID', {
        day: 'numeric',
        month: 'short',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
    });
}

function DeltaText({ value, unit = '%', prevShortLabel = '', invertGood = false }) {
    if (value === null || value === undefined || Number.isNaN(value)) {
        return <span className="text-xs text-gray-600">Belum ada pembanding minggu lalu</span>;
    }
    const num = Number(value);
    const vsLabel = prevShortLabel ? ` vs ${prevShortLabel}` : ' vs minggu lalu';
    if (num === 0) {
        return <span className="text-xs font-medium text-gray-600 tabular-nums">Stabil (0{unit}{vsLabel})</span>;
    }
    const isUp = num > 0;
    const isGood = invertGood ? !isUp : isUp;
    const colorClass = isGood ? 'text-emerald-800' : 'text-red-800';
    const prefix = isUp ? '+' : '';
    return (
        <span className={`text-xs font-semibold tabular-nums ${colorClass}`}>
            {isUp ? 'Naik' : 'Turun'} {prefix}{num}{unit}{vsLabel}
        </span>
    );
}

function StatusChip({ status }) {
    const style = STATUS_BADGE_STYLES[status] || STATUS_BADGE_STYLES['No Data'];
    return (
        <span
            className="inline-flex items-center px-2.5 py-1 rounded-md text-xs font-bold border whitespace-nowrap"
            style={{ backgroundColor: style.bg, color: style.text, borderColor: style.border }}
        >
            {status || 'No Data'}
        </span>
    );
}

export default function WeeklyReportClient() {
    const router = useRouter();
    const searchParams = useSearchParams();
    const initialWeekParam = searchParams.get('week') || '';

    const [selectedWeekName, setSelectedWeekName] = useState(initialWeekParam);
    const [payload, setPayload] = useState(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);

    // Interactive user controls
    const [method, setMethod] = useState('weighted');
    const [excludedCodes, setExcludedCodes] = useState([]);
    const [ptFilterInitialized, setPtFilterInitialized] = useState(false);
    const [ptFilterOpen, setPtFilterOpen] = useState(true);

    // Note & custom narrative editing state
    const [fieldNoteDraft, setFieldNoteDraft] = useState('');
    const [savedFieldNote, setSavedFieldNote] = useState('');
    const [customNarrativeDraft, setCustomNarrativeDraft] = useState('');
    const [savedCustomNarrative, setSavedCustomNarrative] = useState(null);
    const [isEditingNarrative, setIsEditingNarrative] = useState(false);

    // Action feedback states
    const [savingNote, setSavingNote] = useState(false);
    const [savingNarrative, setSavingNarrative] = useState(false);
    const [saveFeedback, setSaveFeedback] = useState(null); // { type: 'success'|'error', text: string }
    const [copiedMain, setCopiedMain] = useState(false);
    const [copiedWeekId, setCopiedWeekId] = useState(null);
    const [polishingAi, setPolishingAi] = useState(false);
    const [aiError, setAiError] = useState(null);

    const topAnchorRef = useRef(null);

    const fetchWeeklyData = useCallback(async (weekToLoad) => {
        setLoading(true);
        setError(null);
        setAiError(null);
        setSaveFeedback(null);
        try {
            const params = new URLSearchParams({
                history: '8',
                method: 'weighted',
            });
            if (weekToLoad) params.set('week', weekToLoad);
            const res = await fetch(`/api/weekly-report?${params.toString()}`);
            const json = await res.json();
            if (!res.ok) throw new Error(json.error || `Gagal memuat data (${res.status})`);
            setPayload(json);

            const resolvedWeek = json.selectedWeek?.formatted_name || '';
            if (resolvedWeek && resolvedWeek !== weekToLoad) {
                setSelectedWeekName(resolvedWeek);
            }

            // Initialize PT filter once (default: 9 Executive PTs)
            if (!ptFilterInitialized && Array.isArray(json.allCompanies) && json.allCompanies.length > 0) {
                const defaultSet = new Set(json.defaultIncludedCodes || []);
                const initialExcluded = json.allCompanies
                    .map((c) => c.code)
                    .filter((code) => !defaultSet.has(code));
                setExcludedCodes(initialExcluded);
                setPtFilterInitialized(true);
            }
        } catch (err) {
            setError(err.message || 'Terjadi kesalahan saat memuat laporan mingguan.');
        } finally {
            setLoading(false);
        }
    }, [ptFilterInitialized]);

    useEffect(() => {
        fetchWeeklyData(selectedWeekName);
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [selectedWeekName]);

    // Sync local draft states when payload changes for the selected week
    useEffect(() => {
        if (!payload?.rawWindow || payload.rawWindow.length === 0) return;
        const currentRaw = payload.rawWindow[payload.rawWindow.length - 1];
        const savedNote = currentRaw?.saved?.field_action_note || '';
        const savedCustom = currentRaw?.saved?.custom_narrative || null;

        setFieldNoteDraft(savedNote);
        setSavedFieldNote(savedNote);
        setSavedCustomNarrative(savedCustom);
        setCustomNarrativeDraft(savedCustom || '');
        setIsEditingNarrative(false);
    }, [payload]);

    const excludedSet = useMemo(() => new Set(excludedCodes), [excludedCodes]);

    // Instant client-side computation for active week & 8-week timeline
    const computed = useMemo(() => {
        const rawWindow = payload?.rawWindow || [];
        if (rawWindow.length === 0) {
            return { report: null, timeline: [] };
        }
        const historyMax = 8;
        const displayStartIdx = rawWindow.length > historyMax ? rawWindow.length - historyMax : 0;
        const timeline = [];

        for (let i = displayStartIdx; i < rawWindow.length; i += 1) {
            const curr = rawWindow[i];
            const prev = i > 0 ? rawWindow[i - 1] : null;
            const isSelected = i === rawWindow.length - 1;

            const includedCurr = curr.companies.filter((c) => !excludedSet.has(c.company_code));
            const includedPrev = prev ? prev.companies.filter((c) => !excludedSet.has(c.company_code)) : null;

            const noteForWeek = isSelected ? fieldNoteDraft : (curr.saved?.field_action_note || '');
            const customForWeek = isSelected ? savedCustomNarrative : (curr.saved?.custom_narrative || null);

            const built = buildWeeklyReport({
                weekMeta: curr.week,
                companyRows: includedCurr,
                prevCompanyRows: includedPrev,
                method,
                fieldActionNote: noteForWeek,
                customNarrative: customForWeek,
                updatedAt: curr.saved?.updated_at || null,
            });
            timeline.push(built);
        }

        const report = timeline.length > 0 ? timeline[timeline.length - 1] : null;
        return { report, timeline };
    }, [payload, excludedSet, method, fieldNoteDraft, savedCustomNarrative]);

    const report = computed.report;
    const timeline = computed.timeline;

    const allCompanies = payload?.allCompanies || [];
    const defaultIncludedCodes = payload?.defaultIncludedCodes || [];
    const includedCount = allCompanies.length - excludedCodes.length;

    const availableWeekOptions = useMemo(() => {
        return (payload?.availableWeeks || []).map((w) => ({
            value: w.formatted_name,
            label: `${w.formatted_name} (${w.short_label})`,
        }));
    }, [payload]);

    const handleSelectWeek = (weekName) => {
        if (!weekName || weekName === selectedWeekName) return;
        setSelectedWeekName(weekName);
        router.replace(`/analysis/weekly-report?week=${encodeURIComponent(weekName)}`, { scroll: false });
    };

    const toggleCompany = (code) => {
        setExcludedCodes((prev) => {
            if (prev.includes(code)) {
                return prev.filter((c) => c !== code);
            }
            return [...prev, code];
        });
    };

    const applyExecutive9Preset = () => {
        const execSet = new Set(defaultIncludedCodes);
        setExcludedCodes(allCompanies.map((c) => c.code).filter((c) => !execSet.has(c)));
    };

    const applyAllActivePreset = () => {
        setExcludedCodes([]);
    };

    const persistReport = async ({ nextFieldNote, nextCustomNarrative, mode }) => {
        if (!report?.week?.week_id) return;
        if (mode === 'note') setSavingNote(true);
        else setSavingNarrative(true);
        setSaveFeedback(null);

        try {
            const res = await fetch('/api/weekly-report', {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    weekId: report.week.week_id,
                    formattedName: report.week.formatted_name,
                    regime: report.regime,
                    method,
                    excludedCompanies: excludedCodes,
                    fieldActionNote: nextFieldNote,
                    customNarrative: nextCustomNarrative,
                    autoNarrative: report.autoNarrative,
                    metricsSnapshot: {
                        summary: report.summary,
                        deltas: report.deltas,
                    },
                }),
            });
            const json = await res.json();
            if (!res.ok) throw new Error(json.error || 'Gagal menyimpan laporan.');

            setSavedFieldNote(nextFieldNote);
            setSavedCustomNarrative(nextCustomNarrative || null);
            setPayload((prev) => {
                if (!prev?.rawWindow) return prev;
                const updatedWindow = prev.rawWindow.map((w, idx) => {
                    if (idx !== prev.rawWindow.length - 1) return w;
                    return {
                        ...w,
                        saved: {
                            ...(w.saved || {}),
                            ...json.saved,
                        },
                    };
                });
                return { ...prev, rawWindow: updatedWindow };
            });

            setSaveFeedback({
                type: 'success',
                text: mode === 'note' ? 'Catatan aksi lapangan tersimpan.' : 'Narasi mingguan tersimpan.',
            });
            if (mode === 'narrative') {
                setIsEditingNarrative(false);
            }
        } catch (err) {
            setSaveFeedback({
                type: 'error',
                text: err.message || 'Gagal menyimpan ke database.',
            });
        } finally {
            setSavingNote(false);
            setSavingNarrative(false);
        }
    };

    const handleCopyText = async (text, weekId = null) => {
        if (!text) return;
        try {
            await navigator.clipboard.writeText(text);
            if (weekId === null) {
                setCopiedMain(true);
                setTimeout(() => setCopiedMain(false), 2000);
            } else {
                setCopiedWeekId(weekId);
                setTimeout(() => setCopiedWeekId(null), 2000);
            }
        } catch {
            setSaveFeedback({ type: 'error', text: 'Gagal menyalin teks ke clipboard.' });
        }
    };

    const handlePolishWithAi = async () => {
        if (!report || report.summary.totalValidCompanies === 0) return;
        setPolishingAi(true);
        setAiError(null);
        try {
            const baseText = isEditingNarrative && customNarrativeDraft.trim()
                ? customNarrativeDraft.trim()
                : report.effectiveNarrative;

            const systemPrompt = `Anda adalah editor senior hidrologi perkebunan sawit lahan gambut.
Tugas: rapikan gaya bahasa laporan mingguan berikut agar lebih ringkas, lugas, dan siap dikirim ke manajemen.
ATURAN KETAT:
1. Bahasa Indonesia formal-operasional yang natural.
2. JANGAN mengubah, menambah, atau menghapus angka, persentase, curah hujan (mm), TMAT (cm), maupun nama Estate/PT.
3. JANGAN menambah klaim tindakan lapangan (pompa/pintu air) jika tidak tertulis di teks sumber.
4. DILARANG menggunakan karakter em dash (—) atau en dash (–). Gunakan koma, titik, titik dua, atau tanda kurung.
5. Output HANYA 1 paragraf ringkas tanpa pembuka atau penutup.`;

            const res = await fetch('/api/generate-ai-report', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    systemPrompt,
                    prompt: `Regime: ${report.regimeInfo.regimeLabel}\nPeriode: ${report.week.formatted_name}\nTeks Sumber:\n${baseText}`,
                }),
            });
            const json = await res.json();
            if (!res.ok) throw new Error(json.error || 'Layanan AI tidak merespons.');
            const polished = String(json.text || json.report || '').replace(/—/g, ', ').trim();
            if (!polished) throw new Error('Hasil polesan AI kosong.');

            setCustomNarrativeDraft(polished);
            setIsEditingNarrative(true);
        } catch (err) {
            setAiError(err.message || 'Gagal memoles narasi dengan AI.');
        } finally {
            setPolishingAi(false);
        }
    };

    // Chart.js configuration for 8-week shift
    const trendChartData = useMemo(() => {
        const labels = timeline.map((t) => t.week.short_label);
        return {
            labels,
            datasets: [
                {
                    type: 'line',
                    label: 'Basah: Banjir + Tergenang (%)',
                    data: timeline.map((t) => t.summary.pctWet),
                    borderColor: '#4170B0',
                    backgroundColor: '#4170B0',
                    borderWidth: 2.5,
                    tension: 0.25,
                    pointRadius: 3.5,
                    yAxisID: 'y',
                },
                {
                    type: 'line',
                    label: 'Normal (%)',
                    data: timeline.map((t) => t.summary.pctNormal),
                    borderColor: '#5A732A',
                    backgroundColor: '#5A732A',
                    borderWidth: 2.5,
                    tension: 0.25,
                    pointRadius: 3.5,
                    yAxisID: 'y',
                },
                {
                    type: 'line',
                    label: 'Kering / Merah (%)',
                    data: timeline.map((t) => t.summary.pctKering),
                    borderColor: '#B91C1C',
                    backgroundColor: '#B91C1C',
                    borderWidth: 2.5,
                    tension: 0.25,
                    pointRadius: 3.5,
                    yAxisID: 'y',
                },
                {
                    type: 'bar',
                    label: 'Rata-rata CH 1M (mm)',
                    data: timeline.map((t) => t.summary.avgCh1w),
                    backgroundColor: 'rgba(17, 24, 39, 0.14)',
                    borderColor: 'rgba(17, 24, 39, 0.35)',
                    borderWidth: 1,
                    borderRadius: 4,
                    yAxisID: 'y1',
                },
            ],
        };
    }, [timeline]);

    const trendChartOptions = useMemo(() => ({
        responsive: true,
        maintainAspectRatio: false,
        interaction: { mode: 'index', intersect: false },
        scales: {
            x: { grid: { display: false } },
            y: {
                type: 'linear',
                position: 'left',
                min: 0,
                max: 100,
                title: { display: true, text: 'Proporsi (%)', font: { size: 11 } },
                grid: { color: '#F3F4F6' },
            },
            y1: {
                type: 'linear',
                position: 'right',
                min: 0,
                title: { display: true, text: 'CH Mingguan (mm)', font: { size: 11 } },
                grid: { drawOnChartArea: false },
            },
        },
        plugins: {
            legend: { position: 'top', labels: { usePointStyle: true, boxWidth: 8, font: { size: 11 } } },
        },
    }), []);

    const regimeStyle = REGIME_BADGE_STYLES[report?.regime] || REGIME_BADGE_STYLES.TRANSITION;
    const RegimeIcon = regimeStyle.icon;
    const prevShort = report?.prevSummary ? formatShortWeekLabel(payload?.prevWeek?.formatted_name || '') : '';
    const isNoteDirty = fieldNoteDraft.trim() !== savedFieldNote.trim();

    // Build adaptive 4 KPI cards
    const kpiCards = useMemo(() => {
        if (!report || report.summary.totalValidCompanies === 0) return [];
        const s = report.summary;
        const d = report.deltas;
        const n = s.totalValidCompanies;

        if (report.regime === 'WET') {
            return [
                {
                    label: 'Tergenang (0-40 cm)',
                    value: `${s.pctTergenang}%`,
                    sub: `${s.dominantCounts.Tergenang} dari ${n} PT dominan Tergenang`,
                    delta: d?.pctTergenang,
                    unit: '%',
                    invertGood: true,
                },
                {
                    label: 'Banjir (<0 cm)',
                    value: `${s.pctBanjir}%`,
                    sub: `${s.dominantCounts.Banjir} PT dominan Banjir`,
                    delta: d?.pctBanjir,
                    unit: '%',
                    invertGood: true,
                },
                {
                    label: 'Akumulasi CH 3 Minggu',
                    value: `${Math.round(s.avgCh3w)} mm`,
                    sub: `${s.ptCh3wAbove150.length} dari ${n} PT di atas 150 mm`,
                    delta: d?.avgCh3w,
                    unit: ' mm',
                    invertGood: true,
                },
                {
                    label: 'Rata-rata TMAT',
                    value: s.avgTmat !== null ? `${s.avgTmat} cm` : 'Tidak ada',
                    sub: `CH minggu ini ${Math.round(s.avgCh1w)} mm`,
                    delta: d?.avgTmat,
                    unit: ' cm',
                    invertGood: false,
                },
            ];
        }

        if (report.regime === 'DRY') {
            return [
                {
                    label: 'Kering / Merah (>65 cm)',
                    value: `${s.pctKering}%`,
                    sub: `${s.dominantCounts.Kering} dari ${n} PT dominan Kering`,
                    delta: d?.pctKering,
                    unit: '%',
                    invertGood: true,
                },
                {
                    label: 'Agak Kering (61-65 cm)',
                    value: `${s.pctAKering}%`,
                    sub: `Total area kering (Kering + A.Kering): ${s.pctDry}%`,
                    delta: d?.pctAKering,
                    unit: '%',
                    invertGood: true,
                },
                {
                    label: 'Akumulasi CH 3 Minggu',
                    value: `${Math.round(s.avgCh3w)} mm`,
                    sub: `${s.ptCh3wBelow60.length} dari ${n} PT di bawah 60 mm`,
                    delta: d?.avgCh3w,
                    unit: ' mm',
                    invertGood: false,
                },
                {
                    label: 'Rata-rata TMAT',
                    value: s.avgTmat !== null ? `${s.avgTmat} cm` : 'Tidak ada',
                    sub: `CH minggu ini ${Math.round(s.avgCh1w)} mm`,
                    delta: d?.avgTmat,
                    unit: ' cm',
                    invertGood: true,
                },
            ];
        }

        return [
            {
                label: 'Normal (46-60 cm)',
                value: `${s.pctNormal}%`,
                sub: `${s.dominantCounts.Normal} dari ${n} PT dominan Normal`,
                delta: d?.pctNormal,
                unit: '%',
                invertGood: false,
            },
            {
                label: 'Basah (Banjir + Tergenang)',
                value: `${s.pctWet}%`,
                sub: `Banjir ${s.pctBanjir}% · Tergenang ${s.pctTergenang}%`,
                delta: d?.pctWet,
                unit: '%',
                invertGood: true,
            },
            {
                label: 'Kering (>65 cm)',
                value: `${s.pctKering}%`,
                sub: `Agak Kering ${s.pctAKering}%`,
                delta: d?.pctKering,
                unit: '%',
                invertGood: true,
            },
            {
                label: 'Akumulasi CH 3 Minggu',
                value: `${Math.round(s.avgCh3w)} mm`,
                sub: s.avgTmat !== null ? `Rata-rata TMAT ${s.avgTmat} cm` : 'TMAT tidak tersedia',
                delta: d?.avgCh3w,
                unit: ' mm',
                invertGood: false,
            },
        ];
    }, [report]);

    const archiveWeeksDesc = useMemo(() => {
        return [...timeline].reverse();
    }, [timeline]);

    return (
        <div ref={topAnchorRef} className="space-y-6">
            {/* Header & Period Controls */}
            <header className="flex flex-col lg:flex-row lg:items-end justify-between gap-4">
                <div>
                    <h1 className="text-2xl sm:text-3xl font-bold text-gray-900 tracking-tight">
                        Laporan Mingguan PZO
                    </h1>
                    <p className="text-sm text-gray-600 mt-1">
                        Ringkasan eksekutif week-by-week yang menyesuaikan fokus terhadap tren basah dan kering.
                    </p>
                </div>

                {payload?.selectedWeek && (
                    <div className="inline-flex items-center gap-2 self-start lg:self-auto px-3.5 py-2 rounded-xl bg-white border border-gray-300 text-xs font-semibold text-gray-800 tabular-nums">
                        <CalendarDays size={15} className="text-gray-600 shrink-0" aria-hidden="true" />
                        <span>
                            {payload.selectedWeek.formatted_name} · {formatDateRangeId(payload.selectedWeek.start_date, payload.selectedWeek.end_date)}
                        </span>
                    </div>
                )}
            </header>

            {/* Control Bar: Week Stepper, Dropdown, Aggregation Method, PT Filter */}
            <section
                aria-label="Kontrol periode dan filter perusahaan"
                className="bg-white rounded-2xl border border-gray-200 p-4 sm:p-5 shadow-xs space-y-4"
            >
                <div className="flex flex-col md:flex-row md:items-end justify-between gap-4">
                    {/* Week-by-Week Navigation */}
                    <div className="flex flex-wrap items-end gap-2">
                        <button
                            type="button"
                            onClick={() => payload?.prevWeek && handleSelectWeek(payload.prevWeek.formatted_name)}
                            disabled={loading || !payload?.prevWeek}
                            aria-label="Minggu sebelumnya"
                            className="min-h-11 px-3.5 py-2 rounded-xl border border-gray-300 bg-white hover:bg-gray-50 active:bg-gray-100 text-sm font-semibold text-gray-900 inline-flex items-center gap-1.5 disabled:opacity-45 transition-colors"
                        >
                            <ChevronLeft size={16} aria-hidden="true" />
                            <span>Mundur</span>
                        </button>

                        <div className="w-full sm:w-64">
                            <label htmlFor="weekly-report-week-select" className="block text-xs font-semibold text-gray-700 mb-1">
                                Periode Minggu
                            </label>
                            <SearchableSelect
                                id="weekly-report-week-select"
                                options={availableWeekOptions}
                                value={selectedWeekName}
                                onChange={handleSelectWeek}
                                placeholder="Pilih Minggu"
                                icon={<CalendarDays size={16} />}
                                autoSort={false}
                                disabled={loading || availableWeekOptions.length === 0}
                            />
                        </div>

                        <button
                            type="button"
                            onClick={() => payload?.nextWeek && handleSelectWeek(payload.nextWeek.formatted_name)}
                            disabled={loading || !payload?.nextWeek}
                            aria-label="Minggu berikutnya"
                            className="min-h-11 px-3.5 py-2 rounded-xl border border-gray-300 bg-white hover:bg-gray-50 active:bg-gray-100 text-sm font-semibold text-gray-900 inline-flex items-center gap-1.5 disabled:opacity-45 transition-colors"
                        >
                            <span>Maju</span>
                            <ChevronRight size={16} aria-hidden="true" />
                        </button>
                    </div>

                    {/* Aggregation Method & Filter Toggle */}
                    <div className="flex flex-wrap items-center gap-2.5">
                        <div
                            role="group"
                            aria-label="Metode perhitungan persentase"
                            className="inline-flex rounded-xl border border-gray-300 bg-gray-100 p-1 gap-1"
                        >
                            <button
                                type="button"
                                aria-pressed={method === 'weighted'}
                                onClick={() => setMethod('weighted')}
                                className={`min-h-11 px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors ${
                                    method === 'weighted'
                                        ? 'bg-black text-white'
                                        : 'text-gray-700 hover:bg-white'
                                }`}
                            >
                                Bobot Titik PZO
                            </button>
                            <button
                                type="button"
                                aria-pressed={method === 'company_avg'}
                                onClick={() => setMethod('company_avg')}
                                className={`min-h-11 px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors ${
                                    method === 'company_avg'
                                        ? 'bg-black text-white'
                                        : 'text-gray-700 hover:bg-white'
                                }`}
                            >
                                Rata-rata PT
                            </button>
                        </div>

                        <button
                            type="button"
                            aria-expanded={ptFilterOpen}
                            onClick={() => setPtFilterOpen((prev) => !prev)}
                            className="min-h-11 px-3.5 py-2 rounded-xl border border-gray-300 bg-white hover:bg-gray-50 text-xs font-semibold text-gray-900 transition-colors"
                        >
                            Filter PT ({includedCount}/{allCompanies.length})
                        </button>
                    </div>
                </div>

                {/* PT Include / Exclude Filter Strip */}
                {ptFilterOpen && allCompanies.length > 0 && (
                    <div className="pt-3 border-t border-gray-200 space-y-2.5">
                        <div className="flex flex-wrap items-center justify-between gap-2">
                            <span className="text-xs font-semibold text-gray-700">
                                Klik PT untuk menyertakan atau mengecualikan dari laporan ({includedCount} dari {allCompanies.length} aktif)
                            </span>
                            <div className="flex flex-wrap items-center gap-2">
                                <button
                                    type="button"
                                    onClick={applyExecutive9Preset}
                                    className="min-h-11 px-3 py-1.5 rounded-xl border border-gray-300 bg-white hover:bg-gray-100 text-xs font-semibold text-gray-900 transition-colors"
                                >
                                    Preset 9 PT Utama
                                </button>
                                <button
                                    type="button"
                                    onClick={applyAllActivePreset}
                                    className="min-h-11 px-3 py-1.5 rounded-xl border border-gray-300 bg-white hover:bg-gray-100 text-xs font-semibold text-gray-900 transition-colors"
                                >
                                    Semua PT ({allCompanies.length})
                                </button>
                            </div>
                        </div>

                        <div className="flex flex-wrap gap-2">
                            {allCompanies.map((comp) => {
                                const isIncluded = !excludedSet.has(comp.code);
                                return (
                                    <button
                                        key={comp.code}
                                        type="button"
                                        aria-pressed={isIncluded}
                                        onClick={() => toggleCompany(comp.code)}
                                        className={`min-h-11 px-3 py-2 rounded-xl border text-xs font-semibold inline-flex items-center gap-1.5 transition-colors ${
                                            isIncluded
                                                ? 'bg-gray-900 text-white border-gray-900 hover:bg-gray-800'
                                                : 'bg-white text-gray-600 border-gray-300 hover:bg-gray-100 line-through'
                                        }`}
                                    >
                                        {isIncluded && <Check size={13} aria-hidden="true" />}
                                        <span>{stripPtPrefix(comp.code)}</span>
                                    </button>
                                );
                            })}
                        </div>
                    </div>
                )}
            </section>

            {/* UI States: Loading, Error, Empty */}
            {loading ? (
                <div aria-live="polite" className="space-y-6">
                    <p className="text-sm font-medium text-gray-700">Memuat laporan mingguan PZO...</p>
                    <div className="h-60 bg-white rounded-2xl border border-gray-200 animate-pulse" />
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                        {[1, 2, 3, 4].map((i) => (
                            <div key={i} className="h-28 bg-white rounded-2xl border border-gray-200 animate-pulse" />
                        ))}
                    </div>
                </div>
            ) : error ? (
                <div
                    role="alert"
                    className="bg-red-50 border border-red-300 rounded-2xl p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-4 text-red-900"
                >
                    <div className="flex items-start gap-3">
                        <AlertCircle size={20} className="text-red-700 shrink-0 mt-0.5" aria-hidden="true" />
                        <div>
                            <p className="font-bold text-sm">Gagal memuat laporan mingguan</p>
                            <p className="text-sm mt-0.5">{error}</p>
                        </div>
                    </div>
                    <button
                        type="button"
                        onClick={() => fetchWeeklyData(selectedWeekName)}
                        className="min-h-11 px-4 py-2 rounded-xl bg-red-800 hover:bg-red-900 text-white text-sm font-semibold shrink-0"
                    >
                        Muat Ulang
                    </button>
                </div>
            ) : !report || payload?.availableWeeks?.length === 0 ? (
                <div className="bg-white rounded-2xl border border-gray-200 p-10 text-center space-y-3">
                    <div className="w-12 h-12 rounded-xl bg-gray-100 text-gray-700 flex items-center justify-center mx-auto">
                        <Database size={24} aria-hidden="true" />
                    </div>
                    <h2 className="text-base font-bold text-gray-900">Belum ada data PZO mingguan</h2>
                    <p className="text-sm text-gray-600 max-w-md mx-auto">
                        Data GIS PZO untuk minggu ini belum tersedia di database. Jalankan sinkronisasi data dari Executive Dashboard terlebih dahulu.
                    </p>
                    <div className="pt-2">
                        <Link
                            href="/analysis/comparison"
                            className="min-h-11 inline-flex items-center px-4 py-2 rounded-xl bg-black text-white text-sm font-semibold hover:bg-gray-800"
                        >
                            Buka Executive Dashboard
                        </Link>
                    </div>
                </div>
            ) : includedCount === 0 || report.summary.totalValidCompanies === 0 ? (
                <div className="bg-white rounded-2xl border border-gray-200 p-10 text-center space-y-3">
                    <h2 className="text-base font-bold text-gray-900">
                        {includedCount === 0 ? 'Tidak ada PT yang dipilih' : 'PT terpilih tidak memiliki data pada minggu ini'}
                    </h2>
                    <p className="text-sm text-gray-600 max-w-md mx-auto">
                        {includedCount === 0
                            ? 'Pilih minimal 1 PT pada panel Filter PT di atas atau aktifkan preset 9 PT Utama untuk menyusun laporan.'
                            : 'Seluruh PT yang Anda pilih berstatus No Data pada minggu ini. Pilih minggu lain atau aktifkan lebih banyak PT.'}
                    </p>
                    <div className="pt-2">
                        <button
                            type="button"
                            onClick={applyExecutive9Preset}
                            className="min-h-11 px-4 py-2 rounded-xl bg-black text-white text-sm font-semibold hover:bg-gray-800"
                        >
                            Gunakan Preset 9 PT Utama
                        </button>
                    </div>
                </div>
            ) : (
                <>
                    {/* FOCAL POINT: Executive Weekly Narrative Card */}
                    <section
                        aria-label="Narasi eksekutif mingguan"
                        className="bg-white rounded-2xl border border-gray-300 shadow-sm p-5 sm:p-6 space-y-5"
                    >
                        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                            <div className="flex flex-wrap items-center gap-2.5">
                                <span
                                    className={`inline-flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-bold border ${regimeStyle.bgClass}`}
                                >
                                    <RegimeIcon size={15} aria-hidden="true" />
                                    <span>{regimeStyle.label}</span>
                                </span>
                                <span className="inline-flex items-center px-2.5 py-1 rounded-lg bg-gray-100 border border-gray-200 text-xs font-semibold text-gray-800">
                                    {report.isCustomNarrative ? 'Narasi Diedit Manual' : 'Otomatis dari Data Aktual'}
                                </span>
                            </div>

                            {report.updatedAt && (
                                <span className="text-xs text-gray-600 tabular-nums">
                                    Tersimpan: {formatSavedTimeId(report.updatedAt)}
                                </span>
                            )}
                        </div>

                        {/* Narrative body or inline editor */}
                        {isEditingNarrative ? (
                            <div className="space-y-3">
                                <label htmlFor="custom-narrative-editor" className="block text-xs font-semibold text-gray-800">
                                    Sunting Narasi Laporan ({report.week.short_label})
                                </label>
                                <textarea
                                    id="custom-narrative-editor"
                                    rows={4}
                                    value={customNarrativeDraft}
                                    onChange={(e) => setCustomNarrativeDraft(e.target.value)}
                                    placeholder="Tulis narasi laporan mingguan..."
                                    className="w-full rounded-xl border border-gray-300 bg-white p-3.5 text-sm sm:text-base leading-relaxed text-gray-900"
                                />
                                <div className="flex flex-wrap items-center gap-2.5">
                                    <button
                                        type="button"
                                        disabled={savingNarrative || !customNarrativeDraft.trim()}
                                        onClick={() => persistReport({
                                            nextFieldNote: fieldNoteDraft,
                                            nextCustomNarrative: customNarrativeDraft.trim(),
                                            mode: 'narrative',
                                        })}
                                        className="min-h-11 px-4 py-2 rounded-xl bg-black hover:bg-gray-800 text-white text-sm font-semibold inline-flex items-center gap-2 disabled:opacity-50"
                                    >
                                        <Save size={15} aria-hidden="true" />
                                        <span>{savingNarrative ? 'Menyimpan...' : 'Simpan Narasi'}</span>
                                    </button>
                                    <button
                                        type="button"
                                        onClick={() => {
                                            setIsEditingNarrative(false);
                                            setCustomNarrativeDraft(savedCustomNarrative || '');
                                        }}
                                        className="min-h-11 px-4 py-2 rounded-xl border border-gray-300 bg-white hover:bg-gray-50 text-sm font-semibold text-gray-800"
                                    >
                                        Batal
                                    </button>
                                    {report.isCustomNarrative && (
                                        <button
                                            type="button"
                                            disabled={savingNarrative}
                                            onClick={() => persistReport({
                                                nextFieldNote: fieldNoteDraft,
                                                nextCustomNarrative: null,
                                                mode: 'narrative',
                                            })}
                                            className="min-h-11 px-4 py-2 rounded-xl border border-gray-300 bg-white hover:bg-gray-50 text-sm font-semibold text-gray-800 inline-flex items-center gap-2"
                                        >
                                            <RotateCcw size={15} aria-hidden="true" />
                                            <span>Kembalikan ke Otomatis</span>
                                        </button>
                                    )}
                                </div>
                            </div>
                        ) : (
                            <div className="bg-gray-50 border border-gray-200 rounded-xl p-4 sm:p-5">
                                <p className="text-base sm:text-[17px] leading-relaxed text-gray-900 font-medium">
                                    {report.effectiveNarrative}
                                </p>
                            </div>
                        )}

                        {/* Narrative Action Buttons */}
                        {!isEditingNarrative && (
                            <div className="flex flex-wrap items-center gap-2.5">
                                <button
                                    type="button"
                                    onClick={() => handleCopyText(report.effectiveNarrative)}
                                    className="min-h-11 px-4 py-2 rounded-xl bg-black hover:bg-gray-800 text-white text-sm font-semibold inline-flex items-center gap-2 transition-colors"
                                >
                                    {copiedMain ? <Check size={16} aria-hidden="true" /> : <Copy size={16} aria-hidden="true" />}
                                    <span>{copiedMain ? 'Teks Tersalin' : 'Salin Teks Laporan'}</span>
                                </button>

                                <button
                                    type="button"
                                    onClick={() => {
                                        setCustomNarrativeDraft(report.effectiveNarrative);
                                        setIsEditingNarrative(true);
                                    }}
                                    className="min-h-11 px-4 py-2 rounded-xl border border-gray-300 bg-white hover:bg-gray-50 text-sm font-semibold text-gray-900 inline-flex items-center gap-2 transition-colors"
                                >
                                    <Edit3 size={15} aria-hidden="true" />
                                    <span>Edit Narasi</span>
                                </button>

                                <button
                                    type="button"
                                    disabled={polishingAi}
                                    onClick={handlePolishWithAi}
                                    className="min-h-11 px-4 py-2 rounded-xl border border-gray-300 bg-white hover:bg-gray-50 text-sm font-semibold text-gray-900 inline-flex items-center gap-2 transition-colors disabled:opacity-50"
                                >
                                    <Sparkles size={15} aria-hidden="true" />
                                    <span>{polishingAi ? 'Memoles narasi...' : 'Poles Bahasa (AI)'}</span>
                                </button>

                                {report.isCustomNarrative && (
                                    <button
                                        type="button"
                                        disabled={savingNarrative}
                                        onClick={() => persistReport({
                                            nextFieldNote: fieldNoteDraft,
                                            nextCustomNarrative: null,
                                            mode: 'narrative',
                                        })}
                                        className="min-h-11 px-4 py-2 rounded-xl border border-gray-300 bg-white hover:bg-gray-50 text-sm font-semibold text-gray-800 inline-flex items-center gap-2"
                                    >
                                        <RotateCcw size={15} aria-hidden="true" />
                                        <span>Kembalikan ke Otomatis</span>
                                    </button>
                                )}
                            </div>
                        )}

                        {aiError && (
                            <div role="alert" className="p-3 rounded-xl bg-red-50 border border-red-200 text-xs font-medium text-red-900">
                                {aiError}
                            </div>
                        )}

                        {saveFeedback && (
                            <div
                                role={saveFeedback.type === 'error' ? 'alert' : 'status'}
                                className={`p-3 rounded-xl border text-xs font-semibold ${
                                    saveFeedback.type === 'error'
                                        ? 'bg-red-50 border-red-200 text-red-900'
                                        : 'bg-emerald-50 border-emerald-200 text-emerald-900'
                                }`}
                            >
                                {saveFeedback.text}
                            </div>
                        )}

                        {/* Field Action Note Editor */}
                        <div className="pt-4 border-t border-gray-200 space-y-3">
                            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-1">
                                <label htmlFor="field-action-note" className="text-xs font-bold text-gray-900 uppercase tracking-wide">
                                    Catatan Aksi Lapangan ({report.regime === 'WET' ? 'Pompa & Drainase' : report.regime === 'DRY' ? 'Water Gate & Retensi' : 'Operasional Pintu Air'})
                                </label>
                                <span className="text-xs text-gray-600">
                                    Disimpan per minggu ke database; langsung melengkapi narasi otomatis.
                                </span>
                            </div>

                            {/* Quick Presets */}
                            <div className="flex flex-wrap gap-2">
                                {(FIELD_ACTION_PRESETS[report.regime] || FIELD_ACTION_PRESETS.TRANSITION).map((preset, idx) => (
                                    <button
                                        key={idx}
                                        type="button"
                                        onClick={() => setFieldNoteDraft(preset)}
                                        className="min-h-11 px-3 py-2 rounded-xl border border-gray-300 bg-gray-50 hover:bg-gray-100 text-xs font-medium text-gray-800 text-left transition-colors"
                                    >
                                        + {preset}
                                    </button>
                                ))}
                            </div>

                            <div className="flex flex-col sm:flex-row gap-2.5 items-stretch sm:items-end">
                                <textarea
                                    id="field-action-note"
                                    rows={2}
                                    value={fieldNoteDraft}
                                    onChange={(e) => setFieldNoteDraft(e.target.value)}
                                    placeholder="Contoh: Saat ini seluruh Kebun sudah mengaktifkan pompa untuk penurunan water level."
                                    className="flex-1 rounded-xl border border-gray-300 bg-white px-3.5 py-2.5 text-sm text-gray-900 placeholder-gray-500"
                                />
                                <button
                                    type="button"
                                    disabled={savingNote || !isNoteDirty}
                                    onClick={() => persistReport({
                                        nextFieldNote: fieldNoteDraft.trim(),
                                        nextCustomNarrative: savedCustomNarrative,
                                        mode: 'note',
                                    })}
                                    className="min-h-11 px-4 py-2.5 rounded-xl bg-gray-900 hover:bg-gray-800 text-white text-sm font-semibold inline-flex items-center justify-center gap-2 disabled:opacity-45 shrink-0 transition-colors"
                                >
                                    <Save size={15} aria-hidden="true" />
                                    <span>{savingNote ? 'Menyimpan...' : 'Simpan Catatan'}</span>
                                </button>
                            </div>
                        </div>
                    </section>

                    {/* Adaptive KPI Strip */}
                    <section aria-label="Metrik hidrologi utama" className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                        {kpiCards.map((card) => (
                            <div key={card.label} className="bg-white rounded-2xl border border-gray-200 p-5 shadow-xs flex flex-col justify-between gap-2">
                                <span className="text-xs font-semibold text-gray-600 uppercase tracking-wide">{card.label}</span>
                                <div>
                                    <div className="text-2xl sm:text-3xl font-bold text-gray-900 tabular-nums tracking-tight">
                                        {card.value}
                                    </div>
                                    <p className="text-xs text-gray-600 mt-1">{card.sub}</p>
                                </div>
                                <DeltaText
                                    value={card.delta}
                                    unit={card.unit}
                                    prevShortLabel={prevShort}
                                    invertGood={card.invertGood}
                                />
                            </div>
                        ))}
                    </section>

                    {/* Asymmetric Section: Adaptive PT Ranking Table (7 cols) + 8-Week Shift Chart (5 cols) */}
                    <section aria-label="Rincian per PT dan tren 8 minggu" className="grid grid-cols-1 xl:grid-cols-12 gap-6">
                        {/* Left: PT Table */}
                        <div className="xl:col-span-7 bg-white rounded-2xl border border-gray-200 shadow-xs overflow-hidden flex flex-col">
                            <div className="p-5 border-b border-gray-200 flex flex-wrap items-center justify-between gap-2">
                                <div>
                                    <h2 className="text-base font-bold text-gray-900">
                                        Peringkat PT ({report.regimeInfo.concernTitle})
                                    </h2>
                                    <p className="text-xs text-gray-600 mt-0.5">
                                        Diurutkan sesuai prioritas {report.regimeInfo.shortLabel.toLowerCase()} pada {report.week.short_label}
                                    </p>
                                </div>
                                <span className="text-xs font-semibold text-gray-700 bg-gray-100 border border-gray-200 px-2.5 py-1 rounded-lg tabular-nums">
                                    {report.summary.totalPiezoPoints.toLocaleString('id-ID')} titik PZO
                                </span>
                            </div>

                            <div className="overflow-x-auto">
                                <table className="w-full text-sm text-left">
                                    <thead className="bg-gray-50 text-gray-700 text-xs font-semibold uppercase tracking-wider border-b border-gray-200">
                                        <tr>
                                            <th className="px-4 py-3">PT</th>
                                            <th className="px-4 py-3">Dominan</th>
                                            {report.regime === 'WET' && (
                                                <>
                                                    <th className="px-4 py-3 text-right">Tergenang</th>
                                                    <th className="px-4 py-3 text-right">Banjir</th>
                                                </>
                                            )}
                                            {report.regime === 'DRY' && (
                                                <>
                                                    <th className="px-4 py-3 text-right">Kering</th>
                                                    <th className="px-4 py-3 text-right">A.Kering</th>
                                                </>
                                            )}
                                            {report.regime === 'TRANSITION' && (
                                                <>
                                                    <th className="px-4 py-3 text-right">Normal</th>
                                                    <th className="px-4 py-3 text-right">Basah</th>
                                                    <th className="px-4 py-3 text-right">Kering</th>
                                                </>
                                            )}
                                            <th className="px-4 py-3 text-right">TMAT</th>
                                            <th className="px-4 py-3 text-right">CH 1M</th>
                                            <th className="px-4 py-3 text-right">CH 3M</th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-gray-100">
                                        {report.companies.map((c) => {
                                            const ch3Highlight =
                                                report.regime === 'WET' && c.ch_3w >= 150
                                                    ? 'text-blue-800 font-bold'
                                                    : report.regime === 'DRY' && c.ch_3w < 60
                                                        ? 'text-red-800 font-bold'
                                                        : 'text-gray-800 font-medium';
                                            return (
                                                <tr key={c.company_code} className="hover:bg-gray-50 transition-colors">
                                                    <td className="px-4 py-3 font-bold text-gray-900 whitespace-nowrap">
                                                        {c.short_name}
                                                        <span className="block text-[11px] font-normal text-gray-600 tabular-nums">
                                                            {c.cnt_valid || c.cnt_total} titik
                                                        </span>
                                                    </td>
                                                    <td className="px-4 py-3">
                                                        <StatusChip status={c.dominant_status} />
                                                    </td>

                                                    {report.regime === 'WET' && (
                                                        <>
                                                            <td className="px-4 py-3 text-right font-bold text-gray-900 tabular-nums">
                                                                {c.has_data ? `${c.pct_tergenang}%` : '–'}
                                                            </td>
                                                            <td className="px-4 py-3 text-right font-semibold tabular-nums text-gray-800">
                                                                {c.has_data ? `${c.pct_banjir}%` : '–'}
                                                            </td>
                                                        </>
                                                    )}

                                                    {report.regime === 'DRY' && (
                                                        <>
                                                            <td className="px-4 py-3 text-right font-bold text-red-800 tabular-nums">
                                                                {c.has_data ? `${c.pct_kering}%` : '–'}
                                                            </td>
                                                            <td className="px-4 py-3 text-right font-semibold text-gray-800 tabular-nums">
                                                                {c.has_data ? `${c.pct_a_kering}%` : '–'}
                                                            </td>
                                                        </>
                                                    )}

                                                    {report.regime === 'TRANSITION' && (
                                                        <>
                                                            <td className="px-4 py-3 text-right font-bold text-gray-900 tabular-nums">
                                                                {c.has_data ? `${c.pct_normal}%` : '–'}
                                                            </td>
                                                            <td className="px-4 py-3 text-right font-semibold text-blue-800 tabular-nums">
                                                                {c.has_data ? `${c.pct_wet}%` : '–'}
                                                            </td>
                                                            <td className="px-4 py-3 text-right font-semibold text-red-800 tabular-nums">
                                                                {c.has_data ? `${c.pct_kering}%` : '–'}
                                                            </td>
                                                        </>
                                                    )}

                                                    <td className="px-4 py-3 text-right font-semibold text-gray-900 tabular-nums whitespace-nowrap">
                                                        {c.avg_tmat !== null ? `${c.avg_tmat} cm` : '–'}
                                                    </td>
                                                    <td className="px-4 py-3 text-right text-gray-700 tabular-nums whitespace-nowrap">
                                                        {Math.round(c.ch_1w)} mm
                                                    </td>
                                                    <td className={`px-4 py-3 text-right tabular-nums whitespace-nowrap ${ch3Highlight}`}>
                                                        {Math.round(c.ch_3w)} mm
                                                    </td>
                                                </tr>
                                            );
                                        })}
                                    </tbody>
                                </table>
                            </div>
                        </div>

                        {/* Right: 8-Week Regime Shift Chart */}
                        <div className="xl:col-span-5 bg-white rounded-2xl border border-gray-200 shadow-xs p-5 flex flex-col">
                            <div className="mb-4">
                                <h2 className="text-base font-bold text-gray-900">
                                    Bagaimana pergeseran proporsi Basah, Normal, dan Kering terhadap curah hujan 8 minggu terakhir?
                                </h2>
                                <p className="text-xs text-gray-600 mt-1 flex items-center gap-1.5">
                                    <CloudRain size={14} className="text-gray-600 shrink-0" aria-hidden="true" />
                                    <span>Menggunakan cakupan {includedCount} PT terpilih ({method === 'weighted' ? 'Bobot Titik PZO' : 'Rata-rata PT'})</span>
                                </p>
                            </div>
                            <div className="flex-1 min-h-[300px]">
                                <Chart type="bar" data={trendChartData} options={trendChartOptions} />
                            </div>
                        </div>
                    </section>

                    {/* Week-by-Week Archive Section */}
                    <section aria-label="Arsip laporan week-by-week" className="bg-white rounded-2xl border border-gray-200 shadow-xs p-5 sm:p-6 space-y-4">
                        <div className="flex flex-wrap items-center justify-between gap-2">
                            <div>
                                <h2 className="text-base font-bold text-gray-900">
                                    Arsip Narasi Week-by-Week (8 Minggu Terakhir)
                                </h2>
                                <p className="text-xs text-gray-600 mt-0.5">
                                    Setiap minggu otomatis menyesuaikan concern narasi berdasarkan data PZO dan akumulasi CH 3 minggu pada periode tersebut.
                                </p>
                            </div>
                        </div>

                        <div className="divide-y divide-gray-200 border border-gray-200 rounded-xl overflow-hidden">
                            {archiveWeeksDesc.map((item) => {
                                const rStyle = REGIME_BADGE_STYLES[item.regime] || REGIME_BADGE_STYLES.TRANSITION;
                                const isCurrent = item.week.formatted_name === report.week.formatted_name;
                                const isCopied = copiedWeekId === item.week.week_id;

                                return (
                                    <article
                                        key={item.week.formatted_name}
                                        className={`p-4 sm:p-5 space-y-2.5 ${isCurrent ? 'bg-gray-50' : 'bg-white'}`}
                                    >
                                        <div className="flex flex-wrap items-center justify-between gap-2">
                                            <div className="flex flex-wrap items-center gap-2">
                                                <span className="text-sm font-bold text-gray-900">
                                                    {item.week.short_label}
                                                </span>
                                                <span className="text-xs text-gray-600 tabular-nums">
                                                    {item.week.formatted_name} ({formatDateRangeId(item.week.start_date, item.week.end_date)})
                                                </span>
                                                <span className={`inline-flex items-center px-2 py-0.5 rounded-md text-[11px] font-bold border ${rStyle.bgClass}`}>
                                                    {item.regimeInfo.shortLabel}
                                                </span>
                                                {isCurrent && (
                                                    <span className="inline-flex items-center px-2 py-0.5 rounded-md text-[11px] font-semibold bg-gray-900 text-white">
                                                        Minggu Aktif
                                                    </span>
                                                )}
                                            </div>

                                            <div className="flex items-center gap-2">
                                                <button
                                                    type="button"
                                                    onClick={() => handleCopyText(item.effectiveNarrative, item.week.week_id)}
                                                    className="min-h-11 px-3.5 py-2 rounded-xl border border-gray-300 bg-white hover:bg-gray-100 text-xs font-semibold text-gray-900 inline-flex items-center gap-1.5"
                                                >
                                                    {isCopied ? <Check size={13} aria-hidden="true" /> : <Copy size={13} aria-hidden="true" />}
                                                    <span>{isCopied ? 'Tersalin' : 'Salin'}</span>
                                                </button>

                                                {!isCurrent && (
                                                    <button
                                                        type="button"
                                                        onClick={() => {
                                                            handleSelectWeek(item.week.formatted_name);
                                                            topAnchorRef.current?.scrollIntoView({ behavior: 'smooth' });
                                                        }}
                                                        className="min-h-11 px-3.5 py-2 rounded-xl bg-black hover:bg-gray-800 text-white text-xs font-semibold"
                                                    >
                                                        Buka Minggu Ini
                                                    </button>
                                                )}
                                            </div>
                                        </div>

                                        <p className="text-sm leading-relaxed text-gray-800">
                                            {item.effectiveNarrative}
                                        </p>
                                    </article>
                                );
                            })}
                        </div>
                    </section>
                </>
            )}
        </div>
    );
}
