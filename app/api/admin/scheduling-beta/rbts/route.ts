import { NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import { validateSession } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

export const dynamic = 'force-dynamic'

/**
 * GET /api/admin/scheduling-beta/rbts
 * Returns HIRED RBTs with fields needed for scheduling beta (read-only).
 * Localhost/beta only - used by Scheduling System (beta) UI.
 */
export async function GET() {
  try {
    const cookieStore = await cookies()
    const sessionToken = cookieStore.get('session')?.value

    if (!sessionToken) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const user = await validateSession(sessionToken)
    if (!user || user.role !== 'ADMIN') {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    const profiles = await prisma.rBTProfile.findMany({
      where: { status: 'HIRED' },
      select: {
        id: true,
        firstName: true,
        lastName: true,
        email: true,
        phoneNumber: true,
        addressLine1: true,
        addressLine2: true,
        locationCity: true,
        locationState: true,
        zipCode: true,
        ethnicity: true,
      },
      orderBy: [{ lastName: 'asc' }, { firstName: 'asc' }],
    })

    const rbts = profiles.map((p) => ({
      id: p.id,
      firstName: p.firstName,
      lastName: p.lastName,
      fullName: `${p.firstName} ${p.lastName}`,
      email: p.email ?? null,
      phone: p.phoneNumber ?? null,
      addressLine1: p.addressLine1 ?? null,
      addressLine2: p.addressLine2 ?? null,
      city: p.locationCity ?? null,
      state: p.locationState ?? null,
      zip: p.zipCode ?? null,
      ethnicity: p.ethnicity ?? null,
    }))

    return NextResponse.json({ rbts })
  } catch (error) {
    console.error('[scheduling-beta] GET rbts error:', error)
    return NextResponse.json({ error: 'Failed to load RBTs' }, { status: 500 })
  }
}
