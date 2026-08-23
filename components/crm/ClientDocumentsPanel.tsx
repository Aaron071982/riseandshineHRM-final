'use client'

import { useMemo, useRef, useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { Download, FileText, Loader2, Upload } from 'lucide-react'
import type { ClientStage, RequirementGroup, RequirementStatus } from '@prisma/client'
import { attestRequirementOnFile } from '@/lib/crm/actions'
import {
  DOCUMENT_BY_KEY,
  DOCUMENT_GROUP_LABELS,
  DOCUMENT_GROUP_ORDER,
} from '@/lib/crm/documents'
import { isStoredRequirementPath } from '@/lib/crm/requirementDocuments'
import { STAGE_LABELS } from '@/lib/crm/stages'
import { ConsentInitialsPanel, type ConsentShape } from '@/components/crm/ConsentInitialsPanel'
import { ReferralCheckPanel, type ReferralCheckShape } from '@/components/crm/ReferralCheckPanel'
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

export type ClientDocumentRequirement = {
  id: string
  key: string
  label: string
  type: string
  status: RequirementStatus
  stage: ClientStage
  group: RequirementGroup
  isRequiredToAdvance: boolean
  fileUrl: string | null
  fileName: string | null
  fileContentType: string | null
  fileSizeBytes: number | null
  expiresAt: Date | string | null
  completedAt: Date | string | null
  attestedAt: Date | string | null
  attestedByUser?: { name: string | null; email: string | null } | null
  completedByUser?: { name: string | null; email: string | null } | null
}

function formatSize(bytes: number | null): string {
  if (bytes == null || bytes <= 0) return ''
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}

function daysUntil(expiresAt: Date | string | null): number | null {
  if (!expiresAt) return null
  const exp = new Date(expiresAt)
  if (Number.isNaN(exp.getTime())) return null
  return Math.ceil((exp.getTime() - Date.now()) / (24 * 60 * 60 * 1000))
}

function statusLabel(status: RequirementStatus): string {
  return status.replace(/_/g, ' ')
}

export function ClientDocumentsPanel({
  clientId,
  requirements,
  currentStage,
  canEdit,
  consent,
  referralCheck,
}: {
  clientId: string
  requirements: ClientDocumentRequirement[]
  currentStage: ClientStage
  canEdit: boolean
  consent: ConsentShape | null
  referralCheck: ReferralCheckShape | null
}) {
  const router = useRouter()
  const [pending, startTransition] = useTransition()
  const [uploadingId, setUploadingId] = useState<string | null>(null)
  const [downloadingId, setDownloadingId] = useState<string | null>(null)
  const [error, setError] = useState('')
  const fileInputs = useRef<Record<string, HTMLInputElement | null>>({})

  const grouped = useMemo(() => {
    const docs = requirements.filter((r) => r.type === 'DOCUMENT')
    const docGroup = (r: ClientDocumentRequirement) =>
      DOCUMENT_BY_KEY[r.key]?.group ??
      (r.group !== 'STAGE' && r.group !== 'CONSENT' ? r.group : 'INTAKE')
    return DOCUMENT_GROUP_ORDER.map((group) => ({
      group,
      items: docs.filter((r) => docGroup(r) === group),
    })).filter((g) => g.items.length > 0)
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

  const onDownload = async (requirementId: string, fileName: string) => {
    setError('')
    setDownloadingId(requirementId)
    try {
      const res = await fetch(
        `/api/client-services/clients/${clientId}/requirements/${requirementId}/download`,
        { credentials: 'include' }
      )
      if (!res.ok) {
        const data = (await res.json().catch(() => ({}))) as { error?: string }
        throw new Error(data.error || 'Download failed')
      }
      const blob = await res.blob()
      const disposition = res.headers.get('Content-Disposition')
      const match = disposition?.match(/filename="?([^";]+)"?/)
      const name = match?.[1] ?? fileName
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = name
      document.body.appendChild(a)
      a.click()
      document.body.removeChild(a)
      URL.revokeObjectURL(url)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Download failed')
    } finally {
      setDownloadingId(null)
    }
  }

  if (grouped.length === 0) {
    return (
      <div className="rounded-xl border border-dashed border-line bg-surface px-4 py-10 text-center">
        <p className="font-display text-base font-semibold text-ink">No documents yet</p>
        <p className="mt-1 text-sm text-quiet">
          Required documents appear here as this client moves through intake.
        </p>
      </div>
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
        Upload and download tracked requirement documents. Files are stored privately and
        access is logged. Use the Requirements tab for stage gate checklist items.
      </p>

      {grouped.map(({ group, items }) => (
        <section key={group}>
          <h3 className="mb-2 font-display text-base font-semibold text-ink">
            {DOCUMENT_GROUP_LABELS[group]}
          </h3>
          <ul className="divide-y divide-line rounded-xl border border-line bg-surface">
            {items.map((req) => {
              const catalog = DOCUMENT_BY_KEY[req.key]
              const days = daysUntil(req.expiresAt)
              const attestOk = catalog?.attestAllowed !== false
              const hasStoredFile = isStoredRequirementPath(req.fileUrl)
              const displayFileName =
                req.fileName?.trim() ||
                (hasStoredFile ? req.fileUrl!.split('/').pop() : null)
              const uploader =
                req.status === 'ON_FILE'
                  ? req.attestedByUser
                  : req.completedByUser
              const uploadedAt =
                req.status === 'ON_FILE' ? req.attestedAt : req.completedAt

              return (
                <li key={req.id} className="px-3 py-3">
                  <div className="flex flex-wrap items-start gap-3">
                    <div className="flex min-w-0 flex-1 items-start gap-2.5">
                      <FileText className="mt-0.5 h-4 w-4 shrink-0 text-quiet" />
                      <div className="min-w-0 flex-1">
                        <div className="text-sm font-medium text-ink">{req.label}</div>
                        <div className="mt-0.5 text-xs text-quiet">
                          {STAGE_LABELS[req.stage]}
                          {req.isRequiredToAdvance && req.stage === currentStage && (
                            <span className="ml-2 text-brand">Required to advance</span>
                          )}
                        </div>
                        {displayFileName && (
                          <div className="mt-1 text-xs text-ink">
                            {displayFileName}
                            {req.fileSizeBytes ? (
                              <span className="text-quiet">
                                {' '}
                                · {formatSize(req.fileSizeBytes)}
                              </span>
                            ) : null}
                          </div>
                        )}
                        {(uploader || uploadedAt) && (
                          <div className="mt-0.5 text-xs text-quiet">
                            {req.status === 'ON_FILE' ? 'On file' : 'Received'}
                            {uploader
                              ? ` by ${uploader.name || uploader.email}`
                              : ''}
                            {uploadedAt
                              ? ` · ${new Date(uploadedAt).toLocaleDateString()}`
                              : ''}
                          </div>
                        )}
                        {days != null && (
                          <div
                            className={cn(
                              'mt-0.5 text-xs',
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
                          </div>
                        )}
                        {req.status === 'RECEIVED' && !hasStoredFile && req.fileUrl && (
                          <div className="mt-0.5 text-xs text-quiet">
                            External link on file (legacy)
                          </div>
                        )}
                      </div>
                    </div>

                    <span
                      className={cn(
                        'rounded-md px-2 py-0.5 text-[11px] font-medium',
                        STATUS_CHIP[req.status]
                      )}
                    >
                      {statusLabel(req.status)}
                    </span>

                    <div className="flex flex-wrap items-center gap-1.5">
                      {hasStoredFile && (
                        <button
                          type="button"
                          disabled={downloadingId === req.id}
                          onClick={() =>
                            onDownload(
                              req.id,
                              displayFileName ?? `${req.label}.pdf`
                            )
                          }
                          className="inline-flex h-8 items-center gap-1 rounded-lg border border-line px-2 text-xs text-ink hover:bg-line-2 disabled:opacity-50"
                        >
                          {downloadingId === req.id ? (
                            <Loader2 className="h-3.5 w-3.5 animate-spin" />
                          ) : (
                            <Download className="h-3.5 w-3.5" />
                          )}
                          Download
                        </button>
                      )}

                      {canEdit && (
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
                            disabled={pending || uploadingId === req.id}
                            onClick={() => fileInputs.current[req.id]?.click()}
                            className="inline-flex h-8 items-center gap-1 rounded-lg border border-line bg-surface px-2 text-xs text-ink hover:bg-line-2 disabled:opacity-50"
                          >
                            {uploadingId === req.id ? (
                              <Loader2 className="h-3.5 w-3.5 animate-spin" />
                            ) : (
                              <Upload className="h-3.5 w-3.5" />
                            )}
                            {hasStoredFile ? 'Replace' : 'Upload'}
                          </button>

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
                        </>
                      )}
                    </div>
                  </div>

                  {req.key === 'consent_form' && (
                    <div className="mt-3 border-t border-line pt-3">
                      <ConsentInitialsPanel
                        clientId={clientId}
                        consent={consent}
                        canEdit={canEdit}
                      />
                    </div>
                  )}
                  {req.key === 'physician_referral' && (
                    <div className="mt-3 border-t border-line pt-3">
                      <ReferralCheckPanel
                        clientId={clientId}
                        check={referralCheck}
                        canEdit={canEdit}
                      />
                    </div>
                  )}
                </li>
              )
            })}
          </ul>
        </section>
      ))}
    </div>
  )
}
