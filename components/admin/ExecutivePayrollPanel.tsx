'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { DollarSign } from 'lucide-react'
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from 'recharts'

type RunRow = {
  id: string
  label: string
  payDate: string
  totalNetPay: number
  employeeCount: number
}

function usd(n: number) {
  return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 }).format(
    n
  )
}

export default function ExecutivePayrollPanel({ accent = '#4F46E5' }: { accent?: string }) {
  const [runs, setRuns] = useState<RunRow[]>([])
  const [latest, setLatest] = useState<RunRow | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let cancelled = false
    fetch('/api/admin/analytics/payroll-summary', { credentials: 'include' })
      .then((r) => (r.ok ? r.json() : null))
      .then((body) => {
        if (cancelled || !body) return
        setRuns(body.runs ?? [])
        setLatest(body.latest ?? null)
      })
      .catch(() => {})
      .finally(() => {
        if (!cancelled) setLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [])

  if (loading) {
    return (
      <Card>
        <CardContent className="py-10 text-center text-gray-500">Loading payroll…</CardContent>
      </Card>
    )
  }

  const chartData = runs.map((r) => ({
    name: r.payDate.slice(5),
    net: Math.round(r.totalNetPay),
    label: r.label,
  }))

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <Card className="border-indigo-100 dark:border-indigo-900/40">
          <CardHeader className="pb-2">
            <CardDescription>Latest published run</CardDescription>
            <CardTitle className="text-2xl flex items-center gap-2" style={{ color: accent }}>
              <DollarSign className="h-6 w-6" />
              {latest ? usd(latest.totalNetPay) : '—'}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-gray-600 dark:text-gray-400">
              {latest
                ? `${latest.label} · ${latest.employeeCount} employee${latest.employeeCount === 1 ? '' : 's'}`
                : 'No published payroll runs yet'}
            </p>
            <Link href="/admin/payroll" className="text-sm font-medium mt-2 inline-block" style={{ color: accent }}>
              Open payroll →
            </Link>
          </CardContent>
        </Card>
        <Card className="border-indigo-100 dark:border-indigo-900/40">
          <CardHeader className="pb-2">
            <CardDescription>Employees on latest run</CardDescription>
            <CardTitle className="text-2xl" style={{ color: accent }}>
              {latest?.employeeCount ?? 0}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-gray-600 dark:text-gray-400">Headcount paid on the most recent register</p>
          </CardContent>
        </Card>
      </div>

      <Card className="border-indigo-100 dark:border-indigo-900/40">
        <CardHeader>
          <CardTitle className="text-lg">Payroll — total net pay</CardTitle>
          <CardDescription>Published runs (most recent 12)</CardDescription>
        </CardHeader>
        <CardContent>
          {chartData.length === 0 ? (
            <p className="text-sm text-gray-500 py-8 text-center">No published payroll data yet</p>
          ) : (
            <div className="h-64 w-full">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={chartData} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" className="stroke-gray-200" />
                  <XAxis dataKey="name" tick={{ fontSize: 12 }} />
                  <YAxis
                    tick={{ fontSize: 12 }}
                    tickFormatter={(v) => `$${Math.round(Number(v) / 1000)}k`}
                  />
                  <Tooltip
                    formatter={(value) => [usd(Number(value ?? 0)), 'Net pay']}
                    labelFormatter={(_, payload) => payload?.[0]?.payload?.label ?? ''}
                  />
                  <Bar dataKey="net" fill={accent} radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
