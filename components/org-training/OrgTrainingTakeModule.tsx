'use client'

import { useRouter } from 'next/navigation'
import { useState, useTransition } from 'react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
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
      <div>
        <a
          href={basePath}
          className="text-sm text-[#e36f1e] hover:underline"
        >
          ← All training
        </a>
        <h1 className="mt-2 text-2xl font-bold text-gray-900 dark:text-[var(--text-primary)]">
          {module.title}
        </h1>
        {module.description ? (
          <p className="mt-2 whitespace-pre-wrap text-sm text-gray-600 dark:text-[var(--text-secondary)]">
            {module.description}
          </p>
        ) : null}
        <div className="mt-3 flex flex-wrap gap-2">
          {module.required ? <Badge variant="secondary">Required</Badge> : null}
          {completed ? (
            <Badge className="bg-emerald-600 hover:bg-emerald-600">
              <CheckCircle2 className="mr-1 h-3 w-3" />
              Completed
              {completedAt
                ? ` · ${new Date(completedAt).toLocaleDateString()}`
                : ''}
            </Badge>
          ) : (
            <Badge variant="outline">Not completed</Badge>
          )}
        </div>
      </div>

      {module.items.map((item) => (
        <Card key={item.id}>
          <CardHeader>
            <CardTitle className="text-base">{item.title}</CardTitle>
          </CardHeader>
          <CardContent>
            {item.type === 'VIDEO_EMBED' &&
            item.embedUrl &&
            isYouTubeNoCookieEmbed(item.embedUrl) ? (
              <div className="aspect-video overflow-hidden rounded-md bg-black">
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
                className="inline-flex items-center gap-1 text-[#e36f1e] underline"
              >
                Open link <ExternalLink className="h-3.5 w-3.5" />
              </a>
            ) : null}
            {item.type === 'FILE' && item.storageObjectPath ? (
              <a
                href={fileHref(item.storageObjectPath)}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1 text-[#e36f1e] underline"
              >
                View file <ExternalLink className="h-3.5 w-3.5" />
              </a>
            ) : null}
            {item.type === 'READING' && item.richTextContent ? (
              <div
                className="prose prose-sm max-w-none dark:prose-invert"
                dangerouslySetInnerHTML={{
                  __html: sanitizeReadingHtml(item.richTextContent),
                }}
              />
            ) : null}
          </CardContent>
        </Card>
      ))}

      {!completed ? (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">
              {module.quiz ? 'Quiz' : 'Attestation'}
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {module.quiz ? (
              <>
                <p className="text-sm text-gray-600">
                  Need {module.quiz.passThreshold} of{' '}
                  {module.quiz.questions.length} correct to pass.
                </p>
                {lastFail ? (
                  <p className="rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-800">
                    Last attempt: {lastFail.score} correct (need{' '}
                    {lastFail.passThreshold}). Try again.
                  </p>
                ) : null}
                {module.quiz.questions.map((q, qi) => (
                  <div key={q.id} className="space-y-2">
                    <p className="font-medium text-sm">
                      {qi + 1}. {q.prompt}
                    </p>
                    <div className="space-y-1">
                      {q.options.map((opt, oi) => (
                        <label
                          key={oi}
                          className="flex items-center gap-2 rounded-md border border-gray-200 px-3 py-2 text-sm dark:border-[var(--border-subtle)]"
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
                <Button onClick={submitQuiz} disabled={pending}>
                  {pending ? (
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  ) : null}
                  Submit quiz
                </Button>
              </>
            ) : (
              <>
                <p className="text-sm text-gray-600">
                  I confirm I have reviewed all materials in this module.
                </p>
                <Button onClick={attest} disabled={pending}>
                  {pending ? (
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  ) : null}
                  Mark complete
                </Button>
              </>
            )}
          </CardContent>
        </Card>
      ) : null}
    </div>
  )
}
