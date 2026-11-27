import pg from 'pg';
import { NextResponse } from 'next/server';
import {
    EXECUTIVE_PT_ORDER,
    buildWeeklyReport,
    formatShortWeekLabel,
} from '../../../lib/weeklyReportEngine.js';

const { Pool } = pg;

export const dynamic = 'force-dynamic';

const CREATE_TABLE_SQL = `
CREATE TABLE IF NOT EXISTS weekly_pzo_reports (
    id SERIAL PRIMARY KEY,
    week_id INTEGER NOT NULL UNIQUE,
    formatted_name VARCHAR(64) NOT NULL,
    regime VARCHAR(20) NOT NULL,
    method VARCHAR(20) NOT NULL DEFAULT 'weighted',
    excluded_companies JSONB NOT NULL DEFAULT '[]'::jsonb,
    field_action_note TEXT NOT NULL DEFAULT '',
    custom_narrative TEXT,
    auto_narrative TEXT NOT NULL DEFAULT '',
    metrics_snapshot JSONB,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_weekly_pzo_reports_week_id
    ON weekly_pzo_reports (week_id);
`;

function getPool() {
    return new Pool({
        connectionString: process.env.DATABASE_URL,
        ssl: { rejectUnauthorized: false },
    });
}

function addDaysIso(isoDate, deltaDays) {
    const [y, m, d] = String(isoDate).slice(0, 10).split('-').map(Number);
    const dt = new Date(Date.UTC(y, m - 1, d + deltaDays));
    return dt.toISOString().slice(0, 10);
}

