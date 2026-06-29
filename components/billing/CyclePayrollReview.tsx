'use client'

import { useRouter } from 'next/navigation'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import PayableStatusesControl from '@/components/billing/PayableStatusesControl'
import PayrollStatusBreakdown, {
  type BreakdownEntry,
} from '@/components/billing/PayrollStatusBreakdown'
import {
  parsePayableStatusesJson,
  payableStatusLabels,
} from '@/lib/billing/sessionStatus'

export default function CyclePayrollReview({
  cycleId,
  cycleLocked,
  payableStatusesJson,
  entries,
}: {
  cycleId: string
  cycleLocked: boolean
  payableStatusesJson: unknown
  entries: BreakdownEntry[]
}) {
  const router = useRouter()
  const payableStatuses = parsePayableStatusesJson(payableStatusesJson)

  const refresh = () => router.refresh()

  return (
    <div className="space-y-6">
      <PayableStatusesControl
        cycleId={cycleId}
        cycleLocked={cycleLocked}
        initialStatuses={payableStatuses}
        onUpdated={refresh}
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
            entries={entries}
            payableStatuses={payableStatuses}
            cycleId={cycleId}
          />
        </CardContent>
      </Card>
    </div>
  )
}
