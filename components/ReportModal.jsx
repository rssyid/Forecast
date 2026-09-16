"use client";

import React, { useRef, useState } from 'react';
import { domToBlob } from 'modern-screenshot';
import { X, Download, Copy, Check } from 'lucide-react';

const LABELS = ['Banjir ( <0 )', 'Tergenang ( 0-40 )', 'A Tergenang ( 41-45 )', 'Normal ( 46-60 )', 'A Kering ( 61-65 )', 'Kering ( >65 )'];
const COLORS_TW = ['#000000', '#4170B0', '#1CB8E0', '#5A732A', '#FFFB00', '#FF0D0D'];
const COLORS_LW = ['#999999', '#B3C5DF', '#99ECFF', '#BDC7A9', '#FFFD99', '#FF9999'];

const PT_ORDER = ['PT.THIP', 'PT.JJP', 'PT.PTW', 'PT.SIP', 'PT.PANPS', 'PT.SAM', 'PT.GAN', 'PT.PLDK', 'PT.SUMK'];

const getDomColor = (s) => { const i = ['Banjir','Tergenang','A Tergenang','Normal','A Kering','Kering'].indexOf(s); return i !== -1 ? COLORS_TW[i] : '#CCCCCC'; };
const getDomTextColor = (s) => (['A Kering', 'No Data'].includes(s) || !s) ? '#111827' : '#FFFFFF';

// ── Shared card component (used in both capture and preview) ──────────────
function ReportCard({ item, currentWeek, prevWeek }) {
    const { companyName, currentWeek: curr, prevWeek: prev, rainfall, dominantStatus, tmat } = item;
    const name = companyName.replace('PT.', '');

    return (
        <div style={{
            backgroundColor: '#FFFFFF', borderRadius: '24px', padding: '28px 28px 20px',
            border: '1px solid #EEEEEE', boxShadow: '0 1px 4px rgba(0,0,0,0.07)',
            display: 'flex', flexDirection: 'column', overflow: 'hidden'
        }}>
            {/* Header */}
            <div style={{ display: 'table', width: '100%', marginBottom: '16px' }}>
                <div style={{ display: 'table-row' }}>
                    <div style={{ display: 'table-cell', verticalAlign: 'middle' }}>
                        <div style={{ display: 'flex', alignItems: 'flex-end', gap: '10px', flexWrap: 'nowrap', whiteSpace: 'nowrap', paddingBottom: '4px' }}>
                            <span style={{ fontSize: '38px', fontWeight: '900', color: '#000', textTransform: 'uppercase', lineHeight: '1', flexShrink: 0 }}>
                                {name}
                            </span>
                            {tmat && (
                                <span style={{
                                    fontSize: '26px', fontWeight: '900', lineHeight: '1',
                                    color: tmat.delta < 0 ? '#EF4444' : tmat.delta > 0 ? '#178242' : '#9CA3AF',
                                    whiteSpace: 'nowrap', flexShrink: 0, marginBottom: '2px'
                                }}>
                                    {`${tmat.delta < 0 ? '▼' : tmat.delta > 0 ? '▲' : '▬'} ${tmat.delta > 0 ? '+' : ''}${tmat.delta}`}
                                </span>
                            )}
                        </div>
                        <div style={{ fontSize: '15px', color: '#b4b4b4', fontWeight: 'bold', marginTop: '4px' }}>
                            CH {prevWeek?.slice(-2)}: {Math.floor(rainfall?.prev || 0)}mm/{rainfall?.prevHH || 0}HH | {currentWeek?.slice(-2)}: {Math.floor(rainfall?.current || 0)}mm/{rainfall?.currentHH || 0}HH
                        </div>
                        {tmat && (tmat.prev > 0 || tmat.current > 0) && (
                            <div style={{ fontSize: '14px', color: '#b4b4b4', fontWeight: 'bold', marginTop: '2px' }}>
                                TMAT {tmat.prev} → {tmat.current}
                            </div>
                        )}
                    </div>
                    <div style={{ display: 'table-cell', verticalAlign: 'middle', textAlign: 'right', width: '160px' }}>
                        <div style={{ display: 'inline-block', minWidth: '130px', height: '40px', borderRadius: '20px', backgroundColor: getDomColor(dominantStatus), textAlign: 'center' }}>
                            <span style={{ color: getDomTextColor(dominantStatus), fontSize: '16px', fontWeight: '900', textTransform: 'uppercase', lineHeight: '40px' }}>
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
                let trend = '▬', trendColor = '#D1D5DB';
                if (twPct > lwPct) { trend = '▲'; trendColor = i === 3 ? '#178242' : '#EF4444'; }
                else if (twPct < lwPct) { trend = '▼'; trendColor = i === 3 ? '#EF4444' : '#178242'; }

                return (
                    <div key={i} style={{ display: 'table', width: '100%', borderCollapse: 'collapse', marginBottom: '7px' }}>
                        <div style={{ display: 'table-row' }}>
                            <div style={{ display: 'table-cell', verticalAlign: 'middle', width: '210px', paddingRight: '14px' }}>
                                <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                                    <div style={{ width: '18px', height: '18px', flexShrink: 0, backgroundColor: COLORS_TW[i] }} />
                                    <div style={{ fontSize: '14px', fontWeight: 'bold', color: '#374151', lineHeight: '1' }}>{label}</div>
                                </div>
                            </div>
                            <div style={{ display: 'table-cell', verticalAlign: 'middle' }}>
                                <div style={{ position: 'relative', width: '100%', height: '26px' }}>
                                    <div style={{ position: 'absolute', top: 0, left: 0, height: '100%', width: `${lwPct}%`, backgroundColor: COLORS_LW[i], borderRadius: '4px' }} />
                                    <div style={{ position: 'absolute', top: '25%', left: 0, height: '50%', width: `${twPct}%`, backgroundColor: COLORS_TW[i], borderRadius: '3px' }} />
                                </div>
                            </div>
                            <div style={{ display: 'table-cell', verticalAlign: 'middle', textAlign: 'right', width: '48px', fontSize: '13px', color: '#9CA3AF', fontWeight: 'bold', paddingLeft: '10px' }}>{lwPct}%</div>
                            <div style={{ display: 'table-cell', verticalAlign: 'middle', textAlign: 'center', width: '22px', fontSize: '12px', color: '#D1D5DB' }}>→</div>
                            <div style={{ display: 'table-cell', verticalAlign: 'middle', textAlign: 'right', width: '48px', fontSize: '15px', fontWeight: '900', color: '#111827' }}>{twPct}%</div>
                            <div style={{ display: 'table-cell', verticalAlign: 'middle', textAlign: 'center', width: '22px', fontSize: '14px', fontWeight: '900', color: trendColor }}>{trend}</div>
                        </div>
                    </div>
                );
            })}
        </div>
    );
}

