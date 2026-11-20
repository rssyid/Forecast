import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
dotenv.config({ path: path.resolve(__dirname, '../.env.local') });

import pg from 'pg';
const { Pool } = pg;

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false }
});

const LOGIN_URL = "https://app.gis-div.com/PZO/Default.aspx";
const LIST_ESTATE_URL = "https://app.gis-div.com/PZO/Service/MapService.asmx/ListAllEstate";
const LIST_PIEZO_URL = "https://app.gis-div.com/PZO/Service/WebServiceMasterPiezo.asmx/ListHistoryDAftarPizometer";

const USERNAME = "rasyid";
const PASSWORD = "spasienter";

/**
 * Perform login to GIS PZO and retrieve ASP.NET session cookie
 */
async function login() {
  console.log("Mengautentikasi ke portal GIS PZO...");
  const headers = {
    "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
    "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
  };

  // Step 1: Initial GET with redirect: 'manual' to get initial ASP.NET_SessionId
  const initialResp = await fetch(LOGIN_URL, { headers, redirect: 'manual' });
  let initialCookie = '';
  const setCookies = initialResp.headers.getSetCookie ? initialResp.headers.getSetCookie() : [initialResp.headers.get('set-cookie') || ''];
  if (setCookies && setCookies.length > 0 && setCookies[0]) {
    initialCookie = setCookies[0].split(';')[0];
  }

  // Step 2: GET login page with session cookie to receive the form HTML
  const pageResp = await fetch(LOGIN_URL, {
    headers: { ...headers, Cookie: initialCookie }
  });
  if (!pageResp.ok) {
    throw new Error(`Gagal membuka halaman login. Status: ${pageResp.status}`);
  }

  const html = await pageResp.text();

  // Extract hidden inputs (__VIEWSTATE, __EVENTVALIDATION, etc.)
  const getHiddenVal = (name) => {
    const m = html.match(new RegExp(`name=["']${name}["'][^>]*value=["']([^"']*)["']`, 'i')) ||
              html.match(new RegExp(`value=["']([^"']*)["'][^>]*name=["']${name}["']`, 'i'));
    return m ? m[1] : '';
  };

  const formData = new URLSearchParams();
  formData.append('__LASTFOCUS', '');
  formData.append('__EVENTTARGET', '');
  formData.append('__EVENTARGUMENT', '');
  formData.append('__VIEWSTATE', getHiddenVal('__VIEWSTATE'));
  formData.append('__VIEWSTATEGENERATOR', getHiddenVal('__VIEWSTATEGENERATOR'));
  formData.append('__EVENTVALIDATION', getHiddenVal('__EVENTVALIDATION'));
  formData.append('txtBoxUsername', USERNAME);
  formData.append('txtBoxPassword', PASSWORD);
  formData.append('btnLogin', 'MASUK');

  // Step 3: POST credentials
  const postResp = await fetch(LOGIN_URL, {
    method: 'POST',
    headers: {
      ...headers,
      'Content-Type': 'application/x-www-form-urlencoded',
      'Cookie': initialCookie,
      'Origin': 'https://app.gis-div.com',
      'Referer': LOGIN_URL
    },
    body: formData.toString(),
    redirect: 'manual'
  });

  let authCookie = initialCookie;
  const postCookies = postResp.headers.getSetCookie ? postResp.headers.getSetCookie() : [postResp.headers.get('set-cookie') || ''];
  if (postCookies && postCookies.length > 0 && postCookies[0]) {
    const c = postCookies[0].split(';')[0];
    if (c) authCookie = c;
  }

  console.log(`Autentikasi berhasil! (Cookie: ${authCookie.split('=')[0]})`);
  return authCookie;
}

/**
 * Fetch all estates from PZO WebService
 */
async function fetchEstates(cookie) {
  console.log("Mengambil daftar seluruh kebun...");
  const resp = await fetch(LIST_ESTATE_URL, {
    method: 'POST',
    headers: {
      'User-Agent': 'Mozilla/5.0',
      'Content-Type': 'application/json; charset=utf-8',
      'Cookie': cookie,
      'Referer': 'https://app.gis-div.com/PZO/Content/PZO_MasterPiezo.aspx'
    },
    body: JSON.stringify({})
  });

  if (!resp.ok) {
    throw new Error(`Gagal mengambil data kebun: ${resp.status}`);
  }

  const json = await resp.json();
  const estates = JSON.parse(json.d);
  console.log(`Ditemukan ${estates.length} kebun.`);
  return estates;
}

/**
 * Fetch master piezometers for a specific estate
 */
async function fetchPiezometers(estCode, cookie) {
  const resp = await fetch(LIST_PIEZO_URL, {
    method: 'POST',
    headers: {
      'User-Agent': 'Mozilla/5.0',
      'Content-Type': 'application/json; charset=utf-8',
      'Cookie': cookie,
      'Referer': 'https://app.gis-div.com/PZO/Content/PZO_MasterPiezo.aspx'
    },
    body: JSON.stringify({ estCode: estCode, type: "1" }) // type: "1" = All
  });

  if (!resp.ok) {
    console.error(`Gagal fetch piezo untuk kebun ${estCode}: ${resp.status}`);
    return [];
  }

  const json = await resp.json();
  if (!json || !json.d) return [];
  try {
    return JSON.parse(json.d);
  } catch (e) {
    console.error(`Gagal parse JSON untuk kebun ${estCode}:`, e.message);
    return [];
  }
}

