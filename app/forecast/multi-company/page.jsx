import MultiCompanyForecastClient from '../../../components/MultiCompanyForecastClient';

export const metadata = {
  title: 'WM - Komparasi Forecast Multi-PT',
  description: 'Perbandingan mingguan TMAT titik vs curah hujan dan proyeksi 6 kategori hidrologi untuk seluruh perusahaan.',
};

export default function MultiCompanyForecastPage() {
  return (
    <div className="p-4 md:p-8 min-h-screen bg-white">
      <MultiCompanyForecastClient />
    </div>
  );
}
