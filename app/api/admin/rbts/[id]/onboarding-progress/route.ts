import { NextResponse } from 'next/server'
import { requireAdminSession } from '@/lib/auth'
import { getOnboardingProgress } from '@/lib/onboarding/progress'

export const dynamic = 'force-dynamic'

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await requireAdminSession()
  if (auth.response) return auth.response

  const { id } = await params
  try {
    const progress = await getOnboardingProgress(id)
    return NextResponse.json({
      completedCount: progress.completedCount,
      totalRbtSteps: progress.totalRbtSteps,
      tierACompleted: progress.tierACompleted,
      tierATotal: progress.tierATotal,
      tierBCompleted: progress.tierBCompleted,
      tierBTotal: progress.tierBTotal,
      tierAComplete: progress.tierAComplete,
      tierBComplete: progress.tierBComplete,
      fullyActivated: progress.fullyActivated,
      backgroundCheckClearedAt: progress.profile.backgroundCheckClearedAt,
      supervisionCountersignedAt: progress.profile.supervisionCountersignedAt,
    })
  } catch (e) {
    console.error('[admin onboarding-progress]', e)
    return NextResponse.json({ error: 'Failed to load progress' }, { status: 500 })
  }
}
