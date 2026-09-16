"use client";

import React, { useRef, useState } from 'react';
import { domToBlob } from 'modern-screenshot';
import { X, Download, Copy, Check } from 'lucide-react';

const LABELS = ['Banjir', 'Tergenang', 'A Tergenang', 'Normal', 'A Kering', 'Kering'];
const COLORS_TW = ['#000000', '#4170B0', '#1CB8E0', '#5A732A', '#FFFB00', '#FF0D0D'];
const COLORS_LW = ['#999999', '#B3C5DF', '#99ECFF', '#BDC7A9', '#FFFD99', '#FF9999'];

const getDomColor = (status) => {
    const idx = LABELS.indexOf(status);
    return idx !== -1 ? COLORS_TW[idx] : '#CCCCCC';
};
const getDomTextColor = (status) => {
    if (['A Kering', 'Normal', 'No Data'].includes(status) || !status) return '#111827';
    return '#FFFFFF';
};

function MiniCard({ item, currentWeek, prevWeek }) {
    const { companyName, currentWeek: current, prevWeek: prev, rainfall, dominantStatus } = item;
    const shortName = companyName.replace('PT.', '');
    const domColor = getDomColor(dominantStatus);
    const domTextColor = getDomTextColor(dominantStatus);

    return (
        <div style={{
            backgroundColor: '#FFFFFF', borderRadius: '16px', padding: '20px',
            border: '1px solid #E5E7EB'
        }}>
            {/* Header */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '6px' }}>
                <span style={{ fontSize: '26px', fontWeight: '900', color: '#000', textTransform: 'uppercase', lineHeight: '1', whiteSpace: 'nowrap' }}>
                    {shortName}
                </span>
                <span style={{
                    padding: '3px 12px', borderRadius: '20px',
                    backgroundColor: domColor, color: domTextColor,
                    fontSize: '12px', fontWeight: '900', textTransform: 'uppercase', whiteSpace: 'nowrap', flexShrink: 0
                }}>
                    {dominantStatus || 'No Data'}
                </span>
            </div>

            {/* CH info */}
            <div style={{ fontSize: '12px', color: '#9CA3AF', fontWeight: 'bold', marginBottom: '10px' }}>
                CH {prevWeek?.slice(-2)}: {Math.floor(rainfall?.prev || 0)}mm/{rainfall?.prevHH || 0}HH | {currentWeek?.slice(-2)}: {Math.floor(rainfall?.current || 0)}mm/{rainfall?.currentHH || 0}HH
            </div>

            {/* Bars */}
            {LABELS.map((label, i) => {
                const lwPct = prev?.percentages?.[i] || 0;
                const twPct = current?.percentages?.[i] || 0;
                let trend = '▬', trendColor = '#D1D5DB';
                if (twPct > lwPct) { trend = '▲'; trendColor = i === 3 ? '#178242' : '#EF4444'; }
                else if (twPct < lwPct) { trend = '▼'; trendColor = i === 3 ? '#EF4444' : '#178242'; }

                return (
                    <div key={i} style={{ display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '5px' }}>
                        <div style={{ width: '12px', height: '12px', flexShrink: 0, backgroundColor: COLORS_TW[i] }} />
                        <div style={{ fontSize: '11px', fontWeight: 'bold', color: '#6B7280', width: '100px', flexShrink: 0 }}>{label}</div>
                        <div style={{ flex: 1, position: 'relative', height: '14px', backgroundColor: '#F3F4F6', borderRadius: '3px', overflow: 'hidden' }}>
                            <div style={{ position: 'absolute', left: 0, top: 0, height: '100%', width: `${lwPct}%`, backgroundColor: COLORS_LW[i], borderRadius: '3px' }} />
                            <div style={{ position: 'absolute', left: 0, top: '25%', height: '50%', width: `${twPct}%`, backgroundColor: COLORS_TW[i], borderRadius: '2px' }} />
                        </div>
                        <div style={{ fontSize: '11px', color: '#9CA3AF', width: '26px', textAlign: 'right', flexShrink: 0 }}>{lwPct}%</div>
                        <div style={{ fontSize: '11px', color: '#374151', fontWeight: '900', width: '26px', textAlign: 'right', flexShrink: 0 }}>{twPct}%</div>
                        <div style={{ fontSize: '11px', fontWeight: '900', color: trendColor, width: '12px', textAlign: 'center', flexShrink: 0 }}>{trend}</div>
                    </div>
                );
            })}
        </div>
    );
}

