'use client'

import { useMemo, useState } from 'react'
import Link from 'next/link'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { CurrencyCell } from '@/components/billing/CurrencyCell'
import { MatchStatusBadge } from '@/components/billing/MatchStatusBadge'
import { formatHours } from '@/lib/billing/format'
import {
  ARTEMIS_STATUS,
  PAYABLE_STATUS_OPTIONS,
  computePayableHours,
  computeStatusBreakdown,
  type ArtemisSessionStatusKey,
} from '@/lib/billing/sessionStatus'
import type { BillingMatchStatus } from '@prisma/client'
import { cn } from '@/lib/utils'

export type BreakdownEntry = {
  id: string
  providerNameRaw: string
  matchStatus: BillingMatchStatus
  isExcluded: boolean
  hourlyRate: number | null
  adjustment: number
  finalPay: number
  totalHours: number
  rbtProfile: { firstName: string; lastName: string; email?: string | null } | null
  payrollOnly: { fullName: string; email?: string | null } | null
  sessions: {
    sessionStatus: string | null
    actualMinutes: number
    dos: string
    clientName: string
  }[]
}

type SortKey =
  | 'name'
  | ArtemisSessionStatusKey
  | 'payable'
  | 'rate'
  | 'pay'

function employeeName(e: BreakdownEntry): string {
  if (e.rbtProfile) return `${e.rbtProfile.firstName} ${e.rbtProfile.lastName}`.trim()
  if (e.payrollOnly) return e.payrollOnly.fullName
  return e.providerNameRaw
}

