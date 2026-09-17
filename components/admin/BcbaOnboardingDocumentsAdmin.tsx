'use client'

import { useState } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import { useToast } from '@/components/ui/toast'
import { Loader2, Upload, FileText, CheckCircle2, XCircle } from 'lucide-react'

type Doc = {
  id: string
  title: string
  slug: string
  flowType: string
  pdfData: string | null
  pdfUrl: string | null
  displayOrder: number
  isActive: boolean
  isRequired: boolean
}

export default function BcbaOnboardingDocumentsAdmin({
  initialDocuments,
}: {
  initialDocuments: Doc[]
}) {
  const { showToast } = useToast()
  const [documents, setDocuments] = useState(initialDocuments)
  const [title, setTitle] = useState('')
  const [creating, setCreating] = useState(false)
  const [uploading, setUploading] = useState<Record<string, boolean>>({})

  async function createDoc(e: React.FormEvent) {
    e.preventDefault()
    if (!title.trim()) return
    setCreating(true)
    try {
      const res = await fetch('/api/admin/bcba-onboarding-documents', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ title: title.trim(), flowType: 'ESIGN' }),
      })
      const data = await res.json()
      if (!res.ok) {
        showToast(data.error || 'Failed to create', 'error')
        return
      }
      setDocuments((prev) => [...prev, data.document])
      setTitle('')
      showToast('Document added', 'success')
    } catch {
      showToast('Failed to create document', 'error')
    } finally {
      setCreating(false)
    }
  }

  async function uploadPdf(documentId: string, file: File) {
    setUploading((u) => ({ ...u, [documentId]: true }))
    try {
      const form = new FormData()
      form.append('documentId', documentId)
      form.append('file', file)
      const res = await fetch('/api/admin/bcba-onboarding-documents', {
        method: 'POST',
        body: form,
        credentials: 'include',
      })
      const data = await res.json()
      if (!res.ok) {
        showToast(data.error || 'Upload failed', 'error')
        return
      }
      setDocuments((prev) => prev.map((d) => (d.id === documentId ? data.document : d)))
      showToast('PDF uploaded', 'success')
    } catch {
      showToast('Upload failed', 'error')
    } finally {
      setUploading((u) => ({ ...u, [documentId]: false }))
    }
  }

  async function toggleActive(doc: Doc) {
    const res = await fetch('/api/admin/bcba-onboarding-documents', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify({ id: doc.id, isActive: !doc.isActive }),
    })
    const data = await res.json()
    if (!res.ok) {
      showToast(data.error || 'Update failed', 'error')
      return
    }
    setDocuments((prev) => prev.map((d) => (d.id === doc.id ? data.document : d)))
  }

  return (
    <div className="space-y-6">
      <div className="pb-4 border-b dark:border-[var(--border-subtle)]">
        <h2 className="text-xl font-semibold text-gray-900 dark:text-[var(--text-primary)]">
          BCBA onboarding documents
        </h2>
        <p className="text-sm text-gray-600 dark:text-[var(--text-tertiary)] mt-1">
          Upload PDFs BCBAs will acknowledge in the portal — same sign flow as RBT.
        </p>
      </div>

      <Card className="dark:bg-[var(--bg-elevated)] dark:border-[var(--border-subtle)]">
        <CardHeader>
          <CardTitle>Add document</CardTitle>
        </CardHeader>
        <CardContent>
          <form onSubmit={createDoc} className="flex flex-col sm:flex-row gap-3 items-end">
            <div className="flex-1 space-y-2 w-full">
              <Label htmlFor="bcba-doc-title">Title</Label>
              <Input
                id="bcba-doc-title"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="e.g. BCBA Handbook Acknowledgment"
                className="dark:bg-[var(--bg-input)] dark:border-[var(--border-subtle)]"
              />
            </div>
            <Button type="submit" disabled={creating || !title.trim()}>
              {creating ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
              Add
            </Button>
          </form>
        </CardContent>
      </Card>

      <Card className="dark:bg-[var(--bg-elevated)] dark:border-[var(--border-subtle)]">
        <CardHeader>
          <CardTitle>Templates</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {documents.length === 0 ? (
            <p className="text-sm text-gray-500 py-6 text-center">
              No BCBA documents yet — add one above, then upload a PDF.
            </p>
          ) : (
            documents.map((doc) => {
              const hasPdf = !!(doc.pdfData || doc.pdfUrl)
              return (
                <div
                  key={doc.id}
                  className="flex flex-col md:flex-row md:items-center justify-between gap-3 border rounded-lg p-4 dark:border-[var(--border-subtle)]"
                >
                  <div className="flex items-start gap-3 min-w-0">
                    <FileText className="h-5 w-5 mt-0.5 text-orange-500 shrink-0" />
                    <div className="min-w-0">
                      <p className="font-medium truncate">{doc.title}</p>
                      <p className="text-xs text-gray-500 truncate">{doc.slug}</p>
                      <div className="flex flex-wrap gap-2 mt-2">
                        <Badge variant="outline">{doc.flowType}</Badge>
                        {hasPdf ? (
                          <Badge className="bg-emerald-100 text-emerald-800 border-0">
                            <CheckCircle2 className="h-3 w-3 mr-1" /> PDF ready
                          </Badge>
                        ) : (
                          <Badge variant="outline" className="text-amber-700">
                            <XCircle className="h-3 w-3 mr-1" /> Needs PDF
                          </Badge>
                        )}
                        {!doc.isActive ? <Badge variant="secondary">Inactive</Badge> : null}
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    <Label className="cursor-pointer inline-flex">
                      <span className="sr-only">Upload PDF</span>
                      <Input
                        type="file"
                        accept="application/pdf"
                        className="hidden"
                        disabled={!!uploading[doc.id]}
                        onChange={(e) => {
                          const f = e.target.files?.[0]
                          if (f) void uploadPdf(doc.id, f)
                          e.target.value = ''
                        }}
                      />
                      <Button type="button" variant="outline" size="sm" asChild>
                        <span className="inline-flex items-center gap-2 pointer-events-none">
                          {uploading[doc.id] ? (
                            <Loader2 className="h-4 w-4 animate-spin" />
                          ) : (
                            <Upload className="h-4 w-4" />
                          )}
                          Upload PDF
                        </span>
                      </Button>
                    </Label>
                    <Button type="button" variant="ghost" size="sm" onClick={() => void toggleActive(doc)}>
                      {doc.isActive ? 'Deactivate' : 'Activate'}
                    </Button>
                  </div>
                </div>
              )
            })
          )}
        </CardContent>
      </Card>
    </div>
  )
}
