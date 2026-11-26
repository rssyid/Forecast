import { describe, expect, it } from 'vitest';
import referenceFixture from './golden/reference-2026-11-20.json';
import edgeFixture from './golden/edge-cases.json';
import { analyzeCoverageDataset } from '@/lib/analysis/analyze';
import { formatWibDateTime, getWibDateRange, parsePortalDateWib } from '@/lib/analysis/date';
import { generateDiagnosis } from '@/lib/analysis/narrative';
import { parsePortalCoveragesPayload, parsePortalDatasetPayload } from '@/lib/portal/schemas';
import { COVERAGES, type PortalCoverageDataset } from '@/lib/types';

describe('Golden reference dataset (2026-10-21 to 2026-11-20)', () => {
  const period = {
    periodFrom: referenceFixture.periodFrom,
    periodTo: referenceFixture.periodTo,
  };

  const datasets = referenceFixture.datasets as Record<string, PortalCoverageDataset>;
  const resultsByCov = COVERAGES.map((cov) =>
    analyzeCoverageDataset(datasets[cov], cov, period)
  );
  const allStations = resultsByCov.flatMap((r) => r.stations);

  it('produces exact 60 stations, 52 passed, and 8 calibration failures (86.7%)', () => {
    expect(allStations).toHaveLength(60);

    const passed = allStations.filter(
      (s) => s.snapshot.status_kalibrasi === 'LOLOS / AKURAT'
    );
    const failed = allStations.filter(
      (s) => s.snapshot.status_kalibrasi === 'PERLU KALIBRASI ULANG'
    );

    expect(passed).toHaveLength(52);
    expect(failed).toHaveLength(8);

    const accuracyPct = (passed.length / (passed.length + failed.length)) * 100;
    expect(Number(accuracyPct.toFixed(1))).toBe(86.7);

    const failedMap = Object.fromEntries(
      failed.map((s) => [s.snapshot.piezo_id, s.snapshot.latest_diff_cm])
    );
    expect(failedMap).toEqual({
      'KSA-133': 6,
      'KSN-19': 4,
      'KBQ-40': 4,
      'KSY-55': 8,
      'MHO-53': 5,
      'PUL-23': 4,
      'SUN-23': 6,
      'KEM-76': 4,
    });
  });

  it('handles empty coverages (Papua and Region 2 Non THIP) cleanly', () => {
    const papua = resultsByCov.find((r) => r.coverage === 'Papua');
    const reg2NonThip = resultsByCov.find(
      (r) => r.coverage === 'Region 2 Non THIP'
    );

    expect(papua?.stations).toHaveLength(0);
    expect(reg2NonThip?.stations).toHaveLength(0);
  });

  it('identifies TAY-24 as calibration accurate with rain response anomaly', () => {
    const tay24 = allStations.find((s) => s.snapshot.piezo_id === 'TAY-24');
    expect(tay24).toBeDefined();
    expect(tay24?.snapshot.status_kalibrasi).toBe('LOLOS / AKURAT');
    expect(tay24?.snapshot.status_hujan).toBe('ANOMALI RESPON HUJAN');
    expect(tay24?.snapshot.narrative).toContain('ANOMALI RESPON HUJAN');
    expect(tay24?.snapshot.narrative).toContain('flushing');
  });

  it('generates shallower bias and negative portal offset for KSA-133', () => {
    const ksa133 = allStations.find((s) => s.snapshot.piezo_id === 'KSA-133');
    expect(ksa133).toBeDefined();
    expect(ksa133?.snapshot.signed_diff_cm).toBe(-6);
    expect(ksa133?.snapshot.narrative).toContain('LEBIH DANGKAL');
    expect(ksa133?.snapshot.narrative).toContain('-0.06 m');
  });
});

