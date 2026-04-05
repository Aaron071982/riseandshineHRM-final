import { NextRequest, NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import { validateSession } from '@/lib/auth'
import { getClientIpFromRequest } from '@/lib/client-ip'

export async function GET(request: NextRequest) {
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

    const ipAddress = getClientIpFromRequest(request) ?? 'unknown'
    const userAgent = request.headers.get('user-agent') ?? 'unknown'
    const timestamp = new Date().toISOString()

    return NextResponse.json({ ipAddress, userAgent, timestamp })
  } catch (e) {
    console.error('[rbt/client-info]', e)
    return NextResponse.json({ error: 'Failed to read client info' }, { status: 500 })
  }
}
