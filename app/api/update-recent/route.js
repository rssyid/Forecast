import pg from 'pg';

const { Pool } = pg;

const COMPANIES = [
    "PT.THIP", "PT.PTW", "PT.SUMS", "PT.WKN", "PT.PANPS", "PT.SAM",
    "PT.NJP", "PT.PLDK", "PT.SUMK", "PT.BAS", "PT.AAN", "PT.GAN",
    "PT.AJP", "PT.JJP", "PT.SIP", "PT.WSM"
];

const API_PIEZO = "https://app.gis-div.com/PZO/Service/MapService.asmx/GetDataPiezometer";
const API_RAIN = "https://app.gis-div.com/iot/Service/webservice.asmx/GetArsStation4Weeks";

function getRecentPiezometerDates() {
    const end = new Date();
    const start = new Date();
    start.setDate(end.getDate() - 14); // 14 days lookback
    
    const formatDate = (d) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
    
    return { startDate: formatDate(start), endDate: formatDate(end) };
}

function getRecentRainfallDate() {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

async function fetchPiezometer(companyCode, startDate, endDate) {
    try {
        const res = await fetch(API_PIEZO, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ CompanyCode: companyCode, EstCode: '', StartDate: startDate, EndDate: endDate })
        });
        if (!res.ok) return [];
        const json = await res.json();
        if (!json.d) return [];
        try { return JSON.parse(json.d.replace(/\\\\\"/g, '"')); }
        catch { return JSON.parse(json.d); }
    } catch { return []; }
}

async function fetchRainfall(companyCode, endingDate) {
    try {
        const res = await fetch(API_RAIN, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ companycode: companyCode, endingdate: endingDate, arsiran: "7" })
        });
        if (!res.ok) return [];
        const json = await res.json();
        if (!json.d || !json.d[0]) return [];
        try { return JSON.parse(json.d[0]); }
        catch { return []; }
    } catch { return []; }
}

async function runSync(send, pool) {
    const { startDate, endDate } = getRecentPiezometerDates();
    let pTotal = 0;
    send(`\n--- MENARIK DATA PIEZOMETER TERBARU (${startDate} s/d ${endDate}) ---`);
    
    for (const company of COMPANIES) {
        const data = await fetchPiezometer(company, startDate, endDate);
        if (data.length > 0) {
            for (const item of data) {
                await pool.query(`
                    INSERT INTO piezometer_data (company_code, data_taken, est_code, block, pie_record_id, ketinggian, indicator_name, indicator_alias, month_name, date_timestamp, banyak, url_images) 
                    VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12) ON CONFLICT (pie_record_id, date_timestamp) DO UPDATE SET ketinggian = EXCLUDED.ketinggian;
                `, [company, item.DataTaken || '', item.EstCode || '', item.Block || '', item.PieRecordID || '', item.Ketinggian || 0, item.IndicatorName || '', item.IndicatorAlias || '', item.MonthName || '', item.Date || 0, item.banyak || 1, item.urlImages || '']);
            }
            pTotal += data.length;
            send(`  ✅ ${company}: ${data.length} rows diperbarui`);
        }
        await new Promise(r => setTimeout(r, 50));
    }

    const rEndingDate = getRecentRainfallDate();
    let rTotal = 0;
    send('\n--- MENARIK DATA CURAH HUJAN (4 Minggu Terakhir) ---');

    for (const company of COMPANIES) {
        const data = await fetchRainfall(company, rEndingDate);
        if (data.length > 0) {
            let batchCount = 0;
            for (const item of data) {
                const stId = item.Station_ID, loc = item.Location, estCode = (item.EstCode || "").split(" - ")[0];
                for (const key in item) {
                    const match = key.match(/^(\d{1,2})-(\d{1,2})$/);
                    if (match) {
                        const rain = parseFloat(item[key]);
                        if (isNaN(rain)) continue;
                        const mo = parseInt(match[1]), dy = parseInt(match[2]);
                        let y = parseInt(rEndingDate.split('-')[0]);
                        if (parseInt(rEndingDate.split('-')[1]) === 1 && mo === 12) y -= 1;
                        const rDate = `${y}-${String(mo).padStart(2,'0')}-${String(dy).padStart(2,'0')}`;
                        await pool.query(`
                            INSERT INTO daily_rainfall (company_code, est_code, station_id, location, record_date, rainfall_mm, updated_at) 
                            VALUES ($1,$2,$3,$4,$5,$6, NOW()) ON CONFLICT (station_id, record_date) DO UPDATE SET rainfall_mm = EXCLUDED.rainfall_mm;
                        `, [company, estCode, stId, loc, rDate, rain]);
                        batchCount++;
                    }
                }
            }
            rTotal += batchCount;
            send(`  ✅ ${company}: ${batchCount} hari curah hujan diperbarui`);
        }
        await new Promise(r => setTimeout(r, 50));
    }

    // Update Last Sync Metadata
    await pool.query(`
        CREATE TABLE IF NOT EXISTS system_metadata (
            key TEXT PRIMARY KEY,
            value TEXT,
            updated_at TIMESTAMP DEFAULT NOW()
        );
    `);
    await pool.query(`
        INSERT INTO system_metadata (key, value, updated_at)
        VALUES ('last_sync_pzo_rain', NOW()::text, NOW())
        ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value, updated_at = NOW();
    `);

    return { pTotal, rTotal };
}

export async function GET(request) {
    return handleRequest(request);
}

export async function POST(request) {
    return handleRequest(request);
}

async function handleRequest(request) {
    const { searchParams } = new URL(request.url);
    const isStream = searchParams.get('stream') === 'true';

    // Auth check
    const authHeader = request.headers.get('authorization');
    const cronSecret = process.env.CRON_SECRET;
    const adminKey = process.env.ADMIN_KEY || 'admin123';
    const providedKey = request.headers.get('x-admin-key') || searchParams.get('key');

    const isCron = cronSecret && authHeader === `Bearer ${cronSecret}`;
    const isAdmin = providedKey === adminKey;

    if (!isCron && !isAdmin) {
        return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401 });
    }

    const pool = new Pool({ connectionString: process.env.DATABASE_URL, ssl: { rejectUnauthorized: false } });

    if (isStream) {
        const encoder = new TextEncoder();
        const stream = new ReadableStream({
            async start(controller) {
                const send = (msg) => { controller.enqueue(encoder.encode(`data: ${JSON.stringify({ msg })}\n\n`)); };
                try {
                    send('🚀 Memulai Update Data...');
                    const result = await runSync(send, pool);
                    send(`🎉 SELESAI! Pzo: ${result.pTotal} | Rain: ${result.rTotal}`);
                    send('DONE');
                } catch (err) {
                    send(`❌ ERROR: ${err.message}`);
                } finally {
                    await pool.end();
                    controller.close();
                }
            }
        });
        return new Response(stream, { headers: { 'Content-Type': 'text/event-stream', 'Cache-Control': 'no-cache', 'Connection': 'keep-alive' } });
    } else {
        try {
            const result = await runSync(() => {}, pool);
            return new Response(JSON.stringify({ success: true, ...result }), { status: 200 });
        } catch (err) {
            return new Response(JSON.stringify({ error: err.message }), { status: 500 });
        } finally {
            await pool.end();
        }
    }
}

