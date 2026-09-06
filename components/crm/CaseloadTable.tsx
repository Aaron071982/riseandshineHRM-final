'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import { ChevronDown } from 'lucide-react'
import type { ClientOwnerDept, ClientStage } from '@prisma/client'
import { LINEAR_STAGE_ORDER, STAGE_GROUP, STAGE_LABELS } from '@/lib/crm/stages'
import { OwnerDeptBadge } from '@/components/crm/StageStepper'
import { EXPIRY_TONE_CLASS, expiryBand } from '@/components/crm/ProfilePicker'
import { cn } from '@/lib/utils'

export type CaseloadRow = {
  id: string
  clientCode: string
  firstName: string
  lastName: string
  stage: ClientStage
  pipelineStatus: string
  currentOwnerDept: ClientOwnerDept | null
  nextAction: string | null
  nextActionDueAt: string | null
  daysInStage: number
  stalled: boolean
  needsAttention: boolean
  actionOverdue: boolean
  blocked: boolean
  missingDocs: boolean
  hasUnresolvedAlerts: boolean
  rbtName: string | null
  rbtProfileId: string | null
  authExpirationDate: string | null
  scheduledHoursPerWeek: number | null
  authHours: number | null
  insuranceProvider: string | null
}

const STAGE_TONE: Record<string, string> = {
  INTAKE:
    'bg-[var(--stage-intake-bg)] text-[var(--stage-intake)] ring-1 ring-[color-mix(in_srgb,var(--stage-intake)_35%,transparent)]',
  CLINICAL_AUTH:
    'bg-[var(--stage-clinical-bg)] text-[var(--stage-clinical)] ring-1 ring-[color-mix(in_srgb,var(--stage-clinical)_35%,transparent)]',
  STAFFING:
    'bg-[var(--stage-staffing-bg)] text-[var(--stage-staffing)] ring-1 ring-[color-mix(in_srgb,var(--stage-staffing)_35%,transparent)]',
  COORDINATION:
    'bg-[var(--stage-coord-bg)] text-[var(--stage-coord)] ring-1 ring-[color-mix(in_srgb,var(--stage-coord)_35%,transparent)]',
  ACTIVE:
    'bg-[var(--stage-active-bg)] text-[var(--stage-active)] ring-1 ring-[color-mix(in_srgb,var(--stage-active)_35%,transparent)]',
}

const GROUPS = [
  { id: 'all', label: 'All' },
  { id: 'pipeline', label: 'Pipeline' },
  { id: 'staffing', label: 'Staffing' },
  { id: 'active', label: 'Active' },
  { id: 'on_hold', label: 'On hold' },
] as const

const DEPT_QUEUES = [
  { id: 'intake', label: 'Intake' },
  { id: 'case-coordination', label: 'Case coordination' },
  { id: 'clinical', label: 'Clinical' },
  { id: 'staffing', label: 'Staffing queue' },
  { id: 'billing', label: 'Billing' },
] as const

const COLLAPSE_STORAGE_KEY = 'caseload-collapsed-stages'

function stageSortIndex(stage: ClientStage): number {
  if (stage === 'TREATMENT_PLAN') {
    return LINEAR_STAGE_ORDER.indexOf('ASSESSMENT') + 0.5
  }
  const i = LINEAR_STAGE_ORDER.indexOf(stage)
  return i >= 0 ? i : 999
}

function rowHasAttentionChip(r: CaseloadRow): boolean {
  return (
    r.stalled ||
    r.actionOverdue ||
    r.blocked ||
    r.missingDocs ||
    r.hasUnresolvedAlerts
  )
}

function sortRows(list: CaseloadRow[]): CaseloadRow[] {
  return [...list].sort((a, b) => {
    const aAtt = rowHasAttentionChip(a)
    const bAtt = rowHasAttentionChip(b)
    if (aAtt !== bAtt) return aAtt ? -1 : 1
    if (a.needsAttention !== b.needsAttention) {
      return a.needsAttention ? -1 : 1
    }
    if (a.stalled !== b.stalled) return a.stalled ? -1 : 1
    return b.daysInStage - a.daysInStage
  })
}

