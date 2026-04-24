import pg from 'pg';

const { Pool } = pg;

const COMPANIES = [
    "PT.THIP", "PT.PTW", "PT.SUMS", "PT.WKN", "PT.PANPS", "PT.SAM",
    "PT.NJP", "PT.PLDK", "PT.SUMK", "PT.BAS", "PT.AAN", "PT.GAN",
    "PT.AJP", "PT.JJP", "PT.SIP", "PT.WSM"
];

const API_PIEZO = "https://app.gis-div.com/PZO/Service/MapService.asmx/GetDataPiezometer";
const API_RAIN = "https://app.gis-div.com/iot/Service/webservice.asmx/GetArsStation4Weeks";
const START_YEAR = 2025;
const START_MONTH = 1;

function getDateRangesPiezometer() {
    const ranges = [];
    const now = new Date();
    let y = START_YEAR, m = START_MONTH;
    while (y < now.getFullYear() || (y === now.getFullYear() && m <= now.getMonth() + 1)) {
        const mm = String(m).padStart(2, '0');
        const lastDay = new Date(y, m, 0).getDate();
        
        const start = new Date(y, m - 1, 1);
        start.setDate(start.getDate() - 7);
        const startY = start.getFullYear();
        const startM = String(start.getMonth() + 1).padStart(2, '0');
        const startD = String(start.getDate()).padStart(2, '0');

        ranges.push({ 
            startDate: `${startY}-${startM}-${startD}`, 
            endDate: `${y}-${mm}-${lastDay}` 
        });
        m++; if (m > 12) { m = 1; y++; }
    }
    return ranges;
}

