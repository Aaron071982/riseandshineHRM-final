import { NextRequest, NextResponse } from 'next/server'
import type { Prisma } from '@prisma/client'
import { requireClientManagerSession } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { geocodeAddress } from '@/lib/mapbox-geocode'
import { isCrmClientStatus, CRM_CLIENT_STATUSES } from '@/lib/crm-client/constants'
import {
  authExpiryTone,
  calcAgeFromDob,
  formatCrmClientListName,
  hoursRunningLow,
} from '@/lib/crm-client/display'
import { activeCrmBcbaAssignmentWhere, activeCrmRbtAssignmentWhere } from '@/lib/crm-client/assignments'

export const dynamic = 'force-dynamic'

function listSearchWhere(search: string): Prisma.CrmClientWhereInput {
  const q = search.trim()
  return {
    OR: [
      { firstName: { contains: q, mode: 'insensitive' } },
      { lastName: { contains: q, mode: 'insensitive' } },
      { guardianName: { contains: q, mode: 'insensitive' } },
      { insuranceMemberId: { contains: q, mode: 'insensitive' } },
    ],
  }
}

function buildListWhere(
  search: string | null,
  statusFilter: string | null
): Prisma.CrmClientWhereInput {
  const parts: Prisma.CrmClientWhereInput[] = []
  if (search?.trim()) {
    parts.push(listSearchWhere(search))
  }
  if (
    statusFilter &&
    CRM_CLIENT_STATUSES.includes(statusFilter as (typeof CRM_CLIENT_STATUSES)[number])
  ) {
    parts.push({ status: statusFilter })
  }
  if (parts.length === 0) return {}
  if (parts.length === 1) return parts[0]!
  return { AND: parts }
}

export async function GET(request: NextRequest) {
  const auth = await requireClientManagerSession()
  if (auth.response) return auth.response

  try {
    const { searchParams } = request.nextUrl
    const statusFilter = searchParams.get('status')
    const search = searchParams.get('search')
    const page = Math.max(1, parseInt(searchParams.get('page') ?? '1', 10) || 1)
    const limit = Math.min(100, Math.max(1, parseInt(searchParams.get('limit') ?? '50', 10) || 50))
    const skip = (page - 1) * limit

    const combinedWhere = buildListWhere(search, statusFilter)

    const [
      total,
      active,
      waiting,
      newIntake,
      totalCount,
      rows,
    ] = await Promise.all([
      prisma.crmClient.count(),
      prisma.crmClient.count({ where: { status: 'ACTIVE' } }),
      prisma.crmClient.count({ where: { status: 'WAITING' } }),
      prisma.crmClient.count({ where: { status: 'NEW_INTAKE' } }),
      prisma.crmClient.count({ where: combinedWhere }),
      prisma.crmClient.findMany({
        where: combinedWhere,
        skip,
        take: limit,
        orderBy: [{ lastName: 'asc' }, { firstName: 'asc' }],
        include: {
          rbtAssignments: {
            where: activeCrmRbtAssignmentWhere(),
            select: {
              id: true,
              isPrimary: true,
              rbtProfile: { select: { id: true, firstName: true, lastName: true } },
            },
          },
          bcbaAssignments: {
            where: activeCrmBcbaAssignmentWhere(),
            select: {
              id: true,
              isPrimary: true,
              bcbaProfile: { select: { id: true, fullName: true } },
            },
          },
        },
      }),
    ])

    const clients = rows.map((c) => {
      const rbts = c.rbtAssignments
      const primaryBcba = c.bcbaAssignments.find((a) => a.isPrimary) ?? c.bcbaAssignments[0]
      return {
        id: c.id,
        listName: formatCrmClientListName(c.firstName, c.lastName),
        firstName: c.firstName,
        lastName: c.lastName,
        status: c.status,
        age: calcAgeFromDob(c.dateOfBirth),
        city: c.city,
        state: c.state,
        insuranceProvider: c.insuranceProvider,
        authorizationEndDate: c.authorizationEndDate?.toISOString() ?? null,
        authExpiryTone: authExpiryTone(c.authorizationEndDate),
        hoursAlert: hoursRunningLow({
          usedHoursTotal: c.usedHoursTotal,
          authorizedHoursPerWeek: c.authorizedHoursPerWeek,
          authorizationStartDate: c.authorizationStartDate,
        }),
        authorizedHoursPerWeek: c.authorizedHoursPerWeek,
        hasActiveRbt: rbts.length > 0,
        rbtInitials: rbts.slice(0, 3).map((a) => {
          const p = a.rbtProfile
          const i1 = (p.firstName[0] ?? '').toUpperCase()
          const i2 = (p.lastName[0] ?? '').toUpperCase()
          return `${i1}${i2}`
        }),
        rbtCount: rbts.length,
        bcbaName: primaryBcba?.bcbaProfile.fullName ?? null,
      }
    })

    return NextResponse.json({
      stats: {
        total,
        active,
        waiting,
        newIntake,
      },
      clients,
      page,
      limit,
      totalCount,
    })
  } catch (e) {
    console.error('[GET /api/admin/clients]', e)
    return NextResponse.json(
      { error: 'Failed to load clients', details: String(e) },
      { status: 500 }
    )
  }
}

