import { NextRequest, NextResponse } from 'next/server'
import { requireAdminSession } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { supabaseAdmin, STORAGE_BUCKET } from '@/lib/supabase'
import { fillPdfWithValues } from '@/lib/pdf/fillPdfWithValues'
import { loadCatalogPdfBytes } from '@/lib/onboarding/hr-tasks'
import {
  LS54_SLUG,
  buildLs54FieldValues,
  formatOvertimeRate,
  parseHourlyRate,
} from '@/lib/onboarding/ls54'
import { sendGenericEmail, generateOnboardingDocumentsNotifyEmail } from '@/lib/email'
import { makePublicUrl } from '@/lib/baseUrl'

export const dynamic = 'force-dynamic'
export const maxDuration = 60

const EMAIL_FAILURE_WARNING =
  'Document sent, but email notification failed. Please follow up manually.'

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; taskId: string }> }
) {
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
    prisma.hRDocumentTask.findFirst({
      where: { id: taskId, rbtProfileId },
    }),
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

  const pdfBytes = await loadCatalogPdfBytes(LS54_SLUG)
  if (!pdfBytes) {
    return NextResponse.json({ error: 'LS-54 PDF template not found' }, { status: 500 })
  }

  const employeeName = `${profile.firstName} ${profile.lastName}`.trim()
  const fieldValues = buildLs54FieldValues({
    employeeName,
    employeeRateOfPay: employeeRateOfPay,
    overtimeRate,
  })

  let filledBuffer: Buffer
  try {
    const filledBlob = await fillPdfWithValues(pdfBytes, fieldValues, { flatten: false })
    filledBuffer = Buffer.from(await filledBlob.arrayBuffer())
  } catch (fillErr) {
    console.error('[hr-documents/send] fill PDF', fillErr)
    return NextResponse.json(
      { error: 'Failed to fill LS-54 form. Try again or contact support.' },
      { status: 500 }
    )
  }

  if (filledBuffer.length > 15 * 1024 * 1024) {
    return NextResponse.json({ error: 'Generated PDF is too large' }, { status: 500 })
  }

  if (!supabaseAdmin) {
    return NextResponse.json({ error: 'Storage not configured' }, { status: 500 })
  }

  const storagePath = `hr-documents/${rbtProfileId}/${LS54_SLUG}-hr-${Date.now()}.pdf`
  const { error: uploadError } = await supabaseAdmin.storage
    .from(STORAGE_BUCKET)
    .upload(storagePath, filledBuffer, {
      contentType: 'application/pdf',
      upsert: true,
    })

  if (uploadError) {
    console.error('[hr-documents/send] upload', uploadError)
    return NextResponse.json({ error: 'Failed to store PDF' }, { status: 500 })
  }

  const now = new Date()
  const formMeta = {
    employeeRateOfPay,
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
  })

  const doc = await prisma.onboardingDocument.findUnique({
    where: { slug: LS54_SLUG },
    select: { title: true },
  })
  const docTitle = doc?.title ?? 'NYS Wage Notice (LS-54)'
  const portalUrl = makePublicUrl('/rbt/tasks')
  const messageText = `Your ${docTitle} is ready. Please open My Tasks, download the HR-prepared form, sign it, and upload your completed copy.`

  await prisma.rBTMessage.create({
    data: {
      rbtProfileId,
      senderRole: 'ADMIN',
      message: messageText,
    },
  })

  let emailWarning: string | undefined

  if (profile.email?.trim()) {
    const { subject, html } = generateOnboardingDocumentsNotifyEmail(
      profile.firstName,
      portalUrl
    )
    const sent = await sendGenericEmail(profile.email.trim(), subject, html)
    if (sent) {
      updated = await prisma.hRDocumentTask.update({
        where: { id: taskId },
        data: { emailSent: true, emailSentAt: new Date() },
      })
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
    hrTask: updated,
    emailSent: updated.emailSent,
    emailSentAt: updated.emailSentAt?.toISOString() ?? null,
    ...(emailWarning ? { emailWarning } : {}),
  })
}
