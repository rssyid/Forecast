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
        SELECT p.month_name, MAX(cw.start_date) as start_date, MAX(cw.end_date) as end_date 
        FROM piezometer_data p
        LEFT JOIN calendar_weeks cw ON p.month_name = cw.formatted_name
        GROUP BY p.month_name 
        ORDER BY MAX(p.date_timestamp) DESC 
        LIMIT $1 + 1
    `, [limit]);

    if (weeksResult.rows.length === 0) {
        return NextResponse.json({ data: [], weeks: [], weekObjects: [] });
    }

    const targetWeeks = weeksResult.rows.map(r => r.month_name);

    // 1. Fetch Piezometer Data (deduplicated: latest record per piezometer per week)
    let dataQuery = `
      SELECT DISTINCT ON (p.pie_record_id, p.month_name)
             p.data_taken, p.est_code, 
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
    // DISTINCT ON requires ORDER BY matching the DISTINCT ON columns first, then the tiebreaker
    dataQuery += ` ORDER BY p.pie_record_id, p.month_name, p.date_timestamp DESC`;
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
        weekObjects: weeksResult.rows.map(r => ({
            formatted_name: r.month_name,
            start_date: r.start_date,
            end_date: r.end_date
        })),
        rainfall: rainfallMap,
        estateRainfall: estateRainfallMap
    });

  } catch (err) {
    console.error(err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
