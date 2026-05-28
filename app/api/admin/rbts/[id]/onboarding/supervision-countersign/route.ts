import { NextRequest, NextResponse } from 'next/server'
import { requireAdminSession } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { syncTierMilestones } from '@/lib/onboarding/progress'
import { markAdminStepCompletion } from '@/lib/onboarding/admin-activation'

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await requireAdminSession()
  if (auth.response) return auth.response

  const { id } = await params

  await prisma.rBTProfile.update({
    where: { id },
    data: {
      supervisionCountersignedAt: new Date(),
      supervisionCountersignedBy: auth.user!.id,
      supervisionContractStatus: 'COUNTERSIGNED',
    },
  })

  await markAdminStepCompletion(id, 'supervision-countersigned')
  await syncTierMilestones(id)
  return NextResponse.json({ success: true })
}
