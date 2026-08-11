'use client'

import { useEffect, useState } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { CheckCircle2, Download, FileText, Loader2 } from 'lucide-react'
import OnboardingPdfViewer from '@/components/onboarding/OnboardingPdfViewer'

type Meta = {
  title: string
  description: string | null
  documentType: 'ACKNOWLEDGMENT' | 'VIEW_ONLY' | 'DOWNLOAD_UPLOAD'
  fileType: string
  status: string
  signedName: string | null
  signedAt: string | null
  firstName: string
  expectedFullName: string
}

export default function PublicCompanyDocPage({ token }: { token: string }) {
  const [meta, setMeta] = useState<Meta | null>(null)
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(true)
  const [pngSrc, setPngSrc] = useState<string | null>(null)
  const [signedName, setSignedName] = useState('')
  const [saving, setSaving] = useState(false)
  const [doneMsg, setDoneMsg] = useState('')

  const fileUrl = `/api/public/company-docs/${token}/file`
  const downloadUrl = `${fileUrl}?download=1`

  useEffect(() => {
    let cancelled = false
    ;(async () => {
      setLoading(true)
      setError('')
      try {
        const res = await fetch(`/api/public/company-docs/${token}`)
        const data = await res.json().catch(() => ({}))
        if (!res.ok) {
          if (!cancelled) setError(data.error || 'This link is invalid or has expired.')
          return
        }
        if (cancelled) return
        setMeta(data as Meta)

        void fetch(`/api/public/company-docs/${token}/view`, { method: 'POST' })

        if (data.fileType === 'png') {
          const fileRes = await fetch(fileUrl)
          if (!fileRes.ok) throw new Error('Could not load document')
          const blob = await fileRes.blob()
          if (!cancelled) setPngSrc(URL.createObjectURL(blob))
        }
      } catch {
        if (!cancelled) setError('Could not load this document.')
      } finally {
        if (!cancelled) setLoading(false)
      }
    })()
    return () => {
      cancelled = true
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token])

  useEffect(() => {
    return () => {
      if (pngSrc) URL.revokeObjectURL(pngSrc)
    }
  }, [pngSrc])

  const handleSign = async () => {
    if (!meta) return
    setSaving(true)
    setDoneMsg('')
    try {
      const res = await fetch(`/api/public/company-docs/${token}/sign`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ signedName }),
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) {
        setError(data.error || 'Could not save acknowledgment')
        return
      }
      setMeta({
        ...meta,
        status: data.recipient?.status ?? 'SIGNED',
        signedName: data.recipient?.signedName ?? signedName,
        signedAt: data.recipient?.signedAt ?? new Date().toISOString(),
      })
      setDoneMsg('Thanks — your acknowledgment has been recorded.')
      setError('')
    } catch {
      setError('Could not save acknowledgment')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="min-h-screen bg-[#f5f5f5]">
      <header className="bg-gradient-to-br from-[#E4893D] to-[#FF9F5A] px-4 py-8 text-center text-white">
        <h1 className="text-2xl font-bold">Rise &amp; Shine ABA</h1>
        <p className="mt-1 text-sm opacity-95">Document review</p>
      </header>

      <main className="mx-auto max-w-3xl px-4 py-8">
        {loading && (
          <div className="flex items-center justify-center gap-2 py-16 text-gray-500">
            <Loader2 className="h-5 w-5 animate-spin" />
            Loading document…
          </div>
        )}

        {!loading && error && !meta && (
          <div className="rounded-xl border border-red-200 bg-white p-6 text-center text-red-700">
            <FileText className="mx-auto mb-3 h-8 w-8 opacity-60" />
            <p className="font-medium">{error}</p>
            <p className="mt-2 text-sm text-gray-500">
              You can still review company documents after signing in to the HRM portal.
            </p>
          </div>
        )}

        {meta && (
          <div className="space-y-5">
            <div className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm">
              <p className="text-sm text-gray-500">Hi {meta.firstName},</p>
              <h2 className="mt-1 text-xl font-semibold text-gray-900">{meta.title}</h2>
              {meta.description && (
                <p className="mt-2 text-sm text-gray-600 whitespace-pre-wrap">{meta.description}</p>
              )}
              <div className="mt-4 flex flex-wrap gap-2">
                <a href={downloadUrl}>
                  <Button type="button" variant="outline" className="gap-2">
                    <Download className="h-4 w-4" />
                    Download
                  </Button>
                </a>
              </div>
            </div>

            <div className="rounded-xl border border-gray-200 bg-white p-3 shadow-sm overflow-hidden">
              {meta.fileType === 'png' ? (
                <div className="flex min-h-[40vh] items-center justify-center overflow-auto bg-gray-50 p-2">
                  {pngSrc ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={pngSrc} alt={meta.title} className="max-w-full h-auto" />
                  ) : (
                    <Loader2 className="h-8 w-8 animate-spin text-gray-400" />
                  )}
                </div>
              ) : (
                <OnboardingPdfViewer
                  key={token}
                  documentId={token}
                  pdfUrl={fileUrl}
                  title={meta.title}
                />
              )}
            </div>

            {meta.documentType === 'VIEW_ONLY' && (
              <div className="rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-800 flex items-start gap-2">
                <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0" />
                <span>
                  {meta.status === 'VIEWED' || meta.status === 'SIGNED'
                    ? 'This document has been marked as reviewed. No signature is required.'
                    : 'Opening this page marks the document as reviewed. No signature is required.'}
                </span>
              </div>
            )}

            {meta.documentType === 'ACKNOWLEDGMENT' && (
              <div className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm space-y-3">
                {meta.status === 'SIGNED' ? (
                  <div className="flex items-start gap-2 text-emerald-800">
                    <CheckCircle2 className="mt-0.5 h-5 w-5 shrink-0" />
                    <div>
                      <p className="font-medium">Acknowledged</p>
                      <p className="text-sm text-gray-600">
                        Signed as {meta.signedName}
                        {meta.signedAt
                          ? ` · ${new Date(meta.signedAt).toLocaleString()}`
                          : ''}
                      </p>
                    </div>
                  </div>
                ) : (
                  <>
                    <p className="text-sm text-gray-700">
                      Type your full legal name to acknowledge that you have reviewed this document.
                    </p>
                    <div className="space-y-1.5">
                      <Label htmlFor="signedName">Full name</Label>
                      <Input
                        id="signedName"
                        value={signedName}
                        onChange={(e) => setSignedName(e.target.value)}
                        placeholder={meta.expectedFullName || 'First Last'}
                        autoComplete="name"
                      />
                    </div>
                    {error && <p className="text-sm text-red-600">{error}</p>}
                    {doneMsg && <p className="text-sm text-emerald-700">{doneMsg}</p>}
                    <Button
                      type="button"
                      className="bg-[#E4893D] hover:bg-[#d4782f] text-white"
                      disabled={saving || signedName.trim().split(/\s+/).length < 2}
                      onClick={handleSign}
                    >
                      {saving ? (
                        <>
                          <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                          Saving…
                        </>
                      ) : (
                        'Acknowledge & sign'
                      )}
                    </Button>
                  </>
                )}
              </div>
            )}
          </div>
        )}
      </main>
    </div>
  )
}
