import TrainingSessionDetailPage from '@/components/training/TrainingSessionDetailPage'

export default async function Page({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  return <TrainingSessionDetailPage sessionId={id} />
}
