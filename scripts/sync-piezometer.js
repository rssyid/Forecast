import pool from '../lib/db.js';

const companies = [
  "PT.THIP", "PT.PTW", "PT.SUMS", "PT.WKN", "PT.PANPS", "PT.SAM", 
  "PT.NJP", "PT.PLDK", "PT.SUMK", "PT.BAS", "PT.AAN", "PT.GAN", 
  "PT.AJP", "PT.JJP", "PT.SIP", "PT.WSM"
];

const API_URL = "https://app.gis-div.com/PZO/Service/MapService.asmx/GetDataPiezometer";

async function createTableIfNotExists() {
  const query = `
    CREATE TABLE IF NOT EXISTS piezometer_data (
      id SERIAL PRIMARY KEY,
      data_taken VARCHAR(255),
      est_code VARCHAR(50),
      block VARCHAR(50),
      pie_record_id VARCHAR(100),
      ketinggian INTEGER,
      indicator_name VARCHAR(50),
      indicator_alias VARCHAR(100),
      month_name VARCHAR(100),
      date_timestamp BIGINT,
      banyak INTEGER,
      url_images TEXT,
      UNIQUE(pie_record_id, date_timestamp)
    );
  `;
  await pool.query(query);
  console.log("Table 'piezometer_data' is initialized.");
}

// Function to chunk months
function generateDateRanges(startYear, startMonth, endYear, endMonth) {
  const ranges = [];
  let currentYear = startYear;
  let currentMonth = startMonth;

  while (currentYear < endYear || (currentYear === endYear && currentMonth <= endMonth)) {
    // start date of current month
    const startDate = `${currentYear}-${currentMonth}-01`;
    // end date of current month
    const endDateObj = new Date(currentYear, currentMonth, 0); // last day of month
    const endDate = `${currentYear}-${currentMonth}-${endDateObj.getDate()}`;
    
    ranges.push({ startDate, endDate });

    currentMonth++;
    if (currentMonth > 12) {
      currentMonth = 1;
      currentYear++;
    }
  }
  return ranges;
}

async function fetchData(companyCode, startDate, endDate) {
  const payload = {
    CompanyCode: companyCode,
    EstCode: "",
    StartDate: startDate,
    EndDate: endDate
  };

  try {
    const response = await fetch(API_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify(payload)
    });

    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }

    const json = await response.json();
    if (!json.d) return [];

    // The result from .asmx is sometimes escaped.
    let cleanedStr = json.d.replace(/\\\\"/g, '"');
    let parsed = [];
    try {
      parsed = JSON.parse(cleanedStr);
    } catch (e) {
        // Fallback in case there are no strict escapes
        parsed = JSON.parse(json.d);
    }
    return parsed;
  } catch (err) {
    console.error(`Error fetching data for ${companyCode} (${startDate}-${endDate}): ${err.message}`);
    return [];
  }
}

async function syncAll() {
  await createTableIfNotExists();

  const now = new Date();
  const ranges = generateDateRanges(2025, 1, now.getFullYear(), now.getMonth() + 1);

  console.log(`Starting sync for ${companies.length} companies across ${ranges.length} months...`);

  let totalInserted = 0;

  for (const company of companies) {
    console.log(`\n--- Syncing Company: ${company} ---`);
    for (const range of ranges) {
      console.log(`Fetching ${range.startDate} to ${range.endDate}...`);
      const data = await fetchData(company, range.startDate, range.endDate);
      
      if (data && data.length > 0) {
        let insertedCount = 0;
        for (const item of data) {
          const query = `
            INSERT INTO piezometer_data (
              data_taken, est_code, block, pie_record_id, ketinggian, 
              indicator_name, indicator_alias, month_name, date_timestamp, 
              banyak, url_images
            ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
            ON CONFLICT (pie_record_id, date_timestamp) DO UPDATE SET
              ketinggian = EXCLUDED.ketinggian,
              indicator_name = EXCLUDED.indicator_name,
              indicator_alias = EXCLUDED.indicator_alias,
              month_name = EXCLUDED.month_name,
              banyak = EXCLUDED.banyak,
              url_images = EXCLUDED.url_images;
          `;
          const values = [
            item.DataTaken || "", item.EstCode || "", item.Block || "", 
            item.PieRecordID || "", item.Ketinggian || 0,
            item.IndicatorName || "", item.IndicatorAlias || "", 
            item.MonthName || "", item.Date || 0,
            item.banyak || 1, item.urlImages || ""
          ];
          await pool.query(query, values);
          insertedCount++;
        }
        totalInserted += insertedCount;
        console.log(`✔️ Upserted ${insertedCount} records.`);
      } else {
        console.log(`No records found.`);
      }
      
      // Delay slightly to be nice to the API source
      await new Promise(resolve => setTimeout(resolve, 500));
    }
  }

  console.log(`\n✅ Sync complete! Total records processed: ${totalInserted}`);
  process.exit(0);
}

syncAll().catch(err => {
  console.error("Fatal error:", err);
  process.exit(1);
});
