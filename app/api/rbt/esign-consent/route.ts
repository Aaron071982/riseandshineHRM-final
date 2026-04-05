import { NextRequest, NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import { validateSession } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

export async function POST(_request: NextRequest) {
  try {
    const cookieStore = await cookies()
    const sessionToken = cookieStore.get('session')?.value
    if (!sessionToken) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const user = await validateSession(sessionToken)
    if (!user || !user.rbtProfileId) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }
    if (user.role !== 'RBT' && user.role !== 'CANDIDATE') {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    const now = new Date()
    await prisma.userProfile.upsert({
      where: { userId: user.id },
      create: {
        userId: user.id,
        skills: [],
        languages: [],
        eSignConsentGiven: true,
        eSignConsentTimestamp: now,
      },
      update: {
        eSignConsentGiven: true,
        eSignConsentTimestamp: now,
      },
    })

    return NextResponse.json({ success: true, eSignConsentGiven: true, eSignConsentTimestamp: now.toISOString() })
  } catch (e) {
    console.error('[rbt/esign-consent]', e)
    return NextResponse.json({ error: 'Failed to save consent' }, { status: 500 })
  }
}
