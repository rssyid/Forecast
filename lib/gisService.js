import https from 'https';
import pg from 'pg';
const { Pool } = pg;

function getPool() {
    return new Pool({
        connectionString: process.env.DATABASE_URL,
        ssl: { rejectUnauthorized: false }
    });
}

/**
 * Call GIS-DIV external API
 * @param {string} pt - e.g. "PT.NJP"
 * @param {number|string} weekId - e.g. 524
 */
export function callGisApi(pt, weekId) {
    return new Promise((resolve, reject) => {
        // Ensure pt has "PT." prefix
        const ptCode = pt.startsWith('PT.') ? pt : `PT.${pt}`;
        const payload = JSON.stringify({ pt: ptCode, weekId: String(weekId) });
        
        const req = https.request({
            hostname: 'app.gis-div.com',
            path: '/PZO/Service/MapService.asmx/getPetaPerbandinganPetaGo',
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Content-Length': Buffer.byteLength(payload),
            },
            rejectUnauthorized: false,
            timeout: 20000
        }, (res) => {
            let data = '';
            res.on('data', chunk => data += chunk);
            res.on('end', () => {
                try {
                    const parsed = JSON.parse(data);
                    if (!parsed || !parsed.d) {
                        return reject(new Error('Invalid response from GIS-DIV API: missing d property'));
                    }
                    resolve(parsed.d);
                } catch (e) {
                    reject(new Error(`Failed to parse GIS API response: ${e.message}`));
                }
            });
        });
        
        req.on('error', reject);
        req.on('timeout', () => {
            req.destroy();
            reject(new Error('GIS API request timeout'));
        });
        
        req.write(payload);
        req.end();
    });
}

/**
 * Parse one week block from GIS response (element 0 or element 4)
 */
export function parseWeekBlock(indicatorsRaw, weekInfoRaw, statsRaw, isPrev, companyCode, companyName) {
    if (!indicatorsRaw || !weekInfoRaw) return null;
    
    let indicators = [];
    let weekInfoList = [];
    let statsList = [];

    try {
        indicators = Array.isArray(indicatorsRaw) ? indicatorsRaw : JSON.parse(indicatorsRaw);
    } catch { indicators = []; }

    try {
        weekInfoList = Array.isArray(weekInfoRaw) ? weekInfoRaw : JSON.parse(weekInfoRaw);
    } catch { weekInfoList = []; }

    try {
        statsList = Array.isArray(statsRaw) ? statsRaw : JSON.parse(statsRaw || '[]');
    } catch { statsList = []; }

    const weekInfo = weekInfoList[0];
    if (!weekInfo) return null;

    const findInd = (id) => indicators.find(i => i.IndicatorID === id) || {};
    
    const noData = findInd(0);
    const banjir = findInd(1);
    const tergenang = findInd(2);
    const aTergenang = findInd(3);
    const normal = findInd(4);
    const aKering = findInd(5);
    const kering = findInd(6);
    const rusak = findInd(7);
    const total = findInd(99);

    const percentages = [
        Math.round(banjir.persenPiezo || 0),
        Math.round(tergenang.persenPiezo || 0),
        Math.round(aTergenang.persenPiezo || 0),
        Math.round(normal.persenPiezo || 0),
        Math.round(aKering.persenPiezo || 0),
        Math.round(kering.persenPiezo || 0)
    ];

    const labels = ['Banjir', 'Tergenang', 'A Tergenang', 'Normal', 'A Kering', 'Kering'];
    let dominantStatus = 'No Data';
    const maxPct = Math.max(...percentages);
    if (maxPct > 0) {
        dominantStatus = labels[percentages.indexOf(maxPct)];
    }

    const statField = isPrev ? 'mingguLalu' : 'mingguIni';
    const getStat = (name) => {
        const row = statsList.find(s => s.Statistic === name);
        if (!row || row[statField] === null || row[statField] === undefined) return null;
        return parseFloat(row[statField]);
    };

    return {
        company_code: companyCode,
        company_name: companyName,
        week_id: weekInfo.ID,
        week_name: weekInfo.WeekName,
        formatted_name: `${weekInfo.nameOfMonth} ${weekInfo.Year}, W${weekInfo.Week}`,
        start_date: new Date(weekInfo.StartDate),
        end_date: new Date(weekInfo.EndDate),
        cnt_no_data: noData.totalPiezo || 0,
        pct_no_data: Math.round(noData.persenPiezo || 0),
        cnt_banjir: banjir.totalPiezo || 0,
        pct_banjir: Math.round(banjir.persenPiezo || 0),
        cnt_tergenang: tergenang.totalPiezo || 0,
        pct_tergenang: Math.round(tergenang.persenPiezo || 0),
        cnt_a_tergenang: aTergenang.totalPiezo || 0,
        pct_a_tergenang: Math.round(aTergenang.persenPiezo || 0),
        cnt_normal: normal.totalPiezo || 0,
        pct_normal: Math.round(normal.persenPiezo || 0),
        cnt_a_kering: aKering.totalPiezo || 0,
        pct_a_kering: Math.round(aKering.persenPiezo || 0),
        cnt_kering: kering.totalPiezo || 0,
        pct_kering: Math.round(kering.persenPiezo || 0),
        cnt_rusak: rusak.totalPiezo || 0,
        pct_rusak: Math.round(rusak.persenPiezo || 0),
        cnt_total: total.totalPiezo || 0,
        percentages,
        avg_tmat: getStat('Rata-Rata'),
        max_tmat: getStat('Max'),
        min_tmat: getStat('Min'),
        std_tmat: getStat('StdDev'),
        total_piezo: getStat('Σ Piezo') || 0,
        total_record: getStat('Σ Record') || 0,
        dominant_status: dominantStatus
    };
}

