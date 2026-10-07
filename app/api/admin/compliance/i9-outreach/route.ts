import { NextRequest, NextResponse } from 'next/server'
import { requireAdminSession } from '@/lib/auth'
import { canAccessDocumentsEmail } from '@/lib/constants'
import {
  getI9OutreachOverview,
  sendDueI9Reminders,
  sendI9CollectionRequest,
  sendI9OutreachTest,
} from '@/lib/compliance/i9Outreach'

export const dynamic = 'force-dynamic'
export const maxDuration = 300

async function requireI9Admin() {
  const auth = await requireAdminSession()
  if (auth.response) return { response: auth.response }
  if (!canAccessDocumentsEmail(auth.user.email)) {
    return { response: NextResponse.json({ error: 'Forbidden' }, { status: 403 }) }
  }
  return { user: auth.user }
}

export async function GET() {
  try {
    const auth = await requireI9Admin()
    if (auth.response) return auth.response
    return NextResponse.json(await getI9OutreachOverview())
  } catch (error) {
    console.error('[i9-outreach] overview failed', error)
    return NextResponse.json({ error: 'Failed to load I-9 outreach' }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  try {
    const auth = await requireI9Admin()
    if (auth.response) return auth.response
    const body = await request.json().catch(() => ({}))

    if (body?.action === 'test') {
      if (!auth.user.email) {
        return NextResponse.json({ error: 'Your admin account has no email address.' }, { status: 400 })
      }
      const firstName = auth.user.name?.trim().split(/\s+/)[0] || 'there'
      const result = await sendI9OutreachTest(
        auth.user.email,
        firstName,
        body.kind === 'reminder' ? 'reminder' : 'request'
      )
      return NextResponse.json(result, { status: result.success ? 200 : 400 })
    }

    if (body?.action === 'send') {
      if (body.confirm !== true) {
        return NextResponse.json({ error: 'Confirmation required.' }, { status: 400 })
      }
      const result = await sendI9CollectionRequest(auth.user.id)
      return NextResponse.json(result, { status: result.success || result.sent > 0 ? 200 : 400 })
    }

    if (body?.action === 'reminders') {
      const result = await sendDueI9Reminders()
      return NextResponse.json(result, { status: result.success || result.sent > 0 ? 200 : 400 })
    }

    return NextResponse.json({ error: 'Unknown action' }, { status: 400 })
  } catch (error) {
    console.error('[i9-outreach] action failed', error)
    return NextResponse.json({ error: 'I-9 outreach action failed' }, { status: 500 })
  }
}
