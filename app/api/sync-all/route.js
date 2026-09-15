// app/api/sync-all/route.js
// SSE endpoint – streams real-time progress while syncing:
//   Step 1 – Curah Hujan  (daily_rainfall  via GIS IoT API)
//   Step 2 – GIS TMAT     (gis_comparison_data via GIS-DIV MapService)

import pg from 'pg';
const { Pool } = pg;
import { callGisApi, parseWeekBlock, upsertGisRecord } from '../../../lib/gisService.js';

const RAINFALL_API_URL = 'https://app.gis-div.com/iot/Service/webservice.asmx/GetArsStation4Weeks';

export const dynamic = 'force-dynamic';

export async function GET(request) {
    const { searchParams } = new URL(request.url);
    const weekFilter = searchParams.get('week') || null;

    const encoder = new TextEncoder();

    const stream = new ReadableStream({
        async start(controller) {
            const send = (data) => {
                try { controller.enqueue(encoder.encode(`data: ${JSON.stringify(data)}\n\n`)); } catch (_) {}
            };

            const pool = new Pool({
                connectionString: process.env.DATABASE_URL,
                ssl: { rejectUnauthorized: false },
            });

            try {
                // Load active companies
                const compRes = await pool.query(`SELECT code, name FROM companies WHERE "isActive" = true ORDER BY code`);
                const companies = compRes.rows;
                const n = companies.length;

                // ------------------------------------------------
                // STEP 1 – Rainfall sync
                // ------------------------------------------------
                send({ step: 1, totalSteps: 2, phase: 'rainfall', progress: 0, message: `Memulai sinkronisasi curah hujan…` });

                const today = new Date();
                const endingDateStr = today.toISOString().split('T')[0];
                const anchorDate = new Date(endingDateStr);
                const anchorYear = anchorDate.getFullYear();
                const anchorMonth = anchorDate.getMonth() + 1;

                let rainfallInserted = 0;
                let rainfallErrors = 0;

                for (let i = 0; i < n; i++) {
                    const comp = companies[i];
                    const pct = Math.round((i / n) * 48);
                    send({ step: 1, totalSteps: 2, phase: 'rainfall', progress: pct,
                        message: `Curah hujan: ${comp.code} (${i + 1}/${n})`,
                        company: comp.code, companyIdx: i + 1, companyTotal: n });
                    try {
                        const res = await fetch(RAINFALL_API_URL, {
                            method: 'POST',
                            headers: { 'Content-Type': 'application/json' },
                            body: JSON.stringify({ companycode: comp.code, endingdate: endingDateStr, arsiran: '7' }),
                        });
                        if (!res.ok) throw new Error(`HTTP ${res.status}`);
                        const json = await res.json();
                        let records = [];
                        if (json.d && json.d[0]) { try { records = JSON.parse(json.d[0]); } catch (_) {} }
                        if (Array.isArray(records)) {
                            for (const item of records) {
                                const stationId = item.Station_ID;
                                const location = item.Location;
                                const estCode = (item.EstCode || '').split(' - ')[0];
                                for (const key in item) {
                                    const m = key.match(/^(\d{1,2})-(\d{1,2})$/);
                                    if (m) {
                                        const month = parseInt(m[1]);
                                        const day = parseInt(m[2]);
                                        const mm = parseFloat(item[key]);
                                        if (isNaN(mm)) continue;
                                        let year = anchorYear;
                                        if (anchorMonth === 1 && month === 12) year = anchorYear - 1;
                                        const recordDate = `${year}-${String(month).padStart(2,'0')}-${String(day).padStart(2,'0')}`;
                                        await pool.query(`
                                            INSERT INTO daily_rainfall (company_code, est_code, station_id, location, record_date, rainfall_mm, updated_at)
                                            VALUES ($1,$2,$3,$4,$5,$6,NOW())
                                            ON CONFLICT (station_id, record_date) DO UPDATE SET rainfall_mm=EXCLUDED.rainfall_mm, updated_at=NOW()
                                        `, [comp.code, estCode, stationId, location, recordDate, mm]);
                                        rainfallInserted++;
                                    }
                                }
                            }
                        }
                    } catch (_) { rainfallErrors++; }
                    await new Promise(r => setTimeout(r, 200));
                }

                send({ step: 1, totalSteps: 2, phase: 'rainfall', progress: 50,
                    message: `✅ Curah hujan selesai — ${rainfallInserted} record${rainfallErrors ? ` (${rainfallErrors} PT gagal)` : ''}`,
                    stepDone: 'rainfall' });

                // ------------------------------------------------
                // STEP 2 – GIS TMAT sync
                // ------------------------------------------------
                let gisWeekId = null;
                if (weekFilter) {
                    const wRes = await pool.query(
                        `SELECT id, gis_week_id FROM calendar_weeks WHERE formatted_name = $1 LIMIT 1`, [weekFilter]);
                    if (wRes.rows.length > 0) gisWeekId = wRes.rows[0].gis_week_id || (wRes.rows[0].id + 434);
                }
                if (!gisWeekId) {
                    const wRes = await pool.query(
                        `SELECT id, gis_week_id FROM calendar_weeks WHERE start_date <= NOW() ORDER BY start_date DESC LIMIT 1`);
                    if (wRes.rows.length > 0) gisWeekId = wRes.rows[0].gis_week_id || (wRes.rows[0].id + 434);
                }

                send({ step: 2, totalSteps: 2, phase: 'gis', progress: 52,
                    message: `Memulai sinkronisasi data GIS (Week ID: ${gisWeekId})…` });

                let gisSuccess = 0;
                let gisErrors = 0;

                for (let i = 0; i < n; i++) {
                    const comp = companies[i];
                    const pct = 52 + Math.round((i / n) * 46);
                    send({ step: 2, totalSteps: 2, phase: 'gis', progress: pct,
                        message: `GIS TMAT: ${comp.code} (${i + 1}/${n})`,
                        company: comp.code, companyIdx: i + 1, companyTotal: n });
                    try {
                        const d = await callGisApi(comp.code, gisWeekId);
                        const prevRecord = parseWeekBlock(d[0], d[2], d[8], true, comp.code, comp.name);
                        const currRecord = parseWeekBlock(d[4], d[6], d[8], false, comp.code, comp.name);
                        if (prevRecord) await upsertGisRecord(pool, prevRecord);
                        if (currRecord) await upsertGisRecord(pool, currRecord);
                        gisSuccess++;
                    } catch (_) { gisErrors++; }
                    await new Promise(r => setTimeout(r, 300));
                }

                send({ step: 2, totalSteps: 2, phase: 'gis', progress: 100,
                    message: `✅ GIS selesai — ${gisSuccess}/${n} PT berhasil${gisErrors ? ` (${gisErrors} gagal)` : ''}`,
                    completed: true });

            } catch (e) {
                send({ error: e.message, progress: 0 });
            } finally {
                await pool.end();
                controller.close();
            }
        },
    });

    return new Response(stream, {
        headers: {
            'Content-Type': 'text/event-stream',
            'Cache-Control': 'no-cache',
            'Connection': 'keep-alive',
        },
    });
}
