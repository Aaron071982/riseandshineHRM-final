'use client'

import { useMemo, useRef, useState, useTransition, type MutableRefObject } from 'react'
import { useRouter } from 'next/navigation'
import { Check, Loader2, Upload } from 'lucide-react'
import type { ClientStage, RequirementGroup, RequirementStatus } from '@prisma/client'
import { updateRequirement } from '@/lib/crm/actions'
import {
  DOCUMENT_BY_KEY,
  DOCUMENT_GROUP_LABELS,
  DOCUMENT_GROUP_ORDER,
} from '@/lib/crm/documents'
import { isStoredRequirementPath } from '@/lib/crm/requirementDocuments'
import { STAGE_LABELS } from '@/lib/crm/stages'
import { cn } from '@/lib/utils'

const STATUS_CHIP: Record<RequirementStatus, string> = {
  PENDING: 'bg-[var(--slate-bg)] text-[var(--slate)]',
  RECEIVED: 'bg-[var(--green-bg)] text-[var(--green)]',
  ON_FILE: 'bg-[var(--blue-bg)] text-[var(--blue)]',
  MISSING: 'bg-[var(--urgent-bg)] text-[var(--urgent)]',
  EXPIRED: 'bg-[var(--amber-bg)] text-[var(--amber)]',
  NOT_APPLICABLE: 'bg-line-2 text-quiet',
  COMPLETE: 'bg-[var(--green-bg)] text-[var(--green)]',
}

const SATISFIED_STATUSES: RequirementStatus[] = [
  'COMPLETE',
  'RECEIVED',
  'ON_FILE',
  'NOT_APPLICABLE',
]

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
  fileName?: string | null
  fileSizeBytes?: number | null
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

function displayFileLabel(req: Req): string | null {
  if (req.fileName?.trim()) return req.fileName.trim()
  if (req.fileUrl && isStoredRequirementPath(req.fileUrl)) {
    return req.fileUrl.split('/').pop() ?? req.fileUrl
  }
  if (req.fileUrl?.trim()) return req.fileUrl.trim()
  return null
}

function RequirementActions({
  req,
  canEdit,
  pending,
  busy,
  showUpload,
  fileInputs,
  onUpload,
  onMarkComplete,
}: {
  req: Req
  canEdit: boolean
  pending: boolean
  busy: boolean
  showUpload: boolean
  fileInputs: MutableRefObject<Record<string, HTMLInputElement | null>>
  onUpload: (requirementId: string, file: File) => Promise<void>
  onMarkComplete: () => void
}) {
  const fileLabel = displayFileLabel(req)
  const satisfied = SATISFIED_STATUSES.includes(req.status)

  if (!canEdit) return null

  return (
    <div className="flex flex-wrap items-center gap-1.5">
      {showUpload && (
        <>
          <input
            ref={(el) => {
              fileInputs.current[req.id] = el
            }}
            type="file"
            accept=".pdf,.png,.jpg,.jpeg,.heic,.doc,.docx,.xls,.xlsx,.txt"
            className="hidden"
            onChange={(e) => {
              const file = e.target.files?.[0]
              e.target.value = ''
              if (file) void onUpload(req.id, file)
            }}
          />
          <button
            type="button"
            disabled={pending || busy}
            onClick={() => fileInputs.current[req.id]?.click()}
            className="inline-flex h-8 items-center gap-1 rounded-lg border border-line bg-surface px-2 text-xs font-medium text-ink hover:bg-line-2 disabled:opacity-50"
          >
            {busy ? (
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
            ) : (
              <Upload className="h-3.5 w-3.5" />
            )}
            {fileLabel ? 'Replace' : 'Upload'}
          </button>
        </>
      )}
      {!satisfied && (
        <button
          type="button"
          disabled={pending || busy}
          onClick={onMarkComplete}
          className="inline-flex h-8 items-center gap-1 rounded-lg border border-line bg-surface px-2 text-xs font-medium text-ink hover:bg-line-2 disabled:opacity-50"
        >
          <Check className="h-3.5 w-3.5" />
          Mark complete
        </button>
      )}
    </div>
  )
}

