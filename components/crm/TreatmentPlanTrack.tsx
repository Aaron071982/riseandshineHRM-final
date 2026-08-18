'use client'

import { useTransition } from 'react'
import { useRouter } from 'next/navigation'
import type { MilestoneStatus } from '@prisma/client'
import { updateTreatmentPlanStatus } from '@/lib/crm/actions'
import { STAGE_DESCRIPTIONS } from '@/lib/crm/stages'
import { cn } from '@/lib/utils'

const STATUSES: { value: MilestoneStatus; label: string }[] = [
  { value: 'NOT_STARTED', label: 'Not started' },
  { value: 'IN_PROGRESS', label: 'In progress' },
  { value: 'COMPLETE', label: 'Complete' },
]

export function TreatmentPlanTrack({
  clientId,
  status,
  completedAt,
  canEdit,
}: {
  clientId: string
  status: MilestoneStatus
  completedAt: string | Date | null
  canEdit: boolean
}) {
  const router = useRouter()
  const [pending, startTransition] = useTransition()

  const onChange = (next: MilestoneStatus) => {
    startTransition(async () => {
      await updateTreatmentPlanStatus(clientId, next)
      router.refresh()
    })
  }

  return (
    <aside
      className={cn(
        'rounded-xl border px-4 py-3',
        status === 'COMPLETE'
          ? 'border-[color-mix(in_srgb,var(--green)_40%,var(--line))] bg-[var(--green-bg)]'
          : 'border-[color-mix(in_srgb,var(--brand)_30%,var(--line))] bg-[color-mix(in_srgb,var(--brand)_6%,white)]'
      )}
    >
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-[11px] font-semibold uppercase tracking-wide text-faint">
              Parallel track
            </span>
            <span
              className={cn(
                'rounded-md px-2 py-0.5 text-xs font-semibold',
                status === 'COMPLETE'
                  ? 'bg-[var(--green)] text-white'
                  : status === 'IN_PROGRESS'
                    ? 'bg-brand text-white'
                    : 'bg-line text-quiet'
              )}
            >
              Treatment plan · {STATUSES.find((s) => s.value === status)?.label}
            </span>
          </div>
          <p className="mt-1.5 text-sm text-quiet">
            {STAGE_DESCRIPTIONS.TREATMENT_PLAN}
          </p>
          {completedAt && (
            <p className="mt-1 text-xs tabular-nums text-quiet">
              Completed {new Date(completedAt).toLocaleDateString()}
            </p>
          )}
        </div>
        {canEdit && (
          <select
            disabled={pending}
            value={status}
            onChange={(e) => onChange(e.target.value as MilestoneStatus)}
            className="h-9 rounded-lg border border-line bg-surface px-2 text-sm text-ink focus:outline-none focus:ring-4 focus:ring-[var(--brand-ring)]"
          >
            {STATUSES.map((s) => (
              <option key={s.value} value={s.value}>
                {s.label}
              </option>
            ))}
          </select>
        )}
      </div>
    </aside>
  )
}
