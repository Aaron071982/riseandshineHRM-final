import { NextRequest, NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import { prisma } from '@/lib/prisma'
import { validateSession, isAdmin } from '@/lib/auth'
import { writeAuditLog } from '@/lib/audit'

export async function GET(request: NextRequest) {
  try {
    const cookieStore = await cookies()
    const sessionToken = cookieStore.get('session')?.value
    if (!sessionToken) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const user = await validateSession(sessionToken)
    if (!user) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

    const { searchParams } = new URL(request.url)
    const rbtEmployeeId = searchParams.get('rbtEmployeeId') || undefined
    const bcbaEmployeeId = searchParams.get('bcbaEmployeeId') || undefined
    const from = searchParams.get('from') || undefined
    const to = searchParams.get('to') || undefined

    const where: any = {}
    if (rbtEmployeeId) where.rbtEmployeeId = rbtEmployeeId
    if (bcbaEmployeeId) where.bcbaEmployeeId = bcbaEmployeeId
    if (from || to) {
      where.date = {}
      if (from) where.date.gte = new Date(from)
      if (to) where.date.lte = new Date(to)
    }

    if (user.role === 'RBT') {
      const employee = await prisma.employee.findFirst({
        where: { userId: user.id, employeeType: 'RBT' },
        select: { id: true },
      })
      if (!employee) {
        return NextResponse.json({ error: 'No RBT employee for user' }, { status: 403 })
      }
      where.rbtEmployeeId = employee.id
    } else if (user.role === 'BCBA') {
      const employee = await prisma.employee.findFirst({
        where: { userId: user.id, employeeType: 'BCBA' },
        select: { id: true },
      })
      if (!employee) {
        return NextResponse.json({ error: 'No BCBA employee for user' }, { status: 403 })
      }
      where.bcbaEmployeeId = employee.id
    } else if (!isAdmin(user)) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    const events = await prisma.supervisionEvent.findMany({
      where,
      orderBy: { date: 'desc' },
    })

    return NextResponse.json(events)
  } catch (error) {
    console.error('[supervision:events][GET] failed', error)
    return NextResponse.json({ error: 'Failed to fetch supervision events' }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  try {
    const cookieStore = await cookies()
    const sessionToken = cookieStore.get('session')?.value
    if (!sessionToken) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const user = await validateSession(sessionToken)
    if (!user) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

    if (!(user.role === 'ADMIN' || user.role === 'BCBA')) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    const body = await request.json()
    const {
      rbtEmployeeId,
      bcbaEmployeeId,
      clientId,
      date,
      minutes,
      supervisionType,
      linkedServiceLogId,
      note,
    } = body as {
      rbtEmployeeId?: string
      bcbaEmployeeId?: string
      clientId?: string | null
      date?: string
      minutes?: number
      supervisionType?: string
      linkedServiceLogId?: string | null
      note?: string | null
    }

    if (!rbtEmployeeId) {
      return NextResponse.json({ error: 'rbtEmployeeId is required' }, { status: 400 })
    }
    if (!bcbaEmployeeId) {
      return NextResponse.json({ error: 'bcbaEmployeeId is required' }, { status: 400 })
    }
    if (!date) {
      return NextResponse.json({ error: 'date is required' }, { status: 400 })
    }
    if (typeof minutes !== 'number' || minutes <= 0) {
      return NextResponse.json({ error: 'minutes must be greater than 0' }, { status: 400 })
    }
    if (!supervisionType) {
      return NextResponse.json({ error: 'supervisionType is required' }, { status: 400 })
    }

    const dateObj = new Date(date)
    if (isNaN(dateObj.getTime())) {
      return NextResponse.json({ error: 'Invalid date' }, { status: 400 })
    }

    const created = await prisma.supervisionEvent.create({
      data: {
        rbtEmployeeId,
        bcbaEmployeeId,
        clientId: clientId || null,
        date: dateObj,
        minutes,
        supervisionType: supervisionType as any,
        linkedServiceLogId: linkedServiceLogId || null,
        note: note?.trim() || null,
        createdByUserId: user.id,
      },
    })

    await writeAuditLog({
      actorUserId: user.id,
      entityType: 'SupervisionEvent',
      entityId: created.id,
      action: 'CREATE',
      before: null,
      after: created,
    })

    return NextResponse.json(created, { status: 201 })
  } catch (error) {
    console.error('[supervision:events][POST] failed', error)
    return NextResponse.json({ error: 'Failed to create supervision event' }, { status: 500 })
  }
}

