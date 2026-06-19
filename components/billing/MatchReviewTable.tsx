'use client'

import { useMemo, useState } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog'
import { MatchStatusBadge } from '@/components/billing/MatchStatusBadge'
import PayRateInput from '@/components/billing/PayRateInput'
import { CurrencyCell } from '@/components/billing/CurrencyCell'
import { formatHours } from '@/lib/billing/format'
import type { BillingMatchStatus } from '@prisma/client'
import { cn } from '@/lib/utils'
import { ChevronDown, RotateCcw } from 'lucide-react'

export type MatchEntry = {
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
  role: string | null
  notes: string | null
  isExcluded: boolean
  rbtProfile: { firstName: string; lastName: string } | null
  payrollOnly: { id: string; fullName: string; email: string | null } | null
}

export type MatchCandidate = {
  id: string
  firstName: string
  lastName: string
  artemisProviderName: string | null
  hourlyPayRate: number | null
}

function rowClass(status: BillingMatchStatus, isExcluded: boolean): string {
  if (isExcluded || status === 'IGNORED') return 'bg-gray-50 dark:bg-gray-900/30'
  if (status === 'UNMATCHED') return 'bg-red-50/80 dark:bg-red-950/20'
  if (status === 'NEEDS_REVIEW') return 'bg-amber-50/80 dark:bg-amber-950/20'
  if (status === 'PAYROLL_ONLY') return 'bg-blue-50/60 dark:bg-blue-950/20'
  if (status === 'MATCHED') return 'bg-green-50/40 dark:bg-green-950/10'
  return ''
}

function SearchableRbtSelect({
  candidates,
  value,
  onSelect,
}: {
  candidates: MatchCandidate[]
  value: string
  onSelect: (id: string) => void
}) {
  const [q, setQ] = useState('')
  const filtered = useMemo(() => {
    const lower = q.toLowerCase()
    return candidates.filter((c) => {
      const name = `${c.firstName} ${c.lastName}`.toLowerCase()
      const artemis = (c.artemisProviderName ?? '').toLowerCase()
      return name.includes(lower) || artemis.includes(lower)
    })
  }, [candidates, q])

  return (
    <div className="space-y-1 min-w-[200px]">
      <Input
        placeholder="Search RBTs…"
        value={q}
        onChange={(e) => setQ(e.target.value)}
        className="h-8 text-xs"
      />
      <select
        value={value}
        onChange={(e) => onSelect(e.target.value)}
        className="h-8 w-full text-sm rounded border border-gray-300 dark:border-[var(--border-subtle)] bg-white dark:bg-[var(--bg-elevated)] px-2"
        size={Math.min(5, Math.max(3, filtered.length))}
      >
        <option value="">Select RBT…</option>
        {filtered.map((c) => (
          <option key={c.id} value={c.id}>
            {c.firstName} {c.lastName}
            {c.artemisProviderName ? ` (${c.artemisProviderName})` : ''}
          </option>
        ))}
      </select>
    </div>
  )
}

