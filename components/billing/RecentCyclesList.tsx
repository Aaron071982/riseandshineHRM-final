'use client'

import Link from 'next/link'
import { format } from 'date-fns'
import { CycleStatusBadge } from '@/components/billing/MatchStatusBadge'
import { formatUsd } from '@/lib/billing/format'
import DeleteCycleButton from '@/components/billing/DeleteCycleButton'
import type { BillingCycleStatus } from '@prisma/client'

type CycleRow = {
  id: string
  label: string
  status: BillingCycleStatus
  periodStart: string
  periodEnd: string
  totalHours: number
  totalGrossPay: number
  rbtCount: number
}

export default function RecentCyclesList({ cycles }: { cycles: CycleRow[] }) {
  if (cycles.length === 0) {
    return (
      <p className="text-gray-500 text-sm p-6">No payroll cycles yet. Start your first cycle above.</p>
    )
  }

  return (
    <div className="divide-y dark:divide-[var(--border-subtle)]">
      {cycles.map((c) => (
        <div
          key={c.id}
          className="flex flex-wrap items-center justify-between gap-3 px-6 py-4 hover:bg-gray-50 dark:hover:bg-[var(--bg-elevated)] transition-colors"
        >
          <Link href={`/billing/cycles/${c.id}`} className="min-w-0 flex-1">
            <p className="font-semibold truncate">{c.label}</p>
            <p className="text-xs text-gray-500">
              {format(new Date(c.periodStart), 'M/d')} – {format(new Date(c.periodEnd), 'M/d/yy')}
            </p>
          </Link>
          <CycleStatusBadge status={c.status} />
          <p className="text-sm text-gray-600 tabular-nums">{c.totalHours.toFixed(1)} hrs</p>
          <p className="text-sm font-semibold tabular-nums text-right min-w-[90px]">
            {formatUsd(c.totalGrossPay)}
          </p>
          <div className="flex items-center gap-2">
            <Link href={`/billing/cycles/${c.id}`} className="text-[#0D9488] text-sm font-medium">
              Open →
            </Link>
            <DeleteCycleButton
              cycleId={c.id}
              cycleLabel={c.label}
              status={c.status}
              redirectTo={undefined}
              variant="ghost"
              size="sm"
              className="text-red-600 hover:text-red-700 hover:bg-red-50"
            />
          </div>
        </div>
      ))}
    </div>
  )
}
