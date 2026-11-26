import StationDetailClient from '@/components/accuracy/StationDetailClient';

export default async function AccuracyDetailPage({
  params,
  searchParams,
}: {
  params: Promise<{ piezoId: string }>;
  searchParams: Promise<{ week?: string; runId?: string }>;
}) {
  const [{ piezoId }, sp] = await Promise.all([params, searchParams]);
  const decodedId = decodeURIComponent(piezoId);
  return (
    <StationDetailClient
      piezoId={decodedId}
      week={sp.week}
      runId={sp.runId}
    />
  );
}
