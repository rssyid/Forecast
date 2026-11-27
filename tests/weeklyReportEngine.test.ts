import { describe, expect, it } from 'vitest';
import {
    EXECUTIVE_PT_ORDER,
    aggregateWeekMetrics,
    buildWeeklyReport,
    detectHydrologicalRegime,
    formatIndonesianList,
    formatShortWeekLabel,
    rankCompaniesByRegime,
    stripPtPrefix,
} from '../lib/weeklyReportEngine.js';

function makeNovW3Rows() {
    return [
        { company_code: 'PT.THIP', cnt_banjir: 3, cnt_tergenang: 783, cnt_a_tergenang: 238, cnt_normal: 271, cnt_a_kering: 6, cnt_kering: 1, cnt_total: 1302, pct_banjir: 0, pct_tergenang: 60, pct_a_tergenang: 18, pct_normal: 21, pct_a_kering: 0, pct_kering: 0, avg_tmat: 38, dominant_status: 'Tergenang', ch_1w: 62.5, ch_3w: 169.4 },
        { company_code: 'PT.JJP', cnt_banjir: 1, cnt_tergenang: 319, cnt_a_tergenang: 109, cnt_normal: 171, cnt_a_kering: 0, cnt_kering: 0, cnt_total: 600, pct_banjir: 0, pct_tergenang: 53, pct_a_tergenang: 18, pct_normal: 28, pct_a_kering: 0, pct_kering: 0, avg_tmat: 50, dominant_status: 'Tergenang', ch_1w: 58.0, ch_3w: 208.0 },
        { company_code: 'PT.PTW', cnt_banjir: 12, cnt_tergenang: 118, cnt_a_tergenang: 31, cnt_normal: 20, cnt_a_kering: 0, cnt_kering: 0, cnt_total: 181, pct_banjir: 7, pct_tergenang: 65, pct_a_tergenang: 17, pct_normal: 11, pct_a_kering: 0, pct_kering: 0, avg_tmat: 32, dominant_status: 'Tergenang', ch_1w: 112.0, ch_3w: 354.5 },
        { company_code: 'PT.SIP', cnt_banjir: 0, cnt_tergenang: 0, cnt_a_tergenang: 0, cnt_normal: 30, cnt_a_kering: 0, cnt_kering: 0, cnt_total: 30, pct_banjir: 0, pct_tergenang: 0, pct_a_tergenang: 0, pct_normal: 100, pct_a_kering: 0, pct_kering: 0, avg_tmat: 57, dominant_status: 'Normal', ch_1w: 15.0, ch_3w: 51.0 },
        { company_code: 'PT.PANPS', cnt_banjir: 0, cnt_tergenang: 41, cnt_a_tergenang: 3, cnt_normal: 11, cnt_a_kering: 0, cnt_kering: 0, cnt_total: 55, pct_banjir: 0, pct_tergenang: 75, pct_a_tergenang: 5, pct_normal: 20, pct_a_kering: 0, pct_kering: 0, avg_tmat: 42, dominant_status: 'Tergenang', ch_1w: 75.0, ch_3w: 235.0 },
        { company_code: 'PT.SAM', cnt_banjir: 0, cnt_tergenang: 19, cnt_a_tergenang: 27, cnt_normal: 31, cnt_a_kering: 0, cnt_kering: 0, cnt_total: 77, pct_banjir: 0, pct_tergenang: 25, pct_a_tergenang: 35, pct_normal: 40, pct_a_kering: 0, pct_kering: 0, avg_tmat: 52, dominant_status: 'Normal', ch_1w: 84.0, ch_3w: 249.0 },
        { company_code: 'PT.GAN', cnt_banjir: 7, cnt_tergenang: 94, cnt_a_tergenang: 45, cnt_normal: 138, cnt_a_kering: 44, cnt_kering: 61, cnt_total: 389, pct_banjir: 2, pct_tergenang: 24, pct_a_tergenang: 12, pct_normal: 35, pct_a_kering: 11, pct_kering: 16, avg_tmat: 69, dominant_status: 'Normal', ch_1w: 98.0, ch_3w: 292.7 },
        { company_code: 'PT.PLDK', cnt_banjir: 0, cnt_tergenang: 48, cnt_a_tergenang: 3, cnt_normal: 19, cnt_a_kering: 2, cnt_kering: 0, cnt_total: 72, pct_banjir: 0, pct_tergenang: 67, pct_a_tergenang: 4, pct_normal: 26, pct_a_kering: 3, pct_kering: 0, avg_tmat: 45, dominant_status: 'Tergenang', ch_1w: 110.0, ch_3w: 320.0 },
        { company_code: 'PT.SUMK', cnt_banjir: 10, cnt_tergenang: 22, cnt_a_tergenang: 0, cnt_normal: 0, cnt_a_kering: 0, cnt_kering: 0, cnt_total: 32, pct_banjir: 31, pct_tergenang: 69, pct_a_tergenang: 0, pct_normal: 0, pct_a_kering: 0, pct_kering: 0, avg_tmat: 20, dominant_status: 'Tergenang', ch_1w: 145.0, ch_3w: 466.0 },
    ];
}

