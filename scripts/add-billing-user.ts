import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

/** Billing-only portal users (role BILLING — no admin access). */
const BILLING_PORTAL_USERS: { email: string; name: string }[] = [
  { email: 'rafique@riseandshineaba.com', name: 'Rafique' },
  { email: 'afrin@riseandshineaba.com', name: 'Afrin' },
]

async function upsertBillingUser(email: string, name: string) {
  const normalized = email.trim().toLowerCase()

  const existing = await prisma.user.findFirst({
    where: { email: { equals: normalized, mode: 'insensitive' } },
  })

  if (existing) {
    const updated = await prisma.user.update({
      where: { id: existing.id },
      data: { role: 'BILLING', isActive: true, email: normalized, name: name.trim() },
    })
    console.log(`✅ Updated ${normalized} → BILLING (id: ${updated.id})`)
    return updated
  }

  const created = await prisma.user.create({
    data: {
      email: normalized,
      name: name.trim(),
      role: 'BILLING',
      isActive: true,
      profile: {
        create: {
          fullName: name.trim(),
          timezone: 'America/New_York',
          skills: [],
          languages: [],
        },
      },
    },
  })
  console.log(`✅ Created ${normalized} → BILLING (id: ${created.id})`)
  return created
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
