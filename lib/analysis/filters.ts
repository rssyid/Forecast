import type {
  AnalyzedStationSnapshot,
  CalibrationStatus,
  DiffBucket,
  RainFilterValue,
} from '../types';

export interface StationTableFilterValues {
  kebun?: string;
  jenis?: string;
  calibrationStatus?: CalibrationStatus | '';
  rainStatus?: RainFilterValue;
  diffBucket?: DiffBucket;
  anomalyOnly?: boolean;
  search?: string;
}

export function applyStationTableFilters(
  stations: AnalyzedStationSnapshot[],
  filters: StationTableFilterValues
): AnalyzedStationSnapshot[] {
  let list = stations;

  if (filters.kebun && filters.kebun !== 'all') {
    const targetKebun = filters.kebun.trim().toLowerCase();
    list = list.filter((s) => s.kebun.trim().toLowerCase() === targetKebun);
  }

  if (filters.jenis && filters.jenis !== 'all') {
    const targetJenis = filters.jenis.trim().toLowerCase();
    list = list.filter((s) => s.jenis.trim().toLowerCase() === targetJenis);
  }

  if (filters.calibrationStatus) {
    list = list.filter((s) => s.status_kalibrasi === filters.calibrationStatus);
  }

  if (filters.rainStatus && filters.rainStatus !== 'all') {
    if (filters.rainStatus === 'NO_RAIN_STATION') {
      list = list.filter((s) => !s.has_rain_station);
    } else {
      list = list.filter((s) => s.status_hujan === filters.rainStatus);
    }
  }

  if (filters.diffBucket && filters.diffBucket !== 'all') {
    list = list.filter((s) => {
      const diff = s.latest_diff_cm;
      if (filters.diffBucket === 'na') return diff === null;
      if (diff === null) return false;
      if (filters.diffBucket === 'gt3') return diff > 3.0;
      if (filters.diffBucket === '1to3') return diff >= 1.0 && diff <= 3.0;
      if (filters.diffBucket === 'lte1') return diff < 1.0;
      return true;
    });
  }

  if (filters.anomalyOnly) {
    list = list.filter(
      (s) =>
        s.status_kalibrasi === 'PERLU KALIBRASI ULANG' ||
        s.status_hujan === 'ANOMALI RESPON HUJAN'
    );
  }

  if (filters.search?.trim()) {
    const q = filters.search.trim().toLowerCase();
    list = list.filter((s) =>
      [s.piezo_id, s.kebun, s.block, s.device_name, s.device_id, s.coverage, s.jenis]
        .join(' ')
        .toLowerCase()
        .includes(q)
    );
  }

  return list;
}
