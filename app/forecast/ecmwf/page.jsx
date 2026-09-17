import EcmwfForecastClient from '../../../components/EcmwfForecastClient';

export const metadata = {
  title: 'WM - ECMWF AIFS Forecast',
  description: 'Prakiraan Curah Hujan ECMWF AIFS',
};

export default function EcmwfPage() {
  return <EcmwfForecastClient />;
}
