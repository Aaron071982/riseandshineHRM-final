'use client'

import { useRef, useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { Download, Eye, Loader2, Lock } from 'lucide-react'
import type { AssessmentArtifactType, MilestoneStatus } from '@prisma/client'
import { ConfirmDestructiveDialog } from '@/components/crm/ConfirmDestructiveDialog'
import {
  createClinicalAssessmentVersion,
  lockClinicalAssessment,
  unlockClinicalAssessment,
} from '@/lib/crm/clinicalAssessment/actions'
import { markTreatmentPlanMade } from '@/lib/crm/actions'
import {
  ASSESSMENT_ARTIFACT_LABELS,
  REQUIRED_ASSESSMENT_ARTIFACT_TYPES,
} from '@/lib/crm/clinicalAssessment/artifacts.shared'
import { uploadClinicalAssessmentArtifact } from '@/lib/crm/clinicalAssessmentUpload.client'
import { cn } from '@/lib/utils'

type Artifact = {
  id: string
  artifactType: AssessmentArtifactType
  contentType: string
  sizeBytes: number
  uploadedAt: string | Date
}

type AssessmentVersion = {
  id: string
  versionNumber: number
  isCurrentVersion: boolean
  lockState: 'DRAFT' | 'LOCKED'
  lockedAt: string | Date | null
  createdAt: string | Date
  artifacts: Artifact[]
  lockedByUser?: { name: string | null; email: string | null } | null
  createdByUser?: { name: string | null; email: string | null } | null
}

const ARTIFACT_ACCEPT: Record<AssessmentArtifactType, string> = {
  INITIAL_REPORT: '.pdf',
  VINELAND_3: '.pdf,.png,.jpg,.jpeg,.heic,.webp',
  ATEC: '.pdf,.png,.jpg,.jpeg,.heic,.webp',
  FAST: '.jpg,.jpeg,.png,.heic,.webp',
  JUSTIFICATION: '.pdf',
}

export function ClinicalAssessmentPanel({
  clientId,
  clientCode,
  currentAssessment,
  versions,
  canUpload,
  canLock,
  canMarkTreatmentPlan,
  treatmentPlanStatus,
  treatmentPlanCompletedAt,
}: {
  clientId: string
  clientCode: string
  currentAssessment: AssessmentVersion
  versions: AssessmentVersion[]
  canUpload: boolean
  canLock: boolean
  canMarkTreatmentPlan: boolean
  treatmentPlanStatus: MilestoneStatus
  treatmentPlanCompletedAt: string | Date | null
}) {
  const router = useRouter()
  const [pending, startTransition] = useTransition()
  const [error, setError] = useState('')
  const [uploadType, setUploadType] = useState<AssessmentArtifactType | null>(null)
  const [uploadPct, setUploadPct] = useState<number | null>(null)
  const [lockOpen, setLockOpen] = useState(false)
  const [unlockOpen, setUnlockOpen] = useState(false)
  const [versionOpen, setVersionOpen] = useState(false)
  const fileRefs = useRef<Partial<Record<AssessmentArtifactType, HTMLInputElement | null>>>({})

  const isDraft = currentAssessment.lockState === 'DRAFT'
  const artifactByType = new Map(
    currentAssessment.artifacts.map((a) => [a.artifactType, a])
  )
  const missing = REQUIRED_ASSESSMENT_ARTIFACT_TYPES.filter(
    (t) => !artifactByType.has(t)
  )

  const onUpload = (type: AssessmentArtifactType, file: File | null) => {
    if (!file || !canUpload || !isDraft) return
    startTransition(async () => {
      setError('')
      setUploadType(type)
      setUploadPct(0)
      try {
        await uploadClinicalAssessmentArtifact(
          clientId,
          currentAssessment.id,
          type,
          file,
          setUploadPct
        )
        router.refresh()
      } catch (e) {
        setError(e instanceof Error ? e.message : 'Upload failed')
      } finally {
        setUploadType(null)
        setUploadPct(null)
        const input = fileRefs.current[type]
        if (input) input.value = ''
      }
    })
  }

  const downloadUrl = (artifactId: string, inline: boolean) =>
    `/api/client-services/clients/${clientId}/clinical-assessment/artifacts/${artifactId}/download${
      inline ? '?inline=1&branded=1' : '?branded=1'
    }`

  return (
    <div className="space-y-8">
      {error && (
        <p className="rounded-lg bg-[var(--urgent-bg)] px-3 py-2 text-sm text-[var(--urgent)]">
          {error}
        </p>
      )}

      <section className="rounded-xl border border-line bg-surface p-4">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h3 className="font-display text-base font-semibold text-ink">
              Clinical assessment (v{currentAssessment.versionNumber})
            </h3>
            <p className="mt-1 text-sm text-quiet">
              Upload typed artifacts — locking makes this version immutable. Corrections
              create a new version.
            </p>
          </div>
          <span
            className={cn(
              'rounded-md px-2.5 py-1 text-xs font-semibold',
              currentAssessment.lockState === 'LOCKED'
                ? 'bg-[var(--green-bg)] text-[var(--green)]'
                : 'bg-[var(--amber-bg)] text-[var(--amber)]'
            )}
          >
            {currentAssessment.lockState === 'LOCKED' ? 'Locked' : 'Draft'}
          </span>
        </div>

        {currentAssessment.lockState === 'LOCKED' && currentAssessment.lockedAt && (
          <p className="mt-2 text-xs text-quiet">
            Locked {new Date(currentAssessment.lockedAt).toLocaleString()}
            {currentAssessment.lockedByUser
              ? ` · ${currentAssessment.lockedByUser.name || currentAssessment.lockedByUser.email}`
              : ''}
          </p>
        )}

        <ul className="mt-4 divide-y divide-line rounded-lg border border-line">
          {REQUIRED_ASSESSMENT_ARTIFACT_TYPES.map((type) => {
            const artifact = artifactByType.get(type)
            const busy = pending && uploadType === type
            return (
              <li key={type} className="flex flex-wrap items-center gap-3 px-3 py-3">
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-medium text-ink">
                    {ASSESSMENT_ARTIFACT_LABELS[type]}
                  </p>
                  <p className="text-xs text-quiet">
                    {artifact
                      ? `On file · ${formatSize(artifact.sizeBytes)} · ${new Date(artifact.uploadedAt).toLocaleString()}`
                      : 'Required'}
                  </p>
                </div>
                {artifact && (
                  <div className="flex items-center gap-1">
                    <a
                      href={downloadUrl(artifact.id, true)}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex h-8 items-center gap-1 rounded-lg border border-line px-2 text-xs font-medium hover:bg-line-2"
                    >
                      <Eye className="h-3.5 w-3.5" />
                      Preview
                    </a>
                    <a
                      href={downloadUrl(artifact.id, false)}
                      className="inline-flex h-8 items-center gap-1 rounded-lg border border-line px-2 text-xs font-medium hover:bg-line-2"
                    >
                      <Download className="h-3.5 w-3.5" />
                      Download
                    </a>
                  </div>
                )}
                {canUpload && isDraft && (
                  <label className="inline-flex cursor-pointer items-center gap-2 text-xs font-medium text-brand hover:underline">
                    {busy ? (
                      <>
                        <Loader2 className="h-3.5 w-3.5 animate-spin" />
                        {uploadPct ?? 0}%
                      </>
                    ) : (
                      'Upload'
                    )}
                    <input
                      ref={(el) => {
                        fileRefs.current[type] = el
                      }}
                      type="file"
                      accept={ARTIFACT_ACCEPT[type]}
                      disabled={pending}
                      className="sr-only"
                      onChange={(e) => onUpload(type, e.target.files?.[0] ?? null)}
                    />
                  </label>
                )}
              </li>
            )
          })}
        </ul>

        {canLock && isDraft && (
          <div className="mt-4 flex flex-wrap gap-2">
            <button
              type="button"
              disabled={pending || missing.length > 0}
              onClick={() => setLockOpen(true)}
              className="inline-flex h-9 items-center gap-2 rounded-lg bg-brand px-3.5 text-sm font-medium text-white hover:bg-brand-2 disabled:opacity-50"
            >
              <Lock className="h-4 w-4" />
              Lock assessment
            </button>
            {missing.length > 0 && (
              <p className="self-center text-xs text-quiet">
                Missing: {missing.map((m) => ASSESSMENT_ARTIFACT_LABELS[m]).join(', ')}
              </p>
            )}
          </div>
        )}

        {canLock && currentAssessment.lockState === 'LOCKED' && (
          <div className="mt-4 flex flex-wrap gap-2">
            <button
              type="button"
              disabled={pending}
              onClick={() => setVersionOpen(true)}
              className="h-9 rounded-lg border border-line bg-surface px-3 text-sm font-medium hover:bg-line-2 disabled:opacity-50"
            >
              Create correction version
            </button>
            <button
              type="button"
              disabled={pending}
              onClick={() => setUnlockOpen(true)}
              className="h-9 rounded-lg border border-[var(--urgent)] px-3 text-sm font-medium text-[var(--urgent)] hover:bg-[var(--urgent-bg)] disabled:opacity-50"
            >
              Unlock (privileged)
            </button>
          </div>
        )}
      </section>

      <section className="rounded-xl border border-line bg-surface p-4">
        <h3 className="font-display text-base font-semibold text-ink">Treatment plan</h3>
        <p className="mt-1 text-sm text-quiet">
          Marks the parallel treatment-plan milestone complete for Active-stage warnings.
        </p>
        <label className="mt-3 flex items-center gap-2 text-sm text-ink">
          <input
            type="checkbox"
            checked={treatmentPlanStatus === 'COMPLETE'}
            disabled={!canMarkTreatmentPlan || pending}
            onChange={(e) => {
              startTransition(async () => {
                setError('')
                const res = await markTreatmentPlanMade(clientId, e.target.checked)
                if (!res.ok) setError(res.error)
                else router.refresh()
              })
            }}
            className="h-4 w-4 rounded border-line"
          />
          Treatment plan made
        </label>
        {treatmentPlanCompletedAt && treatmentPlanStatus === 'COMPLETE' && (
          <p className="mt-1 text-xs text-quiet">
            Marked complete {new Date(treatmentPlanCompletedAt).toLocaleString()}
          </p>
        )}
      </section>

      {versions.length > 1 && (
        <section className="rounded-xl border border-line bg-surface p-4">
          <h3 className="font-display text-base font-semibold text-ink">Version history</h3>
          <ul className="mt-3 space-y-2">
            {versions.map((v) => (
              <li
                key={v.id}
                className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-line px-3 py-2 text-sm"
              >
                <span>
                  v{v.versionNumber}{' '}
                  <span className="text-quiet">
                    · {v.lockState} · {v.artifacts.length} artifacts
                  </span>
                </span>
                {v.isCurrentVersion && (
                  <span className="text-xs font-medium text-brand">Current</span>
                )}
              </li>
            ))}
          </ul>
        </section>
      )}

      <ConfirmDestructiveDialog
        open={lockOpen}
        onOpenChange={setLockOpen}
        title="Lock this assessment version?"
        description="Locked assessments are immutable. Corrections require a new version. This action is audited."
        confirmLabel="Lock assessment"
        pending={pending}
        onConfirm={() => {
          setLockOpen(false)
          startTransition(async () => {
            setError('')
            const res = await lockClinicalAssessment(currentAssessment.id, {
              confirmed: true,
            })
            if (!res.ok) setError(res.error)
            else router.refresh()
          })
        }}
      />

      <ConfirmDestructiveDialog
        open={unlockOpen}
        onOpenChange={setUnlockOpen}
        title="Unlock this assessment?"
        description="Privileged unlock returns the record to draft for correction. Provide a reason — this is audited."
        confirmLabel="Unlock assessment"
        pending={pending}
        onConfirm={() => {
          const reason = window.prompt('Unlock reason (required, audited):')?.trim()
          if (!reason) {
            setError('Unlock reason is required')
            return
          }
          setUnlockOpen(false)
          startTransition(async () => {
            setError('')
            const res = await unlockClinicalAssessment(currentAssessment.id, {
              confirmed: true,
              reason,
            })
            if (!res.ok) setError(res.error)
            else router.refresh()
          })
        }}
      />

      <ConfirmDestructiveDialog
        open={versionOpen}
        onOpenChange={setVersionOpen}
        title="Create correction version?"
        description="Starts a new draft assessment version. The locked version is retained in history."
        confirmLabel="Create version"
        pending={pending}
        onConfirm={() => {
          setVersionOpen(false)
          startTransition(async () => {
            setError('')
            const res = await createClinicalAssessmentVersion(clientId, { confirmed: true })
            if (!res.ok) setError(res.error)
            else router.refresh()
          })
        }}
      />
    </div>
  )
}

function formatSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}
