"use client";

import { useEffect, useMemo, useRef, useState } from 'react';
import * as echarts from 'echarts/core';
import { BarChart, LineChart } from 'echarts/charts';
import {
  AxisPointerComponent,
  DataZoomComponent,
  GridComponent,
  LegendComponent,
  MarkAreaComponent,
  TooltipComponent,
} from 'echarts/components';
import { SVGRenderer } from 'echarts/renderers';
import { formatWibDateTime } from '@/lib/analysis/date';
import type {
  AnalyzedPointCheck,
  SeriesIotPoint,
  SeriesRainPoint,
} from '@/lib/types';

echarts.use([
  LineChart,
  BarChart,
  GridComponent,
  TooltipComponent,
  LegendComponent,
  MarkAreaComponent,
  DataZoomComponent,
  AxisPointerComponent,
  SVGRenderer,
]);

type ZoomRange = '7H' | '14H' | '30H';

export default function StationChart({
  piezoId,
  seriesIot,
  seriesRain,
  points,
  hasRainStation,
}: {
  piezoId: string;
  seriesIot: SeriesIotPoint[];
  seriesRain: SeriesRainPoint[];
  points: AnalyzedPointCheck[];
  hasRainStation: boolean;
}) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const chartRef = useRef<echarts.ECharts | null>(null);
  const [zoomRange, setZoomRange] = useState<ZoomRange>('30H');

  const bounds = useMemo(() => {
    const timestamps: number[] = [];
    for (const p of seriesIot) timestamps.push(new Date(p.ts).getTime());
    for (const p of seriesRain) timestamps.push(new Date(p.ts).getTime());
    for (const p of points) timestamps.push(new Date(p.manual_at).getTime());
    const validTs = timestamps.filter((t) => Number.isFinite(t));
    if (validTs.length === 0) return null;
    return {
      minTs: Math.min(...validTs),
      maxTs: Math.max(...validTs),
    };
  }, [seriesIot, seriesRain, points]);

  useEffect(() => {
    if (!containerRef.current) return;
    if (seriesIot.length === 0 && points.length === 0 && seriesRain.length === 0) {
      return;
    }

    const chart = echarts.init(containerRef.current, undefined, {
      renderer: 'svg',
    });
    chartRef.current = chart;

    const iotData = seriesIot.map((pt) => [new Date(pt.ts).getTime(), pt.cm]);
    const manualData = points.map((pt) => ({
      value: [new Date(pt.manual_at).getTime(), pt.manual_cm],
      diffCm: pt.diff_cm,
      iotCm: pt.iot_cm,
      exceeded: pt.exceeded,
      isLatest: pt.is_latest,
      itemStyle: {
        color: pt.exceeded ? '#DC2626' : '#111827',
        borderColor: '#FFFFFF',
        borderWidth: pt.is_latest ? 2 : 1,
      },
      symbolSize: pt.is_latest ? 11 : 8,
    }));
    const rainData = seriesRain.map((pt) => [new Date(pt.ts).getTime(), pt.mm]);

    const yValues: number[] = [];
    for (const pt of seriesIot) yValues.push(pt.cm);
    for (const pt of points) {
      yValues.push(pt.manual_cm - 3.5);
      yValues.push(pt.manual_cm + 3.5);
    }
    const yMin = yValues.length > 0 ? Math.floor(Math.min(...yValues) - 3) : 0;
    const yMax = yValues.length > 0 ? Math.ceil(Math.max(...yValues) + 3) : 60;

    // +-3 cm tolerance bands drawn around each weekly manual check.
    const bandHalfWidthMs = 8 * 3600 * 1000;
    const markAreaData = points.map((pt) => {
      const t = new Date(pt.manual_at).getTime();
      const fill = pt.exceeded
        ? 'rgba(220, 38, 38, 0.16)'
        : 'rgba(16, 185, 129, 0.16)';
      const border = pt.exceeded
        ? 'rgba(220, 38, 38, 0.55)'
        : 'rgba(5, 150, 105, 0.5)';
      return [
        {
          xAxis: t - bandHalfWidthMs,
          yAxis: pt.manual_cm - 3,
          itemStyle: {
            color: fill,
            borderColor: border,
            borderWidth: 1,
          },
        },
        {
          xAxis: t + bandHalfWidthMs,
          yAxis: pt.manual_cm + 3,
        },
      ];
    });

    const maxRain =
      seriesRain.length > 0
        ? Math.max(...seriesRain.map((r) => r.mm), 10)
        : 20;

    chart.setOption({
      animation: false,
      color: ['#2563EB', '#111827', '#0EA5E9'],
      axisPointer: {
        link: [{ xAxisIndex: 'all' }],
      },
      tooltip: {
        trigger: 'axis',
        backgroundColor: 'rgba(17, 24, 39, 0.95)',
        borderColor: '#374151',
        textStyle: { color: '#F9FAFB', fontSize: 12 },
        formatter: (params: unknown) => {
          const items = Array.isArray(params) ? params : [];
          if (items.length === 0) return '';
          const first = items[0] as { axisValue?: number };
          const header = first.axisValue
            ? `${formatWibDateTime(new Date(first.axisValue))} WIB`
            : '';
          const lines = [
            `<div style="font-weight:700;margin-bottom:4px;">${header}</div>`,
          ];
          for (const raw of items) {
            const item = raw as {
              seriesName?: string;
              value?: [number, number];
              data?: { diffCm?: number; iotCm?: number; exceeded?: boolean };
              marker?: string;
            };
            const val = Array.isArray(item.value) ? item.value[1] : null;
            if (val === null || val === undefined) continue;
            if (item.seriesName === 'Manual Mingguan') {
              const diffTxt =
                item.data?.diffCm !== undefined
                  ? ` (Selisih ${item.data.diffCm.toFixed(1)} cm${item.data.exceeded ? ' > 3 cm' : ''})`
                  : '';
              lines.push(
                `<div>${item.marker || ''}Manual: <b>${val.toFixed(1)} cm</b>${diffTxt}</div>`
              );
            } else if (item.seriesName === 'Curah Hujan') {
              lines.push(
                `<div>${item.marker || ''}Hujan: <b>${val.toFixed(1)} mm</b></div>`
              );
            } else {
              lines.push(
                `<div>${item.marker || ''}IoT TMAT: <b>${val.toFixed(1)} cm</b></div>`
              );
            }
          }
          return lines.join('');
        },
      },
      legend: {
        top: 0,
        left: 0,
        itemWidth: 14,
        itemHeight: 8,
        textStyle: { color: '#374151', fontSize: 11 },
        data: ['IoT TMAT (cm)', 'Manual Mingguan', 'Curah Hujan'],
      },
      grid: [
        { left: 56, right: 20, top: 36, height: '54%' },
        { left: 56, right: 20, top: '70%', height: '18%' },
      ],
      xAxis: [
        {
          type: 'time',
          gridIndex: 0,
          axisLabel: { show: false },
          axisLine: { lineStyle: { color: '#D1D5DB' } },
          splitLine: { show: true, lineStyle: { color: '#F3F4F6' } },
        },
        {
          type: 'time',
          gridIndex: 1,
          axisLine: { lineStyle: { color: '#9CA3AF' } },
          axisLabel: {
            color: '#4B5563',
            fontSize: 10,
            formatter: (val: number) => {
              const str = formatWibDateTime(new Date(val));
              return str.slice(5, 10);
            },
          },
          splitLine: { show: false },
        },
      ],
      yAxis: [
        {
          type: 'value',
          gridIndex: 0,
          inverse: true,
          min: yMin,
          max: yMax,
          name: 'TMAT (cm)',
          nameTextStyle: { color: '#374151', fontSize: 11 },
          axisLabel: { color: '#374151', fontSize: 11 },
          splitLine: { lineStyle: { color: '#E5E7EB' } },
        },
        {
          type: 'value',
          gridIndex: 1,
          min: 0,
          max: Math.ceil(maxRain * 1.15),
          name: 'Hujan (mm)',
          nameTextStyle: { color: '#374151', fontSize: 11 },
          axisLabel: { color: '#374151', fontSize: 10 },
          splitNumber: 2,
          splitLine: { lineStyle: { color: '#F3F4F6' } },
        },
      ],
      dataZoom: [
        {
          type: 'inside',
          xAxisIndex: [0, 1],
        },
        {
          type: 'slider',
          xAxisIndex: [0, 1],
          bottom: 4,
          height: 18,
          borderColor: '#D1D5DB',
          fillerColor: 'rgba(37, 99, 235, 0.12)',
        },
      ],
      series: [
        {
          name: 'IoT TMAT (cm)',
          type: 'line',
          xAxisIndex: 0,
          yAxisIndex: 0,
          showSymbol: false,
          smooth: false,
          lineStyle: { width: 2, color: '#2563EB' },
          data: iotData,
        },
        {
          name: 'Manual Mingguan',
          type: 'line',
          xAxisIndex: 0,
          yAxisIndex: 0,
          symbol: 'circle',
          lineStyle: { width: 2, color: '#111827' },
          data: manualData,
          markArea:
            markAreaData.length > 0
              ? { silent: true, data: markAreaData }
              : undefined,
        },
        {
          name: 'Curah Hujan',
          type: 'bar',
          xAxisIndex: 1,
          yAxisIndex: 1,
          barMaxWidth: 10,
          itemStyle: { color: '#0EA5E9', borderRadius: [2, 2, 0, 0] },
          data: rainData,
        },
      ],
    });

    const observer = new ResizeObserver(() => {
      chart.resize();
    });
    observer.observe(containerRef.current);

    const handleBeforePrint = () => {
      chart.resize();
    };
    window.addEventListener('beforeprint', handleBeforePrint);

    return () => {
      window.removeEventListener('beforeprint', handleBeforePrint);
      observer.disconnect();
      chart.dispose();
      chartRef.current = null;
    };
  }, [seriesIot, seriesRain, points]);

  const applyZoom = (range: ZoomRange) => {
    setZoomRange(range);
    const chart = chartRef.current;
    if (!chart || !bounds) return;
    if (range === '30H') {
      chart.dispatchAction({
        type: 'dataZoom',
        startValue: bounds.minTs,
        endValue: bounds.maxTs,
      });
      return;
    }
    const days = range === '7H' ? 7 : 14;
    const startValue = Math.max(
      bounds.minTs,
      bounds.maxTs - days * 24 * 3600 * 1000
    );
    chart.dispatchAction({
      type: 'dataZoom',
      startValue,
      endValue: bounds.maxTs,
    });
  };

  if (seriesIot.length === 0 && points.length === 0 && seriesRain.length === 0) {
    return (
      <div className="bg-white rounded-2xl border border-gray-200 p-8 text-center text-sm text-gray-600">
        Belum ada deret waktu IoT atau pengukuran manual untuk stasiun {piezoId}.
      </div>
    );
  }

  return (
    <section
      aria-label={`Grafik perbandingan IoT TMAT dan curah hujan ${piezoId}`}
      className="bg-white rounded-2xl border border-gray-200 p-4 sm:p-5 shadow-xs space-y-3 print-avoid-break"
    >
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-base font-bold text-gray-900">
            Grafik Kedalaman TMAT (Sumbu Terbalik) vs Curah Hujan
          </h2>
          <p className="text-xs text-gray-600 mt-0.5">
            Pita hijau/merah di titik hitam menandai batas toleransi kalibrasi +-3 cm (air naik = nilai mengecil).
          </p>
        </div>

        <div
          role="group"
          aria-label="Rentang waktu grafik"
          className="inline-flex items-center gap-1.5 print:hidden"
        >
          {(['7H', '14H', '30H'] as const).map((r) => (
            <button
              key={r}
              type="button"
              onClick={() => applyZoom(r)}
              aria-pressed={zoomRange === r}
              className={`min-h-10 min-w-11 px-3 rounded-lg text-xs font-semibold border transition-colors ${
                zoomRange === r
                  ? 'bg-black text-white border-black'
                  : 'bg-white text-gray-800 border-gray-400 hover:bg-gray-100'
              }`}
            >
              {r}
            </button>
          ))}
        </div>
      </div>

      {!hasRainStation && (
        <div className="px-3 py-2 rounded-xl bg-amber-50 border border-amber-300 text-xs font-medium text-amber-800">
          Panel curah hujan kosong karena tidak ada stasiun hujan terdaftar di kebun ini.
        </div>
      )}

      <div
        ref={containerRef}
        className="w-full h-[360px] sm:h-[420px] print:h-[310px]"
      />
    </section>
  );
}
