'use client'

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import Link from 'next/link'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import {
  ClipboardList,
  ChevronLeft,
  ChevronRight,
  CheckCircle2,
  Lock,
  Loader2,
} from 'lucide-react'
import { useToast } from '@/components/ui/toast'
import AcknowledgmentFlow from '@/components/onboarding/AcknowledgmentFlow'
import NoticeReceiptFlow from '@/components/onboarding/NoticeReceiptFlow'
import DownloadReuploadFlow from '@/components/onboarding/DownloadReuploadFlow'
import HRInitiatedDocFlow from '@/components/onboarding/HRInitiatedDocFlow'
import DocumentUploadFlow from '@/components/onboarding/DocumentUploadFlow'
import SexualHarassmentQuizFlow from '@/components/onboarding/SexualHarassmentQuizFlow'
import FortyHourTrainingPanel from '@/components/rbt/FortyHourTrainingPanel'
import {
  RBT_VISIBLE_STEPS,
  TOTAL_ONBOARDING_STEPS,
  FORTY_HOUR_RBT_CERTIFICATE_SLUG,
  sortRbtOnboardingSteps,
} from '@/lib/onboarding/catalog'

type StepRow = {
  documentId: string
  stepNumber: number
  title: string
  slug: string
  flowType: string
  tier: string
  category: string
  type: string
  pdfUrl: string | null
  isComplete: boolean
  isLocked: boolean
  completionStatus: string
  downloadedAt: string | null
  hrTask?: {
    id: string
    status: string
    hrFileUrl: string | null
    btFileUrl: string | null
  }
}

type HRDocumentTask = {
  id: string
  documentType: string
  status: string
  hrFileUrl: string | null
  btFileUrl: string | null
}

type ProgressPayload = {
  completedCount: number
  totalRbtSteps: number
  tierACompleted: number
  tierATotal: number
  tierBCompleted: number
  tierBTotal: number
  tierAComplete: boolean
  tierBComplete: boolean
  fullyActivated: boolean
  steps: StepRow[]
}

interface OnboardingWizardProps {
  rbtProfileId: string
  initialDocuments: Array<{
    id: string
    title: string
    slug: string
    type: string
    category: string
    flowType: string
    tier: string
    stepNumber: number | null
    pdfUrl: string | null
  }>
  hrDocumentTasks: HRDocumentTask[]
}

