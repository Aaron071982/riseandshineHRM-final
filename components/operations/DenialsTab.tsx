'use client'

import { Bar, BarChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import type { Metrics } from '@/lib/artemis/metrics'
import { usd2, nfmt } from './formatters'

const RED = '#DC2626'

export default function DenialsTab({ metrics }: { metrics: Metrics }) {
  const { denialByReason, aging, leakage } = metrics

  return (
    <div className="space-y-6">
      <div className="grid sm:grid-cols-2 gap-4">
        <div className="rounded-lg border border-red-200 dark:border-red-900 bg-red-50 dark:bg-red-950/20 p-4">
          <p className="text-xs text-red-700 uppercase font-medium">Total denied value</p>
          <p className="text-2xl font-bold tabular-nums text-red-600">{usd2(leakage.denied.value)}</p>
          <p className="text-xs text-red-600/80">{nfmt(leakage.denied.rows.length)} claim rows</p>
        </div>
        <div className="rounded-lg border border-gray-200 dark:border-gray-700 p-4 bg-white dark:bg-gray-900">
          <p className="text-xs text-gray-500 uppercase font-medium">Denial rate (of adjudicated)</p>
          <p className="text-2xl font-bold tabular-nums">{(metrics.denialRate * 100).toFixed(1)}%</p>
        </div>
      </div>

      <div className="rounded-lg border border-gray-200 dark:border-gray-700 p-4 bg-white dark:bg-gray-900 overflow-x-auto">
        <h3 className="text-sm font-semibold mb-3">Denials by payer</h3>
        <table className="w-full text-sm">
          <thead>
            <tr className="text-left text-xs text-gray-500 border-b dark:border-gray-700">
              <th className="pb-2 pr-4">Payer / reason</th>
              <th className="pb-2 pr-4 text-right">Count</th>
              <th className="pb-2 text-right">Value</th>
            </tr>
          </thead>
          <tbody>
            {denialByReason.map((r) => (
              <tr key={r.reason} className="border-b dark:border-gray-800 last:border-0">
                <td className="py-2 pr-4">{r.reason}</td>
                <td className="py-2 pr-4 text-right tabular-nums">{nfmt(r.count)}</td>
                <td className="py-2 text-right tabular-nums text-red-600">{usd2(r.value)}</td>
              </tr>
            ))}
          </tbody>
        </table>
        {denialByReason.length === 0 && (
          <p className="text-sm text-gray-500 py-8 text-center">No denials in this export</p>
        )}
      </div>

      <div className="rounded-lg border border-gray-200 dark:border-gray-700 p-4 bg-white dark:bg-gray-900">
        <h3 className="text-sm font-semibold mb-3">Denial aging (days since DOS)</h3>
        <ResponsiveContainer width="100%" height={220}>
          <BarChart data={aging} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
            <XAxis dataKey="label" tick={{ fontSize: 11 }} />
            <YAxis tick={{ fontSize: 11 }} tickFormatter={(v) => `$${(v / 1000).toFixed(0)}k`} />
            <Tooltip formatter={(v) => usd2(Number(v ?? 0))} />
            <Bar dataKey="value" fill={RED} radius={[4, 4, 0, 0]} />
          </BarChart>
        </ResponsiveContainer>
      </div>
    </div>
  )
}
