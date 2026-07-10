'use client'

import { useCallback, useEffect, useState } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Loader2, ChevronDown, ChevronRight, Download, DollarSign, Clock, TrendingUp } from 'lucide-react'
import { statusLabel, type ArtemisSessionStatusKey } from '@/lib/billing/sessionStatus'

type PaySummary = {
  thisMonthPay: number
  totalEarned: number
  totalPayableHours: number
  statementCount: number
}

type PayStatement = {
  id: string
  periodStart: string
  periodEnd: string
  payableStatuses: string[]
  completedHours: number
  readyToBillHours: number
  incompleteHours: number
  inProgressHours: number
  scheduledHours: number
  payableHours: number
  hourlyRate: number
  grossPay: number
  adjustment: number
  finalPay: number
  status: string
}

type PaySession = {
  id: string
  clientName: string
  dos: string
  status: string
  hours: number
  procedureCode: string | null
  isPayable: boolean
}

type StatementDetail = PayStatement & {
  sessions: PaySession[]
  billingCycle?: { label: string; status: string }
}

function usd(n: number) {
  return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(n)
}

function fmtDate(d: string) {
  return new Date(d).toLocaleDateString('en-US', {
    timeZone: 'UTC',
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  })
}

function StatusBreakdown({ s }: { s: PayStatement }) {
  const payable = new Set(s.payableStatuses)
  const rows: { key: ArtemisSessionStatusKey; hours: number }[] = [
    { key: 'completed', hours: s.completedHours },
    { key: 'ready_to_bill', hours: s.readyToBillHours },
    { key: 'incomplete', hours: s.incompleteHours },
    { key: 'in_progress', hours: s.inProgressHours },
    { key: 'scheduled', hours: s.scheduledHours },
  ]
  return (
    <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 mt-3">
      {rows.map((r) => {
        const isPay = payable.has(r.key)
        return (
          <div
            key={r.key}
            className={`rounded-lg border px-3 py-2 text-sm ${
              isPay
                ? 'border-green-200 bg-green-50 text-green-900'
                : 'border-gray-100 bg-gray-50 text-gray-400'
            }`}
          >
            <div className="text-xs font-medium opacity-80">{statusLabel(r.key)}</div>
            <div className="font-semibold">{r.hours.toFixed(2)}h</div>
            {!isPay && <div className="text-[10px] uppercase tracking-wide">Not payable</div>}
          </div>
        )
      })}
    </div>
  )
}