function makeSepW2DryRows() {
    return [
        { company_code: 'PT.THIP', cnt_banjir: 0, cnt_tergenang: 0, cnt_a_tergenang: 0, cnt_normal: 100, cnt_a_kering: 120, cnt_kering: 1082, cnt_total: 1302, pct_banjir: 0, pct_tergenang: 0, pct_a_tergenang: 0, pct_normal: 8, pct_a_kering: 9, pct_kering: 83, avg_tmat: 94, dominant_status: 'Kering', ch_1w: 0, ch_3w: 12 },
        { company_code: 'PT.JJP', cnt_banjir: 0, cnt_tergenang: 5, cnt_a_tergenang: 3, cnt_normal: 592, cnt_a_kering: 0, cnt_kering: 0, cnt_total: 600, pct_banjir: 0, pct_tergenang: 1, pct_a_tergenang: 1, pct_normal: 99, pct_a_kering: 0, pct_kering: 0, avg_tmat: 52, dominant_status: 'Normal', ch_1w: 4, ch_3w: 35 },
        { company_code: 'PT.PTW', cnt_banjir: 0, cnt_tergenang: 0, cnt_a_tergenang: 0, cnt_normal: 4, cnt_a_kering: 36, cnt_kering: 141, cnt_total: 181, pct_banjir: 0, pct_tergenang: 0, pct_a_tergenang: 0, pct_normal: 2, pct_a_kering: 20, pct_kering: 78, avg_tmat: 72, dominant_status: 'Kering', ch_1w: 0, ch_3w: 18 },
        { company_code: 'PT.SIP', cnt_banjir: 0, cnt_tergenang: 0, cnt_a_tergenang: 0, cnt_normal: 30, cnt_a_kering: 0, cnt_kering: 0, cnt_total: 30, pct_banjir: 0, pct_tergenang: 0, pct_a_tergenang: 0, pct_normal: 100, pct_a_kering: 0, pct_kering: 0, avg_tmat: 57, dominant_status: 'Normal', ch_1w: 0, ch_3w: 20 },
        { company_code: 'PT.PANPS', cnt_banjir: 0, cnt_tergenang: 0, cnt_a_tergenang: 0, cnt_normal: 0, cnt_a_kering: 4, cnt_kering: 51, cnt_total: 55, pct_banjir: 0, pct_tergenang: 0, pct_a_tergenang: 0, pct_normal: 0, pct_a_kering: 7, pct_kering: 93, avg_tmat: 90, dominant_status: 'Kering', ch_1w: 0, ch_3w: 8 },
        { company_code: 'PT.SAM', cnt_banjir: 0, cnt_tergenang: 0, cnt_a_tergenang: 0, cnt_normal: 3, cnt_a_kering: 2, cnt_kering: 72, cnt_total: 77, pct_banjir: 0, pct_tergenang: 0, pct_a_tergenang: 0, pct_normal: 4, pct_a_kering: 3, pct_kering: 94, avg_tmat: 79, dominant_status: 'Kering', ch_1w: 0, ch_3w: 5 },
        { company_code: 'PT.GAN', cnt_banjir: 1, cnt_tergenang: 1, cnt_a_tergenang: 2, cnt_normal: 8, cnt_a_kering: 6, cnt_kering: 371, cnt_total: 389, pct_banjir: 0, pct_tergenang: 0, pct_a_tergenang: 1, pct_normal: 2, pct_a_kering: 2, pct_kering: 95, avg_tmat: 100, dominant_status: 'Kering', ch_1w: 0, ch_3w: 14 },
        { company_code: 'PT.PLDK', cnt_banjir: 0, cnt_tergenang: 0, cnt_a_tergenang: 0, cnt_normal: 0, cnt_a_kering: 0, cnt_kering: 72, cnt_total: 72, pct_banjir: 0, pct_tergenang: 0, pct_a_tergenang: 0, pct_normal: 0, pct_a_kering: 0, pct_kering: 100, avg_tmat: 112, dominant_status: 'Kering', ch_1w: 0, ch_3w: 0 },
        { company_code: 'PT.SUMK', cnt_banjir: 0, cnt_tergenang: 0, cnt_a_tergenang: 0, cnt_normal: 2, cnt_a_kering: 4, cnt_kering: 26, cnt_total: 32, pct_banjir: 0, pct_tergenang: 0, pct_a_tergenang: 0, pct_normal: 6, pct_a_kering: 13, pct_kering: 81, avg_tmat: 76, dominant_status: 'Kering', ch_1w: 2, ch_3w: 25 },
    ];
}

