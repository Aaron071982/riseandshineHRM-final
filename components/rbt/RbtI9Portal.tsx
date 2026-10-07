'use client'

import { useRouter } from 'next/navigation'
import { CheckCircle2, FileCheck2, FileText } from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import DocumentUploadFlow from '@/components/onboarding/DocumentUploadFlow'
import {
  I9AcceptableDocumentsList,
  I9FormInstructions,
  I9SupportingDocumentsUpload,
} from '@/components/rbt/I9Instructions'
import { formatDate } from '@/lib/utils'

export type RbtI9Status = 'needed' | 'submitted' | 'complete'

type I9File = { id: string; fileName: string; isForm: boolean; uploadedAt: string }

const STATUS_COPY: Record<RbtI9Status, { label: string; className: string; message: string }> = {
  needed: {
    label: 'Action needed',
    className: 'bg-amber-600',
    message:
      'We do not have a completed Form I-9 on file for you. Please upload your completed Section 1 and your identity and work-authorization documents below.',
  },
  submitted: {
    label: 'Received',
    className: 'bg-blue-600',
    message:
      'Your Form I-9 is on file. HR will review your original documents to complete Section 2. If you have not uploaded your identity and work-authorization documents yet, add them below.',
  },
  complete: {
    label: 'Complete',
    className: 'bg-green-600',
    message: 'Your Form I-9 is complete. No further action is needed.',
  },
}

export default function RbtI9Portal({
  i9DocumentId,
  status,
  documents,
}: {
  i9DocumentId: string | null
  status: RbtI9Status
  documents: I9File[]
}) {
  const router = useRouter()
  const copy = STATUS_COPY[status]
  const hasForm = documents.some((d) => d.isForm) || status !== 'needed'
  const hasSupporting = documents.some((d) => !d.isForm)

  return (
    <div className="mx-auto max-w-3xl space-y-6 px-4 sm:px-0">
      <div className="flex items-center gap-3">
        <FileCheck2 className="h-8 w-8 text-[#e36f1e]" />
        <div>
          <h1 className="text-2xl font-bold">Form I-9</h1>
          <p className="text-sm text-gray-500">Employment Eligibility Verification</p>
        </div>
        <Badge className={`ml-auto ${copy.className}`}>{copy.label}</Badge>
      </div>

      <div
        className={`rounded-xl border px-4 py-3 text-sm ${
          status === 'complete'
            ? 'border-green-200 bg-green-50 text-green-900'
            : status === 'submitted'
              ? 'border-blue-200 bg-blue-50 text-blue-900'
              : 'border-amber-400 bg-amber-50 text-amber-950'
        }`}
      >
        {status === 'complete' ? <CheckCircle2 className="mr-1 inline h-4 w-4" /> : null}
        {copy.message}
      </div>

      {status !== 'complete' && (
        <>
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">How to complete your I-9</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <I9FormInstructions />
              <I9AcceptableDocumentsList />
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-lg">
                1. Completed Form I-9 (Section 1)
                {hasForm && <Badge className="bg-green-600">Uploaded</Badge>}
              </CardTitle>
            </CardHeader>
            <CardContent>
              {i9DocumentId ? (
                <DocumentUploadFlow
                  documentId={i9DocumentId}
                  title={hasForm ? 'Upload a corrected Form I-9 (optional)' : 'Form I-9 Section 1'}
                  onComplete={() => router.refresh()}
                />
              ) : (
                <p className="text-sm text-gray-600">
                  The I-9 upload is not configured yet. Please contact HR.
                </p>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-lg">
                2. Identity and work-authorization documents
                {hasSupporting && <Badge className="bg-green-600">Uploaded</Badge>}
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              <p className="text-sm text-gray-600">
                One document from List A, <em>or</em> one from List B plus one from List C — your choice.
              </p>
              <I9SupportingDocumentsUpload />
            </CardContent>
          </Card>
        </>
      )}

      {documents.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Your I-9 uploads</CardTitle>
          </CardHeader>
          <CardContent>
            <ul className="divide-y text-sm">
              {documents.map((d) => (
                <li key={d.id} className="flex items-center gap-2 py-2">
                  <FileText className="h-4 w-4 shrink-0 text-gray-400" />
                  <a
                    href={`/api/rbt/documents/my/${d.id}/download`}
                    className="truncate text-[#e36f1e] hover:underline"
                  >
                    {d.fileName}
                  </a>
                  <span className="ml-auto shrink-0 text-xs text-gray-500">
                    {d.isForm ? 'Form I-9' : 'Supporting document'} · {formatDate(d.uploadedAt)}
                  </span>
                </li>
              ))}
            </ul>
          </CardContent>
        </Card>
      )}
    </div>
  )
}
