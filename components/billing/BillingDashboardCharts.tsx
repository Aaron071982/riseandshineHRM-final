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
} from 'recharts'
import { formatUsd } from '@/lib/billing/format'

const TEAL = '#0D9488'
const PIE_COLORS = ['#0D9488', '#14B8A6', '#2DD4BF', '#5EEAD4', '#99F6E4', '#CCFBF1']

export function PayoutTrendChart({
  data,
}: {
  data: { label: string; payout: number }[]
}) {
  if (data.length === 0) {
    return <p className="text-sm text-gray-500 py-8 text-center">No finalized cycles yet</p>
  }

  return (
    <ResponsiveContainer width="100%" height={220}>
      <BarChart data={data} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
        <XAxis dataKey="label" tick={{ fontSize: 11 }} interval={0} angle={-20} textAnchor="end" height={50} />
        <YAxis tick={{ fontSize: 11 }} tickFormatter={(v) => `$${(v / 1000).toFixed(0)}k`} />
        <Tooltip formatter={(v) => [formatUsd(Number(v ?? 0)), 'Payout']} />
        <Bar dataKey="payout" fill={TEAL} radius={[4, 4, 0, 0]} />
      </BarChart>
    </ResponsiveContainer>
  )
}

export function HoursDistributionChart({
  data,
}: {
  data: { name: string; hours: number }[]
}) {
  if (data.length === 0) {
    return <p className="text-sm text-gray-500 py-8 text-center">No hours data</p>
  }

  return (
    <ResponsiveContainer width="100%" height={220}>
      <PieChart>
        <Pie
          data={data}
          dataKey="hours"
          nameKey="name"
          cx="50%"
          cy="50%"
          innerRadius={50}
          outerRadius={80}
          paddingAngle={2}
        >
          {data.map((_, i) => (
            <Cell key={i} fill={PIE_COLORS[i % PIE_COLORS.length]} />
          ))}
        </Pie>
        <Tooltip formatter={(v) => [`${Number(v ?? 0).toFixed(1)} hrs`, 'Hours']} />
      </PieChart>
    </ResponsiveContainer>
  )
}
