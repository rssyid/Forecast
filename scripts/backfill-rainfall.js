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

const API_URL = "https://app.gis-div.com/iot/Service/webservice.asmx/GetArsStation4WeeksRequest";

async function backfill() {
    const { default: pool } = await import('../lib/db.js');
    
    console.log('🚀 Starting Backfill Rainfall 2025-2026...');
    
    const startDate = new Date('2025-01-28'); // Start from end of Jan 2025
    const today = new Date();
    
    let totalInserted = 0;

    // Generate date steps (every 28 days / 4 weeks)
    const dateSteps = [];
    let currentStep = new Date(startDate);
    while (currentStep <= today) {
        dateSteps.push(currentStep.toISOString().split('T')[0]);
        // Increment by 28 days
        currentStep.setDate(currentStep.getDate() + 28);
    }
    // Ensure today is the last step
    const todayStr = today.toISOString().split('T')[0];
    if (dateSteps[dateSteps.length - 1] !== todayStr) {
        dateSteps.push(todayStr);
    }

    console.log(`📅 Total steps per PT: ${dateSteps.length}`);

    for (const company of COMPANIES) {
        console.log(`\n🏢 PT: ${company}`);
        for (const endingDate of dateSteps) {
            console.log(`  📡 Fetching ending at: ${endingDate}...`);
            try {
                const response = await fetch(API_URL, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ companycode: company, endingdate: endingDate, arsiran: "7" })
                });

                if (!response.ok) throw new Error(`HTTP ${response.status}`);
                const json = await response.json();
                const records = json.d && json.d[0] ? json.d[0] : [];
                
                if (!Array.isArray(records)) {
                    console.log(`    ⚠️ No records found for this step.`);
                    continue;
                }

                const stepYear = parseInt(endingDate.split('-')[0]);
                const stepMonth = parseInt(endingDate.split('-')[1]);

                let stepInserted = 0;
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

                            await pool.query(`
                                INSERT INTO daily_rainfall (company_code, est_code, station_id, location, record_date, rainfall_mm)
                                VALUES ($1, $2, $3, $4, $5, $6)
                                ON CONFLICT (station_id, record_date) DO UPDATE SET rainfall_mm = EXCLUDED.rainfall_mm;
                            `, [company, estCode, stationId, location, recordDate, rainfallMm]);
                            stepInserted++;
                        }
                    }
                }
                totalInserted += stepInserted;
                console.log(`    ✅ Updated ${stepInserted} records.`);
                
                // Jeda 300ms agar server API tidak marah
                await new Promise(r => setTimeout(r, 300));

            } catch (err) {
                console.error(`    ❌ Error: ${err.message}`);
            }
        }
    }

    console.log(`\n🎉 BACKFILL SELESAI! Total records: ${totalInserted}`);
    await pool.end();
}

backfill();
