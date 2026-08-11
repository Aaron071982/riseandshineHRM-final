'use client'

import { TrendingDown, TrendingUp, Minus } from 'lucide-react'
import { cn } from '@/lib/utils'

export type SummaryRange = '7' | '30' | '90' | 'all'

export type SummaryMetric = {
  key: string
  label: string
  value: number
  trend: { direction: 'up' | 'down' | 'neutral'; percentChange: number }
  accent?: string | null
}

const RANGE_OPTIONS: { value: SummaryRange; label: string }[] = [
  { value: '7', label: 'Last 7 days' },
  { value: '30', label: '30 days' },
  { value: '90', label: '90 days' },
  { value: 'all', label: 'All time' },
]

function Trend({ trend }: { trend: SummaryMetric['trend'] }) {
  if (trend.direction === 'neutral') {
    return (
      <span className="inline-flex items-center gap-0.5 text-xs text-faint">
        <Minus className="h-3 w-3" /> 0%
      </span>
    )
  }
  if (trend.direction === 'up') {
    return (
      <span className="inline-flex items-center gap-0.5 text-xs text-[color:var(--green)]">
        <TrendingUp className="h-3 w-3" /> +{trend.percentChange}%
      </span>
    )
  }
  return (
    <span className="inline-flex items-center gap-0.5 text-xs text-urgent">
      <TrendingDown className="h-3 w-3" /> -{trend.percentChange}%
    </span>
  )
}

export default function CaseloadSummaryBoard({
  range,
  onRangeChange,
  metrics,
}: {
  range: SummaryRange
  onRangeChange: (r: SummaryRange) => void
  metrics: SummaryMetric[]
}) {
  return (
    <div className="space-y-3">
      <div className="flex flex-wrap gap-2">
        {RANGE_OPTIONS.map((opt) => (
          <button
            key={opt.value}
            type="button"
            onClick={() => onRangeChange(opt.value)}
            className={cn(
              'rounded-lg border px-3 py-1.5 text-sm font-medium transition-colors',
              range === opt.value
                ? 'border-brand bg-brand text-white'
                : 'border-line bg-surface text-ink hover:bg-line-2'
            )}
          >
            {opt.label}
          </button>
        ))}
      </div>

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 xl:grid-cols-6">
        {metrics.map((m) => (
          <div
            key={m.key}
            className="rounded-xl border border-line bg-surface px-3.5 py-3 shadow-sm"
          >
            <p className="text-xs font-medium text-quiet">{m.label}</p>
            <p
              className={cn(
                'font-display mt-1 text-2xl font-bold tabular-nums text-ink',
                m.accent === 'green' && 'text-[color:var(--green)]',
                m.accent === 'urgent' && 'text-urgent',
                m.accent === 'brand' && 'text-brand'
              )}
            >
              {m.value}
            </p>
            <div className="mt-1">
              <Trend trend={m.trend} />
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
