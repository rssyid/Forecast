import { describe, expect, it } from 'vitest';
import {
  buildFallbackWeekForDate,
  computePeriodForWeek,
  isDateWithinWeek,
} from '@/lib/analysis/week';
import { applyStationTableFilters } from '@/lib/db-accuracy';
import type { AnalyzedStationSnapshot } from '@/lib/types';

function makeStation(
  overrides: Partial<AnalyzedStationSnapshot>
): AnalyzedStationSnapshot {
  return {
    coverage: 'Kalbar A',
    piezo_id: 'KSA-01',
    kebun: 'KSA',
    block: 'A01',
    jenis: 'KLH - Logger',
    device_id: '100',
    device_name: 'KSA_01',
    kalibrasi: 0,
    status_kalibrasi: 'LOLOS / AKURAT',
    status_hujan: 'NORMAL',
    has_rain_station: true,
    rain_station_id: 'RS-KSA',
    latest_manual_at: '2026-11-25T02:00:00.000Z',
    latest_manual_cm: 45,
    latest_iot_cm: 45.5,
    latest_diff_cm: 0.5,
    signed_diff_cm: 0.5,
    total_points: 3,
    avg_diff_cm: 0.5,
    max_diff_cm: 0.8,
    rain_events: 4,
    rain_responded: 3,
    narrative: 'Normal',
    sparkline_json: [],
    period_from: '2026-10-27',
    period_to: '2026-11-26',
    ...overrides,
  };
}

describe('Week locking helpers', () => {
  it('maps Thursday 2026-11-26 WIB to Nov 2026, W4 (Mon-Sun)', () => {
    const wk = buildFallbackWeekForDate('2026-11-26');
    expect(wk.week_label).toBe('Nov 2026, W4');
    expect(wk.week_name).toBe('W4112026');
    expect(wk.week_start).toBe('2026-11-23');
    expect(wk.week_end).toBe('2026-11-29');
  });

  it('caps dateTo to todayWib for active week and week_end for historical week', () => {
    const w4 = {
      week_name: 'W4112026',
      week_label: 'Nov 2026, W4',
      week_start: '2026-11-23',
      week_end: '2026-11-29',
    };
    expect(computePeriodForWeek(w4, '2026-11-26', 30)).toEqual({
      dateFrom: '2026-10-27',
      dateTo: '2026-11-26',
    });

    const w3 = {
      week_name: 'W3112026',
      week_label: 'Nov 2026, W3',
      week_start: '2026-11-16',
      week_end: '2026-11-22',
    };
    expect(computePeriodForWeek(w3, '2026-11-26', 30)).toEqual({
      dateFrom: '2026-10-23',
      dateTo: '2026-11-22',
    });
  });

  it('checks whether manual timestamp falls inside active WIB week', () => {
    expect(
      isDateWithinWeek('2026-11-23T01:00:00.000Z', '2026-11-23', '2026-11-29')
    ).toBe(true);
    // 2026-11-22 18:00 UTC is 2026-11-23 01:00 WIB (inside week)
    expect(
      isDateWithinWeek('2026-11-22T18:00:00.000Z', '2026-11-23', '2026-11-29')
    ).toBe(true);
    // 2026-11-20 04:46 UTC is 2026-11-20 11:46 WIB (previous week)
    expect(
      isDateWithinWeek('2026-11-20T04:46:00.000Z', '2026-11-23', '2026-11-29')
    ).toBe(false);
    expect(isDateWithinWeek(null, '2026-11-23', '2026-11-29')).toBe(false);
  });
});

describe('applyStationTableFilters', () => {
  const sample: AnalyzedStationSnapshot[] = [
    makeStation({
      piezo_id: 'KSA-133',
      kebun: 'KSA',
      jenis: 'KLH - Logger',
      status_kalibrasi: 'PERLU KALIBRASI ULANG',
      status_hujan: 'NORMAL',
      latest_diff_cm: 6.0,
    }),
    makeStation({
      piezo_id: 'TAY-24',
      coverage: 'Region 2 THIP',
      kebun: 'TAY',
      jenis: 'Kebun - Manual',
      status_kalibrasi: 'LOLOS / AKURAT',
      status_hujan: 'ANOMALI RESPON HUJAN',
      latest_diff_cm: 2.0,
    }),
    makeStation({
      piezo_id: 'KPE-09',
      kebun: 'KPE',
      jenis: 'KLH - Logger',
      status_kalibrasi: 'TIDAK ADA DATA MANUAL',
      status_hujan: 'TIDAK ADA HUJAN',
      has_rain_station: false,
      latest_manual_at: null,
      latest_manual_cm: null,
      latest_diff_cm: null,
      signed_diff_cm: null,
    }),
    makeStation({
      piezo_id: 'KTR-02',
      coverage: 'Kalbar B',
      kebun: 'KTR',
      jenis: 'KLH - Logger',
      status_kalibrasi: 'LOLOS / AKURAT',
      status_hujan: 'NORMAL',
      latest_diff_cm: 0.4,
    }),
  ];

  it('filters by kebun, jenis, calibrationStatus, rainStatus, and diffBucket', () => {
    expect(applyStationTableFilters(sample, { kebun: 'TAY' }).map((s) => s.piezo_id)).toEqual([
      'TAY-24',
    ]);
    expect(
      applyStationTableFilters(sample, { jenis: 'Kebun - Manual' }).map((s) => s.piezo_id)
    ).toEqual(['TAY-24']);
    expect(
      applyStationTableFilters(sample, {
        calibrationStatus: 'PERLU KALIBRASI ULANG',
      }).map((s) => s.piezo_id)
    ).toEqual(['KSA-133']);
    expect(
      applyStationTableFilters(sample, { rainStatus: 'NO_RAIN_STATION' }).map(
        (s) => s.piezo_id
      )
    ).toEqual(['KPE-09']);
    expect(
      applyStationTableFilters(sample, { diffBucket: 'gt3' }).map((s) => s.piezo_id)
    ).toEqual(['KSA-133']);
    expect(
      applyStationTableFilters(sample, { diffBucket: '1to3' }).map((s) => s.piezo_id)
    ).toEqual(['TAY-24']);
    expect(
      applyStationTableFilters(sample, { diffBucket: 'lte1' }).map((s) => s.piezo_id)
    ).toEqual(['KTR-02']);
    expect(
      applyStationTableFilters(sample, { diffBucket: 'na' }).map((s) => s.piezo_id)
    ).toEqual(['KPE-09']);
  });

  it('combines search and anomalyOnly filters accurately', () => {
    expect(
      applyStationTableFilters(sample, { anomalyOnly: true }).map((s) => s.piezo_id)
    ).toEqual(['KSA-133', 'TAY-24']);
    expect(
      applyStationTableFilters(sample, { anomalyOnly: true, search: 'tay' }).map(
        (s) => s.piezo_id
      )
    ).toEqual(['TAY-24']);
  });
});
