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
  const body = await request.json().catch(() => ({}))
  const clearedAt = body.clearedAt ? new Date(body.clearedAt) : new Date()

  await prisma.rBTProfile.update({
    where: { id },
    data: {
      backgroundCheckClearedAt: clearedAt,
      backgroundCheckClearedBy: auth.user!.id,
    },
  })

  await markAdminStepCompletion(id, 'background-check-cleared')
  await syncTierMilestones(id)
  return NextResponse.json({ success: true })
}
