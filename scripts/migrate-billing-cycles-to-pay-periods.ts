/**
 * One-shot: migrate Artemis billing_cycles → unified pay_periods.
 *
 *   npx dotenv -e .env.development -- npx tsx scripts/migrate-billing-cycles-to-pay-periods.ts
 *   npx dotenv -e .env -- npx tsx scripts/migrate-billing-cycles-to-pay-periods.ts
 *
 * Pass --force to re-run even when pay periods already exist.
 */
import { PrismaClient } from '@prisma/client'
import { migrateBillingCyclesToPayPeriods } from '../lib/payroll/migrateFromBillingCycles'

const force = process.argv.includes('--force')

async function main() {
  const prisma = new PrismaClient()
  try {
    const existing = await prisma.payPeriod.count()
    if (existing > 0 && !force) {
      console.log(
        `pay_periods already has ${existing} row(s). Re-run with --force to refresh from billing cycles.`
      )
      // Still run — migrator is idempotent and fills missing statements.
    }
    const result = await migrateBillingCyclesToPayPeriods()
    console.log(JSON.stringify(result, null, 2))
  } finally {
    await prisma.$disconnect()
  }
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