// ── Shared canvas content ─────────────────────────────────────────────────
function ReportCanvas({ displayData, currentWeek, prevWeek, avgNormal, avgKering, normalDelta, keringDelta }) {
    const dateStr = new Date().toLocaleDateString('id-ID', { day: 'numeric', month: 'short', year: '2-digit' });

    return (
        <div style={{
            width: '2400px', height: '1350px',
            backgroundColor: '#FFFFFF',
            padding: '32px', boxSizing: 'border-box', overflow: 'hidden',
            display: 'flex', flexDirection: 'column', gap: '18px'
        }}>
            {/* Header */}
            <div style={{ backgroundColor: '#F8FAFC', borderRadius: '24px', padding: '20px 32px', display: 'flex', alignItems: 'center', gap: '36px', flexShrink: 0, border: '1px solid #E2E8F0' }}>
                <div style={{ flex: 1 }}>
                    <div style={{ fontSize: '34px', fontWeight: '900', color: '#111827', lineHeight: '1' }}>Summary CH &amp; PZO</div>
                    <div style={{ fontSize: '16px', color: '#9CA3AF', fontWeight: '600', marginTop: '6px' }}>Last Update {currentWeek} · {dateStr}</div>
                </div>
                {/* NORMAL stat — no trend text, just the number and badge */}
                <div style={{ display: 'flex', alignItems: 'center', gap: '14px', flexShrink: 0 }}>
                    <span style={{ fontSize: '48px', fontWeight: '900', color: '#111827', lineHeight: '1' }}>{avgNormal}%</span>
                    <span style={{ padding: '6px 18px', borderRadius: '24px', backgroundColor: '#5A732A', color: '#FFFFFF', fontSize: '17px', fontWeight: '900' }}>NORMAL</span>
                </div>
                {/* KERING stat — trend text sits right beside the red badge */}
                <div style={{ display: 'flex', alignItems: 'center', gap: '14px', flexShrink: 0 }}>
                    <span style={{ fontSize: '48px', fontWeight: '900', color: '#111827', lineHeight: '1' }}>{avgKering}%</span>
                    <span style={{ padding: '6px 18px', borderRadius: '24px', backgroundColor: '#FF0D0D', color: '#FFFFFF', fontSize: '17px', fontWeight: '900' }}>KERING</span>
                    {keringDelta !== 0 && (
                        <span style={{ fontSize: '15px', fontWeight: '700', color: keringDelta > 0 ? '#EF4444' : '#178242', whiteSpace: 'nowrap' }}>
                            {`${keringDelta > 0 ? '▲ Naik' : '▼ Turun'} ${Math.abs(keringDelta)}% vs minggu lalu`}
                        </span>
                    )}
                </div>
            </div>

            {/* 3×3 grid */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '18px', flex: 1, minHeight: 0 }}>
                {displayData.map(item => (
                    <ReportCard key={item.companyCode} item={item} currentWeek={currentWeek} prevWeek={prevWeek} />
                ))}
            </div>

        </div>
    );
}

