import pg from 'pg';
const { Pool } = pg;

export async function GET() {
    const pool = new Pool({
        connectionString: process.env.DATABASE_URL,
        ssl: { rejectUnauthorized: false }
    });
    try {
        const res = await pool.query(`
            SELECT DISTINCT cw.formatted_name, cw.start_date
            FROM calendar_weeks cw
            INNER JOIN piezometer_data p ON cw.formatted_name = p.month_name
            ORDER BY cw.start_date DESC
        `);
        return Response.json({ weeks: res.rows });
    } catch (err) {
        return Response.json({ error: err.message }, { status: 500 });
    } finally {
        await pool.end();
    }
}
