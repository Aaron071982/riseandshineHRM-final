'use client'

import { useState } from 'react'
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
import { FileText, Download, Trash2, Upload, Loader2, FileArchive } from 'lucide-react'
import { useToast } from '@/components/ui/toast'
import { ADMIN_RBT_DOCUMENT_TYPES, formatRbtDocumentTypeLabel } from '@/lib/rbtDocumentTypes'
import type { RBTProfileDocument, RBTProfileOnboardingCompletion } from './types'

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
    (c) => c.status === 'COMPLETED' && c.signedPdfUrl
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

  return (
    <Card className="border border-gray-200 dark:border-[var(--border-subtle)] bg-white dark:bg-[var(--bg-elevated)]">
      <CardHeader>
        <CardTitle className="text-2xl font-bold text-gray-900 dark:text-[var(--text-primary)]">Documents</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {(documents.length > 0 || completedWithPdf.length > 0) && (
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
                <div className="flex items-center gap-2">
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

        {documents.length === 0 && completedWithPdf.length === 0 ? (
          <div className="text-center py-8 text-gray-500 dark:text-[var(--text-tertiary)]">
            <FileText className="w-12 h-12 mx-auto mb-2 text-gray-300 dark:text-[var(--text-disabled)]" />
            <p className="text-sm">No documents uploaded yet</p>
          </div>
        ) : null}
      </CardContent>
    </Card>
  )
}
