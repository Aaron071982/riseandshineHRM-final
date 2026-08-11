'use client'

import { STATUS, type CaseStatus } from '@/lib/clients/status'
import { cn } from '@/lib/utils'

export default function ClientAvatar({
  name,
  status,
  size = 32,
}: {
  name: string
  status: CaseStatus
  size?: number
}) {
  const meta = STATUS[status]
  const initials =
    name
      .split(/\s+/)
      .filter(Boolean)
      .slice(0, 2)
      .map((p) => p[0]?.toUpperCase() ?? '')
      .join('') || '?'

  return (
    <div
      className={cn(
        'flex shrink-0 items-center justify-center rounded-full text-[11px] font-semibold'
      )}
      style={{
        width: size,
        height: size,
        background: meta.bg,
        color: meta.fg,
        boxShadow: `0 0 0 2px var(--surface), 0 0 0 3.5px ${meta.ring}`,
      }}
      aria-hidden
    >
      {initials}
    </div>
  )
}
