'use client'

import { useState, useEffect } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { FileText, Download, Search, FolderOpen, Building2, FileCheck } from 'lucide-react'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { formatRbtDocumentTypeLabel } from '@/lib/rbtDocumentTypes'

type MyDoc = {
  id: string
  fileName: string
  fileType: string
  documentType: string | null
  uploadedAt: string
  size: number | null
}

type CompanyDoc = {
  id: string
  documentId: string
  title: string
  status: string
  completedAt: string | null
  signedPdfUrl: string | null
}

type FormDoc = {
  id: string
  title: string
  slug: string
  type: string
  pdfUrl: string | null
}

type DocumentsData = {
  myDocuments: MyDoc[]
  companyDocuments: CompanyDoc[]
  forms: FormDoc[]
}

function formatDate(s: string) {
  return new Date(s).toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  })
}

function formatSize(bytes: number | null) {
  if (bytes == null) return '—'
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}

export default function RBTDocumentsPage() {
  const [data, setData] = useState<DocumentsData | null>(null)
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [previewUrl, setPreviewUrl] = useState<string | null>(null)
  const [previewName, setPreviewName] = useState('')

  useEffect(() => {
    let cancelled = false
    async function fetchData() {
      try {
        const res = await fetch('/api/rbt/documents')
        if (!res.ok) throw new Error('Failed to load')
        const json = await res.json()
        if (!cancelled) setData(json)
      } catch {
        if (!cancelled) setData({ myDocuments: [], companyDocuments: [], forms: [] })
      } finally {
        if (!cancelled) setLoading(false)
      }
    }
    fetchData()
    return () => { cancelled = true }
  }, [])

  const filter = (name: string) => {
    if (!search.trim()) return true
    return name.toLowerCase().includes(search.trim().toLowerCase())
  }

  const myFiltered =
    data?.myDocuments?.filter(
      (d) =>
        filter(d.fileName) ||
        filter(formatRbtDocumentTypeLabel(d.documentType))
    ) ?? []
  const companyFiltered = data?.companyDocuments?.filter((d) => filter(d.title)) ?? []
  const formsFiltered = data?.forms?.filter((d) => filter(d.title)) ?? []

  const openPreview = (url: string, name: string) => {
    setPreviewName(name)
    setPreviewUrl(url)
  }

  const closePreview = () => {
    setPreviewUrl(null)
    setPreviewName('')
  }

  if (loading) {
    return (
      <div className="space-y-6">
        <div className="h-10 w-48 bg-gray-200 dark:bg-gray-700 rounded animate-pulse" />
        <div className="h-64 bg-gray-100 dark:bg-gray-800 rounded-lg animate-pulse" />
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900 dark:text-[var(--text-primary)]">
          Document Center
        </h1>
        <p className="text-gray-600 dark:text-[var(--text-tertiary)] mt-1">
          View and download your documents, company documents, and forms.
        </p>
      </div>

      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
        <Input
          placeholder="Search by name..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="pl-9"
        />
      </div>

      <Tabs defaultValue="my" className="space-y-4">
        <TabsList className="grid w-full grid-cols-3 lg:w-auto lg:inline-grid">
          <TabsTrigger value="my" className="gap-2">
            <FolderOpen className="w-4 h-4" />
            My Documents ({myFiltered.length})
          </TabsTrigger>
          <TabsTrigger value="company" className="gap-2">
            <Building2 className="w-4 h-4" />
            Company ({companyFiltered.length})
          </TabsTrigger>
          <TabsTrigger value="forms" className="gap-2">
            <FileCheck className="w-4 h-4" />
            Forms & Templates ({formsFiltered.length})
          </TabsTrigger>
        </TabsList>

        <TabsContent value="my" className="space-y-4">
          <Card className="dark:bg-[var(--bg-elevated)] dark:border-[var(--border-subtle)]">
            <CardHeader>
              <CardTitle className="text-lg">My Documents</CardTitle>
              <p className="text-sm text-gray-600 dark:text-[var(--text-tertiary)]">
                Files you uploaded during onboarding or that your team added for you.
              </p>
            </CardHeader>
            <CardContent>
              {myFiltered.length === 0 ? (
                <p className="text-center py-8 text-gray-500 dark:text-[var(--text-tertiary)]">
                  No documents yet.
                </p>
              ) : (
                <ul className="space-y-3">
                  {myFiltered.map((doc) => (
                    <li
                      key={doc.id}
                      className="flex items-center justify-between gap-4 p-3 rounded-lg border dark:border-[var(--border-subtle)] hover:bg-gray-50 dark:hover:bg-[var(--bg-elevated-hover)]"
                    >
                      <div className="flex items-center gap-3 min-w-0">
                        <FileText className="w-5 h-5 text-[#e36f1e] shrink-0" />
                        <div className="min-w-0">
                          <p className="font-medium truncate">{doc.fileName}</p>
                          <p className="text-xs text-gray-500">
                            {formatRbtDocumentTypeLabel(doc.documentType)} ·{' '}
                            {formatDate(doc.uploadedAt)} · {formatSize(doc.size)}
                          </p>
                        </div>
                      </div>
                      <div className="flex gap-2 shrink-0">
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() =>
                            openPreview(
                              `/api/rbt/documents/my/${doc.id}/download`,
                              doc.fileName
                            )
                          }
                        >
                          Preview
                        </Button>
                        <Button variant="outline" size="sm" asChild>
                          <a
                            href={`/api/rbt/documents/my/${doc.id}/download`}
                            download={doc.fileName}
                          >
                            <Download className="w-4 h-4 mr-1" />
                            Download
                          </a>
                        </Button>
                      </div>
                    </li>
                  ))}
                </ul>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="company" className="space-y-4">
          <Card className="dark:bg-[var(--bg-elevated)] dark:border-[var(--border-subtle)]">
            <CardHeader>
              <CardTitle className="text-lg">Company Documents</CardTitle>
              <p className="text-sm text-gray-600 dark:text-[var(--text-tertiary)]">
                Completed onboarding documents.
              </p>
            </CardHeader>
            <CardContent>
              {companyFiltered.length === 0 ? (
                <p className="text-center py-8 text-gray-500 dark:text-[var(--text-tertiary)]">
                  No company documents yet.
                </p>
              ) : (
                <ul className="space-y-3">
                  {companyFiltered.map((doc) => (
                    <li
                      key={doc.id}
                      className="flex items-center justify-between gap-4 p-3 rounded-lg border dark:border-[var(--border-subtle)] hover:bg-gray-50 dark:hover:bg-[var(--bg-elevated-hover)]"
                    >
                      <div className="flex items-center gap-3 min-w-0">
                        <FileText className="w-5 h-5 text-[#e36f1e] shrink-0" />
                        <div className="min-w-0">
                          <p className="font-medium truncate">{doc.title}</p>
                          <p className="text-xs text-gray-500">
                            {doc.completedAt
                              ? formatDate(doc.completedAt)
                              : '—'}{' '}
                            · <span className="capitalize">{doc.status}</span>
                          </p>
                        </div>
                      </div>
                      <Button variant="outline" size="sm" asChild>
                        <a
                          href={`/api/rbt/documents/company/${doc.id}/download`}
                          download={`${doc.title}.pdf`}
                        >
                          <Download className="w-4 h-4 mr-1" />
                          Download
                        </a>
                      </Button>
                    </li>
                  ))}
                </ul>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="forms" className="space-y-4">
          <Card className="dark:bg-[var(--bg-elevated)] dark:border-[var(--border-subtle)]">
            <CardHeader>
              <CardTitle className="text-lg">Forms & Templates</CardTitle>
              <p className="text-sm text-gray-600 dark:text-[var(--text-tertiary)]">
                Downloadable forms for your records.
              </p>
            </CardHeader>
            <CardContent>
              {formsFiltered.length === 0 ? (
                <p className="text-center py-8 text-gray-500 dark:text-[var(--text-tertiary)]">
                  No forms available.
                </p>
              ) : (
                <ul className="space-y-3">
                  {formsFiltered.map((form) => (
                    <li
                      key={form.id}
                      className="flex items-center justify-between gap-4 p-3 rounded-lg border dark:border-[var(--border-subtle)] hover:bg-gray-50 dark:hover:bg-[var(--bg-elevated-hover)]"
                    >
                      <div className="flex items-center gap-3 min-w-0">
                        <FileText className="w-5 h-5 text-[#e36f1e] shrink-0" />
                        <p className="font-medium truncate">{form.title}</p>
                      </div>
                      {form.pdfUrl ? (
                        <Button variant="outline" size="sm" asChild>
                          <a
                            href={form.pdfUrl}
                            target="_blank"
                            rel="noopener noreferrer"
                          >
                            <Download className="w-4 h-4 mr-1" />
                            Download
                          </a>
                        </Button>
                      ) : (
                        <span className="text-sm text-gray-500">
                          Available in My Tasks
                        </span>
                      )}
                    </li>
                  ))}
                </ul>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      <Dialog open={!!previewUrl} onOpenChange={(open) => !open && closePreview()}>
        <DialogContent className="max-w-4xl max-h-[90vh] flex flex-col">
          <DialogHeader>
            <DialogTitle className="truncate pr-8">{previewName}</DialogTitle>
          </DialogHeader>
          {previewUrl && (
            <iframe
              src={previewUrl}
              title={previewName}
              className="flex-1 w-full min-h-[70vh] rounded border dark:border-[var(--border-subtle)]"
            />
          )}
        </DialogContent>
      </Dialog>
    </div>
  )
}
