/**
 * Pure hydrological regime detection, aggregation, ranking, and narrative builder
 * for week-by-week PZO executive reports.
 * Zero DB/React dependencies so it runs identically on server, client, and tests.
 */

export const EXECUTIVE_PT_ORDER = [
    'PT.THIP',
    'PT.JJP',
    'PT.PTW',
    'PT.SIP',
    'PT.PANPS',
    'PT.SAM',
    'PT.GAN',
    'PT.PLDK',
    'PT.SUMK',
];

export const PZO_CATEGORIES = [
    'Banjir',
    'Tergenang',
    'A Tergenang',
    'Normal',
    'A Kering',
    'Kering',
];

export const FIELD_ACTION_PRESETS = {
    WET: [
        'Saat ini seluruh Kebun sudah mengaktifkan pompa untuk penurunan water level.',
        'Sebagian Kebun terdampak sedang mengoperasikan pompa dan membuka pintu air utama untuk mempercepat drainase.',
    ],
    DRY: [
        'Saat ini seluruh Kebun melakukan penutupan pintu air (water gate) dan retensi kanal untuk menahan penurunan TMAT.',
        'Tim Kebun melakukan pemantauan harian blok kering (merah) serta menyiagakan peralatan pengendalian karhutla.',
    ],
    TRANSITION: [
        'Kebun mengatur buka-tutup pintu air secara selektif untuk menjaga TMAT pada rentang normal (46-60 cm).',
    ],
};

/**
 * Strip "PT." prefix from company code for concise executive reporting.
 * @param {string} code
 * @returns {string}
 */
export function stripPtPrefix(code) {
    return String(code || '').replace(/^PT\.?\s*/i, '').trim();
}

/**
 * Convert "Nov 2026, W3" -> "W3 Nov".
 * Falls back to the original string if it does not match the standard format.
 * @param {string} formattedName
 * @returns {string}
 */
export function formatShortWeekLabel(formattedName) {
    const raw = String(formattedName || '').trim();
    if (!raw) return '';
    const match = raw.match(/^([A-Za-z]+)\s+\d{4},\s*(W\d+)$/i);
    if (match) {
        return `${match[2].toUpperCase()} ${match[1]}`;
    }
    return raw;
}

/**
 * Format an array of strings into natural Indonesian list:
 * ["A"] -> "A"
 * ["A", "B"] -> "A dan B"
 * ["A", "B", "C"] -> "A, B, dan C"
 * @param {string[]} items
 * @returns {string}
 */
export function formatIndonesianList(items = []) {
    const clean = Array.isArray(items) ? items.filter(Boolean).map(String) : [];
    if (clean.length === 0) return '';
    if (clean.length === 1) return clean[0];
    if (clean.length === 2) return `${clean[0]} dan ${clean[1]}`;
    return `${clean.slice(0, -1).join(', ')}, dan ${clean[clean.length - 1]}`;
}

/**
 * Sort company rows canonically: EXECUTIVE_PT_ORDER first, then remaining alphabetically.
 * Never mutates the input array.
 * @template T
 * @param {T[]} companies
 * @returns {T[]}
 */
export function sortCompaniesCanonical(companies = []) {
    if (!Array.isArray(companies)) return [];
    const orderMap = new Map(EXECUTIVE_PT_ORDER.map((code, idx) => [code, idx]));
    return [...companies].sort((a, b) => {
        const codeA = a?.company_code || a?.companyCode || '';
        const codeB = b?.company_code || b?.companyCode || '';
        const idxA = orderMap.has(codeA) ? orderMap.get(codeA) : Number.MAX_SAFE_INTEGER;
        const idxB = orderMap.has(codeB) ? orderMap.get(codeB) : Number.MAX_SAFE_INTEGER;
        if (idxA !== idxB) return idxA - idxB;
        return String(codeA).localeCompare(String(codeB));
    });
}

function toNum(v, fallback = 0) {
    if (v === null || v === undefined || v === '') return fallback;
    const n = Number(v);
    return Number.isFinite(n) ? n : fallback;
}

function toNullableNum(v) {
    if (v === null || v === undefined || v === '') return null;
    const n = Number(v);
    return Number.isFinite(n) ? n : null;
}

