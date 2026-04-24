import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// Load .env.local manually for standalone execution
const envPath = path.join(__dirname, '..', '.env.local');
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
    console.log('✅ .env.local loaded');
}

const COMPANIES = [
    "PT.THIP", "PT.PTW", "PT.SUMS", "PT.WKN", "PT.PANPS", "PT.SAM",
    "PT.NJP", "PT.PLDK", "PT.SUMK", "PT.BAS", "PT.AAN", "PT.GAN",
    "PT.AJP", "PT.JJP", "PT.SIP", "PT.WSM"
];

const API_URL = "https://app.gis-div.com/iot/Service/webservice.asmx/GetArsStation4Weeks";

async function backfill() {
    const { default: pool } = await import('../lib/db.js');
    
    console.log('🚀 Starting Backfill Rainfall 2025-2026...');
    
    const startDate = new Date('2025-01-20'); 
    const today = new Date();
    
    let totalInserted = 0;

    const dateSteps = [];
    let currentStep = new Date(startDate);
    while (currentStep <= today) {
        dateSteps.push(currentStep.toISOString().split('T')[0]);
        currentStep.setDate(currentStep.getDate() + 28);
    }
    const todayStr = today.toISOString().split('T')[0];
    if (dateSteps[dateSteps.length - 1] !== todayStr) {
        dateSteps.push(todayStr);
    }

    console.log(`📅 Total steps per PT: ${dateSteps.length}`);
    console.log(`🔌 Connecting to Database...`);

    let ptCount = 0;
    for (const company of COMPANIES) {
        ptCount++;
        console.log(`\n🏢 [${ptCount}/${COMPANIES.length}] PT: ${company}`);
        for (const endingDate of dateSteps) {
            process.stdout.write(`  📡 Fetching ending at: ${endingDate}... `);
            try {
                const response = await fetch(API_URL, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ companycode: company, endingdate: endingDate, arsiran: "7" })
                });

                if (!response.ok) throw new Error(`HTTP ${response.status}`);
                const json = await response.json();
                
                let records = [];
                if (json.d && json.d[0]) {
                    try {
                        records = JSON.parse(json.d[0]);
                    } catch (e) {
                        console.log(`❌ JSON Parse Error`);
                        continue;
                    }
                }
                
                if (!Array.isArray(records) || records.length === 0) {
                    console.log(`⚠️ Empty`);
                    continue;
                }

                const stepYear = parseInt(endingDate.split('-')[0]);
                const stepMonth = parseInt(endingDate.split('-')[1]);

                const values = [];
                for (const item of records) {
                    const stationId = item.Station_ID;
                    const location = item.Location;
                    const estCode = (item.EstCode || "").split(" - ")[0];

                    for (const key in item) {
                        const dateMatch = key.match(/^(\d{1,2})-(\d{1,2})$/);
                        if (dateMatch) {
                            const month = parseInt(dateMatch[1]);
                            const day = parseInt(dateMatch[2]);
                            const rainfallMm = parseFloat(item[key]);
                            if (isNaN(rainfallMm)) continue;

                            let year = stepYear;
                            if (stepMonth === 1 && month === 12) year = stepYear - 1;
                            const recordDate = `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
                            
                            values.push([company, estCode, stationId, location, recordDate, rainfallMm]);
                        }
                    }
                }

                let stepInserted = 0;
                if (values.length > 0) {
                    // Bulk Upsert Logic using UNNEST for multi-column insert
                    const query = `
                        INSERT INTO daily_rainfall (company_code, est_code, station_id, location, record_date, rainfall_mm)
                        SELECT * FROM UNNEST($1::text[], $2::text[], $3::text[], $4::text[], $5::date[], $6::numeric[])
                        ON CONFLICT (station_id, record_date) DO UPDATE SET rainfall_mm = EXCLUDED.rainfall_mm;
                    `;

                    const cols = [[], [], [], [], [], []];
                    values.forEach(v => v.forEach((val, i) => cols[i].push(val)));
                    
                    await pool.query(query, cols);
                    stepInserted = values.length;
                }

                totalInserted += stepInserted;
                console.log(`✅ OK (${stepInserted} records)`);
                
                await new Promise(r => setTimeout(r, 400));

            } catch (err) {
                console.error(`    ❌ Error: ${err.message}`);
            }
        }
    }

    console.log(`\n🎉 BACKFILL SELESAI! Total records: ${totalInserted}`);
    await pool.end();
}

backfill();
