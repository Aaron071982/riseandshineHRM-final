'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { Download, Loader2, RotateCcw, CheckCircle2 } from 'lucide-react'
import HoursConfirmationModal from '@/components/billing/HoursConfirmationModal'
import DeleteCycleButton from '@/components/billing/DeleteCycleButton'
import type { CycleBlocker } from '@/lib/billing/types'

export default function CycleDetailActions({
  cycleId,
  cycleLabel,
  cycleStatus,
  canReopen,
  canDownload,
  canSendHoursConfirmation,
  canFinalize,
  blockers,
}: {
  cycleId: string
  cycleLabel: string
  cycleStatus: string
  canReopen: boolean
  canDownload: boolean
  canSendHoursConfirmation: boolean
  canFinalize: boolean
  blockers: CycleBlocker[]
}) {
  const router = useRouter()
  const [loading, setLoading] = useState(false)
  const [finalizeError, setFinalizeError] = useState<string | null>(null)

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

  const finalize = async () => {
    if (
      !confirm(
        'Finalize this cycle? It will be locked for editing. You can download payroll Excel after finalizing.'
      )
    ) {
      return
    }
    setLoading(true)
    setFinalizeError(null)
    try {
      const res = await fetch(`/api/billing/cycles/${cycleId}/finalize`, { method: 'POST' })
      const data = await res.json()
      if (!res.ok) {
        setFinalizeError(data.error || 'Cannot finalize')
        if (data.blockers?.length) {
          setFinalizeError(
            `Cannot finalize: ${data.blockers.map((b: { message: string }) => b.message).join('; ')}`
          )
        }
        return
      }
      router.refresh()
      router.push(`/billing/cycles/${cycleId}`)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="flex flex-col items-end gap-2">
      <div className="flex flex-wrap gap-2 justify-end">
        {canFinalize && (
          <Button
            className="bg-[#0D9488] hover:bg-teal-700 text-white"
            onClick={finalize}
            disabled={loading || blockers.length > 0}
            title={blockers.length > 0 ? 'Resolve blockers before finalizing' : undefined}
          >
            {loading ? (
              <Loader2 className="w-4 h-4 mr-2 animate-spin" />
            ) : (
              <CheckCircle2 className="w-4 h-4 mr-2" />
            )}
            Finalize Cycle
          </Button>
        )}
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
      {finalizeError && (
        <p className="text-sm text-red-600 max-w-md text-right">{finalizeError}</p>
      )}
      {canFinalize && blockers.length > 0 && (
        <p className="text-xs text-amber-700 max-w-md text-right">
          {blockers.length} issue{blockers.length !== 1 ? 's' : ''} blocking finalize — see list below.
        </p>
      )}
    </div>
  )
}
