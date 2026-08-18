/**
 * Idempotent CRM SUPER_ADMIN bootstrap for Aaron + Kazi emails.
 * Usage: dotenv -e .env.development -- npx tsx scripts/bootstrap-crm-roles.ts
 */
import { bootstrapCrmSuperAdmins } from '../lib/crm/bootstrapRoles'
import { prisma } from '../lib/prisma'

async function main() {
  const result = await bootstrapCrmSuperAdmins()
  console.log(JSON.stringify(result, null, 2))
}

main()
  .catch((e) => {
    console.error(e)
    process.exit(1)
  })
  .finally(() => prisma.$disconnect())
