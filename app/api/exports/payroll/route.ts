import { NextRequest, NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import { prisma } from '@/lib/prisma'
import { validateSession, isAdmin } from '@/lib/auth'

export async function GET(request: NextRequest) {
  try {
    const cookieStore = await cookies()
    const sessionToken = cookieStore.get('session')?.value
    if (!sessionToken) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const user = await validateSession(sessionToken)
    if (!user || !isAdmin(user)) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    const { searchParams } = new URL(request.url)
    const from = searchParams.get('from')
    const to = searchParams.get('to')

    if (!from || !to) {
      return NextResponse.json({ error: 'from and to are required' }, { status: 400 })
    }

    const fromDate = new Date(from)
    const toDate = new Date(to)
    if (isNaN(fromDate.getTime()) || isNaN(toDate.getTime())) {
      return NextResponse.json({ error: 'Invalid date range' }, { status: 400 })
    }

    const logs = await prisma.clinicalServiceLog.findMany({
      where: {
        serviceDate: {
          gte: fromDate,
          lte: toDate,
        },
      },
      include: {
        employee: true,
        client: true,
      },
      orderBy: { serviceDate: 'asc' },
    })

    const rows = [
      ['Service Date', 'Employee Name', 'Employee Type', 'Client Name', 'Minutes', 'Units'].join(
        ',',
      ),
      ...logs.map((log) =>
        [
          log.serviceDate.toISOString().slice(0, 10),
          log.employee.displayName ?? '',
          log.employee.employeeType,
          log.client.fullName,
          log.minutes ?? '',
          log.units ?? '',
        ]
          .map((v) => `"${String(v).replace(/"/g, '""')}"`)
          .join(','),
      ),
    ]

    const csv = rows.join('\n')

    return new NextResponse(csv, {
      status: 200,
      headers: {
        'Content-Type': 'text/csv; charset=utf-8',
        'Content-Disposition': `attachment; filename="payroll_${from}_${to}.csv"`,
      },
    })
  } catch (error) {
    console.error('[exports:payroll][GET] failed', error)
    return NextResponse.json({ error: 'Failed to generate payroll export' }, { status: 500 })
  }
}

