'use client'

import { useEffect, useMemo, useState } from 'react'
import { Download, Eye, FileText, Loader2, X } from 'lucide-react'
import type { ClientStage, RequirementGroup, RequirementStatus } from '@prisma/client'
import {
  DOCUMENT_BY_KEY,
  DOCUMENT_GROUP_LABELS,
  DOCUMENT_GROUP_ORDER,
} from '@/lib/crm/documents'
import { isStoredRequirementPath } from '@/lib/crm/requirementDocuments.shared'
import { parseContentDispositionFileName } from '@/lib/http/contentDisposition'
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

type PreviewState = {
  requirementId: string
  title: string
  fileName: string
  contentType: string | null
  blobUrl: string | null
  externalUrl: string | null
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

function guessContentType(req: ClientDocumentRequirement): string | null {
  if (req.fileContentType?.trim()) return req.fileContentType.trim()
  const name = (req.fileName || req.fileUrl || '').toLowerCase()
  if (name.endsWith('.pdf')) return 'application/pdf'
  if (name.endsWith('.png')) return 'image/png'
  if (name.endsWith('.jpg') || name.endsWith('.jpeg')) return 'image/jpeg'
  if (name.endsWith('.gif')) return 'image/gif'
  if (name.endsWith('.webp')) return 'image/webp'
  if (name.endsWith('.txt')) return 'text/plain'
  return null
}

function canInlinePreview(contentType: string | null, fileName: string): boolean {
  const t = (contentType || '').toLowerCase()
  const n = fileName.toLowerCase()
  return (
    t.includes('pdf') ||
    t.startsWith('image/') ||
    t.startsWith('text/') ||
    n.endsWith('.pdf') ||
    /\.(png|jpe?g|gif|webp|txt)$/i.test(n)
  )
}

export function ClientDocumentsPanel({
  clientId,
  requirements,
  intakeForms,
}: {
  clientId: string
  requirements: ClientDocumentRequirement[]
  intakeForms?: {
    complete: boolean
    missingRequired: { code: string; title: string }[]
    packetId: string | null
    forms: {
      id: string
      packetId: string
      formCode: string
      formTitle: string
      submittedAt: Date | string
      signedByName: string
      signedByRelationship: string
    }[]
  }
  currentStage?: ClientStage
  canEdit?: boolean
  consent?: unknown
  referralCheck?: unknown
}) {
  const [busyId, setBusyId] = useState<string | null>(null)
  const [error, setError] = useState('')
  const [preview, setPreview] = useState<PreviewState | null>(null)
  const [intakePreview, setIntakePreview] = useState<{
    id: string
    title: string
    fileName: string
    blobUrl: string
  } | null>(null)

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

  useEffect(() => {
    return () => {
      if (preview?.blobUrl) URL.revokeObjectURL(preview.blobUrl)
      if (intakePreview?.blobUrl) URL.revokeObjectURL(intakePreview.blobUrl)
    }
  }, [preview?.blobUrl, intakePreview?.blobUrl])

  const closePreview = () => {
    setPreview((prev) => {
      if (prev?.blobUrl) URL.revokeObjectURL(prev.blobUrl)
      return null
    })
  }

  const closeIntakePreview = () => {
    setIntakePreview((prev) => {
      if (prev?.blobUrl) URL.revokeObjectURL(prev.blobUrl)
      return null
    })
  }

  const fetchIntakePdf = async (submissionId: string, inline: boolean) => {
    const qs = inline ? '?inline=1' : ''
    const res = await fetch(
      `/api/client-services/clients/${clientId}/intake/${submissionId}/pdf${qs}`,
      { credentials: 'include' }
    )
    if (!res.ok) {
      const data = (await res.json().catch(() => ({}))) as { error?: string }
      throw new Error(data.error || (inline ? 'Preview failed' : 'Download failed'))
    }
    const blob = await res.blob()
    const disposition = res.headers.get('Content-Disposition')
    return {
      blob,
      fileName: parseContentDispositionFileName(disposition),
    }
  }

  const onIntakeDownload = async (
    submissionId: string,
    formCode: string,
    formTitle: string
  ) => {
    setError('')
    setBusyId(submissionId)
    try {
      const { blob, fileName } = await fetchIntakePdf(submissionId, false)
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = fileName ?? `${formCode}_${formTitle.replace(/\s+/g, '_')}.pdf`
      document.body.appendChild(a)
      a.click()
      document.body.removeChild(a)
      URL.revokeObjectURL(url)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Download failed')
    } finally {
      setBusyId(null)
    }
  }

  const onIntakePreview = async (
    submissionId: string,
    formCode: string,
    formTitle: string
  ) => {
    setError('')
    setBusyId(submissionId)
    try {
      closePreview()
      closeIntakePreview()
      const { blob, fileName } = await fetchIntakePdf(submissionId, true)
      setIntakePreview({
        id: submissionId,
        title: formTitle,
        fileName: fileName ?? `${formCode}.pdf`,
        blobUrl: URL.createObjectURL(blob),
      })
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Preview failed')
    } finally {
      setBusyId(null)
    }
  }

  const fetchStoredBlob = async (requirementId: string, inline: boolean) => {
    const qs = inline ? '?inline=1' : ''
    const res = await fetch(
      `/api/client-services/clients/${clientId}/requirements/${requirementId}/download${qs}`,
      { credentials: 'include' }
    )
    if (!res.ok) {
      const data = (await res.json().catch(() => ({}))) as { error?: string }
      throw new Error(data.error || (inline ? 'Preview failed' : 'Download failed'))
    }
    const blob = await res.blob()
    const disposition = res.headers.get('Content-Disposition')
    return {
      blob,
      fileName: parseContentDispositionFileName(disposition),
      contentType: res.headers.get('Content-Type'),
    }
  }

  const onDownload = async (req: ClientDocumentRequirement, displayFileName: string) => {
    setError('')
    setBusyId(req.id)
    try {
      if (isStoredRequirementPath(req.fileUrl)) {
        const { blob, fileName } = await fetchStoredBlob(req.id, false)
        const url = URL.createObjectURL(blob)
        const a = document.createElement('a')
        a.href = url
        a.download = fileName ?? displayFileName
        document.body.appendChild(a)
        a.click()
        document.body.removeChild(a)
        URL.revokeObjectURL(url)
        return
      }
      if (req.fileUrl?.startsWith('http')) {
        window.open(req.fileUrl, '_blank', 'noopener,noreferrer')
        return
      }
      throw new Error('No downloadable file for this document')
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Download failed')
    } finally {
      setBusyId(null)
    }
  }

  const onPreview = async (req: ClientDocumentRequirement, displayFileName: string) => {
    setError('')
    setBusyId(req.id)
    try {
      closePreview()
      closeIntakePreview()
      const contentType = guessContentType(req)

      if (isStoredRequirementPath(req.fileUrl)) {
        const fetched = await fetchStoredBlob(req.id, true)
        const name = fetched.fileName ?? displayFileName
        const type = fetched.contentType || contentType
        if (!canInlinePreview(type, name)) {
          const url = URL.createObjectURL(fetched.blob)
          const a = document.createElement('a')
          a.href = url
          a.download = name
          document.body.appendChild(a)
          a.click()
          document.body.removeChild(a)
          URL.revokeObjectURL(url)
          setError('This file type can’t be previewed in-browser — downloaded instead.')
          return
        }
        setPreview({
          requirementId: req.id,
          title: req.label,
          fileName: name,
          contentType: type,
          blobUrl: URL.createObjectURL(fetched.blob),
          externalUrl: null,
        })
        return
      }

      if (req.fileUrl?.startsWith('http')) {
        if (canInlinePreview(contentType, displayFileName)) {
          setPreview({
            requirementId: req.id,
            title: req.label,
            fileName: displayFileName,
            contentType,
            blobUrl: null,
            externalUrl: req.fileUrl,
          })
        } else {
          window.open(req.fileUrl, '_blank', 'noopener,noreferrer')
        }
        return
      }

      throw new Error('No previewable file for this document')
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Preview failed')
    } finally {
      setBusyId(null)
    }
  }

  const hasIntakeSection = !!intakeForms
  const hasRequirementDocs = grouped.length > 0

  if (!hasRequirementDocs && !hasIntakeSection) {
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

  const previewSrc = preview?.blobUrl || preview?.externalUrl || null
  const previewIsImage =
    !!preview &&
    ((preview.contentType || '').startsWith('image/') ||
      /\.(png|jpe?g|gif|webp)$/i.test(preview.fileName))
  const previewIsText =
    !!preview &&
    ((preview.contentType || '').startsWith('text/') ||
      /\.txt$/i.test(preview.fileName))

  return (
    <div className="space-y-6">
      {error && (
        <p className="rounded-lg bg-[var(--urgent-bg)] px-3 py-2 text-sm text-[var(--urgent)]">
          {error}
        </p>
      )}

      <p className="text-sm text-quiet">
        Library of documents already on file for this client. Preview or download
        here; upload and status updates happen on the{' '}
        <strong className="font-medium text-ink">Requirements</strong> tab.
      </p>

      {intakeForms && (
        <section>
          <div className="mb-2 flex flex-wrap items-center gap-2">
            <h3 className="font-display text-base font-semibold text-ink">
              Intake forms
            </h3>
            {intakeForms.complete ? (
              <span className="rounded-md bg-[var(--green-bg)] px-2 py-0.5 text-[11px] font-medium text-[var(--green)]">
                Intake complete
              </span>
            ) : (
              <span className="rounded-md bg-[var(--amber-bg)] px-2 py-0.5 text-[11px] font-medium text-[var(--amber)]">
                Incomplete
              </span>
            )}
          </div>
          {!intakeForms.complete && intakeForms.missingRequired.length > 0 && (
            <p className="mb-2 text-xs text-quiet">
              Missing required:{' '}
              {intakeForms.missingRequired
                .map((m) => `${m.code} (${m.title})`)
                .join(', ')}
            </p>
          )}
          {intakeForms.forms.length === 0 ? (
            <div className="rounded-xl border border-dashed border-line bg-surface px-4 py-6 text-sm text-quiet">
              No kiosk intake packet submitted yet.
            </div>
          ) : (
            <ul className="divide-y divide-line rounded-xl border border-line bg-surface">
              {intakeForms.forms.map((form) => {
                const busy = busyId === form.id
                return (
                  <li key={form.id} className="px-3 py-3">
                    <div className="flex flex-wrap items-start gap-3">
                      <div className="flex min-w-0 flex-1 items-start gap-2.5">
                        <FileText className="mt-0.5 h-4 w-4 shrink-0 text-quiet" />
                        <div className="min-w-0 flex-1">
                          <div className="text-sm font-medium text-ink">
                            {form.formCode} · {form.formTitle}
                          </div>
                          <div className="mt-0.5 text-xs text-quiet">
                            Submitted{' '}
                            {new Date(form.submittedAt).toLocaleDateString()} ·{' '}
                            {form.signedByName}
                            {form.signedByRelationship
                              ? ` (${form.signedByRelationship})`
                              : ''}
                          </div>
                        </div>
                      </div>
                      <div className="flex flex-wrap items-center gap-1.5">
                        <button
                          type="button"
                          disabled={busy}
                          onClick={() =>
                            void onIntakePreview(
                              form.id,
                              form.formCode,
                              form.formTitle
                            )
                          }
                          className="inline-flex h-8 items-center gap-1 rounded-lg border border-line bg-surface px-2 text-xs font-medium text-ink hover:bg-line-2 disabled:opacity-50"
                        >
                          {busy ? (
                            <Loader2 className="h-3.5 w-3.5 animate-spin" />
                          ) : (
                            <Eye className="h-3.5 w-3.5" />
                          )}
                          View
                        </button>
                        <button
                          type="button"
                          disabled={busy}
                          onClick={() =>
                            void onIntakeDownload(
                              form.id,
                              form.formCode,
                              form.formTitle
                            )
                          }
                          className="inline-flex h-8 items-center gap-1 rounded-lg border border-line px-2 text-xs text-ink hover:bg-line-2 disabled:opacity-50"
                        >
                          <Download className="h-3.5 w-3.5" />
                          Download
                        </button>
                      </div>
                    </div>
                  </li>
                )
              })}
            </ul>
          )}
        </section>
      )}

      {grouped.map(({ group, items }) => (
        <section key={group}>
          <h3 className="mb-2 font-display text-base font-semibold text-ink">
            {DOCUMENT_GROUP_LABELS[group]}
          </h3>
          <ul className="divide-y divide-line rounded-xl border border-line bg-surface">
            {items.map((req) => {
              const hasStoredFile = isStoredRequirementPath(req.fileUrl)
              const hasHttp = !!req.fileUrl?.startsWith('http')
              const displayFileName =
                req.fileName?.trim() ||
                (hasStoredFile
                  ? req.fileUrl!.split('/').pop()
                  : req.fileUrl?.trim()) ||
                `${req.label}.pdf`
              const uploader =
                req.status === 'ON_FILE' ? req.attestedByUser : req.completedByUser
              const uploadedAt =
                req.status === 'ON_FILE' ? req.attestedAt : req.completedAt
              const busy = busyId === req.id

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
                        <div className="mt-1 text-xs text-ink break-all">
                          {displayFileName}
                          {req.fileSizeBytes ? (
                            <span className="text-quiet">
                              {' '}
                              · {formatSize(req.fileSizeBytes)}
                            </span>
                          ) : null}
                        </div>
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

                    {(hasStoredFile || hasHttp) && (
                      <div className="flex flex-wrap items-center gap-1.5">
                        <button
                          type="button"
                          disabled={busy}
                          onClick={() => void onPreview(req, displayFileName)}
                          className="inline-flex h-8 items-center gap-1 rounded-lg border border-line bg-surface px-2 text-xs font-medium text-ink hover:bg-line-2 disabled:opacity-50"
                        >
                          {busy ? (
                            <Loader2 className="h-3.5 w-3.5 animate-spin" />
                          ) : (
                            <Eye className="h-3.5 w-3.5" />
                          )}
                          Preview
                        </button>
                        <button
                          type="button"
                          disabled={busy}
                          onClick={() => void onDownload(req, displayFileName)}
                          className="inline-flex h-8 items-center gap-1 rounded-lg border border-line px-2 text-xs text-ink hover:bg-line-2 disabled:opacity-50"
                        >
                          <Download className="h-3.5 w-3.5" />
                          Download
                        </button>
                      </div>
                    )}
                  </div>
                </li>
              )
            })}
          </ul>
        </section>
      ))}

      {preview && previewSrc && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 backdrop-blur-[1px]"
          role="dialog"
          aria-modal="true"
          aria-label={`Preview ${preview.title}`}
          onClick={closePreview}
        >
          <div
            className="flex max-h-[90vh] w-full max-w-4xl flex-col overflow-hidden rounded-xl border border-line bg-surface shadow-xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center gap-3 border-b border-line px-4 py-3">
              <div className="min-w-0 flex-1">
                <div className="truncate text-sm font-semibold text-ink">
                  {preview.title}
                </div>
                <div className="truncate text-xs text-quiet">{preview.fileName}</div>
              </div>
              <button
                type="button"
                onClick={() => {
                  const req = requirements.find((r) => r.id === preview.requirementId)
                  if (req) void onDownload(req, preview.fileName)
                }}
                className="inline-flex h-8 items-center gap-1 rounded-lg border border-line px-2 text-xs text-ink hover:bg-line-2"
              >
                <Download className="h-3.5 w-3.5" />
                Download
              </button>
              <button
                type="button"
                onClick={closePreview}
                className="inline-flex h-8 w-8 items-center justify-center rounded-lg border border-line text-ink hover:bg-line-2"
                aria-label="Close preview"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
            <div className="min-h-0 flex-1 overflow-auto bg-[var(--bg)] p-3">
              {previewIsImage ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={previewSrc}
                  alt={preview.title}
                  className="mx-auto max-h-[75vh] max-w-full object-contain"
                />
              ) : previewIsText ? (
                <iframe
                  title={preview.title}
                  src={previewSrc}
                  className="h-[75vh] w-full rounded-lg border border-line bg-white"
                />
              ) : (
                <iframe
                  title={preview.title}
                  src={previewSrc}
                  className="h-[75vh] w-full rounded-lg border border-line bg-white"
                />
              )}
            </div>
          </div>
        </div>
      )}

      {intakePreview && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 backdrop-blur-[1px]"
          role="dialog"
          aria-modal="true"
          aria-label={`View ${intakePreview.title}`}
          onClick={closeIntakePreview}
        >
          <div
            className="flex max-h-[90vh] w-full max-w-4xl flex-col overflow-hidden rounded-xl border border-line bg-surface shadow-xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center gap-3 border-b border-line px-4 py-3">
              <div className="min-w-0 flex-1">
                <div className="truncate text-sm font-semibold text-ink">
                  {intakePreview.title}
                </div>
                <div className="truncate text-xs text-quiet">
                  {intakePreview.fileName}
                </div>
              </div>
              <button
                type="button"
                onClick={() =>
                  void onIntakeDownload(
                    intakePreview.id,
                    intakePreview.fileName.split('_')[0] || 'form',
                    intakePreview.title
                  )
                }
                className="inline-flex h-8 items-center gap-1 rounded-lg border border-line px-2 text-xs text-ink hover:bg-line-2"
              >
                <Download className="h-3.5 w-3.5" />
                Download
              </button>
              <button
                type="button"
                onClick={closeIntakePreview}
                className="inline-flex h-8 w-8 items-center justify-center rounded-lg border border-line text-ink hover:bg-line-2"
                aria-label="Close preview"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
            <div className="min-h-0 flex-1 overflow-auto bg-[var(--bg)] p-3">
              <iframe
                title={intakePreview.title}
                src={intakePreview.blobUrl}
                className="h-[75vh] w-full rounded-lg border border-line bg-white"
              />
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
