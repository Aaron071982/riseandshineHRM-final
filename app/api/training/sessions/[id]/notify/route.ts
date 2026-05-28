import { NextRequest, NextResponse } from 'next/server'
import { requireTrainingPortalSession } from '@/lib/auth'
import { sendNewSessionAvailableBlast } from '@/lib/training/notifications'

export const dynamic = 'force-dynamic'

export async function POST(
  _request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  const auth = await requireTrainingPortalSession()
  if (auth.response) return auth.response
  const { id } = await context.params
  try {
    const { sent } = await sendNewSessionAvailableBlast(id)
    return NextResponse.json({ sent })
  } catch (e) {
    console.error('[notify]', e)
    return NextResponse.json({ error: String(e) }, { status: 500 })
  }
}
