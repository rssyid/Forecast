import StationDetailClient from '@/components/accuracy/StationDetailClient';

export default async function AccuracyDetailPage({
  params,
}: {
  params: Promise<{ piezoId: string }>;
}) {
  const { piezoId } = await params;
  const decodedId = decodeURIComponent(piezoId);
  return <StationDetailClient piezoId={decodedId} />;
}