export async function GET(request) {
    const { searchParams } = new URL(request.url);
    const weekParam = searchParams.get('week') || null;
    const methodParam = searchParams.get('method') === 'company_avg' ? 'company_avg' : 'weighted';
    const historyParam = parseInt(searchParams.get('history') || '8', 10);
    const historyCount = Number.isFinite(historyParam) ? Math.min(Math.max(historyParam, 1), 16) : 8;
    const excludeParam = searchParams.get('exclude');

    const pool = getPool();

    try {
        await pool.query(CREATE_TABLE_SQL);

        const compRes = await pool.query(
            `SELECT code, name FROM companies WHERE "isActive" = true ORDER BY code ASC`
        );
        const allCompanies = compRes.rows;
        const allCompanyCodes = allCompanies.map((c) => c.code);

        if (allCompanyCodes.length === 0) {
            return NextResponse.json({
                selectedWeek: null,
                prevWeek: null,
                nextWeek: null,
                availableWeeks: [],
                allCompanies: [],
                defaultIncludedCodes: EXECUTIVE_PT_ORDER,
                method: methodParam,
                excludedCodes: [],
                report: null,
                timeline: [],
                rawWindow: [],
            });
        }

        // Only pick weeks that actually have GIS PZO data (cnt_total > 0)
        const weeksRes = await pool.query(
            `
            SELECT
                cw.id,
                COALESCE(cw.gis_week_id, cw.id + 434)::int AS week_id,
                cw.formatted_name,
                cw.start_date::text AS start_date,
                cw.end_date::text AS end_date
            FROM calendar_weeks cw
            INNER JOIN gis_comparison_data g
                ON g.week_id = COALESCE(cw.gis_week_id, cw.id + 434)
            WHERE g.company_code = ANY($1)
            GROUP BY cw.id, cw.gis_week_id, cw.formatted_name, cw.start_date, cw.end_date
            HAVING SUM(g.cnt_total) > 0
            ORDER BY cw.start_date DESC
            LIMIT 52
            `,
            [allCompanyCodes]
        );

        const availableWeeks = weeksRes.rows.map((w) => ({
            ...w,
            short_label: formatShortWeekLabel(w.formatted_name),
        }));

        if (availableWeeks.length === 0) {
            return NextResponse.json({
                selectedWeek: null,
                prevWeek: null,
                nextWeek: null,
                availableWeeks: [],
                allCompanies,
                defaultIncludedCodes: EXECUTIVE_PT_ORDER.filter((c) => allCompanyCodes.includes(c)),
                method: methodParam,
                excludedCodes: [],
                report: null,
                timeline: [],
                rawWindow: [],
            });
        }

        let selectedIdx = weekParam
            ? availableWeeks.findIndex((w) => w.formatted_name === weekParam)
            : 0;
        if (selectedIdx === -1) selectedIdx = 0;

        const selectedWeek = availableWeeks[selectedIdx];
        const prevWeek = selectedIdx + 1 < availableWeeks.length ? availableWeeks[selectedIdx + 1] : null;
        const nextWeek = selectedIdx - 1 >= 0 ? availableWeeks[selectedIdx - 1] : null;

        // Window of historyCount weeks ending at selectedWeek + 1 extra lookback week for WoW delta
        // availableWeeks is sorted DESC (newest first), so older weeks have higher indices
        const windowDesc = availableWeeks.slice(selectedIdx, selectedIdx + historyCount + 1);
        const windowChrono = [...windowDesc].reverse(); // oldest -> newest (selectedWeek is last)
        const windowWeekIds = windowChrono.map((w) => w.week_id);

        const earliestStart = windowChrono[0].start_date;
        const latestEnd = windowChrono[windowChrono.length - 1].end_date;
        const rainFetchStart = addDaysIso(earliestStart, -14);

        const [gisRes, rainRes, savedRes] = await Promise.all([
            pool.query(
                `
                SELECT
                    company_code, company_name, week_id, formatted_name,
                    cnt_no_data, pct_no_data, cnt_banjir, pct_banjir,
                    cnt_tergenang, pct_tergenang, cnt_a_tergenang, pct_a_tergenang,
                    cnt_normal, pct_normal, cnt_a_kering, pct_a_kering,
                    cnt_kering, pct_kering, cnt_total, percentages,
                    avg_tmat::float AS avg_tmat, dominant_status
                FROM gis_comparison_data
                WHERE week_id = ANY($1) AND company_code = ANY($2)
                `,
                [windowWeekIds, allCompanyCodes]
            ),
            pool.query(
                `
                SELECT
                    r.company_code,
                    r.record_date::text AS record_date,
                    AVG(r.rainfall_mm)::float AS daily_avg
                FROM daily_rainfall r
                WHERE r.record_date BETWEEN $1::date AND $2::date
                  AND r.company_code = ANY($3)
                GROUP BY r.company_code, r.record_date
                `,
                [rainFetchStart, latestEnd, allCompanyCodes]
            ),
            pool.query(
                `
                SELECT
                    week_id, formatted_name, regime, method,
                    excluded_companies, field_action_note, custom_narrative,
                    auto_narrative, updated_at::text AS updated_at
                FROM weekly_pzo_reports
                WHERE week_id = ANY($1)
                `,
                [windowWeekIds]
            ),
        ]);

        // Index GIS rows by week_id -> company_code
        const gisByWeek = new Map();
        for (const row of gisRes.rows) {
            if (!gisByWeek.has(row.week_id)) gisByWeek.set(row.week_id, new Map());
            gisByWeek.get(row.week_id).set(row.company_code, row);
        }

        // Index daily rainfall by company_code -> array of { date, mm }
        const rainByCompany = new Map();
        for (const row of rainRes.rows) {
            if (!rainByCompany.has(row.company_code)) rainByCompany.set(row.company_code, []);
            rainByCompany.get(row.company_code).push({
                date: row.record_date.slice(0, 10),
                mm: Number(row.daily_avg) || 0,
            });
        }

        // Index saved reports by week_id
        const savedByWeek = new Map();
        for (const row of savedRes.rows) {
            savedByWeek.set(row.week_id, row);
        }

        // Build enriched company rows per week in windowChrono
        const rawWindow = windowChrono.map((w) => {
            const wGisMap = gisByWeek.get(w.week_id) || new Map();
            const wStart = w.start_date.slice(0, 10);
            const wEnd = w.end_date.slice(0, 10);
            const w3Start = addDaysIso(wStart, -14);

            const companies = allCompanies.map((comp) => {
                const gis = wGisMap.get(comp.code) || {};
                const dailyList = rainByCompany.get(comp.code) || [];

                let ch1w = 0;
                let hh1w = 0;
                let ch3w = 0;
                let hh3w = 0;
                for (const d of dailyList) {
                    if (d.date >= wStart && d.date <= wEnd) {
                        ch1w += d.mm;
                        if (d.mm > 0) hh1w += 1;
                    }
                    if (d.date >= w3Start && d.date <= wEnd) {
                        ch3w += d.mm;
                        if (d.mm > 0) hh3w += 1;
                    }
                }

                return {
                    company_code: comp.code,
                    company_name: comp.name || comp.code,
                    week_id: w.week_id,
                    formatted_name: w.formatted_name,
                    cnt_banjir: gis.cnt_banjir ?? 0,
                    pct_banjir: gis.pct_banjir ?? 0,
                    cnt_tergenang: gis.cnt_tergenang ?? 0,
                    pct_tergenang: gis.pct_tergenang ?? 0,
                    cnt_a_tergenang: gis.cnt_a_tergenang ?? 0,
                    pct_a_tergenang: gis.pct_a_tergenang ?? 0,
                    cnt_normal: gis.cnt_normal ?? 0,
                    pct_normal: gis.pct_normal ?? 0,
                    cnt_a_kering: gis.cnt_a_kering ?? 0,
                    pct_a_kering: gis.pct_a_kering ?? 0,
                    cnt_kering: gis.cnt_kering ?? 0,
                    pct_kering: gis.pct_kering ?? 0,
                    cnt_total: gis.cnt_total ?? 0,
                    percentages: gis.percentages ?? [0, 0, 0, 0, 0, 0],
                    avg_tmat: gis.avg_tmat ?? null,
                    dominant_status: gis.dominant_status || 'No Data',
                    ch_1w: Number(ch1w.toFixed(1)),
                    hh_1w: hh1w,
                    ch_3w: Number(ch3w.toFixed(1)),
                    hh_3w: hh3w,
                };
            });

            const saved = savedByWeek.get(w.week_id) || null;
            return {
                week: w,
                companies,
                saved,
            };
        });

        const defaultIncludedCodes = EXECUTIVE_PT_ORDER.filter((c) => allCompanyCodes.includes(c));
        const defaultExcluded = allCompanyCodes.filter((c) => !defaultIncludedCodes.includes(c));
        const excludedCodes = excludeParam !== null
            ? excludeParam.split(',').map((s) => s.trim()).filter(Boolean)
            : defaultExcluded;
        const excludedSet = new Set(excludedCodes);

        // Build reports for the display window (skip index 0 if we fetched historyCount + 1)
        const displayStartIdx = rawWindow.length > historyCount ? rawWindow.length - historyCount : 0;
        const timeline = [];
        for (let i = displayStartIdx; i < rawWindow.length; i += 1) {
            const curr = rawWindow[i];
            const prev = i > 0 ? rawWindow[i - 1] : null;
            const includedCurr = curr.companies.filter((c) => !excludedSet.has(c.company_code));
            const includedPrev = prev ? prev.companies.filter((c) => !excludedSet.has(c.company_code)) : null;

            const built = buildWeeklyReport({
                weekMeta: curr.week,
                companyRows: includedCurr,
                prevCompanyRows: includedPrev,
                method: methodParam,
                fieldActionNote: curr.saved?.field_action_note || '',
                customNarrative: curr.saved?.custom_narrative || null,
                updatedAt: curr.saved?.updated_at || null,
            });
            timeline.push(built);
        }

        const report = timeline.length > 0 ? timeline[timeline.length - 1] : null;

        return NextResponse.json({
            selectedWeek,
            prevWeek,
            nextWeek,
            availableWeeks,
            allCompanies,
            defaultIncludedCodes,
            method: methodParam,
            excludedCodes,
            report,
            timeline,
            rawWindow,
        });
    } catch (err) {
        console.error('[Weekly Report GET Error]', err);
        return NextResponse.json({ error: err.message }, { status: 500 });
    } finally {
        await pool.end();
    }
}

