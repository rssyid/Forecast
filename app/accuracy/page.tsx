import AccuracyDashboardClient from '@/components/accuracy/AccuracyDashboardClient';

export default async function AccuracyPage({
  searchParams,
}: {
  searchParams: Promise<{ week?: string; runId?: string }>;
}) {
  const sp = await searchParams;
  return (
    <AccuracyDashboardClient
      initialWeek={sp.week ?? ''}
      initialRunId={sp.runId ?? ''}
    />
  );
}
