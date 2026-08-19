'use client'

import { useRouter } from 'next/navigation'
import FortyHourTrainingPanel from '@/components/rbt/FortyHourTrainingPanel'

export default function FortyHourTrainingClient({
  documentId,
  alreadyComplete,
}: {
  documentId: string | null
  alreadyComplete: boolean
}) {
  const router = useRouter()
  return (
    <FortyHourTrainingPanel
      documentId={documentId}
      alreadyComplete={alreadyComplete}
      showContinueLink
      onComplete={() => router.refresh()}
    />
  )
}
