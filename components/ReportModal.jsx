"use client";

import React, { useEffect, useMemo, useRef, useState } from 'react';
import { domToBlob } from 'modern-screenshot';
import { X, Download, Copy, Check } from 'lucide-react';
import { buildWeeklyReport } from '../lib/weeklyReportEngine';

const LABELS = ['Banjir ( <0 )', 'Tergenang ( 0-40 )', 'A Tergenang ( 41-45 )', 'Normal ( 46-60 )', 'A Kering ( 61-65 )', 'Kering ( >65 )'];
const COLORS_TW = ['#000000', '#4170B0', '#1CB8E0', '#5A732A', '#FFFB00', '#DC2626'];
const COLORS_LW = ['#999999', '#B3C5DF', '#99ECFF', '#BDC7A9', '#FFFD99', '#FF9999'];

const PT_ORDER = ['PT.THIP', 'PT.JJP', 'PT.PTW', 'PT.SIP', 'PT.PANPS', 'PT.SAM', 'PT.GAN', 'PT.PLDK', 'PT.SUMK'];

const getDomColor = (s) => { const i = ['Banjir', 'Tergenang', 'A Tergenang', 'Normal', 'A Kering', 'Kering'].indexOf(s); return i !== -1 ? COLORS_TW[i] : '#CCCCCC'; };
const getDomTextColor = (s) => (['A Kering', 'A Tergenang', 'No Data'].includes(s) || !s) ? '#111827' : '#FFFFFF';

const REGIME_PILL = {
    WET: { bg: '#1E3A8A', text: '#FFFFFF', label: 'PERIODE BASAH' },
    DRY: { bg: '#991B1B', text: '#FFFFFF', label: 'PERIODE KERING' },
    TRANSITION: { bg: '#365314', text: '#FFFFFF', label: 'PERIODE TRANSISI' },
};

