import { NextRequest, NextResponse } from 'next/server'
import { requireBillingManagerSession } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { format } from 'date-fns'
import {
  generateHoursConfirmationEmail,
  sendHoursConfirmationEmail,
  getPayDeadline,
} from '@/lib/billing/hoursConfirmationEmail'
import { isPayableMatchStatus } from '@/lib/billing/entryActions'

const BATCH_SIZE = 5
const BATCH_DELAY_MS = 600

function sleep(ms: number) {
  return new Promise((r) => setTimeout(r, ms))
}

function groupSessionsByDate(
  sessions: { dos: Date; actualMinutes: number }[]
): { date: Date; hours: number }[] {
  const byDay = new Map<string, number>()
  for (const s of sessions) {
    const key = format(s.dos, 'yyyy-MM-dd')
    byDay.set(key, (byDay.get(key) ?? 0) + s.actualMinutes / 60)
  }
  return [...byDay.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([key, hours]) => ({ date: new Date(key + 'T12:00:00'), hours }))
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
        where: { isExcluded: false, totalHours: { gt: 0 } },
        include: {
          rbtProfile: { select: { id: true, firstName: true, lastName: true, email: true } },
          payrollOnly: { select: { id: true, fullName: true, email: true } },
          sessions: { select: { dos: true, actualMinutes: true } },
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
      const dailyHours = groupSessionsByDate(e.sessions)
      return {
        entryId: e.id,
        name,
        firstName,
        email,
        totalHours: e.totalHours,
        canEmail: !!email,
        dailyHours,
      }
    })

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
    totalWithHours: recipients.length,
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
        where: { isExcluded: false, totalHours: { gt: 0 } },
        include: {
          rbtProfile: { select: { id: true, firstName: true, lastName: true, email: true } },
          payrollOnly: { select: { id: true, fullName: true, email: true } },
          sessions: { select: { dos: true, actualMinutes: true } },
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

  const toSend = cycle.entries.filter(
    (e) =>
      isPayableMatchStatus(e.matchStatus) &&
      (e.rbtProfile?.email || e.payrollOnly?.email)
  )

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
        const dailyHours = groupSessionsByDate(e.sessions)

        const ok = await sendHoursConfirmationEmail({
          to: email,
          firstName,
          cycleLabel: cycle.label,
          periodStart: cycle.periodStart,
          periodEnd: cycle.periodEnd,
          dailyHours,
          totalHours: e.totalHours,
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

  const noEmail = cycle.entries.filter(
    (e) => isPayableMatchStatus(e.matchStatus) && !e.rbtProfile?.email && !e.payrollOnly?.email
  )
  for (const e of noEmail) {
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
