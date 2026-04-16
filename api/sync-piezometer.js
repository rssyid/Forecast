import pool from '../lib/db.js';

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed. Use POST.' });
  }
  
  // This endpoint expects parsing specific parameters from the client
  const { companyCode, startDate, endDate } = req.body;

  if (!companyCode || !startDate || !endDate) {
    return res.status(400).json({ error: 'Missing parameters. Requires companyCode, startDate, endDate' });
  }

  const API_URL = "https://app.gis-div.com/PZO/Service/MapService.asmx/GetDataPiezometer";
  
  try {
    const response = await fetch(API_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ CompanyCode: companyCode, EstCode: "", StartDate: startDate, EndDate: endDate })
    });

    if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);
    
    const json = await response.json();
    if (!json.d) return res.status(200).json({ message: "No data found", count: 0 });

    let cleanedStr = json.d.replace(/\\\\"/g, '"');
    let parsed = [];
    try {
      parsed = JSON.parse(cleanedStr);
    } catch(e) {
      parsed = JSON.parse(json.d);
    }
    
    if (parsed.length === 0) return res.status(200).json({ message: "Empty data", count: 0 });

    const query = `
      INSERT INTO piezometer_data (
        company_code, data_taken, est_code, block, pie_record_id, ketinggian, 
        indicator_name, indicator_alias, month_name, date_timestamp, 
        banyak, url_images
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)
      ON CONFLICT (pie_record_id, date_timestamp) DO UPDATE SET
        company_code = EXCLUDED.company_code,
        ketinggian = EXCLUDED.ketinggian,
        indicator_name = EXCLUDED.indicator_name,
        indicator_alias = EXCLUDED.indicator_alias,
        month_name = EXCLUDED.month_name,
        banyak = EXCLUDED.banyak,
        url_images = EXCLUDED.url_images;
    `;

    let count = 0;
    for (const item of parsed) {
      await pool.query(query, [
        companyCode, item.DataTaken || "", item.EstCode || "", item.Block || "", 
        item.PieRecordID || "", item.Ketinggian || 0,
        item.IndicatorName || "", item.IndicatorAlias || "", 
        item.MonthName || "", item.Date || 0,
        item.banyak || 1, item.urlImages || ""
      ]);
      count++;
    }

    return res.status(200).json({ message: "Success", inserted: count });

  } catch (error) {
    console.error(error);
    return res.status(500).json({ error: error.message });
  }
}
