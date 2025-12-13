'use client'

import { useRouter } from 'next/navigation'
import ScheduleSetup from '@/components/rbt/ScheduleSetup'

interface ScheduleSetupWrapperProps {
  rbtProfileId: string
}

export default function ScheduleSetupWrapper({ rbtProfileId }: ScheduleSetupWrapperProps) {
  const router = useRouter()

  const handleComplete = () => {
    // Refresh the page to show the main dashboard
    router.refresh()
  }

  return (
    <div className="container mx-auto p-6 max-w-4xl">
      <ScheduleSetup
        rbtProfileId={rbtProfileId}
        onComplete={handleComplete}
      />
    </div>
  )
}

