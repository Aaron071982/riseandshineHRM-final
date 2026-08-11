'use client'

import { STATUS, type CaseStatus } from '@/lib/clients/status'
import { cn } from '@/lib/utils'

export default function StatusBadge({ status }: { status: CaseStatus }) {
  const meta = STATUS[status]
  return (
    <span
      className={cn(
        'inline-flex items-center gap-1.5 rounded-full px-2 py-0.5 text-xs font-medium'
      )}
      style={{ background: meta.bg, color: meta.fg }}
    >
      <span
        className="h-1.5 w-1.5 shrink-0 rounded-full"
        style={{ background: meta.dot }}
        aria-hidden
      />
      {meta.label}
    </span>
  )
}
