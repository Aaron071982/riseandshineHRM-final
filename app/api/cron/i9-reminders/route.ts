import { NextRequest, NextResponse } from 'next/server'
import { assertCronOrResponse } from '@/lib/cron-auth'
import { sendDueI9Reminders } from '@/lib/compliance/i9Outreach'

export const dynamic = 'force-dynamic'
export const maxDuration = 300

/**
 * Daily: day-3 / day-7 Form I-9 reminders to staff who received the I-9 request and still have no I-9 on file.
 * Does nothing until an admin has sent the initial request from Compliance → Form I-9.
 */
export async function GET(request: NextRequest) {
  const denied = assertCronOrResponse(request)
  if (denied) return denied
  try {
    return NextResponse.json(await sendDueI9Reminders())
  } catch (error) {
    console.error('[cron/i9-reminders]', error)
    return NextResponse.json({ error: 'Failed to send I-9 reminders' }, { status: 500 })
  }
}
