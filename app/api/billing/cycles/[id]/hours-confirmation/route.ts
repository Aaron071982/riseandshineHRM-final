import { NextRequest, NextResponse } from 'next/server'
import { requireBillingManagerSession } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import {
  buildEntryHoursConfirmation,
  sendEntryHoursConfirmation,
} from '@/lib/billing/entryHoursConfirmation'
import { sendHoursConfirmationEmail } from '@/lib/billing/hoursConfirmationEmail'
import { isPayableMatchStatus } from '@/lib/billing/entryActions'

const BATCH_SIZE = 5
const BATCH_DELAY_MS = 600

function sleep(ms: number) {
  return new Promise((r) => setTimeout(r, ms))
}

export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  const auth = await requireBillingManagerSession()
  if (auth.response) return auth.response

  const entryId = request.nextUrl.searchParams.get('entryId')

  const cycle = await prisma.billingCycle.findUnique({
    where: { id: params.id },
    include: {
      entries: {
        where: { isExcluded: false },
        include: {
          rbtProfile: { select: { id: true, firstName: true, lastName: true, email: true } },
          payrollOnly: { select: { id: true, fullName: true, email: true } },
          sessions: { select: { dos: true, actualMinutes: true, sessionStatus: true } },
        },
      },
      hoursConfirmations: {
        orderBy: { sentAt: 'desc' },
        include: {
          rbtProfile: { select: { firstName: true, lastName: true } },
          payrollOnly: { select: { fullName: true } },
        },
      },
    },
  })

  if (!cycle) {
    return NextResponse.json({ error: 'Cycle not found' }, { status: 404 })
  }

  const recipients = cycle.entries
    .filter((e) => isPayableMatchStatus(e.matchStatus))
    .map((e) => buildEntryHoursConfirmation(e, cycle))
    .filter((r) => r.totalHours > 0)

  const previewRecipient = entryId
    ? recipients.find((r) => r.entryId === entryId)
    : recipients.find((r) => r.canEmail) ?? recipients[0]

  return NextResponse.json({
    recipientCount: recipients.filter((r) => r.canEmail).length,
    skippedCount: recipients.filter((r) => !r.canEmail).length,
    withIncompleteHours: recipients.filter((r) => r.confirmation.incompleteHours > 0).length,
    previewHtml: previewRecipient?.previewHtml ?? null,
    previewRecipient: previewRecipient?.name ?? null,
    previewEntryId: previewRecipient?.entryId ?? null,
    recipients: recipients.map((r) => ({
      entryId: r.entryId,
      name: r.name,
      email: r.email,
      canEmail: r.canEmail,
      totalHours: r.totalHours,
    })),
    confirmations: cycle.hoursConfirmations,
  })
}

export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  const auth = await requireBillingManagerSession()
  if (auth.response) return auth.response

  const body = await request.json().catch(() => ({}))
  const entryId = typeof body.entryId === 'string' ? body.entryId : null

  if (entryId) {
    const result = await sendEntryHoursConfirmation(entryId)
    if (!result.ok) {
      return NextResponse.json({ error: result.error }, { status: 400 })
    }
    return NextResponse.json({ sent: result.sent ? 1 : 0, failed: result.sent ? 0 : 1, skipped: 0 })
  }

  const cycle = await prisma.billingCycle.findUnique({
    where: { id: params.id },
    include: {
      entries: {
        where: { isExcluded: false },
        include: {
          rbtProfile: { select: { id: true, firstName: true, lastName: true, email: true } },
          payrollOnly: { select: { id: true, fullName: true, email: true } },
          sessions: { select: { dos: true, actualMinutes: true, sessionStatus: true } },
        },
      },
    },
  })

  if (!cycle) {
    return NextResponse.json({ error: 'Cycle not found' }, { status: 404 })
  }

  if (cycle.status !== 'FINALIZED' && cycle.status !== 'PAID' && cycle.status !== 'REVIEW') {
    return NextResponse.json(
      { error: 'Cycle must be in review or finalized to send confirmations' },
      { status: 400 }
    )
  }

  const recipients = cycle.entries
    .filter((e) => isPayableMatchStatus(e.matchStatus))
    .map((e) => buildEntryHoursConfirmation(e, cycle))
    .filter((r) => r.totalHours > 0)

  const toSend = recipients.filter((r) => r.canEmail)

  let sent = 0
  let failed = 0
  let skipped = 0

  for (let i = 0; i < toSend.length; i += BATCH_SIZE) {
    const batch = toSend.slice(i, i + BATCH_SIZE)
    await Promise.all(
      batch.map(async (r) => {
        const email = r.email!.trim()
        const ok = await sendHoursConfirmationEmail(email, r.confirmation)

        await prisma.billingHoursConfirmation.create({
          data: {
            billingCycleId: cycle.id,
            rbtProfileId: r.rbtProfileId,
            payrollOnlyId: r.payrollOnlyId,
            email,
            sentAt: ok ? new Date() : null,
            status: ok ? 'SENT' : 'FAILED',
          },
        })

        if (ok) sent++
        else failed++
      })
    )
    if (i + BATCH_SIZE < toSend.length) await sleep(BATCH_DELAY_MS)
  }

  for (const r of recipients.filter((r) => !r.canEmail)) {
    await prisma.billingHoursConfirmation.create({
      data: {
        billingCycleId: cycle.id,
        rbtProfileId: r.rbtProfileId,
        payrollOnlyId: r.payrollOnlyId,
        email: r.email?.trim() ?? '',
        status: 'SKIPPED',
      },
    })
    skipped++
  }

  return NextResponse.json({ sent, failed, skipped })
}