export default function OnboardingWizard({
  rbtProfileId,
  initialDocuments,
  hrDocumentTasks,
}: OnboardingWizardProps) {
  const { showToast } = useToast()
  const [progress, setProgress] = useState<ProgressPayload | null>(null)
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState<string | null>(null)
  const [currentIndex, setCurrentIndex] = useState(0)
  const confettiFired = useRef(false)
  const restoredStep = useRef(false)

  const docById = useMemo(() => new Map(initialDocuments.map((d) => [d.id, d])), [initialDocuments])

  const refresh = useCallback(async () => {
    const res = await fetch('/api/rbt/onboarding/progress', { credentials: 'include' })
    if (!res.ok) {
      setLoadError('Could not load onboarding progress. Try refreshing the page.')
      return
    }
    setLoadError(null)
    const data = await res.json()
    const steps: StepRow[] = sortRbtOnboardingSteps(
      (data.steps as StepRow[]).map((s) => {
        const doc = docById.get(s.documentId)
        const hr = hrDocumentTasks.find((t) => t.documentType === s.slug)
        return {
          ...s,
          pdfUrl: doc?.pdfUrl ?? null,
          hrTask: hr
            ? { id: hr.id, status: hr.status, hrFileUrl: hr.hrFileUrl, btFileUrl: hr.btFileUrl }
            : undefined,
        }
      })
    )
    setProgress({
      completedCount: data.completedCount,
      totalRbtSteps: data.totalRbtSteps,
      tierACompleted: data.tierACompleted,
      tierATotal: data.tierATotal,
      tierBCompleted: data.tierBCompleted,
      tierBTotal: data.tierBTotal,
      tierAComplete: data.tierAComplete,
      tierBComplete: data.tierBComplete,
      fullyActivated: data.fullyActivated,
      steps,
    })
  }, [docById, hrDocumentTasks])

  useEffect(() => {
    refresh().finally(() => setLoading(false))
  }, [refresh])

  useEffect(() => {
    if (!progress || restoredStep.current) return
    restoredStep.current = true
    try {
      const saved = localStorage.getItem(`onboarding-step:${rbtProfileId}`)
      const n = saved ? parseInt(saved, 10) : NaN
      const savedIdx = progress.steps.findIndex((s) => s.stepNumber === n)
      if (savedIdx >= 0) {
        setCurrentIndex(savedIdx)
        return
      }
    } catch {
      /* ignore */
    }
    const fortyIdx = progress.steps.findIndex(
      (s) => s.slug === FORTY_HOUR_RBT_CERTIFICATE_SLUG && !s.isComplete
    )
    if (fortyIdx >= 0) {
      setCurrentIndex(fortyIdx)
      return
    }
    const nextIdx = progress.steps.findIndex((s) => !s.isComplete && !s.isLocked)
    if (nextIdx >= 0) setCurrentIndex(nextIdx)
  }, [rbtProfileId, progress])

  useEffect(() => {
    const step = progress?.steps[currentIndex]
    if (!step) return
    try {
      localStorage.setItem(`onboarding-step:${rbtProfileId}`, String(step.stepNumber))
    } catch {
      /* ignore */
    }
  }, [currentIndex, rbtProfileId, progress])

  const onStepComplete = useCallback(async () => {
    await refresh()
    const p = await fetch('/api/rbt/onboarding/progress', { credentials: 'include' }).then((r) =>
      r.json()
    )
    if (p.tierAComplete && !p.fullyActivated) {
      showToast(
        'Tier A complete — you can be matched with clients while you finish training requirements.',
        'success'
      )
    }
    if (p.fullyActivated && !confettiFired.current) {
      confettiFired.current = true
      import('canvas-confetti').then(({ default: confetti }) => {
        confetti({ particleCount: 120, spread: 70, origin: { y: 0.6 } })
      })
    }
    if (currentIndex < (progress?.steps.length ?? 1) - 1) {
      setCurrentIndex((i) => i + 1)
    }
  }, [refresh, showToast, currentIndex, progress?.steps.length])

  const markDownloaded = useCallback(
    async (documentId: string) => {
      try {
        await fetch(`/api/rbt/onboarding/completions/${documentId}/downloaded`, {
          method: 'PATCH',
          credentials: 'include',
        })
        await refresh()
      } catch {
        /* non-blocking — download still succeeded */
      }
    },
    [refresh]
  )

  if (loading || !progress) {
    return (
      <div className="flex flex-col items-center justify-center py-20 gap-3">
        {loadError ? (
          <>
            <p className="text-red-600 text-sm max-w-md text-center">{loadError}</p>
            <Button onClick={() => { setLoading(true); refresh().finally(() => setLoading(false)) }}>
              Try again
            </Button>
          </>
        ) : (
          <Loader2 className="w-8 h-8 animate-spin text-[#e36f1e]" />
        )}
      </div>
    )
  }

  if (progress.fullyActivated) {
    return (
      <div className="max-w-2xl mx-auto space-y-6 text-center py-12">
        <CheckCircle2 className="w-16 h-16 text-green-600 mx-auto" />
        <h1 className="text-2xl font-bold">Onboarding complete</h1>
        <p className="text-gray-600">All requirements are satisfied. Welcome to the team!</p>
        <Button asChild>
          <Link href="/rbt/dashboard">Go to Dashboard</Link>
        </Button>
      </div>
    )
  }

  if (progress.steps.length === 0) {
    return (
      <Card className="max-w-xl mx-auto">
        <CardContent className="pt-6">
          <p className="text-gray-600">
            Onboarding steps are not configured yet. Ask HR to run the document seed script.
          </p>
        </CardContent>
      </Card>
    )
  }

  const safeIndex = Math.min(Math.max(0, currentIndex), progress.steps.length - 1)
  const current = progress.steps[safeIndex]
  const pct = Math.round((progress.completedCount / RBT_VISIBLE_STEPS) * 100)
  const fortyHourIncomplete = progress.steps.some(
    (s) => s.slug === FORTY_HOUR_RBT_CERTIFICATE_SLUG && !s.isComplete
  )
  const isFortyHourStep = current.slug === FORTY_HOUR_RBT_CERTIFICATE_SLUG

  return (
    <div className="max-w-4xl mx-auto space-y-6 px-4 sm:px-0">
      <div className="flex items-center gap-3">
        <ClipboardList className="w-8 h-8 text-[#e36f1e]" />
        <div>
          <h1 className="text-2xl font-bold">My Tasks</h1>
          <p className="text-sm text-gray-500">
            {progress.completedCount} of {RBT_VISIBLE_STEPS} complete · Tier A: {progress.tierACompleted}/
            {progress.tierATotal} · Tier B: {progress.tierBCompleted}/{progress.tierBTotal}
          </p>
        </div>
      </div>

      <div className="h-2 bg-gray-200 rounded-full overflow-hidden">
        <div className="h-full bg-[#e36f1e] transition-all" style={{ width: `${pct}%` }} />
      </div>

      {fortyHourIncomplete && (
        <div className="rounded-xl border-2 border-amber-400 bg-amber-50 p-4 text-sm text-amber-950 dark:border-amber-600 dark:bg-amber-950/30 dark:text-amber-100">
          <p className="font-semibold">Required first step: 40-hour RBT course</p>
          <p className="mt-1">
            This training is mandatory. You cannot finish onboarding, sit for the RBT exam, or work
            independently with clients until you complete it and upload your certificate. You may
            continue later steps now and come back — onboarding is not complete without it.
          </p>
          <div className="mt-3 flex flex-wrap gap-2">
            <Button
              size="sm"
              className="bg-[#e36f1e] hover:bg-[#c95e18]"
              onClick={() => {
                const idx = progress.steps.findIndex((s) => s.slug === FORTY_HOUR_RBT_CERTIFICATE_SLUG)
                if (idx >= 0) setCurrentIndex(idx)
              }}
            >
              Open 40-hour course step
            </Button>
            <Button asChild size="sm" variant="outline">
              <Link href="/rbt/training">Open 40-Hour tab</Link>
            </Button>
          </div>
        </div>
      )}

      {progress.tierAComplete && !progress.tierBComplete && (
        <div className="rounded-lg border border-green-200 bg-green-50 p-4 text-sm text-green-900">
          Great job! Tier A is complete. You can be matched with clients while you finish Tier B training (
          ~4 hours over 2 weeks).
        </div>
      )}

      <div className="flex flex-wrap gap-2">
        {progress.steps.map((s, i) => (
          <button
            key={s.documentId}
            type="button"
            onClick={() => !s.isLocked && setCurrentIndex(i)}
            disabled={s.isLocked}
            className={`text-xs px-2 py-1 rounded-full border ${
              i === currentIndex
                ? 'bg-[#e36f1e] text-white border-[#e36f1e]'
                : s.isComplete
                  ? 'bg-green-50 border-green-300 text-green-800'
                  : s.isLocked
                    ? 'bg-gray-100 text-gray-400 cursor-not-allowed'
                    : 'bg-white border-gray-300'
            }`}
          >
            {s.isLocked ? <Lock className="w-3 h-3 inline mr-0.5" /> : null}
            {s.slug === FORTY_HOUR_RBT_CERTIFICATE_SLUG ? '40hr' : s.stepNumber}
          </button>
        ))}
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 flex-wrap">
            <span>
              {isFortyHourStep
                ? `First step: ${current.title}`
                : `Step ${current.stepNumber} of ${TOTAL_ONBOARDING_STEPS}: ${current.title}`}
            </span>
            {isFortyHourStep && !current.isComplete && (
              <Badge className="bg-amber-600">Required</Badge>
            )}
            {current.isComplete && <Badge className="bg-green-600">Done</Badge>}
            {current.isLocked && <Badge variant="outline">Locked</Badge>}
          </CardTitle>
        </CardHeader>
        <CardContent>
          {isFortyHourStep ? (
            <FortyHourTrainingPanel
              documentId={current.documentId}
              alreadyComplete={current.isComplete}
              showContinueLink={false}
              onComplete={onStepComplete}
            />
          ) : current.isLocked ? (
            <p className="text-gray-600">Complete earlier steps to unlock this task.</p>
          ) : current.isComplete ? (
            <p className="text-green-700">This step is complete.</p>
          ) : (
            <StepFlow
              current={current}
              onComplete={onStepComplete}
              onMarkDownloaded={() => markDownloaded(current.documentId)}
            />
          )}
        </CardContent>
      </Card>

      <div className="flex justify-between">
        <Button variant="outline" disabled={currentIndex === 0} onClick={() => setCurrentIndex((i) => i - 1)}>
          <ChevronLeft className="w-4 h-4 mr-1" /> Previous
        </Button>
        <Button
          variant="outline"
          disabled={currentIndex >= progress.steps.length - 1}
          onClick={() => setCurrentIndex((i) => i + 1)}
        >
          {isFortyHourStep && fortyHourIncomplete ? 'Continue other tasks' : 'Next'}{' '}
          <ChevronRight className="w-4 h-4 ml-1" />
        </Button>
      </div>
    </div>
  )
}

