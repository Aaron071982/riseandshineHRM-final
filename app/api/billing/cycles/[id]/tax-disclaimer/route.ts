import { NextRequest, NextResponse } from 'next/server'
import { requireBillingManagerSession } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import {
  generateTaxDisclaimerEmail,
  sendTaxDisclaimerEmail,
} from '@/lib/billing/hoursConfirmationEmail'
import { mapCycleEmailRecipients } from '@/lib/billing/cycleEmailRecipients'

const BATCH_SIZE = 5
const BATCH_DELAY_MS = 600

function sleep(ms: number) {
  return new Promise((r) => setTimeout(r, ms))
}

async function loadCycle(cycleId: string) {
  return prisma.billingCycle.findUnique({
    where: { id: cycleId },
    include: {
      entries: {
        where: { isExcluded: false },
        include: {
          rbtProfile: { select: { firstName: true, lastName: true, email: true } },
          payrollOnly: { select: { fullName: true, email: true } },
        },
      },
    },
  })
}

export async function GET(
  _request: NextRequest,
  { params }: { params: { id: string } }
) {
  const auth = await requireBillingManagerSession()
  if (auth.response) return auth.response

  const cycle = await loadCycle(params.id)
  if (!cycle) {
    return NextResponse.json({ error: 'Cycle not found' }, { status: 404 })
  }

  const recipients = mapCycleEmailRecipients(cycle.entries)
  const previewRecipient = recipients.find((r) => r.canEmail) ?? recipients[0]
  const previewHtml = previewRecipient
    ? generateTaxDisclaimerEmail({
        firstName: previewRecipient.firstName,
        cycleLabel: cycle.label,
        periodStart: cycle.periodStart,
        periodEnd: cycle.periodEnd,
      })
    : null

  return NextResponse.json({
    recipientCount: recipients.filter((r) => r.canEmail).length,
    skippedCount: recipients.filter((r) => !r.canEmail).length,
    previewHtml,
    previewRecipient: previewRecipient?.name ?? null,
  })
}

export async function POST(
  _request: NextRequest,
  { params }: { params: { id: string } }
) {
  const auth = await requireBillingManagerSession()
  if (auth.response) return auth.response

  const cycle = await loadCycle(params.id)
  if (!cycle) {
    return NextResponse.json({ error: 'Cycle not found' }, { status: 404 })
  }

  if (cycle.status !== 'FINALIZED' && cycle.status !== 'PAID' && cycle.status !== 'REVIEW') {
    return NextResponse.json(
      { error: 'Cycle must be in review or finalized to send notices' },
      { status: 400 }
    )
  }

  const recipients = mapCycleEmailRecipients(cycle.entries)
  const toSend = recipients.filter((r) => r.canEmail)

  let sent = 0
  let failed = 0
  let skipped = 0

  for (let i = 0; i < toSend.length; i += BATCH_SIZE) {
    const batch = toSend.slice(i, i + BATCH_SIZE)
    await Promise.all(
      batch.map(async (r) => {
        const ok = await sendTaxDisclaimerEmail(r.email!.trim(), {
          firstName: r.firstName,
          cycleLabel: cycle.label,
          periodStart: cycle.periodStart,
          periodEnd: cycle.periodEnd,
        })
        if (ok) sent++
        else failed++
      })
    )
    if (i + BATCH_SIZE < toSend.length) await sleep(BATCH_DELAY_MS)
  }

  skipped = recipients.filter((r) => !r.canEmail).length

  return NextResponse.json({ sent, failed, skipped })
}
