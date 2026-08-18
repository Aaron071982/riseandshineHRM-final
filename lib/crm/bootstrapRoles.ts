import type { CrmRole } from '@prisma/client'
import { prisma } from '@/lib/prisma'

/** Emails seeded as CRM SUPER_ADMIN when a matching users row exists. */
export const CRM_SUPER_ADMIN_BOOTSTRAP_EMAILS = [
  'aaronsiam21@gmail.com',
  'kazi@jamal.nyc',
  'kazi@siyam.nyc',
] as const

export type BootstrapCrmRolesResult = {
  granted: { email: string; userId: string }[]
  skipped: { email: string; reason: string }[]
  reactivated: { email: string; userId: string }[]
}

/**
 * Idempotent: ensure bootstrap emails have an active SUPER_ADMIN CRM role.
 * Does not create users — skips missing emails with a warning.
 */
export async function bootstrapCrmSuperAdmins(
  grantedByUserId?: string | null
): Promise<BootstrapCrmRolesResult> {
  const granted: BootstrapCrmRolesResult['granted'] = []
  const skipped: BootstrapCrmRolesResult['skipped'] = []
  const reactivated: BootstrapCrmRolesResult['reactivated'] = []

  for (const email of CRM_SUPER_ADMIN_BOOTSTRAP_EMAILS) {
    const user = await prisma.user.findFirst({
      where: { email: { equals: email, mode: 'insensitive' } },
      select: { id: true, email: true },
    })
    if (!user) {
      const reason = `No users row for ${email} — skip (grant after they log in)`
      console.warn(`[crm-bootstrap] ${reason}`)
      skipped.push({ email, reason })
      continue
    }

    const existing = await prisma.userCrmRole.findUnique({
      where: {
        userId_role: { userId: user.id, role: 'SUPER_ADMIN' satisfies CrmRole },
      },
    })

    if (existing && !existing.revokedAt) {
      granted.push({ email: user.email ?? email, userId: user.id })
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
      reactivated.push({ email: user.email ?? email, userId: user.id })
      continue
    }

    await prisma.userCrmRole.create({
      data: {
        userId: user.id,
        role: 'SUPER_ADMIN',
        grantedByUserId: grantedByUserId ?? null,
      },
    })
    granted.push({ email: user.email ?? email, userId: user.id })
  }

  return { granted, skipped, reactivated }
}
