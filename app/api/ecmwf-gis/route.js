import pool from '../../../lib/db.js';

export async function GET(request) {
    try {
        const { searchParams } = new URL(request.url);
        const type = searchParams.get('type'); // 'pt_boundaries' | 'coastline'
        const company = searchParams.get('company');

        if (!type) {
            return Response.json({ error: 'Type query parameter is required (pt_boundaries | coastline)' }, { status: 400 });
        }

        if (type === 'coastline') {
            const query = `
                SELECT geojson_data, uploaded_at 
                FROM ecmwf_gis_layers 
                WHERE layer_type = 'coastline' 
                ORDER BY id DESC LIMIT 1
            `;
            const { rows } = await pool.query(query);
            if (rows.length === 0) {
                return Response.json({ found: false });
            }
            return Response.json({
                found: true,
                type: 'coastline',
                geojson: rows[0].geojson_data,
                uploaded_at: rows[0].uploaded_at
            });
        }

        if (type === 'pt_boundaries') {
            if (company) {
                const query = `
                    SELECT company_code, geojson_data, uploaded_at 
                    FROM ecmwf_gis_layers 
                    WHERE layer_type = 'pt_boundaries' AND UPPER(company_code) = UPPER($1)
                    ORDER BY id DESC LIMIT 1
                `;
                const { rows } = await pool.query(query, [company]);
                if (rows.length === 0) {
                    return Response.json({ found: false, company });
                }
                return Response.json({
                    found: true,
                    company: rows[0].company_code,
                    geojson: rows[0].geojson_data,
                    uploaded_at: rows[0].uploaded_at
                });
            } else {
                // Fetch all PT boundaries
                const query = `
                    SELECT company_code, geojson_data, uploaded_at 
                    FROM ecmwf_gis_layers 
                    WHERE layer_type = 'pt_boundaries'
                    ORDER BY company_code ASC
                `;
                const { rows } = await pool.query(query);
                
                // Combine into single FeatureCollection
                const allFeatures = [];
                const companies = [];
                for (const row of rows) {
                    companies.push(row.company_code);
                    const gj = row.geojson_data;
                    if (gj?.type === 'FeatureCollection' && Array.isArray(gj.features)) {
                        allFeatures.push(...gj.features);
                    } else if (gj?.type === 'Feature') {
                        allFeatures.push(gj);
                    }
                }

                return Response.json({
                    found: rows.length > 0,
                    companies,
                    count: rows.length,
                    geojson: {
                        type: 'FeatureCollection',
                        features: allFeatures
                    }
                });
            }
        }

        return Response.json({ error: 'Invalid type' }, { status: 400 });
    } catch (err) {
        console.error('Error in GET /api/ecmwf-gis:', err);
        return Response.json({ error: err.message }, { status: 500 });
    }
}

export async function POST(request) {
    try {
        const body = await request.json();
        const { layer_type, geojson, company_code } = body;

        if (!layer_type || !geojson) {
            return Response.json({ error: 'layer_type and geojson are required' }, { status: 400 });
        }

        if (layer_type === 'coastline') {
            // Upsert coastline (replace single row)
            await pool.query(`DELETE FROM ecmwf_gis_layers WHERE layer_type = 'coastline'`);
            await pool.query(
                `INSERT INTO ecmwf_gis_layers (layer_type, geojson_data) VALUES ('coastline', $1)`,
                [JSON.stringify(geojson)]
            );
            return Response.json({ success: true, layer_type: 'coastline' });
        }

        if (layer_type === 'pt_boundaries') {
            // Parse GeoJSON features and group by company_code
            const features = geojson.features || (geojson.type === 'Feature' ? [geojson] : []);
            if (!features.length) {
                return Response.json({ error: 'No valid features found in GeoJSON' }, { status: 400 });
            }

            const grouped = {};

            for (const f of features) {
                const code = (
                    f.properties?.company_code || 
                    f.properties?.company || 
                    f.properties?.pt_name || 
                    f.properties?.name || 
                    company_code || 
                    'UNKNOWN'
                ).toString().trim().toUpperCase();

                if (!grouped[code]) {
                    grouped[code] = [];
                }
                grouped[code].push(f);
            }

            const processedCompanies = Object.keys(grouped);

            for (const code of processedCompanies) {
                const companyGeoJSON = {
                    type: 'FeatureCollection',
                    features: grouped[code]
                };

                // Delete existing for this company and insert new
                await pool.query(
                    `DELETE FROM ecmwf_gis_layers WHERE layer_type = 'pt_boundaries' AND UPPER(company_code) = UPPER($1)`,
                    [code]
                );

                await pool.query(
                    `INSERT INTO ecmwf_gis_layers (layer_type, company_code, geojson_data) VALUES ('pt_boundaries', $1, $2)`,
                    [code, JSON.stringify(companyGeoJSON)]
                );
            }

            return Response.json({
                success: true,
                layer_type: 'pt_boundaries',
                companies: processedCompanies,
                feature_count: features.length
            });
        }

        return Response.json({ error: 'Unsupported layer_type' }, { status: 400 });
    } catch (err) {
        console.error('Error in POST /api/ecmwf-gis:', err);
        return Response.json({ error: err.message }, { status: 500 });
    }
}