function normalizeCompanyRow(row) {
    const code = row.company_code || row.companyCode || '';
    const pctArr = Array.isArray(row.percentages) ? row.percentages : [];

    const pctBanjir = toNum(row.pct_banjir, toNum(pctArr[0], 0));
    const pctTergenang = toNum(row.pct_tergenang, toNum(pctArr[1], 0));
    const pctATergenang = toNum(row.pct_a_tergenang, toNum(pctArr[2], 0));
    const pctNormal = toNum(row.pct_normal, toNum(pctArr[3], 0));
    const pctAKering = toNum(row.pct_a_kering, toNum(pctArr[4], 0));
    const pctKering = toNum(row.pct_kering, toNum(pctArr[5], 0));

    const cntBanjir = toNum(row.cnt_banjir, 0);
    const cntTergenang = toNum(row.cnt_tergenang, 0);
    const cntATergenang = toNum(row.cnt_a_tergenang, 0);
    const cntNormal = toNum(row.cnt_normal, 0);
    const cntAKering = toNum(row.cnt_a_kering, 0);
    const cntKering = toNum(row.cnt_kering, 0);

    const cntValid = cntBanjir + cntTergenang + cntATergenang + cntNormal + cntAKering + cntKering;
    const cntTotal = Math.max(toNum(row.cnt_total, 0), cntValid);

    const pctSum = pctBanjir + pctTergenang + pctATergenang + pctNormal + pctAKering + pctKering;
    const hasData = cntValid > 0 || cntTotal > 0 || pctSum > 0;

    let dominantStatus = row.dominant_status || row.dominantStatus || 'No Data';
    if ((!dominantStatus || dominantStatus === 'No Data') && pctSum > 0) {
        const vals = [pctBanjir, pctTergenang, pctATergenang, pctNormal, pctAKering, pctKering];
        const maxVal = Math.max(...vals);
        if (maxVal > 0) dominantStatus = PZO_CATEGORIES[vals.indexOf(maxVal)];
    }

    const avgTmat = toNullableNum(row.avg_tmat);
    const ch1w = toNum(row.ch_1w ?? row.rainfall_1w, 0);
    const hh1w = toNum(row.hh_1w ?? row.hari_hujan_1w, 0);
    const ch3w = toNum(row.ch_3w ?? row.rainfall_3w, 0);
    const hh3w = toNum(row.hh_3w ?? row.hari_hujan_3w, 0);

    return {
        ...row,
        company_code: code,
        short_name: stripPtPrefix(code),
        company_name: row.company_name || row.companyName || code,
        pct_banjir: pctBanjir,
        pct_tergenang: pctTergenang,
        pct_a_tergenang: pctATergenang,
        pct_normal: pctNormal,
        pct_a_kering: pctAKering,
        pct_kering: pctKering,
        pct_wet: pctBanjir + pctTergenang,
        pct_dry: pctKering + pctAKering,
        cnt_banjir: cntBanjir,
        cnt_tergenang: cntTergenang,
        cnt_a_tergenang: cntATergenang,
        cnt_normal: cntNormal,
        cnt_a_kering: cntAKering,
        cnt_kering: cntKering,
        cnt_valid: cntValid,
        cnt_total: cntTotal,
        has_data: hasData,
        dominant_status: dominantStatus,
        avg_tmat: avgTmat,
        ch_1w: Number(ch1w.toFixed(1)),
        hh_1w: hh1w,
        ch_3w: Number(ch3w.toFixed(1)),
        hh_3w: hh3w,
    };
}

/**
 * Aggregate weekly metrics across selected companies using either:
 * - 'weighted': weighted by valid PZO piezometer/block counts
 * - 'company_avg': arithmetic average of each company's percentage
 * Returns both methods' metrics alongside the active one.
 */
