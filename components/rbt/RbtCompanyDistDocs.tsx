'use client'

import { useCallback, useEffect, useState } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { Label } from '@/components/ui/label'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { FileText, Loader2 } from 'lucide-react'
import { useToast } from '@/components/ui/toast'
import OnboardingPdfViewer from '@/components/onboarding/OnboardingPdfViewer'

type Assignment = {
  recipientId: string
  documentId: string
  title: string
  description: string | null
  fileType: string
  documentType: 'ACKNOWLEDGMENT' | 'DOWNLOAD_UPLOAD' | 'VIEW_ONLY'
  isTest: boolean
  status: string
  signedName: string | null
  signedAt: string | null
  viewedAt: string | null
  submittedAt: string | null
  createdAt: string
  previewUrl: string
}

const actionLabel: Record<string, string> = {
  ACKNOWLEDGMENT: 'Review & Sign',
  DOWNLOAD_UPLOAD: 'Download & upload',
  VIEW_ONLY: 'View document',
}

/** Fetch file bytes with session cookies; never use the API URL inside an iframe. */
async function fetchAsTypedBlob(path: string, fallbackType: string): Promise<Blob> {
  const res = await fetch(path, { credentials: 'include' })
  if (!res.ok) {
    const err = await res.json().catch(() => ({}))
    throw new Error(typeof err.error === 'string' ? err.error : 'Failed to load document')
  }
  const ct = res.headers.get('content-type') || ''
  if (ct.includes('text/html')) {
    throw new Error('Document endpoint returned HTML instead of a file')
  }
  const buf = await res.arrayBuffer()
  const type =
    ct.startsWith('application/pdf') || ct.startsWith('image/')
      ? ct.split(';')[0].trim()
      : fallbackType
  return new Blob([buf], { type })
}

