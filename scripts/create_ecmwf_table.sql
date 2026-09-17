CREATE TABLE IF NOT EXISTS ecmwf_forecast_data (
    id SERIAL PRIMARY KEY,
    forecast_date DATE NOT NULL UNIQUE,
    model VARCHAR(50) DEFAULT 'aifs-single',
    step INTEGER DEFAULT 162,
    geojson_data JSONB NOT NULL,
    feature_count INTEGER,
    created_at TIMESTAMP DEFAULT NOW(),
    processing_time_sec REAL
);

CREATE INDEX IF NOT EXISTS idx_ecmwf_forecast_date ON ecmwf_forecast_data(forecast_date);
