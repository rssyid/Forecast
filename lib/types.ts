export const CALIBRATION_THRESHOLD_CM = 3.0;
export const MAX_MATCH_DELTA_HOURS = 12;
export const RAIN_MIN_MM = 1.0;
export const RAIN_CLUSTER_HOURS = 3;
export const RAIN_PRE_WINDOW_HOURS = 1.5;
export const RAIN_PRE_GRACE_MINUTES = 30;
export const RAIN_RESPONSE_WINDOW_HOURS = 6;
export const WATER_RISE_MIN_CM = 1.0;
export const DEFAULT_DAYS_BACK = 30;

export const COVERAGES = [
  'Kalbar A',
  'Kalbar B',
  'Papua',
  'Region 1 Non THIP',
  'Region 1 THIP',
  'Region 2 Non THIP',
  'Region 2 THIP',
] as const;

export type CoverageName = (typeof COVERAGES)[number];

export type CalibrationStatus =
  | 'LOLOS / AKURAT'
  | 'PERLU KALIBRASI ULANG'
  | 'TIDAK ADA DATA MANUAL';

export type RainStatus =
  | 'NORMAL'
  | 'ANOMALI RESPON HUJAN'
  | 'TIDAK ADA HUJAN';

export type CoverageRunStatus = 'running' | 'success' | 'failed';
export type RunStatus = 'running' | 'success' | 'partial' | 'failed';
export type TriggerSource = 'schedule' | 'manual' | 'cli';
export type DiffBucket = 'all' | 'gt3' | '1to3' | 'lte1' | 'na';
export type RainFilterValue = 'all' | RainStatus | 'NO_RAIN_STATION';

export interface PortalStationMeta {
  PieRecordID: string;
  estCode?: string | null;
  estCodeDesc?: string | null;
  Block?: string | null;
  Typeunit?: string | null;
  deviceId?: string | number | null;
  deviceName?: string | null;
  calibrasi?: number | string | null;
}

export interface PortalIotRecord {
  PieRecordID: string;
  recordDate?: string | number | null;
  addTime?: string | number | null;
  valueFinal: number | string | null;
}

export interface PortalRainRecord {
  Station_ID?: string | null;
  Date?: string | number | null;
  Tanggal?: string | number | null;
  ketinggian?: number | string | null;
  value?: number | string | null;
  EstCode?: string | null;
  estateBaru?: string | null;
  EstNewCode?: string | null;
}

export interface PortalManualRecord {
  PieRecordID: string;
  Ketinggian: number | string | null;
  tglInput?: string | number | null;
  Date?: string | number | null;
  tgl?: string | number | null;
}

export interface PortalCoverageDataset {
  Table: PortalStationMeta[];
  Table1?: unknown[];
  Table2: PortalIotRecord[];
  Table3: PortalRainRecord[];
  Table4: PortalManualRecord[];
}

export interface SparklinePoint {
  d: string;
  v: number;
}

export interface AnalyzedPointCheck {
  coverage: string;
  piezo_id: string;
  manual_at: string;
  manual_cm: number;
  iot_at: string;
  iot_cm: number;
  delta_hours: number;
  diff_cm: number;
  exceeded: boolean;
  is_latest: boolean;
}

export interface AnalyzedRainCheck {
  coverage: string;
  piezo_id: string;
  rain_at: string;
  rain_mm: number;
  base_cm: number;
  min_cm: number;
  rise_cm: number;
  responded: boolean;
}

export interface SeriesIotPoint {
  ts: string;
  cm: number;
}

export interface SeriesRainPoint {
  ts: string;
  mm: number;
}

export interface AnalyzedStationSnapshot {
  coverage: string;
  piezo_id: string;
  kebun: string;
  block: string;
  jenis: string;
  device_id: string;
  device_name: string;
  kalibrasi: number | null;
  status_kalibrasi: CalibrationStatus;
  status_hujan: RainStatus;
  has_rain_station: boolean;
  rain_station_id: string | null;
  latest_manual_at: string | null;
  latest_manual_cm: number | null;
  latest_iot_cm: number | null;
  latest_diff_cm: number | null;
  signed_diff_cm: number | null;
  total_points: number;
  avg_diff_cm: number | null;
  max_diff_cm: number | null;
  rain_events: number;
  rain_responded: number;
  narrative: string;
  sparkline_json: SparklinePoint[];
  period_from: string;
  period_to: string;
  manual_in_active_week?: boolean;
}