export default function RbtCompanyDistDocs({ search }: { search: string }) {
  const { showToast } = useToast()
  const [items, setItems] = useState<Assignment[]>([])
  const [loading, setLoading] = useState(true)
  const [active, setActive] = useState<Assignment | null>(null)
  const [pngSrc, setPngSrc] = useState<string | null>(null)
  const [pngLoading, setPngLoading] = useState(false)
  const [signedName, setSignedName] = useState('')
  const [saving, setSaving] = useState(false)
  const [uploadFile, setUploadFile] = useState<File | null>(null)

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const res = await fetch('/api/rbt/documents/company', { credentials: 'include' })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error(data.error || 'Failed')
      setItems(data.assignments ?? [])
    } catch {
      setItems([])
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    void load()
  }, [load])

  useEffect(() => {
    return () => {
      if (pngSrc) URL.revokeObjectURL(pngSrc)
    }
  }, [pngSrc])

  const filtered = items.filter((d) => {
    if (!search.trim()) return true
    return d.title.toLowerCase().includes(search.trim().toLowerCase())
  })

  const closeDialog = () => {
    if (saving) return
    setActive(null)
    setSignedName('')
    setUploadFile(null)
    if (pngSrc) {
      URL.revokeObjectURL(pngSrc)
      setPngSrc(null)
    }
  }

  const openDoc = async (a: Assignment) => {
    setActive(a)
    setSignedName('')
    setUploadFile(null)
    if (pngSrc) {
      URL.revokeObjectURL(pngSrc)
      setPngSrc(null)
    }

    // Mark viewed (non-blocking for preview)
    void fetch(`/api/rbt/documents/company/${a.documentId}/view`, {
      method: 'POST',
      credentials: 'include',
    }).then(() => load())

    // PNGs: blob → <img>. PDFs: OnboardingPdfViewer (PDF.js / canvas) — same as onboarding.
    if (a.fileType === 'png') {
      setPngLoading(true)
      try {
        const blob = await fetchAsTypedBlob(a.previewUrl, 'image/png')
        setPngSrc(URL.createObjectURL(blob))
      } catch (e) {
        showToast(e instanceof Error ? e.message : 'Could not load preview', 'error')
      } finally {
        setPngLoading(false)
      }
    }
  }

  const handleDownload = async () => {
    if (!active) return
    try {
      const mime = active.fileType === 'png' ? 'image/png' : 'application/pdf'
      const blob = await fetchAsTypedBlob(active.previewUrl, mime)
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `${active.title}.${active.fileType}`
      document.body.appendChild(a)
      a.click()
      a.remove()
      URL.revokeObjectURL(url)
    } catch {
      showToast('Download failed', 'error')
    }
  }

  const handleSign = async () => {
    if (!active) return
    setSaving(true)
    try {
      const res = await fetch(`/api/rbt/documents/company/${active.documentId}/sign`, {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ signedName }),
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) {
        showToast(data.error || 'Sign failed', 'error')
        return
      }
      showToast('Document signed', 'success')
      closeDialog()
      await load()
    } catch {
      showToast('Sign failed', 'error')
    } finally {
      setSaving(false)
    }
  }

  const handleUpload = async () => {
    if (!active || !uploadFile) {
      showToast('Choose a file to upload', 'error')
      return
    }
    setSaving(true)
    try {
      const form = new FormData()
      form.set('file', uploadFile)
      const res = await fetch(`/api/rbt/documents/company/${active.documentId}/upload`, {
        method: 'POST',
        credentials: 'include',
        body: form,
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) {
        showToast(data.error || 'Upload failed', 'error')
        return
      }
      showToast('Completed file submitted', 'success')
      closeDialog()
      await load()
    } catch {
      showToast('Upload failed', 'error')
    } finally {
      setSaving(false)
    }
  }

  if (loading) {
    return (
      <div className="flex justify-center py-8">
        <Loader2 className="h-5 w-5 animate-spin text-gray-400" />
      </div>
    )
  }

  if (filtered.length === 0) {
    return (
      <p className="text-center py-6 text-sm text-gray-500 dark:text-[var(--text-tertiary)]">
        No distributed company documents assigned to you.
      </p>
    )
  }

  return (
    <>
      <ul className="space-y-3">
        {filtered.map((doc) => (
          <li
            key={doc.recipientId}
            className="flex flex-wrap items-center justify-between gap-4 p-3 rounded-lg border dark:border-[var(--border-subtle)] hover:bg-gray-50 dark:hover:bg-[var(--bg-elevated-hover)]"
          >
            <div className="flex items-start gap-3 min-w-0 flex-1">
              <div className="w-14 h-16 rounded border bg-orange-50 dark:bg-orange-950/20 flex items-center justify-center shrink-0">
                <FileText className="w-6 h-6 text-[#e36f1e]" />
              </div>
              <div className="min-w-0">
                <div className="flex flex-wrap items-center gap-2">
                  <p className="font-medium truncate">{doc.title}</p>
                  {doc.isTest && (
                    <Badge variant="outline" className="border-amber-400 text-amber-700 text-[10px]">
                      TEST
                    </Badge>
                  )}
                  <Badge variant="secondary">{doc.status}</Badge>
                </div>
                <p className="text-xs text-gray-500 mt-1">
                  {actionLabel[doc.documentType]}
                  {doc.description ? ` · ${doc.description}` : ''}
                </p>
              </div>
            </div>
            <Button
              variant="outline"
              size="sm"
              onClick={() => void openDoc(doc)}
              className="shrink-0"
            >
              {doc.documentType === 'ACKNOWLEDGMENT' && doc.status !== 'SIGNED'
                ? 'Review & Sign'
                : doc.documentType === 'DOWNLOAD_UPLOAD' && doc.status !== 'SUBMITTED'
                  ? 'Open'
                  : 'View'}
            </Button>
          </li>
        ))}
      </ul>

      <Dialog open={!!active} onOpenChange={(o) => !o && closeDialog()}>
        <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{active?.title}</DialogTitle>
            <DialogDescription>
              {active ? actionLabel[active.documentType] : ''}
            </DialogDescription>
          </DialogHeader>
          {active && (
            <div className="space-y-4">
              {/*
                PDFs: same OnboardingPdfViewer as onboarding (fetch + PDF.js canvas).
                Never iframe a same-origin /api URL (X-Frame-Options: DENY).
              */}
              {active.fileType === 'png' ? (
                <div className="w-full min-h-[40vh] rounded border bg-gray-50 dark:bg-gray-900 flex items-center justify-center overflow-auto p-2">
                  {pngLoading ? (
                    <Loader2 className="h-8 w-8 animate-spin text-gray-400" />
                  ) : pngSrc ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={pngSrc}
                      alt={active.title}
                      className="w-full h-auto max-h-[70vh] object-contain"
                    />
                  ) : (
                    <p className="text-sm text-gray-500">Preview unavailable</p>
                  )}
                </div>
              ) : (
                <OnboardingPdfViewer
                  key={active.documentId}
                  documentId={active.documentId}
                  pdfUrl={active.previewUrl}
                  title={active.title}
                />
              )}

              {active.documentType === 'ACKNOWLEDGMENT' && active.status !== 'SIGNED' && (
                <div className="space-y-2 border-t pt-4">
                  <Label htmlFor="sign-name">Type your full name to acknowledge</Label>
                  <Input
                    id="sign-name"
                    value={signedName}
                    onChange={(e) => setSignedName(e.target.value)}
                    placeholder="First Last"
                  />
                  <Button
                    disabled={saving}
                    onClick={() => void handleSign()}
                    className="bg-orange-500 hover:bg-orange-600 text-white"
                  >
                    {saving ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : null}
                    Sign & acknowledge
                  </Button>
                </div>
              )}

              {active.documentType === 'DOWNLOAD_UPLOAD' && active.status !== 'SUBMITTED' && (
                <div className="space-y-2 border-t pt-4">
                  <Button variant="outline" type="button" onClick={() => void handleDownload()}>
                    Download original
                  </Button>
                  <div className="space-y-2">
                    <Label htmlFor="submit-file">Upload completed file</Label>
                    <Input
                      id="submit-file"
                      type="file"
                      onChange={(e) => setUploadFile(e.target.files?.[0] ?? null)}
                    />
                  </div>
                  <Button
                    disabled={saving}
                    onClick={() => void handleUpload()}
                    className="bg-orange-500 hover:bg-orange-600 text-white"
                  >
                    {saving ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : null}
                    Submit completed file
                  </Button>
                </div>
              )}

              {(active.status === 'SIGNED' || active.status === 'SUBMITTED' || active.status === 'VIEWED') &&
                active.documentType !== 'DOWNLOAD_UPLOAD' && (
                  <p className="text-sm text-green-700">Status: {active.status}</p>
                )}
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" disabled={saving} onClick={closeDialog}>
              Close
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  )
}
