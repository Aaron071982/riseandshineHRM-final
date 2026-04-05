'use client'

import { useState, useCallback } from 'react'
import { Dancing_Script } from 'next/font/google'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Label } from '@/components/ui/label'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { FileText, Download, Trash2, Upload, Loader2, FileArchive, ScrollText } from 'lucide-react'
import { useToast } from '@/components/ui/toast'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { ADMIN_RBT_DOCUMENT_TYPES, formatRbtDocumentTypeLabel } from '@/lib/rbtDocumentTypes'
import { formatUserAgentShort } from '@/lib/user-agent-short'
import { LEGAL_BASIS } from '@/lib/signature-certificate'
import { getAcknowledgmentAdminSummary } from '@/lib/acknowledgment-admin-summary'
import type { RBTProfileDocument, RBTProfileOnboardingCompletion } from './types'

const dancingScript = Dancing_Script({ weight: '400', subsets: ['latin'] })

interface RBTProfileDocumentsProps {
  rbtProfileId: string
  rbtName: string
  documents: RBTProfileDocument[]
  onboardingCompletions?: RBTProfileOnboardingCompletion[]
  uploadingDocuments: boolean
  uploadDisabled?: boolean
  /** Called after the admin picks files; `documentType` is the selected category for this batch. */
  onFilesSelected: (files: File[], documentType: string) => void
  onDownload: (documentId: string, fileName: string) => void
  onDelete: (documentId: string, fileName: string) => void
  onRequestReupload?: (completionId: string) => Promise<void>
}

