import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { cookies } from 'next/headers'
import { validateSession } from '@/lib/auth'

/**
 * POST /api/admin/rbts/mark-hired-by-name
 * Body: { firstName: string, lastName: string }
 * Marks the RBT profile matching that name (case-insensitive) as HIRED.
 */
export async function POST(request: NextRequest) {
  try {
    const cookieStore = await cookies()
    const sessionToken = cookieStore.get('session')?.value
    if (!sessionToken) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const user = await validateSession(sessionToken)
    if (!user || user.role !== 'ADMIN') return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

    const body = await request.json()
    const firstName = typeof body?.firstName === 'string' ? body.firstName.trim() : ''
    const lastName = typeof body?.lastName === 'string' ? body.lastName.trim() : ''
    if (!firstName || !lastName) {
      return NextResponse.json({ error: 'firstName and lastName are required' }, { status: 400 })
    }

    const updated = await prisma.rBTProfile.updateMany({
      where: {
        firstName: { equals: firstName, mode: 'insensitive' },
        lastName: { equals: lastName, mode: 'insensitive' },
      },
      data: { status: 'HIRED' },
    })

    if (updated.count === 0) {
      return NextResponse.json(
        { error: `No RBT profile found with firstName "${firstName}" and lastName "${lastName}"` },
        { status: 404 }
      )
    }

    return NextResponse.json({ ok: true, updated: updated.count })
  } catch (e) {
    console.error('mark-hired-by-name:', e)
    return NextResponse.json({ error: 'Failed to update' }, { status: 500 })
  }
}
