'use client'

import { useCallback, useEffect, useRef, useState, useTransition } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { formatDistanceToNow } from 'date-fns'
import {
  AssessmentSectionContent,
  SECTION_NAV,
} from '@/components/crm/assessment/AssessmentSectionContent'
import {
  markTreatmentAssessmentComplete,
  patchTreatmentAssessment,
  saveTreatmentAssessmentSection,
  signTreatmentAssessment,
} from '@/lib/crm/assessment/actions'
import type { AssessmentSectionData, AssessmentSectionKey } from '@/lib/crm/assessment/assessment.schema'
import type { TreatmentAssessmentStatus, TreatmentAssessmentSource } from '@prisma/client'

type AttachmentRecord = {
  id: string
  sectionKey: string
  fileName: string
  mimeType: string
}

type Props = {
  clientId: string
  clientName: string
  assessmentId: string
  status: TreatmentAssessmentStatus
  source: TreatmentAssessmentSource
  initialSections: AssessmentSectionData
  initialUpdatedAt: string
  attachments: AttachmentRecord[]
  canEdit: boolean
}

export function AssessmentFormClient({
  clientId,
  clientName,
  assessmentId,
  status,
  source,
  initialSections,
  initialUpdatedAt,
  attachments: initialAttachments,
  canEdit,
}: Props) {
  const router = useRouter()
  const [sections, setSections] = useState(initialSections)
  const [attachments, setAttachments] = useState(initialAttachments)
  const [activeSection, setActiveSection] = useState<AssessmentSectionKey>('summary')
  const [lastSaved, setLastSaved] = useState(initialUpdatedAt)
  const [savingSection, setSavingSection] = useState<AssessmentSectionKey | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [pending, startTransition] = useTransition()
  const sectionsRef = useRef(sections)
  sectionsRef.current = sections
  const dirtyRef = useRef(false)

  const readOnly = !canEdit || source === 'UPLOAD' || status === 'SIGNED' || status === 'COMPLETED'

  const persist = useCallback(
    async (patch: Partial<AssessmentSectionData>, opts?: { autosave?: boolean; sectionKey?: AssessmentSectionKey }) => {
      const result = await patchTreatmentAssessment(assessmentId, patch, {
        autosave: opts?.autosave,
      })
      if (!result.ok) {
        setError(result.error)
        return false
      }
      setLastSaved(result.updatedAt)
      dirtyRef.current = false
      if (opts?.sectionKey) setSavingSection(null)
      return true
    },
    [assessmentId]
  )

  const scheduleAutosave = useCallback(() => {
    dirtyRef.current = true
  }, [])

  useEffect(() => {
    const id = setInterval(() => {
      if (!dirtyRef.current || readOnly) return
      void persist(sectionsRef.current, { autosave: true })
    }, 25000)
    return () => clearInterval(id)
  }, [persist, readOnly])

  const onBlur = () => scheduleAutosave()

  const onSaveSection = (key: AssessmentSectionKey) => {
    setSavingSection(key)
    setError(null)
    startTransition(async () => {
      const result = await saveTreatmentAssessmentSection(
        assessmentId,
        key,
        sectionsRef.current[key]
      )
      if (!result.ok) {
        setError(result.error)
        setSavingSection(null)
        return
      }
      setLastSaved(result.updatedAt)
      dirtyRef.current = false
      setSavingSection(null)
      router.refresh()
    })
  }

  const onComplete = () => {
    setError(null)
    startTransition(async () => {
      const ok = await persist(sectionsRef.current)
      if (!ok) return
      const result = await markTreatmentAssessmentComplete(assessmentId)
      if (!result.ok) setError(result.error)
      else router.refresh()
    })
  }

  const onSign = () => {
    setError(null)
    startTransition(async () => {
      const result = await signTreatmentAssessment(assessmentId)
      if (!result.ok) setError(result.error)
      else router.refresh()
    })
  }

  const onUploaded = () => {
    router.refresh()
  }

  useEffect(() => {
    setAttachments(initialAttachments)
  }, [initialAttachments])

  return (
    <div className="min-h-screen bg-canvas">
      <header className="sticky top-0 z-20 border-b border-line bg-surface/95 backdrop-blur px-4 py-3">
        <div className="mx-auto flex max-w-7xl flex-wrap items-center justify-between gap-3">
          <div>
            <Link href={`/client-services/clients/${clientId}?tab=assessment`} className="text-sm text-brand hover:underline">
              ← {clientName}
            </Link>
            <h1 className="font-display text-lg font-semibold text-ink">Initial Assessment & Treatment Plan</h1>
            <p className="text-xs text-quiet">
              {status.replace('_', ' ')} · {source} · Last saved{' '}
              {lastSaved ? formatDistanceToNow(new Date(lastSaved), { addSuffix: true }) : 'never'}
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <Link
              href={`/client-services/clients/${clientId}/assessments/${assessmentId}/print`}
              target="_blank"
              className="rounded-md border border-line px-3 py-1.5 text-sm hover:bg-canvas"
            >
              Print / PDF
            </Link>
            {canEdit && source === 'FORM' && status !== 'COMPLETED' && status !== 'SIGNED' && (
              <button type="button" onClick={onComplete} disabled={pending} className="rounded-md bg-brand px-3 py-1.5 text-sm text-white hover:bg-brand/90 disabled:opacity-50">
                Mark complete
              </button>
            )}
            {canEdit && status === 'COMPLETED' && (
              <button type="button" onClick={onSign} disabled={pending} className="rounded-md border border-line px-3 py-1.5 text-sm hover:bg-canvas disabled:opacity-50">
                Sign assessment
              </button>
            )}
          </div>
        </div>
        {error && (
          <p className="mx-auto mt-2 max-w-7xl rounded-lg bg-[var(--urgent-bg)] px-3 py-2 text-sm text-[var(--urgent-fg)]">{error}</p>
        )}
      </header>

      <div className="mx-auto grid max-w-7xl gap-6 p-4 lg:grid-cols-[220px_1fr]">
        <nav className="space-y-1 lg:sticky lg:top-24 lg:self-start">
          {SECTION_NAV.map((s, i) => (
            <button
              key={s.key}
              type="button"
              onClick={() => setActiveSection(s.key)}
              className={`block w-full rounded-md px-3 py-2 text-left text-sm ${
                activeSection === s.key
                  ? 'bg-brand/10 font-medium text-brand'
                  : 'text-quiet hover:bg-canvas hover:text-ink'
              }`}
            >
              {i + 1}. {s.label}
            </button>
          ))}
        </nav>
        <div className="min-w-0">
          <AssessmentSectionContent
            activeSection={activeSection}
            sections={sections}
            setSections={(updater) => {
              setSections(updater)
              scheduleAutosave()
            }}
            readOnly={readOnly}
            onBlur={onBlur}
            onSaveSection={readOnly ? undefined : onSaveSection}
            savingSection={savingSection}
            clientId={clientId}
            assessmentId={assessmentId}
            attachments={attachments}
            onUploaded={onUploaded}
          />
        </div>
      </div>
    </div>
  )
}
