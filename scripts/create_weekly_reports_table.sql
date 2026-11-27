CREATE TABLE IF NOT EXISTS weekly_pzo_reports (
    id SERIAL PRIMARY KEY,
    week_id INTEGER NOT NULL UNIQUE,
    formatted_name VARCHAR(64) NOT NULL,
    regime VARCHAR(20) NOT NULL,
    method VARCHAR(20) NOT NULL DEFAULT 'weighted',
    excluded_companies JSONB NOT NULL DEFAULT '[]'::jsonb,
    field_action_note TEXT NOT NULL DEFAULT '',
    custom_narrative TEXT,
    auto_narrative TEXT NOT NULL DEFAULT '',
    metrics_snapshot JSONB,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_weekly_pzo_reports_week_id
    ON weekly_pzo_reports (week_id);
