import { NextRequest, NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import { validateSession } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

export const dynamic = 'force-dynamic'

/**
 * GET /api/admin/scheduling-beta/clients
 * List all scheduling clients (saved in DB).
 */
export async function GET() {
  try {
    const cookieStore = await cookies()
    const sessionToken = cookieStore.get('session')?.value
    if (!sessionToken) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const user = await validateSession(sessionToken)
    if (!user || user.role !== 'ADMIN') return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

    const list = await prisma.schedulingClient.findMany({
      orderBy: { name: 'asc' },
    })

    const clients = list.map((c) => ({
      id: c.id,
      name: c.name,
      addressLine1: c.addressLine1 ?? '',
      addressLine2: c.addressLine2 ?? '',
      city: c.city ?? '',
      state: c.state ?? '',
      zip: c.zip ?? '',
      preferredRbtEthnicity: c.preferredRbtEthnicity ?? '',
    }))

    return NextResponse.json({ clients })
  } catch (e) {
    console.error('[scheduling-beta] GET clients error:', e)
    return NextResponse.json({ error: 'Failed to load clients' }, { status: 500 })
  }
}

/**
 * POST /api/admin/scheduling-beta/clients
 * Create a scheduling client. Body: { name, addressLine1?, addressLine2?, city?, state?, zip?, preferredRbtEthnicity? }
 */
export async function POST(req: NextRequest) {
  try {
    const cookieStore = await cookies()
    const sessionToken = cookieStore.get('session')?.value
    if (!sessionToken) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const user = await validateSession(sessionToken)
    if (!user || user.role !== 'ADMIN') return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

    const body = await req.json().catch(() => ({}))
    const name = typeof body.name === 'string' ? body.name.trim() : ''
    if (!name) return NextResponse.json({ error: 'name is required' }, { status: 400 })

    const created = await prisma.schedulingClient.create({
      data: {
        name,
        addressLine1: body.addressLine1?.trim() || null,
        addressLine2: body.addressLine2?.trim() || null,
        city: body.city?.trim() || null,
        state: body.state?.trim() || null,
        zip: body.zip?.trim() || null,
        preferredRbtEthnicity: body.preferredRbtEthnicity?.trim() || null,
      },
    })

    return NextResponse.json({
      client: {
        id: created.id,
        name: created.name,
        addressLine1: created.addressLine1 ?? '',
        addressLine2: created.addressLine2 ?? '',
        city: created.city ?? '',
        state: created.state ?? '',
        zip: created.zip ?? '',
        preferredRbtEthnicity: created.preferredRbtEthnicity ?? '',
      },
    })
  } catch (e) {
    console.error('[scheduling-beta] POST client error:', e)
    return NextResponse.json({ error: 'Failed to create client' }, { status: 500 })
  }
}
