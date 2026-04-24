import pool from '../../../lib/db.js';
import { NextResponse } from 'next/server';

const COMPANIES = [
    "PT.THIP", "PT.PTW", "PT.SUMS", "PT.WKN", "PT.PANPS", "PT.SAM",
    "PT.NJP", "PT.PLDK", "PT.SUMK", "PT.BAS", "PT.AAN", "PT.GAN",
    "PT.AJP", "PT.JJP", "PT.SIP", "PT.WSM"
];

const API_URL = "https://app.gis-div.com/iot/Service/webservice.asmx/GetArsStation4Weeks";

export async function POST(request) {
    // Security: Check for ADMIN_KEY
    const adminKey = process.env.ADMIN_KEY;
    if (adminKey) {
        const providedKey = request.headers.get('x-admin-key');
        if (providedKey !== adminKey) {
            return NextResponse.json({ error: 'Unauthorized: Invalid Admin Key.' }, { status: 401 });
        }
    }

    let body = {};
    try {
        body = await request.json();
    } catch (e) {}

    const today = new Date();
    const endingDateStr = body.endingDate || today.toISOString().split('T')[0];
    const weeksToFetch = body.weeks || "7";
    
    // Use year/month from the endingDateStr to ensure correct mapping
    const anchorDate = new Date(endingDateStr);
    const anchorYear = anchorDate.getFullYear();
    const anchorMonth = anchorDate.getMonth() + 1;

    let totalInserted = 0;
    const errors = [];

    try {
        for (const company of COMPANIES) {
            try {
                const response = await fetch(API_URL, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ companycode: company, endingdate: endingDateStr, arsiran: weeksToFetch })
                });

                if (!response.ok) throw new Error(`HTTP Error ${response.status}`);
                const json = await response.json();
                
                // API returns stringified JSON in d[0]
                let records = [];
                if (json.d && json.d[0]) {
                    try {
                        records = JSON.parse(json.d[0]);
                    } catch (e) {
                        console.error(`Error parsing JSON for ${company}:`, e.message);
                        continue;
                    }
                }
                
                if (!Array.isArray(records)) continue;

                for (const item of records) {
                    const stationId = item.Station_ID;
                    const location = item.Location;
                    const fullEstCode = item.EstCode || "";
                    const estCode = fullEstCode.split(" - ")[0];

                    // Find rainfall keys (Format M-D or MM-DD)
                    for (const key in item) {
                        const dateMatch = key.match(/^(\d{1,2})-(\d{1,2})$/);
                        if (dateMatch) {
                            const month = parseInt(dateMatch[1]);
                            const day = parseInt(dateMatch[2]);
                            const rainfallMm = parseFloat(item[key]);

                            if (isNaN(rainfallMm)) continue;

                            // Calculate Correct Year (Handle Jan rollover)
                            let year = anchorYear;
                            if (anchorMonth === 1 && month === 12) {
                                year = anchorYear - 1;
                            } else if (anchorMonth === 12 && month === 1) {
                                // Just in case endingDate is late Dec and we get Jan data (unlikely but safe)
                                year = anchorYear + 1; 
                            }

                            const recordDate = `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;

                            const query = `
                                INSERT INTO daily_rainfall (
                                    company_code, est_code, station_id, location, record_date, rainfall_mm, updated_at
                                ) VALUES ($1, $2, $3, $4, $5, $6, NOW())
                                ON CONFLICT (station_id, record_date) DO UPDATE SET
                                    rainfall_mm = EXCLUDED.rainfall_mm,
                                    updated_at = NOW();
                            `;

                            await pool.query(query, [company, estCode, stationId, location, recordDate, rainfallMm]);
                            totalInserted++;
                        }
                    }
                }
                
                // Small delay to avoid rate limit
                await new Promise(r => setTimeout(r, 200));

            } catch (err) {
                console.error(`Error syncing ${company}:`, err.message);
                errors.push({ company, error: err.message });
            }
        }

        return NextResponse.json({ 
            message: "Synchronization complete", 
            inserted: totalInserted, 
            errors: errors.length > 0 ? errors : null 
        });

    } catch (err) {
        console.error('Fatal sync error:', err);
        return NextResponse.json({ error: err.message }, { status: 500 });
    }
}
