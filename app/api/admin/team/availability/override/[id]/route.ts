import { NextRequest, NextResponse } from 'next/server'
import { requireAdminSession } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await requireAdminSession()
  if (auth.response) return auth.response

  const { id } = await params
  if (!id) {
    return NextResponse.json({ error: 'Missing override id' }, { status: 400 })
  }

  const prismaAny = prisma as unknown as {
    adminAvailabilityOverride?: {
      findUnique: (args: unknown) => Promise<{ id: string; userId: string } | null>
      delete: (args: unknown) => Promise<unknown>
    }
  }

  if (!prismaAny.adminAvailabilityOverride?.findUnique || !prismaAny.adminAvailabilityOverride?.delete) {
    const rows = await prisma.$queryRawUnsafe<Array<{ id: string; userId: string }>>(
      `SELECT id, "userId" FROM admin_availability_overrides WHERE id = $1 LIMIT 1`,
      id
    ).catch(() => [])
    const row = rows[0] ?? null
    if (!row) {
      return NextResponse.json({ error: 'Override not found' }, { status: 404 })
    }
    if (row.userId !== auth.user.id) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }
    const deleted = await prisma.$executeRawUnsafe(
      `DELETE FROM admin_availability_overrides WHERE id = $1`,
      id
    ).catch(() => 0)
    if (!deleted) {
      return NextResponse.json(
        { error: 'Availability overrides table is not ready yet. Run the latest DB migration and try again.' },
        { status: 503 }
      )
    }
    return NextResponse.json({ success: true })
  }

  let row: { id: string; userId: string } | null = null
  try {
    row = await prismaAny.adminAvailabilityOverride.findUnique({
      where: { id },
      select: { id: true, userId: true },
    })
  } catch {
    return NextResponse.json(
      { error: 'Availability overrides table is not ready yet. Run the latest DB migration and try again.' },
      { status: 503 }
    )
  }
  if (!row) {
    return NextResponse.json({ error: 'Override not found' }, { status: 404 })
  }
  if (row.userId !== auth.user.id) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  try {
    await prismaAny.adminAvailabilityOverride.delete({ where: { id } })
  } catch {
    return NextResponse.json(
      { error: 'Availability overrides table is not ready yet. Run the latest DB migration and try again.' },
      { status: 503 }
    )
  }
  return NextResponse.json({ success: true })
}
