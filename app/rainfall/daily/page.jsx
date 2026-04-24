import RainfallDailyClient from '../../../components/RainfallDailyClient';

export const metadata = {
  title: 'Laporan Curah Hujan Harian - WM Dashboard',
  description: 'Rekapitulasi curah hujan harian per estate dalam satu bulan',
};

export default function RainfallDailyPage() {
  return <RainfallDailyClient />;
}
