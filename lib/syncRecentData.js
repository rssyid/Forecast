const API_PIEZO = "https://app.gis-div.com/PZO/Service/MapService.asmx/GetDataPiezometer";
const API_RAIN = "https://app.gis-div.com/iot/Service/webservice.asmx/GetArsStation4Weeks";

const WIB_OFFSET_MS = 7 * 60 * 60 * 1000;
const FETCH_TIMEOUT_MS = 30000;
const BATCH_SIZE = 250;

export function formatWibDate(date = new Date()) {
    const wib = new Date(date.getTime() + WIB_OFFSET_MS);
    const y = wib.getUTCFullYear();
    const m = String(wib.getUTCMonth() + 1).padStart(2, '0');
    const d = String(wib.getUTCDate()).padStart(2, '0');
    return `${y}-${m}-${d}`;
}

export function getRecentPiezometerDates(now = new Date()) {
    const start = new Date(now.getTime() - 14 * 24 * 60 * 60 * 1000);
    return {
        startDate: formatWibDate(start),
        endDate: formatWibDate(now)
    };
}

export function getRecentRainfallDate(now = new Date()) {
    return formatWibDate(now);
}

export async function getActiveCompanies(pool) {
    const { rows } = await pool.query(
        'SELECT code FROM companies WHERE "isActive" = true ORDER BY code ASC'
    );
    return rows.map((r) => r.code).filter(Boolean);
}

async function fetchPiezometer(companyCode, startDate, endDate) {
    try {
        const res = await fetch(API_PIEZO, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                CompanyCode: companyCode,
                EstCode: '',
                StartDate: startDate,
                EndDate: endDate
            }),
            signal: AbortSignal.timeout(FETCH_TIMEOUT_MS)
        });
        if (!res.ok) return { ok: false, data: [], error: `HTTP ${res.status}` };
        const json = await res.json();
        if (!json.d) return { ok: true, data: [] };
        try {
            return { ok: true, data: JSON.parse(json.d.replace(/\\\\\"/g, '"')) };
        } catch {
            return { ok: true, data: JSON.parse(json.d) };
        }
    } catch (err) {
        return { ok: false, data: [], error: err.message };
    }
}

async function fetchRainfall(companyCode, endingDate) {
    try {
        const res = await fetch(API_RAIN, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                companycode: companyCode,
                endingdate: endingDate,
                arsiran: "7"
            }),
            signal: AbortSignal.timeout(FETCH_TIMEOUT_MS)
        });
        if (!res.ok) return { ok: false, data: [], error: `HTTP ${res.status}` };
        const json = await res.json();
        if (!json.d || !json.d[0]) return { ok: true, data: [] };
        try {
            return { ok: true, data: JSON.parse(json.d[0]) };
        } catch {
            return { ok: true, data: [] };
        }
    } catch (err) {
        return { ok: false, data: [], error: err.message };
    }
}

async function upsertPiezometerBatch(pool, company, items) {
    const deduped = new Map();
    for (const item of items) {
        const pieRecordId = item.PieRecordID || '';
        const dateTs = item.Date || 0;
        deduped.set(`${pieRecordId}::${dateTs}`, [
            company,
            item.DataTaken || '',
            item.EstCode || '',
            item.Block || '',
            pieRecordId,
            item.Ketinggian || 0,
            item.IndicatorName || '',
            item.IndicatorAlias || '',
            item.MonthName || '',
            dateTs,
            item.banyak || 1,
            item.urlImages || ''
        ]);
    }

    const rows = Array.from(deduped.values());
    const colCount = 12;

    for (let i = 0; i < rows.length; i += BATCH_SIZE) {
        const chunk = rows.slice(i, i + BATCH_SIZE);
        const values = [];
        const placeholders = chunk.map((row, rowIdx) => {
            const offset = rowIdx * colCount;
            values.push(...row);
            const params = Array.from({ length: colCount }, (_, colIdx) => `$${offset + colIdx + 1}`);
            return `(${params.join(',')})`;
        });

        await pool.query(
            `INSERT INTO piezometer_data (
                company_code, data_taken, est_code, block, pie_record_id,
                ketinggian, indicator_name, indicator_alias, month_name,
                date_timestamp, banyak, url_images
            ) VALUES ${placeholders.join(',')}
            ON CONFLICT (pie_record_id, date_timestamp)
            DO UPDATE SET ketinggian = EXCLUDED.ketinggian;`,
            values
        );
    }

    return rows.length;
}

