import ComparisonGridClient from '../../../components/ComparisonGridClient';

export const metadata = {
    title: 'Weekly Comparison Dashboard | PZO Forecast',
    description: 'Executive dashboard for comparing TMAT status and rainfall trends across companies.',
};

export default function ComparisonPage() {
    return (
        <div className="p-4 md:p-8 min-h-screen bg-white">
            <ComparisonGridClient />
        </div>
    );
}
