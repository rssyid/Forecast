import type { Metadata } from 'next';
import type { ReactNode } from 'react';

export const metadata: Metadata = {
  title: 'Akurasi IoT TMAT - WM Dashboard',
  description:
    'Laporan audit akurasi sensor IoT TMAT terhadap pengukuran manual mingguan dan respon curah hujan.',
  robots: {
    index: false,
    follow: false,
  },
};

export default function AccuracyLayout({ children }: { children: ReactNode }) {
  return children;
}
