import pool from '../../../lib/db.js';
import { NextResponse } from 'next/server';

export async function GET(request) {
  const { searchParams } = new URL(request.url);
  const companyCode = searchParams.get('companyCode');
  const lookbackWeeks = searchParams.get('lookbackWeeks');

  try {
    const limit = parseInt(lookbackWeeks) || 8;
    
    // Find the latest active weeks available in the database
    // We take limit + 1 so we have the 'previous week' data for the oldest week in the target range
    const weeksResult = await pool.query(`
        SELECT month_name 
        FROM piezometer_data 
        GROUP BY month_name 
        ORDER BY MAX(date_timestamp) DESC 
        LIMIT $1 + 1
    `, [limit]);

    if (weeksResult.rows.length === 0) {
        return NextResponse.json({ data: [], weeks: [] });
    }

    const targetWeeks = weeksResult.rows.map(r => r.month_name);

    // 1. Fetch Piezometer Data with Master Mapping (to handle multi-block and active status)
    let dataQuery = `
      SELECT p.data_taken, p.est_code, 
             COALESCE(m.block_id, p.block) as block, 
             p.pie_record_id, p.ketinggian, 
             p.indicator_name, p.indicator_alias, p.month_name, p.date_timestamp, 
             p.banyak, p.url_images, p.company_code
      FROM piezometer_data p
      LEFT JOIN pzo_master_mapping m ON p.pie_record_id = m.pie_record_id
      WHERE p.month_name = ANY($1)
      AND (m.is_active IS NULL OR m.is_active = true)
    `;
    let params = [targetWeeks];
    if (companyCode && companyCode !== 'Semua') {
       dataQuery += ` AND p.company_code = $2`;
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

    // 3. Fetch Specific Rainfall per Estate (for Granular Model)
    let estateRainQuery = `
        WITH daily_est_avg AS (
            SELECT 
                est_code,
                record_date,
                AVG(rainfall_mm) as daily_avg
            FROM daily_rainfall
            ${companyCode && companyCode !== 'Semua' ? 'WHERE company_code = $2' : ''}
            GROUP BY est_code, record_date
        )
        SELECT 
            da.est_code,
            cw.formatted_name as week,
            SUM(da.daily_avg) as total_rain
        FROM daily_est_avg da
        JOIN calendar_weeks cw ON da.record_date >= cw.start_date AND da.record_date <= cw.end_date
        WHERE cw.formatted_name = ANY($1)
        GROUP BY da.est_code, cw.formatted_name
    `;
    let estRainParams = [targetWeeks];
    if (companyCode && companyCode !== 'Semua') {
        estRainParams.push(companyCode);
    }
    const estateRainResult = await pool.query(estateRainQuery, estRainParams);

    // Map company rainfall
    const rainfallMap = {};
    rainResult.rows.forEach(r => {
        rainfallMap[r.week] = parseFloat(r.total_rain) || 0;
    });

    // Map estate-specific rainfall
    const estateRainfallMap = {}; // { EST1: { week1: 10, week2: 20 }, ... }
    estateRainResult.rows.forEach(r => {
        if (!estateRainfallMap[r.est_code]) estateRainfallMap[r.est_code] = {};
        estateRainfallMap[r.est_code][r.week] = parseFloat(r.total_rain) || 0;
    });

    return NextResponse.json({ 
        data: dataResult.rows, 
        weeks: targetWeeks,
        rainfall: rainfallMap,
        estateRainfall: estateRainfallMap
    });

  } catch (err) {
    console.error(err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