describe('Decision #4 & analyzer business rule edge cases', () => {
  const result = analyzeCoverageDataset(
    edgeFixture.dataset as PortalCoverageDataset,
    'Edge Coverage',
    { periodFrom: edgeFixture.periodFrom, periodTo: edgeFixture.periodTo }
  );
  const byId = new Map(result.stations.map((s) => [s.snapshot.piezo_id, s]));

  it('never falls back to coverage rain when estate has no rain station (Decision #4)', () => {
    const st = byId.get('NO-RAIN-01');
    expect(st).toBeDefined();
    expect(st?.snapshot.has_rain_station).toBe(false);
    expect(st?.snapshot.status_hujan).toBe('TIDAK ADA HUJAN');
    expect(st?.snapshot.rain_events).toBe(0);
    expect(st?.snapshot.status_kalibrasi).toBe('PERLU KALIBRASI ULANG');
    expect(st?.snapshot.narrative).toContain('tidak ada stasiun hujan di kebun ini');
    expect(st?.snapshot.narrative).toContain('-0.05 m');
    expect(st?.snapshot.narrative).not.toContain('tidak menunjukkan kenaikan');
  });

  it('ignores manual points farther than 12 hours from IoT', () => {
    const st = byId.get('FAR-MANUAL-02');
    expect(st).toBeDefined();
    expect(st?.points).toHaveLength(0);
    expect(st?.snapshot.status_kalibrasi).toBe('TIDAK ADA DATA MANUAL');
    expect(st?.snapshot.narrative).toContain('belum memiliki data pengukuran manual');
  });

  it('evaluates calibration status strictly from the latest manual point', () => {
    const st = byId.get('PAST-FAIL-LATEST-OK-03');
    expect(st).toBeDefined();
    expect(st?.points).toHaveLength(2);
    expect(st?.points[0].exceeded).toBe(true);
    expect(st?.points[0].is_latest).toBe(false);
    expect(st?.points[1].exceeded).toBe(false);
    expect(st?.points[1].is_latest).toBe(true);
    expect(st?.snapshot.status_kalibrasi).toBe('LOLOS / AKURAT');
    expect(st?.snapshot.max_diff_cm).toBe(6);
    expect(st?.snapshot.avg_diff_cm).toBe(4.25);
  });

  it('treats a single unresponded rain event as NORMAL per rule confirmation', () => {
    const st = byId.get('ONE-RAIN-04');
    expect(st).toBeDefined();
    expect(st?.snapshot.rain_events).toBe(1);
    expect(st?.snapshot.rain_responded).toBe(0);
    expect(st?.snapshot.status_hujan).toBe('NORMAL');
  });

  it('clusters rain events within 3 hours and flags anomaly at >=2 events with 0 response', () => {
    const st = byId.get('CLUSTER-TWO-RAIN-05');
    expect(st).toBeDefined();
    expect(st?.snapshot.rain_events).toBe(2);
    expect(st?.snapshot.rain_responded).toBe(0);
    expect(st?.snapshot.status_hujan).toBe('ANOMALI RESPON HUJAN');
  });

  it('aligns /Date(ms)/ epoch and naive WIB strings identically even in UTC process TZ', () => {
    const st = byId.get('WIB-EPOCH-06');
    expect(st).toBeDefined();
    expect(st?.points).toHaveLength(1);
    expect(st?.points[0].delta_hours).toBe(0);
    expect(formatWibDateTime(st?.points[0].manual_at)).toBe('2026-11-16 13:00');
  });
});

describe('Date parsing, narratives, and portal Zod validation', () => {
  it('parses portal dates consistently as WIB (+07:00)', () => {
    const naive = parsePortalDateWib('2026-11-20 09:00:00');
    const epoch = parsePortalDateWib('/Date(1795140000000)/');
    expect(naive?.toISOString()).toBe('2026-11-20T02:00:00.000Z');
    expect(epoch?.toISOString()).toBe('2026-11-20T02:00:00.000Z');
    expect(formatWibDateTime(naive)).toBe('2026-11-20 09:00');

    const range = getWibDateRange(30, new Date('2026-11-20T20:00:00.000Z'));
    expect(range).toEqual({ dateFrom: '2026-10-22', dateTo: '2026-11-21' });
  });

  it('covers deeper calibration bias and zero em dashes in narratives', () => {
    const msg = generateDiagnosis({
      piezo_id: 'SUN-23',
      status_kalibrasi: 'PERLU KALIBRASI ULANG',
      status_hujan: 'NORMAL',
      has_rain_station: true,
      latest_manual_cm: 24,
      latest_iot_cm: 30,
      latest_diff_cm: 6,
      rain_events: 10,
      rain_responded: 4,
    });
    expect(msg).toContain('LEBIH DALAM');
    expect(msg).toContain('+0.06 m');
    expect(msg).not.toContain('\u2014');
  });

  it('fails loudly with readable error when portal payload shape breaks', () => {
    expect(() =>
      parsePortalDatasetPayload({ Table: [{ broken: true }] })
    ).toThrow(/Skema payload portal tidak sesuai/);

    expect(() => parsePortalCoveragesPayload({ not: 'an array' })).toThrow(
      /Skema daftar coverage portal tidak valid/
    );
  });
});
