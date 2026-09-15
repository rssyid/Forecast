
import pg from 'pg';
import { syncGisComparisonForWeek } from '../../../lib/gisService.js';
const { Pool } = pg;

export async function GET(request) {
    return handleSync(request);
}

export async function POST(request) {
    return handleSync(request);
}

async function handleSync(request) {
    const { searchParams } = new URL(request.url);
    let weekParam = searchParams.get('week');
    let weekIdParam = searchParams.get('weekId');
    let companyParam = searchParams.get('company');

    if (request.method === 'POST') {
        try {
            const body = await request.json();
            if (body.week) weekParam = body.week;
            if (body.weekId) weekIdParam = body.weekId;
            if (body.company) companyParam = body.company;
        } catch {
            // body is optional
        }
    }

    const pool = new Pool({
        connectionString: process.env.DATABASE_URL,
        ssl: { rejectUnauthorized: false }
    });

    try {
        let targetWeekId = weekIdParam ? parseInt(weekIdParam, 10) : null;
        let weekFormatted = weekParam;

        if (!targetWeekId) {
            let cwQuery = '';
            let params = [];
            if (weekFormatted) {
                cwQuery = 'SELECT id, gis_week_id, formatted_name FROM calendar_weeks WHERE formatted_name = $1 LIMIT 1';
                params = [weekFormatted];
            } else {
                // Default to latest calendar week before today or highest id
                cwQuery = 'SELECT id, gis_week_id, formatted_name FROM calendar_weeks WHERE start_date <= NOW() ORDER BY start_date DESC LIMIT 1';
            }
            const cwRes = await pool.query(cwQuery, params);
            if (cwRes.rows.length > 0) {
                targetWeekId = cwRes.rows[0].gis_week_id || (cwRes.rows[0].id + 434);
                weekFormatted = cwRes.rows[0].formatted_name;
            } else {
                return Response.json({ error: 'Week not found in calendar_weeks' }, { status: 404 });
            }
        }

        // Check if specific company requested
        let specificCompanies = null;
        if (companyParam && companyParam !== 'Semua') {
            const cRes = await pool.query('SELECT code, name FROM companies WHERE code = $1 OR id = $1', [companyParam]);
            if (cRes.rows.length > 0) {
                specificCompanies = cRes.rows;
            }
        }

        const syncResult = await syncGisComparisonForWeek(targetWeekId, specificCompanies);
        return Response.json({
            success: true,
            weekId: targetWeekId,
            weekName: weekFormatted,
            ...syncResult
        });
    } catch (err) {
        console.error('Error in sync-gis-comparison:', err);
        return Response.json({ error: err.message }, { status: 500 });
    } finally {
        await pool.end();
    }
}