/**
 * Upsert a parsed record into gis_comparison_data
 */
export async function upsertGisRecord(clientOrPool, record) {
    const q = `
        INSERT INTO gis_comparison_data (
            company_code, company_name, week_id, week_name, formatted_name,
            start_date, end_date, cnt_no_data, pct_no_data, cnt_banjir, pct_banjir,
            cnt_tergenang, pct_tergenang, cnt_a_tergenang, pct_a_tergenang,
            cnt_normal, pct_normal, cnt_a_kering, pct_a_kering, cnt_kering, pct_kering,
            cnt_rusak, pct_rusak, cnt_total, percentages, avg_tmat, max_tmat, min_tmat,
            std_tmat, total_piezo, total_record, dominant_status, updated_at
        ) VALUES (
            $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15,
            $16, $17, $18, $19, $20, $21, $22, $23, $24, $25, $26, $27, $28,
            $29, $30, $31, $32, NOW()
        )
        ON CONFLICT (company_code, week_id) DO UPDATE SET
            company_name = EXCLUDED.company_name,
            week_name = EXCLUDED.week_name,
            formatted_name = EXCLUDED.formatted_name,
            start_date = EXCLUDED.start_date,
            end_date = EXCLUDED.end_date,
            cnt_no_data = EXCLUDED.cnt_no_data,
            pct_no_data = EXCLUDED.pct_no_data,
            cnt_banjir = EXCLUDED.cnt_banjir,
            pct_banjir = EXCLUDED.pct_banjir,
            cnt_tergenang = EXCLUDED.cnt_tergenang,
            pct_tergenang = EXCLUDED.pct_tergenang,
            cnt_a_tergenang = EXCLUDED.cnt_a_tergenang,
            pct_a_tergenang = EXCLUDED.pct_a_tergenang,
            cnt_normal = EXCLUDED.cnt_normal,
            pct_normal = EXCLUDED.pct_normal,
            cnt_a_kering = EXCLUDED.cnt_a_kering,
            pct_a_kering = EXCLUDED.pct_a_kering,
            cnt_kering = EXCLUDED.cnt_kering,
            pct_kering = EXCLUDED.pct_kering,
            cnt_rusak = EXCLUDED.cnt_rusak,
            pct_rusak = EXCLUDED.pct_rusak,
            cnt_total = EXCLUDED.cnt_total,
            percentages = EXCLUDED.percentages,
            avg_tmat = EXCLUDED.avg_tmat,
            max_tmat = EXCLUDED.max_tmat,
            min_tmat = EXCLUDED.min_tmat,
            std_tmat = EXCLUDED.std_tmat,
            total_piezo = EXCLUDED.total_piezo,
            total_record = EXCLUDED.total_record,
            dominant_status = EXCLUDED.dominant_status,
            updated_at = NOW();
    `;
    await clientOrPool.query(q, [
        record.company_code, record.company_name, record.week_id, record.week_name, record.formatted_name,
        record.start_date, record.end_date, record.cnt_no_data, record.pct_no_data, record.cnt_banjir, record.pct_banjir,
        record.cnt_tergenang, record.pct_tergenang, record.cnt_a_tergenang, record.pct_a_tergenang,
        record.cnt_normal, record.pct_normal, record.cnt_a_kering, record.pct_a_kering, record.cnt_kering, record.pct_kering,
        record.cnt_rusak, record.pct_rusak, record.cnt_total, record.percentages, record.avg_tmat, record.max_tmat, record.min_tmat,
        record.std_tmat, record.total_piezo, record.total_record, record.dominant_status
    ]);
}

/**
 * Sync comparison data for all active companies for a given weekId
 */
export async function syncGisComparisonForWeek(weekId, specificCompanies = null) {
    const pool = getPool();
    try {
        let companies = specificCompanies;
        if (!companies || companies.length === 0) {
            const compRes = await pool.query(`SELECT code, name FROM companies WHERE "isActive" = true ORDER BY code ASC`);
            companies = compRes.rows;
        }

        const results = [];
        for (const comp of companies) {
            try {
                const pt = comp.code || comp.id;
                const d = await callGisApi(pt, weekId);
                
                // Element 0: Prev indicators, Element 2: Prev week info
                const prevRecord = parseWeekBlock(d[0], d[2], d[8], true, pt, comp.name || pt);
                // Element 4: Curr indicators, Element 6: Curr week info
                const currRecord = parseWeekBlock(d[4], d[6], d[8], false, pt, comp.name || pt);

                if (prevRecord) {
                    await upsertGisRecord(pool, prevRecord);
                }
                if (currRecord) {
                    await upsertGisRecord(pool, currRecord);
                }

                results.push({ company: pt, success: true, prevWeekId: prevRecord?.week_id, currWeekId: currRecord?.week_id });
            } catch (err) {
                console.error(`Error syncing GIS data for ${comp.code}:`, err.message);
                results.push({ company: comp.code, success: false, error: err.message });
            }
        }
        return { success: true, count: results.filter(r => r.success).length, results };
    } finally {
        await pool.end();
    }
}
