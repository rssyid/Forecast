import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// Load .env.local manually for standalone execution
const envPath = path.join(__dirname, '..', '.env.local');
if (fs.existsSync(envPath)) {
    fs.readFileSync(envPath, 'utf8').split('\n').forEach(line => {
        const trimmed = line.trim();
        if (trimmed && !trimmed.startsWith('#')) {
            const eqIdx = trimmed.indexOf('=');
            if (eqIdx > 0) {
                const key = trimmed.slice(0, eqIdx).trim();
                let val = trimmed.slice(eqIdx + 1).trim();
                if ((val.startsWith("'") && val.endsWith("'")) || (val.startsWith('"') && val.endsWith('"'))) {
                    val = val.slice(1, -1);
                }
                process.env[key] = process.env[key] || val;
            }
        }
    });
    console.log('✅ .env.local loaded');
}

const rawData = [
  {"Month":1,"Year":2025,"Week":1,"StartDate":"2024-12-30","EndDate":"2025-01-05","WeekName":"W112025"},
  {"Month":1,"Year":2025,"Week":2,"StartDate":"2025-01-06","EndDate":"2025-01-12","WeekName":"W212025"},
  {"Month":1,"Year":2025,"Week":3,"StartDate":"2025-01-13","EndDate":"2025-01-19","WeekName":"W312025"},
  {"Month":1,"Year":2025,"Week":4,"StartDate":"2025-01-20","EndDate":"2025-01-26","WeekName":"W412025"},
  {"Month":1,"Year":2025,"Week":5,"StartDate":"2025-01-27","EndDate":"2025-02-02","WeekName":"W512025"},
  {"Month":2,"Year":2025,"Week":1,"StartDate":"2025-02-03","EndDate":"2025-02-09","WeekName":"W122025"},
  {"Month":2,"Year":2025,"Week":2,"StartDate":"2025-02-10","EndDate":"2025-02-16","WeekName":"W222025"},
  {"Month":2,"Year":2025,"Week":3,"StartDate":"2025-02-17","EndDate":"2025-02-23","WeekName":"W322025"},
  {"Month":2,"Year":2025,"Week":4,"StartDate":"2025-02-24","EndDate":"2025-03-02","WeekName":"W42025"},
  {"Month":3,"Year":2025,"Week":1,"StartDate":"2025-03-03","EndDate":"2025-03-09","WeekName":"W132025"},
  {"Month":3,"Year":2025,"Week":2,"StartDate":"2025-03-10","EndDate":"2025-03-16","WeekName":"W232025"},
  {"Month":3,"Year":2025,"Week":3,"StartDate":"2025-03-17","EndDate":"2025-03-23","WeekName":"W332025"},
  {"Month":3,"Year":2025,"Week":4,"StartDate":"2025-03-24","EndDate":"2025-03-30","WeekName":"W432025"},
  {"Month":4,"Year":2025,"Week":1,"StartDate":"2025-03-31","EndDate":"2025-04-06","WeekName":"W142025"},
  {"Month":4,"Year":2025,"Week":2,"StartDate":"2025-04-07","EndDate":"2025-04-13","WeekName":"W242025"},
  {"Month":4,"Year":2025,"Week":3,"StartDate":"2025-04-14","EndDate":"2025-04-20","WeekName":"W342025"},
  {"Month":4,"Year":2025,"Week":4,"StartDate":"2025-04-21","EndDate":"2025-04-27","WeekName":"W442025"},
  {"Month":5,"Year":2025,"Week":1,"StartDate":"2025-04-28","EndDate":"2025-05-04","WeekName":"W152025"},
  {"Month":5,"Year":2025,"Week":2,"StartDate":"2025-05-05","EndDate":"2025-05-11","WeekName":"W252025"},
  {"Month":5,"Year":2025,"Week":3,"StartDate":"2025-05-12","EndDate":"2025-05-18","WeekName":"W352025"},
  {"Month":5,"Year":2025,"Week":4,"StartDate":"2025-05-19","EndDate":"2025-05-25","WeekName":"W452025"},
  {"Month":5,"Year":2025,"Week":5,"StartDate":"2025-05-26","EndDate":"2025-06-01","WeekName":"W552025"},
  {"Month":6,"Year":2025,"Week":1,"StartDate":"2025-06-02","EndDate":"2025-06-08","WeekName":"W162025"},
  {"Month":6,"Year":2025,"Week":2,"StartDate":"2025-06-09","EndDate":"2025-06-15","WeekName":"W262025"},
  {"Month":6,"Year":2025,"Week":3,"StartDate":"2025-06-16","EndDate":"2025-06-22","WeekName":"W362025"},
  {"Month":6,"Year":2025,"Week":4,"StartDate":"2025-06-23","EndDate":"2025-06-29","WeekName":"W462025"},
  {"Month":7,"Year":2025,"Week":1,"StartDate":"2025-06-30","EndDate":"2025-07-06","WeekName":"W172025"},
  {"Month":7,"Year":2025,"Week":2,"StartDate":"2025-07-07","EndDate":"2025-07-13","WeekName":"W272025"},
  {"Month":7,"Year":2025,"Week":3,"StartDate":"2025-07-14","EndDate":"2025-07-20","WeekName":"W372025"},
  {"Month":7,"Year":2025,"Week":4,"StartDate":"2025-07-21","EndDate":"2025-07-27","WeekName":"W472025"},
  {"Month":7,"Year":2025,"Week":5,"StartDate":"2025-07-28","EndDate":"2025-08-03","WeekName":"W572025"},
  {"Month":8,"Year":2025,"Week":1,"StartDate":"2025-08-04","EndDate":"2025-08-10","WeekName":"W182025"},
  {"Month":8,"Year":2025,"Week":2,"StartDate":"2025-08-11","EndDate":"2025-08-17","WeekName":"W282025"},
  {"Month":8,"Year":2025,"Week":3,"StartDate":"2025-08-18","EndDate":"2025-08-24","WeekName":"W382025"},
  {"Month":8,"Year":2025,"Week":4,"StartDate":"2025-08-25","EndDate":"2025-08-31","WeekName":"W482025"},
  {"Month":9,"Year":2025,"Week":1,"StartDate":"2025-09-01","EndDate":"2025-09-07","WeekName":"W192025"},
  {"Month":9,"Year":2025,"Week":2,"StartDate":"2025-09-08","EndDate":"2025-09-14","WeekName":"W292025"},
  {"Month":9,"Year":2025,"Week":3,"StartDate":"2025-09-15","EndDate":"2025-09-21","WeekName":"W392025"},
  {"Month":9,"Year":2025,"Week":4,"StartDate":"2025-09-22","EndDate":"2025-09-28","WeekName":"W492025"},
  {"Month":10,"Year":2025,"Week":1,"StartDate":"2025-09-29","EndDate":"2025-10-05","WeekName":"W1102025"},
  {"Month":10,"Year":2025,"Week":2,"StartDate":"2025-10-06","EndDate":"2025-10-12","WeekName":"W2102025"},
  {"Month":10,"Year":2025,"Week":3,"StartDate":"2025-10-13","EndDate":"2025-10-19","WeekName":"W3102025"},
  {"Month":10,"Year":2025,"Week":4,"StartDate":"2025-10-20","EndDate":"2025-10-26","WeekName":"W4102025"},
  {"Month":10,"Year":2025,"Week":5,"StartDate":"2025-10-27","EndDate":"2025-11-02","WeekName":"W5102025"},
  {"Month":11,"Year":2025,"Week":1,"StartDate":"2025-11-03","EndDate":"2025-11-09","WeekName":"W1112025"},
  {"Month":11,"Year":2025,"Week":2,"StartDate":"2025-11-10","EndDate":"2025-11-16","WeekName":"W2112025"},
  {"Month":11,"Year":2025,"Week":3,"StartDate":"2025-11-17","EndDate":"2025-11-23","WeekName":"W3112025"},
  {"Month":11,"Year":2025,"Week":4,"StartDate":"2025-11-24","EndDate":"2025-11-30","WeekName":"W4112025"},
  {"Month":12,"Year":2025,"Week":1,"StartDate":"2025-12-01","EndDate":"2025-12-07","WeekName":"W1122025"},
  {"Month":12,"Year":2025,"Week":2,"StartDate":"2025-12-08","EndDate":"2025-12-14","WeekName":"W2122025"},
  {"Month":12,"Year":2025,"Week":3,"StartDate":"2025-12-15","EndDate":"2025-12-21","WeekName":"W3122025"},
  {"Month":12,"Year":2025,"Week":4,"StartDate":"2025-12-22","EndDate":"2025-12-28","WeekName":"W4122025"},
  {"Month":1,"Year":2026,"Week":1,"StartDate":"2025-12-29","EndDate":"2026-01-04","WeekName":"W112026"},
  {"Month":1,"Year":2026,"Week":2,"StartDate":"2026-01-05","EndDate":"2026-01-11","WeekName":"W212026"},
  {"Month":1,"Year":2026,"Week":3,"StartDate":"2026-01-12","EndDate":"2026-01-18","WeekName":"W312026"},
  {"Month":1,"Year":2026,"Week":4,"StartDate":"2026-01-19","EndDate":"2026-01-25","WeekName":"W412026"},
  {"Month":1,"Year":2026,"Week":5,"StartDate":"2026-01-26","EndDate":"2026-02-01","WeekName":"W512026"},
  {"Month":2,"Year":2026,"Week":1,"StartDate":"2026-02-02","EndDate":"2026-02-08","WeekName":"W122026"},
  {"Month":2,"Year":2026,"Week":2,"StartDate":"2026-02-09","EndDate":"2026-02-15","WeekName":"W222026"},
  {"Month":2,"Year":2026,"Week":3,"StartDate":"2026-02-16","EndDate":"2026-02-22","WeekName":"W322026"},
  {"Month":2,"Year":2026,"Week":4,"StartDate":"2026-02-23","EndDate":"2026-03-01","WeekName":"W422026"},
  {"Month":3,"Year":2026,"Week":1,"StartDate":"2026-03-02","EndDate":"2026-03-08","WeekName":"W132026"},
  {"Month":3,"Year":2026,"Week":2,"StartDate":"2026-03-09","EndDate":"2026-03-15","WeekName":"W232026"},
  {"Month":3,"Year":2026,"Week":3,"StartDate":"2026-03-16","EndDate":"2026-03-22","WeekName":"W332026"},
  {"Month":3,"Year":2026,"Week":4,"StartDate":"2026-03-23","EndDate":"2026-03-29","WeekName":"W432026"},
  {"Month":4,"Year":2026,"Week":1,"StartDate":"2026-03-30","EndDate":"2026-04-05","WeekName":"W142026"},
  {"Month":4,"Year":2026,"Week":2,"StartDate":"2026-04-06","EndDate":"2026-04-12","WeekName":"W242026"},
  {"Month":4,"Year":2026,"Week":3,"StartDate":"2026-04-13","EndDate":"2026-04-19","WeekName":"W342026"},
  {"Month":4,"Year":2026,"Week":4,"StartDate":"2026-04-20","EndDate":"2026-04-26","WeekName":"W442026"},
  {"Month":4,"Year":2026,"Week":5,"StartDate":"2026-04-27","EndDate":"2026-05-03","WeekName":"W542026"},
  {"Month":5,"Year":2026,"Week":1,"StartDate":"2026-05-04","EndDate":"2026-05-10","WeekName":"W152026"},
  {"Month":5,"Year":2026,"Week":2,"StartDate":"2026-05-11","EndDate":"2026-05-17","WeekName":"W252026"},
  {"Month":5,"Year":2026,"Week":3,"StartDate":"2026-05-18","EndDate":"2026-05-24","WeekName":"W352026"},
  {"Month":5,"Year":2026,"Week":4,"StartDate":"2026-05-25","EndDate":"2026-05-31","WeekName":"W452026"},
  {"Month":6,"Year":2026,"Week":1,"StartDate":"2026-06-01","EndDate":"2026-06-07","WeekName":"W162026"},
  {"Month":6,"Year":2026,"Week":2,"StartDate":"2026-06-08","EndDate":"2026-06-14","WeekName":"W262026"},
  {"Month":6,"Year":2026,"Week":3,"StartDate":"2026-06-15","EndDate":"2026-06-21","WeekName":"W362026"},
  {"Month":6,"Year":2026,"Week":4,"StartDate":"2026-06-22","EndDate":"2026-06-28","WeekName":"W462026"},
  {"Month":7,"Year":2026,"Week":1,"StartDate":"2026-06-29","EndDate":"2026-07-05","WeekName":"W172026"},
  {"Month":7,"Year":2026,"Week":2,"StartDate":"2026-07-06","EndDate":"2026-07-12","WeekName":"W272026"},
  {"Month":7,"Year":2026,"Week":3,"StartDate":"2026-07-13","EndDate":"2026-07-19","WeekName":"W372026"},
  {"Month":7,"Year":2026,"Week":4,"StartDate":"2026-07-20","EndDate":"2026-07-26","WeekName":"W472026"},
  {"Month":7,"Year":2026,"Week":5,"StartDate":"2026-07-27","EndDate":"2026-08-02","WeekName":"W572026"},
  {"Month":8,"Year":2026,"Week":1,"StartDate":"2026-08-03","EndDate":"2026-08-09","WeekName":"W182026"},
  {"Month":8,"Year":2026,"Week":2,"StartDate":"2026-08-10","EndDate":"2026-08-16","WeekName":"W282026"},
  {"Month":8,"Year":2026,"Week":3,"StartDate":"2026-08-17","EndDate":"2026-08-23","WeekName":"W382026"},
  {"Month":8,"Year":2026,"Week":4,"StartDate":"2026-08-24","EndDate":"2026-08-30","WeekName":"W482026"},
  {"Month":9,"Year":2026,"Week":1,"StartDate":"2026-08-31","EndDate":"2026-09-06","WeekName":"W192026"},
  {"Month":9,"Year":2026,"Week":2,"StartDate":"2026-09-07","EndDate":"2026-09-13","WeekName":"W292026"},
  {"Month":9,"Year":2026,"Week":3,"StartDate":"2026-09-14","EndDate":"2026-09-20","WeekName":"W392026"},
  {"Month":9,"Year":2026,"Week":4,"StartDate":"2026-09-21","EndDate":"2026-09-27","WeekName":"W492026"},
  {"Month":10,"Year":2026,"Week":1,"StartDate":"2026-09-28","EndDate":"2026-10-04","WeekName":"W1102026"},
  {"Month":10,"Year":2026,"Week":2,"StartDate":"2026-10-05","EndDate":"2026-10-11","WeekName":"W2102026"},
  {"Month":10,"Year":2026,"Week":3,"StartDate":"2026-10-12","EndDate":"2026-10-18","WeekName":"W3102026"},
  {"Month":10,"Year":2026,"Week":4,"StartDate":"2026-10-19","EndDate":"2026-10-25","WeekName":"W4102026"},
  {"Month":10,"Year":2026,"Week":5,"StartDate":"2026-10-26","EndDate":"2026-11-01","WeekName":"W5102026"},
  {"Month":11,"Year":2026,"Week":1,"StartDate":"2026-11-02","EndDate":"2026-11-08","WeekName":"W1112026"},
  {"Month":11,"Year":2026,"Week":2,"StartDate":"2026-11-09","EndDate":"2026-11-15","WeekName":"W2112026"},
  {"Month":11,"Year":2026,"Week":3,"StartDate":"2026-11-16","EndDate":"2026-11-22","WeekName":"W3112026"},
  {"Month":11,"Year":2026,"Week":4,"StartDate":"2026-11-23","EndDate":"2026-11-29","WeekName":"W4112026"},
  {"Month":12,"Year":2026,"Week":1,"StartDate":"2026-11-30","EndDate":"2026-12-06","WeekName":"W1122026"},
  {"Month":12,"Year":2026,"Week":2,"StartDate":"2026-12-07","EndDate":"2026-12-13","WeekName":"W2122026"},
  {"Month":12,"Year":2026,"Week":3,"StartDate":"2026-12-14","EndDate":"2026-12-20","WeekName":"W3122026"},
  {"Month":12,"Year":2026,"Week":4,"StartDate":"2026-12-21","EndDate":"2026-12-27","WeekName":"W4122026"},
  {"Month":12,"Year":2026,"Week":5,"StartDate":"2026-12-28","EndDate":"2027-01-03","WeekName":"W5122026"}
];

