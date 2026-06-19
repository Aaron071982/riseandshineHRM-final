import { prisma } from '@/lib/prisma'

/** Billing-only portal logins (role BILLING). Extend via BILLING_PORTAL_EMAILS env (comma-separated). */
export const BILLING_PORTAL_USERS = [
  { email: 'rafique@riseandshineaba.com', name: 'Rafique' },
  { email: 'afrin@riseandshineaba.com', name: 'Afrin' },
] as const

export function getBillingPortalEmailSet(): Set<string> {
  const fromEnv = (process.env.BILLING_PORTAL_EMAILS ?? '')
    .split(',')
    .map((e) => e.trim().toLowerCase())
    .filter(Boolean)
  const builtIn = BILLING_PORTAL_USERS.map((u) => u.email)
  return new Set([...builtIn, ...fromEnv])
}

export function isBillingPortalEmail(email: string | null | undefined): boolean {
  if (!email) return false
  return getBillingPortalEmailSet().has(email.trim().toLowerCase())
}

function displayNameForBillingEmail(normalizedEmail: string): string {
  const known = BILLING_PORTAL_USERS.find((u) => u.email === normalizedEmail)
  if (known) return known.name
  const local = normalizedEmail.split('@')[0] ?? 'Billing User'
  return local.charAt(0).toUpperCase() + local.slice(1)
}

/** Create or upgrade an allowlisted email to an active BILLING user (production-safe after OTP verify). */
export async function ensureBillingPortalUser(email: string): Promise<{ id: string } | null> {
  const normalized = email.trim().toLowerCase()
  if (!isBillingPortalEmail(normalized)) return null

  const name = displayNameForBillingEmail(normalized)
  const existing = await prisma.user.findFirst({
    where: { email: { equals: normalized, mode: 'insensitive' } },
    select: { id: true },
  })

  if (existing) {
    await prisma.user.update({
      where: { id: existing.id },
      data: { role: 'BILLING', isActive: true, email: normalized, name },
    })
    return { id: existing.id }
  }

  const created = await prisma.user.create({
    data: {
      email: normalized,
      name,
      role: 'BILLING',
      isActive: true,
      profile: {
        create: {
          fullName: name,
          timezone: 'America/New_York',
          skills: [],
          languages: [],
        },
      },
    },
    select: { id: true },
  })
  return created
}
