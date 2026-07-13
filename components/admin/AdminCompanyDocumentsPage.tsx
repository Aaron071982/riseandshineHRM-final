'use client'

import { useCallback, useEffect, useState } from 'react'
import Link from 'next/link'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Badge } from '@/components/ui/badge'
import { Checkbox } from '@/components/ui/checkbox'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { useToast } from '@/components/ui/toast'
import { FileText, Loader2, Plus, RefreshCw } from 'lucide-react'

type DocListItem = {
  id: string
  title: string
  description: string | null
  fileType: string
  documentType: string
  isActive: boolean
  isTest: boolean
  createdAt: string
  uploadedBy: { name: string | null; email: string | null }
  recipientCount: number
  counts: { PENDING: number; VIEWED: number; SIGNED: number; SUBMITTED: number }
}

type DetailRecipient = {
  id: string
  status: string
  signedName: string | null
  signedAt: string | null
  viewedAt: string | null
  submittedAt: string | null
  emailSentAt: string | null
  rbt: { id: string; name: string; email: string | null }
}

export default function AdminCompanyDocumentsPage() {
  const { showToast } = useToast()
  const [filter, setFilter] = useState<'live' | 'test' | 'all'>('live')
  const [docs, setDocs] = useState<DocListItem[]>([])
  const [loading, setLoading] = useState(true)
  const [uploadOpen, setUploadOpen] = useState(false)
  const [saving, setSaving] = useState(false)
  const [detailId, setDetailId] = useState<string | null>(null)
  const [detail, setDetail] = useState<{
    title: string
    isTest: boolean
    documentType: string
    counts: DocListItem['counts']
    recipients: DetailRecipient[]
  } | null>(null)
  const [resending, setResending] = useState(false)

  const [title, setTitle] = useState('')
  const [description, setDescription] = useState('')
  const [documentType, setDocumentType] = useState('ACKNOWLEDGMENT')
  const [isTest, setIsTest] = useState(false)
  const [file, setFile] = useState<File | null>(null)

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const res = await fetch(`/api/admin/documents/company?filter=${filter}`, {
        credentials: 'include',
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) {
        showToast(data.error || 'Failed to load documents', 'error')
        return
      }
      setDocs(data.documents ?? [])
    } catch {
      showToast('Failed to load documents', 'error')
    } finally {
      setLoading(false)
    }
  }, [filter, showToast])

  useEffect(() => {
    void load()
  }, [load])

  const openDetail = async (id: string) => {
    setDetailId(id)
    setDetail(null)
    try {
      const res = await fetch(`/api/admin/documents/company/${id}`, { credentials: 'include' })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) {
        showToast(data.error || 'Failed to load detail', 'error')
        return
      }
      setDetail({
        title: data.document.title,
        isTest: data.document.isTest,
        documentType: data.document.documentType,
        counts: data.document.counts,
        recipients: data.document.recipients,
      })
    } catch {
      showToast('Failed to load detail', 'error')
    }
  }

  const handleUpload = async () => {
    if (!title.trim() || !file) {
      showToast('Title and file are required', 'error')
      return
    }
    setSaving(true)
    try {
      const form = new FormData()
      form.set('title', title.trim())
      form.set('description', description.trim())
      form.set('documentType', documentType)
      form.set('isTest', isTest ? 'true' : 'false')
      form.set('file', file)
      const res = await fetch('/api/admin/documents/company', {
        method: 'POST',
        credentials: 'include',
        body: form,
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) {
        showToast(data.error || 'Upload failed', 'error')
        return
      }
      showToast(
        isTest
          ? `Test document sent to test account (${data.document?.emailed ?? 0} emailed)`
          : `Distributed to ${data.document?.recipientCount ?? 0} RBTs (${data.document?.emailed ?? 0} emailed)`,
        'success'
      )
      setUploadOpen(false)
      setTitle('')
      setDescription('')
      setFile(null)
      setIsTest(false)
      setDocumentType('ACKNOWLEDGMENT')
      if (isTest) setFilter('test')
      else setFilter('live')
      await load()
    } catch {
      showToast('Upload failed', 'error')
    } finally {
      setSaving(false)
    }
  }

  const handleResend = async () => {
    if (!detailId) return
    setResending(true)
    try {
      const res = await fetch(`/api/admin/documents/company/${detailId}/resend`, {
        method: 'POST',
        credentials: 'include',
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) {
        showToast(data.error || 'Resend failed', 'error')
        return
      }
      showToast(`Resent to ${data.emailed ?? 0} recipient(s)`, 'success')
      await openDetail(detailId)
    } catch {
      showToast('Resend failed', 'error')
    } finally {
      setResending(false)
    }
  }

  const typeLabel: Record<string, string> = {
    ACKNOWLEDGMENT: 'Acknowledgment',
    DOWNLOAD_UPLOAD: 'Download & upload',
    VIEW_ONLY: 'View only',
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-[var(--text-primary)]">
            Company Documents
          </h1>
          <p className="text-sm text-gray-600 dark:text-[var(--text-tertiary)] mt-1">
            Distribute PDFs/PNGs to actively working RBTs — acknowledgment, download+upload, or view-only.
          </p>
        </div>
        <Button onClick={() => setUploadOpen(true)} className="bg-orange-500 hover:bg-orange-600 text-white">
          <Plus className="w-4 h-4 mr-1" /> Upload Company Document
        </Button>
      </div>

      <div className="flex flex-wrap gap-2">
        {(['live', 'test', 'all'] as const).map((f) => (
          <Button
            key={f}
            size="sm"
            variant={filter === f ? 'default' : 'outline'}
            onClick={() => setFilter(f)}
          >
            {f === 'live' ? 'Live documents' : f === 'test' ? 'Test documents' : 'All'}
          </Button>
        ))}
      </div>

      {loading ? (
        <div className="flex justify-center py-16">
          <Loader2 className="h-6 w-6 animate-spin text-gray-400" />
        </div>
      ) : docs.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center text-gray-500">
            No {filter === 'test' ? 'test ' : filter === 'live' ? 'live ' : ''}documents yet.
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-3">
          {docs.map((d) => (
            <Card key={d.id} className={d.isTest ? 'border-amber-300' : ''}>
              <CardContent className="p-4 flex flex-wrap items-center justify-between gap-3">
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <FileText className="w-4 h-4 text-orange-500 shrink-0" />
                    <p className="font-semibold text-gray-900 dark:text-[var(--text-primary)] truncate">
                      {d.title}
                    </p>
                    {d.isTest && <Badge variant="outline" className="border-amber-400 text-amber-700">TEST</Badge>}
                    <Badge variant="secondary">{typeLabel[d.documentType] ?? d.documentType}</Badge>
                  </div>
                  <p className="text-xs text-gray-500 mt-1">
                    {d.recipientCount} recipients · Pending {d.counts.PENDING} · Viewed {d.counts.VIEWED} · Signed{' '}
                    {d.counts.SIGNED} · Submitted {d.counts.SUBMITTED}
                  </p>
                </div>
                <Button size="sm" variant="outline" onClick={() => void openDetail(d.id)}>
                  Status
                </Button>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      <Dialog open={uploadOpen} onOpenChange={(o) => !saving && setUploadOpen(o)}>
        <DialogContent className="max-w-md max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Upload Company Document</DialogTitle>
            <DialogDescription>
              Distribute to actively working RBTs, or send as TEST to aaronsiam22@gmail.com only.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="doc-title">Title</Label>
              <Input id="doc-title" value={title} onChange={(e) => setTitle(e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="doc-desc">Description (optional)</Label>
              <Textarea id="doc-desc" value={description} onChange={(e) => setDescription(e.target.value)} rows={2} />
            </div>
            <div className="space-y-2">
              <Label>Document type</Label>
              <select
                className="w-full border rounded-md h-10 px-3 text-sm bg-white dark:bg-[var(--bg-elevated)]"
                value={documentType}
                onChange={(e) => setDocumentType(e.target.value)}
              >
                <option value="ACKNOWLEDGMENT">Acknowledgment (e-sign)</option>
                <option value="DOWNLOAD_UPLOAD">Download & upload completed file</option>
                <option value="VIEW_ONLY">View only</option>
              </select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="doc-file">File (PDF or PNG)</Label>
              <Input
                id="doc-file"
                type="file"
                accept=".pdf,.png,application/pdf,image/png"
                onChange={(e) => setFile(e.target.files?.[0] ?? null)}
              />
            </div>
            <label className="flex items-center gap-2 text-sm">
              <Checkbox checked={isTest} onCheckedChange={(v) => setIsTest(v === true)} />
              Send as TEST (only aaronsiam22@gmail.com)
            </label>
          </div>
          <DialogFooter>
            <Button variant="outline" disabled={saving} onClick={() => setUploadOpen(false)}>
              Cancel
            </Button>
            <Button disabled={saving} onClick={() => void handleUpload()} className="bg-orange-500 hover:bg-orange-600 text-white">
              {saving ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : null}
              Upload & distribute
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={!!detailId} onOpenChange={(o) => !o && setDetailId(null)}>
        <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{detail?.title ?? 'Distribution status'}</DialogTitle>
            <DialogDescription>
              {detail
                ? `${typeLabel[detail.documentType] ?? detail.documentType}${detail.isTest ? ' · TEST' : ''}`
                : 'Loading…'}
            </DialogDescription>
          </DialogHeader>
          {!detail ? (
            <div className="flex justify-center py-8">
              <Loader2 className="h-6 w-6 animate-spin text-gray-400" />
            </div>
          ) : (
            <div className="space-y-4">
              <div className="flex flex-wrap gap-2 text-xs">
                <Badge>Pending {detail.counts.PENDING}</Badge>
                <Badge variant="secondary">Viewed {detail.counts.VIEWED}</Badge>
                <Badge className="bg-green-600">Signed {detail.counts.SIGNED}</Badge>
                <Badge className="bg-blue-600">Submitted {detail.counts.SUBMITTED}</Badge>
              </div>
              <Button size="sm" variant="outline" disabled={resending} onClick={() => void handleResend()}>
                {resending ? <Loader2 className="w-4 h-4 animate-spin mr-1" /> : <RefreshCw className="w-4 h-4 mr-1" />}
                Resend to incomplete
              </Button>
              <div className="space-y-2 max-h-80 overflow-y-auto">
                {detail.recipients.map((r) => (
                  <div
                    key={r.id}
                    className="flex items-center justify-between gap-2 border rounded-md px-3 py-2 text-sm"
                  >
                    <div className="min-w-0">
                      <p className="font-medium truncate">{r.rbt.name}</p>
                      <p className="text-xs text-gray-500 truncate">{r.rbt.email ?? '—'}</p>
                    </div>
                    <Badge variant="outline">{r.status}</Badge>
                  </div>
                ))}
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      <p className="text-xs text-gray-400">
        Also see <Link href="/admin/onboarding-documents" className="underline">onboarding document templates</Link>.
      </p>
    </div>
  )
}
