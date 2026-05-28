import { NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import { validateSession } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { QUIZ_TOTAL_QUESTIONS } from '@/lib/onboarding/quiz-questions'

export const dynamic = 'force-dynamic'

export async function GET() {
  try {
    const cookieStore = await cookies()
    const token = cookieStore.get('session')?.value
    if (!token) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const user = await validateSession(token)
    if (!user?.rbtProfileId) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

    const doc = await prisma.onboardingDocument.findFirst({
      where: { slug: 'sexual-harassment-training', isActive: true },
    })
    if (!doc) return NextResponse.json({ error: 'Training not configured' }, { status: 404 })

    const [attempts, certificate, completion] = await Promise.all([
      prisma.onboardingQuizAttempt.findMany({
        where: { rbtProfileId: user.rbtProfileId, documentId: doc.id },
        orderBy: { attemptedAt: 'asc' },
        select: {
          id: true,
          score: true,
          totalQuestions: true,
          passed: true,
          attemptedAt: true,
          answersJson: true,
        },
      }),
      prisma.onboardingQuizCertificate.findFirst({
        where: { rbtProfileId: user.rbtProfileId, documentId: doc.id },
        orderBy: { completedAt: 'desc' },
      }),
      prisma.onboardingCompletion.findUnique({
        where: {
          rbtProfileId_documentId: { rbtProfileId: user.rbtProfileId, documentId: doc.id },
        },
      }),
    ])

    const passed = !!certificate || completion?.status === 'COMPLETED'
    const lastAttempt = attempts.length > 0 ? attempts[attempts.length - 1] : null
    const lastPercent = lastAttempt
      ? Math.round((lastAttempt.score / (lastAttempt.totalQuestions || QUIZ_TOTAL_QUESTIONS)) * 100)
      : null

    const attemptHistory = attempts.map((a, index) => {
      const json = a.answersJson as { attemptNumber?: number } | null
      return {
        attemptNumber: json?.attemptNumber ?? index + 1,
        score: a.score,
        total: a.totalQuestions,
        percentScore: Math.round((a.score / a.totalQuestions) * 100),
        passed: a.passed,
        attemptedAt: a.attemptedAt.toISOString(),
      }
    })

    return NextResponse.json({
      passed,
      locked: passed,
      lastScore: lastAttempt?.score ?? null,
      lastPercent,
      lastPassed: lastAttempt?.passed ?? null,
      attemptCount: attempts.length,
      attempts: attemptHistory,
      certificate: certificate
        ? {
            completedAt: certificate.completedAt,
            score: certificate.score,
            nextRequiredAt: certificate.nextRequiredAt,
          }
        : null,
    })
  } catch (e) {
    console.error('[quiz/status]', e)
    return NextResponse.json({ error: 'Failed to load quiz status' }, { status: 500 })
  }
}