// ── Shared card component (used in both capture and preview) ──────────────
function ReportCard({ item, currentWeek, prevWeek, compact = false }) {
    const { companyName, currentWeek: curr, prevWeek: prev, rainfall, dominantStatus, tmat } = item;
    const name = companyName.replace('PT.', '');

    return (
        <div style={{
            backgroundColor: '#FFFFFF', borderRadius: '24px',
            padding: compact ? '20px 24px 16px' : '28px 28px 20px',
            border: '1px solid #EEEEEE', boxShadow: '0 1px 4px rgba(0,0,0,0.07)',
            display: 'flex', flexDirection: 'column', overflow: 'hidden'
        }}>
            {/* Header */}
            <div style={{ display: 'table', width: '100%', marginBottom: compact ? '10px' : '16px' }}>
                <div style={{ display: 'table-row' }}>
                    <div style={{ display: 'table-cell', verticalAlign: 'middle' }}>
                        <div style={{ display: 'flex', alignItems: 'flex-end', gap: '10px', flexWrap: 'nowrap', whiteSpace: 'nowrap', paddingBottom: '4px' }}>
                            <span style={{ fontSize: compact ? '34px' : '38px', fontWeight: '900', color: '#000', textTransform: 'uppercase', lineHeight: '1', flexShrink: 0 }}>
                                {name}
                            </span>
                            {tmat && (
                                <span style={{
                                    fontSize: compact ? '23px' : '26px', fontWeight: '900', lineHeight: '1',
                                    color: tmat.delta < 0 ? '#DC2626' : tmat.delta > 0 ? '#178242' : '#6B7280',
                                    whiteSpace: 'nowrap', flexShrink: 0, marginBottom: '2px'
                                }}>
                                    {`${tmat.delta < 0 ? '▼' : tmat.delta > 0 ? '▲' : '▬'} ${tmat.delta > 0 ? '+' : ''}${tmat.delta}`}
                                </span>
                            )}
                        </div>
                        <div style={{ fontSize: '14px', color: '#6B7280', fontWeight: 'bold', marginTop: '3px' }}>
                            CH {prevWeek?.slice(-2)}: {Math.floor(rainfall?.prev || 0)}mm/{rainfall?.prevHH || 0}HH | {currentWeek?.slice(-2)}: {Math.floor(rainfall?.current || 0)}mm/{rainfall?.currentHH || 0}HH
                        </div>
                        {tmat && (tmat.prev > 0 || tmat.current > 0) && (
                            <div style={{ fontSize: '13px', color: '#6B7280', fontWeight: 'bold', marginTop: '2px' }}>
                                TMAT {tmat.prev} → {tmat.current}
                            </div>
                        )}
                    </div>
                    <div style={{ display: 'table-cell', verticalAlign: 'middle', textAlign: 'right', width: '160px' }}>
                        <div style={{ display: 'inline-block', minWidth: '130px', height: '38px', borderRadius: '19px', backgroundColor: getDomColor(dominantStatus), textAlign: 'center' }}>
                            <span style={{ color: getDomTextColor(dominantStatus), fontSize: '15px', fontWeight: '900', textTransform: 'uppercase', lineHeight: '38px' }}>
                                {dominantStatus || 'No Data'}
                            </span>
                        </div>
                    </div>
                </div>
            </div>

            {/* Bars */}
            {LABELS.map((label, i) => {
                const lwPct = prev?.percentages?.[i] || 0;
                const twPct = curr?.percentages?.[i] || 0;
                let trend = '▬', trendColor = '#9CA3AF';
                if (twPct > lwPct) { trend = '▲'; trendColor = i === 3 ? '#178242' : '#DC2626'; }
                else if (twPct < lwPct) { trend = '▼'; trendColor = i === 3 ? '#DC2626' : '#178242'; }

                return (
                    <div key={i} style={{ display: 'table', width: '100%', borderCollapse: 'collapse', marginBottom: compact ? '5px' : '7px' }}>
                        <div style={{ display: 'table-row' }}>
                            <div style={{ display: 'table-cell', verticalAlign: 'middle', width: '210px', paddingRight: '14px' }}>
                                <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                                    <div style={{ width: '16px', height: '16px', flexShrink: 0, backgroundColor: COLORS_TW[i] }} />
                                    <div style={{ fontSize: '14px', fontWeight: 'bold', color: '#374151', lineHeight: '1' }}>{label}</div>
                                </div>
                            </div>
                            <div style={{ display: 'table-cell', verticalAlign: 'middle' }}>
                                <div style={{ position: 'relative', width: '100%', height: compact ? '22px' : '26px' }}>
                                    <div style={{ position: 'absolute', top: 0, left: 0, height: '100%', width: `${lwPct}%`, backgroundColor: COLORS_LW[i], borderRadius: '4px' }} />
                                    <div style={{ position: 'absolute', top: '25%', left: 0, height: '50%', width: `${twPct}%`, backgroundColor: COLORS_TW[i], borderRadius: '3px' }} />
                                </div>
                            </div>
                            <div style={{ display: 'table-cell', verticalAlign: 'middle', textAlign: 'right', width: '48px', fontSize: '13px', color: '#6B7280', fontWeight: 'bold', paddingLeft: '10px' }}>{lwPct}%</div>
                            <div style={{ display: 'table-cell', verticalAlign: 'middle', textAlign: 'center', width: '22px', fontSize: '12px', color: '#9CA3AF' }}>→</div>
                            <div style={{ display: 'table-cell', verticalAlign: 'middle', textAlign: 'right', width: '48px', fontSize: '15px', fontWeight: '900', color: '#111827' }}>{twPct}%</div>
                            <div style={{ display: 'table-cell', verticalAlign: 'middle', textAlign: 'center', width: '22px', fontSize: '14px', fontWeight: '900', color: trendColor }}>{trend}</div>
                        </div>
                    </div>
                );
            })}
        </div>
    );
}

