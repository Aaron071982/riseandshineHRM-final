import { NextRequest, NextResponse } from 'next/server'
import { requireClientManagerSession } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { geocodeAddress } from '@/lib/mapbox-geocode'
import {
  authExpiryTone,
  calcAgeFromDob,
  cumulativeAuthorizedHoursBudget,
  formatMMDDYYYY,
  hoursRunningLow,
} from '@/lib/crm-client/display'
import { activeCrmBcbaAssignmentWhere, activeCrmRbtAssignmentWhere } from '@/lib/crm-client/assignments'

export const dynamic = 'force-dynamic'

export async function GET(
  _request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  const auth = await requireClientManagerSession()
  if (auth.response) return auth.response

  const { id } = await context.params

  try {
    const client = await prisma.crmClient.findUnique({
      where: { id },
      include: {
        createdBy: { select: { id: true, name: true, email: true } },
        rbtAssignments: {
          where: activeCrmRbtAssignmentWhere(),
          orderBy: { createdAt: 'desc' },
          include: {
            rbtProfile: {
              select: {
                id: true,
                firstName: true,
                lastName: true,
                phoneNumber: true,
                email: true,
                languagesJson: true,
                transportation: true,
              },
            },
            assignedBy: { select: { id: true, name: true, email: true } },
          },
        },
        bcbaAssignments: {
          where: activeCrmBcbaAssignmentWhere(),
          orderBy: { createdAt: 'desc' },
          include: {
            bcbaProfile: { select: { id: true, fullName: true, email: true, phone: true } },
            assignedBy: { select: { id: true, name: true, email: true } },
          },
        },
        clientNotes: {
          orderBy: { createdAt: 'desc' },
          include: { author: { select: { id: true, name: true, email: true } } },
        },
        statusHistory: {
          orderBy: { createdAt: 'desc' },
          include: { changedBy: { select: { id: true, name: true, email: true } } },
        },
      },
    })

    if (!client) {
      return NextResponse.json({ error: 'Not found' }, { status: 404 })
    }

    const budget = cumulativeAuthorizedHoursBudget({
      authorizedHoursPerWeek: client.authorizedHoursPerWeek,
      authorizationStartDate: client.authorizationStartDate,
    })
    const remaining =
      budget != null ? Math.max(0, budget - client.usedHoursTotal) : null

    return NextResponse.json({
      currentUserId: auth.user.id,
      client: {
        ...client,
        dateOfBirth: client.dateOfBirth?.toISOString() ?? null,
        authorizationStartDate: client.authorizationStartDate?.toISOString() ?? null,
        authorizationEndDate: client.authorizationEndDate?.toISOString() ?? null,
        intakeDate: client.intakeDate?.toISOString() ?? null,
        firstSessionDate: client.firstSessionDate?.toISOString() ?? null,
        age: calcAgeFromDob(client.dateOfBirth),
        authExpiryTone: authExpiryTone(client.authorizationEndDate),
        hoursAlert: hoursRunningLow({
          usedHoursTotal: client.usedHoursTotal,
          authorizedHoursPerWeek: client.authorizedHoursPerWeek,
          authorizationStartDate: client.authorizationStartDate,
        }),
        cumulativeAuthorizedHoursBudget: budget,
        remainingAuthorizedHours: remaining,
        utilizationPercent:
          budget != null && budget > 0
            ? Math.min(100, Math.round((100 * client.usedHoursTotal) / budget))
            : null,
      },
      display: {
        dobFormatted: formatMMDDYYYY(client.dateOfBirth),
        authStartFormatted: formatMMDDYYYY(client.authorizationStartDate),
        authEndFormatted: formatMMDDYYYY(client.authorizationEndDate),
      },
    })
  } catch (e) {
    console.error('[GET /api/admin/clients/[id]]', e)
    return NextResponse.json({ error: 'Failed to load client', details: String(e) }, { status: 500 })
  }
}

export async function PATCH(
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  const auth = await requireClientManagerSession()
  if (auth.response) return auth.response

  const { id } = await context.params

  try {
    const existing = await prisma.crmClient.findUnique({ where: { id } })
    if (!existing) {
      return NextResponse.json({ error: 'Not found' }, { status: 404 })
    }

    const body = await request.json().catch(() => ({}))

    const data: Record<string, unknown> = {}

    const stringFields = [
      'firstName',
      'lastName',
      'diagnosis',
      'status',
      'addressLine1',
      'addressLine2',
      'city',
      'state',
      'zipCode',
      'insuranceProvider',
      'insuranceMemberId',
      'insuranceGroupNumber',
      'insurancePhone',
      'authorizationNumber',
      'guardianName',
      'guardianPhone',
      'guardianEmail',
      'guardianRelationship',
      'preferredLanguage',
      'preferredRbtGender',
      'preferredRbtEthnicity',
      'notes',
    ] as const
    for (const k of stringFields) {
      if (k in body && body[k] !== undefined) {
        data[k] = body[k] === null ? null : String(body[k])
      }
    }

    const dateFields = [
      'dateOfBirth',
      'authorizationStartDate',
      'authorizationEndDate',
      'intakeDate',
      'firstSessionDate',
    ] as const
    for (const k of dateFields) {
      if (k in body && body[k] !== undefined) {
        data[k] = body[k] ? new Date(body[k] as string) : null
      }
    }

    if ('authorizedHoursPerWeek' in body && body.authorizedHoursPerWeek !== undefined) {
      data.authorizedHoursPerWeek =
        body.authorizedHoursPerWeek === null ? null : Number(body.authorizedHoursPerWeek)
    }
    if ('usedHoursTotal' in body && body.usedHoursTotal !== undefined) {
      data.usedHoursTotal =
        body.usedHoursTotal === null ? null : Number(body.usedHoursTotal)
    }

    const updated = await prisma.crmClient.update({
      where: { id },
      data: data as object,
    })

    const coords = await geocodeAddress(
      updated.addressLine1,
      updated.city,
      updated.state,
      updated.zipCode
    )
    if (coords) {
      await prisma.crmClient.update({
        where: { id },
        data: { latitude: coords.lat, longitude: coords.lng },
      })
    }

    return NextResponse.json({ success: true, id: updated.id })
  } catch (e) {
    console.error('[PATCH /api/admin/clients/[id]]', e)
    return NextResponse.json({ error: 'Failed to update client', details: String(e) }, { status: 500 })
  }
}
