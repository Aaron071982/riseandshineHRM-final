'use client'

import { useTransition } from 'react'
import { useRouter } from 'next/navigation'
import type { ClientRequirement, ClientStage, RequirementStatus } from '@prisma/client'
import { updateRequirement } from '@/lib/crm/actions'
import { CLIENT_STAGE_ORDER, STAGE_LABELS } from '@/lib/crm/stages'
import { cn } from '@/lib/utils'

const STATUSES: RequirementStatus[] = [
  'PENDING',
  'RECEIVED',
  'MISSING',
  'EXPIRED',
  'NOT_APPLICABLE',
  'COMPLETE',
]

const STATUS_CHIP: Record<RequirementStatus, string> = {
  PENDING: 'bg-[var(--slate-bg)] text-[var(--slate)]',
  RECEIVED: 'bg-[var(--green-bg)] text-[var(--green)]',
  MISSING: 'bg-[var(--urgent-bg)] text-[var(--urgent)]',
  EXPIRED: 'bg-[var(--amber-bg)] text-[var(--amber)]',
  NOT_APPLICABLE: 'bg-line-2 text-quiet',
  COMPLETE: 'bg-[var(--green-bg)] text-[var(--green)]',
}

export function RequirementsPanel({
  requirements,
  currentStage,
  canEdit,
}: {
  requirements: ClientRequirement[]
  currentStage: ClientStage
  canEdit: boolean
}) {
  const router = useRouter()
  const [pending, startTransition] = useTransition()

  const byStage = CLIENT_STAGE_ORDER.map((stage) => ({
    stage,
    items: requirements.filter((r) => r.stage === stage),
  })).filter((g) => g.items.length > 0)

  if (byStage.length === 0) {
    return (
      <Empty
        title="No requirements yet"
        body="Gate checklist items appear as this client moves through stages."
      />
    )
  }

  return (
    <div className="space-y-6">
      {byStage.map(({ stage, items }) => (
        <section key={stage}>
          <h3
            className={cn(
              'mb-2 font-display text-base font-semibold',
              stage === currentStage ? 'text-brand' : 'text-ink'
            )}
          >
            {STAGE_LABELS[stage]}
            {stage === currentStage && (
              <span className="ml-2 text-xs font-medium text-quiet">current</span>
            )}
          </h3>
          <ul className="divide-y divide-line rounded-xl border border-line bg-surface">
            {items.map((req) => (
              <li
                key={req.id}
                className={cn(
                  'flex flex-wrap items-center gap-3 px-3 py-2.5',
                  req.isRequiredToAdvance &&
                    stage === currentStage &&
                    'bg-[color-mix(in_srgb,var(--brand)_4%,white)]'
                )}
              >
                <div className="min-w-0 flex-1">
                  <div className="text-sm font-medium text-ink">{req.label}</div>
                  <div className="text-xs text-quiet">
                    {req.type}
                    {req.isRequiredToAdvance && stage === currentStage && (
                      <span className="ml-2 text-brand">Required to advance</span>
                    )}
                  </div>
                </div>
                <span
                  className={cn(
                    'rounded-md px-2 py-0.5 text-[11px] font-medium',
                    STATUS_CHIP[req.status]
                  )}
                >
                  {req.status.replace(/_/g, ' ')}
                </span>
                {canEdit && (
                  <select
                    disabled={pending}
                    value={req.status}
                    onChange={(e) => {
                      const status = e.target.value as RequirementStatus
                      startTransition(async () => {
                        await updateRequirement(req.id, { status })
                        router.refresh()
                      })
                    }}
                    className="h-8 rounded-lg border border-line bg-surface px-2 text-xs text-ink focus:outline-none focus:ring-4 focus:ring-[var(--brand-ring)]"
                  >
                    {STATUSES.map((s) => (
                      <option key={s} value={s}>
                        {s.replace(/_/g, ' ')}
                      </option>
                    ))}
                  </select>
                )}
              </li>
            ))}
          </ul>
        </section>
      ))}
    </div>
  )
}

function Empty({ title, body }: { title: string; body: string }) {
  return (
    <div className="rounded-xl border border-dashed border-line bg-surface px-4 py-10 text-center">
      <p className="font-display text-base font-semibold text-ink">{title}</p>
      <p className="mt-1 text-sm text-quiet">{body}</p>
    </div>
  )
}
