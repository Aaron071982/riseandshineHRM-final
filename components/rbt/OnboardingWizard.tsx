'use client'

import { useMemo, useState, useCallback, useEffect, useRef } from 'react'
import Link from 'next/link'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Checkbox } from '@/components/ui/checkbox'
import { Label } from '@/components/ui/label'
import {
  ClipboardList,
  ChevronLeft,
  ChevronRight,
  CheckCircle2,
  Circle,
  ExternalLink,
  Download,
  Upload,
  Loader2,
} from 'lucide-react'
import { useToast } from '@/components/ui/toast'
import SignaturePad from '@/components/rbt/SignaturePad'
import AcknowledgmentFlow from '@/components/onboarding/AcknowledgmentFlow'
import FillablePdfFlow from '@/components/onboarding/FillablePdfFlow'

type OnboardingTask = {
  id: string
  taskType: string
  title: string
  description: string | null
  documentDownloadUrl: string | null
  isCompleted: boolean
  sortOrder: number
}

type OnboardingDocument = {
  id: string
  title: string
  slug: string
  type: string
  pdfUrl: string | null
  pdfData: string | null
  sortOrder: number
}

type OnboardingCompletion = {
  id: string
  documentId: string
  status: string
  completedAt: Date | null
  downloadedAt?: Date | null
  document: OnboardingDocument
}

type Step =
  | { kind: 'task'; id: string; title: string; isCompleted: boolean; task: OnboardingTask }
  | { kind: 'document'; id: string; title: string; isCompleted: boolean; document: OnboardingDocument; completion: OnboardingCompletion | undefined }

interface OnboardingWizardProps {
  rbtProfileId: string
  onboardingTasks: OnboardingTask[]
  onboardingDocuments: OnboardingDocument[]
  completions: OnboardingCompletion[]
}

