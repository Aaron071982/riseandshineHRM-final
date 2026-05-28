/**
 * One-time: provision 32-step completions for all HIRED RBTs; remove legacy HIPAA tasks.
 * Run: npx tsx scripts/migrate-onboarding-rbts.ts
 */
import { PrismaClient } from '@prisma/client'
import { provisionOnboardingForHiredRbt } from '@/lib/onboarding/provision'

const prisma = new PrismaClient()

async function main() {
  const hired = await prisma.rBTProfile.findMany({
    where: { status: 'HIRED' },
    select: { id: true, firstName: true, lastName: true },
  })
  console.log(`Migrating ${hired.length} hired RBT(s)...`)
  for (const rbt of hired) {
    await provisionOnboardingForHiredRbt(rbt.id)
    console.log(`  OK ${rbt.firstName} ${rbt.lastName}`)
  }
  console.log('Done.')
}

main()
  .finally(() => prisma.$disconnect())