export function aggregateWeekMetrics(companyRows = [], { method = 'weighted' } = {}) {
    const normalizedAll = sortCompaniesCanonical(companyRows).map(normalizeCompanyRow);
    const validRows = normalizedAll.filter((r) => r.has_data);
    const nValid = validRows.length;

    const totalCntValid = validRows.reduce((s, r) => s + r.cnt_valid, 0);
    const canWeightByCounts = totalCntValid > 0;

    const calcWeighted = () => {
        if (nValid === 0) {
            return {
                pctBanjir: 0, pctTergenang: 0, pctATergenang: 0,
                pctNormal: 0, pctAKering: 0, pctKering: 0,
                pctWet: 0, pctDry: 0, avgTmat: null,
            };
        }
        if (!canWeightByCounts) {
            return calcCompanyAvg();
        }
        const sumBanjir = validRows.reduce((s, r) => s + r.cnt_banjir, 0);
        const sumTergenang = validRows.reduce((s, r) => s + r.cnt_tergenang, 0);
        const sumATergenang = validRows.reduce((s, r) => s + r.cnt_a_tergenang, 0);
        const sumNormal = validRows.reduce((s, r) => s + r.cnt_normal, 0);
        const sumAKering = validRows.reduce((s, r) => s + r.cnt_a_kering, 0);
        const sumKering = validRows.reduce((s, r) => s + r.cnt_kering, 0);

        const pctBanjir = Math.round((sumBanjir / totalCntValid) * 100);
        const pctTergenang = Math.round((sumTergenang / totalCntValid) * 100);
        const pctATergenang = Math.round((sumATergenang / totalCntValid) * 100);
        const pctNormal = Math.round((sumNormal / totalCntValid) * 100);
        const pctAKering = Math.round((sumAKering / totalCntValid) * 100);
        const pctKering = Math.round((sumKering / totalCntValid) * 100);

        const tmatRows = validRows.filter((r) => r.avg_tmat !== null && r.cnt_valid > 0);
        const tmatWeight = tmatRows.reduce((s, r) => s + r.cnt_valid, 0);
        const avgTmat = tmatWeight > 0
            ? Number((tmatRows.reduce((s, r) => s + r.avg_tmat * r.cnt_valid, 0) / tmatWeight).toFixed(1))
            : null;

        return {
            pctBanjir,
            pctTergenang,
            pctATergenang,
            pctNormal,
            pctAKering,
            pctKering,
            pctWet: Math.round(((sumBanjir + sumTergenang) / totalCntValid) * 100),
            pctDry: Math.round(((sumKering + sumAKering) / totalCntValid) * 100),
            avgTmat,
        };
    };

    const calcCompanyAvg = () => {
        if (nValid === 0) {
            return {
                pctBanjir: 0, pctTergenang: 0, pctATergenang: 0,
                pctNormal: 0, pctAKering: 0, pctKering: 0,
                pctWet: 0, pctDry: 0, avgTmat: null,
            };
        }
        const avg = (fn) => Math.round(validRows.reduce((s, r) => s + fn(r), 0) / nValid);
        const tmatRows = validRows.filter((r) => r.avg_tmat !== null);
        const avgTmat = tmatRows.length > 0
            ? Number((tmatRows.reduce((s, r) => s + r.avg_tmat, 0) / tmatRows.length).toFixed(1))
            : null;

        const pctBanjir = avg((r) => r.pct_banjir);
        const pctTergenang = avg((r) => r.pct_tergenang);
        const pctATergenang = avg((r) => r.pct_a_tergenang);
        const pctNormal = avg((r) => r.pct_normal);
        const pctAKering = avg((r) => r.pct_a_kering);
        const pctKering = avg((r) => r.pct_kering);

        return {
            pctBanjir,
            pctTergenang,
            pctATergenang,
            pctNormal,
            pctAKering,
            pctKering,
            pctWet: avg((r) => r.pct_banjir + r.pct_tergenang),
            pctDry: avg((r) => r.pct_kering + r.pct_a_kering),
            avgTmat,
        };
    };

    const weightedMetrics = calcWeighted();
    const companyAvgMetrics = calcCompanyAvg();
    const activeMetrics = method === 'company_avg' ? companyAvgMetrics : weightedMetrics;

    const dominantCounts = {
        Banjir: 0,
        Tergenang: 0,
        'A Tergenang': 0,
        Normal: 0,
        'A Kering': 0,
        Kering: 0,
    };
    const dominantCompanies = {
        Banjir: [],
        Tergenang: [],
        'A Tergenang': [],
        Normal: [],
        'A Kering': [],
        Kering: [],
    };

    for (const row of validRows) {
        if (dominantCounts[row.dominant_status] !== undefined) {
            dominantCounts[row.dominant_status] += 1;
            dominantCompanies[row.dominant_status].push(row.short_name);
        }
    }

    const rainPool = nValid > 0 ? validRows : normalizedAll;
    const rainCount = rainPool.length || 1;
    const avgCh1w = Number((rainPool.reduce((s, r) => s + r.ch_1w, 0) / rainCount).toFixed(1));
    const avgCh3w = Number((rainPool.reduce((s, r) => s + r.ch_3w, 0) / rainCount).toFixed(1));

    const ptCh3wAbove150 = rainPool.filter((r) => r.ch_3w >= 150).map((r) => r.short_name);
    const ptCh3wBelow60 = rainPool.filter((r) => r.ch_3w < 60).map((r) => r.short_name);

    const byCh3wDesc = [...rainPool].sort((a, b) => b.ch_3w - a.ch_3w);
    const wettestCh3w = byCh3wDesc[0]
        ? { code: byCh3wDesc[0].company_code, shortName: byCh3wDesc[0].short_name, ch3w: byCh3wDesc[0].ch_3w }
        : null;
    const driestCh3w = byCh3wDesc.length > 0
        ? {
            code: byCh3wDesc[byCh3wDesc.length - 1].company_code,
            shortName: byCh3wDesc[byCh3wDesc.length - 1].short_name,
            ch3w: byCh3wDesc[byCh3wDesc.length - 1].ch_3w,
        }
        : null;

    return {
        ...activeMetrics,
        method,
        weightedMetrics,
        companyAvgMetrics,
        dominantCounts,
        dominantCompanies,
        avgCh1w,
        avgCh3w,
        ptCh3wAbove150,
        ptCh3wBelow60,
        wettestCh3w,
        driestCh3w,
        totalCompanies: normalizedAll.length,
        totalValidCompanies: nValid,
        totalPiezoPoints: totalCntValid,
    };
}

