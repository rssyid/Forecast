import type { CalibrationStatus, RainStatus } from '../types';

export interface NarrativeInput {
  piezo_id: string;
  status_kalibrasi: CalibrationStatus;
  status_hujan: RainStatus;
  has_rain_station: boolean;
  latest_manual_cm: number | null;
  latest_iot_cm: number | null;
  latest_diff_cm: number | null;
  rain_events: number;
  rain_responded: number;
}

function formatOffsetMeters(signedDiffCm: number): string {
  const absMeters = Math.abs(signedDiffCm) / 100.0;
  const sign = signedDiffCm < 0 ? '-' : '+';
  return `${sign}${absMeters.toFixed(2)}`;
}

export function generateDiagnosis(input: NarrativeInput): string {
  const {
    piezo_id,
    status_kalibrasi,
    status_hujan,
    has_rain_station,
    latest_manual_cm,
    latest_iot_cm,
    latest_diff_cm,
    rain_events,
    rain_responded,
  } = input;

  const selisih = latest_diff_cm ?? 0;

  if (status_kalibrasi === 'PERLU KALIBRASI ULANG') {
    const mVal = latest_manual_cm ?? 0;
    const iotVal = latest_iot_cm ?? 0;
    const signedDiff = latest_iot_cm !== null && latest_manual_cm !== null
      ? iotVal - mVal
      : 0;
    const absDiff = Math.abs(signedDiff);
    const offsetStr = formatOffsetMeters(signedDiff);
    const parts: string[] = [];

    if (signedDiff < 0) {
      parts.push(
        `Sensor IoT membaca ${absDiff.toFixed(1)} cm LEBIH DANGKAL (muka air lebih tinggi) dibanding pengukuran manual fisik (${mVal.toFixed(1)} cm vs ${iotVal.toFixed(1)} cm), melampaui batas toleransi 3.0 cm.`
      );
    } else {
      parts.push(
        `Sensor IoT membaca ${absDiff.toFixed(1)} cm LEBIH DALAM dibanding pengukuran manual fisik (${mVal.toFixed(1)} cm vs ${iotVal.toFixed(1)} cm), melampaui batas toleransi 3.0 cm.`
      );
    }

    if (status_hujan === 'NORMAL') {
      parts.push(
        `Dinamika respon hujan terdeteksi normal (${rain_responded} dari ${rain_events} kejadian hujan direspon dengan kenaikan air), mengindikasikan transduser sensor bekerja baik dan deviasi murni akibat pergeseran datum kalibrasi/posisi gantung.`
      );
      if (signedDiff < 0) {
        parts.push(
          `Rekomendasi Lapangan: Lakukan penyesuaian parameter kalibrasi pada portal sebesar ${offsetStr} m atau turunkan gantungan kabel sensor sedalam ${absDiff.toFixed(1)} cm.`
        );
      } else {
        parts.push(
          `Rekomendasi Lapangan: Lakukan penyesuaian parameter kalibrasi pada portal sebesar ${offsetStr} m atau naikkan gantungan kabel sensor setinggi ${absDiff.toFixed(1)} cm.`
        );
      }
    } else if (status_hujan === 'ANOMALI RESPON HUJAN') {
      parts.push(
        `Selain itu, grafik IoT tidak menunjukkan kenaikan muka air yang memadai saat terjadi hujan (${rain_responded} dari ${rain_events} kejadian hujan direspon).`
      );
      parts.push(
        `Rekomendasi Lapangan: Periksa kemungkinan membran sensor atau filter lubang pipa piezometer tersumbat endapan/lumpur, lakukan pengurasan (flushing), lalu lakukan kalibrasi ulang titik nol sensor sebesar ${offsetStr} m.`
      );
    } else {
      if (!has_rain_station) {
        parts.push(
          'Respon hujan belum dapat dievaluasi karena tidak ada stasiun hujan di kebun ini.'
        );
      } else {
        parts.push(
          'Tidak tercatat kejadian hujan signifikan (>= 1.0 mm) pada periode ini untuk mengevaluasi respon hujan.'
        );
      }
      const cableAction = signedDiff < 0
        ? `turunkan gantungan kabel sensor sedalam ${absDiff.toFixed(1)} cm`
        : `naikkan gantungan kabel sensor setinggi ${absDiff.toFixed(1)} cm`;
      parts.push(
        `Rekomendasi Lapangan: Lakukan penyesuaian parameter kalibrasi pada portal sebesar ${offsetStr} m atau ${cableAction}, serta periksa kondisi fisik sensor dan pipa piezometer.`
      );
    }

    return parts.join(' ');
  }

  if (status_kalibrasi === 'TIDAK ADA DATA MANUAL') {
    const parts = [
      `Stasiun ${piezo_id} belum memiliki data pengukuran manual yang cocok pada periode ini sehingga akurasi kalibrasi belum dapat dievaluasi.`,
    ];
    if (status_hujan === 'ANOMALI RESPON HUJAN') {
      parts.push(
        `Namun terdeteksi ANOMALI RESPON HUJAN (${rain_responded} dari ${rain_events} kejadian hujan direspon). Rekomendasi Lapangan: Lakukan pengurasan (flushing) pipa piezometer dan bersihkan membran sensor dari kerak lumpur.`
      );
    } else if (status_hujan === 'NORMAL') {
      parts.push(
        `Respon hujan terdeteksi normal (${rain_responded} dari ${rain_events} kejadian hujan direspon).`
      );
    } else if (!has_rain_station) {
      parts.push('Tidak ada stasiun hujan di kebun ini.');
    } else {
      parts.push('Tidak tercatat kejadian hujan signifikan pada periode evaluasi.');
    }
    return parts.join(' ');
  }

  if (status_hujan === 'ANOMALI RESPON HUJAN') {
    return [
      `Pengukuran manual terakhir masih dalam batas toleransi (${selisih.toFixed(1)} cm), namun terdeteksi ANOMALI RESPON HUJAN di mana grafik TMAT tetap datar saat tercatat kejadian hujan (${rain_events} kejadian).`,
      'Kondisi ini mengindikasikan sensor tertahan (stuck) atau lubang perforasi pipa piezometer tersumbat lumpur/gambut sehingga air hujan tidak merembes masuk ke dalam sumur pantau.',
      'Rekomendasi Lapangan: Lakukan pengurasan (flushing) pipa piezometer dan bersihkan membran sensor dari kerak lumpur, lalu verifikasi sensitivitas bacaan sensor.',
    ].join(' ');
  }

  if (status_hujan === 'TIDAK ADA HUJAN') {
    if (!has_rain_station) {
      return `Stasiun ${piezo_id} dalam kondisi akurat (selisih ${selisih.toFixed(1)} cm). Evaluasi respon hujan tidak tersedia karena tidak ada stasiun hujan di kebun ini.`;
    }
    return `Stasiun ${piezo_id} dalam kondisi akurat (selisih ${selisih.toFixed(1)} cm). Tidak tercatat hujan signifikan pada periode evaluasi.`;
  }

  return `Stasiun ${piezo_id} dalam kondisi akurat (selisih ${selisih.toFixed(1)} cm) dan respon hujan normal (${rain_responded} dari ${rain_events} kejadian hujan direspon).`;
}
