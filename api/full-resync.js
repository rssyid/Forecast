/**
 * API: Full Reset & Resync
 * POST /api/full-resync
 * - Drop tabel piezometer_data
 * - Recreate dengan schema terbaru (termasuk company_code)
 * - Sync ulang semua company dari startYear hingga bulan ini
 * 
 * HANYA untuk digunakan di lokal (via server.js). Butuh waktu beberapa menit.
 * Response: Server-Sent Events (SSE) untuk live progress.
 */
import pg from 'pg';

const { Pool } = pg;

const COMPANIES = [
    "PT.THIP", "PT.PTW", "PT.SUMS", "PT.WKN", "PT.PANPS", "PT.SAM",
    "PT.NJP", "PT.PLDK", "PT.SUMK", "PT.BAS", "PT.AAN", "PT.GAN",
    "PT.AJP", "PT.JJP", "PT.SIP", "PT.WSM"
];

const API_URL = "https://app.gis-div.com/PZO/Service/MapService.asmx/GetDataPiezometer";
const START_YEAR = 2025;
const START_MONTH = 1;

function getDateRanges() {
    const ranges = [];
    const now = new Date();
    let y = START_YEAR, m = START_MONTH;
    while (y < now.getFullYear() || (y === now.getFullYear() && m <= now.getMonth() + 1)) {
        const mm = String(m).padStart(2, '0');
        const lastDay = new Date(y, m, 0).getDate();
        ranges.push({ startDate: `${y}-${mm}-01`, endDate: `${y}-${mm}-${lastDay}` });
        m++; if (m > 12) { m = 1; y++; }
    }
    return ranges;
}

async function fetchData(companyCode, startDate, endDate) {
    try {
        const res = await fetch(API_URL, {
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

export default async function handler(req, res) {
    if (req.method !== 'POST') {
        return res.status(405).json({ error: 'Method not allowed. Use POST.' });
    }

    // SSE headers – allows live progress streaming to the browser
    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');

    const send = (msg) => {
        res.end ? null : null; // check alive
        try { res._raw ? res._raw.write(`data: ${JSON.stringify({ msg })}\n\n`) : res.write?.(`data: ${JSON.stringify({ msg })}\n\n`); } catch {}
        console.log(`[Resync] ${msg}`);
    };

    const pool = new Pool({
        connectionString: process.env.DATABASE_URL,
        ssl: { rejectUnauthorized: false }
    });

    try {
        // 1. DROP TABLE
        send('🗑️  Menghapus tabel lama (DROP TABLE)...');
        await pool.query('DROP TABLE IF EXISTS piezometer_data;');
        send('✅ Tabel berhasil dihapus.');

        // 2. CREATE TABLE
        send('🏗️  Membuat ulang tabel dengan schema terbaru...');
        await pool.query(`
            CREATE TABLE piezometer_data (
                id SERIAL PRIMARY KEY,
                company_code VARCHAR(50),
                data_taken VARCHAR(255),
                est_code VARCHAR(50),
                block VARCHAR(50),
                pie_record_id VARCHAR(100),
                ketinggian INTEGER,
                indicator_name VARCHAR(50),
                indicator_alias VARCHAR(100),
                month_name VARCHAR(100),
                date_timestamp BIGINT,
                banyak INTEGER,
                url_images TEXT,
                UNIQUE(pie_record_id, date_timestamp)
            );
        `);
        send('✅ Tabel dibuat ulang.');

        // 3. SYNC ALL
        const ranges = getDateRanges();
        const upsertQ = `
            INSERT INTO piezometer_data (
                company_code, data_taken, est_code, block, pie_record_id, ketinggian,
                indicator_name, indicator_alias, month_name, date_timestamp, banyak, url_images
            ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12)
            ON CONFLICT (pie_record_id, date_timestamp) DO UPDATE SET
                company_code = EXCLUDED.company_code,
                ketinggian = EXCLUDED.ketinggian,
                indicator_name = EXCLUDED.indicator_name,
                indicator_alias = EXCLUDED.indicator_alias,
                month_name = EXCLUDED.month_name;
        `;

        let grandTotal = 0;
        const totalSteps = COMPANIES.length * ranges.length;
        let step = 0;

        for (const company of COMPANIES) {
            send(`\n📡 Sync company: ${company}`);
            let companyTotal = 0;
            for (const { startDate, endDate } of ranges) {
                step++;
                const data = await fetchData(company, startDate, endDate);
                if (data.length > 0) {
                    for (const item of data) {
                        await pool.query(upsertQ, [
                            company, item.DataTaken || '', item.EstCode || '', item.Block || '',
                            item.PieRecordID || '', item.Ketinggian || 0,
                            item.IndicatorName || '', item.IndicatorAlias || '',
                            item.MonthName || '', item.Date || 0,
                            item.banyak || 1, item.urlImages || ''
                        ]);
                    }
                    companyTotal += data.length;
                    grandTotal += data.length;
                    send(`  ✅ ${startDate}: ${data.length} rows [${step}/${totalSteps}]`);
                }
                await new Promise(r => setTimeout(r, 200));
            }
            send(`  📊 ${company} selesai: ${companyTotal} total rows`);
        }

        send(`\n🎉 SELESAI! Total rows dimasukkan: ${grandTotal}`);
        send('DONE');
    } catch (err) {
        send(`❌ ERROR: ${err.message}`);
    } finally {
        await pool.end();
    }

    res.end();
}
