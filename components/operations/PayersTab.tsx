'use client'

import { Bar, BarChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import type { Metrics } from '@/lib/artemis/metrics'
import { usd2, pct, nfmt } from './formatters'

const TEAL = '#0D9488'

export default function PayersTab({ metrics }: { metrics: Metrics }) {
  const { byPayer } = metrics
  const top = byPayer.slice(0, 12)
  const chartData = top.map((p) => ({ payer: p.payer.slice(0, 20), collected: p.collected }))

  return (
    <div className="space-y-6">
      <div className="rounded-lg border border-gray-200 dark:border-gray-700 p-4 bg-white dark:bg-gray-900 overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="text-left text-xs text-gray-500 border-b dark:border-gray-700">
              <th className="pb-2 pr-4">Payer</th>
              <th className="pb-2 pr-4">Type</th>
              <th className="pb-2 pr-4 text-right">Sessions</th>
              <th className="pb-2 pr-4 text-right">Hours</th>
              <th className="pb-2 pr-4 text-right">Claimed</th>
              <th className="pb-2 pr-4 text-right">Collected</th>
              <th className="pb-2 pr-4 text-right">Denial rate</th>
            </tr>
          </thead>
          <tbody>
            {byPayer.map((p) => (
              <tr key={p.payer} className="border-b dark:border-gray-800 last:border-0">
                <td className="py-2 pr-4 font-medium">{p.payer}</td>
                <td className="py-2 pr-4 text-gray-500">{p.payerType}</td>
                <td className="py-2 pr-4 text-right tabular-nums">{nfmt(p.sessions)}</td>
                <td className="py-2 pr-4 text-right tabular-nums">{p.hours.toFixed(1)}</td>
                <td className="py-2 pr-4 text-right tabular-nums">{usd2(p.claimed)}</td>
                <td className="py-2 pr-4 text-right tabular-nums text-[#0D9488]">
                  {usd2(p.collected)}
                </td>
                <td className="py-2 pr-4 text-right tabular-nums">
                  {p.denialRate > 0 ? pct(p.denialRate) : '—'}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {byPayer.length === 0 && (
          <p className="text-sm text-gray-500 py-8 text-center">No payer data</p>
        )}
      </div>

      {chartData.length > 0 && (
        <div className="rounded-lg border border-gray-200 dark:border-gray-700 p-4 bg-white dark:bg-gray-900">
          <h3 className="text-sm font-semibold mb-3">Top payers by collected</h3>
          <ResponsiveContainer width="100%" height={Math.max(200, chartData.length * 28)}>
            <BarChart data={chartData} layout="vertical" margin={{ top: 4, right: 16, left: 8, bottom: 4 }}>
              <XAxis type="number" tick={{ fontSize: 11 }} tickFormatter={(v) => `$${(v / 1000).toFixed(0)}k`} />
              <YAxis type="category" dataKey="payer" width={120} tick={{ fontSize: 10 }} />
              <Tooltip formatter={(v) => usd2(Number(v ?? 0))} />
              <Bar dataKey="collected" fill={TEAL} radius={[0, 4, 4, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      )}
    </div>
  )
}