export default function PayrollStatusBreakdown({
  entries,
  payableStatuses,
  cycleId,
}: {
  entries: BreakdownEntry[]
  payableStatuses: ArtemisSessionStatusKey[]
  cycleId?: string
}) {
  const [search, setSearch] = useState('')
  const [matchFilter, setMatchFilter] = useState('all')
  const [statusFilter, setStatusFilter] = useState('all')
  const [incompleteOnly, setIncompleteOnly] = useState(false)
  const [sortKey, setSortKey] = useState<SortKey>('name')
  const [sortAsc, setSortAsc] = useState(true)

  const payableSet = useMemo(() => new Set(payableStatuses), [payableStatuses])

  const rows = useMemo(() => {
    return entries
      .filter((e) => !e.isExcluded)
      .map((e) => {
        const breakdown = computeStatusBreakdown(e.sessions)
        const payableHours = computePayableHours(e.sessions, payableStatuses)
        const rate = e.hourlyRate ?? 0
        const pay = rate * payableHours + (e.adjustment ?? 0)
        const incompleteCount = e.sessions.filter(
          (s) => s.sessionStatus === ARTEMIS_STATUS.INCOMPLETE
        ).length
        return {
          entry: e,
          name: employeeName(e),
          breakdown,
          payableHours,
          pay,
          incompleteCount,
        }
      })
  }, [entries, payableStatuses])

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase()
    return rows.filter((r) => {
      if (q && !r.name.toLowerCase().includes(q) && !r.entry.providerNameRaw.toLowerCase().includes(q))
        return false
      if (matchFilter === 'matched' && r.entry.matchStatus !== 'MATCHED') return false
      if (matchFilter === 'payroll_only' && r.entry.matchStatus !== 'PAYROLL_ONLY') return false
      if (matchFilter === 'unmatched' && r.entry.matchStatus !== 'UNMATCHED') return false
      if (matchFilter === 'needs_review' && r.entry.matchStatus !== 'NEEDS_REVIEW') return false
      if (statusFilter !== 'all') {
        const hrs = r.breakdown[statusFilter as ArtemisSessionStatusKey] ?? 0
        if (hrs <= 0) return false
      }
      if (incompleteOnly && r.incompleteCount === 0) return false
      return true
    })
  }, [rows, search, matchFilter, statusFilter, incompleteOnly])

  const sorted = useMemo(() => {
    const list = [...filtered]
    list.sort((a, b) => {
      let av: number | string = 0
      let bv: number | string = 0
      if (sortKey === 'name') {
        av = a.name
        bv = b.name
      } else if (sortKey === 'payable') {
        av = a.payableHours
        bv = b.payableHours
      } else if (sortKey === 'rate') {
        av = a.entry.hourlyRate ?? 0
        bv = b.entry.hourlyRate ?? 0
      } else if (sortKey === 'pay') {
        av = a.pay
        bv = b.pay
      } else {
        av = a.breakdown[sortKey] ?? 0
        bv = b.breakdown[sortKey] ?? 0
      }
      if (typeof av === 'string' && typeof bv === 'string') {
        return sortAsc ? av.localeCompare(bv) : bv.localeCompare(av)
      }
      return sortAsc ? Number(av) - Number(bv) : Number(bv) - Number(av)
    })
    return list
  }, [filtered, sortKey, sortAsc])

  const totals = useMemo(() => {
    const t = {
      breakdown: computeStatusBreakdown([]),
      payableHours: 0,
      pay: 0,
    }
    for (const key of PAYABLE_STATUS_OPTIONS.map((o) => o.key)) {
      t.breakdown[key] = 0
    }
    for (const r of sorted) {
      for (const key of PAYABLE_STATUS_OPTIONS.map((o) => o.key)) {
        t.breakdown[key] += r.breakdown[key]
      }
      t.payableHours += r.payableHours
      t.pay += r.pay
    }
    return t
  }, [sorted])

  const toggleSort = (key: SortKey) => {
    if (sortKey === key) setSortAsc(!sortAsc)
    else {
      setSortKey(key)
      setSortAsc(key === 'name')
    }
  }

  const th = (key: SortKey, label: string, muted = false) => (
    <th
      key={key}
      className={cn(
        'px-2 py-2 text-right cursor-pointer select-none whitespace-nowrap text-xs font-semibold',
        muted && 'text-gray-400'
      )}
      onClick={() => toggleSort(key)}
    >
      {label}
      {sortKey === key ? (sortAsc ? ' ↑' : ' ↓') : ''}
    </th>
  )

  const filterQuery = useMemo(() => {
    const params = new URLSearchParams()
    if (search.trim()) params.set('search', search.trim())
    if (matchFilter !== 'all') params.set('match', matchFilter)
    if (statusFilter !== 'all') params.set('status', statusFilter)
    if (incompleteOnly) params.set('incomplete', '1')
    const q = params.toString()
    return q ? `?${q}` : ''
  }, [search, matchFilter, statusFilter, incompleteOnly])

  const exportFilteredHref = cycleId
    ? `/api/billing/cycles/${cycleId}/export${filterQuery}`
    : null
  const exportAllHref = cycleId ? `/api/billing/cycles/${cycleId}/export` : null

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap gap-3 items-end">
        <div className="flex-1 min-w-[160px]">
          <Label className="text-xs">Search RBT</Label>
          <Input
            placeholder="Name…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="h-9"
          />
        </div>
        <div className="w-[160px]">
          <Label className="text-xs">Match state</Label>
          <Select value={matchFilter} onValueChange={setMatchFilter}>
            <SelectTrigger className="h-9">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All</SelectItem>
              <SelectItem value="matched">Matched</SelectItem>
              <SelectItem value="payroll_only">Payroll only</SelectItem>
              <SelectItem value="unmatched">Unmatched</SelectItem>
              <SelectItem value="needs_review">Needs review</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div className="w-[160px]">
          <Label className="text-xs">Has hours in status</Label>
          <Select value={statusFilter} onValueChange={setStatusFilter}>
            <SelectTrigger className="h-9">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Any status</SelectItem>
              {PAYABLE_STATUS_OPTIONS.map((o) => (
                <SelectItem key={o.key} value={o.key}>
                  {o.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <label className="flex items-center gap-2 text-sm pb-2 cursor-pointer">
          <input
            type="checkbox"
            checked={incompleteOnly}
            onChange={(e) => setIncompleteOnly(e.target.checked)}
          />
          Has incomplete
        </label>
        {exportFilteredHref && exportAllHref && (
          <div className="flex gap-2 pb-1 ml-auto">
            <Link
              href={exportFilteredHref}
              className="text-xs text-[#0D9488] hover:underline whitespace-nowrap"
            >
              Export filtered
            </Link>
            <Link
              href={exportAllHref}
              className="text-xs text-gray-500 hover:underline whitespace-nowrap"
            >
              Export all
            </Link>
          </div>
        )}
      </div>

      <div className="overflow-x-auto rounded-lg border dark:border-[var(--border-subtle)]">
        <table className="min-w-full text-sm">
          <thead className="bg-[#0D9488] text-white">
            <tr>
              <th
                className="px-3 py-2 text-left cursor-pointer text-xs font-semibold"
                onClick={() => toggleSort('name')}
              >
                RBT Name{sortKey === 'name' ? (sortAsc ? ' ↑' : ' ↓') : ''}
              </th>
              {PAYABLE_STATUS_OPTIONS.map((o) =>
                th(o.key, o.label, !payableSet.has(o.key))
              )}
              {th('payable', 'PAYABLE HRS')}
              {th('rate', 'Rate')}
              {th('pay', 'PAY')}
            </tr>
          </thead>
          <tbody>
            {sorted.map((r) => (
              <tr key={r.entry.id} className="border-t dark:border-[var(--border-subtle)]">
                <td className="px-3 py-2">
                  <p className="font-medium">{r.name}</p>
                  <MatchStatusBadge status={r.entry.matchStatus} className="mt-0.5" />
                </td>
                {PAYABLE_STATUS_OPTIONS.map((o) => (
                  <td
                    key={o.key}
                    className={cn(
                      'px-2 py-2 text-right tabular-nums',
                      !payableSet.has(o.key) && 'text-gray-400 bg-gray-50/80 dark:bg-gray-900/20'
                    )}
                  >
                    {r.breakdown[o.key] > 0 ? formatHours(r.breakdown[o.key]) : '—'}
                  </td>
                ))}
                <td className="px-2 py-2 text-right font-semibold tabular-nums">
                  {formatHours(r.payableHours)}
                </td>
                <td className="px-2 py-2 text-right tabular-nums">
                  <CurrencyCell value={r.entry.hourlyRate} />
                </td>
                <td className="px-2 py-2 text-right font-semibold tabular-nums">
                  <CurrencyCell value={r.pay} />
                </td>
              </tr>
            ))}
          </tbody>
          <tfoot className="bg-gray-100 dark:bg-[var(--bg-elevated)] font-bold">
            <tr>
              <td className="px-3 py-2">Totals</td>
              {PAYABLE_STATUS_OPTIONS.map((o) => (
                <td key={o.key} className="px-2 py-2 text-right tabular-nums">
                  {totals.breakdown[o.key] > 0 ? formatHours(totals.breakdown[o.key]) : '—'}
                </td>
              ))}
              <td className="px-2 py-2 text-right">{formatHours(totals.payableHours)}</td>
              <td className="px-2 py-2" />
              <td className="px-2 py-2 text-right">
                <CurrencyCell value={totals.pay} />
              </td>
            </tr>
          </tfoot>
        </table>
      </div>
    </div>
  )
}
