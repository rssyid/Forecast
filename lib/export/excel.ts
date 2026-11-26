import ExcelJS from 'exceljs';
import { formatWibDateTime } from '../analysis/date';
import type { AnalyzedPointCheck, AnalyzedRainCheck, SummaryApiResponse } from '../types';

const THIN_BORDER: Partial<ExcelJS.Borders> = {
  top: { style: 'thin', color: { argb: 'FFD9D9D9' } },
  left: { style: 'thin', color: { argb: 'FFD9D9D9' } },
  bottom: { style: 'thin', color: { argb: 'FFD9D9D9' } },
  right: { style: 'thin', color: { argb: 'FFD9D9D9' } },
};

const HEADER_FILL: ExcelJS.Fill = {
  type: 'pattern',
  pattern: 'solid',
  fgColor: { argb: 'FF1F497D' },
};

const SUBHEADER_FILL: ExcelJS.Fill = {
  type: 'pattern',
  pattern: 'solid',
  fgColor: { argb: 'FF2E75B6' },
};

const PASS_FILL: ExcelJS.Fill = {
  type: 'pattern',
  pattern: 'solid',
  fgColor: { argb: 'FFC6EFCE' },
};

const FAIL_FILL: ExcelJS.Fill = {
  type: 'pattern',
  pattern: 'solid',
  fgColor: { argb: 'FFFFC7CE' },
};

const WARN_FILL: ExcelJS.Fill = {
  type: 'pattern',
  pattern: 'solid',
  fgColor: { argb: 'FFFFEB9C' },
};

const HEADER_FONT: Partial<ExcelJS.Font> = {
  name: 'Calibri',
  size: 11,
  bold: true,
  color: { argb: 'FFFFFFFF' },
};

const REGULAR_FONT: Partial<ExcelJS.Font> = {
  name: 'Calibri',
  size: 11,
  color: { argb: 'FF111827' },
};

const BOLD_FONT: Partial<ExcelJS.Font> = {
  name: 'Calibri',
  size: 11,
  bold: true,
  color: { argb: 'FF111827' },
};

const PASS_FONT: Partial<ExcelJS.Font> = {
  name: 'Calibri',
  size: 11,
  bold: true,
  color: { argb: 'FF006100' },
};

const FAIL_FONT: Partial<ExcelJS.Font> = {
  name: 'Calibri',
  size: 11,
  bold: true,
  color: { argb: 'FF9C0006' },
};

const WARN_FONT: Partial<ExcelJS.Font> = {
  name: 'Calibri',
  size: 11,
  bold: true,
  color: { argb: 'FF9C6500' },
};

function styleHeaderRow(row: ExcelJS.Row, fill: ExcelJS.Fill = HEADER_FILL): void {
  row.eachCell((cell) => {
    cell.font = HEADER_FONT;
    cell.fill = fill;
    cell.alignment = { horizontal: 'center', vertical: 'middle', wrapText: true };
    cell.border = THIN_BORDER;
  });
}

function autofitColumns(
  ws: ExcelJS.Worksheet,
  minWidth = 12,
  maxWidth = 45
): void {
  ws.columns.forEach((col) => {
    let maxLen = 0;
    col.eachCell?.({ includeEmpty: false }, (cell) => {
      const text = cell.value === null || cell.value === undefined ? '' : String(cell.value);
      for (const line of text.split('\n')) {
        if (line.length > maxLen) maxLen = line.length;
      }
    });
    col.width = Math.max(Math.min(maxLen + 3, maxWidth), minWidth);
  });
}

