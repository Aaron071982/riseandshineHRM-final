import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { requireAdminSession } from '@/lib/auth'

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ rbtProfileId: string }> }
) {
  try {
    const { rbtProfileId } = await params
    const auth = await requireAdminSession()
    if (auth.response) return auth.response
    const user = auth.user

    // Get all completions for this RBT
    const completions = await prisma.onboardingCompletion.findMany({
      where: { rbtProfileId },
      include: {
        document: true,
      },
      orderBy: {
        createdAt: 'desc',
      },
    })

    return NextResponse.json({ completions })
  } catch (error: any) {
    console.error('Error fetching onboarding completions:', error)
    return NextResponse.json(
      { error: 'Failed to fetch completions' },
      { status: 500 }
    )
  }
}

