import { NextRequest, NextResponse } from 'next/server'
import { requireBillingManagerSession } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import {
  buildPayrollConfirmation,
  generateHoursConfirmationEmail,
  sendHoursConfirmationEmail,
} from '@/lib/billing/hoursConfirmationEmail'
import { isPayableMatchStatus } from '@/lib/billing/entryActions'
import { parsePayableStatusesJson } from '@/lib/billing/sessionStatus'

const BATCH_SIZE = 5
const BATCH_DELAY_MS = 600

function sleep(ms: number) {
  return new Promise((r) => setTimeout(r, ms))
}

function mapEntryToConfirmation(
  e: {
    id: string
    providerNameRaw: string
    matchStatus: string
    hourlyRate: number | null
    adjustment: number
    finalPay: number
    totalHours: number
    rbtProfileId: string | null
    payrollOnlyId: string | null
    rbtProfile: { id: string; firstName: string; lastName: string; email: string | null } | null
    payrollOnly: { id: string; fullName: string; email: string | null } | null
    sessions: { dos: Date; actualMinutes: number; sessionStatus: string | null }[]
  },
  cycle: {
    label: string
    periodStart: Date
    periodEnd: Date
    payableStatuses: unknown
  }
) {
  const email = e.rbtProfile?.email ?? e.payrollOnly?.email ?? null
  const name = e.rbtProfile
    ? `${e.rbtProfile.firstName} ${e.rbtProfile.lastName}`
    : (e.payrollOnly?.fullName ?? e.providerNameRaw)
  const firstName = e.rbtProfile?.firstName ?? name.split(' ')[0] ?? name
  const payableStatuses = parsePayableStatusesJson(cycle.payableStatuses)

  const confirmation = buildPayrollConfirmation({
    firstName,
    cycleLabel: cycle.label,
    periodStart: cycle.periodStart,
    periodEnd: cycle.periodEnd,
    sessions: e.sessions,
    payableStatuses,
  })

  return {
    entryId: e.id,
    rbtProfileId: e.rbtProfileId,
    payrollOnlyId: e.payrollOnlyId,
    name,
    email,
    totalHours: e.totalHours,
    canEmail: !!email?.trim() && e.totalHours > 0,
    confirmation,
  }
}

export async function GET(
  _request: NextRequest,
  { params }: { params: { id: string } }
) {
  const auth = await requireBillingManagerSession()
  if (auth.response) return auth.response

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
    .map((e) => mapEntryToConfirmation(e, cycle))
    .filter((r) => r.totalHours > 0)

  const previewRecipient = recipients.find((r) => r.canEmail) ?? recipients[0]
  const previewHtml = previewRecipient
    ? generateHoursConfirmationEmail(previewRecipient.confirmation)
    : null

  return NextResponse.json({
    recipientCount: recipients.filter((r) => r.canEmail).length,
    skippedCount: recipients.filter((r) => !r.canEmail).length,
    withIncompleteHours: recipients.filter((r) => r.confirmation.incompleteHours > 0).length,
    previewHtml,
    previewRecipient: previewRecipient?.name ?? null,
    confirmations: cycle.hoursConfirmations,
  })
}

export async function POST(
  _request: NextRequest,
  { params }: { params: { id: string } }
) {
  const auth = await requireBillingManagerSession()
  if (auth.response) return auth.response

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
    .map((e) => mapEntryToConfirmation(e, cycle))
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