/**
 * Detect hydrological regime strictly from actual PZO and rainfall metrics.
 */
export function detectHydrologicalRegime(summary, prevSummary = null) {
    const n = Math.max(summary?.totalValidCompanies || 0, 1);
    const domWet = (summary?.dominantCounts?.Tergenang || 0) + (summary?.dominantCounts?.Banjir || 0);
    const domDry = (summary?.dominantCounts?.Kering || 0) + (summary?.dominantCounts?.['A Kering'] || 0);

    const pctWet = summary?.pctWet || 0;
    const pctDry = summary?.pctDry || 0;
    const pctKering = summary?.pctKering || 0;
    const avgCh3w = summary?.avgCh3w || 0;
    const avgTmat = summary?.avgTmat;

    let regime = 'TRANSITION';
    if (
        pctWet > pctDry &&
        (pctWet >= 25 || domWet >= Math.ceil(n / 3) || (avgCh3w >= 150 && pctWet >= 15))
    ) {
        regime = 'WET';
    } else if (
        pctDry > pctWet &&
        (pctKering >= 20 || domDry >= Math.ceil(n / 3) || (avgTmat !== null && avgTmat > 65 && avgCh3w < 60))
    ) {
        regime = 'DRY';
    }

    let trendDirection = 'STABIL';
    if (prevSummary && prevSummary.totalValidCompanies > 0) {
        const wetDiff = pctWet - (prevSummary.pctWet || 0);
        const dryDiff = pctDry - (prevSummary.pctDry || 0);
        if (wetDiff >= 3 || dryDiff <= -3) {
            trendDirection = 'MENUJU_BASAH';
        } else if (dryDiff >= 3 || wetDiff <= -3) {
            trendDirection = 'MENUJU_KERING';
        }
    }

    if (regime === 'WET') {
        return {
            regime,
            regimeLabel: 'Periode Basah: Fokus Tergenang & Banjir',
            shortLabel: 'Periode Basah',
            concernTitle: 'Fokus Tergenang & Banjir',
            trendDirection,
            primaryMetricKey: 'pctTergenang',
            secondaryMetricKey: 'pctBanjir',
        };
    }
    if (regime === 'DRY') {
        return {
            regime,
            regimeLabel: 'Periode Kering: Fokus Piezometer Merah (>65 cm)',
            shortLabel: 'Periode Kering',
            concernTitle: 'Fokus Piezometer Merah / Kering',
            trendDirection,
            primaryMetricKey: 'pctKering',
            secondaryMetricKey: 'pctAKering',
        };
    }
    return {
        regime,
        regimeLabel: 'Periode Transisi: Fokus Stabilitas Normal',
        shortLabel: 'Periode Transisi',
        concernTitle: 'Fokus Stabilitas Normal & Arah Tren',
        trendDirection,
        primaryMetricKey: 'pctNormal',
        secondaryMetricKey: pctWet >= pctDry ? 'pctWet' : 'pctDry',
    };
}