export async function PUT(request) {
    const pool = getPool();
    try {
        await pool.query(CREATE_TABLE_SQL);
        const body = await request.json();

        const weekId = Number(body.weekId);
        const formattedName = String(body.formattedName || '').trim();
        const regime = String(body.regime || 'TRANSITION').trim();
        const method = body.method === 'company_avg' ? 'company_avg' : 'weighted';
        const excludedCompanies = Array.isArray(body.excludedCompanies) ? body.excludedCompanies : [];
        const fieldActionNote = String(body.fieldActionNote || '').replace(/—/g, ', ').trim();
        const rawCustom = typeof body.customNarrative === 'string' ? body.customNarrative.trim() : '';
        const customNarrative = rawCustom ? rawCustom.replace(/—/g, ', ') : null;
        const autoNarrative = String(body.autoNarrative || '').replace(/—/g, ', ').trim();
        const metricsSnapshot = body.metricsSnapshot && typeof body.metricsSnapshot === 'object'
            ? body.metricsSnapshot
            : null;

        if (!Number.isInteger(weekId) || weekId <= 0 || !formattedName) {
            return NextResponse.json(
                { error: 'weekId dan formattedName wajib diisi dengan valid.' },
                { status: 400 }
            );
        }

        const upsertRes = await pool.query(
            `
            INSERT INTO weekly_pzo_reports (
                week_id, formatted_name, regime, method, excluded_companies,
                field_action_note, custom_narrative, auto_narrative, metrics_snapshot, updated_at
            ) VALUES (
                $1, $2, $3, $4, $5::jsonb, $6, $7, $8, $9::jsonb, NOW()
            )
            ON CONFLICT (week_id) DO UPDATE SET
                formatted_name = EXCLUDED.formatted_name,
                regime = EXCLUDED.regime,
                method = EXCLUDED.method,
                excluded_companies = EXCLUDED.excluded_companies,
                field_action_note = EXCLUDED.field_action_note,
                custom_narrative = EXCLUDED.custom_narrative,
                auto_narrative = EXCLUDED.auto_narrative,
                metrics_snapshot = EXCLUDED.metrics_snapshot,
                updated_at = NOW()
            RETURNING
                week_id, formatted_name, regime, method, excluded_companies,
                field_action_note, custom_narrative, auto_narrative, updated_at::text AS updated_at
            `,
            [
                weekId,
                formattedName,
                regime,
                method,
                JSON.stringify(excludedCompanies),
                fieldActionNote,
                customNarrative,
                autoNarrative,
                metricsSnapshot ? JSON.stringify(metricsSnapshot) : null,
            ]
        );

        return NextResponse.json({
            success: true,
            saved: upsertRes.rows[0],
        });
    } catch (err) {
        console.error('[Weekly Report PUT Error]', err);
        return NextResponse.json({ error: err.message }, { status: 500 });
    } finally {
        await pool.end();
    }
}
