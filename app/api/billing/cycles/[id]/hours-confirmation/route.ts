import { NextRequest, NextResponse } from 'next/server'
import { requireBillingManagerSession } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import {
  generateHoursConfirmationEmail,
  sendHoursConfirmationEmail,
  getPayDeadline,
  groupIncompleteSessionsByDate,
  sumIncompleteHours,
} from '@/lib/billing/hoursConfirmationEmail'
import { isPayableMatchStatus } from '@/lib/billing/entryActions'

const BATCH_SIZE = 5
const BATCH_DELAY_MS = 600

function sleep(ms: number) {
  return new Promise((r) => setTimeout(r, ms))
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
    .map((e) => {
      const email = e.rbtProfile?.email ?? e.payrollOnly?.email ?? null
      const name = e.rbtProfile
        ? `${e.rbtProfile.firstName} ${e.rbtProfile.lastName}`
        : (e.payrollOnly?.fullName ?? e.providerNameRaw)
      const firstName = e.rbtProfile?.firstName ?? name.split(' ')[0] ?? name
      const dailyHours = groupIncompleteSessionsByDate(e.sessions)
      const totalHours = sumIncompleteHours(e.sessions)
      return {
        entryId: e.id,
        name,
        firstName,
        email,
        totalHours,
        canEmail: !!email && totalHours > 0,
        dailyHours,
      }
    })
    .filter((r) => r.totalHours > 0)

  const previewRecipient = recipients.find((r) => r.canEmail) ?? recipients[0]
  const previewHtml = previewRecipient
    ? generateHoursConfirmationEmail({
        firstName: previewRecipient.firstName,
        cycleLabel: cycle.label,
        periodStart: cycle.periodStart,
        periodEnd: cycle.periodEnd,
        dailyHours: previewRecipient.dailyHours,
        totalHours: previewRecipient.totalHours,
      })
    : null

  return NextResponse.json({
    recipientCount: recipients.filter((r) => r.canEmail).length,
    skippedCount: recipients.filter((r) => !r.canEmail).length,
    totalWithIncompleteHours: recipients.length,
    payDeadline: getPayDeadline(cycle.periodEnd),
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
    return NextResponse.json({ error: 'Cycle must be in review or finalized to send confirmations' }, { status: 400 })
  }

  const toSend = cycle.entries.filter((e) => {
    if (!isPayableMatchStatus(e.matchStatus)) return false
    if (!e.rbtProfile?.email && !e.payrollOnly?.email) return false
    return sumIncompleteHours(e.sessions) > 0
  })

  let sent = 0
  let failed = 0
  let skipped = 0

  for (let i = 0; i < toSend.length; i += BATCH_SIZE) {
    const batch = toSend.slice(i, i + BATCH_SIZE)
    await Promise.all(
      batch.map(async (e) => {
        const email = (e.rbtProfile?.email ?? e.payrollOnly?.email)!.trim()
        const firstName =
          e.rbtProfile?.firstName ??
          (e.payrollOnly?.fullName ?? e.providerNameRaw).split(' ')[0]
        const dailyHours = groupIncompleteSessionsByDate(e.sessions)
        const totalHours = sumIncompleteHours(e.sessions)

        const ok = await sendHoursConfirmationEmail({
          to: email,
          firstName,
          cycleLabel: cycle.label,
          periodStart: cycle.periodStart,
          periodEnd: cycle.periodEnd,
          dailyHours,
          totalHours,
        })

        await prisma.billingHoursConfirmation.create({
          data: {
            billingCycleId: cycle.id,
            rbtProfileId: e.rbtProfileId,
            payrollOnlyId: e.payrollOnlyId,
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

  const noEmailOrNoIncomplete = cycle.entries.filter((e) => {
    if (!isPayableMatchStatus(e.matchStatus)) return false
    const hasIncomplete = sumIncompleteHours(e.sessions) > 0
    const hasEmail = !!(e.rbtProfile?.email || e.payrollOnly?.email)
    return !hasEmail || !hasIncomplete
  })
  for (const e of noEmailOrNoIncomplete) {
    const hasEmail = !!(e.rbtProfile?.email || e.payrollOnly?.email)
    const hasIncomplete = sumIncompleteHours(e.sessions) > 0
    if (!hasIncomplete) continue
    await prisma.billingHoursConfirmation.create({
      data: {
        billingCycleId: cycle.id,
        rbtProfileId: e.rbtProfileId,
        payrollOnlyId: e.payrollOnlyId,
        email: '',
        status: 'SKIPPED',
      },
    })
    skipped++
  }

  return NextResponse.json({ sent, failed, skipped })
}