/**
 * Rank companies by the concern most relevant to the active hydrological regime.
 * Does not mutate input.
 */
export function rankCompaniesByRegime(companyRows = [], regime = 'TRANSITION') {
    const orderMap = new Map(EXECUTIVE_PT_ORDER.map((code, idx) => [code, idx]));
    const canonicalCmp = (a, b) => {
        const idxA = orderMap.has(a.company_code) ? orderMap.get(a.company_code) : Number.MAX_SAFE_INTEGER;
        const idxB = orderMap.has(b.company_code) ? orderMap.get(b.company_code) : Number.MAX_SAFE_INTEGER;
        if (idxA !== idxB) return idxA - idxB;
        return String(a.company_code).localeCompare(String(b.company_code));
    };

    const normalized = companyRows.map(normalizeCompanyRow);
    return normalized.sort((a, b) => {
        if (a.has_data !== b.has_data) return a.has_data ? -1 : 1;

        if (regime === 'WET') {
            if (b.pct_wet !== a.pct_wet) return b.pct_wet - a.pct_wet;
            if (b.pct_banjir !== a.pct_banjir) return b.pct_banjir - a.pct_banjir;
            if (b.ch_3w !== a.ch_3w) return b.ch_3w - a.ch_3w;
            return canonicalCmp(a, b);
        }

        if (regime === 'DRY') {
            if (b.pct_kering !== a.pct_kering) return b.pct_kering - a.pct_kering;
            if (b.pct_dry !== a.pct_dry) return b.pct_dry - a.pct_dry;
            const tmatA = a.avg_tmat ?? -Infinity;
            const tmatB = b.avg_tmat ?? -Infinity;
            if (tmatB !== tmatA) return tmatB - tmatA;
            if (a.ch_3w !== b.ch_3w) return a.ch_3w - b.ch_3w;
            return canonicalCmp(a, b);
        }

        // TRANSITION: lowest Normal % (most attention needed) first
        if (a.pct_normal !== b.pct_normal) return a.pct_normal - b.pct_normal;
        const extA = Math.max(a.pct_wet, a.pct_dry);
        const extB = Math.max(b.pct_wet, b.pct_dry);
        if (extB !== extA) return extB - extA;
        return canonicalCmp(a, b);
    });
}

function appendPeriod(text) {
    const t = String(text || '').trim();
    if (!t) return '';
    return /[.!?]$/.test(t) ? t : `${t}.`;
}

/**
 * Generate a crisp, zero-hallucination Indonesian executive narrative.
 * Strictly avoids em dashes and never invents field action claims.
 */
