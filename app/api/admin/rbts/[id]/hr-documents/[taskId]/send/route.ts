import { NextRequest, NextResponse } from 'next/server'
import { requireAdminSession } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import {
  findHrDocumentTaskForSend,
  isMissingEmailColumnError,
} from '@/lib/onboarding/hr-tasks'
import { generateLs54HrPdfForRbt } from '@/lib/onboarding/ls54-hr-send'
import { LS54_SLUG, formatOvertimeRate, parseHourlyRate } from '@/lib/onboarding/ls54'
import { sendGenericEmail, generateOnboardingDocumentsNotifyEmail } from '@/lib/email'
import { makePublicUrl } from '@/lib/baseUrl'

export const dynamic = 'force-dynamic'
export const maxDuration = 60

const EMAIL_FAILURE_WARNING =
  'Document sent, but email notification failed. Please follow up manually.'

function errorMessage(err: unknown): string {
  return err instanceof Error ? err.message : String(err)
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; taskId: string }> }
) {
  try {
    const auth = await requireAdminSession()
    if (auth.response) return auth.response
    const adminUser = auth.user!

    const { id: rbtProfileId, taskId } = await params
    const body = await request.json().catch(() => ({}))
    const employeeRateOfPay =
      typeof body.employeeRateOfPay === 'string' ? body.employeeRateOfPay.trim() : ''

    const hourly = parseHourlyRate(employeeRateOfPay)
    if (!hourly) {
      return NextResponse.json({ error: 'Enter a valid hourly rate of pay' }, { status: 400 })
    }

    const overtimeRate = formatOvertimeRate(hourly)

    const [task, profile] = await Promise.all([
      findHrDocumentTaskForSend(taskId, rbtProfileId),
      prisma.rBTProfile.findUnique({
        where: { id: rbtProfileId },
        select: { id: true, firstName: true, lastName: true, email: true },
      }),
    ])

    if (!task || !profile) {
      return NextResponse.json({ error: 'Not found' }, { status: 404 })
    }

    if (task.documentType !== LS54_SLUG) {
      return NextResponse.json({ error: 'This action is only supported for LS-54' }, { status: 400 })
    }

    if (task.status !== 'PENDING_HR') {
      return NextResponse.json(
        { error: 'Document was already sent to the RBT' },
        { status: 400 }
      )
    }

    const employeeName = `${profile.firstName} ${profile.lastName}`.trim()
    const generated = await generateLs54HrPdfForRbt(rbtProfileId, {
      employeeName,
      employeeRateOfPay,
      overtimeRate,
    })

    if (!generated.ok) {
      return NextResponse.json(
        { error: generated.error, details: generated.details },
        { status: 500 }
      )
    }

    if (generated.buffer.length > 15 * 1024 * 1024) {
      return NextResponse.json({ error: 'Generated PDF is too large' }, { status: 500 })
    }

    const storagePath = generated.storagePath
    const now = new Date()
    const formMeta = {
      employeeRateOfPay: String(hourly),
      overtimeRate,
      employeeName,
      sentAt: now.toISOString(),
      sentBy: adminUser.email ?? adminUser.id,
    }

    let updated = await prisma.hRDocumentTask.update({
      where: { id: taskId },
      data: {
        status: 'PENDING_BT',
        hrFileUrl: storagePath,
        hrUploadedAt: now,
        hrUploadedBy: adminUser.email ?? adminUser.id,
        notes: JSON.stringify(formMeta),
      },
      select: {
        id: true,
        documentType: true,
        status: true,
        hrFileUrl: true,
        hrUploadedAt: true,
        notes: true,
      },
    })

    const doc = await prisma.onboardingDocument.findUnique({
      where: { slug: LS54_SLUG },
      select: { title: true },
    })
    const docTitle = doc?.title ?? 'NYS Wage Notice (LS-54)'
    const portalUrl = makePublicUrl('/rbt/tasks')
    const messageText = `Your ${docTitle} is ready. Please open My Tasks, download the HR-prepared form, sign it, and upload your completed copy.`

    try {
      await prisma.rBTMessage.create({
        data: {
          rbtProfileId,
          senderRole: 'ADMIN',
          message: messageText,
        },
      })
    } catch (msgErr) {
      console.error('[hr-documents/send] in-app message failed (document still sent)', msgErr)
    }

    let emailWarning: string | undefined

    if (profile.email?.trim()) {
      const { subject, html } = generateOnboardingDocumentsNotifyEmail(
        profile.firstName,
        portalUrl
      )
      const sent = await sendGenericEmail(profile.email.trim(), subject, html)
      if (sent) {
        try {
          updated = await prisma.hRDocumentTask.update({
            where: { id: taskId },
            data: { emailSent: true, emailSentAt: new Date() },
            select: {
              id: true,
              documentType: true,
              status: true,
              hrFileUrl: true,
              hrUploadedAt: true,
              notes: true,
              emailSent: true,
              emailSentAt: true,
            },
          })
        } catch (emailColErr) {
          if (!isMissingEmailColumnError(emailColErr)) throw emailColErr
          console.error('[hr-documents/send] emailSent columns missing', emailColErr)
        }
      } else {
        console.error('[hr-documents/send] notify email failed', {
          rbtProfileId,
          email: profile.email,
        })
        emailWarning = EMAIL_FAILURE_WARNING
      }
    } else {
      console.error('[hr-documents/send] RBT has no email on file', { rbtProfileId })
      emailWarning = EMAIL_FAILURE_WARNING
    }

    return NextResponse.json({
      hrTask: {
        ...updated,
        hrUploadedAt: updated.hrUploadedAt?.toISOString() ?? null,
        emailSentAt:
          'emailSentAt' in updated && updated.emailSentAt instanceof Date
            ? updated.emailSentAt.toISOString()
            : null,
        emailSent: 'emailSent' in updated ? Boolean(updated.emailSent) : false,
      },
      emailSent: 'emailSent' in updated ? Boolean(updated.emailSent) : false,
      emailSentAt:
        'emailSentAt' in updated && updated.emailSentAt instanceof Date
          ? updated.emailSentAt.toISOString()
          : null,
      ...(emailWarning ? { emailWarning } : {}),
    })
  } catch (err) {
    console.error('[hr-documents/send]', err)
    const message = errorMessage(err)
    const missingEmailCols =
      message.includes('emailSent') || message.includes('email_sent')

    return NextResponse.json(
      {
        error: missingEmailCols
          ? 'HR documents table is missing email columns'
          : 'Failed to send LS-54 to RBT',
        code: missingEmailCols ? 'HR_DOCUMENT_TASKS_COLUMNS_MISSING' : undefined,
        details: message,
      },
      { status: 500 }
    )
  }
}
