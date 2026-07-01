'use client'

import { useCallback, useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import MatchReviewTable, {
  type MatchCandidate,
  type MatchEntry,
} from '@/components/billing/MatchReviewTable'
import CyclePayrollReview from '@/components/billing/CyclePayrollReview'
import ExcludedProvidersSection from '@/components/billing/ExcludedProvidersSection'
import { CurrencyCell } from '@/components/billing/CurrencyCell'
import { formatHours, formatUsd } from '@/lib/billing/format'
import type { PayableStatusUpdateResult } from '@/components/billing/PayableStatusesControl'
import type { BreakdownEntry } from '@/components/billing/PayrollStatusBreakdown'
import type { BillingMatchStatus } from '@prisma/client'

type EditorEntry = MatchEntry & {
  adjustment: number
  adjustmentNote: string | null
  finalPay: number
  sessions: BreakdownEntry['sessions']
}

function sortEntries(entries: EditorEntry[]): EditorEntry[] {
  const order: Record<BillingMatchStatus, number> = {
    UNMATCHED: 0,
    NEEDS_REVIEW: 1,
    MATCHED: 2,
    PAYROLL_ONLY: 2,
    IGNORED: 3,
  }
  return [...entries].sort((a, b) => order[a.matchStatus] - order[b.matchStatus])
}

function employeeName(e: EditorEntry): string {
  if (e.rbtProfile) return `${e.rbtProfile.firstName} ${e.rbtProfile.lastName}`.trim()
  if (e.payrollOnly) return e.payrollOnly.fullName
  return e.providerNameRaw
}

export default function CycleDetailEditor({
  cycleId,
  initialEntries,
  initialCandidates,
  initialPayableStatusesJson,
}: {
  cycleId: string
  initialEntries: EditorEntry[]
  initialCandidates: MatchCandidate[]
  initialPayableStatusesJson: unknown
}) {
  const router = useRouter()
  const [entries, setEntries] = useState<EditorEntry[]>(initialEntries)
  const [candidates, setCandidates] = useState(initialCandidates)
  const [payableStatusesJson, setPayableStatusesJson] = useState(initialPayableStatusesJson)

  const payrollEntries = useMemo(
    () => sortEntries(entries.filter((e) => !e.isExcluded)),
    [entries]
  )
  const excludedEntries = useMemo(() => entries.filter((e) => e.isExcluded), [entries])
  const matchedEntries = useMemo(
    () =>
      payrollEntries.filter(
        (e) => e.matchStatus === 'MATCHED' || e.matchStatus === 'PAYROLL_ONLY'
      ),
    [payrollEntries]
  )

  const totals = useMemo(() => {
    const hours = matchedEntries.reduce((s, e) => s + e.totalHours, 0)
    const gross = matchedEntries.reduce((s, e) => s + e.grossPay, 0)
    const final = matchedEntries.reduce((s, e) => s + e.finalPay, 0)
    return { hours, gross, final }
  }, [matchedEntries])

  const breakdownEntries: BreakdownEntry[] = useMemo(
    () =>
      payrollEntries.map((e) => ({
        id: e.id,
        providerNameRaw: e.providerNameRaw,
        matchStatus: e.matchStatus,
        isExcluded: e.isExcluded,
        hourlyRate: e.hourlyRate,
        adjustment: e.adjustment,
        grossPay: e.grossPay,
        finalPay: e.finalPay,
        totalHours: e.totalHours,
        totalSessions: e.totalSessions,
        rbtProfile: e.rbtProfile,
        payrollOnly: e.payrollOnly,
        sessions: e.sessions,
      })),
    [payrollEntries]
  )

  const refreshCycle = useCallback(async () => {
    const res = await fetch(`/api/billing/cycles/${cycleId}`)
    const data = await res.json()
    if (res.ok) {
      setEntries(
        data.cycle.entries.map((e: EditorEntry) => ({
          ...e,
          sessions: e.sessions?.map((s) => ({
            ...s,
            dos: typeof s.dos === 'string' ? s.dos : new Date(s.dos).toISOString(),
          })) ?? [],
        }))
      )
      setCandidates(data.candidates)
      setPayableStatusesJson(data.cycle.payableStatuses)
    }
    router.refresh()
  }, [cycleId, router])

  const updateEntry = async (entryId: string, patch: Record<string, unknown>) => {
    const res = await fetch(`/api/billing/entries/${entryId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(patch),
    })
    const data = await res.json()
    if (res.ok) {
      setEntries((prev) =>
        prev.map((e) => (e.id === entryId ? { ...e, ...data.entry } : e))
      )
      router.refresh()
    }
  }

  const handlePayableUpdated = (result: PayableStatusUpdateResult) => {
    setPayableStatusesJson(result.payableStatuses)
    if (result.entries.length === 0) return
    const byId = new Map(result.entries.map((e) => [e.id, e]))
    setEntries((prev) =>
      prev.map((e) => {
        const patch = byId.get(e.id)
        if (!patch) return e
        return {
          ...e,
          totalHours: patch.totalHours,
          totalSessions: patch.totalSessions,
          grossPay: patch.grossPay,
          finalPay: patch.finalPay,
        }
      })
    )
  }

  return (
    <div className="space-y-6">
      <Card className="shadow-sm">
        <CardHeader>
          <CardTitle>Provider matching</CardTitle>
        </CardHeader>
        <CardContent>
          <MatchReviewTable
            cycleId={cycleId}
            entries={payrollEntries}
            candidates={candidates}
            onRefresh={refreshCycle}
            onUpdateEntry={updateEntry}
          />
          <ExcludedProvidersSection entries={excludedEntries} />
        </CardContent>
      </Card>

      <CyclePayrollReview
        cycleId={cycleId}
        cycleLocked={false}
        payableStatusesJson={payableStatusesJson}
        entries={breakdownEntries}
        onRecalculated={handlePayableUpdated}
      />

      <Card className="shadow-sm">
        <CardHeader>
          <CardTitle>Pay adjustments</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto rounded-lg border dark:border-[var(--border-subtle)]">
            <table className="min-w-full text-sm">
              <thead className="bg-gray-50 dark:bg-[var(--bg-elevated)]">
                <tr className="text-left">
                  <th className="px-3 py-2">Employee</th>
                  <th className="px-3 py-2 text-right">Hours</th>
                  <th className="px-3 py-2 text-right">Rate</th>
                  <th className="px-3 py-2 text-right">Gross</th>
                  <th className="px-3 py-2">Adjustment</th>
                  <th className="px-3 py-2">Note</th>
                  <th className="px-3 py-2 text-right">Final</th>
                </tr>
              </thead>
              <tbody>
                {matchedEntries.map((e) => (
                  <tr key={e.id} className="border-t dark:border-[var(--border-subtle)]">
                    <td className="px-3 py-2">{employeeName(e)}</td>
                    <td className="px-3 py-2 text-right">{formatHours(e.totalHours)}</td>
                    <td className="px-3 py-2 text-right">
                      <CurrencyCell value={e.hourlyRate} />
                    </td>
                    <td className="px-3 py-2 text-right">
                      <CurrencyCell value={e.grossPay} />
                    </td>
                    <td className="px-3 py-2">
                      <Input
                        type="number"
                        step="0.01"
                        className="h-8 w-24"
                        defaultValue={e.adjustment || ''}
                        key={`${e.id}-adj-${e.adjustment}`}
                        onBlur={(ev) =>
                          updateEntry(e.id, { adjustment: parseFloat(ev.target.value) || 0 })
                        }
                      />
                    </td>
                    <td className="px-3 py-2">
                      <Input
                        className="h-8 min-w-[120px]"
                        defaultValue={e.adjustmentNote ?? ''}
                        key={`${e.id}-note-${e.adjustmentNote ?? ''}`}
                        placeholder="e.g. Bonus +100"
                        onBlur={(ev) =>
                          updateEntry(e.id, { adjustmentNote: ev.target.value || null })
                        }
                      />
                    </td>
                    <td className="px-3 py-2 text-right font-medium">
                      <CurrencyCell value={e.finalPay} />
                    </td>
                  </tr>
                ))}
              </tbody>
              <tfoot>
                <tr className="border-t font-bold bg-gray-50 dark:bg-[var(--bg-elevated)]">
                  <td className="px-3 py-2">Totals</td>
                  <td className="px-3 py-2 text-right">{formatHours(totals.hours)}</td>
                  <td colSpan={2} className="px-3 py-2 text-right">
                    {formatUsd(totals.gross)}
                  </td>
                  <td colSpan={2} />
                  <td className="px-3 py-2 text-right">{formatUsd(totals.final)}</td>
                </tr>
              </tfoot>
            </table>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
