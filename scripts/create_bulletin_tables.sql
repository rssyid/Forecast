-- Table for storing GIS layers (PT Boundaries & Coastlines)
CREATE TABLE IF NOT EXISTS ecmwf_gis_layers (
    id SERIAL PRIMARY KEY,
    layer_type VARCHAR(50) NOT NULL, -- 'pt_boundaries' or 'coastline'
    company_code VARCHAR(50),        -- e.g. 'SIP', 'THIP', 'JJP', etc. (NULL for coastline)
    geojson_data JSONB NOT NULL,
    uploaded_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_ecmwf_gis_company ON ecmwf_gis_layers(layer_type, company_code);

-- Table for storing Bulletin configuration & settings
CREATE TABLE IF NOT EXISTS ecmwf_bulletin_settings (
    id INTEGER PRIMARY KEY DEFAULT 1,
    selected_companies JSONB DEFAULT '["SIP", "THIP", "JJP", "KALBAR A", "KALBAR B"]'::jsonb,
    regional_buffer_km NUMERIC DEFAULT 150,
    local_padding_pct NUMERIC DEFAULT 20,
    logo_data TEXT, -- Base64 data URL or external URL
    logo_width_px INTEGER DEFAULT 130,
    colors JSONB DEFAULT '{"water": "#9fc5e8", "land": "#dcd8cc", "pt_outline": "#0040ff", "pt_rect": "#e60000"}'::jsonb,
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Seed default settings row if not exists
INSERT INTO ecmwf_bulletin_settings (id) VALUES (1) ON CONFLICT (id) DO NOTHING;
