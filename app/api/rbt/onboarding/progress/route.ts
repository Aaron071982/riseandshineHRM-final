import { NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import { validateSession } from '@/lib/auth'
import { getOnboardingProgress, firstIncompleteStep } from '@/lib/onboarding/progress'

export const dynamic = 'force-dynamic'

export async function GET() {
  try {
    const cookieStore = await cookies()
    const token = cookieStore.get('session')?.value
    if (!token) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const user = await validateSession(token)
    if (!user?.rbtProfileId || (user.role !== 'RBT' && user.role !== 'CANDIDATE')) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    const progress = await getOnboardingProgress(user.rbtProfileId)
    const nextStep = firstIncompleteStep(progress)

    return NextResponse.json({
      ...progress,
      nextStep,
      steps: progress.steps.map((s) => ({
        documentId: s.document.id,
        stepNumber: s.document.stepNumber,
        title: s.document.title,
        slug: s.document.slug,
        flowType: s.document.flowType,
        tier: s.document.tier,
        unlockGroup: s.document.unlockGroup,
        category: s.document.category,
        type: s.document.type,
        pdfUrl: s.document.pdfUrl,
        hasPdf: true,
        isComplete: s.isComplete,
        isLocked: s.isLocked,
        isAvailable: s.isAvailable,
        completionStatus: s.completion?.status ?? 'NOT_STARTED',
      })),
    })
  } catch (e) {
    console.error('[onboarding/progress]', e)
    return NextResponse.json({ error: 'Failed to load progress' }, { status: 500 })
  }
}
