import { NextRequest, NextResponse } from 'next/server'
import { requireBillingManagerSession } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { sendIncompleteSessionReminderEmail } from '@/lib/billing/incompleteSessionEmail'
import { ARTEMIS_STATUS, computePayableHours } from '@/lib/billing/sessionStatus'

const BATCH_DELAY_MS = 600

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  const auth = await requireBillingManagerSession()
  if (auth.response) return auth.response

  const body = await request.json().catch(() => ({}))
  const threshold = Math.max(1, parseInt(String(body.threshold ?? 1), 10) || 1)
  const entryIds: string[] = Array.isArray(body.entryIds) ? body.entryIds.map(String) : []

  const cycle = await prisma.billingCycle.findUnique({
    where: { id: params.id },
    select: { id: true, label: true, status: true },
  })
  if (!cycle) {
    return NextResponse.json({ error: 'Cycle not found' }, { status: 404 })
  }

  const entries = await prisma.billingEntry.findMany({
    where: {
      billingCycleId: params.id,
      isExcluded: false,
      matchStatus: { in: ['MATCHED', 'PAYROLL_ONLY'] },
      ...(entryIds.length > 0 ? { id: { in: entryIds } } : {}),
    },
    include: {
      rbtProfile: { select: { id: true, firstName: true, lastName: true, email: true } },
      payrollOnly: { select: { fullName: true, email: true } },
      sessions: {
        where: { sessionStatus: ARTEMIS_STATUS.INCOMPLETE },
        select: { dos: true, actualMinutes: true },
        orderBy: { dos: 'asc' },
      },
    },
  })

  const targets = entries.filter((e) => e.sessions.length >= threshold)
  let sent = 0
  let failed = 0
  const results: { name: string; email: string | null; ok: boolean }[] = []

  for (const entry of targets) {
    const email = entry.rbtProfile?.email ?? entry.payrollOnly?.email ?? null
    const firstName =
      entry.rbtProfile?.firstName ?? entry.payrollOnly?.fullName.split(' ')[0] ?? 'there'
    const name = entry.rbtProfile
      ? `${entry.rbtProfile.firstName} ${entry.rbtProfile.lastName}`
      : entry.payrollOnly?.fullName ?? entry.providerNameRaw

    if (!email) {
      failed++
      results.push({ name, email: null, ok: false })
      continue
    }

    const incompleteHours = computePayableHours(
      entry.sessions.map((s) => ({ sessionStatus: ARTEMIS_STATUS.INCOMPLETE, actualMinutes: s.actualMinutes })),
      [ARTEMIS_STATUS.INCOMPLETE]
    )

    try {
      const ok = await sendIncompleteSessionReminderEmail({
        to: email,
        firstName,
        cycleLabel: cycle.label,
        incompleteDates: entry.sessions.map((s) => s.dos),
        incompleteSessionCount: entry.sessions.length,
        incompleteHours,
      })
      if (ok) sent++
      else failed++
      results.push({ name, email, ok })
    } catch {
      failed++
      results.push({ name, email, ok: false })
    }

    await sleep(BATCH_DELAY_MS)
  }

  return NextResponse.json({ sent, failed, results, targetCount: targets.length })
}
