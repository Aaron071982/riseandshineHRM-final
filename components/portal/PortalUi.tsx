'use client'

import { cn } from '@/lib/utils'

const ASSESSMENT_PILL: Record<string, string> = {
  DRAFT: 'bg-[#EFE8DC] text-[#8A7A66]',
  IN_PROGRESS: 'bg-[#F9EDD4] text-[#B0761B]',
  COMPLETED: 'bg-[#EEE7F5] text-[#6D4FA0]',
  SIGNED: 'bg-[#E1F0E8] text-[#2E7D5B]',
}

export function assessmentStatusLabel(status: string | null | undefined) {
  if (!status) return 'Not started'
  return status
    .replaceAll('_', ' ')
    .toLowerCase()
    .replace(/^\w/, (c) => c.toUpperCase())
}

export function PortalAssessmentPill({
  status,
  className,
}: {
  status: string | null | undefined
  className?: string
}) {
  return (
    <span
      className={cn(
        'inline-flex rounded-md px-2 py-0.5 text-xs font-medium capitalize',
        ASSESSMENT_PILL[status ?? ''] ?? 'bg-[#EFE8DC] text-[#8A7A66]',
        className
      )}
    >
      {assessmentStatusLabel(status)}
    </span>
  )
}

export function PortalAvatar({
  name,
  className,
}: {
  name: string
  className?: string
}) {
  const initials = name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((p) => p[0]?.toUpperCase() ?? '')
    .join('')
  return (
    <span
      className={cn(
        'inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-[color-mix(in_srgb,var(--portal-orange)_18%,white)] font-display text-xs font-semibold text-[var(--espresso)]',
        className
      )}
      aria-hidden
    >
      {initials || '?'}
    </span>
  )
}

export function PortalStatTile({
  label,
  value,
  className,
}: {
  label: string
  value: number | string
  className?: string
}) {
  return (
    <div
      className={cn(
        'rounded-[14px] border border-[var(--portal-line)] bg-white px-4 py-3 shadow-[var(--portal-shadow)] transition-transform duration-200 hover:-translate-y-0.5 motion-reduce:transform-none',
        className
      )}
    >
      <p className="text-[11px] font-medium uppercase tracking-[0.12em] text-[var(--muted-ink)]">
        {label}
      </p>
      <p className="mt-1 font-display text-2xl font-semibold tabular-nums text-[var(--espresso)]">
        {value}
      </p>
    </div>
  )
}
