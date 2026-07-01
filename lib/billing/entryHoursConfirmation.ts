import { prisma } from '@/lib/prisma'
import {
  buildPayrollConfirmation,
  generateHoursConfirmationEmail,
  sendHoursConfirmationEmail,
} from '@/lib/billing/hoursConfirmationEmail'
import { isPayableMatchStatus } from '@/lib/billing/entryActions'
import { parsePayableStatusesJson } from '@/lib/billing/sessionStatus'

export function buildEntryHoursConfirmation(
  entry: {
    id: string
    providerNameRaw: string
    matchStatus: string
    totalHours: number
    rbtProfileId: string | null
    payrollOnlyId: string | null
    rbtProfile: { firstName: string; lastName: string; email: string | null } | null
    payrollOnly: { fullName: string; email: string | null } | null
    sessions: { dos: Date; actualMinutes: number; sessionStatus: string | null }[]
  },
  cycle: {
    label: string
    periodStart: Date
    periodEnd: Date
    payableStatuses: unknown
  }
) {
  const email = entry.rbtProfile?.email ?? entry.payrollOnly?.email ?? null
  const name = entry.rbtProfile
    ? `${entry.rbtProfile.firstName} ${entry.rbtProfile.lastName}`
    : (entry.payrollOnly?.fullName ?? entry.providerNameRaw)
  const firstName = entry.rbtProfile?.firstName ?? name.split(' ')[0] ?? name
  const payableStatuses = parsePayableStatusesJson(cycle.payableStatuses)

  const confirmation = buildPayrollConfirmation({
    firstName,
    cycleLabel: cycle.label,
    periodStart: cycle.periodStart,
    periodEnd: cycle.periodEnd,
    sessions: entry.sessions,
    payableStatuses,
  })

  return {
    entryId: entry.id,
    rbtProfileId: entry.rbtProfileId,
    payrollOnlyId: entry.payrollOnlyId,
    name,
    email,
    totalHours: entry.totalHours,
    canEmail: !!email?.trim() && entry.totalHours > 0,
    confirmation,
    previewHtml: generateHoursConfirmationEmail(confirmation),
    subject: `Your hours confirmation — ${cycle.label}`,
  }
}

export async function loadEntryHoursConfirmation(entryId: string) {
  const entry = await prisma.billingEntry.findUnique({
    where: { id: entryId },
    include: {
      billingCycle: true,
      rbtProfile: { select: { firstName: true, lastName: true, email: true } },
      payrollOnly: { select: { fullName: true, email: true } },
      sessions: { select: { dos: true, actualMinutes: true, sessionStatus: true } },
    },
  })

  if (!entry) return null
  if (entry.isExcluded || !isPayableMatchStatus(entry.matchStatus)) return null

  return buildEntryHoursConfirmation(entry, entry.billingCycle)
}

export async function sendEntryHoursConfirmation(entryId: string) {
  const data = await loadEntryHoursConfirmation(entryId)
  if (!data) return { ok: false as const, error: 'Entry not found' }
  if (!data.canEmail) {
    return { ok: false as const, error: data.email ? 'No payable hours' : 'No email on file' }
  }

  const entry = await prisma.billingEntry.findUnique({
    where: { id: entryId },
    select: { billingCycleId: true, billingCycle: { select: { status: true } } },
  })
  if (!entry) return { ok: false as const, error: 'Entry not found' }

  const status = entry.billingCycle.status
  if (status !== 'FINALIZED' && status !== 'PAID' && status !== 'REVIEW') {
    return { ok: false as const, error: 'Cycle must be in review or finalized to send' }
  }

  const email = data.email!.trim()
  const sent = await sendHoursConfirmationEmail(email, data.confirmation)

  await prisma.billingHoursConfirmation.create({
    data: {
      billingCycleId: entry.billingCycleId,
      rbtProfileId: data.rbtProfileId,
      payrollOnlyId: data.payrollOnlyId,
      email,
      sentAt: sent ? new Date() : null,
      status: sent ? 'SENT' : 'FAILED',
    },
  })

  return { ok: true as const, sent, email, name: data.name }
}
