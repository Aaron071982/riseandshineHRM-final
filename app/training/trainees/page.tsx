import { Suspense } from 'react'
import TrainingTraineesPage from '@/components/training/TrainingTraineesPage'

export default function Page() {
  return (
    <Suspense fallback={<div className="p-8 text-center text-gray-500">Loading…</div>}>
      <TrainingTraineesPage />
    </Suspense>
  )
}