function AttentionChips({ row }: { row: CaseloadRow }) {
  const chips: { key: string; label: string; className: string }[] = []
  if (row.stalled) {
    chips.push({
      key: 'stalled',
      label: 'stalled',
      className: 'bg-[var(--amber-bg)] text-[var(--amber)]',
    })
  }
  if (row.actionOverdue) {
    chips.push({
      key: 'overdue',
      label: 'overdue',
      className: 'bg-[var(--urgent-bg)] text-[var(--urgent)]',
    })
  }
  if (row.blocked) {
    chips.push({
      key: 'blocked',
      label: 'blocked',
      className: 'bg-[var(--slate-bg)] text-[var(--slate)]',
    })
  }
  if (row.missingDocs) {
    chips.push({
      key: 'missing-docs',
      label: 'missing docs',
      className: 'bg-[var(--amber-bg)] text-[var(--amber)]',
    })
  }
  if (row.hasUnresolvedAlerts && !row.stalled && !row.missingDocs) {
    chips.push({
      key: 'alert',
      label: 'alert',
      className: 'bg-[var(--urgent-bg)] text-[var(--urgent)]',
    })
  }
  if (chips.length === 0) return null
  return (
    <div className="mt-1 flex flex-wrap gap-1">
      {chips.map((c) => (
        <span
          key={c.key}
          className={cn(
            'rounded-md px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide',
            c.className
          )}
        >
          {c.label}
        </span>
      ))}
    </div>
  )
}

function CaseloadRowCells({ r }: { r: CaseloadRow }) {
  const band = expiryBand(r.authExpirationDate)
  return (
    <>
      <td className="px-3 py-2.5">
        <Link
          href={`/client-services/clients/${r.id}`}
          className="font-medium text-ink hover:text-brand"
        >
          {r.firstName} {r.lastName}
        </Link>
        <div className="text-xs tabular-nums text-quiet">
          {r.clientCode}
          {r.pipelineStatus !== 'LIVE' && (
            <span className="ml-1 text-[var(--amber)]">
              · {r.pipelineStatus.replace(/_/g, ' ')}
            </span>
          )}
        </div>
        <AttentionChips row={r} />
      </td>
      <td className="px-3 py-2.5">
        <span
          className={cn(
            'inline-flex rounded-md px-2 py-0.5 text-xs font-semibold',
            STAGE_TONE[STAGE_GROUP[r.stage]]
          )}
        >
          {STAGE_LABELS[r.stage]}
        </span>
      </td>
      <td className="px-3 py-2.5">
        <OwnerDeptBadge dept={r.currentOwnerDept} />
      </td>
      <td className="max-w-[12rem] truncate px-3 py-2.5 text-quiet">
        {r.nextAction || '—'}
      </td>
      <td className="px-3 py-2.5 tabular-nums text-quiet">
        {r.nextActionDueAt
          ? new Date(r.nextActionDueAt).toLocaleDateString()
          : '—'}
      </td>
      <td className="px-3 py-2.5 text-quiet">{r.insuranceProvider || '—'}</td>
      <td className="px-3 py-2.5">
        {r.rbtProfileId ? (
          <Link
            href={`/admin/rbts/${r.rbtProfileId}`}
            className="text-brand hover:text-brand-2"
          >
            {r.rbtName || 'RBT'}
          </Link>
        ) : (
          <span className="text-quiet">{r.rbtName || '—'}</span>
        )}
      </td>
      <td className="px-3 py-2.5">
        <HoursBar scheduled={r.scheduledHoursPerWeek} authorized={r.authHours} />
      </td>
      <td className="px-3 py-2.5">
        {r.authExpirationDate ? (
          <span
            className={cn(
              'rounded-md px-1.5 py-0.5 text-[11px] font-medium tabular-nums',
              EXPIRY_TONE_CLASS[band.tone]
            )}
          >
            {band.label}
          </span>
        ) : (
          <span className="text-quiet">—</span>
        )}
      </td>
    </>
  )
}

