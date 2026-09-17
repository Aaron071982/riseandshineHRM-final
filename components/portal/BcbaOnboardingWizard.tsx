'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
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
import { bcbaOnboardingPdfUrl } from '@/lib/onboarding/pdf'

type StepRow = {
  documentId: string
  stepNumber: number
  title: string
  slug: string
  flowType: string
  pdfUrl: string | null
  hasPdf: boolean
  isComplete: boolean
  isLocked: boolean
  isAvailable: boolean
  completionStatus: string
  completedAt: string | null
}

type ProgressPayload = {
  completedCount: number
  totalSteps: number
  fullyComplete: boolean
  steps: StepRow[]
}

export default function BcbaOnboardingWizard({ bcbaProfileId }: { bcbaProfileId: string }) {
  const { showToast } = useToast()
  const [progress, setProgress] = useState<ProgressPayload | null>(null)
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState<string | null>(null)
  const [currentIndex, setCurrentIndex] = useState(0)
  const restoredStep = useRef(false)

  const refresh = useCallback(async () => {
    const res = await fetch('/api/bcba/onboarding/progress', { credentials: 'include' })
    if (!res.ok) {
      setLoadError('Could not load onboarding progress. Try refreshing.')
      return
    }
    setLoadError(null)
    const data = await res.json()
    setProgress({
      completedCount: data.completedCount,
      totalSteps: data.totalSteps,
      fullyComplete: data.fullyComplete,
      steps: data.steps as StepRow[],
    })
  }, [])

  useEffect(() => {
    refresh().finally(() => setLoading(false))
  }, [refresh])

  useEffect(() => {
    if (!progress || restoredStep.current) return
    restoredStep.current = true
    try {
      const saved = localStorage.getItem(`bcba-onboarding-step:${bcbaProfileId}`)
      const n = saved ? parseInt(saved, 10) : NaN
      const savedIdx = progress.steps.findIndex((s) => s.stepNumber === n)
      if (savedIdx >= 0) {
        setCurrentIndex(savedIdx)
        return
      }
    } catch {
      // ignore
    }
    const firstOpen = progress.steps.findIndex((s) => !s.isComplete && s.isAvailable)
    if (firstOpen >= 0) setCurrentIndex(firstOpen)
  }, [progress, bcbaProfileId])

  useEffect(() => {
    if (!progress?.steps[currentIndex]) return
    try {
      localStorage.setItem(
        `bcba-onboarding-step:${bcbaProfileId}`,
        String(progress.steps[currentIndex].stepNumber)
      )
    } catch {
      // ignore
    }
  }, [currentIndex, progress, bcbaProfileId])

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20 text-quiet">
        <Loader2 className="h-6 w-6 animate-spin mr-2" />
        Loading onboarding…
      </div>
    )
  }

  if (loadError || !progress) {
    return (
      <Card>
        <CardContent className="py-10 text-center text-sm text-red-600">
          {loadError || 'Failed to load'}
          <div className="mt-4">
            <Button variant="outline" onClick={() => void refresh()}>
              Retry
            </Button>
          </div>
        </CardContent>
      </Card>
    )
  }

  if (progress.totalSteps === 0) {
    return (
      <Card>
        <CardContent className="py-12 text-center text-quiet">
          No onboarding documents have been published yet. HR will add them soon.
        </CardContent>
      </Card>
    )
  }

  const step = progress.steps[currentIndex]
  const pct =
    progress.totalSteps > 0
      ? Math.round((progress.completedCount / progress.totalSteps) * 100)
      : 0

  return (
    <div className="space-y-6">
      <Card className="border-line bg-surface">
        <CardHeader className="pb-3">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-2">
              <ClipboardList className="h-5 w-5 text-[var(--sunrise)]" />
              <CardTitle className="text-lg text-[var(--espresso)]">BCBA onboarding</CardTitle>
            </div>
            <Badge variant="outline">
              {progress.completedCount}/{progress.totalSteps} complete ({pct}%)
            </Badge>
          </div>
          <div className="mt-3 h-2 rounded-full bg-canvas overflow-hidden">
            <div
              className="h-full rounded-full bg-[var(--sunrise)] transition-all"
              style={{ width: `${pct}%` }}
            />
          </div>
        </CardHeader>
      </Card>

      <div className="flex flex-wrap gap-2">
        {progress.steps.map((s, i) => (
          <button
            key={s.documentId}
            type="button"
            disabled={s.isLocked}
            onClick={() => setCurrentIndex(i)}
            className={`inline-flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-xs border ${
              i === currentIndex
                ? 'border-[var(--sunrise)] bg-[color-mix(in_srgb,var(--sunrise)_12%,white)] text-[var(--espresso)]'
                : s.isComplete
                  ? 'border-emerald-200 bg-emerald-50 text-emerald-800'
                  : s.isLocked
                    ? 'border-line text-quiet opacity-60 cursor-not-allowed'
                    : 'border-line hover:bg-canvas'
            }`}
          >
            {s.isComplete ? (
              <CheckCircle2 className="h-3.5 w-3.5" />
            ) : s.isLocked ? (
              <Lock className="h-3.5 w-3.5" />
            ) : null}
            {s.stepNumber}. {s.title}
          </button>
        ))}
      </div>

      {step ? (
        <div className="space-y-4">
          <div className="flex items-center justify-between gap-3">
            <h2 className="font-display text-xl text-[var(--espresso)]">
              Step {step.stepNumber}: {step.title}
            </h2>
            <div className="flex gap-2">
              <Button
                variant="outline"
                size="sm"
                disabled={currentIndex === 0}
                onClick={() => setCurrentIndex((i) => Math.max(0, i - 1))}
              >
                <ChevronLeft className="h-4 w-4" />
              </Button>
              <Button
                variant="outline"
                size="sm"
                disabled={currentIndex >= progress.steps.length - 1}
                onClick={() =>
                  setCurrentIndex((i) => Math.min(progress.steps.length - 1, i + 1))
                }
              >
                <ChevronRight className="h-4 w-4" />
              </Button>
            </div>
          </div>

          {step.isLocked ? (
            <Card>
              <CardContent className="py-10 text-center text-quiet">
                Complete earlier steps to unlock this document.
              </CardContent>
            </Card>
          ) : !step.hasPdf ? (
            <Card>
              <CardContent className="py-10 text-center text-quiet">
                HR has not uploaded this PDF yet. Check back soon.
              </CardContent>
            </Card>
          ) : step.flowType === 'ESIGN' ? (
            <AcknowledgmentFlow
              document={{
                id: step.documentId,
                title: step.title,
                slug: step.slug,
                type: 'ACKNOWLEDGMENT',
                pdfUrl: step.pdfUrl,
              }}
              completion={
                step.isComplete
                  ? {
                      id: step.documentId,
                      documentId: step.documentId,
                      status: 'COMPLETED',
                      completedAt: step.completedAt,
                    }
                  : undefined
              }
              acknowledgeUrl="/api/bcba/onboarding/acknowledge"
              pdfFetchUrl={bcbaOnboardingPdfUrl(step.documentId)}
              onComplete={() => {
                void refresh().then(() => {
                  showToast('Document signed', 'success')
                  const next = progress.steps.findIndex(
                    (s, i) => i > currentIndex && !s.isComplete && !s.isLocked
                  )
                  if (next >= 0) setCurrentIndex(next)
                })
              }}
            />
          ) : (
            <Card>
              <CardContent className="py-10 text-center text-quiet">
                This document type is not available in the portal yet.
              </CardContent>
            </Card>
          )}
        </div>
      ) : null}

      {progress.fullyComplete ? (
        <Card className="border-emerald-200 bg-emerald-50/60">
          <CardContent className="py-6 text-center text-emerald-800 font-medium">
            Onboarding complete — thank you.
          </CardContent>
        </Card>
      ) : null}
    </div>
  )
}
