import {
  CLIENT_STAGE_ORDER,
  OWNER_DEPT_LABELS,
  STAGE_DEFAULT_OWNER_DEPT,
  STAGE_LABELS,
  type CanAdvanceResult,
} from '@/lib/crm/stages'
import type { ClientOwnerDept, ClientStage } from '@prisma/client'
import { cn } from '@/lib/utils'

const DEPT_CHIP: Record<ClientOwnerDept, string> = {
  INTAKE: 'bg-[var(--blue-bg)] text-[var(--blue)]',
  CASE_COORDINATION: 'bg-[var(--amber-bg)] text-[var(--amber)]',
  CLINICAL: 'bg-[var(--green-bg)] text-[var(--green)]',
  AUTHORIZATION: 'bg-[var(--slate-bg)] text-[var(--slate)]',
  STAFFING: 'bg-[var(--urgent-bg)] text-brand',
}

export function StageStepper({
  stage,
  gate,
  blockedLabels,
  onAdvance,
  advancing,
  canEdit,
  fullAccess,
  onSetStage,
}: {
  stage: ClientStage
  gate: CanAdvanceResult
  blockedLabels: string[]
  onAdvance: () => void
  advancing: boolean
  canEdit: boolean
  fullAccess: boolean
  onSetStage: (to: ClientStage) => void
}) {
  const currentIdx = CLIENT_STAGE_ORDER.indexOf(stage)

  return (
    <section className="rounded-xl border border-line bg-surface p-4 md:p-5">
      <div className="mb-4 flex flex-wrap items-end justify-between gap-3">
        <div>
          <h2 className="font-display text-lg font-semibold text-ink">Progress</h2>
          <p className="mt-0.5 text-sm text-quiet">
            {STAGE_LABELS[stage]}
            <span className="text-faint"> · </span>
            owned by {OWNER_DEPT_LABELS[STAGE_DEFAULT_OWNER_DEPT[stage]]}
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {fullAccess && (
            <label className="flex items-center gap-2 text-xs text-quiet">
              Jump to
              <select
                className="h-9 rounded-lg border border-line bg-surface px-2 text-sm text-ink focus:outline-none focus:ring-4 focus:ring-[var(--brand-ring)]"
                value={stage}
                onChange={(e) => onSetStage(e.target.value as ClientStage)}
              >
                {CLIENT_STAGE_ORDER.map((s) => (
                  <option key={s} value={s}>
                    {STAGE_LABELS[s]}
                  </option>
                ))}
              </select>
            </label>
          )}
          {canEdit && currentIdx < CLIENT_STAGE_ORDER.length - 1 && (
            <button
              type="button"
              disabled={advancing || !gate.ok}
              onClick={onAdvance}
              className={cn(
                'inline-flex h-9 items-center rounded-lg px-3.5 text-sm font-medium text-white',
                gate.ok
                  ? 'bg-brand hover:bg-brand-2'
                  : 'cursor-not-allowed bg-faint'
              )}
            >
              {advancing ? 'Advancing…' : 'Advance stage'}
            </button>
          )}
        </div>
      </div>

      <ol className="flex gap-1 overflow-x-auto pb-1">
        {CLIENT_STAGE_ORDER.map((s, i) => {
          const done = i < currentIdx
          const current = i === currentIdx
          const dept = STAGE_DEFAULT_OWNER_DEPT[s]
          return (
            <li
              key={s}
              className={cn(
                'min-w-[4.5rem] flex-1 rounded-lg border px-1.5 py-2 text-center',
                current &&
                  'border-brand bg-[color-mix(in_srgb,var(--brand)_8%,white)] ring-4 ring-[var(--brand-ring)]',
                done && 'border-line bg-line-2',
                !done && !current && 'border-line bg-surface opacity-60'
              )}
              title={`${STAGE_LABELS[s]} · ${OWNER_DEPT_LABELS[dept]}`}
            >
              <div
                className={cn(
                  'mx-auto mb-1 flex h-5 w-5 items-center justify-center rounded-full text-[10px] font-semibold tabular-nums',
                  current && 'bg-brand text-white',
                  done && 'bg-[var(--green)] text-white',
                  !done && !current && 'bg-line text-quiet'
                )}
              >
                {done ? '✓' : i + 1}
              </div>
              <div
                className={cn(
                  'truncate text-[10px] font-medium leading-tight',
                  current ? 'text-ink' : 'text-quiet'
                )}
              >
                {STAGE_LABELS[s]}
              </div>
            </li>
          )
        })}
      </ol>

      {!gate.ok && (
        <div className="mt-4 rounded-lg border border-[color-mix(in_srgb,var(--amber)_35%,var(--line))] bg-[var(--amber-bg)] px-3 py-2.5 text-sm text-[var(--amber)]">
          <p className="font-medium">Advance blocked — finish these first:</p>
          <ul className="mt-1 list-inside list-disc text-[var(--ink)]">
            {blockedLabels.map((label) => (
              <li key={label}>{label}</li>
            ))}
          </ul>
        </div>
      )}
    </section>
  )
}

export function OwnerDeptBadge({ dept }: { dept: ClientOwnerDept | null | undefined }) {
  if (!dept) return <span className="text-sm text-faint">Unassigned</span>
  return (
    <span
      className={cn(
        'inline-flex items-center rounded-md px-2 py-0.5 text-xs font-medium',
        DEPT_CHIP[dept]
      )}
    >
      {OWNER_DEPT_LABELS[dept]}
    </span>
  )
}