export async function POST(request: NextRequest) {
  const auth = await requireClientManagerSession()
  if (auth.response) return auth.response

  try {
    const body = await request.json().catch(() => ({}))
    const firstName = typeof body.firstName === 'string' ? body.firstName.trim() : ''
    const lastName = typeof body.lastName === 'string' ? body.lastName.trim() : ''
    if (!firstName || !lastName) {
      return NextResponse.json({ error: 'firstName and lastName are required' }, { status: 400 })
    }

    const status =
      typeof body.status === 'string' && isCrmClientStatus(body.status) ? body.status : 'NEW_INTAKE'

    const intakeDate =
      body.intakeDate != null ? new Date(body.intakeDate) : new Date()

    const created = await prisma.crmClient.create({
      data: {
        firstName,
        lastName,
        dateOfBirth: body.dateOfBirth ? new Date(body.dateOfBirth) : null,
        diagnosis: typeof body.diagnosis === 'string' ? body.diagnosis : null,
        status,
        addressLine1: body.addressLine1 ?? null,
        addressLine2: body.addressLine2 ?? null,
        city: body.city ?? null,
        state: body.state ?? null,
        zipCode: body.zipCode ?? null,
        insuranceProvider: body.insuranceProvider ?? null,
        insuranceMemberId: body.insuranceMemberId ?? null,
        insuranceGroupNumber: body.insuranceGroupNumber ?? null,
        insurancePhone: body.insurancePhone ?? null,
        authorizationNumber: body.authorizationNumber ?? null,
        authorizationStartDate: body.authorizationStartDate
          ? new Date(body.authorizationStartDate)
          : null,
        authorizationEndDate: body.authorizationEndDate ? new Date(body.authorizationEndDate) : null,
        authorizedHoursPerWeek:
          body.authorizedHoursPerWeek != null ? Number(body.authorizedHoursPerWeek) : null,
        guardianName: body.guardianName ?? null,
        guardianPhone: body.guardianPhone ?? null,
        guardianEmail: body.guardianEmail ?? null,
        guardianRelationship: body.guardianRelationship ?? null,
        preferredLanguage: body.preferredLanguage ?? null,
        preferredRbtGender: body.preferredRbtGender ?? null,
        preferredRbtEthnicity: body.preferredRbtEthnicity ?? null,
        intakeDate,
        firstSessionDate: body.firstSessionDate ? new Date(body.firstSessionDate) : null,
        notes: typeof body.notes === 'string' ? body.notes : null,
        createdByUserId: auth.user.id,
      },
    })

    const coords = await geocodeAddress(
      created.addressLine1,
      created.city,
      created.state,
      created.zipCode
    )
    if (coords) {
      await prisma.crmClient.update({
        where: { id: created.id },
        data: { latitude: coords.lat, longitude: coords.lng },
      })
    }

    await prisma.clientStatusHistory.create({
      data: {
        clientId: created.id,
        fromStatus: null,
        toStatus: status,
        changedByUserId: auth.user.id,
        reason: 'Client created',
      },
    })

    return NextResponse.json({ id: created.id, success: true })
  } catch (e) {
    console.error('[POST /api/admin/clients]', e)
    return NextResponse.json({ error: 'Failed to create client', details: String(e) }, { status: 500 })
  }
}
