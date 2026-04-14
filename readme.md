# TMAT Forecast & AI Dashboard

Aplikasi web inovatif yang menggabungkan analisis hidrologi presisi dengan kecerdasan buatan (AI) untuk membantu manajemen tata air di perkebunan kelapa sawit, khususnya pada lahan gambut.

## 🌟 Fitur Utama

- **Analisis Piezometer Otomatis**: Mengolah data CSV mentah dari lapangan secara instan.
- **Forecasting Dinamis**: Melakukan simulasi perubahan Tinggi Muka Air Tanah (TMAT) berdasarkan skenario curah hujan (0mm, 50mm, dll) menggunakan model regresi linier.
- **Generative AI Report**: Menghasilkan laporan naratif dalam Bahasa Indonesia yang menyesuaikan dengan kondisi dominan (Kering, Basah, atau Normal).
- **Professional Translate & Rewrite**: Modul khusus untuk menerjemahkan dan menyempurnakan laporan ke Bahasa Inggris dengan standar profesional dan terminologi hidrologi yang tepat.
- **Modern UI/UX**: Antarmuka bersih dan responsif berbasis estetika **Shadcn UI** menggunakan Tailwind CSS.
- **Enterprise Security**: API Key Gemini disimpan dengan aman di sisi server menggunakan Vercel Serverless Functions.

## 🛠️ Tech Stack

- **Frontend**: HTML5, Tailwind CSS (Shadcn UI Style).
- **Logic**: Vanilla JavaScript (ES6+).
- **Libraries**:
  - [PapaParse](https://www.papaparse.com/) (CSV Parsing).
  - [Chart.js](https://www.chartjs.org/) (Data Visualization).
  - [SheetJS](https://sheetjs.com/) (Excel Export).
- **AI Engine**: Open AI.
- **Deployment & Backend**: Vercel (Serverless Functions).

## 📁 Struktur Folder

```text
├── index.html        # Struktur utama dashboard
├── style.css         # Tema dan styling (Shadcn UI design)
├── script.js         # Logika frontend, pemrosesan data, dan integrasi API
├── package.json      # Konfigurasi dependensi backend
└── api/
    └── generate.js   # Serverless function untuk memanggil Gemini API secara aman
```    
## 🚀 Panduan Instalasi & Deployment
1. Persiapan Repository
Unggah semua file di atas ke repository GitHub Anda.

2. Deployment di Vercel
Masuk ke Vercel Dashboard dan impor repository tersebut.

Sebelum klik Deploy, buka menu Environment Variables.

Tambahkan variabel baru:
```text
Key: GEMINI_API_KEY
Value: [Masukkan API Key Gemini Anda dari Google AI Studio]
Klik Deploy.
```
3. Penggunaan
Upload: Gunakan file CSV piezometer (Gunakan tombol "Panduan CSV" di dashboard untuk melihat format header).

Input Rainfall: Masukkan data curah hujan realisasi mingguan di tabel yang muncul.

Process: Klik "Process Data" untuk melihat grafik dan tabel forecast.

AI Report: Masukkan konteks lapangan dan aksi Water Management, lalu klik "Generate".

Translate: Gunakan modul di bagian bawah untuk mendapatkan versi Bahasa Inggris yang profesional.

## 🔒 Keamanan API
Proyek ini dirancang agar API Key tidak bocor ke publik. File script.js tidak pernah menyimpan kunci tersebut; komunikasi dilakukan melalui jalur internal Vercel /api/generate yang memanggil kunci dari Environment Variable di sisi server.

## 📝 Catatan Terminologi Translasi
Sistem translate telah dikonfigurasi secara khusus untuk mengubah istilah lokal menjadi standar profesional saat diterjemahkan ke Bahasa Inggris:

Tanggul ➔ Embankment

TMAS ➔ Water level

TMAT ➔ Ground water

Dikembangkan untuk efisiensi operasional hidrologi perkebunan.