function makeOctW5TransitionRows() {
    return [
        { company_code: 'PT.THIP', cnt_banjir: 0, cnt_tergenang: 130, cnt_a_tergenang: 130, cnt_normal: 780, cnt_a_kering: 130, cnt_kering: 132, cnt_total: 1302, pct_banjir: 0, pct_tergenang: 10, pct_a_tergenang: 10, pct_normal: 60, pct_a_kering: 10, pct_kering: 10, avg_tmat: 56, dominant_status: 'Normal', ch_1w: 35, ch_3w: 105 },
        { company_code: 'PT.JJP', cnt_banjir: 0, cnt_tergenang: 60, cnt_a_tergenang: 60, cnt_normal: 420, cnt_a_kering: 30, cnt_kering: 30, cnt_total: 600, pct_banjir: 0, pct_tergenang: 10, pct_a_tergenang: 10, pct_normal: 70, pct_a_kering: 5, pct_kering: 5, avg_tmat: 54, dominant_status: 'Normal', ch_1w: 30, ch_3w: 95 },
        { company_code: 'PT.PTW', cnt_banjir: 0, cnt_tergenang: 36, cnt_a_tergenang: 18, cnt_normal: 109, cnt_a_kering: 9, cnt_kering: 9, cnt_total: 181, pct_banjir: 0, pct_tergenang: 20, pct_a_tergenang: 10, pct_normal: 60, pct_a_kering: 5, pct_kering: 5, avg_tmat: 52, dominant_status: 'Normal', ch_1w: 40, ch_3w: 110 },
    ];
}

describe('weeklyReportEngine helpers', () => {
    it('formats short week labels and Indonesian lists cleanly', () => {
        expect(formatShortWeekLabel('Nov 2026, W3')).toBe('W3 Nov');
        expect(formatShortWeekLabel('Sep 2026, W2')).toBe('W2 Sep');
        expect(formatShortWeekLabel('Custom Label')).toBe('Custom Label');

        expect(stripPtPrefix('PT.THIP')).toBe('THIP');
        expect(stripPtPrefix('PT. PANPS')).toBe('PANPS');

        expect(formatIndonesianList([])).toBe('');
        expect(formatIndonesianList(['THIP'])).toBe('THIP');
        expect(formatIndonesianList(['THIP', 'JJP'])).toBe('THIP dan JJP');
        expect(formatIndonesianList(['THIP', 'JJP', 'PTW'])).toBe('THIP, JJP, dan PTW');
    });
});