/**
 * Ensure table and unique constraints exist
 */
async function ensureTable() {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS pzo_master_mapping (
        id SERIAL PRIMARY KEY,
        pie_record_id TEXT NOT NULL,
        block_id TEXT NOT NULL,
        company_code TEXT,
        est_code TEXT,
        is_active BOOLEAN DEFAULT TRUE,
        device_name_iot TEXT,
        UNIQUE(pie_record_id, block_id)
    );
  `);
}

/**
 * Batch upsert records into PostgreSQL
 */
async function upsertBatch(client, records) {
  if (records.length === 0) return 0;

  const chunkSize = 200;
  let inserted = 0;

  for (let i = 0; i < records.length; i += chunkSize) {
    const chunk = records.slice(i, i + chunkSize);
    const valueClauses = [];
    const params = [];

    chunk.forEach((r, idx) => {
      const base = idx * 6;
      valueClauses.push(`($${base + 1}, $${base + 2}, $${base + 3}, $${base + 4}, $${base + 5}, $${base + 6})`);
      params.push(r.pie_record_id, r.block_id, r.company_code, r.est_code, r.is_active, r.device_name_iot);
    });

    const query = `
      INSERT INTO pzo_master_mapping (pie_record_id, block_id, company_code, est_code, is_active, device_name_iot)
      VALUES ${valueClauses.join(', ')}
      ON CONFLICT (pie_record_id, block_id) DO UPDATE SET
        company_code = EXCLUDED.company_code,
        est_code = EXCLUDED.est_code,
        is_active = EXCLUDED.is_active,
        device_name_iot = EXCLUDED.device_name_iot;
    `;

    await client.query(query, params);
    inserted += chunk.length;
  }

  return inserted;
}

/**
 * Main Execution Function
 */
async function main() {
  console.log("=== SINKRONISASI MASTER PIEZOMETER KE DATABASE ===");
  const startTime = Date.now();

  await ensureTable();
  const cookie = await login();
  const estates = await fetchEstates(cookie);

  let totalRawStations = 0;
  let totalFlattenedRows = 0;
  let totalMultiBlockStations = 0;
  const allRows = [];
  const seenKeys = new Set();

  console.log("\nMemulai penarikan data per kebun & pemecahan multi-block...");

  for (let idx = 0; idx < estates.length; idx++) {
    const est = estates[idx];
    const estCode = est.EstCode;
    const companyCode = est.EstNewCode || estCode;

    const stations = await fetchPiezometers(estCode, cookie);
    totalRawStations += stations.length;

    let estateFlattened = 0;
    let estateMultiBlock = 0;

    for (const st of stations) {
      const pieId = (st.idUnitPemantauan || '').trim();
      const mappingStr = (st.Mapping || '').trim();
      const isActive = (st.IsActive || '').toUpperCase() === 'TRUE';
      const deviceName = (st.deviceNameIOT || '').trim() || null;

      if (!pieId) continue;

      // Split multiple blocks separated by comma
      const blocks = mappingStr
        .split(',')
        .map(b => b.trim())
        .filter(Boolean);

      if (blocks.length > 1) {
        estateMultiBlock++;
      }

      // If mapping was empty, fallback to st.UnitPemantauan or ignore
      const targetBlocks = blocks.length > 0 ? blocks : [(st.UnitPemantauan || '').trim()].filter(Boolean);

      for (const block of targetBlocks) {
        const dedupeKey = `${pieId}|${block}`;
        if (!seenKeys.has(dedupeKey)) {
          seenKeys.add(dedupeKey);
          allRows.push({
            pie_record_id: pieId,
            block_id: block,
            company_code: companyCode,
            est_code: estCode,
            is_active: isActive,
            device_name_iot: deviceName
          });
          estateFlattened++;
        }
      }
    }

    totalMultiBlockStations += estateMultiBlock;
    totalFlattenedRows += estateFlattened;

    console.log(
      `[${(idx + 1).toString().padStart(2, '0')}/${estates.length}] Kebun ${estCode.padEnd(5)} (${companyCode.padEnd(6)}): ` +
      `${stations.length.toString().padStart(3)} stasiun -> ${estateFlattened.toString().padStart(3)} baris ` +
      `(${estateMultiBlock} stasiun multi-block)`
    );
  }

  console.log(`\nMenyimpan ${allRows.length} baris ke tabel database pzo_master_mapping...`);
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const upsertedCount = await upsertBatch(client, allRows);
    await client.query('COMMIT');
    console.log(`Berhasil menyimpan/mengupdate ${upsertedCount} baris ke database!`);
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }

  const durationSec = ((Date.now() - startTime) / 1000).toFixed(1);
  console.log("\n=== RINGKASAN SINKRONISASI ===");
  console.log(`- Total Kebun Diproses       : ${estates.length}`);
  console.log(`- Total Stasiun Piezo Asli   : ${totalRawStations}`);
  console.log(`- Stasiun dengan Multi-Block : ${totalMultiBlockStations}`);
  console.log(`- Total Baris Database       : ${totalFlattenedRows}`);
  console.log(`- Durasi Waktu               : ${durationSec} detik`);
  console.log("==============================\n");

  await pool.end();
}

main().catch(async (err) => {
  console.error("Fatal Error saat sinkronisasi:", err);
  try {
    await pool.end();
  } catch (_) {}
  process.exit(1);
});
