import { NextRequest, NextResponse } from 'next/server'
import { assertCrmCronOrResponse } from '@/lib/cron-auth'
import { sendCrmTaskDigests } from '@/lib/crm/tasks/taskDigest'
import { crmTaskEmailsEnabled } from '@/lib/crm/tasks/notifications'

export const dynamic = 'force-dynamic'
export const maxDuration = 60

/**
 * Bi-nightly CRM staff task digest (Resend).
 * Schedule: 02:00 UTC every 2 days (vercel.json) — roughly every other night ET.
 * Auth: Authorization: Bearer <CRON_SECRET>
 * Kill-switch: CRM_TASK_EMAILS_ENABLED=true required.
 *
 * Audience: active users with a CrmRole and @riseandshineaba.com email.
 * Includes unread AdminNotifications + overdue / due-24h / open assigned TeamTasks.
 * Never emails RBT portal users without CRM roles.
 */
export async function GET(request: NextRequest) {
  const denied = assertCrmCronOrResponse(request)
  if (denied) return denied

  if (!crmTaskEmailsEnabled()) {
    return NextResponse.json({
      success: true,
      skipped: true,
      reason: 'CRM_TASK_EMAILS_ENABLED is not true',
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
