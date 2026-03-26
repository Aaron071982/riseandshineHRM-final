import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { cookies } from 'next/headers'
import { validateSession } from '@/lib/auth'

/** PATCH: set downloadedAt on the onboarding completion for this RBT + document (for fillable PDF tracking). */
export async function PATCH(
  _request: NextRequest,
  { params }: { params: Promise<{ documentId: string }> }
) {
  const { documentId } = await params
  try {
    const cookieStore = await cookies()
    const sessionToken = cookieStore.get('session')?.value

    if (!sessionToken) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const user = await validateSession(sessionToken)
    if (!user || (user.role !== 'RBT' && user.role !== 'CANDIDATE') || !user.rbtProfileId) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    await prisma.onboardingCompletion.upsert({
      where: {
        rbtProfileId_documentId: {
          rbtProfileId: user.rbtProfileId,
          documentId,
        },
      },
      update: { downloadedAt: new Date(), status: 'IN_PROGRESS' },
      create: {
        rbtProfileId: user.rbtProfileId,
        documentId,
        status: 'IN_PROGRESS',
        downloadedAt: new Date(),
      },
    })

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('[rbt/onboarding/completions] mark downloaded error:', error)
    return NextResponse.json(
      { error: 'Failed to mark document as downloaded' },
      { status: 500 }
    )
  }
}
