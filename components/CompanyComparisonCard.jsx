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
            let trendClass = 'text-gray-300';

            if (twPct > lwPct) {
                trendIcon = '▲';
                trendClass = (i === 3) ? 'text-[#178242]' : 'text-[#ff0000]';
            } else if (twPct < lwPct) {
                trendIcon = '▼';
                trendClass = (i === 3) ? 'text-[#ff0000]' : 'text-[#178242]';
            }

            return (
                <div key={i} className="grid grid-cols-[320px_1fr_180px] gap-8 items-center min-h-[48px]">
                    {/* Legend Section */}
                    <div className="flex items-center gap-3 w-[320px]">
                        <span className="w-6 h-6 shrink-0" style={{ backgroundColor: COLORS_TW[i] }}></span>
                        <span className="text-[18px] md:text-[20px] font-bold whitespace-nowrap text-[#374151]">{label}</span>
                    </div>

                    {/* Bars Section */}
                    <div className="relative w-full h-[32px]">
                        {/* LW Track (Top half) */}
                        <div className="absolute top-0 left-0 w-full h-[12px] bg-[#E0E0E0]">
                            <div 
                                className="h-full transition-all duration-700" 
                                style={{ width: `${lwPct}%`, backgroundColor: COLORS_LW[i] }}
                            />
                        </div>
                        {/* TW Track (Bottom half) */}
                        <div className="absolute bottom-0 left-0 w-full h-[12px] bg-[#E0E0E0]">
                            <div 
                                className="h-full transition-all duration-700" 
                                style={{ width: `${twPct}%`, backgroundColor: COLORS_TW[i] }}
                            />
                        </div>
                    </div>

                    {/* Values & Trend Section */}
                    <div className="flex items-center justify-end gap-3 w-[180px] text-[18px] md:text-[20px]">
                        <span className="text-[#9CA3AF] w-[45px] text-right">{Math.round(lwPct)}%</span>
                        <span className="text-[#D1D5DB]">➜</span>
                        <span className="font-bold text-[#111827] w-[45px] text-right">{Math.round(twPct)}%</span>
                        <span className={`font-black w-[25px] text-center ${trendClass}`}>{trendIcon}</span>
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
                    '--background': '0 0% 100%',
                    '--foreground': '240 10% 3.9%',
                    '--color-black': '#000000',
                    '--color-white': '#FFFFFF',
                }}
                className="w-full rounded-[42px] p-8 md:p-12 border border-[#EEEEEE] shadow-sm overflow-hidden"
            >
                {/* Header */}
                <div className="flex flex-col md:flex-row justify-between items-start gap-8 mb-10">
                    <div className="flex-1 space-y-3 min-w-0">
                        <h1 className="text-[48px] md:text-[64px] font-black leading-none tracking-[-0.06em] text-black uppercase truncate">
                            {companyName.replace('PT.', '')}
                        </h1>
                        <p className="text-[16px] md:text-[20px] text-[#b4b4b4] font-bold bg-[#FAFAFA] px-0 py-2 rounded-xl inline-block">
                            CH {prevWeek?.slice(-2)}: {rainfall.prev}mm/{rainfall.prevHH}HH | {currentWeek?.slice(-2)}: {rainfall.current}mm/{rainfall.currentHH}HH
                        </p>
                    </div>
                    <div 
                        className="shrink-0 min-w-[180px] text-center px-8 py-4 rounded-full text-white text-[24px] md:text-[28px] font-black uppercase shadow-sm"
                        style={{ backgroundColor: getDominantColor() }}
                    >
                        {dominantStatus}
                    </div>
                </div>

                {/* Body Grid */}
                <div className="mt-6 space-y-2">
                    {renderBars()}
                </div>
            </div>
        </div>
    );
}
