import pg from 'pg';
const { Pool } = pg;

export async function GET() {
    const pool = new Pool({
        connectionString: process.env.DATABASE_URL,
        ssl: { rejectUnauthorized: false }
    });
    try {
        const res = await pool.query(`
            SELECT formatted_name, start_date::text, end_date::text
            FROM calendar_weeks
            WHERE start_date >= '2026-01-01'
            ORDER BY start_date ASC
        `);
        return Response.json({ weeks: res.rows });
    } catch (err) {
        return Response.json({ error: err.message }, { status: 500 });
    } finally {
        await pool.end();
    }
}