export function RequirementsPanel({
  clientId,
  requirements,
  currentStage,
  canEdit,
}: {
  clientId: string
  requirements: Req[]
  currentStage: ClientStage
  canEdit: boolean
}) {
  const router = useRouter()
  const [pending, startTransition] = useTransition()
  const [uploadingId, setUploadingId] = useState<string | null>(null)
  const [error, setError] = useState('')
  const fileInputs = useRef<Record<string, HTMLInputElement | null>>({})

  const grouped = useMemo(() => {
    const docs = requirements.filter((r) => !!DOCUMENT_BY_KEY[r.key])
    const legacyDocs = requirements.filter(
      (r) => !DOCUMENT_BY_KEY[r.key] && r.type === 'DOCUMENT'
    )
    const tasks = requirements.filter(
      (r) => !DOCUMENT_BY_KEY[r.key] && r.type !== 'DOCUMENT'
    )
    const docGroup = (r: Req) =>
      DOCUMENT_BY_KEY[r.key]?.group ??
      (r.group !== 'STAGE' && r.group !== 'CONSENT' ? r.group : 'INTAKE')
    const byGroup = DOCUMENT_GROUP_ORDER.map((group) => ({
      group,
      items: docs.filter((r) => docGroup(r) === group),
    })).filter((g) => g.items.length > 0)
    return { byGroup, tasks, legacyDocs }
  }, [requirements])

  const run = (fn: () => Promise<unknown>) => {
    startTransition(async () => {
      setError('')
      await fn()
      router.refresh()
    })
  }

  const onUpload = async (requirementId: string, file: File) => {
    setError('')
    setUploadingId(requirementId)
    try {
      const form = new FormData()
      form.append('file', file)
      const res = await fetch(
        `/api/client-services/clients/${clientId}/requirements/${requirementId}/upload`,
        { method: 'POST', body: form, credentials: 'include' }
      )
      const data = (await res.json().catch(() => ({}))) as { error?: string }
      if (!res.ok) {
        throw new Error(data.error || 'Upload failed')
      }
      router.refresh()
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Upload failed')
    } finally {
      setUploadingId(null)
    }
  }

  const markComplete = (requirementId: string) => {
    run(() => updateRequirement(requirementId, { status: 'COMPLETE' }))
  }

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

  const renderRow = (req: Req, showUpload: boolean) => {
    const days = daysUntil(req.expiresAt)
    const fileLabel = displayFileLabel(req)
    const busy = uploadingId === req.id

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
            </div>
            {fileLabel && (
              <div className="mt-1 truncate text-xs text-ink">{fileLabel}</div>
            )}
          </div>
          <span
            className={cn(
              'rounded-md px-2 py-0.5 text-[11px] font-medium',
              STATUS_CHIP[req.status]
            )}
          >
            {req.status.replace(/_/g, ' ')}
          </span>
          <RequirementActions
            req={req}
            canEdit={canEdit}
            pending={pending}
            busy={busy}
            showUpload={showUpload}
            fileInputs={fileInputs}
            onUpload={onUpload}
            onMarkComplete={() => markComplete(req.id)}
          />
        </div>
      </li>
    )
  }

  return (
    <div className="space-y-6">
      {error && (
        <p className="rounded-lg bg-[var(--urgent-bg)] px-3 py-2 text-sm text-[var(--urgent)]">
          {error}
        </p>
      )}

      <p className="text-sm text-quiet">
        Upload a document or mark an item complete when it is done. Uploaded files
        appear on the <strong className="font-medium text-ink">Documents</strong> tab
        for preview and download.
      </p>

      {grouped.byGroup.map(({ group, items }) => (
        <section key={group}>
          <h3 className="mb-2 font-display text-base font-semibold text-ink">
            {DOCUMENT_GROUP_LABELS[group]}
          </h3>
          <ul className="divide-y divide-line rounded-xl border border-line bg-surface">
            {items.map((req) => renderRow(req, true))}
          </ul>
        </section>
      ))}

      {grouped.legacyDocs.length > 0 && (
        <section>
          <h3 className="mb-2 font-display text-base font-semibold text-ink">
            Other documents
          </h3>
          <ul className="divide-y divide-line rounded-xl border border-line bg-surface">
            {grouped.legacyDocs.map((req) => renderRow(req, true))}
          </ul>
        </section>
      )}

      {grouped.tasks.length > 0 && (
        <section>
          <h3 className="mb-2 font-display text-base font-semibold text-ink">
            Stage checklist
          </h3>
          <ul className="divide-y divide-line rounded-xl border border-line bg-surface">
            {grouped.tasks.map((req) => renderRow(req, false))}
          </ul>
        </section>
      )}
    </div>
  )
}
