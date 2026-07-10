'use client'

import {
  Bar,
  BarChart,
  Cell,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
  Legend,
} from 'recharts'
import type { Metrics } from '@/lib/artemis/metrics'
import { usd2, pct } from './formatters'

const TEAL = '#0D9488'
const PIE_COLORS = ['#0D9488', '#14B8A6', '#2DD4BF', '#5EEAD4', '#99F6E4']

export default function OverviewTab({ metrics }: { metrics: Metrics }) {
  const { leakage, byWeek, byType } = metrics

  const leakCards = [
    { label: 'Incomplete', value: leakage.incomplete.value, count: leakage.incomplete.rows.length },
    { label: 'Not claimed', value: leakage.notClaimed.value, count: leakage.notClaimed.rows.length },
    { label: 'Pending payer', value: leakage.pending.value, count: leakage.pending.rows.length },
    { label: 'Denied', value: leakage.denied.value, count: leakage.denied.rows.length },
  ]

  const pieData = byType.map((t) => ({ name: t.type, value: t.collected }))

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        {leakCards.map((c) => (
          <div
            key={c.label}
            className="rounded-lg border border-gray-200 dark:border-gray-700 p-4 bg-white dark:bg-gray-900"
          >
            <p className="text-xs text-gray-500 uppercase">{c.label}</p>
            <p className="text-lg font-bold tabular-nums text-amber-600">{usd2(c.value)}</p>
            <p className="text-xs text-gray-400">{c.count} rows</p>
          </div>
        ))}
      </div>

      <div className="grid lg:grid-cols-2 gap-6">
        <div className="rounded-lg border border-gray-200 dark:border-gray-700 p-4 bg-white dark:bg-gray-900">
          <h3 className="text-sm font-semibold mb-3">Claimed vs collected by week</h3>
          {byWeek.length === 0 ? (
            <p className="text-sm text-gray-500 py-8 text-center">No weekly data</p>
          ) : (
            <ResponsiveContainer width="100%" height={240}>
              <BarChart data={byWeek} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
                <XAxis dataKey="week" tick={{ fontSize: 11 }} />
                <YAxis tick={{ fontSize: 11 }} tickFormatter={(v) => `$${(v / 1000).toFixed(0)}k`} />
                <Tooltip formatter={(v) => usd2(Number(v ?? 0))} />
                <Legend />
                <Bar dataKey="claimed" fill="#94A3B8" name="Claimed" radius={[2, 2, 0, 0]} />
                <Bar dataKey="collected" fill={TEAL} name="Collected" radius={[2, 2, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          )}
        </div>

        <div className="rounded-lg border border-gray-200 dark:border-gray-700 p-4 bg-white dark:bg-gray-900">
          <h3 className="text-sm font-semibold mb-3">Collected by payer type</h3>
          {pieData.length === 0 ? (
            <p className="text-sm text-gray-500 py-8 text-center">No collection data</p>
          ) : (
            <ResponsiveContainer width="100%" height={240}>
              <PieChart>
                <Pie
                  data={pieData}
                  dataKey="value"
                  nameKey="name"
                  cx="50%"
                  cy="50%"
                  innerRadius={50}
                  outerRadius={80}
                  paddingAngle={2}
                >
                  {pieData.map((_, i) => (
                    <Cell key={i} fill={PIE_COLORS[i % PIE_COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip formatter={(v) => usd2(Number(v ?? 0))} />
                <Legend />
              </PieChart>
            </ResponsiveContainer>
          )}
        </div>
      </div>

      <p className="text-xs text-gray-400">
        Overall collection rate: {pct(metrics.collectionRate)} · At-risk: {usd2(metrics.atRisk)}
      </p>
    </div>
  )
}
