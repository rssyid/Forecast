CREATE TABLE IF NOT EXISTS run_meta (
  run_id      TEXT PRIMARY KEY,
  period_from DATE NOT NULL,
  period_to   DATE NOT NULL,
  started_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  finished_at TIMESTAMPTZ,
  status      TEXT NOT NULL DEFAULT 'running',
  error       TEXT
);

CREATE TABLE IF NOT EXISTS coverage_run (
  run_id        TEXT NOT NULL REFERENCES run_meta(run_id) ON DELETE CASCADE,
  coverage      TEXT NOT NULL,
  period_from   DATE NOT NULL,
  period_to     DATE NOT NULL,
  status        TEXT NOT NULL DEFAULT 'running',
  station_count INT NOT NULL DEFAULT 0,
  started_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  finished_at   TIMESTAMPTZ,
  error         TEXT,
  PRIMARY KEY (run_id, coverage)
);

CREATE TABLE IF NOT EXISTS station_snapshot (
  id               BIGSERIAL PRIMARY KEY,
  run_id           TEXT NOT NULL REFERENCES run_meta(run_id) ON DELETE CASCADE,
  coverage         TEXT NOT NULL,
  piezo_id         TEXT NOT NULL,
  kebun            TEXT,
  block            TEXT,
  jenis            TEXT,
  device_id        TEXT,
  device_name      TEXT,
  kalibrasi        NUMERIC,
  status_kalibrasi TEXT NOT NULL,
  status_hujan     TEXT NOT NULL,
  has_rain_station BOOLEAN NOT NULL DEFAULT TRUE,
  rain_station_id  TEXT,
  latest_manual_at TIMESTAMPTZ,
  latest_manual_cm NUMERIC,
  latest_iot_cm    NUMERIC,
  latest_diff_cm   NUMERIC,
  signed_diff_cm   NUMERIC,
  total_points     INT NOT NULL DEFAULT 0,
  avg_diff_cm      NUMERIC,
  max_diff_cm      NUMERIC,
  rain_events      INT NOT NULL DEFAULT 0,
  rain_responded   INT NOT NULL DEFAULT 0,
  narrative        TEXT NOT NULL,
  sparkline_json   JSONB,
  period_from      DATE NOT NULL,
  period_to        DATE NOT NULL,
  created_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (run_id, piezo_id)
);

CREATE TABLE IF NOT EXISTS point_check (
  id          BIGSERIAL PRIMARY KEY,
  run_id      TEXT NOT NULL REFERENCES run_meta(run_id) ON DELETE CASCADE,
  coverage    TEXT NOT NULL,
  piezo_id    TEXT NOT NULL,
  manual_at   TIMESTAMPTZ NOT NULL,
  manual_cm   NUMERIC NOT NULL,
  iot_at      TIMESTAMPTZ NOT NULL,
  iot_cm      NUMERIC NOT NULL,
  delta_hours NUMERIC NOT NULL,
  diff_cm     NUMERIC NOT NULL,
  exceeded    BOOLEAN NOT NULL,
  is_latest   BOOLEAN NOT NULL DEFAULT FALSE
);

CREATE TABLE IF NOT EXISTS rain_check (
  id        BIGSERIAL PRIMARY KEY,
  run_id    TEXT NOT NULL REFERENCES run_meta(run_id) ON DELETE CASCADE,
  coverage  TEXT NOT NULL,
  piezo_id  TEXT NOT NULL,
  rain_at   TIMESTAMPTZ NOT NULL,
  rain_mm   NUMERIC NOT NULL,
  base_cm   NUMERIC NOT NULL,
  min_cm    NUMERIC NOT NULL,
  rise_cm   NUMERIC NOT NULL,
  responded BOOLEAN NOT NULL
);

CREATE TABLE IF NOT EXISTS series_iot (
  run_id   TEXT NOT NULL REFERENCES run_meta(run_id) ON DELETE CASCADE,
  coverage TEXT NOT NULL,
  piezo_id TEXT NOT NULL,
  ts       TIMESTAMPTZ NOT NULL,
  cm       NUMERIC NOT NULL
);

CREATE TABLE IF NOT EXISTS series_rain (
  run_id   TEXT NOT NULL REFERENCES run_meta(run_id) ON DELETE CASCADE,
  coverage TEXT NOT NULL,
  piezo_id TEXT NOT NULL,
  ts       TIMESTAMPTZ NOT NULL,
  mm       NUMERIC NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_coverage_run_latest ON coverage_run (coverage, status, finished_at DESC);
CREATE INDEX IF NOT EXISTS idx_snapshot_run_cov ON station_snapshot (run_id, coverage);
CREATE INDEX IF NOT EXISTS idx_snapshot_piezo_created ON station_snapshot (piezo_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_point_check_lookup ON point_check (run_id, piezo_id, manual_at);
CREATE INDEX IF NOT EXISTS idx_rain_check_lookup ON rain_check (run_id, piezo_id, rain_at);
CREATE INDEX IF NOT EXISTS idx_series_iot_lookup ON series_iot (run_id, piezo_id, ts);
CREATE INDEX IF NOT EXISTS idx_series_rain_lookup ON series_rain (run_id, piezo_id, ts);
