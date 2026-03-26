import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { requireAdminSession } from '@/lib/auth'

const VALID_TYPES = ['BCBA', 'BILLING', 'MARKETING', 'CALL_CENTER', 'DEV_TEAM_MEMBER'] as const

export async function POST(request: NextRequest) {
  try {
    const auth = await requireAdminSession()
    if (auth.response) return auth.response
    const user = auth.user

    const body = await request.json()
    const { employeeType, referenceId, periodStart, periodEnd, hours, note } = body as {
      employeeType?: string
      referenceId?: string
      periodStart?: string
      periodEnd?: string
      hours?: number
      note?: string
    }

    if (!employeeType || !VALID_TYPES.includes(employeeType as any)) {
      return NextResponse.json({ error: 'Invalid employeeType' }, { status: 400 })
    }
    if (!referenceId?.trim()) return NextResponse.json({ error: 'referenceId is required' }, { status: 400 })
    if (!periodStart) return NextResponse.json({ error: 'periodStart is required' }, { status: 400 })
    if (!periodEnd) return NextResponse.json({ error: 'periodEnd is required' }, { status: 400 })
    if (typeof hours !== 'number' || hours < 0) return NextResponse.json({ error: 'Valid hours is required' }, { status: 400 })

    const start = new Date(periodStart)
    const end = new Date(periodEnd)
    if (isNaN(start.getTime()) || isNaN(end.getTime())) {
      return NextResponse.json({ error: 'Invalid period dates' }, { status: 400 })
    }

    const log = await prisma.staffHoursLog.create({
      data: {
        employeeType: employeeType as any,
        referenceId: referenceId.trim(),
        periodStart: start,
        periodEnd: end,
        hours,
        note: note?.trim() || null,
      },
    })

    return NextResponse.json({ id: log.id, success: true })
  } catch (error) {
    console.error('Error creating hours log:', error)
    return NextResponse.json({ error: 'Failed to log hours' }, { status: 500 })
  }
}

export async function GET(request: NextRequest) {
  try {
    const auth = await requireAdminSession()
    if (auth.response) return auth.response
    const { searchParams } = new URL(request.url)
    const employeeType = searchParams.get('employeeType')
    const referenceId = searchParams.get('referenceId')

    if (!employeeType || !VALID_TYPES.includes(employeeType as any) || !referenceId) {
      return NextResponse.json({ error: 'employeeType and referenceId are required' }, { status: 400 })
    }

    const logs = await prisma.staffHoursLog.findMany({
      where: { employeeType: employeeType as any, referenceId },
      orderBy: { periodStart: 'desc' },
    })

    return NextResponse.json(logs)
  } catch (error) {
    console.error('Error fetching hours logs:', error)
    return NextResponse.json({ error: 'Failed to fetch logs' }, { status: 500 })
  }
}