function TrendDeltaLabel({ delta, worseWhenPositive = true }) {
    if (delta === null || delta === undefined) return null;
    const isUp = delta > 0;
    const isDown = delta < 0;
    const color = delta === 0
        ? '#6B7280'
        : (worseWhenPositive ? (isUp ? '#DC2626' : '#178242') : (isUp ? '#178242' : '#DC2626'));
    const text = isUp
        ? `▲ Naik ${delta}% vs minggu lalu`
        : isDown
            ? `▼ Turun ${Math.abs(delta)}% vs minggu lalu`
            : '▬ 0% vs minggu lalu';
    return (
        <span style={{ fontSize: '15px', fontWeight: '700', color, whiteSpace: 'nowrap' }}>
            {text}
        </span>
    );
}

// ── Shared canvas content ─────────────────────────────────────────────────
function ReportCanvas({
    displayData,
    currentWeek,
    prevWeek,
    regime,
    summary,
    deltas,
    narrative,
    includeNarrative,
}) {
    const dateStr = new Date().toLocaleDateString('id-ID', { day: 'numeric', month: 'short', year: '2-digit' });
    const pill = REGIME_PILL[regime] || REGIME_PILL.TRANSITION;

    const avgNormal = summary?.pctNormal ?? 0;
    const avgTergenang = summary?.pctTergenang ?? 0;
    const avgBanjir = summary?.pctBanjir ?? 0;
    const avgKering = summary?.pctKering ?? 0;

    return (
        <div style={{
            width: '2400px', height: '1350px',
            backgroundColor: '#FFFFFF',
            padding: includeNarrative ? '26px 32px' : '32px',
            boxSizing: 'border-box', overflow: 'hidden',
            display: 'flex', flexDirection: 'column', gap: includeNarrative ? '14px' : '18px'
        }}>
            {/* Header */}
            <div style={{ backgroundColor: '#FAFAFA', borderRadius: '24px', padding: '18px 32px', display: 'flex', alignItems: 'center', gap: '32px', flexShrink: 0, border: '1px solid #EEEEEE' }}>
                <div style={{ flex: 1 }}>
                    <div style={{ fontSize: '34px', fontWeight: '900', color: '#111827', lineHeight: '1' }}>Summary CH &amp; PZO</div>
                    <div style={{ fontSize: '16px', color: '#4B5563', fontWeight: '600', marginTop: '6px' }}>
                        Last Update {currentWeek} · {dateStr} · Bobot Titik PZO
                    </div>
                </div>

                {/* Primary stat: NORMAL */}
                <div style={{ display: 'flex', alignItems: 'center', gap: '12px', flexShrink: 0 }}>
                    <span style={{ fontSize: '46px', fontWeight: '900', color: '#111827', lineHeight: '1' }}>{avgNormal}%</span>
                    <span style={{ padding: '6px 18px', borderRadius: '24px', backgroundColor: '#5A732A', color: '#FFFFFF', fontSize: '17px', fontWeight: '900' }}>NORMAL</span>
                    {regime === 'TRANSITION' && <TrendDeltaLabel delta={deltas?.pctNormal ?? 0} worseWhenPositive={false} />}
                </div>

                {/* Adaptive Focus Stat */}
                {regime === 'WET' ? (
                    <>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '12px', flexShrink: 0 }}>
                            <span style={{ fontSize: '46px', fontWeight: '900', color: '#111827', lineHeight: '1' }}>{avgTergenang}%</span>
                            <span style={{ padding: '6px 18px', borderRadius: '24px', backgroundColor: '#4170B0', color: '#FFFFFF', fontSize: '17px', fontWeight: '900' }}>TERGENANG</span>
                            <TrendDeltaLabel delta={deltas?.pctTergenang ?? 0} worseWhenPositive={true} />
                        </div>
                        {avgBanjir > 0 && (
                            <div style={{ display: 'flex', alignItems: 'center', gap: '12px', flexShrink: 0 }}>
                                <span style={{ fontSize: '46px', fontWeight: '900', color: '#111827', lineHeight: '1' }}>{avgBanjir}%</span>
                                <span style={{ padding: '6px 18px', borderRadius: '24px', backgroundColor: '#000000', color: '#FFFFFF', fontSize: '17px', fontWeight: '900' }}>BANJIR</span>
                            </div>
                        )}
                    </>
                ) : regime === 'DRY' ? (
                    <div style={{ display: 'flex', alignItems: 'center', gap: '12px', flexShrink: 0 }}>
                        <span style={{ fontSize: '46px', fontWeight: '900', color: '#111827', lineHeight: '1' }}>{avgKering}%</span>
                        <span style={{ padding: '6px 18px', borderRadius: '24px', backgroundColor: '#DC2626', color: '#FFFFFF', fontSize: '17px', fontWeight: '900' }}>KERING</span>
                        <TrendDeltaLabel delta={deltas?.pctKering ?? 0} worseWhenPositive={true} />
                    </div>
                ) : (summary?.pctWet ?? 0) >= (summary?.pctDry ?? 0) ? (
                    <div style={{ display: 'flex', alignItems: 'center', gap: '12px', flexShrink: 0 }}>
                        <span style={{ fontSize: '46px', fontWeight: '900', color: '#111827', lineHeight: '1' }}>{avgTergenang}%</span>
                        <span style={{ padding: '6px 18px', borderRadius: '24px', backgroundColor: '#4170B0', color: '#FFFFFF', fontSize: '17px', fontWeight: '900' }}>TERGENANG</span>
                    </div>
                ) : (
                    <div style={{ display: 'flex', alignItems: 'center', gap: '12px', flexShrink: 0 }}>
                        <span style={{ fontSize: '46px', fontWeight: '900', color: '#111827', lineHeight: '1' }}>{avgKering}%</span>
                        <span style={{ padding: '6px 18px', borderRadius: '24px', backgroundColor: '#DC2626', color: '#FFFFFF', fontSize: '17px', fontWeight: '900' }}>KERING</span>
                    </div>
                )}
            </div>

            {/* 3×3 grid */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: includeNarrative ? '14px' : '18px', flex: 1, minHeight: 0 }}>
                {displayData.map(item => (
                    <ReportCard key={item.companyCode} item={item} currentWeek={currentWeek} prevWeek={prevWeek} compact={includeNarrative} />
                ))}
            </div>

            {/* Optional Narrative Strip */}
            {includeNarrative && narrative && (
                <div style={{
                    backgroundColor: '#FAFAFA',
                    borderRadius: '20px',
                    border: '1px solid #EEEEEE',
                    padding: '14px 24px',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '18px',
                    flexShrink: 0,
                }}>
                    <span style={{
                        padding: '6px 14px',
                        borderRadius: '12px',
                        backgroundColor: pill.bg,
                        color: pill.text,
                        fontSize: '13px',
                        fontWeight: '900',
                        letterSpacing: '0.03em',
                        whiteSpace: 'nowrap',
                        flexShrink: 0,
                    }}>
                        {pill.label}
                    </span>
                    <div style={{ fontSize: '16px', lineHeight: '1.45', color: '#111827', fontWeight: '600' }}>
                        {narrative}
                    </div>
                </div>
            )}
        </div>
    );
}