export function generateWeeklyNarrative({
    weekFormattedName,
    summary,
    prevSummary = null,
    regimeInfo,
    companies = [],
    fieldActionNote = '',
}) {
    if (!summary || summary.totalValidCompanies === 0) {
        return 'Belum tersedia data pemantauan PZO yang valid untuk menyusun narasi pada minggu dan cakupan PT yang dipilih.';
    }

    const shortWeek = formatShortWeekLabel(weekFormattedName);
    const n = summary.totalValidCompanies;
    const regime = regimeInfo?.regime || 'TRANSITION';
    const validCompanies = companies.map(normalizeCompanyRow).filter((c) => c.has_data);
    const canonicalValid = sortCompaniesCanonical(validCompanies);

    const sentences = [];

    if (regime === 'WET') {
        const domBanjirList = summary.dominantCompanies?.Banjir || [];
        const domTergenangList = summary.dominantCompanies?.Tergenang || [];
        const domWetCombined = canonicalValid
            .filter((c) => c.dominant_status === 'Tergenang' || c.dominant_status === 'Banjir')
            .map((c) => c.short_name);

        let sentence1 = '';
        if (domTergenangList.length >= domBanjirList.length && domTergenangList.length > 0) {
            sentence1 = `Secara umum kondisi PZO pada ${shortWeek}, kategori Tergenang (${summary.pctTergenang}%) menjadi yang paling sering mendominasi (muncul di ${domTergenangList.length} dari ${n} Estate: ${formatIndonesianList(domTergenangList)})`;
        } else if (domWetCombined.length > 0) {
            sentence1 = `Secara umum kondisi PZO pada ${shortWeek}, kategori Banjir (${summary.pctBanjir}%) dan Tergenang (${summary.pctTergenang}%) mendominasi di ${domWetCombined.length} dari ${n} Estate (${formatIndonesianList(domWetCombined)})`;
        } else {
            const topWet = [...canonicalValid].sort((a, b) => b.pct_wet - a.pct_wet).slice(0, 3).map((c) => `${c.short_name} ${c.pct_wet}%`);
            sentence1 = `Secara umum kondisi PZO pada ${shortWeek}, proporsi Tergenang tercatat ${summary.pctTergenang}% (tertinggi di ${formatIndonesianList(topWet)})`;
        }

        const highFlood = [...canonicalValid]
            .filter((c) => c.pct_banjir >= 5)
            .sort((a, b) => b.pct_banjir - a.pct_banjir)
            .slice(0, 3)
            .map((c) => `${c.short_name} ${c.pct_banjir}%`);

        if (summary.pctBanjir > 0 || highFlood.length > 0) {
            const floodDetail = highFlood.length > 0 ? `, tertinggi di ${formatIndonesianList(highFlood)}` : '';
            sentence1 += `, disertai kategori Banjir ${summary.pctBanjir}%${floodDetail}`;
        }

        if (prevSummary && prevSummary.totalValidCompanies > 0) {
            const diffWet = summary.pctWet - prevSummary.pctWet;
            if (diffWet > 0) {
                sentence1 += `, meningkat ${diffWet}% pada total area basah dibanding minggu sebelumnya`;
            } else if (diffWet < 0) {
                sentence1 += `, menurun ${Math.abs(diffWet)}% pada total area basah dibanding minggu sebelumnya`;
            }
        }
        sentences.push(`${sentence1}.`);

        // Macro CH 3 weeks
        const above150Count = summary.ptCh3wAbove150?.length || 0;
        if (above150Count > 0) {
            const topRain = summary.wettestCh3w
                ? `, tertinggi ${summary.wettestCh3w.shortName} ${Math.round(summary.wettestCh3w.ch3w)} mm`
                : '';
            sentences.push(
                `Secara makro, kondisi ini dipengaruhi akumulasi CH selama 3 minggu terakhir rata-rata ${Math.round(summary.avgCh3w)} mm (${above150Count} dari ${n} Estate di atas 150 mm${topRain}).`
            );
        } else {
            sentences.push(
                `Secara makro, akumulasi CH selama 3 minggu terakhir tercatat rata-rata ${Math.round(summary.avgCh3w)} mm (CH minggu ini rata-rata ${Math.round(summary.avgCh1w)} mm).`
            );
        }
    } else if (regime === 'DRY') {
        const domKeringList = summary.dominantCompanies?.Kering || [];
        const domDryCombined = canonicalValid
            .filter((c) => c.dominant_status === 'Kering' || c.dominant_status === 'A Kering')
            .map((c) => c.short_name);

        let sentence1 = `Secara umum kondisi PZO pada ${shortWeek}, kategori Kering/Merah (${summary.pctKering}%) menjadi perhatian utama`;
        if (domKeringList.length > 0) {
            sentence1 += ` (mendominasi di ${domKeringList.length} dari ${n} Estate: ${formatIndonesianList(domKeringList)})`;
        } else if (domDryCombined.length > 0) {
            sentence1 += ` (kondisi kering mendominasi di ${domDryCombined.length} dari ${n} Estate: ${formatIndonesianList(domDryCombined)})`;
        } else {
            const topDry = [...canonicalValid].sort((a, b) => b.pct_kering - a.pct_kering).slice(0, 3).map((c) => `${c.short_name} ${c.pct_kering}%`);
            sentence1 += ` (tertinggi di ${formatIndonesianList(topDry)})`;
        }

        if (summary.avgTmat !== null) {
            sentence1 += ` dengan rata-rata TMAT ${summary.avgTmat} cm`;
        }
        if (summary.pctAKering >= 10) {
            sentence1 += ` serta kategori Agak Kering ${summary.pctAKering}%`;
        }
        if (prevSummary && prevSummary.totalValidCompanies > 0) {
            const diffKering = summary.pctKering - prevSummary.pctKering;
            if (diffKering > 0) {
                sentence1 += `, naik ${diffKering}% dibanding minggu lalu`;
            } else if (diffKering < 0) {
                sentence1 += `, turun ${Math.abs(diffKering)}% dibanding minggu lalu`;
            }
        }
        sentences.push(`${sentence1}.`);

        const below60Count = summary.ptCh3wBelow60?.length || 0;
        if (below60Count > 0 || summary.avgCh3w < 60) {
            const dryRain = summary.driestCh3w
                ? `, terendah ${summary.driestCh3w.shortName} ${Math.round(summary.driestCh3w.ch3w)} mm`
                : '';
            sentences.push(
                `Secara makro, kondisi ini dipengaruhi rendahnya akumulasi CH selama 3 minggu terakhir rata-rata ${Math.round(summary.avgCh3w)} mm (${below60Count} dari ${n} Estate di bawah 60 mm${dryRain}) sehingga muka air tanah mengalami penurunan.`
            );
        } else {
            sentences.push(
                `Secara makro, akumulasi CH selama 3 minggu terakhir tercatat rata-rata ${Math.round(summary.avgCh3w)} mm (CH minggu ini rata-rata ${Math.round(summary.avgCh1w)} mm) dan belum cukup memulihkan kedalaman TMAT.`
            );
        }
    } else {
        const domNormalList = summary.dominantCompanies?.Normal || [];
        const wetHigher = summary.pctWet >= summary.pctDry;
        const secondaryLabel = wetHigher ? 'Tergenang dan Banjir' : 'Kering dan Agak Kering';
        const secondaryPct = wetHigher ? summary.pctWet : summary.pctDry;

        let sentence1 = `Secara umum kondisi PZO pada ${shortWeek}, kategori Normal (${summary.pctNormal}%) mendominasi`;
        if (domNormalList.length > 0) {
            sentence1 += ` (muncul di ${domNormalList.length} dari ${n} Estate: ${formatIndonesianList(domNormalList)})`;
        }
        sentence1 += `, dengan proporsi ${secondaryLabel} sebesar ${secondaryPct}%`;
        if (summary.avgTmat !== null) {
            sentence1 += ` dan rata-rata TMAT ${summary.avgTmat} cm`;
        }
        sentences.push(`${sentence1}.`);

        let trendClause = 'cenderung stabil';
        if (regimeInfo?.trendDirection === 'MENUJU_BASAH') {
            trendClause = 'bergeser menuju lebih basah seiring peningkatan curah hujan';
        } else if (regimeInfo?.trendDirection === 'MENUJU_KERING') {
            trendClause = 'bergeser menuju lebih kering sehingga perlu antisipasi penurunan TMAT';
        }
        sentences.push(
            `Secara makro, akumulasi CH selama 3 minggu terakhir berada di rata-rata ${Math.round(summary.avgCh3w)} mm dengan tren kondisi ${trendClause}.`
        );
    }

    const cleanNote = String(fieldActionNote || '').replace(/—/g, ', ').trim();
    if (cleanNote) {
        sentences.push(appendPeriod(cleanNote));
    }

    return sentences.join(' ').replace(/—/g, ', ');
}

