'use client'

import { useMemo, useState } from 'react'
import { Download, FileText, Loader2 } from 'lucide-react'
import type { ClientStage, RequirementGroup, RequirementStatus } from '@prisma/client'
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

export type ClientDocumentRequirement = {
  id: string
  key: string
  label: string
  type: string
  status: RequirementStatus
  stage: ClientStage
  group: RequirementGroup
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

function hasDocumentOnFile(req: ClientDocumentRequirement): boolean {
  if (!req.fileUrl?.trim()) return false
  return (
    req.status === 'RECEIVED' ||
    req.status === 'ON_FILE' ||
    req.status === 'COMPLETE' ||
    req.status === 'EXPIRED'
  )
}

export function ClientDocumentsPanel({
  clientId,
  requirements,
}: {
  clientId: string
  requirements: ClientDocumentRequirement[]
  /** Kept for call-site compatibility; Documents is read-only. */
  currentStage?: ClientStage
  canEdit?: boolean
  consent?: unknown
  referralCheck?: unknown
}) {
  const [downloadingId, setDownloadingId] = useState<string | null>(null)
  const [error, setError] = useState('')

  const grouped = useMemo(() => {
    const docs = requirements.filter(
      (r) => r.type === 'DOCUMENT' && hasDocumentOnFile(r)
    )
    const docGroup = (r: ClientDocumentRequirement) =>
      DOCUMENT_BY_KEY[r.key]?.group ??
      (r.group !== 'STAGE' && r.group !== 'CONSENT' ? r.group : 'INTAKE')
    return DOCUMENT_GROUP_ORDER.map((group) => ({
      group,
      items: docs.filter((r) => docGroup(r) === group),
    })).filter((g) => g.items.length > 0)
  }, [requirements])

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
        <FileText className="mx-auto h-8 w-8 text-faint" />
        <p className="mt-3 font-display text-base font-semibold text-ink">
          No uploaded documents yet
        </p>
        <p className="mt-1 text-sm text-quiet">
          Mark documents received or on file in the Requirements tab — they will
          appear here as a library for the care team.
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
        Library of documents already on file for this client. Upload and status
        updates happen on the <strong className="font-medium text-ink">Requirements</strong>{' '}
        tab.
      </p>

      {grouped.map(({ group, items }) => (
        <section key={group}>
          <h3 className="mb-2 font-display text-base font-semibold text-ink">
            {DOCUMENT_GROUP_LABELS[group]}
          </h3>
          <ul className="divide-y divide-line rounded-xl border border-line bg-surface">
            {items.map((req) => {
              const hasStoredFile = isStoredRequirementPath(req.fileUrl)
              const displayFileName =
                req.fileName?.trim() ||
                (hasStoredFile
                  ? req.fileUrl!.split('/').pop()
                  : req.fileUrl?.trim()) ||
                null
              const uploader =
                req.status === 'ON_FILE' ? req.attestedByUser : req.completedByUser
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
                        </div>
                        {displayFileName && (
                          <div className="mt-1 text-xs text-ink break-all">
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
                    {!hasStoredFile && req.fileUrl?.startsWith('http') && (
                      <a
                        href={req.fileUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex h-8 items-center rounded-lg border border-line px-2 text-xs text-ink hover:bg-line-2"
                      >
                        Open link
                      </a>
                    )}
                  </div>
                </li>
              )
            })}
          </ul>
        </section>
      ))}
    </div>
  )
}
