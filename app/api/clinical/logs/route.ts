import { NextRequest, NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import { prisma } from '@/lib/prisma'
import { validateSession, isAdmin } from '@/lib/auth'
import { writeAuditLog } from '@/lib/audit'
import { validateCptCode, validateMinutes, validateUnits } from '@/lib/validation/clinical'

export async function GET(request: NextRequest) {
  try {
    const cookieStore = await cookies()
    const sessionToken = cookieStore.get('session')?.value
    if (!sessionToken) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const user = await validateSession(sessionToken)
    if (!user) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

    const { searchParams } = new URL(request.url)
    const employeeId = searchParams.get('employeeId') || undefined
    const clientId = searchParams.get('clientId') || undefined
    const cptCode = searchParams.get('cptCode') || undefined
    const from = searchParams.get('from') || undefined
    const to = searchParams.get('to') || undefined

    const where: any = {}
    if (employeeId) where.employeeId = employeeId
    if (clientId) where.clientId = clientId
    if (cptCode) where.cptCode = cptCode
    if (from || to) {
      where.serviceDate = {}
      if (from) where.serviceDate.gte = new Date(from)
      if (to) where.serviceDate.lte = new Date(to)
    }

    if (user.role === 'RBT' || user.role === 'BCBA') {
      // Restrict to own logs for non-admin clinical users
      const employee = await prisma.employee.findFirst({
        where: {
          userId: user.id,
        },
        select: { id: true },
      })
      if (!employee) {
        return NextResponse.json({ error: 'No employee record for user' }, { status: 403 })
      }
      where.employeeId = employee.id
    } else if (!isAdmin(user)) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    const logs = await prisma.clinicalServiceLog.findMany({
      where,
      orderBy: { serviceDate: 'desc' },
    })

    return NextResponse.json(logs)
  } catch (error) {
    console.error('[clinical:logs][GET] failed', error)
    return NextResponse.json({ error: 'Failed to fetch logs' }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  try {
    const cookieStore = await cookies()
    const sessionToken = cookieStore.get('session')?.value
    if (!sessionToken) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const user = await validateSession(sessionToken)
    if (!user) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

    if (!(user.role === 'ADMIN' || user.role === 'RBT' || user.role === 'BCBA')) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    const body = await request.json()
    const {
      employeeId,
      supervisorEmployeeId,
      clientId,
      serviceDate,
      startTime,
      endTime,
      minutes,
      location,
      cptCode,
      isBillable,
      payerAuthorizationId,
      units,
      note,
    } = body as {
      employeeId?: string
      supervisorEmployeeId?: string | null
      clientId?: string
      serviceDate?: string
      startTime?: string | null
      endTime?: string | null
      minutes?: number | null
      location?: string
      cptCode: string
      isBillable?: boolean
      payerAuthorizationId?: string | null
      units?: number | null
      note?: string | null
    }

    if (!employeeId) {
      return NextResponse.json({ error: 'employeeId is required' }, { status: 400 })
    }
    if (!clientId) {
      return NextResponse.json({ error: 'clientId is required' }, { status: 400 })
    }
    if (!serviceDate) {
      return NextResponse.json({ error: 'serviceDate is required' }, { status: 400 })
    }
    if (!location) {
      return NextResponse.json({ error: 'location is required' }, { status: 400 })
    }

    const cptErr = validateCptCode(cptCode)
    if (cptErr) return NextResponse.json({ error: cptErr }, { status: 400 })

    const minutesErr = validateMinutes(minutes ?? null)
    if (minutesErr) return NextResponse.json({ error: minutesErr }, { status: 400 })

    const unitsErr = validateUnits(units ?? null)
    if (unitsErr) return NextResponse.json({ error: unitsErr }, { status: 400 })

    const serviceDateObj = new Date(serviceDate)
    if (isNaN(serviceDateObj.getTime())) {
      return NextResponse.json({ error: 'Invalid serviceDate' }, { status: 400 })
    }

    let startTimeObj: Date | null = null
    let endTimeObj: Date | null = null
    if (startTime) {
      startTimeObj = new Date(startTime)
      if (isNaN(startTimeObj.getTime())) {
        return NextResponse.json({ error: 'Invalid startTime' }, { status: 400 })
      }
    }
    if (endTime) {
      endTimeObj = new Date(endTime)
      if (isNaN(endTimeObj.getTime())) {
        return NextResponse.json({ error: 'Invalid endTime' }, { status: 400 })
      }
    }

    let minutesValue = minutes ?? null
    if (minutesValue == null && startTimeObj && endTimeObj) {
      const diffMs = endTimeObj.getTime() - startTimeObj.getTime()
      minutesValue = Math.round(diffMs / 60000)
      if (minutesValue <= 0) {
        return NextResponse.json({ error: 'End time must be after start time' }, { status: 400 })
      }
    }

    const created = await prisma.clinicalServiceLog.create({
      data: {
        employeeId,
        supervisorEmployeeId: supervisorEmployeeId || null,
        clientId,
        serviceDate: serviceDateObj,
        startTime: startTimeObj,
        endTime: endTimeObj,
        minutes: minutesValue,
        location: location as any,
        cptCode,
        isBillable: isBillable ?? true,
        payerAuthorizationId: payerAuthorizationId || null,
        units: units ?? null,
        note: note?.trim() || null,
        createdByUserId: user.id,
      },
    })

    if (created.isBillable && created.payerAuthorizationId && created.units && created.units > 0) {
      await prisma.payerAuthorization.update({
        where: { id: created.payerAuthorizationId },
        data: {
          unitsUsed: {
            increment: created.units,
          },
        },
      })
    }

    await writeAuditLog({
      actorUserId: user.id,
      entityType: 'ClinicalServiceLog',
      entityId: created.id,
      action: 'CREATE',
      before: null,
      after: created,
    })

    return NextResponse.json(created, { status: 201 })
  } catch (error) {
    console.error('[clinical:logs][POST] failed', error)
    return NextResponse.json({ error: 'Failed to create clinical log' }, { status: 500 })
  }
}

