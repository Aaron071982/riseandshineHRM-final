import type { CrmRole } from '@prisma/client'
import { prisma, isPrismaMissingSchemaError } from '@/lib/prisma'

/** Emails seeded as CRM SUPER_ADMIN when a matching users row exists. */
export const CRM_SUPER_ADMIN_BOOTSTRAP_EMAILS = [
  'aaronsiam21@gmail.com',
  'kazi@jamal.nyc',
  'kazi@siyam.nyc',
  'kazi@riseandshineaba.com',
  'irsal@riseandshineaba.com',
] as const

/** Clinical lead — all-clients clinical portal (not payroll/admin). */
export const CRM_CLINICAL_LEAD_BOOTSTRAP_EMAILS = [
  'shazia@riseandshineaba.com',
  'shaziakhaliq37@gmail.com',
] as const

export type BootstrapCrmRolesResult = {
  granted: { email: string; userId: string; role: CrmRole }[]
  skipped: { email: string; reason: string }[]
  reactivated: { email: string; userId: string; role: CrmRole }[]
}

/**
 * Idempotent: ensure bootstrap emails have active SUPER_ADMIN / CLINICAL_LEAD.
 * Does not create users — skips missing emails with a warning.
 */
export async function bootstrapCrmSuperAdmins(
  grantedByUserId?: string | null
): Promise<BootstrapCrmRolesResult> {
  const granted: BootstrapCrmRolesResult['granted'] = []
  const skipped: BootstrapCrmRolesResult['skipped'] = []
  const reactivated: BootstrapCrmRolesResult['reactivated'] = []

  try {
    await applyRoleBootstrap(
      CRM_SUPER_ADMIN_BOOTSTRAP_EMAILS,
      'SUPER_ADMIN',
      grantedByUserId,
      { granted, skipped, reactivated }
    )
    await applyRoleBootstrap(
      CRM_CLINICAL_LEAD_BOOTSTRAP_EMAILS,
      'CLINICAL_LEAD',
      grantedByUserId,
      { granted, skipped, reactivated }
    )
  } catch (error) {
    if (isPrismaMissingSchemaError(error)) {
      console.warn(
        '[crm-bootstrap] user_crm_roles is missing — run prisma db push. Skipping grants.'
      )
      return { granted, skipped, reactivated }
    }
    throw error
  }

  return { granted, skipped, reactivated }
}

async function applyRoleBootstrap(
  emails: readonly string[],
  role: CrmRole,
  grantedByUserId: string | null | undefined,
  out: BootstrapCrmRolesResult
): Promise<void> {
  const { granted, skipped, reactivated } = out

  for (const email of emails) {
    const user = await prisma.user.findFirst({
      where: { email: { equals: email, mode: 'insensitive' } },
      select: { id: true, email: true },
    })
    if (!user) {
      const reason = `No users row for ${email} — skip (grant ${role} after they log in)`
      console.warn(`[crm-bootstrap] ${reason}`)
      skipped.push({ email, reason })
      continue
    }

    const existing = await prisma.userCrmRole.findUnique({
      where: {
        userId_role: { userId: user.id, role },
      },
    })

    if (existing && !existing.revokedAt) {
      granted.push({ email: user.email ?? email, userId: user.id, role })
      continue
    }

    if (existing?.revokedAt) {
      await prisma.userCrmRole.update({
        where: { id: existing.id },
        data: {
          revokedAt: null,
          revokedByUserId: null,
          grantedAt: new Date(),
          grantedByUserId: grantedByUserId ?? null,
        },
      })
      reactivated.push({ email: user.email ?? email, userId: user.id, role })
      continue
    }

    await prisma.userCrmRole.create({
      data: {
        userId: user.id,
        role,
        grantedByUserId: grantedByUserId ?? null,
      },
    })
    granted.push({ email: user.email ?? email, userId: user.id, role })
  }
}