export default function ReportModal({ data, currentWeek, prevWeek, onClose }) {
    const reportRef = useRef(null);
    const [downloading, setDownloading] = useState(false);
    const [copying, setCopying] = useState(false);
    const [copied, setCopied] = useState(false);

    if (!data || data.length === 0) return null;

    // Compute summary stats
    // Use currentWeek percentages if >0, fallback to prevWeek
    const getEff = (item, idx) => {
        const c = item.currentWeek?.percentages?.[idx] || 0;
        return c > 0 ? c : (item.prevWeek?.percentages?.[idx] || 0);
    };

    const n = data.length;
    const avgNormal = Math.round(data.reduce((s, d) => s + getEff(d, 3), 0) / n);
    const avgKering = Math.round(data.reduce((s, d) => s + getEff(d, 5), 0) / n);
    const prevAvgNormal = Math.round(data.reduce((s, d) => s + (d.prevWeek?.percentages?.[3] || 0), 0) / n);
    const prevAvgKering = Math.round(data.reduce((s, d) => s + (d.prevWeek?.percentages?.[5] || 0), 0) / n);
    const normalDelta = avgNormal - prevAvgNormal;
    const keringDelta = avgKering - prevAvgKering;

    const dateStr = new Date().toLocaleDateString('id-ID', { day: 'numeric', month: 'short', year: '2-digit' });

    const captureBlob = () => domToBlob(reportRef.current, { scale: 2, backgroundColor: '#F3F4F6' });

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
        <div style={{
            position: 'fixed', inset: 0, backgroundColor: 'rgba(0,0,0,0.65)',
            zIndex: 9999, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '24px'
        }} onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}>
            <div style={{
                backgroundColor: '#fff', borderRadius: '28px', width: '100%', maxWidth: '1000px',
                maxHeight: '90vh', overflow: 'hidden', display: 'flex', flexDirection: 'column',
                boxShadow: '0 25px 60px rgba(0,0,0,0.3)'
            }}>
                {/* Toolbar */}
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '20px 28px', borderBottom: '1px solid #E5E7EB', flexShrink: 0 }}>
                    <span style={{ fontWeight: '900', fontSize: '20px', color: '#111827' }}>📊 Preview Report — {currentWeek}</span>
                    <div style={{ display: 'flex', gap: '10px', alignItems: 'center' }}>
                        <button onClick={handleDownload} disabled={downloading} style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '10px 18px', backgroundColor: '#2563EB', color: '#fff', border: 'none', borderRadius: '12px', fontWeight: '700', fontSize: '14px', cursor: downloading ? 'wait' : 'pointer', opacity: downloading ? 0.7 : 1 }}>
                            <Download size={16} />
                            {downloading ? 'Mengunduh…' : 'Download PNG'}
                        </button>
                        <button onClick={handleCopy} disabled={copying} style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '10px 18px', backgroundColor: '#059669', color: '#fff', border: 'none', borderRadius: '12px', fontWeight: '700', fontSize: '14px', cursor: copying ? 'wait' : 'pointer', opacity: copying ? 0.7 : 1 }}>
                            {copied ? <Check size={16} /> : <Copy size={16} />}
                            {copying ? 'Copying…' : copied ? 'Copied!' : 'Copy Image'}
                        </button>
                        <button onClick={onClose} style={{ padding: '10px', backgroundColor: '#F3F4F6', border: 'none', borderRadius: '12px', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                            <X size={20} color="#374151" />
                        </button>
                    </div>
                </div>

                {/* Scrollable preview */}
                <div style={{ overflow: 'auto', padding: '24px', backgroundColor: '#E5E7EB', flex: 1 }}>
                    {/* Report canvas – captured by domToBlob */}
                    <div ref={reportRef} style={{ backgroundColor: '#F3F4F6', padding: '28px', borderRadius: '16px', minWidth: '860px' }}>

                        {/* ── Report Header ── */}
                        <div style={{
                            backgroundColor: '#FFFFFF', borderRadius: '20px', padding: '24px 28px',
                            marginBottom: '20px', display: 'flex', alignItems: 'center', gap: '28px', flexWrap: 'wrap'
                        }}>
                            {/* Title */}
                            <div style={{ flex: 1, minWidth: '200px' }}>
                                <div style={{ fontSize: '26px', fontWeight: '900', color: '#111827', lineHeight: '1' }}>
                                    Summary CH &amp; PZO
                                </div>
                                <div style={{ fontSize: '13px', color: '#9CA3AF', fontWeight: '600', marginTop: '6px' }}>
                                    Last Update {currentWeek} · {dateStr}
                                </div>
                            </div>

                            {/* NORMAL stat */}
                            <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexShrink: 0 }}>
                                <span style={{ fontSize: '36px', fontWeight: '900', color: '#111827', lineHeight: '1' }}>{avgNormal}%</span>
                                <span style={{ padding: '5px 14px', borderRadius: '20px', backgroundColor: '#5A732A', color: '#FFFFFF', fontSize: '13px', fontWeight: '900', textTransform: 'uppercase' }}>NORMAL</span>
                                {normalDelta !== 0 && (
                                    <span style={{ fontSize: '13px', fontWeight: '700', color: normalDelta > 0 ? '#178242' : '#EF4444', whiteSpace: 'nowrap' }}>
                                        {`${normalDelta > 0 ? '▲ Naik' : '▼ Turun'} ${Math.abs(normalDelta)}% vs minggu lalu`}
                                    </span>
                                )}
                            </div>

                            {/* KERING stat */}
                            <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexShrink: 0 }}>
                                <span style={{ fontSize: '36px', fontWeight: '900', color: '#111827', lineHeight: '1' }}>{avgKering}%</span>
                                <span style={{ padding: '5px 14px', borderRadius: '20px', backgroundColor: '#FF0D0D', color: '#FFFFFF', fontSize: '13px', fontWeight: '900', textTransform: 'uppercase' }}>KERING</span>
                                {keringDelta !== 0 && (
                                    <span style={{ fontSize: '13px', fontWeight: '700', color: keringDelta > 0 ? '#EF4444' : '#178242', whiteSpace: 'nowrap' }}>
                                        {`${keringDelta > 0 ? '▲ Naik' : '▼ Turun'} ${Math.abs(keringDelta)}% vs minggu lalu`}
                                    </span>
                                )}
                            </div>
                        </div>

                        {/* ── 3-column card grid ── */}
                        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '14px' }}>
                            {data.map(item => (
                                <MiniCard
                                    key={item.companyCode}
                                    item={item}
                                    currentWeek={currentWeek}
                                    prevWeek={prevWeek}
                                />
                            ))}
                        </div>

                        {/* Footer */}
                        <div style={{ marginTop: '16px', textAlign: 'center', fontSize: '11px', color: '#9CA3AF', fontWeight: '600' }}>
                            {`Generated ${new Date().toLocaleString('id-ID')} · WM Forecast System`}
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}
