import { NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import { validateSession } from '@/lib/auth'
import { getBcbaOnboardingProgress } from '@/lib/onboarding/bcbaProgress'

export const dynamic = 'force-dynamic'

export async function GET() {
  try {
    const cookieStore = await cookies()
    const token = cookieStore.get('session')?.value
    if (!token) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const user = await validateSession(token)
    if (!user?.bcbaProfileId || user.role !== 'BCBA') {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    const progress = await getBcbaOnboardingProgress(user.bcbaProfileId)
    const nextStep = progress.steps.find((s) => !s.isComplete && s.isAvailable) ?? null

    return NextResponse.json({
      completedCount: progress.completedCount,
      totalSteps: progress.totalSteps,
      fullyComplete: progress.fullyComplete,
      nextStepNumber: nextStep
        ? progress.steps.findIndex((s) => s.document.id === nextStep.document.id) + 1
        : null,
      steps: progress.steps.map((s, i) => ({
        documentId: s.document.id,
        stepNumber: i + 1,
        title: s.document.title,
        slug: s.document.slug,
        flowType: s.document.flowType,
        pdfUrl: s.document.pdfUrl,
        hasPdf: !!(s.document.pdfData || s.document.pdfUrl),
        isComplete: s.isComplete,
        isLocked: s.isLocked,
        isAvailable: s.isAvailable,
        completionStatus: s.completion?.status ?? 'NOT_STARTED',
        completedAt: s.completion?.completedAt?.toISOString() ?? null,
      })),
    })
  } catch (e) {
    console.error('[bcba/onboarding/progress]', e)
    return NextResponse.json({ error: 'Failed to load progress' }, { status: 500 })
  }
}