// ── Modal ─────────────────────────────────────────────────────────────────
const CANVAS_W = 2400;
const CANVAS_H = 1350;
const PREVIEW_W = 960;
const PREVIEW_SCALE = PREVIEW_W / CANVAS_W;

export default function ReportModal({ data, currentWeek, prevWeek, onClose }) {
    const captureRef = useRef(null);
    const [downloading, setDownloading] = useState(false);
    const [copying, setCopying] = useState(false);
    const [copied, setCopied] = useState(false);
    const [includeNarrative, setIncludeNarrative] = useState(true);
    const [serverReport, setServerReport] = useState(null);

    useEffect(() => {
        const handleKeyDown = (e) => {
            if (e.key === 'Escape') onClose();
        };
        window.addEventListener('keydown', handleKeyDown);
        return () => window.removeEventListener('keydown', handleKeyDown);
    }, [onClose]);

    // Fetch rich weekly report (includes 3-week rainfall + saved field action notes)
    useEffect(() => {
        if (!currentWeek) return;
        const controller = new AbortController();
        fetch(`/api/weekly-report?week=${encodeURIComponent(currentWeek)}&method=weighted&history=1`, {
            signal: controller.signal,
        })
            .then((r) => (r.ok ? r.json() : null))
            .then((json) => {
                if (json?.report) setServerReport(json.report);
            })
            .catch(() => {});
        return () => controller.abort();
    }, [currentWeek]);

    const displayData = useMemo(() => {
        if (!data || data.length === 0) return [];
        const ordered = PT_ORDER.map(code => data.find(d => d.companyCode === code)).filter(Boolean);
        const extras = data.filter(d => !PT_ORDER.includes(d.companyCode));
        return [...ordered, ...extras].slice(0, 9);
    }, [data]);

    // Local fallback report derived immediately from displayData until serverReport arrives
    const fallbackReport = useMemo(() => {
        if (displayData.length === 0) return null;
        const toEngineRows = (isCurr) => displayData.map((d) => {
            const w = isCurr ? d.currentWeek : d.prevWeek;
            const total = w?.total_blocks || 0;
            const pcts = w?.percentages || [0, 0, 0, 0, 0, 0];
            return {
                company_code: d.companyCode,
                company_name: d.companyName,
                cnt_banjir: w?.cnt_banjir ?? 0,
                cnt_tergenang: w?.cnt_tergenang ?? 0,
                cnt_a_tergenang: w?.cnt_a_tergenang ?? 0,
                cnt_normal: w?.cnt_normal ?? 0,
                cnt_a_kering: w?.cnt_a_kering ?? 0,
                cnt_kering: w?.cnt_kering ?? 0,
                cnt_total: total,
                percentages: pcts,
                avg_tmat: isCurr ? (d.tmat?.current || null) : (d.tmat?.prev || null),
                dominant_status: d.dominantStatus,
                ch_1w: isCurr ? (d.rainfall?.current || 0) : (d.rainfall?.prev || 0),
                ch_3w: isCurr ? (d.rainfall?.current || 0) * 3 : (d.rainfall?.prev || 0) * 3,
            };
        });

        return buildWeeklyReport({
            weekMeta: { formatted_name: currentWeek || '' },
            companyRows: toEngineRows(true),
            prevCompanyRows: toEngineRows(false),
            method: 'weighted',
        });
    }, [displayData, currentWeek]);

    if (!data || data.length === 0) return null;

    const activeReport = serverReport || fallbackReport;
    const canvasProps = {
        displayData,
        currentWeek,
        prevWeek,
        regime: activeReport?.regime || 'TRANSITION',
        summary: activeReport?.summary,
        deltas: activeReport?.deltas,
        narrative: activeReport?.effectiveNarrative || '',
        includeNarrative,
    };

    const captureBlob = () => domToBlob(captureRef.current, { scale: 1, backgroundColor: '#FFFFFF' });

    const handleDownload = async () => {
        setDownloading(true);
        try {
            const blob = await captureBlob();
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = `Report_${(currentWeek || 'latest').replace(/[,\s]+/g, '_')}.png`;
            a.click();
            URL.revokeObjectURL(url);
        } finally { setDownloading(false); }
    };

    const handleCopy = async () => {
        setCopying(true);
        try {
            const blob = await captureBlob();
            await navigator.clipboard.write([new ClipboardItem({ 'image/png': blob })]);
            setCopied(true);
            setTimeout(() => setCopied(false), 2000);
        } finally { setCopying(false); }
    };

    return (
        <>
            {/* ── OFF-SCREEN capture target at FULL 2400×1350, NO parent transform ── */}
            <div style={{ position: 'fixed', left: '-9999px', top: 0, zIndex: -1, pointerEvents: 'none' }}>
                <div ref={captureRef}>
                    <ReportCanvas {...canvasProps} />
                </div>
            </div>

            {/* ── Modal UI ── */}
            <div
                style={{ position: 'fixed', inset: 0, backgroundColor: 'rgba(0,0,0,0.65)', zIndex: 9999, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '20px' }}
                onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
            >
                <div
                    role="dialog"
                    aria-modal="true"
                    aria-labelledby="report-modal-title"
                    className="bg-white rounded-2xl border border-gray-200 w-full max-w-[1060px] max-h-[92vh] overflow-hidden flex flex-col shadow-xl"
                >
                    {/* Toolbar */}
                    <div className="flex flex-wrap items-center justify-between gap-3 px-6 py-4 border-b border-gray-200 bg-gray-50 shrink-0">
                        <div className="flex flex-wrap items-center gap-3">
                            <span id="report-modal-title" className="font-bold text-base text-gray-900">
                                Preview Report · {currentWeek}
                            </span>
                            <label className="min-h-11 inline-flex items-center gap-2 text-xs font-semibold text-gray-800 px-3 py-2 rounded-xl bg-white border border-gray-300 cursor-pointer">
                                <input
                                    type="checkbox"
                                    checked={includeNarrative}
                                    onChange={(e) => setIncludeNarrative(e.target.checked)}
                                    className="w-4 h-4 accent-black"
                                />
                                <span>Sertakan Narasi</span>
                            </label>
                        </div>

                        <div className="flex flex-wrap gap-2.5 items-center">
                            <button
                                type="button"
                                onClick={handleDownload}
                                disabled={downloading}
                                className="min-h-11 inline-flex items-center gap-2 px-4 py-2 bg-black hover:bg-gray-800 text-white rounded-xl font-semibold text-sm transition-colors disabled:opacity-60"
                            >
                                <Download size={15} aria-hidden="true" />
                                <span>{downloading ? 'Mengunduh…' : 'Download PNG'}</span>
                            </button>
                            <button
                                type="button"
                                onClick={handleCopy}
                                disabled={copying}
                                className="min-h-11 inline-flex items-center gap-2 px-4 py-2 bg-white hover:bg-gray-50 text-gray-900 border border-gray-300 rounded-xl font-semibold text-sm transition-colors disabled:opacity-60"
                            >
                                {copied ? <Check size={15} aria-hidden="true" /> : <Copy size={15} aria-hidden="true" />}
                                <span>{copying ? 'Copying…' : copied ? 'Copied!' : 'Copy Image'}</span>
                            </button>
                            <button
                                type="button"
                                onClick={onClose}
                                aria-label="Tutup preview report"
                                className="min-h-11 min-w-11 inline-flex items-center justify-center bg-white hover:bg-gray-100 border border-gray-300 rounded-xl text-gray-800 transition-colors"
                            >
                                <X size={18} aria-hidden="true" />
                            </button>
                        </div>
                    </div>

                    {/* Scaled preview (visual only, not captured) */}
                    <div style={{ overflow: 'auto', padding: '20px', backgroundColor: '#FFFFFF', flex: 1, display: 'flex', justifyContent: 'center', alignItems: 'flex-start' }}>
                        <div style={{
                            width: `${PREVIEW_W}px`,
                            height: `${CANVAS_H * PREVIEW_SCALE}px`,
                            flexShrink: 0, position: 'relative', overflow: 'hidden',
                            borderRadius: '8px', boxShadow: '0 4px 20px rgba(0,0,0,0.1)'
                        }}>
                            <div style={{ position: 'absolute', top: 0, left: 0, transformOrigin: 'top left', transform: `scale(${PREVIEW_SCALE})` }}>
                                <ReportCanvas {...canvasProps} />
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </>
    );
}
