import {
  CALIBRATION_THRESHOLD_CM,
  MAX_MATCH_DELTA_HOURS,
  RAIN_CLUSTER_HOURS,
  RAIN_MIN_MM,
  RAIN_PRE_GRACE_MINUTES,
  RAIN_PRE_WINDOW_HOURS,
  RAIN_RESPONSE_WINDOW_HOURS,
  WATER_RISE_MIN_CM,
  type AnalyzedPointCheck,
  type AnalyzedRainCheck,
  type AnalyzedStationSnapshot,
  type CalibrationStatus,
  type CoverageAnalysisResult,
  type PortalCoverageDataset,
  type PortalIotRecord,
  type PortalManualRecord,
  type PortalRainRecord,
  type PortalStationMeta,
  type RainStatus,
  type SeriesIotPoint,
  type SeriesRainPoint,
  type SparklinePoint,
  type StationAnalysisResult,
} from '../types';
import { formatWibDate, parsePortalDateWib } from './date';
import { generateDiagnosis } from './narrative';

const MAX_MATCH_MS = MAX_MATCH_DELTA_HOURS * 3600 * 1000;
const RAIN_CLUSTER_MS = RAIN_CLUSTER_HOURS * 3600 * 1000;
const RAIN_PRE_WINDOW_MS = RAIN_PRE_WINDOW_HOURS * 3600 * 1000;
const RAIN_PRE_GRACE_MS = RAIN_PRE_GRACE_MINUTES * 60 * 1000;
const RAIN_RESPONSE_WINDOW_MS = RAIN_RESPONSE_WINDOW_HOURS * 3600 * 1000;

export function roundTo(value: number, decimals: number): number {
  const factor = 10 ** decimals;
  return Math.round((value + Number.EPSILON) * factor) / factor;
}

function toFiniteNumber(value: unknown): number | null {
  if (value === null || value === undefined || value === '') return null;
  const num = typeof value === 'number' ? value : Number(String(value).trim());
  return Number.isFinite(num) ? num : null;
}

function normalizeToken(value: unknown): string {
  return typeof value === 'string' ? value.trim().toUpperCase() : '';
}

function collectEstateKeys(station: PortalStationMeta): Set<string> {
  const keys = new Set<string>();
  const estCode = normalizeToken(station.estCode);
  const estDesc = normalizeToken(station.estCodeDesc);
  if (estCode) keys.add(estCode);
  if (estDesc) {
    keys.add(estDesc);
    if (!estCode && estDesc.includes('/')) {
      for (const part of estDesc.split('/')) {
        const clean = part.trim();
        if (clean) keys.add(clean);
      }
    }
  }
  return keys;
}

// Decision #4: strictly filter rain records by estate with zero coverage-wide fallback.
export function filterRainForStation(
  station: PortalStationMeta,
  allRain: PortalRainRecord[]
): {
  records: PortalRainRecord[];
  hasRainStation: boolean;
  rainStationId: string | null;
} {
  const estateKeys = collectEstateKeys(station);
  if (estateKeys.size === 0 || allRain.length === 0) {
    return { records: [], hasRainStation: false, rainStationId: null };
  }

  const matched = allRain.filter((row) => {
    const candidates = [
      normalizeToken(row.EstCode),
      normalizeToken(row.estateBaru),
      normalizeToken(row.EstNewCode),
    ];
    return candidates.some((c) => c !== '' && estateKeys.has(c));
  });

  if (matched.length === 0) {
    return { records: [], hasRainStation: false, rainStationId: null };
  }

  let stationId: string | null = null;
  for (const row of matched) {
    if (typeof row.Station_ID === 'string' && row.Station_ID.trim() !== '') {
      stationId = row.Station_ID.trim();
      break;
    }
  }

  return {
    records: matched,
    hasRainStation: true,
    rainStationId: stationId,
  };
}

