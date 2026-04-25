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
            await client.query('DELETE FROM pzo_master_mapping');

            for (const item of data) {
                const pieId = item.pie_record_id;
                const mappingStr = item.Mapping || '';
                const companyCode = item.EstNewCode || item.company_code;
                const estCode = item.EstCode;
                const deviceName = item.deviceNameIOT;
                const isActive = item.IsActive !== undefined ? item.IsActive : true;

                if (!pieId) continue;

                const blocks = mappingStr.split(',').map(b => b.trim()).filter(b => b !== '');
                for (const block of blocks) {
                    await client.query(`
                        INSERT INTO pzo_master_mapping (pie_record_id, block_id, company_code, est_code, is_active, device_name_iot)
                        VALUES ($1, $2, $3, $4, $5, $6)
                        ON CONFLICT (pie_record_id, block_id) DO UPDATE SET
                            company_code = EXCLUDED.company_code,
                            est_code = EXCLUDED.est_code,
                            is_active = EXCLUDED.is_active,
                            device_name_iot = EXCLUDED.device_name_iot
                    `, [pieId, block, companyCode, estCode, isActive, deviceName]);
                }
            }

            await client.query('COMMIT');
            return NextResponse.json({ success: true, count: data.length });
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
