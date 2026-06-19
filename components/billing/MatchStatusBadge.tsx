import { cn } from '@/lib/utils'
import type { BillingMatchStatus, BillingCycleStatus } from '@prisma/client'

const matchStyles: Record<BillingMatchStatus, string> = {
  MATCHED: 'bg-green-100 text-green-800 dark:bg-green-900/40 dark:text-green-300',
  PAYROLL_ONLY: 'bg-blue-100 text-blue-800 dark:bg-blue-900/40 dark:text-blue-300',
  NEEDS_REVIEW: 'bg-amber-100 text-amber-900 dark:bg-amber-900/40 dark:text-amber-200',
  UNMATCHED: 'bg-red-100 text-red-800 dark:bg-red-900/40 dark:text-red-300',
  IGNORED: 'bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-400',
}

const matchLabels: Record<BillingMatchStatus, string> = {
  MATCHED: 'Matched',
  PAYROLL_ONLY: 'Payroll Only',
  NEEDS_REVIEW: 'Needs Review',
  UNMATCHED: 'Unmatched',
  IGNORED: 'Excluded',
}

export function MatchStatusBadge({
  status,
  className,
}: {
  status: BillingMatchStatus
  className?: string
}) {
  return (
    <span
      className={cn(
        'inline-flex items-center px-2 py-0.5 rounded-full text-xs font-semibold whitespace-nowrap',
        matchStyles[status],
        className
      )}
    >
      {matchLabels[status]}
    </span>
  )
}

const cycleStyles: Record<BillingCycleStatus, string> = {
  DRAFT: 'bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-300',
  REVIEW: 'bg-amber-100 text-amber-900 dark:bg-amber-900/40 dark:text-amber-200',
  FINALIZED: 'bg-green-100 text-green-800 dark:bg-green-900/40 dark:text-green-300',
  PAID: 'bg-teal-100 text-teal-800 dark:bg-teal-900/40 dark:text-teal-300',
}

export function CycleStatusBadge({ status }: { status: BillingCycleStatus }) {
  return (
    <span
      className={cn(
        'inline-flex items-center px-2 py-0.5 rounded-full text-xs font-semibold',
        cycleStyles[status]
      )}
    >
      {status}
    </span>
  )
}
