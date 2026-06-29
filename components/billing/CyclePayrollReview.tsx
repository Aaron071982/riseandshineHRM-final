'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import PayableStatusesControl, {
  type PayableStatusUpdateResult,
} from '@/components/billing/PayableStatusesControl'
import PayrollStatusBreakdown, {
  type BreakdownEntry,
} from '@/components/billing/PayrollStatusBreakdown'
import {
  parsePayableStatusesJson,
  payableStatusLabels,
  type ArtemisSessionStatusKey,
} from '@/lib/billing/sessionStatus'

export default function CyclePayrollReview({
  cycleId,
  cycleLocked,
  payableStatusesJson,
  entries,
  onRecalculated,
}: {
  cycleId: string
  cycleLocked: boolean
  payableStatusesJson: unknown
  entries: BreakdownEntry[]
  onRecalculated?: (result: PayableStatusUpdateResult) => void
}) {
  const router = useRouter()
  const [payableStatuses, setPayableStatuses] = useState<ArtemisSessionStatusKey[]>(() =>
    parsePayableStatusesJson(payableStatusesJson)
  )
  const [localEntries, setLocalEntries] = useState<BreakdownEntry[]>(entries)

  useEffect(() => {
    setPayableStatuses(parsePayableStatusesJson(payableStatusesJson))
  }, [payableStatusesJson])

  useEffect(() => {
    setLocalEntries(entries)
  }, [entries])

  const handleUpdated = async (result: PayableStatusUpdateResult) => {
    setPayableStatuses(result.payableStatuses)
    if (result.entries.length > 0) {
      setLocalEntries(result.entries)
    }
    onRecalculated?.(result)
    router.refresh()
  }

  return (
    <div className="space-y-6">
      <PayableStatusesControl
        cycleId={cycleId}
        cycleLocked={cycleLocked}
        initialStatuses={payableStatuses}
        onUpdated={handleUpdated}
      />

      <p className="text-xs text-gray-500">
        Payable this cycle: <strong>{payableStatusLabels(payableStatuses)}</strong>
      </p>

      <Card className="shadow-sm">
        <CardHeader>
          <CardTitle>Hours by Status</CardTitle>
        </CardHeader>
        <CardContent>
          <PayrollStatusBreakdown
            entries={localEntries}
            payableStatuses={payableStatuses}
            cycleId={cycleId}
          />
        </CardContent>
      </Card>
    </div>
  )
}
