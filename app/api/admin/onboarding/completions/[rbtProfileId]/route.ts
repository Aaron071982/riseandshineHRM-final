import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { cookies } from 'next/headers'
import { validateSession } from '@/lib/auth'

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ rbtProfileId: string }> }
) {
  try {
    const { rbtProfileId } = await params
    const cookieStore = await cookies()
    const sessionToken = cookieStore.get('session')?.value

    if (!sessionToken) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const user = await validateSession(sessionToken)
    if (!user || user.role !== 'ADMIN') {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

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

