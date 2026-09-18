import pool from '../../../lib/db.js';

export async function GET() {
    try {
        const query = `
            SELECT id, selected_companies, regional_buffer_km, local_padding_pct, 
                   logo_data, logo_width_px, colors, updated_at
            FROM ecmwf_bulletin_settings
            WHERE id = 1
        `;
        const { rows } = await pool.query(query);

        if (rows.length === 0) {
            // Return defaults
            return Response.json({
                settings: {
                    selected_companies: ['SIP', 'THIP', 'JJP', 'KALBAR A', 'KALBAR B'],
                    regional_buffer_km: 150,
                    local_padding_pct: 20,
                    logo_data: null,
                    logo_width_px: 130,
                    colors: {
                        water: '#9fc5e8',
                        land: '#dcd8cc',
                        pt_outline: '#0040ff',
                        pt_rect: '#000000'
                    }
                }
            });
        }

        return Response.json({ settings: rows[0] });
    } catch (err) {
        console.error('Error in GET /api/ecmwf-settings:', err);
        return Response.json({ error: err.message }, { status: 500 });
    }
}

export async function POST(request) {
    try {
        const body = await request.json();
        const {
            selected_companies,
            regional_buffer_km,
            local_padding_pct,
            logo_data,
            logo_width_px,
            colors
        } = body;

        const upsertQuery = `
            INSERT INTO ecmwf_bulletin_settings (
                id, selected_companies, regional_buffer_km, local_padding_pct, 
                logo_data, logo_width_px, colors, updated_at
            )
            VALUES (
                1, 
                COALESCE($1, '["SIP", "THIP", "JJP", "KALBAR A", "KALBAR B"]'::jsonb),
                COALESCE($2, 150),
                COALESCE($3, 20),
                $4,
                COALESCE($5, 130),
                COALESCE($6, '{"water": "#9fc5e8", "land": "#dcd8cc", "pt_outline": "#0040ff", "pt_rect": "#000000"}'::jsonb),
                NOW()
            )
            ON CONFLICT (id) DO UPDATE SET
                selected_companies = COALESCE($1, ecmwf_bulletin_settings.selected_companies),
                regional_buffer_km = COALESCE($2, ecmwf_bulletin_settings.regional_buffer_km),
                local_padding_pct = COALESCE($3, ecmwf_bulletin_settings.local_padding_pct),
                logo_data = CASE WHEN $4 IS NOT NULL THEN $4 ELSE ecmwf_bulletin_settings.logo_data END,
                logo_width_px = COALESCE($5, ecmwf_bulletin_settings.logo_width_px),
                colors = COALESCE($6, ecmwf_bulletin_settings.colors),
                updated_at = NOW()
            RETURNING *;
        `;

        const { rows } = await pool.query(upsertQuery, [
            selected_companies ? JSON.stringify(selected_companies) : null,
            regional_buffer_km !== undefined ? Number(regional_buffer_km) : null,
            local_padding_pct !== undefined ? Number(local_padding_pct) : null,
            logo_data !== undefined ? logo_data : null,
            logo_width_px !== undefined ? Number(logo_width_px) : null,
            colors ? JSON.stringify(colors) : null
        ]);

        return Response.json({ success: true, settings: rows[0] });
    } catch (err) {
        console.error('Error in POST /api/ecmwf-settings:', err);
        return Response.json({ error: err.message }, { status: 500 });
    }
}
