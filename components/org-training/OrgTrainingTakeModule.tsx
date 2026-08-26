'use client'

import { useRouter } from 'next/navigation'
import { useState, useTransition } from 'react'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { useToast } from '@/components/ui/toast'
import {
  attestOrgTrainingComplete,
  submitOrgTrainingQuiz,
} from '@/lib/org-training/actions'
import type { OrgTrainingModuleDetail } from '@/lib/org-training/load'
import { sanitizeReadingHtml } from '@/lib/org-training/sanitize'
import { isYouTubeNoCookieEmbed } from '@/lib/org-training/youtube'
import { CheckCircle2, ExternalLink, Loader2 } from 'lucide-react'

type Props = {
  module: OrgTrainingModuleDetail
  completed: boolean
  completedAt: string | null
  basePath: string
}

export default function OrgTrainingTakeModule({
  module,
  completed: initiallyCompleted,
  completedAt,
  basePath,
}: Props) {
  const router = useRouter()
  const { showToast } = useToast()
  const [pending, startTransition] = useTransition()
  const [completed, setCompleted] = useState(initiallyCompleted)
  const [answers, setAnswers] = useState<Record<string, number>>({})
  const [lastFail, setLastFail] = useState<{
    score: number
    passThreshold: number
  } | null>(null)

  const fileHref = (path: string) =>
    `/api/training/file/${path.split('/').map(encodeURIComponent).join('/')}`

  const isVideoPath = (path: string) =>
    /\.(mp4|webm|mov|m4v|avi)(\?|$)/i.test(path)

  const attest = () => {
    startTransition(async () => {
      const res = await attestOrgTrainingComplete(module.id)
      if (!res.ok) {
        showToast(res.error, 'error')
        return
      }
      setCompleted(true)
      showToast('Training marked complete', 'success')
      router.refresh()
    })
  }

  const submitQuiz = () => {
    if (!module.quiz) return
    const missing = module.quiz.questions.filter(
      (q) => typeof answers[q.id] !== 'number'
    )
    if (missing.length) {
      showToast('Answer all questions before submitting', 'error')
      return
    }
    startTransition(async () => {
      const res = await submitOrgTrainingQuiz(module.id, answers)
      if (!res.ok) {
        showToast(res.error, 'error')
        return
      }
      if (!res.data.passed) {
        setLastFail({
          score: res.data.score,
          passThreshold: res.data.passThreshold,
        })
        showToast(
          `Score ${res.data.score}/${module.quiz!.questions.length} — need ${res.data.passThreshold} to pass`,
          'error'
        )
        return
      }
      setLastFail(null)
      setCompleted(true)
      showToast(
        `Passed with ${res.data.score}/${module.quiz!.questions.length}`,
        'success'
      )
      router.refresh()
    })
  }

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <div className="overflow-hidden border-2 border-[#e36f1e]/30 bg-white shadow-sm">
        <div className="border-b border-[#e36f1e]/15 bg-[#e36f1e] px-5 py-4 text-white">
          <a
            href={basePath}
            className="text-xs font-semibold uppercase tracking-wide text-white/80 hover:text-white"
          >
            ← Back to Training
          </a>
          <h1 className="mt-2 text-2xl font-bold tracking-tight sm:text-3xl">
            {module.title}
          </h1>
          {module.description ? (
            <p className="mt-2 whitespace-pre-wrap text-sm text-white/90">
              {module.description}
            </p>
          ) : null}
        </div>
        <div className="flex flex-wrap gap-2 px-5 py-3">
          {module.required ? (
            <Badge className="rounded-none bg-[#e36f1e] hover:bg-[#e36f1e]">
              Required
            </Badge>
          ) : null}
          {completed ? (
            <Badge className="rounded-none bg-emerald-600 hover:bg-emerald-600">
              <CheckCircle2 className="mr-1 h-3 w-3" />
              Completed
              {completedAt
                ? ` · ${new Date(completedAt).toLocaleDateString()}`
                : ''}
            </Badge>
          ) : (
            <Badge
              variant="outline"
              className="rounded-none border-amber-400 text-amber-800"
            >
              In progress — finish materials, then mark complete below
            </Badge>
          )}
        </div>
      </div>

      {module.items.map((item) => (
        <div
          key={item.id}
          className="border-2 border-[#e8e0d4] bg-white p-4 shadow-sm sm:p-5"
        >
          <h2 className="mb-3 text-base font-bold text-gray-900">{item.title}</h2>
          <div>
            {item.type === 'VIDEO_EMBED' &&
            item.embedUrl &&
            isYouTubeNoCookieEmbed(item.embedUrl) ? (
              <div className="aspect-video overflow-hidden bg-black">
                <iframe
                  title={item.title}
                  src={item.embedUrl}
                  className="h-full w-full"
                  allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                  allowFullScreen
                />
              </div>
            ) : null}
            {item.type === 'EXTERNAL_LINK' && item.externalUrl ? (
              <a
                href={item.externalUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-2 bg-[#e36f1e] px-4 py-2.5 text-sm font-bold text-white hover:bg-[#c45a1a]"
              >
                Open resource <ExternalLink className="h-4 w-4" />
              </a>
            ) : null}
            {item.type === 'FILE' && item.storageObjectPath ? (
              isVideoPath(item.storageObjectPath) ? (
                <video
                  controls
                  playsInline
                  className="max-h-[28rem] w-full bg-black"
                  src={fileHref(item.storageObjectPath)}
                >
                  Your browser does not support video playback.
                  <a href={fileHref(item.storageObjectPath)}>Download video</a>
                </video>
              ) : (
                <a
                  href={fileHref(item.storageObjectPath)}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-2 bg-[#e36f1e] px-4 py-2.5 text-sm font-bold text-white hover:bg-[#c45a1a]"
                >
                  Open / download file <ExternalLink className="h-4 w-4" />
                </a>
              )
            ) : null}
            {item.type === 'READING' && item.richTextContent ? (
              <div
                className="prose prose-sm max-w-none dark:prose-invert"
                dangerouslySetInnerHTML={{
                  __html: sanitizeReadingHtml(item.richTextContent),
                }}
              />
            ) : null}
          </div>
        </div>
      ))}

      {!completed ? (
        <div className="border-2 border-[#e36f1e] bg-gradient-to-br from-[#fff4eb] to-white p-5 shadow-sm">
          <h2 className="text-lg font-bold text-gray-900">
            {module.quiz ? 'Step 2 — Pass the quiz' : 'Step 2 — Mark complete'}
          </h2>
          <p className="mt-1 text-sm text-gray-600">
            {module.quiz
              ? 'Review the materials above, then answer every question.'
              : 'When you have finished the materials above, confirm below so your progress updates.'}
          </p>
          <div className="mt-4 space-y-4">
            {module.quiz ? (
              <>
                <p className="text-sm text-gray-600">
                  Need {module.quiz.passThreshold} of{' '}
                  {module.quiz.questions.length} correct to pass.
                </p>
                {lastFail ? (
                  <p className="border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-800">
                    Last attempt: {lastFail.score} correct (need{' '}
                    {lastFail.passThreshold}). Try again.
                  </p>
                ) : null}
                {module.quiz.questions.map((q, qi) => (
                  <div key={q.id} className="space-y-2">
                    <p className="text-sm font-medium">
                      {qi + 1}. {q.prompt}
                    </p>
                    <div className="space-y-1">
                      {q.options.map((opt, oi) => (
                        <label
                          key={oi}
                          className="flex items-center gap-2 border border-gray-200 bg-white px-3 py-2 text-sm dark:border-[var(--border-subtle)]"
                        >
                          <input
                            type="radio"
                            name={q.id}
                            checked={answers[q.id] === oi}
                            onChange={() =>
                              setAnswers((prev) => ({ ...prev, [q.id]: oi }))
                            }
                          />
                          {opt}
                        </label>
                      ))}
                    </div>
                  </div>
                ))}
                <Button
                  onClick={submitQuiz}
                  disabled={pending}
                  className="h-11 rounded-none bg-[#e36f1e] px-6 font-bold text-white hover:bg-[#c45a1a]"
                >
                  {pending ? (
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  ) : null}
                  Submit quiz &amp; complete
                </Button>
              </>
            ) : (
              <>
                <p className="text-sm text-gray-700">
                  I attest that I completed this training module.
                </p>
                <Button
                  onClick={attest}
                  disabled={pending}
                  className="h-11 rounded-none bg-[#e36f1e] px-6 font-bold text-white hover:bg-[#c45a1a]"
                >
                  {pending ? (
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  ) : (
                    <CheckCircle2 className="mr-2 h-4 w-4" />
                  )}
                  Mark training complete
                </Button>
              </>
            )}
          </div>
        </div>
      ) : (
        <div className="border-2 border-emerald-300 bg-emerald-50 px-5 py-4 text-emerald-900">
          <p className="flex items-center gap-2 font-bold">
            <CheckCircle2 className="h-5 w-5" />
            You completed this module
          </p>
          <a
            href={basePath}
            className="mt-3 inline-flex bg-emerald-700 px-4 py-2 text-sm font-bold text-white hover:bg-emerald-800"
          >
            Back to Training list
          </a>
        </div>
      )}
    </div>
  )
}
