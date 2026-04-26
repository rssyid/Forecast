import MapClient from '../../../components/MapClient';

export const metadata = {
  title: 'Visualisasi Spasial (GIS) | Forecast Dashboard',
  description: 'Visualisasi peta interaktif untuk pemantauan level air tanah (TMAT) berbasis blok.',
};

export default function MapPage() {
  return (
    <main className="p-6">
      <MapClient />
    </main>
  );
}
