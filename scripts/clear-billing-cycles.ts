/**
 * Remove all payroll/billing cycle data (cycles, entries, sessions, hour confirmations).
 * Does NOT touch rbt_profiles.hourlyPayRate / artemisProviderName / payRateUpdated*.
 *
 * Usage: npx tsx scripts/clear-billing-cycles.ts [--confirm] [--prod-confirm]
 */
import { PrismaClient } from '@prisma/client'
import { assertWriteTarget } from '../lib/scripts/guard'

const prisma = new PrismaClient()

async function main() {
  const target = assertWriteTarget({ allowProd: true })

  const [cycles, entries, sessions, confirmations, rbtsWithRate] = await Promise.all([
    prisma.billingCycle.count(),
    prisma.billingEntry.count(),
    prisma.billingSession.count(),
    prisma.billingHoursConfirmation.count(),
    prisma.rBTProfile.count({ where: { hourlyPayRate: { not: null } } }),
  ])

  console.log('Before delete:')
  console.log(`  billing_cycles: ${cycles}`)
  console.log(`  billing_entries: ${entries}`)
  console.log(`  billing_sessions: ${sessions}`)
  console.log(`  billing_hours_confirmations: ${confirmations}`)
  console.log(`  RBT profiles with hourlyPayRate set: ${rbtsWithRate}`)

  if (cycles === 0) {
    console.log('\nNo billing cycles to delete.')
    return
  }

  if (target.dryRun) {
    console.log(`\nDry run — would delete ${cycles} billing cycle(s) and related rows.`)
    return
  }

  await prisma.billingSession.deleteMany()
  await prisma.billingHoursConfirmation.deleteMany()
  await prisma.billingEntry.deleteMany()
  const { count: deletedCycles } = await prisma.billingCycle.deleteMany()

  const rbtsWithRateAfter = await prisma.rBTProfile.count({
    where: { hourlyPayRate: { not: null } },
  })

  console.log(`\nDeleted ${deletedCycles} billing cycle(s).`)
  console.log(`RBT profiles with hourlyPayRate set (unchanged): ${rbtsWithRateAfter}`)
}

main()
  .catch((e) => {
    console.error(e)
    process.exit(1)
  })
  .finally(() => prisma.$disconnect())
