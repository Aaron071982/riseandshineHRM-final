'use client'

import { useRef, useState, useTransition } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { format } from 'date-fns'
import {
  createTreatmentAssessmentForm,
  createTreatmentAssessmentUploadShell,
  finalizeTreatmentAssessmentUpload,
  softDeleteTreatmentAssessment,
} from '@/lib/crm/assessment/actions'
import { uploadTreatmentAssessmentFile } from '@/lib/crm/assessmentUpload.client'
import { UPLOADED_PDF_SECTION_KEY } from '@/lib/crm/assessment/storagePaths'
import type { TreatmentAssessmentStatus, TreatmentAssessmentSource } from '@prisma/client'

export type TreatmentAssessmentListRow = {
  id: string
  status: TreatmentAssessmentStatus
  source: TreatmentAssessmentSource
  assessmentType: string
  reportDate: Date | null
  completedAt: Date | null
  signedAt: Date | null
  createdAt: Date
  updatedAt: Date
  createdByUser: { id: string; name: string | null; email: string | null }
}

type Props = {
  clientId: string
  clientCode: string
  assessments: TreatmentAssessmentListRow[]
  hasAssessmentOnFile: boolean
  canEdit: boolean
  canUpload: boolean
}

const STATUS_COLORS: Record<string, string> = {
  DRAFT: 'bg-gray-100 text-gray-700',
  IN_PROGRESS: 'bg-amber-100 text-amber-800',
  COMPLETED: 'bg-green-100 text-green-800',
  SIGNED: 'bg-green-200 text-green-900',
}