export default function OnboardingWizard({
  rbtProfileId,
  onboardingTasks,
  onboardingDocuments,
  completions,
}: OnboardingWizardProps) {
  const { showToast } = useToast()
  const [currentIndex, setCurrentIndex] = useState(0)
  const [loading, setLoading] = useState(false)
  const [localCompleted, setLocalCompleted] = useState<Set<string>>(new Set())
  const [showAllDone, setShowAllDone] = useState(false)
  const [readConfirmed, setReadConfirmed] = useState<Record<string, boolean>>({})

  const steps = useMemo((): Step[] => {
    const taskSteps: Step[] = onboardingTasks
      .map((t) => ({
        kind: 'task' as const,
        id: t.id,
        title: t.title,
        isCompleted: t.isCompleted,
        task: t,
      }))
      .sort((a, b) => a.task.sortOrder - b.task.sortOrder)
    const docSteps: Step[] = onboardingDocuments
      .map((d) => ({
        kind: 'document' as const,
        id: d.id,
        title: d.title,
        isCompleted: completions.find((c) => c.documentId === d.id)?.status === 'COMPLETED',
        document: d,
        completion: completions.find((c) => c.documentId === d.id),
      }))
      .sort((a, b) => a.document.sortOrder - b.document.sortOrder)
    return [...taskSteps, ...docSteps]
  }, [onboardingTasks, onboardingDocuments, completions])

  const stepCompletionKey = useCallback((step: Step) => {
    return step.kind === 'task' ? `task:${step.task.id}` : `document:${step.document.id}`
  }, [])

  const isStepCompleted = useCallback(
    (step: Step) => {
      if (step.kind === 'task') return step.task.isCompleted || localCompleted.has(stepCompletionKey(step))
      return step.completion?.status === 'COMPLETED' || localCompleted.has(stepCompletionKey(step))
    },
    [localCompleted, stepCompletionKey]
  )

  const currentStep = steps[currentIndex]
  const totalSteps = steps.length
  const completedCount = steps.filter((s) => isStepCompleted(s)).length

  const markTaskComplete = useCallback(async (taskId: string) => {
    setLoading(true)
    try {
      const res = await fetch(`/api/rbt/onboarding-tasks/${taskId}/complete`, { method: 'POST' })
      if (res.ok) {
        setLocalCompleted((prev) => new Set(prev).add(`task:${taskId}`))
        if (currentIndex < steps.length - 1) setCurrentIndex((i) => i + 1)
        else setShowAllDone(true)
        showToast('Step completed', 'success')
      } else {
        const data = await res.json()
        showToast(data.error || 'Failed to complete', 'error')
      }
    } catch {
      showToast('Something went wrong', 'error')
    } finally {
      setLoading(false)
    }
  }, [currentIndex, steps.length, showToast])

  const markSignatureComplete = useCallback(
    async (taskId: string, signatureDataUrl: string) => {
      setLoading(true)
      try {
        const res = await fetch(`/api/rbt/onboarding-tasks/${taskId}/sign`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ signature: signatureDataUrl }),
        })
        if (res.ok) {
          setLocalCompleted((prev) => new Set(prev).add(`task:${taskId}`))
          if (currentIndex < steps.length - 1) setCurrentIndex((i) => i + 1)
          else setShowAllDone(true)
          showToast('Signature saved', 'success')
        } else {
          const data = await res.json()
          showToast(data.error || 'Failed to save signature', 'error')
        }
      } catch {
        showToast('Something went wrong', 'error')
      } finally {
        setLoading(false)
      }
    },
    [currentIndex, steps.length, showToast]
  )

  const handleDocumentStepComplete = useCallback(() => {
    if (!currentStep || currentStep.kind !== 'document') return
    const id = currentStep.document.id
    setLocalCompleted((prev) => new Set(prev).add(`document:${id}`))
    if (currentIndex < steps.length - 1) setCurrentIndex((i) => i + 1)
    else setShowAllDone(true)
    showToast('Step completed', 'success')
  }, [currentStep, currentIndex, steps.length, showToast])

  const markDownloaded = useCallback(async (documentId: string) => {
    try {
      await fetch(`/api/rbt/onboarding/completions/${documentId}/downloaded`, { method: 'PATCH' })
    } catch {
      // non-blocking
    }
  }, [])

  const confettiFired = useRef(false)
  const confettiTimeouts = useRef<ReturnType<typeof setTimeout>[]>([])
  useEffect(() => {
    if (!showAllDone || confettiFired.current) return
    confettiFired.current = true
    import('canvas-confetti').then(({ default: confetti }) => {
      confetti({ particleCount: 120, spread: 70, origin: { y: 0.6 } })
      confettiTimeouts.current.push(
        setTimeout(() => confetti({ particleCount: 80, angle: 60, spread: 55, origin: { x: 0 } }), 200)
      )
      confettiTimeouts.current.push(
        setTimeout(() => confetti({ particleCount: 80, angle: 120, spread: 55, origin: { x: 1 } }), 400)
      )
    })
    return () => {
      const pending = [...confettiTimeouts.current]
      confettiTimeouts.current = []
      pending.forEach(clearTimeout)
    }
  }, [showAllDone])

  if (steps.length === 0) {
    return (
      <div className="max-w-2xl mx-auto space-y-6">
        <h1 className="text-2xl font-bold">My Tasks</h1>
        <Card>
          <CardContent className="pt-6">
            <p className="text-gray-600">No onboarding steps yet. Check back later or contact support.</p>
            <Button asChild className="mt-4">
              <Link href="/rbt/dashboard">Back to Dashboard</Link>
            </Button>
          </CardContent>
        </Card>
      </div>
    )
  }

  if (showAllDone) {
    return (
      <>
        <div className="max-w-2xl mx-auto space-y-6 text-center py-12">
        <div className="inline-flex items-center justify-center w-20 h-20 rounded-full bg-green-100 dark:bg-green-900/30">
          <CheckCircle2 className="w-12 h-12 text-green-600 dark:text-green-400" />
        </div>
        <h1 className="text-2xl font-bold text-gray-900 dark:text-[var(--text-primary)]">All done!</h1>
        <p className="text-gray-600 dark:text-[var(--text-tertiary)]">You’ve completed all onboarding steps.</p>
        <Button asChild size="lg">
          <Link href="/rbt/dashboard">Go to Dashboard</Link>
        </Button>
        </div>
      </>
    )
  }

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      <div className="flex items-center gap-3">
        <ClipboardList className="w-8 h-8 text-[#e36f1e]" />
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-[var(--text-primary)]">My Tasks</h1>
          <p className="text-gray-600 dark:text-[var(--text-tertiary)]">
            Step {currentIndex + 1} of {totalSteps} · {completedCount} completed
          </p>
        </div>
      </div>

      {/* Progress bar */}
      <div className="flex gap-1">
        {steps.map((step, i) => (
          <div
            key={step.id}
            className="h-2 flex-1 rounded-full overflow-hidden bg-gray-200 dark:bg-gray-700"
            title={step.title}
          >
            <div
              className={`h-full transition-all ${
                isStepCompleted(step)
                  ? 'bg-green-500'
                  : i === currentIndex
                    ? 'bg-[#e36f1e]'
                    : 'bg-gray-300 dark:bg-gray-600'
              }`}
              style={{ width: isStepCompleted(step) || i === currentIndex ? '100%' : '0%' }}
            />
          </div>
        ))}
      </div>

      {/* Step list (compact) */}
      <div className="flex flex-wrap gap-2">
        {steps.map((step, i) => (
          <button
            key={step.id}
            type="button"
            onClick={() => setCurrentIndex(i)}
            className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium ${
              i === currentIndex
                ? 'bg-[#e36f1e] text-white'
                : isStepCompleted(step)
                  ? 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300'
                  : 'bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-300'
            }`}
          >
            {isStepCompleted(step) ? <CheckCircle2 className="w-3.5 h-3.5" /> : <Circle className="w-3.5 h-3.5" />}
            {i + 1}
          </button>
        ))}
      </div>

      {/* Current step content */}
      <Card className="dark:bg-[var(--bg-elevated)] dark:border-[var(--border-subtle)]">
        <CardHeader>
          <CardTitle className="text-lg">{currentStep?.title}</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {currentStep?.kind === 'task' && currentStep.task.taskType === 'DOWNLOAD_DOC' && (
            <>
              <p className="text-sm text-gray-600 dark:text-[var(--text-tertiary)]">
                {currentStep.task.description || 'Open the document and review it, then confirm below.'}
              </p>
              {currentStep.task.documentDownloadUrl && (
                <Button asChild variant="outline" size="sm">
                  <a
                    href={currentStep.task.documentDownloadUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-2"
                  >
                    <ExternalLink className="w-4 h-4" />
                    Open document
                  </a>
                </Button>
              )}
              <div className="flex items-center space-x-2 pt-2">
                <Checkbox
                  id={`read-${currentStep.task.id}`}
                  checked={readConfirmed[currentStep.task.id] ?? false}
                  onCheckedChange={(c) =>
                    setReadConfirmed((prev) => ({ ...prev, [currentStep.task.id]: c === true }))
                  }
                />
                <Label htmlFor={`read-${currentStep.task.id}`} className="text-sm">
                  I have read this document
                </Label>
              </div>
              <Button
                disabled={!readConfirmed[currentStep.task.id] || loading}
                onClick={() => markTaskComplete(currentStep.task.id)}
              >
                {loading ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : null}
                Mark complete
              </Button>
            </>
          )}

          {currentStep?.kind === 'task' && currentStep.task.taskType === 'SIGNATURE' && (
            <>
              <p className="text-sm text-gray-600 dark:text-[var(--text-tertiary)]">
                Sign in the box below to confirm you have read and understood the materials.
              </p>
              <SignaturePad
                onSignatureComplete={(dataUrl) => markSignatureComplete(currentStep.task.id, dataUrl)}
                disabled={loading}
              />
            </>
          )}

          {currentStep?.kind === 'task' && currentStep.task.taskType === 'FORTY_HOUR_COURSE_CERTIFICATE' && (
            <FortyHourUpload
              taskId={currentStep.task.id}
              courseUrl={currentStep.task.documentDownloadUrl}
              description={currentStep.task.description}
              onComplete={() => {
                setLocalCompleted((prev) => new Set(prev).add(`task:${currentStep.task.id}`))
                if (currentIndex < steps.length - 1) setCurrentIndex((i) => i + 1)
                else setShowAllDone(true)
                showToast('Certificate uploaded', 'success')
              }}
              loading={loading}
              setLoading={setLoading}
              showToast={showToast}
            />
          )}

          {currentStep?.kind === 'document' && currentStep.document.type === 'ACKNOWLEDGMENT' && (
            <AcknowledgmentFlow
              document={{
                id: currentStep.document.id,
                title: currentStep.document.title,
                slug: currentStep.document.slug,
                type: 'ACKNOWLEDGMENT',
                pdfUrl: currentStep.document.pdfUrl,
                pdfData: currentStep.document.pdfData,
              }}
              completion={
                currentStep.completion
                  ? {
                      id: currentStep.completion.id,
                      documentId: currentStep.completion.documentId,
                      status: currentStep.completion.status as 'NOT_STARTED' | 'IN_PROGRESS' | 'COMPLETED',
                      completedAt: currentStep.completion.completedAt?.toISOString() ?? null,
                    }
                  : undefined
              }
              onComplete={handleDocumentStepComplete}
            />
          )}

          {currentStep?.kind === 'document' && currentStep.document.type === 'FILLABLE_PDF' && (
            <FillablePdfFlowWithDownload
              document={currentStep.document}
              completion={currentStep.completion}
              onComplete={handleDocumentStepComplete}
              onDownload={() => markDownloaded(currentStep.document.id)}
            />
          )}
        </CardContent>
      </Card>

      {/* Nav */}
      <div className="flex justify-between">
        <Button
          variant="outline"
          onClick={() => setCurrentIndex((i) => Math.max(0, i - 1))}
          disabled={currentIndex === 0}
        >
          <ChevronLeft className="w-4 h-4 mr-1" />
          Previous
        </Button>
        {currentIndex < steps.length - 1 && (
          <Button
            variant="outline"
            onClick={() => setCurrentIndex((i) => i + 1)}
          >
            Next
            <ChevronRight className="w-4 h-4 ml-1" />
          </Button>
        )}
      </div>
    </div>
  )
}

/** Same default as hire route / dashboard when task row has no URL yet */
const DEFAULT_RBT_40_HOUR_COURSE_URL =
  'https://courses.autismpartnershipfoundation.org/offers/it285gs6/checkout'

function FortyHourUpload({
  taskId,
  courseUrl,
  description,
  onComplete,
  loading,
  setLoading,
  showToast,
}: {
  taskId: string
  courseUrl: string | null
  description: string | null
  onComplete: () => void
  loading: boolean
  setLoading: (v: boolean) => void
  showToast: (msg: string, type: 'success' | 'error') => void
}) {
  const [file, setFile] = useState<File | null>(null)
  const [uploading, setUploading] = useState(false)

  const handleUpload = async () => {
    if (!file) {
      showToast('Please select a file first', 'error')
      return
    }
    const maxSize = 10 * 1024 * 1024
    if (file.size > maxSize) {
      showToast('File must be under 10MB', 'error')
      return
    }
    const allowed = ['application/pdf', 'image/jpeg', 'image/jpg', 'image/png']
    if (!allowed.includes(file.type)) {
      showToast('Please upload a PDF, JPG, or PNG', 'error')
      return
    }
    setUploading(true)
    setLoading(true)
    try {
      const formData = new FormData()
      formData.append('file', file)
      const res = await fetch(`/api/rbt/onboarding-tasks/${taskId}/upload`, { method: 'POST', body: formData })
      if (res.ok) {
        onComplete()
      } else {
        const data = await res.json()
        showToast(data.error || 'Upload failed', 'error')
      }
    } catch {
      showToast('Upload failed', 'error')
    } finally {
      setUploading(false)
      setLoading(false)
    }
  }

  const href = (courseUrl && courseUrl.trim()) || DEFAULT_RBT_40_HOUR_COURSE_URL

  return (
    <div className="space-y-4">
      <div className="rounded-lg border border-[#e36f1e]/30 bg-orange-50/80 dark:bg-orange-950/25 dark:border-orange-800/50 p-4 space-y-3">
        <p className="text-sm font-medium text-gray-900 dark:text-[var(--text-primary)]">
          Open the 40-hour RBT course (opens in a new tab)
        </p>
        <Button asChild className="bg-[#e36f1e] hover:bg-[#c85f18] text-white">
          <a href={href} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-2">
            <ExternalLink className="w-4 h-4" />
            Access 40-Hour Course
          </a>
        </Button>
      </div>
      {description ? (
        <p className="text-sm text-gray-600 dark:text-[var(--text-tertiary)]">{description}</p>
      ) : (
        <p className="text-sm text-gray-600 dark:text-[var(--text-tertiary)]">
          After you finish the course, upload your certificate of completion below.
        </p>
      )}
      <p className="text-sm text-gray-600 dark:text-[var(--text-tertiary)]">
        Upload your 40-hour RBT course certificate (PDF, JPG, or PNG, max 10MB).
      </p>
      <input
        type="file"
        accept=".pdf,image/jpeg,image/jpg,image/png,application/pdf"
        className="block w-full text-sm text-gray-500 file:mr-4 file:py-2 file:px-4 file:rounded file:border-0 file:bg-[#e36f1e] file:text-white"
        onChange={(e) => setFile(e.target.files?.[0] ?? null)}
      />
      {file && (
        <p className="text-sm text-gray-600">
          Selected: {file.name} ({(file.size / 1024).toFixed(1)} KB)
        </p>
      )}
      <Button onClick={handleUpload} disabled={!file || uploading}>
        {uploading ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <Upload className="w-4 h-4 mr-2" />}
        Upload certificate
      </Button>
    </div>
  )
}

function FillablePdfFlowWithDownload({
  document,
  completion,
  onComplete,
  onDownload,
}: {
  document: OnboardingDocument
  completion: OnboardingCompletion | undefined
  onComplete: () => void
  onDownload: () => void
}) {
  return (
    <FillablePdfFlow
      document={{
        id: document.id,
        title: document.title,
        slug: document.slug,
        type: 'FILLABLE_PDF',
        pdfUrl: document.pdfUrl,
        pdfData: document.pdfData,
      }}
      completion={
        completion
          ? {
              id: completion.id,
              documentId: completion.documentId,
              status: completion.status as 'NOT_STARTED' | 'IN_PROGRESS' | 'COMPLETED',
              completedAt: completion.completedAt?.toISOString() ?? null,
              draftData: undefined,
            }
          : undefined
      }
      onComplete={onComplete}
      onDownload={onDownload}
    />
  )
}