export function buildSparkline(
  iotPoints: Array<{ date: Date; value: number }>
): SparklinePoint[] {
  if (iotPoints.length === 0) return [];
  const daily = new Map<string, { sum: number; count: number }>();
  for (const pt of iotPoints) {
    const dayKey = formatWibDate(pt.date);
    const bucket = daily.get(dayKey);
    if (bucket) {
      bucket.sum += pt.value;
      bucket.count += 1;
    } else {
      daily.set(dayKey, { sum: pt.value, count: 1 });
    }
  }

  return Array.from(daily.entries())
    .sort((a, b) => a[0].localeCompare(b[0]))
    .map(([d, { sum, count }]) => ({
      d,
      v: roundTo(sum / count, 1),
    }));
}

export function analyzeStation(
  stationMeta: PortalStationMeta,
  iotRecords: PortalIotRecord[],
  manualRecords: PortalManualRecord[],
  rainRecords: PortalRainRecord[],
  coverageName: string,
  period: { periodFrom: string; periodTo: string },
  options?: { hasRainStation?: boolean; rainStationId?: string | null }
): StationAnalysisResult {
  const piezoId = (stationMeta.PieRecordID || 'N/A').trim() || 'N/A';
  const kebun =
    (stationMeta.estCode || stationMeta.estCodeDesc || '').trim();
  const block = (stationMeta.Block || '').trim();
  const jenis = (stationMeta.Typeunit || '').trim();
  const deviceId =
    stationMeta.deviceId !== null && stationMeta.deviceId !== undefined
      ? String(stationMeta.deviceId).trim()
      : '';
  const deviceName = (stationMeta.deviceName || '').trim();
  const kalibrasi = toFiniteNumber(stationMeta.calibrasi);

  const hasRainStation = options?.hasRainStation ?? rainRecords.length > 0;
  const rainStationId = options?.rainStationId ?? null;

  const parsedManual: Array<{ date: Date; ms: number; value: number }> = [];
  for (const m of manualRecords) {
    const dt =
      parsePortalDateWib(m.tglInput) ??
      parsePortalDateWib(m.Date) ??
      parsePortalDateWib(m.tgl);
    const val = toFiniteNumber(m.Ketinggian);
    if (dt && val !== null) {
      parsedManual.push({ date: dt, ms: dt.getTime(), value: val });
    }
  }
  parsedManual.sort((a, b) => a.ms - b.ms);

  const parsedIot: Array<{ date: Date; ms: number; value: number }> = [];
  for (const r of iotRecords) {
    const dt =
      parsePortalDateWib(r.recordDate) ?? parsePortalDateWib(r.addTime);
    const val = toFiniteNumber(r.valueFinal);
    if (dt && val !== null) {
      parsedIot.push({ date: dt, ms: dt.getTime(), value: val });
    }
  }
  parsedIot.sort((a, b) => a.ms - b.ms);

  const points: AnalyzedPointCheck[] = [];
  for (const mPt of parsedManual) {
    let closestIot: { date: Date; ms: number; value: number } | null = null;
    let minDeltaMs = Infinity;

    for (const iotPt of parsedIot) {
      const deltaMs = Math.abs(iotPt.ms - mPt.ms);
      if (deltaMs < minDeltaMs) {
        minDeltaMs = deltaMs;
        closestIot = iotPt;
      }
    }

    if (closestIot && minDeltaMs <= MAX_MATCH_MS) {
      const deltaHours = roundTo(minDeltaMs / 3600000, 1);
      const diffCm = roundTo(Math.abs(closestIot.value - mPt.value), 2);
      const exceeded = diffCm > CALIBRATION_THRESHOLD_CM;

      points.push({
        coverage: coverageName,
        piezo_id: piezoId,
        manual_at: mPt.date.toISOString(),
        manual_cm: mPt.value,
        iot_at: closestIot.date.toISOString(),
        iot_cm: closestIot.value,
        delta_hours: deltaHours,
        diff_cm: diffCm,
        exceeded,
        is_latest: false,
      });
    }
  }

  if (points.length > 0) {
    points[points.length - 1].is_latest = true;
  }

  let statusKalibrasi: CalibrationStatus = 'TIDAK ADA DATA MANUAL';
  let latestManualAt: string | null = null;
  let latestManualCm: number | null = null;
  let latestIotCm: number | null = null;
  let latestDiffCm: number | null = null;
  let signedDiffCm: number | null = null;
  let avgDiffCm: number | null = null;
  let maxDiffCm: number | null = null;

  if (points.length > 0) {
    const latest = points[points.length - 1];
    latestManualAt = latest.manual_at;
    latestManualCm = latest.manual_cm;
    latestIotCm = latest.iot_cm;
    latestDiffCm = latest.diff_cm;
    signedDiffCm = roundTo(latest.iot_cm - latest.manual_cm, 2);

    const diffs = points.map((p) => p.diff_cm);
    avgDiffCm = roundTo(
      diffs.reduce((acc, cur) => acc + cur, 0) / diffs.length,
      2
    );
    maxDiffCm = roundTo(Math.max(...diffs), 2);
    statusKalibrasi =
      latestDiffCm > CALIBRATION_THRESHOLD_CM
        ? 'PERLU KALIBRASI ULANG'
        : 'LOLOS / AKURAT';
  }

  const allRainParsed: Array<{ date: Date; ms: number; mm: number }> = [];
  const significantRain: Array<{ date: Date; ms: number; mm: number }> = [];
  for (const ch of rainRecords) {
    const dt =
      parsePortalDateWib(ch.Date) ?? parsePortalDateWib(ch.Tanggal);
    const rawVal =
      ch.ketinggian !== null && ch.ketinggian !== undefined
        ? ch.ketinggian
        : ch.value;
    const val = toFiniteNumber(rawVal);
    if (dt && val !== null) {
      const entry = { date: dt, ms: dt.getTime(), mm: val };
      if (val >= 0) {
        allRainParsed.push(entry);
      }
      if (val >= RAIN_MIN_MM) {
        significantRain.push(entry);
      }
    }
  }
  allRainParsed.sort((a, b) => a.ms - b.ms);
  significantRain.sort((a, b) => a.ms - b.ms);

  // Deduplicate exact-timestamp rain readings by taking max mm when multiple gauges hit same timestamp.
  const seriesRainMap = new Map<number, number>();
  for (const r of allRainParsed) {
    const prev = seriesRainMap.get(r.ms);
    if (prev === undefined || r.mm > prev) {
      seriesRainMap.set(r.ms, r.mm);
    }
  }
  const seriesRain: SeriesRainPoint[] = Array.from(seriesRainMap.entries())
    .sort((a, b) => a[0] - b[0])
    .map(([ms, mm]) => ({ ts: new Date(ms).toISOString(), mm }));

  const clusteredRain: Array<{ date: Date; ms: number; mm: number }> = [];
  for (const ev of significantRain) {
    if (clusteredRain.length === 0) {
      clusteredRain.push(ev);
    } else {
      const last = clusteredRain[clusteredRain.length - 1];
      if (ev.ms - last.ms > RAIN_CLUSTER_MS) {
        clusteredRain.push(ev);
      }
    }
  }

  const rainChecks: AnalyzedRainCheck[] = [];
  let respondedCount = 0;

  for (const ev of clusteredRain) {
    const preStart = ev.ms - RAIN_PRE_WINDOW_MS;
    const preEnd = ev.ms + RAIN_PRE_GRACE_MS;
    const postEnd = ev.ms + RAIN_RESPONSE_WINDOW_MS;

    const preIot = parsedIot.filter(
      (p) => p.ms >= preStart && p.ms <= preEnd
    );
    const postIot = parsedIot.filter(
      (p) => p.ms >= ev.ms && p.ms <= postEnd
    );

    if (preIot.length > 0 && postIot.length > 0) {
      const baseCm = preIot[preIot.length - 1].value;
      const minCm = Math.min(...postIot.map((p) => p.value));
      const riseCm = roundTo(baseCm - minCm, 2);
      const responded = riseCm >= WATER_RISE_MIN_CM;
      if (responded) {
        respondedCount += 1;
      }

      rainChecks.push({
        coverage: coverageName,
        piezo_id: piezoId,
        rain_at: ev.date.toISOString(),
        rain_mm: ev.mm,
        base_cm: baseCm,
        min_cm: minCm,
        rise_cm: riseCm,
        responded,
      });
    }
  }

  const totalRainEvents = clusteredRain.length;
  let statusHujan: RainStatus;
  if (totalRainEvents === 0) {
    statusHujan = 'TIDAK ADA HUJAN';
  } else if (respondedCount > 0 || totalRainEvents === 1) {
    statusHujan = 'NORMAL';
  } else {
    statusHujan = 'ANOMALI RESPON HUJAN';
  }

  const narrative = generateDiagnosis({
    piezo_id: piezoId,
    status_kalibrasi: statusKalibrasi,
    status_hujan: statusHujan,
    has_rain_station: hasRainStation,
    latest_manual_cm: latestManualCm,
    latest_iot_cm: latestIotCm,
    latest_diff_cm: latestDiffCm,
    rain_events: totalRainEvents,
    rain_responded: respondedCount,
  });

  const seriesIot: SeriesIotPoint[] = parsedIot.map((p) => ({
    ts: p.date.toISOString(),
    cm: p.value,
  }));

  const snapshot: AnalyzedStationSnapshot = {
    coverage: coverageName,
    piezo_id: piezoId,
    kebun,
    block,
    jenis,
    device_id: deviceId,
    device_name: deviceName,
    kalibrasi,
    status_kalibrasi: statusKalibrasi,
    status_hujan: statusHujan,
    has_rain_station: hasRainStation,
    rain_station_id: rainStationId,
    latest_manual_at: latestManualAt,
    latest_manual_cm: latestManualCm,
    latest_iot_cm: latestIotCm,
    latest_diff_cm: latestDiffCm,
    signed_diff_cm: signedDiffCm,
    total_points: points.length,
    avg_diff_cm: avgDiffCm,
    max_diff_cm: maxDiffCm,
    rain_events: totalRainEvents,
    rain_responded: respondedCount,
    narrative,
    sparkline_json: buildSparkline(parsedIot),
    period_from: period.periodFrom,
    period_to: period.periodTo,
  };

  return {
    snapshot,
    points,
    rainChecks,
    seriesIot,
    seriesRain,
  };
}