export interface StationAnalysisResult {
  snapshot: AnalyzedStationSnapshot;
  points: AnalyzedPointCheck[];
  rainChecks: AnalyzedRainCheck[];
  seriesIot: SeriesIotPoint[];
  seriesRain: SeriesRainPoint[];
}

export interface CoverageAnalysisResult {
  coverage: string;
  period_from: string;
  period_to: string;
  stations: StationAnalysisResult[];
}

export interface CoverageStat {
  coverage: string;
  total_stations: number;
  passed_stations: number;
  failed_stations: number;
  no_manual_stations: number;
  accuracy_pct: number;
  rain_anomaly_stations: number;
}

export interface CoverageFreshness {
  coverage: string;
  latest_attempt_run_id: string | null;
  latest_attempt_status: CoverageRunStatus | null;
  latest_attempt_at: string | null;
  latest_attempt_error: string | null;
  serving_run_id: string | null;
  serving_finished_at: string | null;
  serving_period_from: string | null;
  serving_period_to: string | null;
  station_count: number;
  is_stale_fallback: boolean;
}

export interface RunMetaSummary {
  run_id: string;
  period_from: string;
  period_to: string;
  started_at: string;
  finished_at: string | null;
  status: RunStatus;
  week_name: string | null;
  week_label: string | null;
  week_start: string | null;
  week_end: string | null;
  trigger_source: TriggerSource;
}

export interface AccuracyWeekOption {
  week_name: string;
  week_label: string;
  week_start: string;
  week_end: string;
  latest_run_id: string | null;
  last_updated_at: string | null;
  status: RunStatus | null;
  coverage_ok: number;
  coverage_total: number;
}

export interface WeekComparisonDelta {
  previous_week_label: string;
  previous_accuracy_pct: number;
  accuracy_pct_delta: number;
  previous_recalibration_needed: number;
  recalibration_delta: number;
  previous_rain_anomaly_count: number;
  rain_anomaly_delta: number;
  newly_failed_count: number;
  resolved_count: number;
}

export interface AccuracyKpi {
  total_stations: number;
  evaluated_stations: number;
  passed_stations: number;
  recalibration_needed: number;
  no_manual_data: number;
  accuracy_pct: number;
  rain_anomaly_count: number;
  no_rain_station_count: number;
}

export interface SummaryFilterOptions {
  kebuns: string[];
  jenis_list: string[];
  total_unfiltered_in_scope: number;
  status_counts: {
    all: number;
    recalibration: number;
    rain_anomaly: number;
    passed: number;
    no_manual: number;
  };
}

export interface SummaryApiResponse {
  meta: {
    has_data: boolean;
    active_run_id: string | null;
    active_week_label: string | null;
    active_week_name: string | null;
    active_week_start: string | null;
    active_week_end: string | null;
    last_updated_at: string | null;
    period_from: string | null;
    period_to: string | null;
    available_runs: RunMetaSummary[];
    available_weeks: AccuracyWeekOption[];
    coverage_freshness: CoverageFreshness[];
  };
  kpi: AccuracyKpi;
  week_comparison: WeekComparisonDelta | null;
  filter_options: SummaryFilterOptions;
  coverage_stats: CoverageStat[];
  stations: AnalyzedStationSnapshot[];
}

export interface AccuracyStatusCoverageProgress {
  coverage: string;
  status: CoverageRunStatus;
  station_count: number;
  finished_at: string | null;
  error: string | null;
}

export interface AccuracyStatusApiResponse {
  active_run: (RunMetaSummary & { coverages: AccuracyStatusCoverageProgress[] }) | null;
  latest_run: (RunMetaSummary & { coverages: AccuracyStatusCoverageProgress[] }) | null;
  github_workflow: {
    state: 'idle' | 'queued' | 'in_progress' | 'unknown';
    html_url: string | null;
    updated_at: string | null;
  };
  selectable_weeks: Array<{
    week_name: string;
    week_label: string;
    week_start: string;
    week_end: string;
  }>;
  default_week: {
    week_name: string;
    week_label: string;
    week_start: string;
    week_end: string;
  };
}

export interface StationDetailApiResponse {
  snapshot: AnalyzedStationSnapshot & {
    run_id: string;
    created_at: string;
    week_name?: string | null;
    week_label?: string | null;
    week_start?: string | null;
    week_end?: string | null;
  };
  points: AnalyzedPointCheck[];
  rain_events: AnalyzedRainCheck[];
  series_iot: SeriesIotPoint[];
  series_rain: SeriesRainPoint[];
  freshness: CoverageFreshness | null;
}
