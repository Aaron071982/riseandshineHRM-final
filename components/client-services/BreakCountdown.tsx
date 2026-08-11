'use client'

import { cn } from '@/lib/utils'

export type BreakTimerProps = {
  label: string
  expectedReturnDate?: string
  overdue?: boolean
  daysUntilReturn?: number
  daysOverdue?: number
  className?: string
  /** When true, hide return countdown / expected date (UI-only). */
  hideReturn?: boolean
}

/** Active break badge. Optionally shows overdue/return countdown. */
export default function BreakCountdown({
  label,
  overdue = false,
  className,
  hideReturn = false,
}: BreakTimerProps) {
  return (
    <div
      className={cn(
        'text-xs font-medium rounded-lg px-2.5 py-1.5 inline-flex flex-col gap-0.5 border',
        overdue
          ? 'bg-[#FCEBEB] text-[#A32D2D] border-[#F5C4C4]'
          : 'bg-[#EEEDFE] text-[#3C3489] border-[#D8D6F5]',
        className
      )}
    >
      <span>{label}</span>
      {!hideReturn && overdue && <span>Return overdue</span>}
    </div>
  )
}
