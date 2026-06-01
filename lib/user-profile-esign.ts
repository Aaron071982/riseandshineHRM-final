import type { Prisma } from '@prisma/client'
import { prisma } from '@/lib/prisma'
import { isMissingColumnError } from '@/lib/db/prisma-errors'

/** Required on create — Postgres rejects NULL for non-null array columns. */
const USER_PROFILE_CREATE_DEFAULTS = {
  skills: [] as string[],
  languages: [] as string[],
} as const

type Db = Prisma.TransactionClient | typeof prisma

/**
 * Record e-sign consent on user_profiles without failing when the row must be created
 * (skills/languages are NOT NULL in the database).
 */
export async function setUserEsignConsent(
  db: Db,
  userId: string,
  signedAt: Date
): Promise<void> {
  try {
    await db.userProfile.upsert({
      where: { userId },
      create: {
        userId,
        ...USER_PROFILE_CREATE_DEFAULTS,
        eSignConsentGiven: true,
        eSignConsentTimestamp: signedAt,
      },
      update: {
        eSignConsentGiven: true,
        eSignConsentTimestamp: signedAt,
      },
    })
    return
  } catch (err) {
    if (!isMissingColumnError(err)) throw err
  }

  try {
    await db.userProfile.upsert({
      where: { userId },
      create: {
        userId,
        ...USER_PROFILE_CREATE_DEFAULTS,
        eSignConsentGiven: true,
      },
      update: { eSignConsentGiven: true },
    })
  } catch (err) {
    if (!isMissingColumnError(err)) throw err
    console.warn('[user-profile-esign] e-sign columns missing — skipping profile update')
  }
}