async function upsertRainfallBatch(pool, company, items, rEndingDate) {
    const [endYearStr, endMonthStr] = rEndingDate.split('-');
    const endYear = parseInt(endYearStr, 10);
    const endMonth = parseInt(endMonthStr, 10);

    const deduped = new Map();
    for (const item of items) {
        const stId = item.Station_ID;
        const loc = item.Location;
        const estCode = (item.EstCode || "").split(" - ")[0];

        for (const key in item) {
            const match = key.match(/^(\d{1,2})-(\d{1,2})$/);
            if (!match) continue;
            const rain = parseFloat(item[key]);
            if (isNaN(rain)) continue;

            const mo = parseInt(match[1], 10);
            const dy = parseInt(match[2], 10);
            let y = endYear;
            if (endMonth === 1 && mo === 12) y -= 1;
            const rDate = `${y}-${String(mo).padStart(2, '0')}-${String(dy).padStart(2, '0')}`;

            deduped.set(`${stId}::${rDate}`, [company, estCode, stId, loc, rDate, rain]);
        }
    }

    const rows = Array.from(deduped.values());
    const colCount = 6;

    for (let i = 0; i < rows.length; i += BATCH_SIZE) {
        const chunk = rows.slice(i, i + BATCH_SIZE);
        const values = [];
        const placeholders = chunk.map((row, rowIdx) => {
            const offset = rowIdx * colCount;
            values.push(...row);
            return `($${offset + 1},$${offset + 2},$${offset + 3},$${offset + 4},$${offset + 5},$${offset + 6},NOW())`;
        });

        await pool.query(
            `INSERT INTO daily_rainfall (
                company_code, est_code, station_id, location, record_date, rainfall_mm, updated_at
            ) VALUES ${placeholders.join(',')}
            ON CONFLICT (station_id, record_date)
            DO UPDATE SET rainfall_mm = EXCLUDED.rainfall_mm, updated_at = NOW();`,
            values
        );
    }

    return rows.length;
}

export async function runRecentSync(send = () => {}, pool) {
    const companies = await getActiveCompanies(pool);
    if (companies.length === 0) {
        send('⚠️ Tidak ada perusahaan aktif (isActive = true) di database.');
        return { companiesCount: 0, pTotal: 0, rTotal: 0, failedCompanies: [] };
    }

    send(`📋 Perusahaan aktif (${companies.length}): ${companies.join(', ')}`);

    const { startDate, endDate } = getRecentPiezometerDates();
    let pTotal = 0;
    const failedCompanies = [];

    send(`\n--- MENARIK DATA PIEZOMETER TERBARU (${startDate} s/d ${endDate} WIB) ---`);
    for (const company of companies) {
        const res = await fetchPiezometer(company, startDate, endDate);
        if (!res.ok) {
            failedCompanies.push({ company, type: 'piezometer', error: res.error });
            send(`  ⚠️ ${company}: gagal ambil piezometer (${res.error})`);
        } else if (res.data.length > 0) {
            const count = await upsertPiezometerBatch(pool, company, res.data);
            pTotal += count;
            send(`  ✅ ${company}: ${count} rows diperbarui`);
        } else {
            send(`  ℹ️ ${company}: tidak ada data baru`);
        }
        await new Promise((r) => setTimeout(r, 50));
    }

    const rEndingDate = getRecentRainfallDate();
    let rTotal = 0;

    send(`\n--- MENARIK DATA CURAH HUJAN (4 Minggu Terakhir s/d ${rEndingDate} WIB) ---`);
    for (const company of companies) {
        const res = await fetchRainfall(company, rEndingDate);
        if (!res.ok) {
            failedCompanies.push({ company, type: 'rainfall', error: res.error });
            send(`  ⚠️ ${company}: gagal ambil curah hujan (${res.error})`);
        } else if (res.data.length > 0) {
            const count = await upsertRainfallBatch(pool, company, res.data, rEndingDate);
            rTotal += count;
            send(`  ✅ ${company}: ${count} hari curah hujan diperbarui`);
        } else {
            send(`  ℹ️ ${company}: tidak ada data baru`);
        }
        await new Promise((r) => setTimeout(r, 50));
    }

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

    return { companiesCount: companies.length, pTotal, rTotal, failedCompanies };
}
