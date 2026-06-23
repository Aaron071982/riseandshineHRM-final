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
import ArtemisBookingFlow from '@/components/onboarding/ArtemisBookingFlow'
import { RBT_VISIBLE_STEPS, TOTAL_ONBOARDING_STEPS, FORTY_HOUR_RBT_CERTIFICATE_SLUG, FORTY_HOUR_RBT_COURSE_URL } from '@/lib/onboarding/catalog'

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

  const docById = useMemo(() => new Map(initialDocuments.map((d) => [d.id, d])), [initialDocuments])

  const refresh = useCallback(async () => {
    const res = await fetch('/api/rbt/onboarding/progress', { credentials: 'include' })
    if (!res.ok) {
      setLoadError('Could not load onboarding progress. Try refreshing the page.')
      return
    }
    setLoadError(null)
    const data = await res.json()
    const steps: StepRow[] = (data.steps as StepRow[]).map((s) => {
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
    if (data.nextStep != null) {
      const idx = steps.findIndex((s) => s.stepNumber === data.nextStep)
      if (idx >= 0) setCurrentIndex(idx)
    }
  }, [docById, hrDocumentTasks])

  useEffect(() => {
    refresh().finally(() => setLoading(false))
  }, [refresh])

  useEffect(() => {
    try {
      const saved = localStorage.getItem(`onboarding-step:${rbtProfileId}`)
      if (saved && progress) {
        const n = parseInt(saved, 10)
        if (n >= 0 && n < progress.steps.length) setCurrentIndex(n)
      }
    } catch {
      /* ignore */
    }
  }, [rbtProfileId, progress?.steps.length])

  useEffect(() => {
    try {
      localStorage.setItem(`onboarding-step:${rbtProfileId}`, String(currentIndex))
    } catch {
      /* ignore */
    }
  }, [currentIndex, rbtProfileId])

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
            {s.stepNumber}
          </button>
        ))}
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 flex-wrap">
            <span>
              Step {current.stepNumber} of {TOTAL_ONBOARDING_STEPS}: {current.title}
            </span>
            {current.isComplete && <Badge className="bg-green-600">Done</Badge>}
            {current.isLocked && <Badge variant="outline">Locked</Badge>}
          </CardTitle>
        </CardHeader>
        <CardContent>
          {current.isLocked ? (
            <p className="text-gray-600">Complete earlier steps to unlock this task.</p>
          ) : current.isComplete ? (
            <p className="text-green-700">This step is complete.</p>
          ) : (
            <StepFlow current={current} onComplete={onStepComplete} />
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
          Next <ChevronRight className="w-4 h-4 ml-1" />
        </Button>
      </div>
    </div>
  )
}

function StepFlow({ current, onComplete }: { current: StepRow; onComplete: () => void }) {
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
        completion={undefined}
        onComplete={onComplete}
        onDownload={() => {}}
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
    const isFortyHour = current.slug === FORTY_HOUR_RBT_CERTIFICATE_SLUG
    return (
      <DocumentUploadFlow
        documentId={current.documentId}
        title={current.title}
        description={
          isFortyHour
            ? 'Complete the 40-hour RBT training, then upload your certificate of completion.'
            : undefined
        }
        externalCourseUrl={isFortyHour ? FORTY_HOUR_RBT_COURSE_URL : undefined}
        externalCourseLabel="Start 40-Hour RBT Course (Free)"
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
    return <ArtemisBookingFlow />
  }

  return <p className="text-gray-500">Unsupported step type.</p>
}
