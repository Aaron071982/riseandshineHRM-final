/**
 * Idempotent CRM SUPER_ADMIN bootstrap for Aaron + Kazi emails.
 * Dry-run by default. Never runs against prod.
 *
 *   dotenv -e .env.development -- npx tsx scripts/bootstrap-crm-roles.ts
 *   dotenv -e .env.development -- npx tsx scripts/bootstrap-crm-roles.ts --confirm
 */
import { bootstrapCrmSuperAdmins } from '../lib/crm/bootstrapRoles'
import { prisma } from '../lib/prisma'
import { assertWriteTarget } from '../lib/scripts/guard'

async function main() {
  const target = assertWriteTarget({ allowProd: false })
  if (target.dryRun) {
    console.log('Dry run — would upsert SUPER_ADMIN CRM roles for allowlisted emails.')
    console.log('Pass --confirm to write.')
    return
  }
  const result = await bootstrapCrmSuperAdmins()
  console.log(JSON.stringify(result, null, 2))
}

main()
  .catch((e) => {
    console.error(e)
    process.exit(1)
  })
  .finally(() => prisma.$disconnect())
