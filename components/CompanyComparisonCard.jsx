"use client";

import React, { useRef, useState } from 'react';
import { ClipboardCopy, Check, CloudRain, Info } from 'lucide-react';
import html2canvas from 'html2canvas';

const LABELS = ['Banjir ( <0 )', 'Tergenang ( 0-40 )', 'A Tergenang ( 41-45 )', 'Normal ( 46-60 )', 'A Kering ( 61-65 )', 'Kering ( >65 )'];
const COLORS_LW = ['#999999', '#B3C5DF', '#99ECFF', '#BDC7A9', '#FFFD99', '#FF9999'];
const COLORS_TW = ['#000000', '#4170B0', '#1CB8E0', '#5A732A', '#FFFB00', '#FF0D0D'];

export default function CompanyComparisonCard({ item, currentWeek, prevWeek }) {
    const cardRef = useRef(null);
    const [copying, setCopying] = useState(false);
    const [copied, setCopied] = useState(false);

    const { companyName, currentWeek: current, prevWeek: prev, rainfall, dominantStatus } = item;

    // Helper to get color for dominant status
    const getDominantColor = () => {
        const idx = ['Banjir', 'Tergenang', 'A Tergenang', 'Normal', 'A Kering', 'Kering'].indexOf(dominantStatus);
        return idx !== -1 ? COLORS_TW[idx] : '#EEEEEE';
    };

    const copyAsImage = async () => {
        if (!cardRef.current) return;
        setCopying(true);
        try {
            const canvas = await html2canvas(cardRef.current, { 
                scale: 2, 
                backgroundColor: '#FAFAFA',
                useCORS: true,
                logging: false
            });
            canvas.toBlob(async (blob) => {
                const clipboardItem = new ClipboardItem({ 'image/png': blob });
                await navigator.clipboard.write([clipboardItem]);
                setCopied(true);
                setTimeout(() => setCopied(false), 2000);
            });
        } catch (err) {
            console.error('Failed to copy image:', err);
        } finally {
            setCopying(false);
        }
    };

    const renderBars = () => {
        return LABELS.map((label, i) => {
            const lwPct = prev?.percentages?.[i] || 0;
            const twPct = current?.percentages?.[i] || 0;

            let trendIcon = '▬';
            let trendColor = '#D1D5DB';

            if (twPct > lwPct) {
                trendIcon = '▲';
                trendColor = (i === 3) ? '#178242' : '#ff0000';
            } else if (twPct < lwPct) {
                trendIcon = '▼';
                trendColor = (i === 3) ? '#ff0000' : '#178242';
            }

            return (
                <div key={i} style={{ display: 'flex', alignItems: 'center', width: '100%', minHeight: '40px', marginBottom: '4px' }}>
                    {/* Legend Section */}
                    <div style={{ width: '260px', flexShrink: 0, display: 'flex', alignItems: 'center', gap: '12px' }}>
                        <div style={{ width: '24px', height: '24px', flexShrink: 0, backgroundColor: COLORS_TW[i] }}></div>
                        <div style={{ fontSize: '18px', fontWeight: 'bold', color: '#374151', lineHeight: '1.2' }}>{label}</div>
                    </div>

                    {/* Bars Section */}
                    <div style={{ flexGrow: 1, position: 'relative', height: '32px', minWidth: '0' }}>
                        {/* LW Track (Top half) */}
                        <div style={{ position: 'absolute', top: '0', left: '0', width: '100%', height: '12px', backgroundColor: '#E0E0E0' }}>
                            <div style={{ height: '100%', transition: 'width 0.7s', width: `${lwPct}%`, backgroundColor: COLORS_LW[i] }} />
                        </div>
                        {/* TW Track (Bottom half) */}
                        <div style={{ position: 'absolute', bottom: '0', left: '0', width: '100%', height: '12px', backgroundColor: '#E0E0E0' }}>
                            <div style={{ height: '100%', transition: 'width 0.7s', width: `${twPct}%`, backgroundColor: COLORS_TW[i] }} />
                        </div>
                    </div>

                    {/* Values & Trend Section */}
                    <div style={{ width: '180px', flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: '12px' }}>
                        <div style={{ width: '45px', textAlign: 'right', fontSize: '18px', color: '#9CA3AF', lineHeight: '1' }}>{Math.round(lwPct)}%</div>
                        <div style={{ color: '#D1D5DB', fontSize: '14px', lineHeight: '1' }}>➜</div>
                        <div style={{ width: '45px', textAlign: 'right', fontSize: '18px', fontWeight: 'bold', color: '#111827', lineHeight: '1' }}>{Math.round(twPct)}%</div>
                        <div style={{ width: '25px', textAlign: 'center', fontSize: '18px', fontWeight: '900', color: trendColor, lineHeight: '1' }}>{trendIcon}</div>
                    </div>
                </div>
            );
        });
    };

    return (
        <div className="relative flex flex-col items-end gap-2 group">
            <button 
                onClick={copyAsImage}
                disabled={copying}
                className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold transition-all shadow-sm
                    ${copied ? 'bg-[#178242] text-white' : 'bg-[#2b2b2b] text-white hover:bg-black'}
                    ${copying ? 'opacity-50 cursor-not-allowed' : ''}
                `}
            >
                {copying ? '⏳ Copying...' : copied ? <><Check size={14} /> Copied!</> : <><ClipboardCopy size={14} /> Copy Image</>}
            </button>

            <div 
                ref={cardRef}
                style={{
                    backgroundColor: '#FAFAFA',
                    boxShadow: '0 1px 3px 0 rgba(0, 0, 0, 0.1), 0 1px 2px 0 rgba(0, 0, 0, 0.06)',
                    width: '100%',
                    borderRadius: '42px',
                    padding: '48px',
                    border: '1px solid #EEEEEE',
                    overflow: 'hidden'
                }}
            >
                {/* Header */}
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '24px', gap: '32px' }}>
                    <div style={{ flex: 1, minWidth: 0 }}>
                        <h1 style={{ fontSize: '48px', fontWeight: '900', color: '#000000', textTransform: 'uppercase', margin: 0, lineHeight: '1.1' }}>
                            {companyName.replace('PT.', '')}
                        </h1>
                        <div style={{ marginTop: '8px' }}>
                            <span style={{ fontSize: '18px', color: '#b4b4b4', fontWeight: 'bold' }}>
                                CH {prevWeek?.slice(-2)}: {rainfall.prev}mm/{rainfall.prevHH}HH | {currentWeek?.slice(-2)}: {rainfall.current}mm/{rainfall.currentHH}HH
                            </span>
                        </div>
                    </div>
                    <div 
                        style={{ 
                            flexShrink: 0,
                            minWidth: '140px',
                            height: '40px',
                            borderRadius: '20px',
                            backgroundColor: getDominantColor(),
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center'
                        }}
                    >
                        <span style={{ color: '#FFFFFF', fontSize: '18px', fontWeight: '900', textTransform: 'uppercase', lineHeight: '1' }}>
                            {dominantStatus}
                        </span>
                    </div>
                </div>

                {/* Body Grid */}
                <div className="mt-4 space-y-0.5">
                    {renderBars()}
                </div>
            </div>
        </div>
    );
}