function getDateRangesRainfall() {
    const ranges = [];
    let current = new Date(); // Start from today
    const limitDate = new Date(START_YEAR, START_MONTH - 1, 1);

    while (current >= limitDate) {
        const y = current.getFullYear();
        const m = String(current.getMonth() + 1).padStart(2, '0');
        const d = String(current.getDate()).padStart(2, '0');
        ranges.push(`${y}-${m}-${d}`);
        current.setDate(current.getDate() - 28); // Subtract 4 weeks
    }
    return ranges.reverse(); // oldest first
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

export async function POST(request) {
    const adminKey = process.env.ADMIN_KEY;
    if (adminKey) {
        const providedKey = request.headers.get('x-admin-key');
        if (providedKey !== adminKey) {
            return new Response(JSON.stringify({ error: 'Unauthorized: Invalid Admin Key.' }), { status: 401 });
        }
    }

    const encoder = new TextEncoder();
    const stream = new ReadableStream({
        async start(controller) {
            const send = (msg) => { controller.enqueue(encoder.encode(`data: ${JSON.stringify({ msg })}\n\n`)); };

            const pool = new Pool({ connectionString: process.env.DATABASE_URL, ssl: { rejectUnauthorized: false } });

            try {
                // ==========================
                // 1. DROP & CREATE TABLES
                // ==========================
                send('🗑️ Menghapus tabel Piezometer dan Curah Hujan (DROP TABLE)...');
                await pool.query('DROP TABLE IF EXISTS piezometer_data;');
                await pool.query('DROP TABLE IF EXISTS daily_rainfall;');
                send('✅ Tabel berhasil dihapus.');

                send('🏗️ Membuat ulang tabel Piezometer...');
                await pool.query(`
                    CREATE TABLE piezometer_data (
                        id SERIAL PRIMARY KEY, company_code VARCHAR(50), data_taken VARCHAR(255),
                        est_code VARCHAR(50), block VARCHAR(50), pie_record_id VARCHAR(100),
                        ketinggian INTEGER, indicator_name VARCHAR(50), indicator_alias VARCHAR(100),
                        month_name VARCHAR(100), date_timestamp BIGINT, banyak INTEGER, url_images TEXT,
                        UNIQUE(pie_record_id, date_timestamp)
                    );
                `);

                send('🏗️ Membuat ulang tabel Curah Hujan (daily_rainfall)...');
                await pool.query(`
                    CREATE TABLE daily_rainfall (
                        id SERIAL PRIMARY KEY, company_code VARCHAR(50), est_code VARCHAR(50),
                        station_id VARCHAR(100), location VARCHAR(100), record_date DATE,
                        rainfall_mm NUMERIC, updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                        UNIQUE(station_id, record_date)
                    );
                `);
                send('✅ Tabel Curah Hujan dibuat ulang.');

                // ==========================
                // 2. SYNC PIEZOMETER
                // ==========================
                const pRanges = getDateRangesPiezometer();
                let pTotal = 0;
                send('\n--- MEMULAI SINKRONISASI PIEZOMETER (Dari 2025) ---');
                for (const company of COMPANIES) {
                    send(`\n📡 Sync Piezometer: ${company}`);
                    let cTotal = 0;
                    for (const { startDate, endDate } of pRanges) {
                        const data = await fetchPiezometer(company, startDate, endDate);
                        if (data.length > 0) {
                            for (const item of data) {
                                await pool.query(`
                                    INSERT INTO piezometer_data (company_code, data_taken, est_code, block, pie_record_id, ketinggian, indicator_name, indicator_alias, month_name, date_timestamp, banyak, url_images) 
                                    VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12) ON CONFLICT (pie_record_id, date_timestamp) DO UPDATE SET ketinggian = EXCLUDED.ketinggian;
                                `, [company, item.DataTaken || '', item.EstCode || '', item.Block || '', item.PieRecordID || '', item.Ketinggian || 0, item.IndicatorName || '', item.IndicatorAlias || '', item.MonthName || '', item.Date || 0, item.banyak || 1, item.urlImages || '']);
                            }
                            cTotal += data.length; pTotal += data.length;
                            send(`  ✅ ${startDate}: ${data.length} rows inserted`);
                        }
                        await new Promise(r => setTimeout(r, 100)); // Rate limit
                    }
                }

                // ==========================
                // 3. SYNC CURAH HUJAN
                // ==========================
                const rRanges = getDateRangesRainfall();
                let rTotal = 0;
                send('\n--- MEMULAI SINKRONISASI CURAH HUJAN (Dari 2025) ---');
                
                const currYear = new Date().getFullYear();
                const currMonth = new Date().getMonth() + 1;

                for (const company of COMPANIES) {
                    send(`\n🌧️ Sync Curah Hujan: ${company}`);
                    let cTotal = 0;
                    for (const endingDate of rRanges) {
                        const data = await fetchRainfall(company, endingDate);
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
                                        
                                        // Simple year resolution based on endingDate year
                                        const endingY = parseInt(endingDate.split('-')[0]);
                                        const endingM = parseInt(endingDate.split('-')[1]);
                                        
                                        let y = endingY;
                                        if (endingM === 1 && mo === 12) y = endingY - 1;
                                        
                                        const rDate = `${y}-${String(mo).padStart(2,'0')}-${String(dy).padStart(2,'0')}`;
                                        await pool.query(`
                                            INSERT INTO daily_rainfall (company_code, est_code, station_id, location, record_date, rainfall_mm, updated_at) 
                                            VALUES ($1,$2,$3,$4,$5,$6, NOW()) ON CONFLICT (station_id, record_date) DO UPDATE SET rainfall_mm = EXCLUDED.rainfall_mm;
                                        `, [company, estCode, stId, loc, rDate, rain]);
                                        batchCount++;
                                    }
                                }
                            }
                            cTotal += batchCount; rTotal += batchCount;
                            send(`  ✅ Sampai ${endingDate}: ${batchCount} data tersimpan`);
                        }
                        await new Promise(r => setTimeout(r, 100)); // Rate limit
                    }
                }

                send(`\n🎉 FULL SYNC SELESAI! Piezometer: ${pTotal} rows | Curah Hujan: ${rTotal} rows`);
                send('DONE');
            } catch (err) {
                send(`❌ ERROR: ${err.message}`);
            } finally {
                await pool.end();
                controller.close();
            }
        }
    });

    return new Response(stream, { headers: { 'Content-Type': 'text/event-stream', 'Cache-Control': 'no-cache, no-transform', 'Connection': 'keep-alive' } });
}
