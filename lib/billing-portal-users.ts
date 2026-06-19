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

function displayNameForBillingEmail(normalizedEmail: string, fallback?: string | null): string {
  const known = BILLING_PORTAL_USERS.find((u) => u.email === normalizedEmail)
  if (known) return known.name
  if (fallback?.trim()) return fallback.trim()
  const local = normalizedEmail.split('@')[0] ?? 'Billing User'
  return local.charAt(0).toUpperCase() + local.slice(1)
}

/**
 * Create or update an active User with role BILLING for portal login.
 * Used when admin creates a billing employee profile or on OTP verify.
 */
export async function ensureBillingLoginUser(
  email: string,
  fullName?: string | null
): Promise<{ id: string }> {
  const normalized = email.trim().toLowerCase()
  if (!normalized.includes('@')) {
    throw new Error('Invalid email for billing login user')
  }

  const name = displayNameForBillingEmail(normalized, fullName)
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

/** Allowlisted billing emails (Rafique, Afrin, etc.). */
export async function ensureBillingPortalUser(email: string): Promise<{ id: string } | null> {
  if (!isBillingPortalEmail(email)) return null
  return ensureBillingLoginUser(email)
}

/** Link every billing_profiles row with an email to a BILLING login user. */
export async function syncBillingProfileLoginUsers(): Promise<number> {
  const profiles = await prisma.billingProfile.findMany({
    where: { email: { not: null } },
    select: { email: true, fullName: true },
  })
  let count = 0
  for (const p of profiles) {
    const email = p.email?.trim()
    if (!email) continue
    await ensureBillingLoginUser(email, p.fullName)
    count++
  }
  for (const { email, name } of BILLING_PORTAL_USERS) {
    await ensureBillingLoginUser(email, name)
    count++
  }
  return count
}
