import type { CrmRole, Prisma } from '@prisma/client'
import { prisma } from '@/lib/prisma'
import { DEFAULT_CRM_TRAINING_MODULES } from '@/lib/crm/training/defaultModules'

const MODULE_ROLES: CrmRole[] = [
  'INTAKE',
  'CLINICAL',
  'AUTHORIZATION',
  'STAFFING',
  'CASE_COORDINATION',
  'BILLING',
  'MANAGEMENT',
]

type Tx = Prisma.TransactionClient

/**
 * Renumber steps 1..n for a module.
 * Uses temporary negative stepNumbers to satisfy @@unique([moduleId, stepNumber]).
 */
export async function renumberModuleSteps(
  moduleId: string,
  orderedStepIds: string[],
  tx: Tx = prisma
): Promise<void> {
  for (let i = 0; i < orderedStepIds.length; i++) {
    await tx.crmTrainingStep.update({
      where: { id: orderedStepIds[i] },
      data: { stepNumber: -(i + 1) },
    })
  }
  for (let i = 0; i < orderedStepIds.length; i++) {
    await tx.crmTrainingStep.update({
      where: { id: orderedStepIds[i] },
      data: { stepNumber: i + 1 },
    })
  }
}

/** Repair gaps / negatives left by interrupted renumbers. Safe to run repeatedly. */
export async function normalizeModuleStepNumbers(moduleId: string): Promise<void> {
  const steps = await prisma.crmTrainingStep.findMany({
    where: { moduleId },
    orderBy: [{ stepNumber: 'asc' }, { createdAt: 'asc' }],
    select: { id: true, stepNumber: true },
  })
  if (!steps.length) return

  const alreadyContiguous = steps.every((s, i) => s.stepNumber === i + 1)
  if (alreadyContiguous) return

  await prisma.$transaction(async (tx) => {
    await renumberModuleSteps(
      moduleId,
      steps.map((s) => s.id),
      tx
    )
  })
}

/**
 * Seed default modules/steps only when a role module is missing.
 * Never re-insert default steps into an existing module — that would undo admin
 * deletes and can P2002 on (moduleId, stepNumber) after renumbering.
 */
export async function ensureCrmTrainingModules(): Promise<void> {
  try {
    for (const mod of DEFAULT_CRM_TRAINING_MODULES) {
      const existingModule = await prisma.crmTrainingModule.findUnique({
        where: { crmRole: mod.crmRole },
        select: { id: true },
      })
      if (existingModule) {
        // Existing catalog is admin-owned. Only heal broken stepNumber sequences.
        await normalizeModuleStepNumbers(existingModule.id)
        continue
      }

      await prisma.$transaction(async (tx) => {
        const moduleRow = await tx.crmTrainingModule.create({
          data: {
            crmRole: mod.crmRole,
            title: mod.title,
            summary: mod.summary ?? null,
            goalStatement: mod.goalStatement ?? null,
          },
        })
        for (const step of mod.steps) {
          await tx.crmTrainingStep.create({
            data: {
              moduleId: moduleRow.id,
              stepNumber: step.stepNumber,
              slug: step.slug,
              title: step.title,
              body: step.body,
              icon: step.icon ?? null,
            },
          })
        }
      })
    }
  } catch (err) {
    // Profile / training pages must never hard-crash the CRM over seed issues.
    console.error('[crm-training] ensureCrmTrainingModules failed:', err)
  }
}

export function trainingRolesForUser(roles: CrmRole[]): CrmRole[] {
  const out = new Set<CrmRole>()
  for (const role of roles) {
    if (MODULE_ROLES.includes(role)) out.add(role)
    if (role === 'SUPER_ADMIN') out.add('MANAGEMENT')
  }
  return [...out]
}

export async function listTrainingModulesForRoles(roles: CrmRole[]) {
  const moduleRoles = trainingRolesForUser(roles)
  if (!moduleRoles.length) return []

  return prisma.crmTrainingModule.findMany({
    where: { crmRole: { in: moduleRoles } },
    orderBy: { crmRole: 'asc' },
    include: {
      steps: { orderBy: { stepNumber: 'asc' } },
      videos: { orderBy: { position: 'asc' } },
    },
  })
}

export async function completionMapForUser(userId: string, stepIds: string[]) {
  if (!stepIds.length) return new Set<string>()
  const rows = await prisma.crmTrainingStepCompletion.findMany({
    where: { userId, stepId: { in: stepIds } },
    select: { stepId: true },
  })
  return new Set(rows.map((r) => r.stepId))
}
