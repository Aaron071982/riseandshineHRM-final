import { prisma } from '@/lib/prisma'
import { Prisma } from '@prisma/client'
import { auditPayrollChange } from '@/lib/payroll/access'
import {
  normalizePayeeClassification,
  type PayeeClassification,
} from '@/lib/payroll/classification'

function dec(n: number): Prisma.Decimal {
  return new Prisma.Decimal(n.toFixed(2))
}

export async function upsertContractorProfile(input: {
  userId: string
  legalName: string
  entityName?: string | null
  classification?: PayeeClassification | string | null
  actorUserId: string
}): Promise<{
  id: string
  userId: string
  legalName: string
  entityName: string | null
  classification: string
}> {
  const classification = normalizePayeeClassification(input.classification)
  const existing = await prisma.contractorProfile.findUnique({
    where: { userId: input.userId },
  })
  if (existing) {
    const updated = await prisma.contractorProfile.update({
      where: { id: existing.id },
      data: {
        legalName: input.legalName.trim(),
        entityName: input.entityName?.trim() || null,
        ...(input.classification != null ? { classification } : {}),
      },
    })
    const classChanged =
      input.classification != null &&
      normalizePayeeClassification(existing.classification) !==
        normalizePayeeClassification(updated.classification)
    if (
      existing.legalName !== updated.legalName ||
      (existing.entityName ?? null) !== (updated.entityName ?? null) ||
      classChanged
    ) {
      await auditPayrollChange({
        actorUserId: input.actorUserId,
        entityType: 'ContractorProfile',
        entityId: updated.id,
        label: `PAYROLL_CONTRACTOR_EDIT:${existing.legalName}→${updated.legalName}`,
        before: {
          legalName: existing.legalName,
          entityName: existing.entityName,
          classification: existing.classification,
        },
        after: {
          legalName: updated.legalName,
          entityName: updated.entityName,
          classification: updated.classification,
        },
      })
    }
    return updated
  }

  const created = await prisma.contractorProfile.create({
    data: {
      userId: input.userId,
      legalName: input.legalName.trim(),
      entityName: input.entityName?.trim() || null,
      classification,
    },
  })
  await auditPayrollChange({
    actorUserId: input.actorUserId,
    entityType: 'ContractorProfile',
    entityId: created.id,
    label: `PAYROLL_CONTRACTOR_CREATE:${created.legalName}`,
    after: {
      userId: created.userId,
      legalName: created.legalName,
      classification: created.classification,
    },
  })
  return created
}

/** Effective-dated rate; becomes the contractor's active rate. */
export async function setContractorPayRate(input: {
  contractorId: string
  ratePerHour: number
  effectiveFrom?: Date
  actorUserId: string
}): Promise<{ id: string; ratePerHour: number }> {
  if (!(input.ratePerHour > 0)) {
    throw new Error('ratePerHour must be positive')
  }

  const contractor = await prisma.contractorProfile.findUnique({
    where: { id: input.contractorId },
    include: { activeRate: true },
  })
  if (!contractor) throw new Error('Contractor not found')

  const effectiveFrom = input.effectiveFrom ?? new Date()
  const beforeRate = contractor.activeRate
    ? Number(contractor.activeRate.ratePerHour)
    : null

  if (beforeRate != null) {
    await prisma.payRate.update({
      where: { id: contractor.activeRateId! },
      data: { effectiveTo: effectiveFrom },
    })
  }

  const rate = await prisma.payRate.create({
    data: {
      contractorId: contractor.id,
      ratePerHour: dec(input.ratePerHour),
      effectiveFrom,
    },
  })

  await prisma.contractorProfile.update({
    where: { id: contractor.id },
    data: { activeRateId: rate.id },
  })

  await auditPayrollChange({
    actorUserId: input.actorUserId,
    entityType: 'PayRate',
    entityId: rate.id,
    label: `PAYROLL_RATE_CHANGE:${beforeRate ?? 'none'}→${input.ratePerHour}`,
    before: { ratePerHour: beforeRate },
    after: { ratePerHour: input.ratePerHour, contractorId: contractor.id },
  })

  return { id: rate.id, ratePerHour: Number(rate.ratePerHour) }
}

export async function getActiveContractorRate(
  contractorId: string
): Promise<number | null> {
  const c = await prisma.contractorProfile.findUnique({
    where: { id: contractorId },
    include: { activeRate: true },
  })
  if (!c?.activeRate) return null
  return Number(c.activeRate.ratePerHour)
}

export async function setRbtStaffPayRate(input: {
  staffId: string
  ratePerHour: number
  effectiveFrom?: Date
  actorUserId: string
}): Promise<{ id: string; ratePerHour: number }> {
  if (!(input.ratePerHour > 0)) {
    throw new Error('ratePerHour must be positive')
  }
  const rbt = await prisma.rBTProfile.findUnique({
    where: { id: input.staffId },
    select: { id: true, hourlyPayRate: true },
  })
  if (!rbt) throw new Error('RBT profile not found')

  const effectiveFrom = input.effectiveFrom ?? new Date()
  const before = rbt.hourlyPayRate

  // Close prior open staff rates
  await prisma.payRate.updateMany({
    where: { staffId: input.staffId, effectiveTo: null },
    data: { effectiveTo: effectiveFrom },
  })

  const rate = await prisma.payRate.create({
    data: {
      staffId: input.staffId,
      ratePerHour: dec(input.ratePerHour),
      effectiveFrom,
    },
  })

  await prisma.rBTProfile.update({
    where: { id: input.staffId },
    data: {
      hourlyPayRate: input.ratePerHour,
      payRateUpdatedAt: new Date(),
      payRateUpdatedBy: input.actorUserId,
    },
  })

  await auditPayrollChange({
    actorUserId: input.actorUserId,
    entityType: 'PayRate',
    entityId: rate.id,
    label: `PAYROLL_RATE_CHANGE:${before ?? 'none'}→${input.ratePerHour}`,
    before: { ratePerHour: before, staffId: input.staffId },
    after: { ratePerHour: input.ratePerHour, staffId: input.staffId },
  })

  return { id: rate.id, ratePerHour: Number(rate.ratePerHour) }
}