export default function MatchReviewTable({
  cycleId,
  entries,
  candidates,
  onRefresh,
  onUpdateEntry,
}: {
  cycleId: string
  entries: MatchEntry[]
  candidates: MatchCandidate[]
  onRefresh: () => Promise<void>
  onUpdateEntry: (entryId: string, patch: Record<string, unknown>) => Promise<void>
}) {
  const [loading, setLoading] = useState(false)
  const [editingEntry, setEditingEntry] = useState<MatchEntry | null>(null)
  const [payrollModal, setPayrollModal] = useState<MatchEntry | null>(null)
  const [excludeModal, setExcludeModal] = useState<MatchEntry | null>(null)
  const [excludeReason, setExcludeReason] = useState('')
  const [payrollName, setPayrollName] = useState('')
  const [payrollEmail, setPayrollEmail] = useState('')
  const [payrollRate, setPayrollRate] = useState('')

  const payrollEntries = useMemo(() => entries.filter((e) => !e.isExcluded), [entries])
  const unmatched = payrollEntries.filter((e) => e.matchStatus === 'UNMATCHED').length
  const needsReview = payrollEntries.filter((e) => e.matchStatus === 'NEEDS_REVIEW').length

  const patchEntry = async (entryId: string, patch: Record<string, unknown>) => {
    await onUpdateEntry(entryId, patch)
    await onRefresh()
  }

  const bulkAction = async (action: string) => {
    setLoading(true)
    await fetch(`/api/billing/cycles/${cycleId}/bulk-actions`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action }),
    })
    await onRefresh()
    setLoading(false)
  }

  const displayName = (e: MatchEntry) => {
    if (e.rbtProfile) return `${e.rbtProfile.firstName} ${e.rbtProfile.lastName}`
    if (e.payrollOnly) return e.payrollOnly.fullName
    return '—'
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap gap-3 items-center justify-between">
        <div className="flex flex-wrap gap-2 text-sm">
          {unmatched > 0 && (
            <span className="px-2 py-1 rounded-full bg-red-100 text-red-800 font-medium">
              {unmatched} unmatched
            </span>
          )}
          {needsReview > 0 && (
            <span className="px-2 py-1 rounded-full bg-amber-100 text-amber-900 font-medium">
              {needsReview} need review
            </span>
          )}
          {unmatched === 0 && needsReview === 0 && (
            <span className="px-2 py-1 rounded-full bg-green-100 text-green-800 font-medium">
              All providers resolved
            </span>
          )}
        </div>
        <div className="flex flex-wrap gap-2">
          <Button
            variant="outline"
            size="sm"
            disabled={loading}
            onClick={() => bulkAction('confirm_high_confidence')}
          >
            Confirm all high-confidence
          </Button>
          <Button
            variant="outline"
            size="sm"
            disabled={loading}
            onClick={() => bulkAction('exclude_non_rbt')}
          >
            Exclude all non-RBT roles
          </Button>
        </div>
      </div>

      <div className="overflow-x-auto rounded-xl border dark:border-[var(--border-subtle)] shadow-sm">
        <table className="min-w-full text-sm">
          <thead className="bg-gray-50 dark:bg-[var(--bg-elevated)]">
            <tr className="text-left text-gray-500">
              <th className="px-3 py-3 font-medium">Provider</th>
              <th className="px-3 py-3 font-medium">Status</th>
              <th className="px-3 py-3 font-medium">Match</th>
              <th className="px-3 py-3 font-medium text-right">Sessions</th>
              <th className="px-3 py-3 font-medium text-right">Hours</th>
              <th className="px-3 py-3 font-medium">Rate</th>
              <th className="px-3 py-3 font-medium text-right">Gross</th>
              <th className="px-3 py-3 font-medium w-28">Actions</th>
            </tr>
          </thead>
          <tbody>
            {payrollEntries.map((e) => {
              const isResolved =
                e.matchStatus === 'MATCHED' || e.matchStatus === 'PAYROLL_ONLY'
              const selectId = e.rbtProfileId ?? e.suggestedRbtProfileId ?? ''
              return (
                <tr
                  key={e.id}
                  className={cn('border-t dark:border-[var(--border-subtle)]', rowClass(e.matchStatus, e.isExcluded))}
                >
                  <td className="px-3 py-2 font-medium">
                    {e.providerNameRaw}
                    {e.role && (
                      <span className="block text-xs text-gray-500 font-normal">{e.role}</span>
                    )}
                  </td>
                  <td className="px-3 py-2">
                    <MatchStatusBadge status={e.matchStatus} />
                    {e.matchStatus === 'NEEDS_REVIEW' && (
                      <span className="text-xs text-gray-500 ml-1">
                        {(e.matchConfidence * 100).toFixed(0)}%
                      </span>
                    )}
                  </td>
                  <td className="px-3 py-2">
                    {isResolved ? (
                      <button
                        type="button"
                        className="text-left hover:underline text-[#0D9488] font-medium"
                        onClick={() => setEditingEntry(e)}
                      >
                        {displayName(e)}
                      </button>
                    ) : (
                      <SearchableRbtSelect
                        candidates={candidates}
                        value={selectId}
                        onSelect={(id) => {
                          if (id) patchEntry(e.id, { rbtProfileId: id })
                        }}
                      />
                    )}
                  </td>
                  <td className="px-3 py-2 text-right">{e.totalSessions}</td>
                  <td className="px-3 py-2 text-right">{formatHours(e.totalHours)}</td>
                  <td className="px-3 py-2">
                    <PayRateInput
                      value={e.hourlyRate}
                      suggested={e.suggestedHourlyRate}
                      disabled={!isResolved}
                      onSave={(rate) => patchEntry(e.id, { hourlyRate: rate })}
                    />
                  </td>
                  <td className="px-3 py-2 text-right">
                    <CurrencyCell value={e.grossPay} />
                  </td>
                  <td className="px-3 py-2">
                    <div className="relative inline-block">
                      <select
                        className="h-8 text-xs rounded border px-2 pr-7 appearance-none bg-white dark:bg-[var(--bg-elevated)]"
                        defaultValue=""
                        onChange={(ev) => {
                          const v = ev.target.value
                          ev.target.value = ''
                          if (v === 'payroll_only') {
                            setPayrollName(e.providerNameRaw)
                            setPayrollEmail('')
                            setPayrollRate('')
                            setPayrollModal(e)
                          } else if (v === 'exclude') {
                            setExcludeReason(e.role ? `Non-RBT: ${e.role}` : '')
                            setExcludeModal(e)
                          } else if (v === 'unmatch') {
                            patchEntry(e.id, { action: 'unmatch' })
                          } else if (v === 'edit') {
                            setEditingEntry(e)
                          }
                        }}
                      >
                        <option value="" disabled>
                          Actions
                        </option>
                        {!isResolved && (
                          <option value="payroll_only">Create payroll-only</option>
                        )}
                        <option value="exclude">Mark as exclude</option>
                        {isResolved && <option value="unmatch">Unmatch / change</option>}
                        {isResolved && <option value="edit">Change match…</option>}
                      </select>
                      <ChevronDown className="w-3 h-3 absolute right-2 top-2.5 pointer-events-none text-gray-400" />
                    </div>
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>

      <Dialog open={!!editingEntry} onOpenChange={(o) => !o && setEditingEntry(null)}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Change match — {editingEntry?.providerNameRaw}</DialogTitle>
          </DialogHeader>
          {editingEntry && (
            <div className="space-y-4">
              <div>
                <Label className="text-xs text-gray-500 mb-1 block">Match to existing RBT</Label>
                <SearchableRbtSelect
                  candidates={candidates}
                  value={editingEntry.rbtProfileId ?? ''}
                  onSelect={(id) => {
                    if (id) {
                      patchEntry(editingEntry.id, { rbtProfileId: id })
                      setEditingEntry(null)
                    }
                  }}
                />
              </div>
              <Button
                variant="outline"
                className="w-full"
                onClick={() => {
                  patchEntry(editingEntry.id, { action: 'unmatch' })
                  setEditingEntry(null)
                }}
              >
                <RotateCcw className="w-4 h-4 mr-2" />
                Unmatch &amp; re-run auto-match
              </Button>
              <Button
                variant="outline"
                className="w-full"
                onClick={() => {
                  setPayrollName(editingEntry.providerNameRaw)
                  setPayrollModal(editingEntry)
                  setEditingEntry(null)
                }}
              >
                Switch to payroll-only record
              </Button>
            </div>
          )}
        </DialogContent>
      </Dialog>

      <Dialog open={!!payrollModal} onOpenChange={(o) => !o && setPayrollModal(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Payroll-only record</DialogTitle>
          </DialogHeader>
          <p className="text-sm text-gray-500">
            Creates a lightweight payee record — not an HRM login or RBT profile.
          </p>
          <div className="space-y-3">
            <div>
              <Label>Full name</Label>
              <Input value={payrollName} onChange={(e) => setPayrollName(e.target.value)} />
            </div>
            <div>
              <Label>Email (optional)</Label>
              <Input
                type="email"
                value={payrollEmail}
                onChange={(e) => setPayrollEmail(e.target.value)}
                placeholder="For hours confirmation"
              />
            </div>
            <div>
              <Label>Hourly rate (optional)</Label>
              <Input
                type="number"
                step="0.01"
                value={payrollRate}
                onChange={(e) => setPayrollRate(e.target.value)}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setPayrollModal(null)}>
              Cancel
            </Button>
            <Button
              className="bg-[#0D9488] hover:bg-teal-700 text-white"
              onClick={() => {
                if (!payrollModal) return
                patchEntry(payrollModal.id, {
                  action: 'payroll_only',
                  fullName: payrollName,
                  email: payrollEmail || null,
                  hourlyPayRate: payrollRate ? parseFloat(payrollRate) : null,
                })
                setPayrollModal(null)
              }}
            >
              Create &amp; match
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={!!excludeModal} onOpenChange={(o) => !o && setExcludeModal(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Exclude from payroll</DialogTitle>
          </DialogHeader>
          <Label>Reason</Label>
          <Input
            value={excludeReason}
            onChange={(e) => setExcludeReason(e.target.value)}
            placeholder="e.g. BCBA, test account"
          />
          <DialogFooter>
            <Button variant="outline" onClick={() => setExcludeModal(null)}>
              Cancel
            </Button>
            <Button
              variant="destructive"
              onClick={() => {
                if (!excludeModal) return
                patchEntry(excludeModal.id, { action: 'exclude', reason: excludeReason })
                setExcludeModal(null)
              }}
            >
              Exclude
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
