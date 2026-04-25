import pool from '../../../lib/db.js';
import { NextResponse } from 'next/server';

export async function POST(request) {
    // Security: Check for ADMIN_KEY
    const adminKey = process.env.ADMIN_KEY || 'admin123';
    const providedKey = request.headers.get('x-admin-key');
    if (providedKey !== adminKey) {
        return NextResponse.json({ error: 'Otentikasi gagal.' }, { status: 401 });
    }

    try {
        const data = await request.json();
        if (!Array.isArray(data)) {
            return NextResponse.json({ error: 'Data must be an array' }, { status: 400 });
        }

        console.log(`Processing ${data.length} master records...`);
        
        // Use a transaction for bulk insert
        const client = await pool.connect();
        try {
            await client.query('BEGIN');
            
            // Clear existing mapping to refresh? Or just upsert?
            // Usually, a full refresh is safer for master data like this.
            // Clear existing mapping to refresh (Full Sync)
            await client.query('DELETE FROM pzo_master_mapping');
            
            // Prepare flattened data for batch insert
            const flattenedRows = [];
            for (const item of data) {
                const pieId = item.pie_record_id;
                const mappingStr = item.Mapping || '';
                const companyCode = item.EstNewCode || item.company_code || null;
                const estCode = item.EstCode || null;
                const deviceName = item.deviceNameIOT || null;
                const isActive = item.IsActive !== undefined ? item.IsActive : true;

                if (!pieId) continue;

                const blocks = mappingStr.split(',').map(b => b.trim()).filter(b => b !== '');
                for (const block of blocks) {
                    flattenedRows.push([pieId, block, companyCode, estCode, isActive, deviceName]);
                }
            }

            if (flattenedRows.length > 0) {
                // Process in chunks of 200 rows to avoid parameter limits and timeouts
                const chunkSize = 200;
                for (let i = 0; i < flattenedRows.length; i += chunkSize) {
                    const chunk = flattenedRows.slice(i, i + chunkSize);
                    const valuesTemplate = chunk.map((_, j) => 
                        `($${j * 6 + 1}, $${j * 6 + 2}, $${j * 6 + 3}, $${j * 6 + 4}, $${j * 6 + 5}, $${j * 6 + 6})`
                    ).join(', ');

                    const query = `
                        INSERT INTO pzo_master_mapping (pie_record_id, block_id, company_code, est_code, is_active, device_name_iot)
                        VALUES ${valuesTemplate}
                        ON CONFLICT (pie_record_id, block_id) DO UPDATE SET
                            company_code = EXCLUDED.company_code,
                            est_code = EXCLUDED.est_code,
                            is_active = EXCLUDED.is_active,
                            device_name_iot = EXCLUDED.device_name_iot
                    `;

                    const flatParams = chunk.flat();
                    await client.query(query, flatParams);
                    console.log(`Uploaded chunk ${Math.floor(i/chunkSize) + 1}...`);
                }
            }

            await client.query('COMMIT');
            return NextResponse.json({ success: true, count: flattenedRows.length });
        } catch (err) {
            await client.query('ROLLBACK');
            throw err;
        } finally {
            client.release();
        }

    } catch (err) {
        console.error('Error in pzo-master sync:', err);
        return NextResponse.json({ error: err.message }, { status: 500 });
    }
}

export async function GET(request) {
    try {
        const { rows } = await pool.query('SELECT * FROM pzo_master_mapping ORDER BY pie_record_id ASC');
        return NextResponse.json({ data: rows });
    } catch (err) {
        return NextResponse.json({ error: err.message }, { status: 500 });
    }
}
