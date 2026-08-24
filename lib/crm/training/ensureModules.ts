import type { CrmRole } from '@prisma/client'
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

/** Seed default modules/steps only when missing (never overwrite admin edits). */
export async function ensureCrmTrainingModules(): Promise<void> {
  for (const mod of DEFAULT_CRM_TRAINING_MODULES) {
    let moduleRow = await prisma.crmTrainingModule.findUnique({
      where: { crmRole: mod.crmRole },
    })
    if (!moduleRow) {
      moduleRow = await prisma.crmTrainingModule.create({
        data: {
          crmRole: mod.crmRole,
          title: mod.title,
          summary: mod.summary ?? null,
          goalStatement: mod.goalStatement ?? null,
        },
      })
    }

    for (const step of mod.steps) {
      const existing = await prisma.crmTrainingStep.findUnique({
        where: { slug: step.slug },
      })
      if (!existing) {
        await prisma.crmTrainingStep.create({
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
    }
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
