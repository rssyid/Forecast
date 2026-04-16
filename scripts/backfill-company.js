/**
 * Script Backfill company_code
 * Update semua baris yang company_code = NULL berdasarkan sync ulang
 * per company untuk rentang tertentu.
 *
 * Jalankan: node scripts/backfill-company.js [COMPANY] [BULAN_KEBELAKANG]
 * Contoh:   node scripts/backfill-company.js PT.THIP 3
 *           node scripts/backfill-company.js ALL 3
 */
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import pg from 'pg';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// Load .env.local
const envPath = path.join(__dirname, '../.env.local');
if (fs.existsSync(envPath)) {
    fs.readFileSync(envPath, 'utf8').split('\n').forEach(line => {
        const trimmed = line.trim();
        if (trimmed && !trimmed.startsWith('#')) {
            const eqIdx = trimmed.indexOf('=');
            if (eqIdx > 0) {
                const key = trimmed.slice(0, eqIdx).trim();
                let val = trimmed.slice(eqIdx + 1).trim();
                if ((val.startsWith("'") && val.endsWith("'")) || (val.startsWith('"') && val.endsWith('"'))) {
                    val = val.slice(1, -1);
                }
                process.env[key] = process.env[key] || val;
            }
        }
    });
}

const { Pool } = pg;
const pool = new Pool({ connectionString: process.env.DATABASE_URL, ssl: { rejectUnauthorized: false } });

const ALL_COMPANIES = [
  "PT.THIP", "PT.PTW", "PT.SUMS", "PT.WKN", "PT.PANPS", "PT.SAM",
  "PT.NJP", "PT.PLDK", "PT.SUMK", "PT.BAS", "PT.AAN", "PT.GAN",
  "PT.AJP", "PT.JJP", "PT.SIP", "PT.WSM"
];

const API_URL = "https://app.gis-div.com/PZO/Service/MapService.asmx/GetDataPiezometer";

// Argumen CLI
const argCompany  = process.argv[2] || 'ALL';
const argMonths   = parseInt(process.argv[3] || '3');

const companies = argCompany.toUpperCase() === 'ALL' ? ALL_COMPANIES : [argCompany];

function getDateRanges(monthsBack) {
    const ranges = [];
    const now = new Date();
    for (let i = monthsBack - 1; i >= 0; i--) {
        const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
        const year = d.getFullYear();
        const month = d.getMonth() + 1;
        const mm = String(month).padStart(2, '0');
        const lastDay = new Date(year, month, 0).getDate();
        ranges.push({ startDate: `${year}-${mm}-01`, endDate: `${year}-${mm}-${lastDay}` });
    }
    return ranges;
}

async function fetchData(companyCode, startDate, endDate) {
    try {
        const response = await fetch(API_URL, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ CompanyCode: companyCode, EstCode: '', StartDate: startDate, EndDate: endDate })
        });
        if (!response.ok) return [];
        const json = await response.json();
        if (!json.d) return [];
        try {
            return JSON.parse(json.d.replace(/\\\\\"/g, '"'));
        } catch {
            return JSON.parse(json.d);
        }
    } catch (err) {
        console.error(`  ⚠️ Fetch error (${companyCode} ${startDate}): ${err.message}`);
        return [];
    }
}

async function main() {
    console.log(`\n🔄 Backfill company_code`);
    console.log(`   Companies : ${companies.join(', ')}`);
    console.log(`   Months    : ${argMonths} bulan terakhir\n`);

    const ranges = getDateRanges(argMonths);

    const upsertQuery = `
        INSERT INTO piezometer_data (
            company_code, data_taken, est_code, block, pie_record_id, ketinggian,
            indicator_name, indicator_alias, month_name, date_timestamp, banyak, url_images
        ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12)
        ON CONFLICT (pie_record_id, date_timestamp) DO UPDATE SET
            company_code   = EXCLUDED.company_code,
            indicator_name = EXCLUDED.indicator_name,
            indicator_alias= EXCLUDED.indicator_alias,
            month_name     = EXCLUDED.month_name;
    `;

    let totalUpdated = 0;

    for (const company of companies) {
        console.log(`\n--- ${company} ---`);
        for (const { startDate, endDate } of ranges) {
            process.stdout.write(`  Fetching ${startDate} → ${endDate} ... `);
            const data = await fetchData(company, startDate, endDate);
            if (!data.length) { console.log('no data'); continue; }

            for (const item of data) {
                await pool.query(upsertQuery, [
                    company, item.DataTaken || '', item.EstCode || '', item.Block || '',
                    item.PieRecordID || '', item.Ketinggian || 0,
                    item.IndicatorName || '', item.IndicatorAlias || '',
                    item.MonthName || '', item.Date || 0,
                    item.banyak || 1, item.urlImages || ''
                ]);
            }
            console.log(`✅ ${data.length} rows upserted`);
            totalUpdated += data.length;
            await new Promise(r => setTimeout(r, 300));
        }
    }

    console.log(`\n✅ Backfill selesai! Total rows diproses: ${totalUpdated}`);
    await pool.end();
    process.exit(0);
}

main().catch(err => {
    console.error('Fatal:', err);
    process.exit(1);
});
