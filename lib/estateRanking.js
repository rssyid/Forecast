/**
 * Pure ranking and percentage helpers for dashboard estate summary tables.
 * Neither helper mutates the input array.
 */

function compareEstateName(a, b) {
    return String(a.estate || '').localeCompare(String(b.estate || ''), undefined, {
        numeric: true,
        sensitivity: 'base',
    });
}

function toFiniteNumber(value) {
    if (value === null || value === undefined || value === '') return null;
    const num = Number(value);
    return Number.isFinite(num) ? num : null;
}

/**
 * Ranks estates by percentage of dry blocks (> 65 cm), descending.
 */
export function rankEstatesByDryness(estates = []) {
    if (!Array.isArray(estates)) return [];

    return estates
        .map((e) => {
            const totalBlock = Math.max(Number(e.total_block) || 0, 0);
            const cntKering = Math.max(Number(e.cnt_kering) || 0, 0);
            const keringPct = totalBlock > 0 ? Math.min((cntKering / totalBlock) * 100, 100) : 0;
            return {
                ...e,
                keringPct,
            };
        })
        .sort((a, b) => {
            if (b.keringPct !== a.keringPct) return b.keringPct - a.keringPct;
            return compareEstateName(a, b);
        });
}

/**
 * Ranks all estates (including 0%) by combined waterlogged (0-40 cm) and flooded (<0 cm) block percentage.
 * Tie-breakers: combinedPct desc -> banjirBarPct desc -> avg_tmat asc -> estate name asc.
 */
export function rankEstatesByWetness(estates = []) {
    if (!Array.isArray(estates)) return [];

    return estates
        .map((e) => {
            const totalBlock = Math.max(Number(e.total_block) || 0, 0);
            const cntTergenang = Math.max(Number(e.cnt_tergenang) || 0, 0);
            const cntBanjir = Math.max(Number(e.cnt_banjir) || 0, 0);
            const hasCombined = e.cnt_tergenang_banjir !== undefined && e.cnt_tergenang_banjir !== null;
            const rawCombined = hasCombined
                ? Math.max(Number(e.cnt_tergenang_banjir) || 0, 0)
                : Math.min(totalBlock, cntTergenang + cntBanjir);
            const cntCombined = totalBlock > 0 ? Math.min(rawCombined, totalBlock) : 0;

            const combinedPct = totalBlock > 0 ? Math.min((cntCombined / totalBlock) * 100, 100) : 0;
            const banjirBarPct = totalBlock > 0 ? Math.min((cntBanjir / totalBlock) * 100, combinedPct) : 0;
            const tergenangBarPct = Math.max(combinedPct - banjirBarPct, 0);

            return {
                ...e,
                totalBlock,
                cntTergenang,
                cntBanjir,
                cntCombined,
                combinedPct,
                banjirBarPct,
                tergenangBarPct,
            };
        })
        .sort((a, b) => {
            if (b.combinedPct !== a.combinedPct) return b.combinedPct - a.combinedPct;
            if (b.banjirBarPct !== a.banjirBarPct) return b.banjirBarPct - a.banjirBarPct;

            const tmatA = toFiniteNumber(a.avg_tmat);
            const tmatB = toFiniteNumber(b.avg_tmat);
            if (tmatA !== null && tmatB !== null && tmatA !== tmatB) {
                return tmatA - tmatB;
            }
            if (tmatA !== null && tmatB === null) return -1;
            if (tmatA === null && tmatB !== null) return 1;

            return compareEstateName(a, b);
        });
}