/**
 * Orchestrate complete weekly report payload for a given week and company rows.
 */
export function buildWeeklyReport({
    weekMeta,
    companyRows = [],
    prevCompanyRows = null,
    method = 'weighted',
    fieldActionNote = '',
    customNarrative = null,
    updatedAt = null,
}) {
    const normalizedCompanies = sortCompaniesCanonical(companyRows).map(normalizeCompanyRow);
    const prevNormalized = Array.isArray(prevCompanyRows)
        ? sortCompaniesCanonical(prevCompanyRows).map(normalizeCompanyRow)
        : null;

    const summary = aggregateWeekMetrics(normalizedCompanies, { method });
    const prevSummary = prevNormalized ? aggregateWeekMetrics(prevNormalized, { method }) : null;
    const regimeInfo = detectHydrologicalRegime(summary, prevSummary);
    const rankedCompanies = rankCompaniesByRegime(normalizedCompanies, regimeInfo.regime);

    const prevMap = new Map((prevNormalized || []).map((p) => [p.company_code, p]));
    const companiesWithDeltas = rankedCompanies.map((c) => {
        const prev = prevMap.get(c.company_code);
        const deltaTmat =
            c.avg_tmat !== null && prev && prev.avg_tmat !== null
                ? Number((c.avg_tmat - prev.avg_tmat).toFixed(1))
                : null;
        return {
            ...c,
            prev_pct_banjir: prev ? prev.pct_banjir : null,
            prev_pct_tergenang: prev ? prev.pct_tergenang : null,
            prev_pct_normal: prev ? prev.pct_normal : null,
            prev_pct_kering: prev ? prev.pct_kering : null,
            prev_pct_wet: prev ? prev.pct_wet : null,
            prev_pct_dry: prev ? prev.pct_dry : null,
            prev_avg_tmat: prev ? prev.avg_tmat : null,
            delta_tmat: deltaTmat,
        };
    });

    const deltas = prevSummary && prevSummary.totalValidCompanies > 0
        ? {
            pctBanjir: summary.pctBanjir - prevSummary.pctBanjir,
            pctTergenang: summary.pctTergenang - prevSummary.pctTergenang,
            pctWet: summary.pctWet - prevSummary.pctWet,
            pctNormal: summary.pctNormal - prevSummary.pctNormal,
            pctAKering: summary.pctAKering - prevSummary.pctAKering,
            pctKering: summary.pctKering - prevSummary.pctKering,
            pctDry: summary.pctDry - prevSummary.pctDry,
            avgTmat:
                summary.avgTmat !== null && prevSummary.avgTmat !== null
                    ? Number((summary.avgTmat - prevSummary.avgTmat).toFixed(1))
                    : null,
            avgCh1w: Number((summary.avgCh1w - prevSummary.avgCh1w).toFixed(1)),
            avgCh3w: Number((summary.avgCh3w - prevSummary.avgCh3w).toFixed(1)),
        }
        : null;

    const autoNarrative = generateWeeklyNarrative({
        weekFormattedName: weekMeta?.formatted_name || '',
        summary,
        prevSummary,
        regimeInfo,
        companies: normalizedCompanies,
        fieldActionNote,
    });

    const trimmedCustom = typeof customNarrative === 'string' && customNarrative.trim()
        ? customNarrative.trim().replace(/—/g, ', ')
        : null;

    return {
        week: {
            week_id: weekMeta?.week_id ?? weekMeta?.gis_week_id ?? null,
            formatted_name: weekMeta?.formatted_name || '',
            short_label: formatShortWeekLabel(weekMeta?.formatted_name || ''),
            start_date: weekMeta?.start_date || null,
            end_date: weekMeta?.end_date || null,
        },
        regime: regimeInfo.regime,
        regimeInfo,
        method,
        summary,
        prevSummary,
        deltas,
        autoNarrative,
        effectiveNarrative: trimmedCustom || autoNarrative,
        isCustomNarrative: Boolean(trimmedCustom),
        fieldActionNote: String(fieldActionNote || ''),
        updatedAt,
        companies: companiesWithDeltas,
    };
}
