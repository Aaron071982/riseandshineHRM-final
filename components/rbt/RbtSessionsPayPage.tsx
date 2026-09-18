'use client'

import { useCallback, useEffect, useState } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import {
  Loader2,
  ChevronDown,
  ChevronRight,
  Download,
  DollarSign,
  Clock,
  TrendingUp,
} from 'lucide-react'
import { usd, fmtUtcDate } from '@/lib/payroll/format'

type PaySummary = {
  thisMonthPay: number
  totalEarned: number
  totalPayableHours: number
  statementCount: number
}

type PortalDeduction = {
  label: string
  amount: number
}

type PortalStub = {
  id: string
  source: 'unified' | 'legacy'
  payrollName: string
  totalHours: number
  grossPay: number
  totalDeductions: number
  netPay: number
  deductions: PortalDeduction[]
  pdfAvailable: boolean
  payPeriod: {
    label: string
    payDate: string
    periodStart: string
    periodEnd: string
  }
}

function StubBreakdown({ stub }: { stub: PortalStub }) {
  return (
    <div className="mt-4 space-y-3 text-sm">
      <div className="flex justify-between">
        <span className="text-gray-600">Hours</span>
        <span className="font-medium">{stub.totalHours.toFixed(2)}</span>
      </div>
      <div className="flex justify-between">
        <span className="text-gray-600">Gross pay</span>
        <span className="font-medium">{usd(stub.grossPay)}</span>
      </div>
      <div className="border-t pt-3">
        <p className="mb-2 font-medium text-gray-800">Deductions</p>
        <div className="space-y-1.5">
          {stub.deductions.length === 0 ? (
            <p className="text-gray-500">No itemized deductions on this stub.</p>
          ) : (
            stub.deductions.map((d) => (
              <div key={d.label} className="flex justify-between text-gray-600">
                <span>{d.label}</span>
                <span>−{usd(d.amount)}</span>
              </div>
            ))
          )}
          <div className="flex justify-between border-t pt-1 font-medium text-gray-800">
            <span>Total deductions</span>
            <span>−{usd(stub.totalDeductions)}</span>
          </div>
        </div>
      </div>
      <div className="mt-2 flex items-baseline justify-between rounded-lg bg-[#0E4D52]/5 px-3 py-3">
        <span className="font-semibold text-[#0E4D52]">Net pay</span>
        <span className="text-2xl font-bold text-[#0E4D52]">{usd(stub.netPay)}</span>
      </div>
    </div>
  )
}

