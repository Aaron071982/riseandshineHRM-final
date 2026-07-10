'use client'

import type { Metrics } from '@/lib/artemis/metrics'
import { usd2, pct, nfmt } from './formatters'

export default function KpiStrip({ metrics }: { metrics: Metrics }) {
  const cards = [
    {
      label: 'Collection rate',
      value: pct(metrics.collectionRate),
      sub: `${usd2(metrics.collected)} collected of ${usd2(metrics.claimedAllowed)} claimed`,
      tone: 'teal' as const,
    },
    {
      label: 'Billable hours',
      value: nfmt(Math.round(metrics.billableHours)),
      sub: `${nfmt(metrics.deliveredUnits)} units delivered`,
      tone: 'teal' as const,
    },
    {
      label: 'At-risk revenue',
      value: usd2(metrics.atRisk),
      sub: `${usd2(metrics.recoverable)} potentially recoverable`,
      tone: 'amber' as const,
    },
    {
      label: 'Denial rate',
      value: pct(metrics.denialRate),
      sub: `${metrics.leakage.denied.rows.length} denied claims`,
      tone: 'red' as const,
    },
  ]

  const toneClass = {
    teal: 'text-[#0D9488]',
    amber: 'text-amber-600',
    red: 'text-red-600',
  }

  return (
    <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
      {cards.map((c) => (
        <div
          key={c.label}
          className="bg-white dark:bg-gray-900 rounded-lg border border-gray-200 dark:border-gray-700 p-4"
        >
          <p className="text-xs font-medium text-gray-500 uppercase tracking-wide">{c.label}</p>
          <p className={`text-2xl font-bold tabular-nums mt-1 ${toneClass[c.tone]}`}>{c.value}</p>
          <p className="text-xs text-gray-500 mt-1">{c.sub}</p>
        </div>
      ))}
    </div>
  )
}