export function TreatmentAssessmentPanel({
  clientId,
  clientCode,
  assessments,
  hasAssessmentOnFile,
  canEdit,
  canUpload,
}: Props) {
  const router = useRouter()
  const [pending, startTransition] = useTransition()
  const [error, setError] = useState<string | null>(null)
  const [uploadProgress, setUploadProgress] = useState(0)
  const fileRef = useRef<HTMLInputElement>(null)

  const onNewForm = () => {
    setError(null)
    startTransition(async () => {
      const result = await createTreatmentAssessmentForm(clientId)
      if (!result.ok) {
        setError(result.error)
        return
      }
      router.push(`/client-services/clients/${clientId}/assessments/${result.assessmentId}`)
    })
  }

  const onUploadPdf = async (file: File) => {
    setError(null)
    setUploadProgress(0)
    startTransition(async () => {
      const shell = await createTreatmentAssessmentUploadShell(clientId)
      if (!shell.ok) {
        setError(shell.error)
        return
      }
      try {
        await uploadTreatmentAssessmentFile({
          clientId,
          assessmentId: shell.assessmentId,
          sectionKey: UPLOADED_PDF_SECTION_KEY,
          kind: 'PDF',
          file,
          onProgress: (p) => setUploadProgress(Math.round((p.loaded / p.total) * 100)),
        })
        const done = await finalizeTreatmentAssessmentUpload({
          serviceClientId: clientId,
          assessmentId: shell.assessmentId,
        })
        if (!done.ok) {
          setError(done.error)
          return
        }
        router.refresh()
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Upload failed')
      } finally {
        setUploadProgress(0)
        if (fileRef.current) fileRef.current.value = ''
      }
    })
  }

  const onDelete = (assessmentId: string) => {
    if (!confirm('Soft-delete this assessment record?')) return
    startTransition(async () => {
      const result = await softDeleteTreatmentAssessment(assessmentId)
      if (!result.ok) setError(result.error)
      else router.refresh()
    })
  }

  const downloadHref = (a: TreatmentAssessmentListRow) => {
    if (a.source === 'UPLOAD') {
      return `/api/client-services/clients/${clientId}/assessments/${a.id}/download`
    }
    return `/client-services/clients/${clientId}/assessments/${a.id}/print`
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="font-display text-lg font-semibold text-ink">Assessments</h2>
          <p className="text-sm text-quiet">Client {clientCode}</p>
        </div>
        {hasAssessmentOnFile && (
          <span className="rounded-full bg-[var(--green-bg)] px-3 py-1 text-sm font-medium text-[var(--green-fg)]">
            Assessment on file
          </span>
        )}
      </div>

      {(canEdit || canUpload) && (
        <div className="flex flex-wrap gap-2">
          {canEdit && (
            <button
              type="button"
              onClick={onNewForm}
              disabled={pending}
              className="rounded-md bg-brand px-4 py-2 text-sm font-medium text-white hover:bg-brand/90 disabled:opacity-50"
            >
              Fill new assessment
            </button>
          )}
          {canUpload && (
            <>
              <input
                ref={fileRef}
                type="file"
                accept="application/pdf,.pdf"
                className="hidden"
                onChange={(e) => {
                  const f = e.target.files?.[0]
                  if (f) void onUploadPdf(f)
                }}
              />
              <button
                type="button"
                onClick={() => fileRef.current?.click()}
                disabled={pending}
                className="rounded-md border border-line px-4 py-2 text-sm font-medium hover:bg-canvas disabled:opacity-50"
              >
                {uploadProgress > 0 ? `Uploading ${uploadProgress}%…` : 'Upload completed PDF'}
              </button>
            </>
          )}
        </div>
      )}

      {error && (
        <p className="rounded-lg bg-[var(--urgent-bg)] px-3 py-2 text-sm text-[var(--urgent-fg)]">{error}</p>
      )}

      {assessments.length === 0 ? (
        <p className="rounded-xl border border-dashed border-line p-8 text-center text-sm text-quiet">
          No assessments yet. Fill a new assessment in-app or upload a completed PDF.
        </p>
      ) : (
        <ul className="divide-y divide-line rounded-xl border border-line bg-surface">
          {assessments.map((a) => (
            <li key={a.id} className="flex flex-wrap items-center justify-between gap-3 p-4">
              <div className="space-y-1">
                <div className="flex flex-wrap items-center gap-2">
                  <span className={`rounded px-2 py-0.5 text-xs font-medium ${STATUS_COLORS[a.status] ?? ''}`}>
                    {a.status.replace('_', ' ')}
                  </span>
                  <span className="rounded bg-canvas px-2 py-0.5 text-xs text-quiet">{a.source}</span>
                </div>
                <p className="text-sm text-ink">
                  Created {format(new Date(a.createdAt), 'MMM d, yyyy')} by{' '}
                  {a.createdByUser.name ?? a.createdByUser.email}
                </p>
                <p className="text-xs text-quiet">
                  Updated {format(new Date(a.updatedAt), 'MMM d, yyyy h:mm a')}
                </p>
              </div>
              <div className="flex flex-wrap gap-2">
                {a.source === 'FORM' && a.status !== 'COMPLETED' && a.status !== 'SIGNED' && canEdit && (
                  <Link
                    href={`/client-services/clients/${clientId}/assessments/${a.id}`}
                    className="rounded-md bg-brand px-3 py-1.5 text-sm text-white hover:bg-brand/90"
                  >
                    Continue
                  </Link>
                )}
                {(a.status === 'COMPLETED' || a.status === 'SIGNED') && a.source === 'FORM' && canEdit && (
                  <Link
                    href={`/client-services/clients/${clientId}/assessments/${a.id}`}
                    className="rounded-md border border-line px-3 py-1.5 text-sm hover:bg-canvas"
                  >
                    View
                  </Link>
                )}
                <a
                  href={downloadHref(a)}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="rounded-md border border-line px-3 py-1.5 text-sm hover:bg-canvas"
                >
                  Download
                </a>
                {canEdit && (
                  <button
                    type="button"
                    onClick={() => onDelete(a.id)}
                    disabled={pending}
                    className="rounded-md px-3 py-1.5 text-sm text-red-600 hover:bg-red-50 disabled:opacity-50"
                  >
                    Delete
                  </button>
                )}
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
