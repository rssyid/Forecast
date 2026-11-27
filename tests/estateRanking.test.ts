import { describe, expect, it } from 'vitest';
import { rankEstatesByDryness, rankEstatesByWetness } from '../lib/estateRanking.js';

describe('estateRanking', () => {
    it('ranks estates by combined wetness descending and keeps 0% estates at the bottom', () => {
        const input = [
            { estate: 'E3', company: 'PT.A', total_block: 10, cnt_tergenang: 0, cnt_banjir: 0, cnt_tergenang_banjir: 0, avg_tmat: 55 },
            { estate: 'E1', company: 'PT.A', total_block: 10, cnt_tergenang: 3, cnt_banjir: 1, cnt_tergenang_banjir: 4, avg_tmat: 38 },
            { estate: 'E2', company: 'PT.A', total_block: 10, cnt_tergenang: 6, cnt_banjir: 2, cnt_tergenang_banjir: 8, avg_tmat: 25 },
        ];

        const ranked = rankEstatesByWetness(input);
        expect(ranked.map((r) => r.estate)).toEqual(['E2', 'E1', 'E3']);
        expect(ranked[2].combinedPct).toBe(0);
    });

    it('breaks ties by banjir share desc, then avg_tmat asc, then numeric estate name asc', () => {
        const input = [
            { estate: 'E10', company: 'PT.A', total_block: 10, cnt_tergenang: 4, cnt_banjir: 1, cnt_tergenang_banjir: 5, avg_tmat: 35 },
            { estate: 'E2', company: 'PT.A', total_block: 10, cnt_tergenang: 4, cnt_banjir: 1, cnt_tergenang_banjir: 5, avg_tmat: 35 },
            { estate: 'E3', company: 'PT.A', total_block: 10, cnt_tergenang: 4, cnt_banjir: 1, cnt_tergenang_banjir: 5, avg_tmat: 30 },
            { estate: 'E4', company: 'PT.A', total_block: 10, cnt_tergenang: 2, cnt_banjir: 3, cnt_tergenang_banjir: 5, avg_tmat: 40 },
            { estate: 'E5', company: 'PT.A', total_block: 10, cnt_tergenang: 4, cnt_banjir: 1, cnt_tergenang_banjir: 5, avg_tmat: null },
        ];

        const ranked = rankEstatesByWetness(input);
        expect(ranked.map((r) => r.estate)).toEqual(['E4', 'E3', 'E2', 'E10', 'E5']);
    });

    it('caps overlapping multi-piezometer block counts so stacked bar matches combinedPct <= 100', () => {
        const input = [
            { estate: 'OVL', company: 'PT.A', total_block: 10, cnt_tergenang: 6, cnt_banjir: 5, cnt_tergenang_banjir: 8, avg_tmat: 18 },
        ];

        const [row] = rankEstatesByWetness(input);
        expect(row.combinedPct).toBe(80);
        expect(row.banjirBarPct).toBe(50);
        expect(row.tergenangBarPct).toBe(30);
        expect(row.banjirBarPct + row.tergenangBarPct).toBe(row.combinedPct);
    });

    it('falls back safely when cnt_tergenang_banjir is missing and handles total_block = 0', () => {
        const input = [
            { estate: 'FB', company: 'PT.A', total_block: 5, cnt_tergenang: 4, cnt_banjir: 3, avg_tmat: 12 },
            { estate: 'ZERO', company: 'PT.A', total_block: 0, cnt_tergenang: 2, cnt_banjir: 1, cnt_tergenang_banjir: 2, avg_tmat: 20 },
        ];

        const ranked = rankEstatesByWetness(input);
        expect(ranked[0].estate).toBe('FB');
        expect(ranked[0].combinedPct).toBe(100);
        expect(ranked[0].banjirBarPct + ranked[0].tergenangBarPct).toBe(100);

        expect(ranked[1].estate).toBe('ZERO');
        expect(ranked[1].combinedPct).toBe(0);
        expect(ranked[1].banjirBarPct).toBe(0);
        expect(ranked[1].tergenangBarPct).toBe(0);
        expect(Number.isFinite(ranked[1].combinedPct)).toBe(true);
    });

    it('does not mutate the original input array for dryness or wetness ranking', () => {
        const original = [
            { estate: 'B', company: 'PT.A', total_block: 10, cnt_kering: 1, cnt_tergenang: 2, cnt_banjir: 0, cnt_tergenang_banjir: 2, avg_tmat: 40 },
            { estate: 'A', company: 'PT.A', total_block: 10, cnt_kering: 5, cnt_tergenang: 6, cnt_banjir: 2, cnt_tergenang_banjir: 8, avg_tmat: 30 },
        ];
        const snapshot = JSON.stringify(original);

        const dry = rankEstatesByDryness(original);
        const wet = rankEstatesByWetness(original);

        expect(dry.map((r) => r.estate)).toEqual(['A', 'B']);
        expect(wet.map((r) => r.estate)).toEqual(['A', 'B']);
        expect(JSON.stringify(original)).toBe(snapshot);
    });
});
