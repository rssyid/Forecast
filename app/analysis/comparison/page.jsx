import ComparisonGridClient from '../../../components/ComparisonGridClient';

export const metadata = {
    title: 'Weekly Comparison Dashboard | PZO Forecast',
    description: 'Executive dashboard for comparing TMAT status and rainfall trends across companies.',
};

export default function ComparisonPage() {
    return <ComparisonGridClient />;
}
