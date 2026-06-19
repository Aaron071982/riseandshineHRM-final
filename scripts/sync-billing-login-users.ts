/**
 * Create BILLING login users for Rafique/Afrin + any billing_profiles with emails.
 * Usage: npx tsx scripts/sync-billing-login-users.ts
 */
import { PrismaClient } from '@prisma/client'
import { syncBillingProfileLoginUsers } from '../lib/billing-portal-users'

const prisma = new PrismaClient()

async function main() {
  const count = await syncBillingProfileLoginUsers()
  const users = await prisma.user.findMany({
    where: {
      role: 'BILLING',
      email: {
        in: ['rafique@riseandshineaba.com', 'afrin@riseandshineaba.com'],
      },
    },
    select: { id: true, email: true, name: true, role: true, isActive: true },
  })
  console.log(`Synced ${count} billing login user(s).`)
  console.log('Rafique / Afrin accounts:')
  for (const u of users) {
    console.log(`  ${u.email} → ${u.role} active=${u.isActive} id=${u.id}`)
  }
}

main()
  .catch((e) => {
    console.error(e)
    process.exit(1)
  })
  .finally(() => prisma.$disconnect())
