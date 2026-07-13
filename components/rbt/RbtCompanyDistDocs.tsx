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

export default function RbtCompanyDistDocs({ search }: { search: string }) {
  const { showToast } = useToast()
  const [items, setItems] = useState<Assignment[]>([])
  const [loading, setLoading] = useState(true)
  const [active, setActive] = useState<Assignment | null>(null)
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

  const filtered = items.filter((d) => {
    if (!search.trim()) return true
    return d.title.toLowerCase().includes(search.trim().toLowerCase())
  })

  const openDoc = async (a: Assignment) => {
    setActive(a)
    setSignedName('')
    setUploadFile(null)
    try {
      await fetch(`/api/rbt/documents/company/${a.documentId}/view`, {
        method: 'POST',
        credentials: 'include',
      })
      await load()
    } catch {
      /* ignore */
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
      setActive(null)
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
      setActive(null)
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
              <div className="w-14 h-16 rounded border bg-white overflow-hidden shrink-0 flex items-center justify-center">
                {doc.fileType === 'png' ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={doc.previewUrl} alt="" className="w-full h-full object-cover" />
                ) : (
                  <iframe src={doc.previewUrl} title="" className="w-[200%] h-[200%] scale-50 origin-top-left pointer-events-none" />
                )}
              </div>
              <div className="min-w-0">
                <div className="flex flex-wrap items-center gap-2">
                  <FileText className="w-4 h-4 text-[#e36f1e] shrink-0" />
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

      <Dialog open={!!active} onOpenChange={(o) => !saving && !o && setActive(null)}>
        <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{active?.title}</DialogTitle>
            <DialogDescription>
              {active ? actionLabel[active.documentType] : ''}
            </DialogDescription>
          </DialogHeader>
          {active && (
            <div className="space-y-4">
              {active.fileType === 'png' ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={active.previewUrl} alt={active.title} className="w-full rounded border" />
              ) : (
                <iframe
                  src={active.previewUrl}
                  title={active.title}
                  className="w-full min-h-[50vh] rounded border"
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
                  <Button disabled={saving} onClick={() => void handleSign()} className="bg-orange-500 hover:bg-orange-600 text-white">
                    {saving ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : null}
                    Sign & acknowledge
                  </Button>
                </div>
              )}

              {active.documentType === 'DOWNLOAD_UPLOAD' && active.status !== 'SUBMITTED' && (
                <div className="space-y-2 border-t pt-4">
                  <Button variant="outline" asChild>
                    <a href={active.previewUrl} download={`${active.title}.${active.fileType}`}>
                      Download original
                    </a>
                  </Button>
                  <div className="space-y-2">
                    <Label htmlFor="submit-file">Upload completed file</Label>
                    <Input
                      id="submit-file"
                      type="file"
                      onChange={(e) => setUploadFile(e.target.files?.[0] ?? null)}
                    />
                  </div>
                  <Button disabled={saving} onClick={() => void handleUpload()} className="bg-orange-500 hover:bg-orange-600 text-white">
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
            <Button variant="outline" disabled={saving} onClick={() => setActive(null)}>
              Close
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  )
}
