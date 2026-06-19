import { PrismaClient } from '@prisma/client'
import { BILLING_PORTAL_USERS, ensureBillingLoginUser } from '@/lib/billing-portal-users'

const prisma = new PrismaClient()

async function upsertBillingUser(email: string, name: string) {
  const result = await ensureBillingLoginUser(email, name)
  console.log(`✅ ${email.trim().toLowerCase()} → BILLING (id: ${result.id})`)
  return result
}

async function main() {
  const cliPairs: { email: string; name: string }[] = []
  const args = process.argv.slice(2)
  for (let i = 0; i < args.length; i += 2) {
    const email = args[i]
    const name = args[i + 1] ?? email.split('@')[0] ?? 'Billing User'
    if (email) cliPairs.push({ email, name })
  }

  const targets =
    cliPairs.length > 0
      ? cliPairs
      : process.env.BILLING_TEST_EMAIL
        ? [
            {
              email: process.env.BILLING_TEST_EMAIL,
              name: process.env.BILLING_TEST_NAME ?? 'Billing User',
            },
          ]
        : BILLING_PORTAL_USERS

  console.log(`Setting up ${targets.length} billing portal user(s)…\n`)

  for (const { email, name } of targets) {
    await upsertBillingUser(email, name)
  }

  console.log('\nLogin: OTP to their email at /login → redirects to /billing/dashboard')
  console.log('Local dev: localhost + OTP 123456 if OTP table unavailable (must exist in users as BILLING)')
}

main()
  .catch((e) => {
    console.error('❌ Error:', e)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
