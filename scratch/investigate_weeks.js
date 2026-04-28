import pool from '../lib/db.js';

async function checkWeeks() {
    try {
        const res = await pool.query(`
            SELECT formatted_name, start_date, end_date 
            FROM calendar_weeks 
            ORDER BY start_date ASC
        `);
        
        console.log("Total weeks:", res.rows.length);
        
        // Find W4 Apr 2026
        const targetIdx = res.rows.findIndex(r => r.formatted_name === 'Apr 2026, W4');
        console.log("Index of 'Apr 2026, W4':", targetIdx);
        
        if (targetIdx !== -1) {
            // If the user says W4 Apr 2026 is 503
            // We can calculate the offset
            const offset = 503 - targetIdx;
            console.log("Calculated offset:", offset);
            
            // Show a few rows around it
            console.log("Rows around target:");
            console.table(res.rows.slice(Math.max(0, targetIdx - 2), targetIdx + 3).map((r, i) => ({
                ...r,
                calculated_id: (targetIdx - 2 + i) + offset
            })));
        }
    } catch (err) {
        console.error(err);
    } finally {
        await pool.end();
    }
}

checkWeeks();
