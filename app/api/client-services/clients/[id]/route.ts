import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getClientIpFromRequest } from '@/lib/client-ip'
import {
  requireClientServicesSession,
  enforceClientScope,
  isClientServicesFullAccessEmail,
} from '@/lib/client-services/access'
import { logClientAccess } from '@/lib/client-services/audit'
import { ageFromDob } from '@/lib/client-services/parse'
import { SERVICE_CLIENT_DOCUMENT_LABELS } from '@/lib/client-services/constants'
import {
  deriveClientMetrics,
  getHoursGapThreshold,
} from '@/lib/client-services/serviceStatus'
import {
  getClientSchedulePeriod,
  schedulePeriodWhere,
} from '@/lib/client-services/schedulePeriod'
import type { ServiceClientStatus } from '@prisma/client'

export const dynamic = 'force-dynamic'

type Ctx = { params: Promise<{ id: string }> }

export async function GET(request: NextRequest, context: Ctx) {
  const auth = await requireClientServicesSession()
  if (auth.response) return auth.response
  const { user, scope } = auth
  const { id } = await context.params

  const denied = await enforceClientScope(user, scope, id, request)
  if (denied) return denied

  const client = await prisma.serviceClient.findUnique({
    where: { id },
    include: {
      btAssignments: { orderBy: [{ status: 'asc' }, { createdAt: 'asc' }] },
      documents: { orderBy: { documentType: 'asc' } },
      clientNotes: {
        orderBy: { createdAt: 'desc' },
        include: { author: { select: { id: true, name: true, email: true } } },
        take: 50,
      },
    },
  })

  if (!client) {
    return NextResponse.json({ error: 'Not found' }, { status: 404 })
  }

  let statusHistory: Awaited<
    ReturnType<typeof prisma.serviceClientStatusHistory.findMany>
  > = []
  try {
    statusHistory = await prisma.serviceClientStatusHistory.findMany({
      where: { serviceClientId: id },
      orderBy: { createdAt: 'desc' },
      include: { changedByUser: { select: { id: true, name: true, email: true } } },
      take: 50,
    })
  } catch {
    // Table/client may lag migration — detail page still loads
  }

  const [threshold, period] = await Promise.all([
    getHoursGapThreshold(),
    getClientSchedulePeriod(),
  ])

  const [scheduleSlots, linkedAny, clientBreaks, rbtBreaks] = await Promise.all([
    prisma.rbtScheduleAssignment.findMany({
      where: {
        ...schedulePeriodWhere(period),
        serviceClientId: id,
      },
      select: {
        startTime: true,
        endTime: true,
        isActive: true,
        rbtProfile: {
          select: { firstName: true, lastName: true, artemisProviderName: true },
        },
      },
    }),
    prisma.rbtScheduleAssignment.count({
      where: { isActive: true, serviceClientId: id },
    }),
    prisma.clientServiceBreak.findMany({
      where: { serviceClientId: id, status: 'ON_BREAK' },
    }),
    prisma.clientRbtBreak.findMany({
      where: { serviceClientId: id, status: 'ON_BREAK' },
    }),
  ])

  const metrics = deriveClientMetrics({
    status: client.status,
    authHours: client.authHours,
    careTeamBtNames: client.btAssignments
      .filter((b) => b.status === 'ACTIVE')
      .map((b) => b.btName),
    scheduleSlots,
    clientBreaks,
    rbtBreaks,
    hoursGapThreshold: threshold,
    scheduleLinked: linkedAny > 0,
    period,
  })

  await logClientAccess({
    userId: user.id,
    serviceClientId: id,
    action: 'CLIENT_VIEW',
    ip: getClientIpFromRequest(request),
  })

  const docsCollected = client.documents.filter((d) => d.collected).length

  return NextResponse.json({
    client: {
      ...client,
      statusHistory,
      age: ageFromDob(client.dateOfBirth),
      docsCollected,
      docsTotal: client.documents.length || 9,
      documents: client.documents.map((d) => ({
        ...d,
        label:
          SERVICE_CLIENT_DOCUMENT_LABELS[
            d.documentType as keyof typeof SERVICE_CLIENT_DOCUMENT_LABELS
          ] ?? d.documentType,
      })),
      metrics,
      hoursGapThreshold: threshold,
      schedulePeriod: {
        start: period.start,
        end: period.end,
        label: period.label,
      },
    },
  })
}

export async function PATCH(request: NextRequest, context: Ctx) {
  const auth = await requireClientServicesSession()
  if (auth.response) return auth.response
  const { user, scope } = auth
  const { id } = await context.params

  const denied = await enforceClientScope(user, scope, id, request)
  if (denied) return denied

  // Only full-access users may edit core PHI fields
  if (!isClientServicesFullAccessEmail(user.email)) {
    return NextResponse.json({ error: 'Forbidden — edit requires full access' }, { status: 403 })
  }

  let body: Record<string, unknown>
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 })
  }

  const allowed = [
    'firstName',
    'lastName',
    'status',
    'dateOfBirth',
    'addressLine',
    'city',
    'borough',
    'state',
    'zip',
    'insuranceProvider',
    'insuranceId',
    'diagnosis',
    'parentName',
    'parentPhone',
    'parentEmail',
    'parentRelationship',
    'bcbaName',
    'caseCoordinatorName',
    'serviceStartDate',
    'serviceEndDate',
    'authLengthMonths',
    'authHours',
    'currentHoursPerWeek',
    'notes',
  ] as const

  const data: Record<string, unknown> = {}
  for (const key of allowed) {
    if (key in body) data[key] = body[key]
  }

  if (data.status && !['NEW', 'ACTIVE', 'ON_HOLD', 'DISCHARGED'].includes(String(data.status))) {
    return NextResponse.json({ error: 'Invalid status' }, { status: 400 })
  }
  if (typeof data.status === 'string') {
    data.status = data.status as ServiceClientStatus
  }

  // Coerce date strings
  for (const dk of ['dateOfBirth', 'serviceStartDate', 'serviceEndDate'] as const) {
    if (dk in data && data[dk]) {
      data[dk] = new Date(String(data[dk]))
    } else if (dk in data && data[dk] === null) {
      data[dk] = null
    }
  }

  const existing = await prisma.serviceClient.findUnique({
    where: { id },
    select: { status: true },
  })
  if (!existing) {
    return NextResponse.json({ error: 'Not found' }, { status: 404 })
  }

  const updated = await prisma.serviceClient.update({
    where: { id },
    data,
  })

  if (data.status && String(data.status) !== existing.status) {
    const { recordStatusChange } = await import('@/lib/client-services/timeline')
    await recordStatusChange({
      serviceClientId: id,
      fromStatus: existing.status,
      toStatus: String(data.status),
      changedBy: user.id,
      reason: typeof body.statusReason === 'string' ? body.statusReason : null,
    })
  } else {
    const { addClientTimelineNote } = await import('@/lib/client-services/timeline')
    await addClientTimelineNote({
      serviceClientId: id,
      authorId: user.id,
      content: '[Edit] Client record updated',
    })
  }

  await logClientAccess({
    userId: user.id,
    serviceClientId: id,
    action: 'CLIENT_EDIT',
    ip: getClientIpFromRequest(request),
  })

  return NextResponse.json({ client: updated })
}
