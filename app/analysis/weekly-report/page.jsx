import { Suspense } from 'react';
import WeeklyReportClient from '../../../components/WeeklyReportClient';

export const metadata = {
    title: 'Laporan Mingguan PZO | WM Dashboard',
    description: 'Laporan eksekutif mingguan PZO yang beradaptasi otomatis mengikuti tren hidrologi musim basah dan musim kering.',
};

export default function WeeklyReportPage() {
    return (
        <Suspense
            fallback={
                <div aria-live="polite" className="space-y-4">
                    <p className="text-sm font-medium text-gray-700">Memuat halaman laporan mingguan PZO...</p>
                    <div className="h-56 bg-white rounded-2xl border border-gray-200 animate-pulse" />
                </div>
            }
        >
            <WeeklyReportClient />
        </Suspense>
    );
}