export async function buildAccuracyExcelBuffer(bundle: {
  summary: SummaryApiResponse;
  points: AnalyzedPointCheck[];
  rainEvents: AnalyzedRainCheck[];
}): Promise<Buffer> {
  const { summary, points, rainEvents } = bundle;
  const wb = new ExcelJS.Workbook();
  wb.creator = 'WM Water Management Dashboard';
  wb.created = new Date();

  const wsSummary = wb.addWorksheet('Ringkasan Akurasi Stasiun', {
    views: [{ state: 'frozen', ySplit: 1, showGridLines: true }],
  });

  const summaryHeaders = [
    'No',
    'Coverage',
    'Piezometer ID',
    'Kebun',
    'Block',
    'Jenis UP',
    'ID Perangkat',
    'Nama Station',
    'Kalibrasi Awal',
    'Tgl Manual Terakhir',
    'Manual Terakhir (cm)',
    'IoT Terakhir (cm)',
    'Selisih Terakhir (cm)',
    'Status Kalibrasi',
    'Status Respon Hujan',
    'Total Titik',
    'Avg Selisih (cm)',
    'Max Selisih (cm)',
    'Kejadian Hujan',
    'Hujan Direspon',
  ];
  const sumHeaderRow = wsSummary.addRow(summaryHeaders);
  sumHeaderRow.height = 28;
  styleHeaderRow(sumHeaderRow, HEADER_FILL);

  const summaryCenterCols = new Set([1, 5, 6, 7, 10, 14, 15, 16, 19, 20]);
  const summaryNumCols = new Set([9, 11, 12, 13, 17, 18]);

  summary.stations.forEach((s, idx) => {
    const row = wsSummary.addRow([
      idx + 1,
      s.coverage,
      s.piezo_id,
      s.kebun,
      s.block,
      s.jenis,
      s.device_id,
      s.device_name,
      s.kalibrasi,
      formatWibDateTime(s.latest_manual_at),
      s.latest_manual_cm,
      s.latest_iot_cm,
      s.latest_diff_cm,
      s.status_kalibrasi,
      s.status_hujan,
      s.total_points,
      s.avg_diff_cm,
      s.max_diff_cm,
      s.rain_events,
      s.rain_responded,
    ]);
    row.height = 20;

    row.eachCell({ includeEmpty: true }, (cell, colIdx) => {
      cell.font = REGULAR_FONT;
      cell.border = THIN_BORDER;
      cell.alignment = { vertical: 'middle' };

      if (summaryCenterCols.has(colIdx)) {
        cell.alignment = { horizontal: 'center', vertical: 'middle' };
      } else if (summaryNumCols.has(colIdx)) {
        cell.alignment = { horizontal: 'right', vertical: 'middle' };
        if (typeof cell.value === 'number') {
          cell.numFmt = '#,##0.00';
        }
      }

      if (colIdx === 14) {
        if (s.status_kalibrasi === 'LOLOS / AKURAT') {
          cell.fill = PASS_FILL;
          cell.font = PASS_FONT;
        } else if (s.status_kalibrasi === 'PERLU KALIBRASI ULANG') {
          cell.fill = FAIL_FILL;
          cell.font = FAIL_FONT;
        } else {
          cell.fill = WARN_FILL;
          cell.font = WARN_FONT;
        }
      }

      if (colIdx === 15) {
        if (s.status_hujan === 'NORMAL') {
          cell.fill = PASS_FILL;
          cell.font = PASS_FONT;
        } else if (s.status_hujan === 'ANOMALI RESPON HUJAN') {
          cell.fill = FAIL_FILL;
          cell.font = FAIL_FONT;
        } else {
          cell.fill = WARN_FILL;
          cell.font = WARN_FONT;
        }
      }
    });
  });
  autofitColumns(wsSummary);

  const wsPoints = wb.addWorksheet('Detail Titik Pengukuran', {
    views: [{ state: 'frozen', ySplit: 1, showGridLines: true }],
  });

  const pointsHeaderRow = wsPoints.addRow([
    'No',
    'Coverage',
    'Piezometer ID',
    'Waktu Manual',
    'Manual (cm)',
    'Waktu IoT Terdekat',
    'IoT (cm)',
    'Delta Waktu (Jam)',
    'Selisih (cm)',
    'Status Titik',
    'Titik Terakhir',
  ]);
  pointsHeaderRow.height = 26;
  styleHeaderRow(pointsHeaderRow, SUBHEADER_FILL);

  const ptCenterCols = new Set([1, 4, 6, 8, 10, 11]);
  const ptNumCols = new Set([5, 7, 9]);

  points.forEach((pt, idx) => {
    const row = wsPoints.addRow([
      idx + 1,
      pt.coverage,
      pt.piezo_id,
      formatWibDateTime(pt.manual_at),
      pt.manual_cm,
      formatWibDateTime(pt.iot_at),
      pt.iot_cm,
      pt.delta_hours,
      pt.diff_cm,
      pt.exceeded ? '> 3 cm' : '<= 3 cm',
      pt.is_latest ? 'Ya' : 'Tidak',
    ]);
    row.height = 19;

    row.eachCell({ includeEmpty: true }, (cell, colIdx) => {
      cell.font = REGULAR_FONT;
      cell.border = THIN_BORDER;
      cell.alignment = { vertical: 'middle' };

      if (ptCenterCols.has(colIdx)) {
        cell.alignment = { horizontal: 'center', vertical: 'middle' };
      } else if (ptNumCols.has(colIdx)) {
        cell.alignment = { horizontal: 'right', vertical: 'middle' };
        if (typeof cell.value === 'number') {
          cell.numFmt = '#,##0.00';
        }
      }

      if (colIdx === 10) {
        if (pt.exceeded) {
          cell.fill = FAIL_FILL;
          cell.font = FAIL_FONT;
        } else {
          cell.fill = PASS_FILL;
          cell.font = PASS_FONT;
        }
      }
      if (colIdx === 11 && pt.is_latest) {
        cell.font = BOLD_FONT;
      }
    });
  });
  autofitColumns(wsPoints);

  const wsRain = wb.addWorksheet('Evaluasi Respon Hujan', {
    views: [{ state: 'frozen', ySplit: 1, showGridLines: true }],
  });

  const rainHeaderRow = wsRain.addRow([
    'No',
    'Coverage',
    'Piezometer ID',
    'Waktu Hujan',
    'Curah Hujan (mm)',
    'Kedalaman TMAT Sebelum (cm)',
    'Kedalaman Puncak Air (cm)',
    'Kenaikan Air (cm)',
    'Respon Terdeteksi',
  ]);
  rainHeaderRow.height = 26;
  styleHeaderRow(rainHeaderRow, HEADER_FILL);

  const rainCenterCols = new Set([1, 4, 9]);
  const rainNumCols = new Set([5, 6, 7, 8]);

  rainEvents.forEach((rev, idx) => {
    const row = wsRain.addRow([
      idx + 1,
      rev.coverage,
      rev.piezo_id,
      formatWibDateTime(rev.rain_at),
      rev.rain_mm,
      rev.base_cm,
      rev.min_cm,
      rev.rise_cm,
      rev.responded ? 'Ya' : 'Tidak',
    ]);
    row.height = 19;

    row.eachCell({ includeEmpty: true }, (cell, colIdx) => {
      cell.font = REGULAR_FONT;
      cell.border = THIN_BORDER;
      cell.alignment = { vertical: 'middle' };

      if (rainCenterCols.has(colIdx)) {
        cell.alignment = { horizontal: 'center', vertical: 'middle' };
      } else if (rainNumCols.has(colIdx)) {
        cell.alignment = { horizontal: 'right', vertical: 'middle' };
        if (typeof cell.value === 'number') {
          cell.numFmt = '#,##0.00';
        }
      }

      if (colIdx === 9) {
        if (rev.responded) {
          cell.fill = PASS_FILL;
          cell.font = PASS_FONT;
        } else {
          cell.fill = FAIL_FILL;
          cell.font = FAIL_FONT;
        }
      }
    });
  });
  autofitColumns(wsRain);

  const wsCov = wb.addWorksheet('Rekapitulasi Coverage', {
    views: [{ state: 'frozen', ySplit: 1, showGridLines: true }],
  });

  const covHeaderRow = wsCov.addRow([
    'No',
    'Coverage',
    'Total Stasiun',
    'Stasiun Lolos',
    'Perlu Kalibrasi Ulang',
    'Tanpa Data Manual',
    'Akurasi (%)',
    'Anomali Respon Hujan',
  ]);
  covHeaderRow.height = 28;
  styleHeaderRow(covHeaderRow, SUBHEADER_FILL);

  summary.coverage_stats.forEach((st, idx) => {
    const row = wsCov.addRow([
      idx + 1,
      st.coverage,
      st.total_stations,
      st.passed_stations,
      st.failed_stations,
      st.no_manual_stations,
      st.accuracy_pct / 100,
      st.rain_anomaly_stations,
    ]);
    row.height = 20;

    row.eachCell({ includeEmpty: true }, (cell, colIdx) => {
      cell.font = REGULAR_FONT;
      cell.border = THIN_BORDER;
      cell.alignment = { horizontal: 'center', vertical: 'middle' };
      if (colIdx === 2) {
        cell.alignment = { horizontal: 'left', vertical: 'middle' };
      } else if (colIdx === 7) {
        cell.alignment = { horizontal: 'right', vertical: 'middle' };
        cell.numFmt = '0.0%';
      }
    });
  });

  const totStations = summary.coverage_stats.reduce(
    (sum, s) => sum + s.total_stations,
    0
  );
  const totPassed = summary.coverage_stats.reduce(
    (sum, s) => sum + s.passed_stations,
    0
  );
  const totFailed = summary.coverage_stats.reduce(
    (sum, s) => sum + s.failed_stations,
    0
  );
  const totNoManual = summary.coverage_stats.reduce(
    (sum, s) => sum + s.no_manual_stations,
    0
  );
  const totRainAnom = summary.coverage_stats.reduce(
    (sum, s) => sum + s.rain_anomaly_stations,
    0
  );
  const totEvaluated = totPassed + totFailed;
  const overallAcc = totEvaluated > 0 ? totPassed / totEvaluated : 0;

  const totalRow = wsCov.addRow([
    'TOTAL',
    'Semua Coverage',
    totStations,
    totPassed,
    totFailed,
    totNoManual,
    overallAcc,
    totRainAnom,
  ]);
  totalRow.height = 22;
  totalRow.eachCell({ includeEmpty: true }, (cell, colIdx) => {
    cell.font = HEADER_FONT;
    cell.fill = SUBHEADER_FILL;
    cell.border = THIN_BORDER;
    cell.alignment = {
      horizontal: colIdx === 2 ? 'left' : colIdx === 7 ? 'right' : 'center',
      vertical: 'middle',
    };
    if (colIdx === 7) {
      cell.numFmt = '0.0%';
    }
  });
  autofitColumns(wsCov);

  const arrayBuffer = await wb.xlsx.writeBuffer();
  return Buffer.from(arrayBuffer);
}