// ── Modal ─────────────────────────────────────────────────────────────────
const CANVAS_W = 2400;
const CANVAS_H = 1350;
const PREVIEW_W = 960;
const PREVIEW_SCALE = PREVIEW_W / CANVAS_W;

export default function ReportModal({ data, currentWeek, prevWeek, onClose }) {
    // Separate ref for the OFF-SCREEN full-size capture target
    const captureRef = useRef(null);
    const [downloading, setDownloading] = useState(false);
    const [copying, setCopying] = useState(false);
    const [copied, setCopied] = useState(false);

    if (!data || data.length === 0) return null;

    // Sort by PT_ORDER
    const ordered = PT_ORDER.map(code => data.find(d => d.companyCode === code)).filter(Boolean);
    const extras = data.filter(d => !PT_ORDER.includes(d.companyCode));
    const displayData = [...ordered, ...extras].slice(0, 9);

    // Summary stats
    const getEff = (item, idx) => {
        const c = item.currentWeek?.percentages?.[idx] || 0;
        return c > 0 ? c : (item.prevWeek?.percentages?.[idx] || 0);
    };
    const n = displayData.length || 1;
    const avgNormal = Math.round(displayData.reduce((s, d) => s + getEff(d, 3), 0) / n);
    const avgKering = Math.round(displayData.reduce((s, d) => s + getEff(d, 5), 0) / n);
    const prevNormal = Math.round(displayData.reduce((s, d) => s + (d.prevWeek?.percentages?.[3] || 0), 0) / n);
    const prevKering = Math.round(displayData.reduce((s, d) => s + (d.prevWeek?.percentages?.[5] || 0), 0) / n);
    const normalDelta = avgNormal - prevNormal;
    const keringDelta = avgKering - prevKering;

    const canvasProps = { displayData, currentWeek, prevWeek, avgNormal, avgKering, normalDelta, keringDelta };

    // Capture from the off-screen full-size div (no parent transforms!)
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
                style={{ position: 'fixed', inset: 0, backgroundColor: 'rgba(0,0,0,0.72)', zIndex: 9999, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '20px' }}
                onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
            >
                <div style={{ backgroundColor: '#fff', borderRadius: '28px', width: '100%', maxWidth: '1060px', maxHeight: '92vh', overflow: 'hidden', display: 'flex', flexDirection: 'column', boxShadow: '0 25px 60px rgba(0,0,0,0.35)' }}>

                    {/* Toolbar */}
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '18px 24px', borderBottom: '1px solid #E5E7EB', flexShrink: 0 }}>
                        <span style={{ fontWeight: '900', fontSize: '18px', color: '#111827' }}>📊 Preview Report — {currentWeek}</span>
                        <div style={{ display: 'flex', gap: '10px', alignItems: 'center' }}>
                            <button onClick={handleDownload} disabled={downloading} style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '9px 16px', backgroundColor: '#2563EB', color: '#fff', border: 'none', borderRadius: '12px', fontWeight: '700', fontSize: '13px', cursor: downloading ? 'wait' : 'pointer', opacity: downloading ? 0.7 : 1 }}>
                                <Download size={15} />
                                {downloading ? 'Mengunduh…' : 'Download PNG'}
                            </button>
                            <button onClick={handleCopy} disabled={copying} style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '9px 16px', backgroundColor: '#059669', color: '#fff', border: 'none', borderRadius: '12px', fontWeight: '700', fontSize: '13px', cursor: copying ? 'wait' : 'pointer', opacity: copying ? 0.7 : 1 }}>
                                {copied ? <Check size={15} /> : <Copy size={15} />}
                                {copying ? 'Copying…' : copied ? 'Copied!' : 'Copy Image'}
                            </button>
                            <button onClick={onClose} style={{ padding: '9px', backgroundColor: '#F3F4F6', border: 'none', borderRadius: '12px', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                                <X size={18} color="#374151" />
                            </button>
                        </div>
                    </div>

                    {/* Scaled preview (visual only, not captured) */}
                    <div style={{ overflow: 'auto', padding: '20px', backgroundColor: '#E2E8F0', flex: 1, display: 'flex', justifyContent: 'center', alignItems: 'flex-start' }}>
                        <div style={{
                            width: `${PREVIEW_W}px`,
                            height: `${CANVAS_H * PREVIEW_SCALE}px`,
                            flexShrink: 0, position: 'relative', overflow: 'hidden',
                            borderRadius: '8px', boxShadow: '0 8px 32px rgba(0,0,0,0.2)'
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