export default function CaseloadTable({
  rows,
  stageFilter,
  queueFilter,
  groupFilter,
  deptFilter,
  onGroupChange,
  onDeptChange,
  needsAttentionOnly,
  onNeedsAttentionChange,
  q,
  onClear,
}: {
  rows: CaseloadRow[]
  stageFilter?: string | null
  queueFilter?: string | null
  groupFilter: string
  deptFilter?: string | null
  onGroupChange: (g: string) => void
  onDeptChange: (dept: string | null) => void
  needsAttentionOnly: boolean
  onNeedsAttentionChange: (on: boolean) => void
  q?: string
  onClear?: () => void
}) {
  const [collapsed, setCollapsed] = useState<Set<string>>(() => new Set())

  useEffect(() => {
    try {
      const raw = sessionStorage.getItem(COLLAPSE_STORAGE_KEY)
      if (raw) setCollapsed(new Set(JSON.parse(raw) as string[]))
    } catch {
      // ignore
    }
  }, [])

  const toggleStage = useCallback((stage: string) => {
    setCollapsed((prev) => {
      const next = new Set(prev)
      if (next.has(stage)) next.delete(stage)
      else next.add(stage)
      try {
        sessionStorage.setItem(
          COLLAPSE_STORAGE_KEY,
          JSON.stringify([...next])
        )
      } catch {
        // ignore
      }
      return next
    })
  }, [])

  const filtered = useMemo(() => {
    let list = rows
    if (needsAttentionOnly) {
      list = list.filter((r) => rowHasAttentionChip(r) || r.needsAttention)
    }
    return sortRows(list)
  }, [rows, needsAttentionOnly])

  const grouped = useMemo(() => {
    const map = new Map<ClientStage, CaseloadRow[]>()
    for (const row of filtered) {
      const list = map.get(row.stage) ?? []
      list.push(row)
      map.set(row.stage, list)
    }
    return [...map.entries()].sort(
      ([a], [b]) => stageSortIndex(a) - stageSortIndex(b)
    )
  }, [filtered])

  const hasFilters =
    !!(stageFilter || queueFilter || q || deptFilter || needsAttentionOnly)

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-2">
        {GROUPS.map((g) => (
          <button
            key={g.id}
            type="button"
            onClick={() => onGroupChange(g.id)}
            className={cn(
              'h-8 rounded-lg border px-3 text-sm',
              groupFilter === g.id && !deptFilter
                ? 'border-brand bg-[color-mix(in_srgb,var(--brand)_10%,white)] text-brand'
                : 'border-line bg-surface text-quiet hover:text-ink'
            )}
          >
            {g.label}
          </button>
        ))}
        <span className="mx-1 hidden h-5 w-px bg-line sm:inline-block" aria-hidden />
        {DEPT_QUEUES.map((d) => (
          <button
            key={d.id}
            type="button"
            onClick={() => onDeptChange(deptFilter === d.id ? null : d.id)}
            className={cn(
              'h-8 rounded-lg border px-3 text-sm',
              deptFilter === d.id
                ? 'border-brand bg-[color-mix(in_srgb,var(--brand)_10%,white)] text-brand'
                : 'border-line bg-surface text-quiet hover:text-ink'
            )}
          >
            {d.label}
          </button>
        ))}
        <button
          type="button"
          onClick={() => onNeedsAttentionChange(!needsAttentionOnly)}
          className={cn(
            'h-8 rounded-lg border px-3 text-sm font-medium',
            needsAttentionOnly
              ? 'border-[var(--urgent)] bg-[var(--urgent-bg)] text-[var(--urgent)]'
              : 'border-line bg-surface text-quiet hover:text-ink'
          )}
        >
          Needs attention
        </button>
        {hasFilters && (
          <button
            type="button"
            onClick={onClear}
            className="h-8 text-sm text-quiet hover:text-ink"
          >
            Clear filters
          </button>
        )}
      </div>

      {(stageFilter || queueFilter || deptFilter) && (
        <p className="text-xs text-quiet">
          Filter:{' '}
          {stageFilter
            ? `stage ${STAGE_LABELS[stageFilter as ClientStage] ?? stageFilter}`
            : queueFilter
              ? `queue ${queueFilter}`
              : deptFilter
                ? `department ${DEPT_QUEUES.find((d) => d.id === deptFilter)?.label ?? deptFilter}`
                : null}
          {q ? ` · search “${q}”` : ''}
        </p>
      )}

      {filtered.length === 0 ? (
        <div className="rounded-xl border border-dashed border-line bg-surface px-4 py-12 text-center">
          <p className="font-display text-base font-semibold text-ink">
            No clients in this view
          </p>
          <p className="mt-1 text-sm text-quiet">
            Try another lens or clear filters.
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {grouped.map(([stage, stageRows]) => {
            const isCollapsed = collapsed.has(stage)
            return (
              <section
                key={stage}
                className="overflow-hidden rounded-xl border border-line bg-surface"
              >
                <button
                  type="button"
                  onClick={() => toggleStage(stage)}
                  className="flex w-full items-center justify-between gap-3 border-b border-line bg-line-2/40 px-3 py-2.5 text-left hover:bg-line-2/70"
                >
                  <span className="font-display text-sm font-semibold text-ink">
                    {STAGE_LABELS[stage]}
                    <span className="ml-2 font-normal tabular-nums text-quiet">
                      · {stageRows.length}
                    </span>
                  </span>
                  <ChevronDown
                    className={cn(
                      'h-4 w-4 shrink-0 text-quiet transition-transform',
                      isCollapsed && '-rotate-90'
                    )}
                  />
                </button>
                {!isCollapsed && (
                  <table className="w-full min-w-[56rem] text-left text-sm">
                    <thead>
                      <tr className="border-b border-line text-[11px] uppercase tracking-wide text-faint">
                        <th className="px-3 py-2 font-medium">Client</th>
                        <th className="px-3 py-2 font-medium">Stage</th>
                        <th className="px-3 py-2 font-medium">Owner</th>
                        <th className="px-3 py-2 font-medium">Next action</th>
                        <th className="px-3 py-2 font-medium">Due</th>
                        <th className="px-3 py-2 font-medium">Insurance</th>
                        <th className="px-3 py-2 font-medium">RBT</th>
                        <th className="px-3 py-2 font-medium">Hours</th>
                        <th className="px-3 py-2 font-medium">Auth</th>
                      </tr>
                    </thead>
                    <tbody>
                      {stageRows.map((r) => (
                        <tr
                          key={r.id}
                          className={cn(
                            'border-b border-line-2 hover:bg-[var(--row-hover)]',
                            rowHasAttentionChip(r) && 'bg-[var(--urgent-row)]'
                          )}
                        >
                          <CaseloadRowCells r={r} />
                        </tr>
                      ))}
                    </tbody>
                  </table>
                )}
              </section>
            )
          })}
          <p className="text-xs tabular-nums text-quiet">
            {filtered.length} client{filtered.length === 1 ? '' : 's'} across{' '}
            {grouped.length} stage{grouped.length === 1 ? '' : 's'}
          </p>
        </div>
      )}
    </div>
  )
}

function HoursBar({
  scheduled,
  authorized,
}: {
  scheduled: number | null
  authorized: number | null
}) {
  const rec = scheduled ?? 0
  const need = authorized
  if (need == null && !scheduled) {
    return <span className="text-quiet">—</span>
  }
  const pct = need && need > 0 ? Math.min(100, Math.round((rec / need) * 100)) : 0
  const over = need != null && rec > need + 0.05
  return (
    <div className="min-w-[7rem]">
      <div className="flex justify-between text-[11px] tabular-nums text-quiet">
        <span>{rec.toFixed(1)}h</span>
        <span>{need != null ? `/ ${need}h` : ''}</span>
      </div>
      <div className="mt-0.5 h-1.5 overflow-hidden rounded-full bg-line">
        <div
          className={cn('h-full rounded-full', over ? 'bg-[var(--urgent)]' : 'bg-brand')}
          style={{ width: `${need ? pct : rec > 0 ? 100 : 0}%` }}
        />
      </div>
    </div>
  )
}
