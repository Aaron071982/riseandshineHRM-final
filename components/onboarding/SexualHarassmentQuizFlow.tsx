'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Loader2, RotateCcw } from 'lucide-react'
import { useToast } from '@/components/ui/toast'
import OnboardingPdfViewer from '@/components/onboarding/OnboardingPdfViewer'
import {
  QUIZ_PASS_SCORE,
  QUIZ_TOTAL_QUESTIONS,
  SEXUAL_HARASSMENT_QUIZ_QUESTIONS,
  type QuizQuestion,
} from '@/lib/onboarding/quiz-questions'

function shuffle<T>(arr: T[]): T[] {
  const a = [...arr]
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1))
    ;[a[i], a[j]] = [a[j], a[i]]
  }
  return a
}

type Props = {
  documentId: string
  pdfUrl: string | null
  onComplete: () => void
}

type QuizPhase = 'training' | 'quiz' | 'failed' | 'done'

export default function SexualHarassmentQuizFlow({ documentId, pdfUrl, onComplete }: Props) {
  const { showToast } = useToast()
  const [phase, setPhase] = useState<QuizPhase>('training')
  const [quizKey, setQuizKey] = useState(0)
  const [scrolled, setScrolled] = useState(false)
  const [loading, setLoading] = useState(true)
  const [submitting, setSubmitting] = useState(false)
  const [locked, setLocked] = useState(false)
  const [failResult, setFailResult] = useState<{
    score: number
    percentScore: number
    attemptNumber: number
  } | null>(null)
  const [wrong, setWrong] = useState<
    Array<{ questionId: number; correctOptionId: string; explanation: string }>
  >([])
  const [answers, setAnswers] = useState<Record<string, string>>({})

  const passPercent = Math.round((QUIZ_PASS_SCORE / QUIZ_TOTAL_QUESTIONS) * 100)

  const questions = useMemo(() => {
    return shuffle(SEXUAL_HARASSMENT_QUIZ_QUESTIONS).map((q) => ({
      ...q,
      options: shuffle(q.options),
    }))
  }, [quizKey])

  const loadStatus = useCallback(async () => {
    setLoading(true)
    try {
      const res = await fetch('/api/rbt/onboarding/quiz/status', { credentials: 'include' })
      const data = await res.json()
      if (data.passed || data.locked) {
        setLocked(true)
        setPhase('done')
        onComplete()
        return
      }
      if (data.lastScore != null && data.lastPassed === false) {
        setFailResult({
          score: data.lastScore,
          percentScore: data.lastPercent ?? Math.round((data.lastScore / QUIZ_TOTAL_QUESTIONS) * 100),
          attemptNumber: data.attemptCount ?? 1,
        })
        setPhase('failed')
      }
    } finally {
      setLoading(false)
    }
  }, [onComplete])

  useEffect(() => {
    loadStatus()
  }, [loadStatus])

  const submitQuiz = async () => {
    const unanswered = questions.filter((q) => !answers[String(q.id)])
    if (unanswered.length > 0) {
      showToast('Please answer all questions before submitting', 'error')
      return
    }

    setSubmitting(true)
    setWrong([])
    try {
      const res = await fetch('/api/rbt/onboarding/quiz/submit', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ answers }),
      })
      const data = await res.json()
      if (!res.ok) {
        showToast(data.error || 'Submit failed', 'error')
        return
      }
      if (data.passed) {
        showToast(`Passed with ${data.percentScore}%`, 'success')
        setLocked(true)
        setPhase('done')
        onComplete()
        return
      }
      setFailResult({
        score: data.score,
        percentScore: data.percentScore,
        attemptNumber: data.attemptNumber,
      })
      setWrong(data.wrong ?? [])
      setPhase('failed')
    } catch {
      showToast('Submit failed', 'error')
    } finally {
      setSubmitting(false)
    }
  }

  const retakeQuiz = () => {
    setAnswers({})
    setWrong([])
    setFailResult(null)
    setQuizKey((k) => k + 1)
    setPhase('quiz')
  }

  if (loading) {
    return (
      <div className="flex justify-center py-12">
        <Loader2 className="w-8 h-8 animate-spin text-[#e36f1e]" />
      </div>
    )
  }

  if (phase === 'training') {
    return (
      <div className="space-y-4">
        <OnboardingPdfViewer
          documentId={documentId}
          pdfUrl={pdfUrl}
          title="Sexual Harassment Prevention Training"
          onScrolledToBottom={() => setScrolled(true)}
        />
        <Button disabled={!scrolled} onClick={() => setPhase('quiz')} className="bg-[#e36f1e]">
          Continue to quiz
        </Button>
      </div>
    )
  }

  if (phase === 'done' || locked) {
    return (
      <Card>
        <CardContent className="pt-6 text-green-700 font-medium">
          Training and quiz completed. Certificate saved to your file. This step is locked — no
          retakes needed.
        </CardContent>
      </Card>
    )
  }

  if (phase === 'failed' && failResult) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="text-lg text-red-700">Quiz not passed</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <p className="text-gray-700">
            Your score: <strong>{failResult.percentScore}%</strong> ({failResult.score}/
            {QUIZ_TOTAL_QUESTIONS} correct) — attempt #{failResult.attemptNumber}.
          </p>
          <p className="text-gray-700">
            You need <strong>{passPercent}%</strong> ({QUIZ_PASS_SCORE}/{QUIZ_TOTAL_QUESTIONS}) or
            higher to pass. Review the training material if needed, then retake the quiz when you are
            ready.
          </p>
          <Button onClick={retakeQuiz} className="bg-[#e36f1e]">
            <RotateCcw className="w-4 h-4 mr-2" />
            Retake Quiz
          </Button>
        </CardContent>
      </Card>
    )
  }

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">
            Quiz — {passPercent}% required ({QUIZ_PASS_SCORE}/{QUIZ_TOTAL_QUESTIONS})
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-6">
          {questions.map((q: QuizQuestion, idx) => (
            <div key={q.id} className="space-y-2 border-b pb-4 last:border-0">
              <p className="font-medium text-sm">
                {idx + 1}. {q.question}
              </p>
              <div className="space-y-2">
                {q.options.map((opt) => (
                  <label key={opt.id} className="flex items-center gap-2 text-sm cursor-pointer">
                    <input
                      type="radio"
                      name={`q-${q.id}-${quizKey}`}
                      checked={answers[String(q.id)] === opt.id}
                      onChange={() => setAnswers((prev) => ({ ...prev, [String(q.id)]: opt.id }))}
                    />
                    {opt.label}
                  </label>
                ))}
              </div>
              {wrong.find((w) => w.questionId === q.id) && (
                <p className="text-sm text-red-600">
                  Correct: {q.options.find((o) => o.id === q.correctOptionId)?.label}.{' '}
                  {wrong.find((w) => w.questionId === q.id)?.explanation}
                </p>
              )}
            </div>
          ))}
          <Button onClick={submitQuiz} disabled={submitting} className="bg-[#e36f1e]">
            {submitting ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : null}
            Submit quiz
          </Button>
        </CardContent>
      </Card>
    </div>
  )
}