export function analyzeCoverageDataset(
  dataset: PortalCoverageDataset,
  coverageName: string,
  period: { periodFrom: string; periodTo: string }
): CoverageAnalysisResult {
  const stationsMeta = dataset.Table ?? [];
  const allIot = dataset.Table2 ?? [];
  const allRain = dataset.Table3 ?? [];
  const allManual = dataset.Table4 ?? [];

  const iotByPiezo = new Map<string, PortalIotRecord[]>();
  for (const row of allIot) {
    const id = row.PieRecordID?.trim();
    if (!id) continue;
    const list = iotByPiezo.get(id);
    if (list) list.push(row);
    else iotByPiezo.set(id, [row]);
  }

  const manualByPiezo = new Map<string, PortalManualRecord[]>();
  for (const row of allManual) {
    const id = row.PieRecordID?.trim();
    if (!id) continue;
    const list = manualByPiezo.get(id);
    if (list) list.push(row);
    else manualByPiezo.set(id, [row]);
  }

  const stations: StationAnalysisResult[] = stationsMeta.map((st) => {
    const id = (st.PieRecordID || '').trim();
    const stIot = iotByPiezo.get(id) ?? [];
    const stManual = manualByPiezo.get(id) ?? [];
    const rainMatch = filterRainForStation(st, allRain);

    return analyzeStation(
      st,
      stIot,
      stManual,
      rainMatch.records,
      coverageName,
      period,
      {
        hasRainStation: rainMatch.hasRainStation,
        rainStationId: rainMatch.rainStationId,
      }
    );
  });

  return {
    coverage: coverageName,
    period_from: period.periodFrom,
    period_to: period.periodTo,
    stations,
  };
}
