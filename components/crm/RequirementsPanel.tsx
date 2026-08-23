'use client'

import { useMemo, useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import type { ClientStage, RequirementGroup, RequirementStatus } from '@prisma/client'
import {
  attestRequirementOnFile,
  updateRequirement,
} from '@/lib/crm/actions'
import {
  DOCUMENT_BY_KEY,
  DOCUMENT_GROUP_LABELS,
  DOCUMENT_GROUP_ORDER,
} from '@/lib/crm/documents'
import { STAGE_LABELS } from '@/lib/crm/stages'
import { cn } from '@/lib/utils'

const STATUSES: RequirementStatus[] = [
  'PENDING',
  'RECEIVED',
  'ON_FILE',
  'MISSING',
  'EXPIRED',
  'NOT_APPLICABLE',
  'COMPLETE',
]

const STATUS_CHIP: Record<RequirementStatus, string> = {
  PENDING: 'bg-[var(--slate-bg)] text-[var(--slate)]',
  RECEIVED: 'bg-[var(--green-bg)] text-[var(--green)]',
  ON_FILE: 'bg-[var(--blue-bg)] text-[var(--blue)]',
  MISSING: 'bg-[var(--urgent-bg)] text-[var(--urgent)]',
  EXPIRED: 'bg-[var(--amber-bg)] text-[var(--amber)]',
  NOT_APPLICABLE: 'bg-line-2 text-quiet',
  COMPLETE: 'bg-[var(--green-bg)] text-[var(--green)]',
}

type Req = {
  id: string
  key: string
  label: string
  type: string
  status: RequirementStatus
  stage: ClientStage
  group: RequirementGroup
  isRequiredToAdvance: boolean
  fileUrl: string | null
  expiresAt: Date | string | null
  attestedAt: Date | string | null
  attestedByUser?: { name: string | null; email: string | null } | null
}

function daysUntil(expiresAt: Date | string | null): number | null {
  if (!expiresAt) return null
  const exp = new Date(expiresAt)
  if (Number.isNaN(exp.getTime())) return null
  return Math.ceil((exp.getTime() - Date.now()) / (24 * 60 * 60 * 1000))
}

export function RequirementsPanel({
  requirements,
  currentStage,
  canEdit,
}: {
  requirements: Req[]
  currentStage: ClientStage
  canEdit: boolean
}) {
  const router = useRouter()
  const [pending, startTransition] = useTransition()

  const grouped = useMemo(() => {
    const docs = requirements.filter((r) => !!DOCUMENT_BY_KEY[r.key])
    const legacyDocs = requirements.filter(
      (r) => !DOCUMENT_BY_KEY[r.key] && r.type === 'DOCUMENT'
    )
    const tasks = requirements.filter((r) => !DOCUMENT_BY_KEY[r.key] && r.type !== 'DOCUMENT')
    const docGroup = (r: Req) =>
      DOCUMENT_BY_KEY[r.key]?.group ??
      (r.group !== 'STAGE' && r.group !== 'CONSENT' ? r.group : 'INTAKE')
    const byGroup = DOCUMENT_GROUP_ORDER.map((group) => ({
      group,
      items: docs.filter((r) => docGroup(r) === group),
    })).filter((g) => g.items.length > 0)
    return { byGroup, tasks, legacyDocs }
  }, [requirements])

  if (requirements.length === 0) {
    return (
      <div className="rounded-xl border border-dashed border-line bg-surface px-4 py-10 text-center">
        <p className="font-display text-base font-semibold text-ink">No requirements yet</p>
        <p className="mt-1 text-sm text-quiet">
          Gate checklist items appear as this client moves through stages.
        </p>
      </div>
    )
  }

  const run = (fn: () => Promise<unknown>) => {
    startTransition(async () => {
      await fn()
      router.refresh()
    })
  }

  return (
    <div className="space-y-6">
      <p className="text-sm text-quiet">
        Stage gates and checklist status. Upload and download files on the{' '}
        <strong className="font-medium text-ink">Documents</strong> tab.
      </p>

      {grouped.byGroup.map(({ group, items }) => (
        <section key={group}>
          <h3 className="mb-2 font-display text-base font-semibold text-ink">
            {DOCUMENT_GROUP_LABELS[group]}
          </h3>
          <ul className="divide-y divide-line rounded-xl border border-line bg-surface">
            {items.map((req) => {
              const catalog = DOCUMENT_BY_KEY[req.key]
              const days = daysUntil(req.expiresAt)
              const attestOk = catalog?.attestAllowed !== false
              return (
                <li key={req.id} className="px-3 py-2.5">
                  <div className="flex flex-wrap items-center gap-3">
                    <div className="min-w-0 flex-1">
                      <div className="text-sm font-medium text-ink">{req.label}</div>
                      <div className="text-xs text-quiet">
                        {STAGE_LABELS[req.stage]}
                        {req.isRequiredToAdvance && req.stage === currentStage && (
                          <span className="ml-2 text-brand">Required to advance</span>
                        )}
                        {days != null && (
                          <span
                            className={cn(
                              'ml-2',
                              days < 0
                                ? 'text-[var(--urgent)]'
                                : days <= 30
                                  ? 'text-[var(--amber)]'
                                  : 'text-quiet'
                            )}
                          >
                            {days < 0
                              ? `Expired ${Math.abs(days)}d ago`
                              : `Expires in ${days}d`}
                          </span>
                        )}
                        {req.status === 'ON_FILE' && req.attestedByUser && (
                          <span className="ml-2">
                            On file by{' '}
                            {req.attestedByUser.name || req.attestedByUser.email}
                            {req.attestedAt
                              ? ` · ${new Date(req.attestedAt).toLocaleDateString()}`
                              : ''}
                          </span>
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
                      <div className="flex flex-wrap items-center gap-1.5">
                        {attestOk && (
                          <button
                            type="button"
                            disabled={pending}
                            onClick={() =>
                              run(() => attestRequirementOnFile(req.id))
                            }
                            className="h-8 rounded-lg border border-line px-2 text-xs text-ink hover:bg-line-2 disabled:opacity-50"
                          >
                            Mark on file
                          </button>
                        )}
                        <select
                          disabled={pending}
                          value={req.status}
                          onChange={(e) => {
                            const status = e.target.value as RequirementStatus
                            run(() => updateRequirement(req.id, { status }))
                          }}
                          className="h-8 rounded-lg border border-line bg-surface px-2 text-xs text-ink"
                        >
                          {STATUSES.filter(
                            (s) => s !== 'ON_FILE' || attestOk
                          ).map((s) => (
                            <option key={s} value={s}>
                              {s.replace(/_/g, ' ')}
                            </option>
                          ))}
                        </select>
                      </div>
                    )}
                  </div>
                </li>
              )
            })}
          </ul>
        </section>
      ))}

      {grouped.legacyDocs.length > 0 && (
        <section>
          <h3 className="mb-2 font-display text-base font-semibold text-ink">
            Other documents
          </h3>
          <ul className="divide-y divide-line rounded-xl border border-line bg-surface">
            {grouped.legacyDocs.map((req) => (
              <li
                key={req.id}
                className="flex flex-wrap items-center gap-3 px-3 py-2.5"
              >
                <div className="min-w-0 flex-1">
                  <div className="text-sm font-medium text-ink">{req.label}</div>
                  <div className="text-xs text-quiet">{STAGE_LABELS[req.stage]}</div>
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
                      run(() => updateRequirement(req.id, { status }))
                    }}
                    className="h-8 rounded-lg border border-line bg-surface px-2 text-xs text-ink"
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
      )}

      {grouped.tasks.length > 0 && (
        <section>
          <h3 className="mb-2 font-display text-base font-semibold text-ink">
            Stage checklist
          </h3>
          <ul className="divide-y divide-line rounded-xl border border-line bg-surface">
            {grouped.tasks.map((req) => (
              <li
                key={req.id}
                className="flex flex-wrap items-center gap-3 px-3 py-2.5"
              >
                <div className="min-w-0 flex-1">
                  <div className="text-sm font-medium text-ink">{req.label}</div>
                  <div className="text-xs text-quiet">{STAGE_LABELS[req.stage]}</div>
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
                      run(() => updateRequirement(req.id, { status }))
                    }}
                    className="h-8 rounded-lg border border-line bg-surface px-2 text-xs text-ink"
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
      )}
    </div>
  )
}
