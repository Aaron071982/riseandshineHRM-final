import { NextRequest, NextResponse } from 'next/server'
import { assertCrmCronOrResponse } from '@/lib/cron-auth'
import { sendCrmTaskDigests } from '@/lib/crm/tasks/taskDigest'
import { taskEmailsEnabled } from '@/lib/crm/tasks/taskEmailConfig'

export const dynamic = 'force-dynamic'
export const maxDuration = 60

/**
 * Nightly CRM staff task digest (Resend).
 * Schedule: 02:00 UTC daily — per-user cadence (default every 2 nights) from task_notification_logs.
 * Auth: Authorization: Bearer <CRON_SECRET>
 * Kill-switch: TASK_EMAILS_ENABLED=false (default).
 *
 * Task source: team_tasks (assigned, open statuses). Messages seam: admin_notifications unread count.
 */
export async function GET(request: NextRequest) {
  const denied = assertCrmCronOrResponse(request)
  if (denied) return denied

  if (!taskEmailsEnabled()) {
    return NextResponse.json({
      success: true,
      skipped: true,
      reason: 'TASK_EMAILS_ENABLED is false',
    })
  }

  try {
    const result = await sendCrmTaskDigests()
    return NextResponse.json({ success: true, ...result })
  } catch (err) {
    console.error('[crm-task-digest]', err)
    return NextResponse.json(
      { success: false, error: err instanceof Error ? err.message : 'Digest failed' },
      { status: 500 }
    )
  }
}
