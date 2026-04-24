# 🌊 TMAT Forecast & AI Dashboard

Aplikasi web modern yang menggabungkan analisis hidrologi presisi dengan kecerdasan buatan (AI) untuk membantu manajemen tata air di perkebunan kelapa sawit, khususnya pada lahan gambut. Sistem ini kini telah dimigrasikan ke arsitektur **Next.js** untuk performa dan skalabilitas yang lebih baik.

## 🌟 Fitur Utama

- **Unified Dashboard**: Antarmuka terpusat untuk memantau data TMAT (Tinggi Muka Air Tanah) secara real-time.
- **Dual Data Source**: Mendukung pengambilan data langsung dari **Database Server (PostgreSQL)** atau upload file **CSV/Excel Lokal**.
- **Forecasting Engine**: Simulasi perubahan TMAT berdasarkan skenario curah hujan (0mm, 50mm, dll) menggunakan model regresi linier terintegrasi.
- **Generative AI Analysis**: Menghasilkan laporan naratif profesional dalam Bahasa Indonesia yang menyesuaikan dengan kondisi lapangan terkini.
- **C-Suite Reporting**: Modul khusus untuk rewrite laporan ke Bahasa Inggris dengan terminologi hidrologi standar internasional.
- **Full Resync Tool**: Fitur sinkronisasi administratif untuk memastikan data lokal selaras dengan server GIS Divisi.

## 🚶 Walkthrough Penggunaan

1. **Pengambilan Data**: Pilih sumber data (Database/CSV). Jika database, tentukan Company dan rentang waktu.
2. **Input Skenario**: Masukkan estimasi curah hujan per minggu pada panel konfigurasi.
3. **Analisis**: Klik "Proses Data" untuk melihat grafik trend dan tabel forecast otomatis.
4. **AI Generation**: Pindah ke tab laporan untuk menyusun narasi analisis berbasis AI.

---

## 🛠️ Tech Stack

- **Framework**: [Next.js 15+](https://nextjs.org/) (App Router)
- **UI Library**: [React 19](https://react.dev/), [Tailwind CSS 4](https://tailwindcss.com/)
- **Icons**: [Lucide React](https://lucide.dev/)
- **Charts**: [Chart.js](https://www.chartjs.org/) & [React-Chartjs-2](https://react-chartjs-2.js.org/)
- **Database**: PostgreSQL (via `pg`)
- **AI Engine**: [OpenAI API](https://openai.com/api/)
- **Deployment**: [Vercel](https://vercel.com/)

## 📁 Struktur Folder

```text
├── app/
│   ├── api/             # API Routes (Dashboard, Sync, Weeks, etc.)
│   ├── forecast/        # Halaman analisis forecast
│   ├── globals.css      # Styling global (Tailwind 4)
│   └── layout.jsx       # Root layout & Provider
├── components/          # Reusable UI Components (Sidebar, Topbar, etc.)
├── lib/                 # Core logic, DB Config, & Forecast Engine
├── scripts/             # CLI Scripts for data maintenance
└── next.config.mjs      # Konfigurasi Next.js
```

## 🚀 Pengembangan Lokal

1. **Clone & Install**:
   ```bash
   git clone https://github.com/rssyid/Forecast.git
   npm install
   ```
2. **Konfigurasi Environment**:
   Buat file `.env.local` di root folder:
   ```text
   DATABASE_URL=your_postgresql_url
   OPENAI_API_KEY=your_openai_key
   ```
3. **Jalankan Server**:
   ```bash
   npm run dev
   ```
4. **Akses**: Buka `http://localhost:3000` di browser.

## 📝 Catatan Terminologi
- **TMAT** ➔ Ground Water Level (GWL)
- **TMAS** ➔ Canal Water Level (CWL)
- **Curah Hujan** ➔ Rainfall (RF)
- **Tanggul** ➔ Embankment

---
*Developed for Plantation Hydrology Operational Efficiency.*