export default function RBTProfileDocuments({
  rbtProfileId,
  rbtName,
  documents,
  onboardingCompletions = [],
  uploadingDocuments,
  uploadDisabled,
  onFilesSelected,
  onDownload,
  onDelete,
  onRequestReupload,
}: RBTProfileDocumentsProps) {
  const [uploadDocType, setUploadDocType] = useState('OTHER')
  const [reuploadingId, setReuploadingId] = useState<string | null>(null)
  const [downloadingZip, setDownloadingZip] = useState(false)
  const { showToast } = useToast()

  const handleAdminFileInput = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || [])
    e.target.value = ''
    if (files.length === 0) return
    onFilesSelected(files, uploadDocType)
  }
  const completedWithPdf = onboardingCompletions.filter(
    (c) =>
      c.status === 'COMPLETED' &&
      c.document.type === 'FILLABLE_PDF' &&
      (Boolean(c.signedPdfUrl?.trim()) || Boolean(c.hasSignedPdfData))
  )
  const completedAcknowledgments = onboardingCompletions.filter(
    (c) => c.status === 'COMPLETED' && c.document.type === 'ACKNOWLEDGMENT'
  )

  const [certModalOpen, setCertModalOpen] = useState(false)
  const [certLoading, setCertLoading] = useState(false)
  const [certCompletionId, setCertCompletionId] = useState<string | null>(null)
  const [certData, setCertData] = useState<{
    documentTitle: string
    signerFullName: string
    signerEmail: string | null
    signatureText: string | null
    signatureTimestamp: string
    signerIpAddress: string | null
    signerUserAgent: string | null
    documentHash: string
    certificateJson: Record<string, unknown>
  } | null>(null)

  const openCertificate = useCallback(
    async (completionId: string) => {
      setCertCompletionId(completionId)
      setCertLoading(true)
      setCertModalOpen(true)
      setCertData(null)
      try {
        const res = await fetch(
          `/api/admin/rbts/${rbtProfileId}/completions/${completionId}/certificate`,
          { credentials: 'include' }
        )
        const body = await res.json().catch(() => ({}))
        if (!res.ok) {
          showToast(body.error || 'No certificate found', 'error')
          setCertModalOpen(false)
          setCertCompletionId(null)
          return
        }
        const c = body.certificate
        setCertData({
          documentTitle: c.documentTitle,
          signerFullName: c.signerFullName,
          signerEmail: c.signerEmail,
          signatureText: c.signatureText,
          signatureTimestamp: c.signatureTimestamp,
          signerIpAddress: c.signerIpAddress,
          signerUserAgent: c.signerUserAgent,
          documentHash: c.documentHash,
          certificateJson: (c.certificateJson || {}) as Record<string, unknown>,
        })
      } catch {
        showToast('Failed to load certificate', 'error')
        setCertModalOpen(false)
      } finally {
        setCertLoading(false)
      }
    },
    [rbtProfileId, showToast]
  )

  const handleDownloadAll = async () => {
    setDownloadingZip(true)
    try {
      const res = await fetch(`/api/admin/rbts/${rbtProfileId}/documents/zip`, { credentials: 'include' })
      if (!res.ok) {
        const data = await res.json().catch(() => ({}))
        throw new Error(data.error || `Download failed (${res.status})`)
      }
      const blob = await res.blob()
      const disposition = res.headers.get('Content-Disposition')
      const match = disposition?.match(/filename="?([^";]+)"?/)
      const filename = match?.[1] ?? `documents-${rbtName.replace(/\s+/g, '-')}-${Date.now()}.zip`
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = filename
      document.body.appendChild(a)
      a.click()
      document.body.removeChild(a)
      URL.revokeObjectURL(url)
      showToast('Download started', 'success')
    } catch (e) {
      showToast(e instanceof Error ? e.message : 'Failed to download', 'error')
    } finally {
      setDownloadingZip(false)
    }
  }

  const handleRequestReupload = async (completionId: string) => {
    if (!onRequestReupload) return
    setReuploadingId(completionId)
    try {
      await onRequestReupload(completionId)
    } finally {
      setReuploadingId(null)
    }
  }

  const auditEvents = Array.isArray(certData?.certificateJson?.auditTrail)
    ? (certData!.certificateJson.auditTrail as Array<{ action?: string; timestamp?: string }>)
    : []

  return (
    <Card className="border border-gray-200 dark:border-[var(--border-subtle)] bg-white dark:bg-[var(--bg-elevated)]">
      <CardHeader>
        <CardTitle className="text-2xl font-bold text-gray-900 dark:text-[var(--text-primary)]">Documents</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <Dialog open={certModalOpen} onOpenChange={setCertModalOpen}>
          <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <ScrollText className="w-5 h-5 text-orange-600" />
                Signature certificate
              </DialogTitle>
            </DialogHeader>
            {certLoading ? (
              <div className="flex justify-center py-12">
                <Loader2 className="w-8 h-8 animate-spin text-orange-600" />
              </div>
            ) : certData ? (
              <div className="space-y-4 text-sm">
                <p className="font-semibold text-gray-900 dark:text-[var(--text-primary)]">{certData.documentTitle}</p>
                <p className="text-green-700 dark:text-green-400 font-medium">Electronically signed</p>
                <div className="space-y-1 text-gray-700 dark:text-[var(--text-secondary)]">
                  <p>
                    <span className="text-gray-500">Signer:</span> {certData.signerFullName}
                  </p>
                  <p>
                    <span className="text-gray-500">Email:</span> {certData.signerEmail ?? '—'}
                  </p>
                  <p>
                    <span className="text-gray-500">Signed:</span>{' '}
                    {new Date(certData.signatureTimestamp).toLocaleString('en-US', {
                      timeZone: 'America/New_York',
                      dateStyle: 'long',
                      timeStyle: 'short',
                    })}{' '}
                    EST
                  </p>
                  <p>
                    <span className="text-gray-500">IP address:</span> {certData.signerIpAddress ?? '—'}
                  </p>
                  <p>
                    <span className="text-gray-500">Device:</span>{' '}
                    {formatUserAgentShort(certData.signerUserAgent)}
                  </p>
                </div>
                <div>
                  <p className="text-gray-500 text-xs mb-1">Signature</p>
                  <p className={`text-2xl ${dancingScript.className}`}>{certData.signatureText ?? '—'}</p>
                </div>
                <div>
                  <p className="text-gray-500 text-xs mb-1">Document hash</p>
                  <p className="font-mono text-xs break-all">{certData.documentHash}</p>
                </div>
                <div>
                  <p className="text-gray-500 text-xs mb-1">Legal basis</p>
                  <p className="text-xs">{LEGAL_BASIS}</p>
                </div>
                {auditEvents.length > 0 ? (
                  <div>
                    <p className="font-medium text-gray-900 dark:text-[var(--text-primary)] mb-2">Audit trail</p>
                    <ul className="space-y-1 text-xs text-gray-600 dark:text-[var(--text-tertiary)]">
                      {auditEvents.map((ev, i) => (
                        <li key={i}>
                          {ev.timestamp
                            ? new Date(ev.timestamp).toLocaleString('en-US', {
                                timeZone: 'America/New_York',
                                timeStyle: 'short',
                              })
                            : ''}{' '}
                          — {ev.action ?? 'event'}
                        </li>
                      ))}
                    </ul>
                  </div>
                ) : null}
                {certCompletionId ? (
                  <Button asChild className="w-full bg-[#e36f1e] hover:bg-[#c85e18]">
                    <a
                      href={`/api/admin/rbts/${rbtProfileId}/completions/${certCompletionId}/certificate?format=pdf`}
                      target="_blank"
                      rel="noopener noreferrer"
                    >
                      Download certificate PDF
                    </a>
                  </Button>
                ) : null}
              </div>
            ) : null}
          </DialogContent>
        </Dialog>
        {(documents.length > 0 || completedWithPdf.length > 0 || completedAcknowledgments.length > 0) && (
          <div className="flex justify-end">
            <Button
              variant="outline"
              size="sm"
              disabled={downloadingZip}
              onClick={handleDownloadAll}
              className="text-orange-600 border-orange-200 hover:bg-orange-50 dark:border-[var(--orange-primary)] dark:text-[var(--orange-primary)] dark:hover:bg-[var(--orange-subtle)]"
            >
              {downloadingZip ? (
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
              ) : (
                <FileArchive className="w-4 h-4 mr-2" />
              )}
              Download All Documents
            </Button>
          </div>
        )}
        <div className="space-y-3">
          <div className="space-y-2">
            <Label htmlFor="admin-doc-type" className="text-sm text-gray-700 dark:text-[var(--text-secondary)]">
              Document type (applies to this upload)
            </Label>
            <Select value={uploadDocType} onValueChange={setUploadDocType} disabled={uploadingDocuments || uploadDisabled}>
              <SelectTrigger id="admin-doc-type" className="max-w-md">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {ADMIN_RBT_DOCUMENT_TYPES.map((opt) => (
                  <SelectItem key={opt.value} value={opt.value}>
                    {opt.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <label
            htmlFor="document-upload"
            className="flex items-center gap-2 px-4 py-2 border-2 border-dashed border-gray-300 dark:border-[var(--border-subtle)] rounded-lg cursor-pointer hover:bg-gray-50 dark:hover:bg-[var(--bg-elevated-hover)] transition-colors"
          >
            <Upload className="w-5 h-5 text-gray-400 dark:text-[var(--text-disabled)]" />
            <span className="text-sm font-medium text-gray-700 dark:text-[var(--text-secondary)]">
              {uploadingDocuments ? 'Uploading...' : 'Choose files to upload'}
            </span>
          </label>
          <input
            id="document-upload"
            type="file"
            multiple
            onChange={handleAdminFileInput}
            className="hidden"
            accept=".pdf,.doc,.docx,.jpg,.jpeg,.png"
            disabled={uploadingDocuments || uploadDisabled}
          />
          <p className="text-xs text-gray-500 dark:text-[var(--text-disabled)]">
            Upload on behalf of this RBT (PDF, DOC, DOCX, JPG, PNG). They will also see these under Document Center.
          </p>
        </div>

        {documents.length > 0 ? (
          <div className="space-y-2">
            {documents.map((doc) => (
              <div
                key={doc.id}
                className="flex items-center gap-3 p-3 bg-white dark:bg-[var(--bg-elevated)] rounded-lg border border-gray-200 dark:border-[var(--border-subtle)] hover:shadow-md dark:hover:bg-[var(--bg-elevated-hover)] transition-shadow"
              >
                <FileText className="w-5 h-5 text-orange-500 dark:text-[var(--orange-primary)] flex-shrink-0" />
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-gray-900 dark:text-[var(--text-primary)] truncate">
                    {doc.fileName}
                  </p>
                  <div className="flex items-center gap-2 mt-1">
                    <Badge variant="outline" className="text-xs dark:border-[var(--border-subtle)] dark:text-[var(--text-secondary)]">
                      {formatRbtDocumentTypeLabel(doc.documentType)}
                    </Badge>
                    <span className="text-xs text-gray-500 dark:text-[var(--text-disabled)]">
                      {new Date(doc.uploadedAt).toLocaleDateString()}
                    </span>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => onDownload(doc.id, doc.fileName)}
                    className="text-orange-600 hover:text-orange-700 hover:bg-orange-50 dark:border-[var(--border-subtle)] dark:text-[var(--orange-primary)] dark:hover:bg-[var(--bg-elevated-hover)]"
                  >
                    <Download className="w-4 h-4 mr-1" />
                    Download
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => onDelete(doc.id, doc.fileName)}
                    className="text-red-600 hover:text-red-700 hover:bg-red-50 dark:text-[var(--status-rejected-text)] dark:hover:bg-[var(--status-rejected-bg)]"
                  >
                    <Trash2 className="w-4 h-4" />
                  </Button>
                </div>
              </div>
            ))}
          </div>
        ) : null}

        {completedAcknowledgments.length > 0 ? (
          <div className="space-y-2 pt-4 border-t dark:border-[var(--border-subtle)]">
            <p className="text-sm font-medium text-gray-700 dark:text-[var(--text-secondary)]">
              Acknowledgment documents (e-sign)
            </p>
            {completedAcknowledgments.map((c) => (
              <div
                key={c.id}
                className="flex flex-wrap items-center gap-3 p-3 bg-white dark:bg-[var(--bg-elevated)] rounded-lg border border-gray-200 dark:border-[var(--border-subtle)]"
              >
                <FileText className="w-5 h-5 text-orange-500 shrink-0" />
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-gray-900 dark:text-[var(--text-primary)] truncate">
                    {c.document.title}
                  </p>
                  {c.completedAt ? (
                    <span className="text-xs text-gray-500">
                      {new Date(c.completedAt).toLocaleDateString('en-US', { timeZone: 'America/New_York' })}
                    </span>
                  ) : null}
                  {(() => {
                    const { topic, attestation } = getAcknowledgmentAdminSummary({
                      documentTitle: c.document.title,
                      documentSlug: c.document.slug,
                      acknowledgmentJson: c.acknowledgmentJson,
                    })
                    return (
                      <div className="mt-2 rounded-md border border-gray-200 dark:border-[var(--border-subtle)] bg-gray-50/80 dark:bg-[var(--bg-input)] p-2.5 space-y-1.5">
                        <p className="text-[11px] font-semibold uppercase tracking-wide text-gray-500 dark:text-[var(--text-disabled)]">
                          Summary
                        </p>
                        <p className="text-xs text-gray-700 dark:text-[var(--text-secondary)] leading-snug">
                          <span className="font-medium text-gray-800 dark:text-[var(--text-primary)]">Reviewed: </span>
                          {topic}
                        </p>
                        <p className="text-xs text-gray-700 dark:text-[var(--text-secondary)] leading-snug">
                          <span className="font-medium text-gray-800 dark:text-[var(--text-primary)]">Agreed: </span>
                          {attestation}
                        </p>
                      </div>
                    )
                  })()}
                </div>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className="text-orange-600 border-orange-200 shrink-0"
                  onClick={() => void openCertificate(c.id)}
                >
                  <ScrollText className="w-4 h-4 mr-1" />
                  View certificate
                </Button>
              </div>
            ))}
          </div>
        ) : null}

        {completedWithPdf.length > 0 ? (
          <div className="space-y-2 pt-4 border-t dark:border-[var(--border-subtle)]">
            <p className="text-sm font-medium text-gray-700 dark:text-[var(--text-secondary)]">
              Onboarding documents (signed/uploaded)
            </p>
            {completedWithPdf.map((c) => (
              <div
                key={c.id}
                className="flex items-center gap-3 p-3 bg-white dark:bg-[var(--bg-elevated)] rounded-lg border border-gray-200 dark:border-[var(--border-subtle)] hover:shadow-md dark:hover:bg-[var(--bg-elevated-hover)] transition-shadow"
              >
                <FileText className="w-5 h-5 text-orange-500 dark:text-[var(--orange-primary)] flex-shrink-0" />
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-gray-900 dark:text-[var(--text-primary)] truncate">
                    {c.document.title}
                  </p>
                  <div className="flex items-center gap-2 mt-1">
                    <Badge variant="outline" className="text-xs dark:border-[var(--border-subtle)] dark:text-[var(--text-secondary)]">
                      {c.status}
                    </Badge>
                    {c.completedAt && (
                      <span className="text-xs text-gray-500 dark:text-[var(--text-disabled)]">
                        {new Date(c.completedAt).toLocaleDateString()}
                      </span>
                    )}
                  </div>
                </div>
                <div className="flex flex-wrap items-center gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    asChild
                    className="text-orange-600 hover:text-orange-700 hover:bg-orange-50 dark:border-[var(--border-subtle)] dark:text-[var(--orange-primary)] dark:hover:bg-[var(--bg-elevated-hover)]"
                  >
                    <a
                      href={`/api/admin/rbts/${rbtProfileId}/documents/completion/${c.id}/download`}
                      download={`${c.document.title.replace(/\W+/g, '_')}.pdf`}
                    >
                      <Download className="w-4 h-4 mr-1" />
                      Download
                    </a>
                  </Button>
                  {c.hasSignatureCertificate ? (
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      className="text-orange-600 border-orange-200 shrink-0"
                      onClick={() => void openCertificate(c.id)}
                    >
                      <ScrollText className="w-4 h-4 mr-1" />
                      View certificate
                    </Button>
                  ) : null}
                  {onRequestReupload && (
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => handleRequestReupload(c.id)}
                      disabled={reuploadingId === c.id}
                      className="text-amber-600 hover:text-amber-700 hover:bg-amber-50 dark:border-amber-600 dark:text-amber-400 dark:hover:bg-amber-950/30"
                    >
                      {reuploadingId === c.id ? (
                        <Loader2 className="w-4 h-4 animate-spin" />
                      ) : (
                        'Request Re-upload'
                      )}
                    </Button>
                  )}
                </div>
              </div>
            ))}
          </div>
        ) : null}

        {documents.length === 0 && completedWithPdf.length === 0 && completedAcknowledgments.length === 0 ? (
          <div className="text-center py-8 text-gray-500 dark:text-[var(--text-tertiary)]">
            <FileText className="w-12 h-12 mx-auto mb-2 text-gray-300 dark:text-[var(--text-disabled)]" />
            <p className="text-sm">No documents uploaded yet</p>
          </div>
        ) : null}
      </CardContent>
    </Card>
  )
}
