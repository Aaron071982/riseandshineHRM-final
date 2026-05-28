import { NextResponse } from 'next/server'
import { requireAdminSession } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

export const dynamic = 'force-dynamic'

const PIPELINE_STATUSES = [
  'NEW',
  'REACH_OUT',
  'REACH_OUT_EMAIL_SENT',
  'TO_INTERVIEW',
  'INTERVIEW_SCHEDULED',
  'INTERVIEW_COMPLETED',
] as const

export async function GET() {
  const auth = await requireAdminSession()
  if (auth.response) return auth.response

  try {
    const [hiredCount, pipelineCount, awaitingArtemis, onboardingComplete] = await Promise.all([
      prisma.rBTProfile.count({ where: { status: 'HIRED' } }),
      prisma.rBTProfile.count({ where: { status: { in: [...PIPELINE_STATUSES] } } }),
      prisma.rBTProfile.count({
        where: { status: 'HIRED', artemisTrainingCompleted: false },
      }),
      prisma.rBTProfile.count({ where: { status: 'ONBOARDING_COMPLETED' } }),
    ])

    return NextResponse.json({
      hiredRBTs: hiredCount,
      inPipeline: pipelineCount,
      awaitingArtemis,
      onboardingComplete,
    })
  } catch (e) {
    return NextResponse.json(
      { error: 'Failed to load RBT stats', details: String(e) },
      { status: 500 }
    )
  }
}
