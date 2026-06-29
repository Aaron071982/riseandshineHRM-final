'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { Download, RotateCcw } from 'lucide-react'
import HoursConfirmationModal from '@/components/billing/HoursConfirmationModal'
import DeleteCycleButton from '@/components/billing/DeleteCycleButton'

export default function CycleDetailActions({
  cycleId,
  cycleLabel,
  cycleStatus,
  canReopen,
  canDownload,
  canSendHoursConfirmation,
}: {
  cycleId: string
  cycleLabel: string
  cycleStatus: string
  canReopen: boolean
  canDownload: boolean
  canSendHoursConfirmation: boolean
}) {
  const router = useRouter()
  const [loading, setLoading] = useState(false)

  const reopen = async () => {
    if (!confirm('Re-open this cycle for editing?')) return
    setLoading(true)
    try {
      const res = await fetch(`/api/billing/cycles/${cycleId}/reopen`, { method: 'POST' })
      if (res.ok) router.refresh()
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="flex flex-wrap gap-2">
      {canSendHoursConfirmation && (
        <HoursConfirmationModal cycleId={cycleId} cycleLabel={cycleLabel} canSend />
      )}
      {canDownload && (
        <Button asChild variant="outline">
          <a href={`/api/billing/cycles/${cycleId}/export`}>
            <Download className="w-4 h-4 mr-2" />
            Download Excel
          </a>
        </Button>
      )}
      {canReopen && (
        <Button variant="outline" onClick={reopen} disabled={loading}>
          <RotateCcw className="w-4 h-4 mr-2" />
          Re-open for editing
        </Button>
      )}
      <DeleteCycleButton
        cycleId={cycleId}
        cycleLabel={cycleLabel}
        status={cycleStatus}
        variant="outline"
        className="text-red-600 border-red-200 hover:bg-red-50 hover:text-red-700"
      />
    </div>
  )
}
