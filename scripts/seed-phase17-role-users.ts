/**
 * Upsert Phase 17 role-specific test users on dev.
 * Never runs against prod. Dry-run by default.
 *
 *   dotenv -e .env.development -- tsx scripts/seed-phase17-role-users.ts
 *   dotenv -e .env.development -- tsx scripts/seed-phase17-role-users.ts --confirm
 */
import { PrismaClient, type CrmRole } from '@prisma/client'
import { assertWriteTarget } from '../lib/scripts/guard'
import { PHASE17_ROLE_TEST_USERS } from '../lib/crm/phase17TestUsers'

const prisma = new PrismaClient()

async function ensureRole(userId: string, role: CrmRole) {
  const existing = await prisma.userCrmRole.findUnique({
    where: { userId_role: { userId, role } },
  })
  if (existing && !existing.revokedAt) return 'exists'
  if (existing?.revokedAt) {
    await prisma.userCrmRole.update({
      where: { id: existing.id },
      data: { revokedAt: null, revokedByUserId: null },
    })
    return 'reactivated'
  }
  await prisma.userCrmRole.create({ data: { userId, role } })
  return 'granted'
}

async function main() {
  const target = assertWriteTarget({ allowProd: false })
  if (target.dryRun) {
    console.log('Dry run — would upsert:')
    for (const u of PHASE17_ROLE_TEST_USERS) {
      console.log(`  ${u.email}  role=ADMIN  crm=${u.crmRole}`)
    }
    console.log('Pass --confirm to write.')
    console.log('Login on localhost: request OTP, then enter 123456.')
    return
  }

  for (const u of PHASE17_ROLE_TEST_USERS) {
    const user = await prisma.user.upsert({
      where: { email: u.email },
      create: {
        name: u.name,
        email: u.email,
        role: 'ADMIN',
        isActive: true,
      },
      update: {
        name: u.name,
        role: 'ADMIN',
        isActive: true,
      },
    })
    const grant = await ensureRole(user.id, u.crmRole)
    console.log(`✓ ${u.email}  id=${user.id}  crm=${u.crmRole} (${grant})`)
  }

  console.log(`
Login (http://localhost:3000/login) — OTP 123456 on localhost:

  intake-only@example.com       INTAKE only — claim-scoped
  clinical-only@example.com     CLINICAL only — claim-scoped
  cc-only@example.com           CASE_COORDINATION — assigned piles, no self-claim
  full-visibility@example.com   MANAGEMENT — sees all clients

Then elevate into Client Services. Walk docs/PHASE17_VERIFICATION.md.
`)
}

main()
  .catch((e) => {
    console.error(e)
    process.exit(1)
  })
  .finally(() => prisma.$disconnect())
