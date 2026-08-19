'use client'

import { useMemo, useState } from 'react'
import Link from 'next/link'
import type { ClientOwnerDept, ClientStage } from '@prisma/client'
import { STAGE_GROUP, STAGE_LABELS } from '@/lib/crm/stages'
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

export default function CaseloadTable({
  rows,
  stageFilter,
  queueFilter,
  groupFilter,
  onGroupChange,
  q,
  onClear,
}: {
  rows: CaseloadRow[]
  stageFilter?: string | null
  queueFilter?: string | null
  groupFilter: string
  onGroupChange: (g: string) => void
  q?: string
  onClear?: () => void
}) {
  const [page, setPage] = useState(0)
  const pageSize = 25

  const sorted = useMemo(() => {
    const list = [...rows]
    list.sort((a, b) => {
      if (a.needsAttention !== b.needsAttention) {
        return a.needsAttention ? -1 : 1
      }
      if (a.stalled !== b.stalled) return a.stalled ? -1 : 1
      return b.daysInStage - a.daysInStage
    })
    return list
  }, [rows])

  const pageCount = Math.max(1, Math.ceil(sorted.length / pageSize))
  const safePage = Math.min(page, pageCount - 1)
  const shown = sorted.slice(safePage * pageSize, safePage * pageSize + pageSize)

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-2">
        {GROUPS.map((g) => (
          <button
            key={g.id}
            type="button"
            onClick={() => {
              onGroupChange(g.id)
              setPage(0)
            }}
            className={cn(
              'h-8 rounded-lg border px-3 text-sm',
              groupFilter === g.id
                ? 'border-brand bg-[color-mix(in_srgb,var(--brand)_10%,white)] text-brand'
                : 'border-line bg-surface text-quiet hover:text-ink'
            )}
          >
            {g.label}
          </button>
        ))}
        {(stageFilter || queueFilter || q) && (
          <button
            type="button"
            onClick={onClear}
            className="h-8 text-sm text-quiet hover:text-ink"
          >
            Clear filters
          </button>
        )}
      </div>

      {(stageFilter || queueFilter) && (
        <p className="text-xs text-quiet">
          Filter:{' '}
          {stageFilter
            ? `stage ${STAGE_LABELS[stageFilter as ClientStage] ?? stageFilter}`
            : `queue ${queueFilter}`}
        </p>
      )}

      {sorted.length === 0 ? (
        <div className="rounded-xl border border-dashed border-line bg-surface px-4 py-12 text-center">
          <p className="font-display text-base font-semibold text-ink">
            No clients in this view
          </p>
          <p className="mt-1 text-sm text-quiet">
            Try another stage group, or clear the dashboard deep-link filter.
          </p>
        </div>
      ) : (
        <div className="overflow-hidden rounded-xl border border-line bg-surface">
          <table className="w-full min-w-[56rem] text-left text-sm">
            <thead>
              <tr className="border-b border-line bg-line-2/40 text-[11px] uppercase tracking-wide text-faint">
                <th className="px-3 py-2.5 font-medium">Client</th>
                <th className="px-3 py-2.5 font-medium">Stage</th>
                <th className="px-3 py-2.5 font-medium">Owner</th>
                <th className="px-3 py-2.5 font-medium">Next action</th>
                <th className="px-3 py-2.5 font-medium">Due</th>
                <th className="px-3 py-2.5 font-medium">Insurance</th>
                <th className="px-3 py-2.5 font-medium">RBT</th>
                <th className="px-3 py-2.5 font-medium">Hours</th>
                <th className="px-3 py-2.5 font-medium">Auth</th>
              </tr>
            </thead>
            <tbody>
              {shown.map((r) => {
                const band = expiryBand(r.authExpirationDate)
                return (
                  <tr
                    key={r.id}
                    className={cn(
                      'border-b border-line-2 hover:bg-[var(--row-hover)]',
                      r.needsAttention && 'bg-[var(--urgent-row)]'
                    )}
                  >
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
                      {r.stalled && (
                        <span className="ml-1 text-[10px] font-medium text-[var(--amber)]">
                          stalled
                        </span>
                      )}
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
                    <td className="px-3 py-2.5 text-quiet">
                      {r.insuranceProvider || '—'}
                    </td>
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
                      <HoursBar
                        scheduled={r.scheduledHoursPerWeek}
                        authorized={r.authHours}
                      />
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
                  </tr>
                )
              })}
            </tbody>
          </table>
          {pageCount > 1 && (
            <div className="flex items-center justify-between border-t border-line px-3 py-2 text-xs text-quiet">
              <span>
                {sorted.length} clients · page {safePage + 1}/{pageCount}
              </span>
              <div className="flex gap-2">
                <button
                  type="button"
                  disabled={safePage === 0}
                  onClick={() => setPage((p) => Math.max(0, p - 1))}
                  className="hover:text-ink disabled:opacity-40"
                >
                  Prev
                </button>
                <button
                  type="button"
                  disabled={safePage >= pageCount - 1}
                  onClick={() => setPage((p) => Math.min(pageCount - 1, p + 1))}
                  className="hover:text-ink disabled:opacity-40"
                >
                  Next
                </button>
              </div>
            </div>
          )}
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