function StepFlow({
  current,
  onComplete,
  onMarkDownloaded,
}: {
  current: StepRow
  onComplete: () => void
  onMarkDownloaded: () => void
}) {
  const doc = {
    id: current.documentId,
    title: current.title,
    slug: current.slug,
    type: current.type as 'ACKNOWLEDGMENT' | 'FILLABLE_PDF',
    pdfUrl: current.pdfUrl,
  }

  if (current.flowType === 'ESIGN') {
    return (
      <AcknowledgmentFlow
        document={doc}
        completion={
          current.completionStatus === 'COMPLETED'
            ? {
                id: current.documentId,
                documentId: current.documentId,
                status: 'COMPLETED',
                completedAt: new Date().toISOString(),
              }
            : undefined
        }
        onComplete={onComplete}
      />
    )
  }

  if (current.flowType === 'NOTICE') {
    return <NoticeReceiptFlow document={doc} onComplete={onComplete} />
  }

  if (current.flowType === 'NATIVE_FORM' && current.category === 'DOWNLOAD_REUPLOAD') {
    return (
      <DownloadReuploadFlow
        document={doc}
        completion={{
          id: current.documentId,
          documentId: current.documentId,
          status:
            current.completionStatus === 'COMPLETED'
              ? 'COMPLETED'
              : current.completionStatus === 'IN_PROGRESS'
                ? 'IN_PROGRESS'
                : 'NOT_STARTED',
          completedAt: null,
          downloadedAt: current.downloadedAt,
        }}
        onComplete={onComplete}
        onDownload={onMarkDownloaded}
      />
    )
  }

  if (current.flowType === 'NATIVE_FORM' && current.category === 'HR_INITIATED') {
    return (
      <HRInitiatedDocFlow
        document={{
          id: doc.id,
          title: doc.title,
          slug: doc.slug,
          type: 'FILLABLE_PDF',
          pdfUrl: doc.pdfUrl,
        }}
        completion={undefined}
        hrTask={
          current.hrTask
            ? {
                id: current.hrTask.id,
                rbtProfileId: '',
                documentType: current.slug,
                status: current.hrTask.status as 'PENDING_HR' | 'PENDING_BT' | 'PENDING_HR_SIGNOFF' | 'COMPLETE',
                hrFileUrl: current.hrTask.hrFileUrl,
                btFileUrl: current.hrTask.btFileUrl,
              }
            : undefined
        }
        onComplete={onComplete}
        onHrTaskUpdated={onComplete}
      />
    )
  }

  if (current.flowType === 'UPLOAD') {
    return (
      <DocumentUploadFlow
        documentId={current.documentId}
        title={current.title}
        onComplete={onComplete}
      />
    )
  }

  if (current.flowType === 'TRAINING_QUIZ') {
    return (
      <SexualHarassmentQuizFlow
        documentId={current.documentId}
        pdfUrl={current.pdfUrl}
        onComplete={onComplete}
      />
    )
  }

  if (current.flowType === 'BOOKING') {
    return (
      <div className="space-y-4 text-sm text-gray-600">
        <p>
          Artemis training is coordinated by your supervisor. This step will be marked complete once
          training is verified in our system.
        </p>
      </div>
    )
  }

  return <p className="text-gray-500">Unsupported step type.</p>
}