const monthNames = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

async function seed() {
  const { default: pool } = await import('../lib/db.js');

  await pool.query(`
    CREATE TABLE IF NOT EXISTS public.calendar_weeks (
      id SERIAL PRIMARY KEY,
      month INTEGER,
      year INTEGER,
      week INTEGER,
      start_date DATE,
      end_date DATE,
      week_name VARCHAR(20),
      formatted_name VARCHAR(50) UNIQUE
    );
  `);
  
  let inserted = 0;
  for (const row of rawData) {
    const formattedName = `${monthNames[row.Month - 1]} ${row.Year}, W${row.Week}`;
    const query = `
      INSERT INTO public.calendar_weeks (month, year, week, start_date, end_date, week_name, formatted_name)
      VALUES ($1, $2, $3, $4, $5, $6, $7)
      ON CONFLICT (formatted_name) DO UPDATE SET
        start_date = EXCLUDED.start_date,
        end_date = EXCLUDED.end_date
    `;
    await pool.query(query, [
      row.Month, row.Year, row.Week, row.StartDate, row.EndDate, row.WeekName, formattedName
    ]);
    inserted++;
  }
  
  console.log(`Seeded ${inserted} weeks into calendar_weeks table.`);
  process.exit(0);
}

seed().catch(e => {
  console.error("Fatal Error seeding weeks:", e);
  process.exit(1);
});
