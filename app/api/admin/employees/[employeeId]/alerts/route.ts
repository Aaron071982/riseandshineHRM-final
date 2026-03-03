import { NextRequest, NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import { prisma } from '@/lib/prisma'
import { validateSession, isAdmin } from '@/lib/auth'
import { writeAuditLog } from '@/lib/audit'

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ employeeId: string }> },
) {
  try {
    const cookieStore = await cookies()
    const sessionToken = cookieStore.get('session')?.value
    if (!sessionToken) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const user = await validateSession(sessionToken)
    if (!user) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

    const { employeeId } = await params
    const { searchParams } = new URL(request.url)
    const includeResolved = searchParams.get('includeResolved') === 'true'

    const where: any = { employeeId }
    if (!includeResolved) {
      where.resolvedAt = null
    }

    if (!isAdmin(user)) {
      const employee = await prisma.employee.findFirst({
        where: { id: employeeId, userId: user.id },
        select: { id: true },
      })
      if (!employee) {
        return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
      }
    }

    const alerts = await prisma.complianceAlert.findMany({
      where,
      orderBy: { createdAt: 'desc' },
    })

    return NextResponse.json(alerts)
  } catch (error) {
    console.error('[employees:alerts][GET] failed', error)
    return NextResponse.json({ error: 'Failed to fetch alerts' }, { status: 500 })
  }
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ employeeId: string }> },
) {
  try {
    const cookieStore = await cookies()
    const sessionToken = cookieStore.get('session')?.value
    if (!sessionToken) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const user = await validateSession(sessionToken)
    if (!isAdmin(user)) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

    const { employeeId } = await params
    const { searchParams } = new URL(request.url)
    const id = searchParams.get('id')
    if (!id) return NextResponse.json({ error: 'id is required' }, { status: 400 })

    const existing = await prisma.complianceAlert.findFirst({
      where: { id, employeeId },
    })
    if (!existing) {
      return NextResponse.json({ error: 'Alert not found' }, { status: 404 })
    }

    if (existing.resolvedAt) {
      return NextResponse.json({ error: 'Alert already resolved' }, { status: 400 })
    }

    const body = await request.json()
    const { resolutionNote } = body as { resolutionNote?: string }

    const updated = await prisma.complianceAlert.update({
      where: { id: existing.id },
      data: {
        resolvedAt: new Date(),
        resolvedByUserId: user.id,
        message: resolutionNote
          ? `${existing.message}\n\nResolved: ${resolutionNote}`
          : existing.message,
      },
    })

    await writeAuditLog({
      actorUserId: user.id,
      entityType: 'ComplianceAlert',
      entityId: updated.id,
      action: 'UPDATE',
      before: existing,
      after: updated,
    })

    return NextResponse.json(updated)
  } catch (error) {
    console.error('[employees:alerts][PATCH] failed', error)
    return NextResponse.json({ error: 'Failed to resolve alert' }, { status: 500 })
  }
}

