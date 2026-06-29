'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import MatchReviewTable from '@/components/billing/MatchReviewTable'
import CyclePayrollReview from '@/components/billing/CyclePayrollReview'
import PayRateInput from '@/components/billing/PayRateInput'
import ExcludedProvidersSection from '@/components/billing/ExcludedProvidersSection'
import HoursConfirmationModal from '@/components/billing/HoursConfirmationModal'
import { CurrencyCell } from '@/components/billing/CurrencyCell'
import { defaultBiweeklyPeriod, formatCycleLabel, formatHours, formatUsd } from '@/lib/billing/format'
import { getCycleBlockers } from '@/lib/billing/validateCycle'
import type { BillingMatchStatus } from '@prisma/client'
import { AlertTriangle, Check, Loader2, Upload } from 'lucide-react'
import { cn } from '@/lib/utils'

type Candidate = {
  id: string
  firstName: string
  lastName: string
  artemisProviderName: string | null
  hourlyPayRate: number | null
}

type Entry = {
  id: string
  providerNameRaw: string
  matchStatus: BillingMatchStatus
  matchConfidence: number
  rbtProfileId: string | null
  payrollOnlyId: string | null
  suggestedRbtProfileId: string | null
  totalSessions: number
  totalHours: number
  hourlyRate: number | null
  suggestedHourlyRate?: number | null
  grossPay: number
  adjustment: number
  adjustmentNote: string | null
  finalPay: number
  isExcluded: boolean
  role: string | null
  notes: string | null
  sessions: {
    sessionStatus: string | null
    actualMinutes: number
    dos: string
    clientName: string
  }[]
  rbtProfile: { firstName: string; lastName: string; email?: string | null } | null
  payrollOnly: { id: string; fullName: string; email: string | null } | null
}

const STEPS = ['Setup', 'Upload', 'Match Review', 'Adjustments', 'Finalize']

function sortEntries(entries: Entry[]): Entry[] {
  const order: Record<BillingMatchStatus, number> = {
    UNMATCHED: 0,
    NEEDS_REVIEW: 1,
    MATCHED: 2,
    PAYROLL_ONLY: 2,
    IGNORED: 3,
  }
  return [...entries].sort((a, b) => order[a.matchStatus] - order[b.matchStatus])
}