function downloadStatementHtml(detail: StatementDetail) {
  const rows = detail.sessions
    .map(
      (s) =>
        `<tr><td>${fmtDate(s.dos)}</td><td>${s.clientName}</td><td>${statusLabel(s.status as ArtemisSessionStatusKey)}</td><td>${s.hours.toFixed(2)}</td><td>${s.isPayable ? 'Yes' : 'No'}</td></tr>`
    )
    .join('')
  const html = `<!DOCTYPE html><html><head><meta charset="UTF-8"><title>Pay Statement</title>
<style>body{font-family:system-ui,sans-serif;max-width:720px;margin:40px auto;color:#111}table{width:100%;border-collapse:collapse;margin-top:16px}th,td{border:1px solid #ddd;padding:8px;text-align:left}th{background:#f5f5f5}</style></head><body>
<h1>Pay Statement</h1>
<p><strong>Period:</strong> ${fmtDate(detail.periodStart)} – ${fmtDate(detail.periodEnd)}</p>
<p><strong>Payable hours:</strong> ${detail.payableHours.toFixed(2)} × ${usd(detail.hourlyRate)} = ${usd(detail.grossPay)}</p>
${detail.adjustment ? `<p><strong>Adjustment:</strong> ${usd(detail.adjustment)}</p>` : ''}
<p><strong>Expected pay:</strong> ${usd(detail.finalPay)}</p>
<table><thead><tr><th>Date</th><th>Client</th><th>Status</th><th>Hours</th><th>Payable</th></tr></thead><tbody>${rows}</tbody></table>
</body></html>`
  const blob = new Blob([html], { type: 'text/html' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = `pay-statement-${fmtDate(detail.periodStart).replace(/\s/g, '-')}.html`
  a.click()
  URL.revokeObjectURL(url)
}

export default function RbtSessionsPayPage() {
  const [summary, setSummary] = useState<PaySummary | null>(null)
  const [statements, setStatements] = useState<PayStatement[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [expandedId, setExpandedId] = useState<string | null>(null)
  const [details, setDetails] = useState<Record<string, StatementDetail>>({})
  const [detailLoading, setDetailLoading] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false
    ;(async () => {
      try {
        const [sumRes, listRes] = await Promise.all([
          fetch('/api/rbt/pay/summary', { credentials: 'include' }),
          fetch('/api/rbt/pay/statements', { credentials: 'include' }),
        ])
        const sumData = await sumRes.json().catch(() => ({}))
        const listData = await listRes.json().catch(() => ({}))
        if (!sumRes.ok || !listRes.ok) {
          if (!cancelled) setError(sumData.error || listData.error || 'Failed to load pay data')
          return
        }
        if (!cancelled) {
          setSummary(sumData)
          setStatements(listData.statements ?? [])
          if ((listData.statements ?? []).length > 0) {
            setExpandedId(listData.statements[0].id)
          }
        }
      } catch {
        if (!cancelled) setError('Failed to load pay data')
      } finally {
        if (!cancelled) setLoading(false)
      }
    })()
    return () => {
      cancelled = true
    }
  }, [])

  const loadDetail = useCallback(
    async (id: string) => {
      if (details[id]) return
      setDetailLoading(id)
      try {
        const res = await fetch(`/api/rbt/pay/statements/${id}`, { credentials: 'include' })
        const data = await res.json().catch(() => ({}))
        if (res.ok && data.statement) {
          setDetails((prev) => ({ ...prev, [id]: data.statement }))
        }
      } finally {
        setDetailLoading(null)
      }
    },
    [details]
  )

  useEffect(() => {
    if (expandedId) loadDetail(expandedId)
  }, [expandedId, loadDetail])

  const latest = statements[0] ?? null
  const latestDetail = latest ? details[latest.id] : null

  if (loading) {
    return (
      <div className="flex justify-center py-24">
        <Loader2 className="h-8 w-8 animate-spin text-green-500" />
      </div>
    )
  }

  if (error) {
    return (
      <Card className="border-2 border-red-100">
        <CardContent className="py-12 text-center text-red-600">{error}</CardContent>
      </Card>
    )
  }

  return (
    <div className="space-y-6">
      <div className="relative overflow-hidden rounded-2xl bg-gradient-to-r from-emerald-500 via-green-500 to-teal-500 p-8 shadow-lg">
        <div className="absolute top-0 right-0 w-32 h-32 bg-white/20 rounded-full -mr-16 -mt-16" />
        <div className="relative">
          <h1 className="text-4xl font-bold text-white mb-2">Sessions &amp; Pay</h1>
          <p className="text-emerald-50 text-lg">Finalized pay periods from billing</p>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card className="border-2 border-emerald-200 bg-gradient-to-br from-white to-emerald-50">
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600">This Month&apos;s Pay</p>
                <p className="text-3xl font-bold text-emerald-600 mt-2">{usd(summary?.thisMonthPay ?? 0)}</p>
              </div>
              <div className="h-12 w-12 rounded-full bg-emerald-500 flex items-center justify-center">
                <DollarSign className="h-6 w-6 text-white" />
              </div>
            </div>
          </CardContent>
        </Card>
        <Card className="border-2 border-blue-200 bg-gradient-to-br from-white to-blue-50">
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600">Total Earned</p>
                <p className="text-3xl font-bold text-blue-600 mt-2">{usd(summary?.totalEarned ?? 0)}</p>
              </div>
              <div className="h-12 w-12 rounded-full bg-blue-500 flex items-center justify-center">
                <TrendingUp className="h-6 w-6 text-white" />
              </div>
            </div>
          </CardContent>
        </Card>
        <Card className="border-2 border-purple-200 bg-gradient-to-br from-white to-purple-50">
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600">Total Payable Hours</p>
                <p className="text-3xl font-bold text-purple-600 mt-2">
                  {(summary?.totalPayableHours ?? 0).toFixed(1)}h
                </p>
              </div>
              <div className="h-12 w-12 rounded-full bg-purple-500 flex items-center justify-center">
                <Clock className="h-6 w-6 text-white" />
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {latest ? (
        <Card className="border-2 border-emerald-200 shadow-sm">
          <CardHeader className="pb-2">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <CardTitle className="text-xl">Latest pay period</CardTitle>
              <Badge className="bg-emerald-100 text-emerald-800 border-0">Finalized</Badge>
            </div>
            <p className="text-sm text-gray-500">
              {fmtDate(latest.periodStart)} – {fmtDate(latest.periodEnd)}
            </p>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="rounded-xl bg-emerald-50 border border-emerald-100 p-4">
              <p className="text-sm text-emerald-800">
                {latest.payableHours.toFixed(2)} hrs × {usd(latest.hourlyRate)}
                {latest.adjustment !== 0 ? ` ${latest.adjustment >= 0 ? '+' : ''}${usd(latest.adjustment)} adj` : ''}
              </p>
              <p className="text-3xl font-bold text-emerald-700 mt-1">
                Expected pay: {usd(latest.finalPay)}
              </p>
            </div>
            <StatusBreakdown s={latest} />
            {detailLoading === latest.id && !latestDetail ? (
              <div className="flex justify-center py-4">
                <Loader2 className="h-5 w-5 animate-spin text-gray-400" />
              </div>
            ) : latestDetail ? (
              <SessionTable sessions={latestDetail.sessions} />
            ) : null}
            {latestDetail && (
              <Button variant="outline" size="sm" onClick={() => downloadStatementHtml(latestDetail)}>
                <Download className="h-4 w-4 mr-1" /> Download statement
              </Button>
            )}
          </CardContent>
        </Card>
      ) : (
        <Card className="border-2 border-gray-100">
          <CardContent className="py-12 text-center">
            <p className="text-xl font-semibold text-gray-700 mb-2">No finalized pay yet</p>
            <p className="text-gray-500">
              Your pay statements appear here after payroll finalizes a billing cycle.
            </p>
          </CardContent>
        </Card>
      )}

      {statements.length > 0 && (
        <Card className="border border-gray-200">
          <CardHeader>
            <CardTitle className="text-lg">Pay history</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2 pt-0">
            {statements.map((s) => {
              const open = expandedId === s.id
              const detail = details[s.id]
              return (
                <div key={s.id} className="rounded-lg border border-gray-200 overflow-hidden">
                  <button
                    type="button"
                    className="w-full flex items-center justify-between gap-3 p-4 text-left hover:bg-gray-50"
                    onClick={() => setExpandedId(open ? null : s.id)}
                  >
                    <div className="flex items-center gap-2 min-w-0">
                      {open ? <ChevronDown className="h-4 w-4 shrink-0" /> : <ChevronRight className="h-4 w-4 shrink-0" />}
                      <div>
                        <p className="font-medium text-gray-900">
                          {fmtDate(s.periodStart)} – {fmtDate(s.periodEnd)}
                        </p>
                        <p className="text-sm text-gray-500">
                          {s.payableHours.toFixed(2)}h · {usd(s.hourlyRate)}/hr
                        </p>
                      </div>
                    </div>
                    <p className="font-semibold text-emerald-700 shrink-0">{usd(s.finalPay)}</p>
                  </button>
                  {open && (
                    <div className="border-t border-gray-100 bg-gray-50/50 p-4 space-y-3">
                      <StatusBreakdown s={s} />
                      {detailLoading === s.id && !detail ? (
                        <Loader2 className="h-5 w-5 animate-spin text-gray-400 mx-auto" />
                      ) : detail ? (
                        <>
                          <SessionTable sessions={detail.sessions} />
                          <Button variant="outline" size="sm" onClick={() => downloadStatementHtml(detail)}>
                            <Download className="h-4 w-4 mr-1" /> Download
                          </Button>
                        </>
                      ) : null}
                    </div>
                  )}
                </div>
              )
            })}
          </CardContent>
        </Card>
      )}
    </div>
  )
}

function SessionTable({ sessions }: { sessions: PaySession[] }) {
  if (sessions.length === 0) {
    return <p className="text-sm text-gray-500">No session details.</p>
  }
  return (
    <div className="overflow-x-auto rounded-lg border border-gray-200 bg-white">
      <table className="w-full text-sm">
        <thead>
          <tr className="bg-gray-50 text-left text-gray-600">
            <th className="px-3 py-2 font-medium">Date</th>
            <th className="px-3 py-2 font-medium">Client</th>
            <th className="px-3 py-2 font-medium">Status</th>
            <th className="px-3 py-2 font-medium">Hours</th>
            <th className="px-3 py-2 font-medium">Payable</th>
          </tr>
        </thead>
        <tbody>
          {sessions.map((s) => (
            <tr key={s.id} className="border-t border-gray-100">
              <td className="px-3 py-2 whitespace-nowrap">{fmtDate(s.dos)}</td>
              <td className="px-3 py-2">{s.clientName}</td>
              <td className="px-3 py-2">{statusLabel(s.status as ArtemisSessionStatusKey)}</td>
              <td className="px-3 py-2">{s.hours.toFixed(2)}</td>
              <td className="px-3 py-2">
                {s.isPayable ? (
                  <Badge className="bg-green-100 text-green-800 border-0">Yes</Badge>
                ) : (
                  <Badge variant="outline" className="text-gray-400">
                    No
                  </Badge>
                )}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}
