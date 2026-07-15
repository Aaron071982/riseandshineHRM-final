'use client'

import { useCallback, useEffect, useState } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Loader2, ChevronDown, ChevronRight, Download, DollarSign, Clock, TrendingUp } from 'lucide-react'
import { usd, fmtUtcDate } from '@/lib/payroll/format'

type PaySummary = {
  thisMonthPay: number
  totalEarned: number
  totalPayableHours: number
  statementCount: number
}

type PayStub = {
  id: string
  rbtProfileId: string | null
  payrollName: string
  totalHours: number
  grossPay: number
  adjustedGross: number | null
  empTaxTotal: number
  empTaxFIT: number
  empTaxSS: number
  empTaxMed: number
  empTaxNYIT: number
  netPay: number
  payrollRun: {
    id: string
    label: string
    payDate: string
    periodStart: string
    periodEnd: string
    status: string
  }
}

function StubBreakdown({ stub }: { stub: PayStub }) {
  const deductions = [
    { label: 'Federal Income Tax', amount: stub.empTaxFIT },
    { label: 'Social Security', amount: stub.empTaxSS },
    { label: 'Medicare', amount: stub.empTaxMed },
    { label: 'NY Income Tax', amount: stub.empTaxNYIT },
  ]
  return (
    <div className="mt-4 space-y-3 text-sm">
      <div className="flex justify-between">
        <span className="text-gray-600">Hours</span>
        <span className="font-medium">{stub.totalHours.toFixed(2)}</span>
      </div>
      <div className="flex justify-between">
        <span className="text-gray-600">Gross Pay</span>
        <span className="font-medium">{usd(stub.grossPay)}</span>
      </div>
      <div className="border-t pt-3">
        <p className="font-medium text-gray-800 mb-2">Deductions</p>
        <div className="space-y-1.5">
          {deductions.map((d) => (
            <div key={d.label} className="flex justify-between text-gray-600">
              <span>{d.label}</span>
              <span>−{usd(d.amount)}</span>
            </div>
          ))}
          <div className="flex justify-between font-medium text-gray-800 pt-1 border-t">
            <span>Total Deductions</span>
            <span>−{usd(stub.empTaxTotal)}</span>
          </div>
        </div>
      </div>
      <div className="flex justify-between items-baseline bg-[#0E4D52]/5 rounded-lg px-3 py-3 mt-2">
        <span className="font-semibold text-[#0E4D52]">Net Pay</span>
        <span className="text-2xl font-bold text-[#0E4D52]">{usd(stub.netPay)}</span>
      </div>
    </div>
  )
}

function downloadStubHtml(stub: PayStub) {
  const html = `<!DOCTYPE html><html><head><meta charset="UTF-8"><title>Pay Stub</title>
<style>body{font-family:system-ui,sans-serif;max-width:560px;margin:40px auto;color:#111}
.row{display:flex;justify-content:space-between;padding:6px 0;border-bottom:1px solid #eee}
.net{font-size:1.5rem;font-weight:700;margin-top:16px}</style></head><body>
<h1>Pay Stub</h1>
<p><strong>Period:</strong> ${fmtUtcDate(stub.payrollRun.periodStart)} – ${fmtUtcDate(stub.payrollRun.periodEnd)}</p>
<p><strong>Pay date:</strong> ${fmtUtcDate(stub.payrollRun.payDate)}</p>
<div class="row"><span>Hours</span><span>${stub.totalHours.toFixed(2)}</span></div>
<div class="row"><span>Gross Pay</span><span>${usd(stub.grossPay)}</span></div>
<div class="row"><span>Federal Income Tax</span><span>-${usd(stub.empTaxFIT)}</span></div>
<div class="row"><span>Social Security</span><span>-${usd(stub.empTaxSS)}</span></div>
<div class="row"><span>Medicare</span><span>-${usd(stub.empTaxMed)}</span></div>
<div class="row"><span>NY Income Tax</span><span>-${usd(stub.empTaxNYIT)}</span></div>
<div class="row"><span>Total Deductions</span><span>-${usd(stub.empTaxTotal)}</span></div>
<p class="net">Net Pay: ${usd(stub.netPay)}</p>
</body></html>`
  const blob = new Blob([html], { type: 'text/html' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = `pay-stub-${fmtUtcDate(stub.payrollRun.payDate).replace(/\s/g, '-')}.html`
  a.click()
  URL.revokeObjectURL(url)
}

export default function RbtSessionsPayPage() {
  const [summary, setSummary] = useState<PaySummary | null>(null)
  const [stubs, setStubs] = useState<PayStub[]>([])
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
      setSummary(sumData)
      const list = (listData.stubs ?? []) as PayStub[]
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
        <p className="text-sm text-gray-500 mt-1">Your published pay stubs from payroll.</p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <Card>
          <CardHeader className="pb-2 flex flex-row items-center justify-between">
            <CardTitle className="text-sm font-medium text-gray-600">This Month Net Pay</CardTitle>
            <DollarSign className="h-4 w-4 text-gray-400" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{usd(summary?.thisMonthPay ?? 0)}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2 flex flex-row items-center justify-between">
            <CardTitle className="text-sm font-medium text-gray-600">Total Net Earned</CardTitle>
            <TrendingUp className="h-4 w-4 text-gray-400" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{usd(summary?.totalEarned ?? 0)}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2 flex flex-row items-center justify-between">
            <CardTitle className="text-sm font-medium text-gray-600">Total Hours</CardTitle>
            <Clock className="h-4 w-4 text-gray-400" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{(summary?.totalPayableHours ?? 0).toFixed(1)}h</div>
          </CardContent>
        </Card>
      </div>

      {latest ? (
        <Card className="border-[#0E4D52]/20">
          <CardHeader>
            <div className="flex flex-wrap items-start justify-between gap-2">
              <div>
                <CardTitle className="text-lg">Latest pay stub</CardTitle>
                <p className="text-sm text-gray-500 mt-1">
                  {fmtUtcDate(latest.payrollRun.periodStart)} – {fmtUtcDate(latest.payrollRun.periodEnd)}
                  {' · '}Pay date {fmtUtcDate(latest.payrollRun.payDate)}
                </p>
              </div>
              <Button variant="outline" size="sm" onClick={() => downloadStubHtml(latest)}>
                <Download className="w-4 h-4 mr-1" />
                Download
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
            No published pay stubs yet. Your pay will appear here after payroll is published.
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
                  className="w-full text-left px-6 py-4 flex items-center justify-between gap-3"
                  onClick={() => setExpandedId(open ? null : stub.id)}
                >
                  <div>
                    <div className="font-medium">
                      {fmtUtcDate(stub.payrollRun.periodStart)} – {fmtUtcDate(stub.payrollRun.periodEnd)}
                    </div>
                    <div className="text-sm text-gray-500">
                      Pay date {fmtUtcDate(stub.payrollRun.payDate)} · {stub.totalHours.toFixed(1)}h
                    </div>
                  </div>
                  <div className="flex items-center gap-3">
                    <Badge variant="secondary">{usd(stub.netPay)}</Badge>
                    {open ? <ChevronDown className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
                  </div>
                </button>
                {open && (
                  <CardContent className="pt-0 border-t">
                    <div className="flex justify-end pt-3">
                      <Button variant="outline" size="sm" onClick={() => downloadStubHtml(stub)}>
                        <Download className="w-4 h-4 mr-1" />
                        Download
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
