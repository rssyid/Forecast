import pool from '../lib/db.js';

export default async function handler(req, res) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed. Use GET.' });
  }

  const { companyCode, lookbackWeeks } = req.query;

  try {
    const limit = parseInt(lookbackWeeks) || 8;
    
    // Find the latest active weeks available in the database
    const weeksResult = await pool.query(`
        SELECT month_name 
        FROM piezometer_data 
        GROUP BY month_name 
        ORDER BY MAX(date_timestamp) DESC 
        LIMIT $1
    `, [limit]);

    if (weeksResult.rows.length === 0) {
        return res.status(200).json({ data: [], weeks: [] });
    }

    const targetWeeks = weeksResult.rows.map(r => r.month_name);

    // 1. Fetch Piezometer Data
    let dataQuery = `
      SELECT data_taken, est_code, block, pie_record_id, ketinggian, 
             indicator_name, indicator_alias, month_name, date_timestamp, 
             banyak, url_images, company_code
      FROM piezometer_data
      WHERE month_name = ANY($1)
    `;
    let params = [targetWeeks];
    if (companyCode && companyCode !== 'Semua') {
       dataQuery += ` AND company_code = $2`;
       params.push(companyCode);
    }
    const dataResult = await pool.query(dataQuery, params);

    // 2. Fetch Total Weekly Rainfall (Sum of Daily Company Averages)
    let rainfallQuery = `
        WITH daily_company_avg AS (
            SELECT 
                record_date,
                AVG(rainfall_mm) as daily_avg
            FROM daily_rainfall
            WHERE company_code = $2
            GROUP BY record_date
        )
        SELECT 
            cw.formatted_name as week,
            SUM(da.daily_avg) as total_rain
        FROM daily_company_avg da
        JOIN calendar_weeks cw ON da.record_date >= cw.start_date AND da.record_date <= cw.end_date
        WHERE cw.formatted_name = ANY($1)
        GROUP BY cw.formatted_name
    `;
    let rainParams = [targetWeeks, companyCode];
    
    // Fallback if companyCode is 'Semua' (though dashboard usually selects one)
    if (!companyCode || companyCode === 'Semua') {
        rainfallQuery = `
            SELECT 
                cw.formatted_name as week,
                AVG(dr.rainfall_mm) * 7 as total_rain
            FROM daily_rainfall dr
            JOIN calendar_weeks cw ON dr.record_date >= cw.start_date AND dr.record_date <= cw.end_date
            WHERE cw.formatted_name = ANY($1)
            GROUP BY cw.formatted_name
        `;
        rainParams = [targetWeeks];
    }
    
    const rainResult = await pool.query(rainfallQuery, rainParams);

    // Map rainfall to object for easier lookup
    const rainfallMap = {};
    rainResult.rows.forEach(r => {
        rainfallMap[r.week] = parseFloat(r.total_rain) || 0;
    });

    res.status(200).json({ 
        data: dataResult.rows, 
        weeks: targetWeeks,
        rainfall: rainfallMap
    });

  } catch (err) {
    console.error(err);
    res.status(500).json({ error: err.message });
  }
}
