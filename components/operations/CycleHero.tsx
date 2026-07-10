'use client'

import type { Metrics } from '@/lib/artemis/metrics'
import { usd2, nfmt } from './formatters'

const TEAL = '#0D9488'
const AMBER = '#D97706'
const RED = '#DC2626'

export default function CycleHero({ metrics }: { metrics: Metrics }) {
  const { stages, upcoming } = metrics

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
        {stages.map((stage, i) => {
          const prev = i > 0 ? stages[i - 1].value : null
          const drop = prev != null && prev > 0 ? prev - stage.value : 0
          return (
            <div
              key={stage.key}
              className="bg-white dark:bg-gray-900 rounded-lg border border-gray-200 dark:border-gray-700 p-4"
            >
              <p className="text-xs font-medium text-gray-500 uppercase tracking-wide">
                {stage.label}
              </p>
              <p className="text-xl font-bold tabular-nums text-[#0D9488] mt-1">
                {usd2(stage.value)}
              </p>
              <p className="text-xs text-gray-500 mt-1">{nfmt(stage.units)} units</p>
              <p className="text-xs text-gray-400">{stage.sub}</p>
              {drop > 0 && (
                <p className="text-xs text-amber-600 mt-2 tabular-nums">−{usd2(drop)} drop</p>
              )}
            </div>
          )
        })}
      </div>

      {upcoming.count > 0 && (
        <div className="bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800 rounded-lg px-4 py-3 flex flex-wrap items-center justify-between gap-2">
          <div>
            <p className="text-sm font-medium text-amber-900 dark:text-amber-100">
              Upcoming pipeline
            </p>
            <p className="text-xs text-amber-700 dark:text-amber-300">
              Future-dated sessions not yet in the revenue cycle
            </p>
          </div>
          <p className="text-lg font-bold tabular-nums text-amber-800 dark:text-amber-200">
            {nfmt(upcoming.count)} sessions · {usd2(upcoming.value)}
          </p>
        </div>
      )}

      <div className="hidden lg:flex items-center justify-between px-2 text-xs text-gray-400">
        <span style={{ color: TEAL }}>Scheduled</span>
        <span>→</span>
        <span style={{ color: TEAL }}>Delivered</span>
        <span>→</span>
        <span style={{ color: TEAL }}>Documented</span>
        <span>→</span>
        <span style={{ color: AMBER }}>Claimed</span>
        <span>→</span>
        <span style={{ color: TEAL }}>Collected</span>
        {metrics.leakage.denied.value > 0 && (
          <span style={{ color: RED }} className="ml-4">
            Denied: {usd2(metrics.leakage.denied.value)}
          </span>
        )}
      </div>
    </div>
  )
}