describe('weeklyReportEngine WET scenario (Nov 2026, W3)', () => {
    const rows = makeNovW3Rows();

    it('computes weighted (53%) and company_avg (49%) accurately', () => {
        const weighted = aggregateWeekMetrics(rows, { method: 'weighted' });
        const avg = aggregateWeekMetrics(rows, { method: 'company_avg' });

        expect(weighted.pctTergenang).toBe(53);
        expect(avg.pctTergenang).toBe(49);
        expect(weighted.dominantCounts.Tergenang).toBe(6);
        expect(weighted.dominantCompanies.Tergenang).toEqual(['THIP', 'JJP', 'PTW', 'PANPS', 'PLDK', 'SUMK']);
        expect(weighted.ptCh3wAbove150.length).toBe(8);
    });

    it('detects WET regime and generates executive narrative without em dashes', () => {
        const report = buildWeeklyReport({
            weekMeta: { week_id: 533, formatted_name: 'Nov 2026, W3', start_date: '2026-11-16', end_date: '2026-11-22' },
            companyRows: rows,
            method: 'weighted',
            fieldActionNote: 'Saat ini seluruh Kebun sudah mengaktifkan pompa untuk penurunan water level.',
        });

        expect(report.regime).toBe('WET');
        expect(report.autoNarrative).toContain('W3 Nov');
        expect(report.autoNarrative).toContain('Tergenang (53%)');
        expect(report.autoNarrative).toContain('6 dari 9 Estate: THIP, JJP, PTW, PANPS, PLDK, dan SUMK');
        expect(report.autoNarrative).toContain('Banjir');
        expect(report.autoNarrative).toContain('di atas 150 mm');
        expect(report.autoNarrative).toContain('mengaktifkan pompa');
        expect(report.autoNarrative).not.toContain('—');
    });

    it('excludes selected PTs cleanly when computing report', () => {
        const filtered = rows.filter((r) => r.company_code !== 'PT.SIP' && r.company_code !== 'PT.GAN');
        const report = buildWeeklyReport({
            weekMeta: { week_id: 533, formatted_name: 'Nov 2026, W3' },
            companyRows: filtered,
            method: 'weighted',
        });

        expect(report.summary.totalValidCompanies).toBe(7);
        expect(report.autoNarrative).toContain('6 dari 7 Estate');
    });
});

describe('weeklyReportEngine DRY & TRANSITION scenarios', () => {
    it('detects DRY regime and focuses on Kering/Merah and low 3-week rainfall', () => {
        const dryRows = makeSepW2DryRows();
        const report = buildWeeklyReport({
            weekMeta: { week_id: 524, formatted_name: 'Sep 2026, W2', start_date: '2026-09-07', end_date: '2026-09-13' },
            companyRows: dryRows,
            method: 'weighted',
        });

        expect(report.regime).toBe('DRY');
        expect(report.autoNarrative).toContain('W2 Sep');
        expect(report.autoNarrative).toContain('Kering/Merah');
        expect(report.autoNarrative).toContain('7 dari 9 Estate');
        expect(report.autoNarrative).toContain('di bawah 60 mm');
        expect(report.autoNarrative).not.toContain('mengaktifkan pompa');
        expect(report.autoNarrative).not.toContain('—');
    });

    it('detects TRANSITION regime when Normal dominates without dry/wet extreme', () => {
        const transRows = makeOctW5TransitionRows();
        const report = buildWeeklyReport({
            weekMeta: { week_id: 530, formatted_name: 'Oct 2026, W5' },
            companyRows: transRows,
            method: 'weighted',
        });

        expect(report.regime).toBe('TRANSITION');
        expect(report.autoNarrative).toContain('Normal');
        expect(report.autoNarrative).toContain('W5 Oct');
        expect(report.autoNarrative).not.toContain('—');
    });

    it('ranks companies appropriately per regime without mutating input', () => {
        const novRows = makeNovW3Rows();
        const snapshot = JSON.stringify(novRows);

        const wetRanked = rankCompaniesByRegime(novRows, 'WET');
        expect(wetRanked[0].company_code).toBe('PT.SUMK'); // 100% wet (31% banjir + 69% tergenang)
        expect(wetRanked[wetRanked.length - 1].company_code).toBe('PT.SIP'); // 0% wet

        const dryRanked = rankCompaniesByRegime(novRows, 'DRY');
        expect(dryRanked[0].company_code).toBe('PT.GAN'); // 16% kering

        const transRanked = rankCompaniesByRegime(novRows, 'TRANSITION');
        expect(transRanked[0].company_code).toBe('PT.SUMK'); // 0% normal

        expect(JSON.stringify(novRows)).toBe(snapshot);
        expect(EXECUTIVE_PT_ORDER.length).toBe(9);
    });

    it('handles empty and No Data rows gracefully', () => {
        const emptySummary = aggregateWeekMetrics([], { method: 'weighted' });
        expect(emptySummary.totalValidCompanies).toBe(0);
        expect(detectHydrologicalRegime(emptySummary).regime).toBe('TRANSITION');

        const noDataReport = buildWeeklyReport({
            weekMeta: { week_id: 539, formatted_name: 'Dec 2026, W5' },
            companyRows: [{ company_code: 'PT.THIP', cnt_total: 0, dominant_status: 'No Data' }],
        });
        expect(noDataReport.summary.totalValidCompanies).toBe(0);
        expect(noDataReport.autoNarrative).toContain('Belum tersedia');
    });
});