function downloadStub(stub: PortalStub) {
  if (stub.source === 'unified' && stub.pdfAvailable) {
    window.location.href = `/api/payroll/statements/${stub.id}/download`
    return
  }
  const rows = stub.deductions
    .map(
      (d) =>
        `<div class="row"><span>${d.label}</span><span>-${usd(d.amount)}</span></div>`
    )
    .join('')
  const html = `<!DOCTYPE html><html><head><meta charset="UTF-8"><title>Pay Stub</title>
<style>body{font-family:system-ui,sans-serif;max-width:560px;margin:40px auto;color:#111}
.row{display:flex;justify-content:space-between;padding:6px 0;border-bottom:1px solid #eee}
.net{font-size:1.5rem;font-weight:700;margin-top:16px}</style></head><body>
<h1>Employee earnings statement</h1>
<p><strong>Period:</strong> ${fmtUtcDate(stub.payPeriod.periodStart)} – ${fmtUtcDate(stub.payPeriod.periodEnd)}</p>
<p><strong>Pay date:</strong> ${fmtUtcDate(stub.payPeriod.payDate)}</p>
<div class="row"><span>Hours</span><span>${stub.totalHours.toFixed(2)}</span></div>
<div class="row"><span>Gross pay</span><span>${usd(stub.grossPay)}</span></div>
${rows}
<div class="row"><span>Total deductions</span><span>-${usd(stub.totalDeductions)}</span></div>
<p class="net">Net pay: ${usd(stub.netPay)}</p>
</body></html>`
  const blob = new Blob([html], { type: 'text/html' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = `pay-stub-${fmtUtcDate(stub.payPeriod.payDate).replace(/\s/g, '-')}.html`
  a.click()
  URL.revokeObjectURL(url)
}

export default function RbtSessionsPayPage() {
  const [summary, setSummary] = useState<PaySummary | null>(null)
  const [stubs, setStubs] = useState<PortalStub[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [expandedId, setExpandedId] = useState<string | null>(null)

  const load = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const [sumRes, listRes] = await Promise.all([
        fetch('/api/rbt/pay/summary', { credentials: 'include' }),
        fetch('/api/rbt/pay/stubs', { credentials: 'include' }),
      ])
      const sumData = await sumRes.json().catch(() => ({}))
      const listData = await listRes.json().catch(() => ({}))
      if (!sumRes.ok || !listRes.ok) {
        setError(sumData.error || listData.error || 'Failed to load pay data')
        return
      }
      setSummary(sumData as PaySummary)
      const list = (listData.stubs ?? []) as PortalStub[]
      setStubs(list)
      if (list.length > 0) setExpandedId(list[0].id)
    } catch {
      setError('Failed to load pay data')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    void load()
  }, [load])

  if (loading) {
    return (
      <div className="flex justify-center py-24">
        <Loader2 className="h-8 w-8 animate-spin text-[#0E4D52]" />
      </div>
    )
  }

  if (error) {
    return (
      <Card className="border-red-100">
        <CardContent className="py-12 text-center text-red-600">{error}</CardContent>
      </Card>
    )
  }

  const latest = stubs[0] ?? null

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Pay</h1>
        <p className="mt-1 text-sm text-gray-500">
          Your W-2 earnings statements from payroll — gross, deductions, and net.
        </p>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-gray-600">
              This month net pay
            </CardTitle>
            <DollarSign className="h-4 w-4 text-gray-400" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{usd(summary?.thisMonthPay ?? 0)}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-gray-600">
              Total net earned
            </CardTitle>
            <TrendingUp className="h-4 w-4 text-gray-400" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{usd(summary?.totalEarned ?? 0)}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-gray-600">
              Total hours
            </CardTitle>
            <Clock className="h-4 w-4 text-gray-400" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {(summary?.totalPayableHours ?? 0).toFixed(1)}h
            </div>
          </CardContent>
        </Card>
      </div>

      {latest ? (
        <Card className="border-[#0E4D52]/20">
          <CardHeader>
            <div className="flex flex-wrap items-start justify-between gap-2">
              <div>
                <CardTitle className="text-lg">Latest pay stub</CardTitle>
                <p className="mt-1 text-sm text-gray-500">
                  {fmtUtcDate(latest.payPeriod.periodStart)} –{' '}
                  {fmtUtcDate(latest.payPeriod.periodEnd)}
                  {' · '}Pay date {fmtUtcDate(latest.payPeriod.payDate)}
                </p>
              </div>
              <Button variant="outline" size="sm" onClick={() => downloadStub(latest)}>
                <Download className="mr-1 h-4 w-4" />
                {latest.pdfAvailable ? 'Download PDF' : 'Download'}
              </Button>
            </div>
          </CardHeader>
          <CardContent>
            <StubBreakdown stub={latest} />
          </CardContent>
        </Card>
      ) : (
        <Card>
          <CardContent className="py-12 text-center text-gray-500">
            No published pay stubs yet. They appear here after payroll sends them.
          </CardContent>
        </Card>
      )}

      {stubs.length > 1 && (
        <div className="space-y-3">
          <h2 className="text-lg font-semibold">Pay history</h2>
          {stubs.map((stub) => {
            const open = expandedId === stub.id
            return (
              <Card key={stub.id}>
                <button
                  type="button"
                  className="flex w-full items-center justify-between gap-3 px-6 py-4 text-left"
                  onClick={() => setExpandedId(open ? null : stub.id)}
                >
                  <div>
                    <div className="font-medium">
                      {fmtUtcDate(stub.payPeriod.periodStart)} –{' '}
                      {fmtUtcDate(stub.payPeriod.periodEnd)}
                    </div>
                    <div className="text-sm text-gray-500">
                      Pay date {fmtUtcDate(stub.payPeriod.payDate)} ·{' '}
                      {stub.totalHours.toFixed(1)}h
                    </div>
                  </div>
                  <div className="flex items-center gap-3">
                    <Badge variant="secondary">{usd(stub.netPay)}</Badge>
                    {open ? (
                      <ChevronDown className="h-4 w-4" />
                    ) : (
                      <ChevronRight className="h-4 w-4" />
                    )}
                  </div>
                </button>
                {open && (
                  <CardContent className="border-t pt-0">
                    <div className="flex justify-end pt-3">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => downloadStub(stub)}
                      >
                        <Download className="mr-1 h-4 w-4" />
                        {stub.pdfAvailable ? 'Download PDF' : 'Download'}
                      </Button>
                    </div>
                    <StubBreakdown stub={stub} />
                  </CardContent>
                )}
              </Card>
            )
          })}
        </div>
      )}
    </div>
  )
}
