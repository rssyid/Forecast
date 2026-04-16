# TMAT Forecast & AI Dashboard

Aplikasi web inovatif yang menggabungkan analisis hidrologi presisi dengan kecerdasan buatan (AI) untuk membantu manajemen tata air di perkebunan kelapa sawit, khususnya pada lahan gambut. Kini mendukung integrasi database server terpusat.

## 🌟 Fitur Utama

- **Dual Data Source**: Mendukung upload file **CSV Lokal** atau penarikan data langsung dari **Database Server (PostgreSQL)**.
- **Full Resync Tool**: Fitur administratif untuk sinkronisasi ulang seluruh data piezometer dari server GIS Div ke database dashboard.
- **Forecasting Dinamis**: Simulasi perubahan Tinggi Muka Air Tanah (TMAT) berdasarkan skenario curah hujan (0mm, 50mm, dll) menggunakan model regresi linier.
- **Generative AI Report**: Menghasilkan laporan naratif eksklusif dalam Bahasa Indonesia yang menyesuaikan dengan kondisi lapangan.
- **Professional Translate & Rewrite**: Modul khusus untuk menerjemahkan laporan ke Bahasa Inggris dengan standar C-Suite dan terminologi hidrologi yang tepat.
- **Modern UI/UX**: Antarmuka bersih berbasis **Shadcn UI** dengan alur kerja (workflow) yang dioptimalkan.

## 🚶 Walkthrough Penggunaan

Ikuti langkah-langkah berikut untuk mendapatkan analisis TMAT yang akurat:

### Langkah 1: Pengambilan Data
- Pilih **Sumber Data** (Database Server atau CSV).
- Jika menggunakan Database, pilih **Company** dan **Rentang Historis** (Default: 4 Minggu).
- Klik tombol **"Ambil Data"**. Sistem akan memuat data historis dan menampilkan kolom input curah hujan (CH).

### Langkah 2: Input Curah Hujan (Rainfall)
- Setelah data muncul, isi estimasi curah hujan per minggu pada tabel **"Input Rainfall per Week"** yang muncul di panel konfigurasi.
- Masukkan juga skenario curah hujan tambahan (default: 0, 50) pada kolom **Scenario Rainfall**.

### Langkah 3: Pemrosesan & Visualisasi
- Klik **"Proses Data"**.
- Dashboard akan menampilkan **Ringkasan Model**, Grafik **Trend TMAT vs Rainfall**, dan **Tabel Forecast** untuk minggu depan.

### Langkah 4: Analisis AI & Laporan
- Buka tab **"Laporan"**.
- Isi konteks cuaca lapangan dan aksi Water Management yang telah dilakukan.
- Klik **"Generate Laporan"**. AI akan menyusun narasi analisis profesional untuk Anda.

---

## 🛠️ Tech Stack

- **Frontend**: HTML5, Tailwind CSS (Shadcn UI Style).
- **Logic**: Vanilla JavaScript (ES6+) & Node.js.
- **Database**: PostgreSQL (Neon.tech).
- **AI Engine**: OpenAI API.
- **Backend & Deployment**: Vercel (Serverless Functions).

## 📁 Struktur Folder

```text
├── api/                # Serverless functions (Fetch data, Sync, AI Generate)
├── lib/                # Konfigurasi Database & Utility
├── scripts/            # Script migrasi dan backfill data (CLI)
├── index.html          # Struktur utama dashboard
├── script.js           # Logika frontend & visualisasi grafik
├── server.js           # Custom server untuk development lokal (Windows compatible)
└── vercel.json         # Konfigurasi routing & deployment
```

## 🚀 Instalasi Lokal

1. Clone repository ini.
2. Buat file `.env.local` dan isi dengan:
   ```text
   DATABASE_URL=your_postgresql_url
   OPENAI_API_KEY=your_openai_key
   ```
3. Jalankan server lokal:
   ```bash
   npm run dev
   ```
4. Buka `http://localhost:3000` di browser Anda.

## 📝 Catatan Terminologi
Sistem kami memahami istilah teknis perkebunan:
- **Tanggul** ➔ Embankment
- **TMAS (Muka Air Saluran)** ➔ Canal Water Level
- **TMAT (Muka Air Tanah)** ➔ Ground Water Level

---
Developed for Plantation Hydrology Operational Efficiency.