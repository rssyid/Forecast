import pool from '../../../lib/db';
import { NextResponse } from 'next/server';

export async function GET(request) {
    const { searchParams } = new URL(request.url);
    const company = searchParams.get('company') || 'Semua';
    const estate = searchParams.get('estate') || 'Semua';
    const days = parseInt(searchParams.get('days') || '30');

    try {
        let whereClause = '';
        const params = [];
        let pIdx = 1;

        if (company !== 'Semua') {
            whereClause += ` AND p.company_code = $${pIdx}`;
            params.push(company);
            pIdx++;
        }
        if (estate !== 'Semua') {
            whereClause += ` AND p.est_code = $${pIdx}`;
            params.push(estate);
            pIdx++;
        }

        const query = `
            WITH daily_tmat AS (
                SELECT 
                    company_code,
                    est_code, 
                    date_trunc('day', date_timestamp)::date as day_date,
                    AVG(ketinggian) as avg_tmat
                FROM piezometer_data p
                WHERE date_timestamp >= NOW() - INTERVAL '${days} days'
                ${whereClause}
                GROUP BY 1, 2, 3
            ),
            tmat_diff AS (
                SELECT 
                    est_code,
                    day_date,
                    avg_tmat,
                    avg_tmat - LAG(avg_tmat) OVER (PARTITION BY est_code ORDER BY day_date) as delta_tmat
                FROM daily_tmat
            ),
            daily_rain AS (
                SELECT 
                    est_code, 
                    record_date,
                    SUM(rainfall_mm) as rainfall_mm
                FROM daily_rainfall
                WHERE record_date >= NOW() - INTERVAL '${days} days'
                GROUP BY 1, 2
            )
            SELECT 
                t.est_code, 
                t.day_date, 
                t.avg_tmat,
                t.delta_tmat, 
                r.rainfall_mm
            FROM tmat_diff t
            JOIN daily_rain r ON t.est_code = r.est_code AND t.day_date = r.record_date
            WHERE t.delta_tmat IS NOT NULL
            ORDER BY t.day_date DESC
        `;

        const res = await pool.query(query, params);
        const data = res.rows;

        // Calculate Correlation (Pearson)
        // r = n(Σxy) - (Σx)(Σy) / sqrt([nΣx^2 - (Σx)^2][nΣy^2 - (Σy)^2])
        const n = data.length;
        if (n < 2) {
            return NextResponse.json({ data, correlation: 0, slope: 0 });
        }

        let sumX = 0, sumY = 0, sumXY = 0, sumX2 = 0, sumY2 = 0;
        data.forEach(d => {
            const x = parseFloat(d.rainfall_mm);
            const y = parseFloat(d.delta_tmat); // We correlate Rain with Change in TMAT
            sumX += x;
            sumY += y;
            sumXY += (x * y);
            sumX2 += (x * x);
            sumY2 += (y * y);
        });

        const numerator = (n * sumXY) - (sumX * sumY);
        const denominator = Math.sqrt((n * sumX2 - Math.pow(sumX, 2)) * (n * sumY2 - Math.pow(sumY, 2)));
        const correlation = denominator === 0 ? 0 : numerator / denominator;

        // Linear Regression (y = mx + c)
        // m = nΣxy - ΣxΣy / nΣx^2 - (Σx)^2
        const mNumerator = (n * sumXY) - (sumX * sumY);
        const mDenominator = (n * sumX2) - Math.pow(sumX, 2);
        const slope = mDenominator === 0 ? 0 : mNumerator / mDenominator;
        const intercept = (sumY - (slope * sumX)) / n;

        return NextResponse.json({ 
            data, 
            correlation: parseFloat(correlation.toFixed(3)),
            slope: parseFloat(slope.toFixed(4)),
            intercept: parseFloat(intercept.toFixed(4)),
            stats: {
                count: n,
                avgRain: sumX / n,
                avgDelta: sumY / n
            }
        });

    } catch (err) {
        console.error(err);
        return NextResponse.json({ error: err.message }, { status: 500 });
    }
}