export default function NewCycleWizardPage() {
  const router = useRouter()
  const defaults = defaultBiweeklyPeriod()
  const [step, setStep] = useState(0)
  const [periodStart, setPeriodStart] = useState(defaults.periodStart.toISOString().slice(0, 10))
  const [periodEnd, setPeriodEnd] = useState(defaults.periodEnd.toISOString().slice(0, 10))
  const [label, setLabel] = useState(
    formatCycleLabel(defaults.periodStart, defaults.periodEnd)
  )
  const [cycleId, setCycleId] = useState<string | null>(null)
  const [entries, setEntries] = useState<Entry[]>([])
  const [candidates, setCandidates] = useState<Candidate[]>([])
  const [uploadPreview, setUploadPreview] = useState<string | null>(null)
  const [periodWarning, setPeriodWarning] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [finalizeError, setFinalizeError] = useState<string | null>(null)
  const [payableStatusesJson, setPayableStatusesJson] = useState<unknown>(['completed', 'ready_to_bill'])
  const [dragOver, setDragOver] = useState(false)

  useEffect(() => {
    const start = new Date(periodStart)
    const end = new Date(periodEnd)
    if (!Number.isNaN(start.getTime()) && !Number.isNaN(end.getTime())) {
      setLabel(formatCycleLabel(start, end))
    }
  }, [periodStart, periodEnd])

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
  const blockers = useMemo(() => getCycleBlockers(payrollEntries), [payrollEntries])
  const totals = useMemo(() => {
    const hours = matchedEntries.reduce((s, e) => s + e.totalHours, 0)
    const gross = matchedEntries.reduce((s, e) => s + e.grossPay, 0)
    const final = matchedEntries.reduce((s, e) => s + e.finalPay, 0)
    return { hours, gross, final }
  }, [matchedEntries])

  const refreshCycle = useCallback(async (id: string) => {
    const res = await fetch(`/api/billing/cycles/${id}`)
    const data = await res.json()
    if (res.ok) {
      setEntries(data.cycle.entries)
      setCandidates(data.candidates)
      setPayableStatusesJson(data.cycle.payableStatuses)
    }
  }, [])

  const createCycle = async () => {
    setLoading(true)
    setError(null)
    try {
      const res = await fetch('/api/billing/cycles', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ periodStart, periodEnd, label }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Failed to create cycle')
      setCycleId(data.cycle.id)
      setStep(1)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to create cycle')
    } finally {
      setLoading(false)
    }
  }

  const uploadFile = async (file: File) => {
    if (!cycleId) return
    setLoading(true)
    setError(null)
    try {
      const form = new FormData()
      form.append('file', file)
      const res = await fetch(`/api/billing/cycles/${cycleId}/upload`, {
        method: 'POST',
        body: form,
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Upload failed')
      setEntries(data.entries)
      setUploadPreview(data.preview)
      if (data.hoursByStatus) {
        console.log('[upload] Hours by status:', data.hoursByStatus)
      }
      if (data.periodWarning?.mismatch) {
        setPeriodWarning(
          `File dates (${new Date(data.periodWarning.detectedMin).toLocaleDateString()} – ${new Date(data.periodWarning.detectedMax).toLocaleDateString()}) may not match cycle period.`
        )
      }
      await refreshCycle(cycleId)
      setStep(2)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Upload failed')
    } finally {
      setLoading(false)
    }
  }

  const updateEntry = async (entryId: string, patch: Record<string, unknown>) => {
    const res = await fetch(`/api/billing/entries/${entryId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(patch),
    })
    const data = await res.json()
    if (res.ok) {
      setEntries((prev) => prev.map((e) => (e.id === entryId ? { ...e, ...data.entry } : e)))
    }
  }

  const finalize = async () => {
    if (!cycleId) return
    setLoading(true)
    setFinalizeError(null)
    try {
      const res = await fetch(`/api/billing/cycles/${cycleId}/finalize`, { method: 'POST' })
      const data = await res.json()
      if (!res.ok) {
        setFinalizeError(data.error || 'Cannot finalize')
        if (data.blockers) {
          setFinalizeError(
            data.blockers.map((b: { message: string }) => b.message).join('; ')
          )
        }
        return
      }
      router.push(`/billing/cycles/${cycleId}`)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="space-y-6 max-w-5xl">
      <div>
        <Link href="/billing/dashboard" className="text-sm text-[#0D9488] hover:underline">
          ← Dashboard
        </Link>
        <h2 className="text-2xl font-bold mt-2">New Payroll Cycle</h2>
      </div>

      <div className="flex flex-wrap gap-2">
        {STEPS.map((s, i) => (
          <div
            key={s}
            className={cn(
              'px-3 py-1 rounded-full text-xs font-medium',
              i === step
                ? 'bg-[#0D9488] text-white'
                : i < step
                  ? 'bg-teal-100 text-teal-800'
                  : 'bg-gray-100 text-gray-500'
            )}
          >
            {i + 1}. {s}
          </div>
        ))}
      </div>

      {error && (
        <div className="rounded-md bg-red-50 text-red-800 px-4 py-3 text-sm flex items-center gap-2">
          <AlertTriangle className="w-4 h-4 shrink-0" />
          {error}
        </div>
      )}

      {step === 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Cycle Setup</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4 max-w-md">
            <div>
              <Label htmlFor="periodStart">Period Start</Label>
              <Input
                id="periodStart"
                type="date"
                value={periodStart}
                onChange={(e) => setPeriodStart(e.target.value)}
              />
            </div>
            <div>
              <Label htmlFor="periodEnd">Period End</Label>
              <Input
                id="periodEnd"
                type="date"
                value={periodEnd}
                onChange={(e) => setPeriodEnd(e.target.value)}
              />
            </div>
            <div>
              <Label htmlFor="label">Label</Label>
              <Input id="label" value={label} onChange={(e) => setLabel(e.target.value)} />
            </div>
            <Button
              onClick={createCycle}
              disabled={loading}
              className="bg-[#0D9488] hover:bg-teal-700 text-white"
            >
              {loading ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : null}
              Continue to Upload
            </Button>
          </CardContent>
        </Card>
      )}

      {step === 1 && (
        <Card>
          <CardHeader>
            <CardTitle>Upload Artemis Report</CardTitle>
          </CardHeader>
          <CardContent>
            <div
              onDragOver={(e) => {
                e.preventDefault()
                setDragOver(true)
              }}
              onDragLeave={() => setDragOver(false)}
              onDrop={(e) => {
                e.preventDefault()
                setDragOver(false)
                const file = e.dataTransfer.files[0]
                if (file) uploadFile(file)
              }}
              className={cn(
                'border-2 border-dashed rounded-lg p-12 text-center transition-colors',
                dragOver ? 'border-[#0D9488] bg-teal-50 dark:bg-teal-950/20' : 'border-gray-300'
              )}
            >
              <Upload className="w-10 h-10 mx-auto text-gray-400 mb-4" />
              <p className="text-sm text-gray-600 mb-4">
                Drag and drop the Artemis &quot;Session reconciliation report&quot; .xlsx file
              </p>
              <Input
                type="file"
                accept=".xlsx,.xls"
                className="max-w-xs mx-auto"
                onChange={(e) => {
                  const file = e.target.files?.[0]
                  if (file) uploadFile(file)
                }}
              />
              {loading && (
                <p className="mt-4 text-sm text-[#0D9488] flex items-center justify-center gap-2">
                  <Loader2 className="w-4 h-4 animate-spin" />
                  Parsing file…
                </p>
              )}
            </div>
          </CardContent>
        </Card>
      )}

      {step === 2 && (
        <div className="space-y-4">
          {uploadPreview && (
            <div className="rounded-md bg-teal-50 dark:bg-teal-950/30 px-4 py-3 text-sm text-teal-900 dark:text-teal-200">
              {uploadPreview}
            </div>
          )}
          {periodWarning && (
            <div className="rounded-md bg-amber-50 text-amber-900 px-4 py-3 text-sm flex items-center gap-2">
              <AlertTriangle className="w-4 h-4" />
              {periodWarning}
            </div>
          )}

          <MatchReviewTable
            cycleId={cycleId!}
            entries={entries as import('@/components/billing/MatchReviewTable').MatchEntry[]}
            candidates={candidates}
            onRefresh={() => refreshCycle(cycleId!)}
            onUpdateEntry={updateEntry}
          />

          <ExcludedProvidersSection entries={excludedEntries} />

          {cycleId && payrollEntries.length > 0 && (
            <CyclePayrollReview
              cycleId={cycleId}
              cycleLocked={false}
              payableStatusesJson={payableStatusesJson}
              entries={payrollEntries.map((e) => ({
                ...e,
                sessions: e.sessions?.map((s) => ({
                  sessionStatus: s.sessionStatus,
                  actualMinutes: s.actualMinutes,
                  dos: typeof s.dos === 'string' ? s.dos : new Date(s.dos).toISOString(),
                  clientName: s.clientName,
                })) ?? [],
              }))}
              onRecalculated={({ payableStatuses, entries: updated }) => {
                setPayableStatusesJson(payableStatuses)
                if (updated.length === 0) return
                const byId = new Map(updated.map((e) => [e.id, e]))
                setEntries((prev) =>
                  prev.map((e) => {
                    const patch = byId.get(e.id)
                    if (!patch) return e
                    return {
                      ...e,
                      totalHours: patch.totalHours,
                      grossPay: patch.grossPay,
                      finalPay: patch.finalPay,
                    }
                  })
                )
              }}
            />
          )}

          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={() => setStep(3)}>
              Continue to Adjustments
            </Button>
          </div>
        </div>
      )}

      {step === 3 && (
        <div className="space-y-4">
          <h3 className="font-semibold">Adjustments</h3>
          {blockers.length > 0 && (
            <div className="rounded-md bg-red-50 text-red-800 px-4 py-3 text-sm">
              <p className="font-medium mb-1">Issues to resolve before finalizing:</p>
              <ul className="list-disc pl-5">
                {blockers.map((b) => (
                  <li key={b.entryId}>{b.message}</li>
                ))}
              </ul>
            </div>
          )}
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
                    <td className="px-3 py-2">
                      {e.rbtProfile
                        ? `${e.rbtProfile.firstName} ${e.rbtProfile.lastName}`
                        : e.payrollOnly?.fullName ?? e.providerNameRaw}
                    </td>
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
                        onBlur={(ev) =>
                          updateEntry(e.id, { adjustment: parseFloat(ev.target.value) || 0 })
                        }
                      />
                    </td>
                    <td className="px-3 py-2">
                      <Input
                        className="h-8 min-w-[120px]"
                        defaultValue={e.adjustmentNote ?? ''}
                        placeholder="e.g. Done +100"
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
          <div className="flex justify-between">
            <Button variant="outline" onClick={() => setStep(2)}>
              Back
            </Button>
            <Button
              onClick={() => setStep(4)}
              className="bg-[#0D9488] hover:bg-teal-700 text-white"
            >
              Review & Finalize
            </Button>
          </div>
        </div>
      )}

      {step === 4 && (
        <Card>
          <CardHeader>
            <CardTitle>Finalize Cycle</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <p className="text-sm text-gray-600">
              Finalizing will lock this cycle and enable Excel download. This cannot be undone
              without admin re-open.
            </p>
            <div className="grid grid-cols-3 gap-4 text-center p-4 bg-gray-50 dark:bg-[var(--bg-elevated)] rounded-lg">
              <div>
                <p className="text-2xl font-bold">{matchedEntries.length}</p>
                <p className="text-xs text-gray-500">RBTs</p>
              </div>
              <div>
                <p className="text-2xl font-bold">{formatHours(totals.hours)}</p>
                <p className="text-xs text-gray-500">Total Hours</p>
              </div>
              <div>
                <p className="text-2xl font-bold">{formatUsd(totals.final)}</p>
                <p className="text-xs text-gray-500">Total Payout</p>
              </div>
            </div>
            {blockers.length > 0 && (
              <div className="rounded-md bg-red-50 text-red-800 px-4 py-3 text-sm">
                Cannot finalize until all blockers are resolved ({blockers.length} remaining).
              </div>
            )}
            {finalizeError && (
              <div className="rounded-md bg-red-50 text-red-800 px-4 py-3 text-sm">{finalizeError}</div>
            )}
            <div className="flex flex-wrap justify-between gap-2 items-center">
              <Button variant="outline" onClick={() => setStep(3)}>
                Back
              </Button>
              <div className="flex flex-wrap gap-2">
                {cycleId && (
                  <HoursConfirmationModal
                    cycleId={cycleId}
                    cycleLabel={label}
                    canSend={blockers.length === 0 && matchedEntries.length > 0}
                  />
                )}
                <Button
                  onClick={finalize}
                  disabled={loading || blockers.length > 0}
                  className="bg-[#0D9488] hover:bg-teal-700 text-white"
                >
                {loading ? (
                  <Loader2 className="w-4 h-4 animate-spin mr-2" />
                ) : (
                  <Check className="w-4 h-4 mr-2" />
                )}
                Finalize Cycle
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  )
}
