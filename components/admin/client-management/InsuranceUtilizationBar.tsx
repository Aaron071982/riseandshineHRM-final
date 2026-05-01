'use client'

import { useEffect, useState } from 'react'
import { cn } from '@/lib/utils'

export default function InsuranceUtilizationBar({
  used,
  budget,
  className,
}: {
  used: number
  budget: number | null
  className?: string
}) {
  const [pctDisplay, setPctDisplay] = useState(0)
  const pct =
    budget != null && budget > 0 ? Math.min(100, Math.round((100 * used) / budget)) : 0
  const tone =
    pct >= 90 ? 'bg-red-500' : pct >= 70 ? 'bg-amber-500' : 'bg-emerald-500'

  useEffect(() => {
    const id = requestAnimationFrame(() => setPctDisplay(pct))
    return () => cancelAnimationFrame(id)
  }, [pct])

  useEffect(() => {
    setPctDisplay(0)
    const t = setTimeout(() => setPctDisplay(pct), 50)
    return () => clearTimeout(t)
  }, [pct])

  const remaining = budget != null ? Math.max(0, budget - used) : null
  const tip =
    budget != null
      ? `${used.toFixed(1)} hrs used of ${budget.toFixed(1)} authorized (${remaining?.toFixed(1)} remaining)`
      : `Used ${used.toFixed(1)} hrs`

  return (
    <div
      className={cn('space-y-1', className)}
      title={tip}
    >
      <div className="flex justify-between text-xs text-gray-600 dark:text-gray-400">
        <span>Utilization</span>
        <span>{pct}%</span>
      </div>
      <div className="h-3 w-full rounded-full bg-gray-200 dark:bg-gray-700 overflow-hidden">
        <div
          className={cn('h-full rounded-full transition-[width] duration-500 ease-out', tone)}
          style={{ width: `${pctDisplay}%` }}
        />
      </div>
      <p className="text-xs text-gray-500">{tip}</p>
    </div>
  )
}
