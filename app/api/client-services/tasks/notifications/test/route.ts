import { NextRequest, NextResponse } from 'next/server'
import { getClientServicesUser } from '@/lib/crm/access'
import { isFullAccess } from '@/lib/crm/access'
import {
  taskEmailsEnabled,
  taskEmailsTestEmail,
  taskEmailsTestSend,
} from '@/lib/crm/tasks/taskEmailConfig'
import { notifyUserViaResend, staffTaskEmailShell } from '@/lib/crm/tasks/notifications'
import { sendCrmTaskDigests } from '@/lib/crm/tasks/taskDigest'
import { makePublicUrl } from '@/lib/baseUrl'

export const dynamic = 'force-dynamic'

/**
 * Dark-launch test send for task notification emails.
 * Requires TASK_EMAILS_ENABLED + TASK_EMAILS_TEST_SEND + TASK_EMAILS_TEST_EMAIL.
 * Full-access CRM users only.
 */
export async function POST(request: NextRequest) {
  try {
    const user = await getClientServicesUser()
    if (!isFullAccess(user)) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    if (!taskEmailsEnabled()) {
      return NextResponse.json(
        { error: 'TASK_EMAILS_ENABLED is false' },
        { status: 400 }
      )
    }
    if (!taskEmailsTestSend()) {
      return NextResponse.json(
        { error: 'TASK_EMAILS_TEST_SEND is false' },
        { status: 400 }
      )
    }
    const testEmail = taskEmailsTestEmail()
    if (!testEmail) {
      return NextResponse.json(
        { error: 'TASK_EMAILS_TEST_EMAIL is not set' },
        { status: 400 }
      )
    }

    let body: { mode?: string } = {}
    try {
      body = await request.json()
    } catch {
      body = {}
    }

    if (body.mode === 'digest') {
      const result = await sendCrmTaskDigests()
      return NextResponse.json({ ok: true, mode: 'digest', result, routedTo: testEmail })
    }

    const html = staffTaskEmailShell(
      'Task notification test',
      `<p style="margin:0;">This is a test assignment-style notification. No task titles or client identifiers are included.</p>
<p style="margin:12px 0 0;font-size:14px;color:#666;">Type: Client-linked task · normal priority</p>`,
      { ctaLabel: 'Open My Tasks', ctaHref: makePublicUrl('/client-services/tasks') }
    )

    const result = await notifyUserViaResend({
      toUserId: user.id,
      subject: 'CRM task notification test',
      html,
      auditAction: 'TASK_NOTIFY_TEST',
      actorUserId: user.id,
    })

    return NextResponse.json({
      ok: result.sent,
      mode: 'assignment',
      routedTo: testEmail,
      reason: result.reason,
    })
  } catch (err) {
    console.error('[task-notifications-test]', err)
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Test send failed' },
      { status: 500 }
    )
  }
}
