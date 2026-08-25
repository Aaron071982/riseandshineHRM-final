import { prisma } from '@/lib/prisma'
import { inferBorough, normalizeBorough, normalizePersonName } from './borough'

/**
 * Fill therapist.borough from matched RBT profiles (city/zip) when unset,
 * and re-normalize known aliases (e.g. Jericho → Long Island).
 * Returns number of therapists updated.
 */
export async function syncTherapistBoroughsFromRbtProfiles(): Promise<number> {
  const [therapists, rbts] = await Promise.all([
    prisma.scheduleTherapist.findMany({
      where: { active: true },
      select: { id: true, name: true, email: true, borough: true },
    }),
    prisma.rBTProfile.findMany({
      where: { status: { notIn: ['FIRED', 'REJECTED'] } },
      select: {
        firstName: true,
        lastName: true,
        email: true,
        locationCity: true,
        zipCode: true,
        addressLine1: true,
      },
    }),
  ])

  type RbtRow = (typeof rbts)[number]
  const byEmail = new Map<string, RbtRow>()
  const byName = new Map<string, RbtRow>()
  for (const r of rbts) {
    if (r.email) byEmail.set(r.email.trim().toLowerCase(), r)
    byName.set(normalizePersonName(`${r.firstName} ${r.lastName}`), r)
  }

  let updated = 0
  for (const t of therapists) {
    // Re-normalize city aliases already stored (Jericho → Long Island)
    if (t.borough?.trim()) {
      const normalized = normalizeBorough(t.borough)
      if (normalized !== 'Unassigned' && normalized !== t.borough) {
        await prisma.scheduleTherapist.update({
          where: { id: t.id },
          data: { borough: normalized },
        })
        updated++
      }
      continue
    }

    const email = t.email?.trim().toLowerCase()
    const match =
      (email ? byEmail.get(email) : undefined) ?? byName.get(normalizePersonName(t.name))
    if (!match) continue
    const borough = inferBorough({
      city: match.locationCity,
      zip: match.zipCode,
      address: match.addressLine1,
    })
    if (borough === 'Unassigned') continue
    await prisma.scheduleTherapist.update({
      where: { id: t.id },
      data: { borough },
    })
    updated++
  }
  return updated
}
