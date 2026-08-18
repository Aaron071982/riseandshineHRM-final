'use client'

import { useEffect, useState, useTransition } from 'react'
import type { ClientOwnerDept, ClientStage } from '@prisma/client'
import { OwnerDeptBadge } from '@/components/crm/StageStepper'
import { STAGE_LABELS, canSetRbtTargetDate } from '@/lib/crm/stages'
import { updateClientNextAction, updateRbtTargetDate } from '@/lib/crm/actions'
import { cn } from '@/lib/utils'

export function ClientFiveFieldHeader({
  clientId,
  stage,
  ownerDept,
  ownerName,
  nextAction,
  nextActionDueAt,
  daysInStage,
  rbtTargetDate,
  canEdit,
}: {
  clientId: string
  stage: ClientStage
  ownerDept: ClientOwnerDept | null
  ownerName: string | null
  nextAction: string | null
  nextActionDueAt: string | null
  daysInStage: number | null
  rbtTargetDate: string | null
  canEdit: boolean
}) {
  const [action, setAction] = useState(nextAction ?? '')
  const [due, setDue] = useState(
    nextActionDueAt ? nextActionDueAt.slice(0, 10) : ''
  )
  const [target, setTarget] = useState(
    rbtTargetDate ? rbtTargetDate.slice(0, 10) : ''
  )
  const [pending, startTransition] = useTransition()
  const [savedFlash, setSavedFlash] = useState(false)
  const showTarget = canSetRbtTargetDate(stage)
  const targetMissed =
    !!rbtTargetDate && new Date(rbtTargetDate).getTime() < Date.now()

  useEffect(() => {
    setAction(nextAction ?? '')
    setDue(nextActionDueAt ? nextActionDueAt.slice(0, 10) : '')
  }, [nextAction, nextActionDueAt])

  useEffect(() => {
    setTarget(rbtTargetDate ? rbtTargetDate.slice(0, 10) : '')
  }, [rbtTargetDate])

  const save = () => {
    startTransition(async () => {
      const res = await updateClientNextAction(clientId, {
        nextAction: action,
        dueAt: due || null,
      })
      if (res.ok) {
        setSavedFlash(true)
        setTimeout(() => setSavedFlash(false), 1500)
      }
    })
  }

  const saveTarget = () => {
    startTransition(async () => {
      const res = await updateRbtTargetDate(clientId, target || null)
      if (res.ok) {
        setSavedFlash(true)
        setTimeout(() => setSavedFlash(false), 1500)
      }
    })
  }

  return (
    <header className="sticky top-0 z-20 -mx-1 border-b border-line bg-[color-mix(in_srgb,var(--bg)_92%,white)] px-1 py-3 backdrop-blur-md">
      <div
        className={cn(
          'grid gap-3 sm:grid-cols-2',
          showTarget ? 'lg:grid-cols-6' : 'lg:grid-cols-5'
        )}
      >
        <Field label="Current stage">
          <div className="flex flex-wrap items-center gap-2">
            <span className="inline-flex items-center rounded-md bg-[color-mix(in_srgb,var(--brand)_12%,white)] px-2 py-0.5 text-sm font-medium text-brand">
              {STAGE_LABELS[stage]}
            </span>
            <OwnerDeptBadge dept={ownerDept} />
          </div>
        </Field>

        <Field label="Owner">
          <div className="text-sm text-ink">
            <OwnerDeptBadge dept={ownerDept} />
            {ownerName && (
              <span className="mt-1 block text-quiet">{ownerName}</span>
            )}
          </div>
        </Field>

        <Field label="Next action">
          {canEdit ? (
            <input
              value={action}
              onChange={(e) => setAction(e.target.value)}
              onBlur={save}
              placeholder="What needs to happen next?"
              className="w-full rounded-lg border border-line bg-surface px-2.5 py-1.5 text-sm text-ink placeholder:text-faint focus:outline-none focus:ring-4 focus:ring-[var(--brand-ring)]"
            />
          ) : (
            <p className="text-sm text-ink">{nextAction || '—'}</p>
          )}
        </Field>

        <Field label="Due date">
          {canEdit ? (
            <input
              type="date"
              value={due}
              onChange={(e) => setDue(e.target.value)}
              onBlur={save}
              className="w-full rounded-lg border border-line bg-surface px-2.5 py-1.5 text-sm tabular-nums text-ink focus:outline-none focus:ring-4 focus:ring-[var(--brand-ring)]"
            />
          ) : (
            <p className="text-sm tabular-nums text-ink">
              {nextActionDueAt
                ? new Date(nextActionDueAt).toLocaleDateString()
                : '—'}
            </p>
          )}
        </Field>

        {showTarget && (
          <Field label="RBT target date">
            {canEdit ? (
              <input
                type="date"
                value={target}
                onChange={(e) => setTarget(e.target.value)}
                onBlur={saveTarget}
                className={cn(
                  'w-full rounded-lg border bg-surface px-2.5 py-1.5 text-sm tabular-nums focus:outline-none focus:ring-4 focus:ring-[var(--brand-ring)]',
                  targetMissed
                    ? 'border-[var(--urgent)] text-[var(--urgent)]'
                    : 'border-line text-ink'
                )}
              />
            ) : (
              <p
                className={cn(
                  'text-sm tabular-nums',
                  targetMissed ? 'text-[var(--urgent)]' : 'text-ink'
                )}
              >
                {rbtTargetDate
                  ? new Date(rbtTargetDate).toLocaleDateString()
                  : '—'}
              </p>
            )}
          </Field>
        )}

        <Field label="Days in stage">
          <p className="font-display text-xl font-semibold tabular-nums text-ink">
            {daysInStage == null ? '—' : daysInStage}
            {daysInStage != null && (
              <span className="ml-1 text-sm font-normal text-quiet">
                {daysInStage === 1 ? 'day' : 'days'}
              </span>
            )}
          </p>
          {(pending || savedFlash) && (
            <p className="text-xs text-quiet">
              {pending ? 'Saving…' : 'Saved'}
            </p>
          )}
        </Field>
      </div>
    </header>
  )
}

function Field({
  label,
  children,
  className,
}: {
  label: string
  children: React.ReactNode
  className?: string
}) {
  return (
    <div className={cn('min-w-0', className)}>
      <div className="mb-1 text-[11px] font-medium uppercase tracking-wide text-faint">
        {label}
      </div>
      {children}
    </div>
  )
}
