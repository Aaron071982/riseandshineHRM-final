import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getClientIpFromRequest } from '@/lib/client-ip'
import { requireClientServicesSession } from '@/lib/client-services/access'
import { getVisibleClientsWhere } from '@/lib/crm/access'
import { logClientAccess } from '@/lib/client-services/audit'
import {
  deriveMetricsForClients,
  getHoursGapThreshold,
  type ServiceBoardBucket,
} from '@/lib/client-services/serviceStatus'
import { getUnlinkedScheduleClientNames } from '@/lib/client-services/scheduleSync'
import { getClientSchedulePeriod } from '@/lib/client-services/schedulePeriod'
import { caseloadQueueWhere, caseloadDeptWhere, isClientStage } from '@/lib/crm/caseloadFilters'
import { canonicalOwnerDeptForStage } from '@/lib/crm/stages'
import { daysInStage, isStalled } from '@/lib/crm/thresholds'
import { parseCalendarDate } from '@/lib/billing/calendarDate'
import type { Prisma, ServiceClientStatus } from '@prisma/client'

export const dynamic = 'force-dynamic'

export async function GET(request: NextRequest) {
  const auth = await requireClientServicesSession()
  if (auth.response) return auth.response
  const { user } = auth

  const sp = request.nextUrl.searchParams
  const q = sp.get('q')?.trim() || ''
  const status = sp.get('status')?.trim() || ''
  const borough = sp.get('borough')?.trim() || ''
  const bcba = sp.get('bcba')?.trim() || ''
  const cc = sp.get('cc')?.trim() || ''
  const insurance = sp.get('insurance')?.trim() || ''
  const docs = sp.get('docs')?.trim() || ''
  const serviceStatus = sp.get('serviceStatus')?.trim() || ''
  const alert = sp.get('alert')?.trim() || ''
  const stage = sp.get('stage')?.trim() || ''
  const queue = sp.get('queue')?.trim() || ''
  const group = sp.get('group')?.trim() || ''
  const dept = sp.get('dept')?.trim() || ''

  const where: Prisma.ServiceClientWhereInput = {
    ...getVisibleClientsWhere(user),
  }

  if (stage && isClientStage(stage)) {
    where.stage = stage
    if (!where.pipelineStatus) where.pipelineStatus = 'LIVE'
  }

  if (queue) {
    const qw = caseloadQueueWhere(queue)
    if (qw) Object.assign(where, qw)
  }

  if (group === 'pipeline') {
    Object.assign(where, caseloadQueueWhere('pipeline') ?? {})
  } else if (group === 'staffing') {
    Object.assign(where, caseloadQueueWhere('staffing') ?? {})
  } else if (group === 'active') {
    Object.assign(where, caseloadQueueWhere('active') ?? {})
  } else if (group === 'on_hold') {
    Object.assign(where, caseloadQueueWhere('on_hold') ?? {})
  }

  if (dept) {
    const dw = caseloadDeptWhere(dept)
    if (dw) Object.assign(where, dw)
  }

  if (status && ['NEW', 'ACTIVE', 'ON_HOLD', 'DISCHARGED'].includes(status)) {
    where.status = status as ServiceClientStatus
  }
  if (borough) where.borough = borough
  if (bcba) where.bcbaName = { contains: bcba, mode: 'insensitive' }
  if (cc) where.caseCoordinatorName = { contains: cc, mode: 'insensitive' }
  if (insurance) where.insuranceProvider = { contains: insurance, mode: 'insensitive' }

  if (q) {
    where.OR = [
      { firstName: { contains: q, mode: 'insensitive' } },
      { lastName: { contains: q, mode: 'insensitive' } },
      { clientCode: { contains: q, mode: 'insensitive' } },
      { parentName: { contains: q, mode: 'insensitive' } },
      { parentEmail: { contains: q, mode: 'insensitive' } },
    ]
  }

  const [clients, threshold, period] = await Promise.all([
    prisma.serviceClient.findMany({
      where,
      include: {
        btAssignments: {
          where: { status: 'ACTIVE' },
          orderBy: [{ isPrimary: 'desc' }, { createdAt: 'asc' }],
          include: {
            rbtProfile: {
              select: { id: true, firstName: true, lastName: true },
            },
          },
        },
        documents: { select: { collected: true } },
        authorizations: {
          where: { authType: 'TREATMENT', status: 'APPROVED' },
          orderBy: { expirationDate: 'asc' },
          take: 1,
          select: { expirationDate: true },
        },
        alerts: {
          where: { resolvedAt: null },
          select: { id: true },
          take: 1,
        },
        teamTasks: {
          where: {
            OR: [
              {
                status: { in: ['TODO', 'IN_PROGRESS', 'BLOCKED'] },
                dueAt: { lt: new Date() },
              },
              { status: 'BLOCKED' },
            ],
          },
          select: { id: true, status: true },
        },
      },
      orderBy: [{ lastName: 'asc' }, { firstName: 'asc' }],
    }),
    getHoursGapThreshold(),
    getClientSchedulePeriod(),
  ])

  const metricsMap = await deriveMetricsForClients(
    clients.map((c) => ({
      id: c.id,
      status: c.status,
      authHours: c.authHours,
      btAssignments: c.btAssignments,
    })),
    threshold,
    period
  )

  let list = clients.map((c) => {
    const docsCollected = c.documents.filter((d) => d.collected).length
    const docsTotal = c.documents.length || 9
    const m = metricsMap.get(c.id)!
    const primaryBt = c.btAssignments[0]
    const rbtName = primaryBt?.rbtProfile
      ? `${primaryBt.rbtProfile.firstName} ${primaryBt.rbtProfile.lastName}`.trim()
      : primaryBt?.btName ?? null
    const days = daysInStage(c)
    const stalled = isStalled(c)
    const hasOverdueTask = c.teamTasks.some((t) => t.status !== 'BLOCKED')
    const blocked = c.teamTasks.some((t) => t.status === 'BLOCKED')
    const needsAttention =
      stalled || c.alerts.length > 0 || hasOverdueTask
    const actionOverdue =
      !!c.nextActionDueAt && c.nextActionDueAt.getTime() < Date.now()
    const missingDocs = docsCollected < docsTotal
    const btNames =
      m.careTeamBtNames.length > 0 ? m.careTeamBtNames : m.scheduleBtNames
    return {
      id: c.id,
      clientCode: c.clientCode,
      firstName: c.firstName,
      lastName: c.lastName,
      status: c.status,
      stage: c.stage,
      pipelineStatus: c.pipelineStatus,
      currentOwnerDept: canonicalOwnerDeptForStage(c.stage, c.currentOwnerDept),
      nextAction: c.nextAction,
      nextActionDueAt: c.nextActionDueAt,
      stageEnteredAt: c.stageEnteredAt,
      daysInStage: days,
      stalled,
      needsAttention,
      actionOverdue,
      blocked,
      missingDocs,
      hasUnresolvedAlerts: c.alerts.length > 0,
      rbtName,
      rbtProfileId: primaryBt?.rbtProfileId ?? null,
      authExpirationDate: c.authorizations[0]?.expirationDate ?? null,
      borough: c.borough,
      addressLine: c.addressLine,
      city: c.city,
      state: c.state,
      zip: c.zip,
      bcbaName: c.bcbaName,
      caseCoordinatorName: c.caseCoordinatorName,
      insuranceProvider: c.insuranceProvider,
      authHours: c.authHours,
      currentHoursPerWeek: c.currentHoursPerWeek,
      serviceEndDate: c.serviceEndDate,
      btNames,
      docsCollected,
      docsTotal,
      docsComplete: docsCollected >= 9,
      scheduledHoursPerWeek: m.scheduledHoursPerWeek,
      hoursGap: m.hoursGap,
      needsAdditionalHours: m.needsAdditionalHours,
      needsRbt: m.needsRbt,
      notBeingServed: m.notBeingServed,
      receivingServices: m.receivingServices,
      scheduleLinked: m.scheduleLinked,
      careTeamScheduleMismatch: m.careTeamScheduleMismatch,
      boardBucket: m.boardBucket as ServiceBoardBucket,
      activeClientBreak: m.activeClientBreak,
      activeRbtBreaks: m.activeRbtBreaks,
    }
  })

  if (docs === 'complete') list = list.filter((c) => c.docsComplete)
  if (docs === 'incomplete') list = list.filter((c) => !c.docsComplete)

  if (serviceStatus) {
    list = list.filter((c) => c.boardBucket === serviceStatus)
  }

  // Clickable dashboard alert filters
  if (alert === 'no_service') list = list.filter((c) => c.notBeingServed)
  if (alert === 'needs_rbt') list = list.filter((c) => c.needsRbt)
  if (alert === 'needs_hours') list = list.filter((c) => c.needsAdditionalHours)
  if (alert === 'client_break') list = list.filter((c) => !!c.activeClientBreak)
  if (alert === 'client_break_overdue')
    list = list.filter((c) => c.activeClientBreak?.overdue)
  if (alert === 'rbt_break') list = list.filter((c) => c.activeRbtBreaks.length > 0)
  if (alert === 'rbt_break_no_coverage')
    list = list.filter((c) => c.activeRbtBreaks.some((b) => !b.hasCoverage))
  if (alert === 'incomplete_docs') list = list.filter((c) => !c.docsComplete)
  if (alert === 'auth_expiring') {
    const in30 = new Date()
    in30.setDate(in30.getDate() + 30)
    const today = new Date()
    today.setHours(0, 0, 0, 0)
    list = list.filter((c) => {
      if (!c.serviceEndDate) return false
      const d = new Date(c.serviceEndDate)
      return d >= today && d <= in30
    })
  }

  const unlinked = await getUnlinkedScheduleClientNames(period)

  await logClientAccess({
    userId: user.id,
    action: 'CLIENT_LIST_VIEW',
    ip: getClientIpFromRequest(request),
  })

  return NextResponse.json({
    clients: list,
    hoursGapThreshold: threshold,
    schedulePeriod: {
      start: period.start,
      end: period.end,
      label: period.label,
    },
    unlinkedScheduleClients: unlinked,
  })
}

/** Create a new service client (full access only). */
export async function POST(request: NextRequest) {
  const auth = await requireClientServicesSession()
  if (auth.response) return auth.response
  const { user } = auth

  const { isClientServicesFullAccessEmail } = await import('@/lib/client-services/access')
  if (!isClientServicesFullAccessEmail(user.email)) {
    return NextResponse.json({ error: 'Forbidden — create requires full access' }, { status: 403 })
  }

  let body: Record<string, unknown>
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 })
  }

  const firstName = String(body.firstName ?? '').trim()
  const lastName = String(body.lastName ?? '').trim()
  if (!firstName || !lastName) {
    return NextResponse.json({ error: 'firstName and lastName are required' }, { status: 400 })
  }

  let clientCode = String(body.clientCode ?? '').trim().toUpperCase()
  if (!clientCode) {
    const latest = await prisma.serviceClient.findMany({
      where: { clientCode: { startsWith: 'CC-' } },
      select: { clientCode: true },
      orderBy: { clientCode: 'desc' },
      take: 50,
    })
    let max = 0
    for (const row of latest) {
      const n = Number(row.clientCode.replace(/^CC-/i, ''))
      if (Number.isFinite(n) && n > max) max = n
    }
    clientCode = `CC-${String(max + 1).padStart(3, '0')}`
  }

  const existing = await prisma.serviceClient.findUnique({ where: { clientCode } })
  if (existing) {
    return NextResponse.json({ error: `Client code ${clientCode} already exists` }, { status: 409 })
  }

  const statusRaw = String(body.status ?? 'NEW').toUpperCase()
  const status = (
    ['NEW', 'ACTIVE', 'ON_HOLD', 'DISCHARGED'].includes(statusRaw) ? statusRaw : 'NEW'
  ) as ServiceClientStatus

  const parseDate = (v: unknown) => parseCalendarDate(v)

  const { SERVICE_CLIENT_DOCUMENT_TYPES } = await import('@/lib/client-services/constants')
  const { addClientTimelineNote, recordStatusChange } = await import(
    '@/lib/client-services/timeline'
  )
  const { STAGE_DEFAULT_OWNER_DEPT } = await import('@/lib/crm/stages')

  const client = await prisma.serviceClient.create({
    data: {
      clientCode,
      firstName,
      lastName,
      status,
      stage: 'INQUIRY',
      pipelineStatus: 'LIVE',
      stageEnteredAt: new Date(),
      currentOwnerDept: STAGE_DEFAULT_OWNER_DEPT.INQUIRY,
      dateOfBirth: parseDate(body.dateOfBirth),
      addressLine: body.addressLine ? String(body.addressLine) : null,
      city: body.city ? String(body.city) : null,
      borough: body.borough ? String(body.borough) : null,
      state: body.state ? String(body.state) : null,
      zip: body.zip ? String(body.zip) : null,
      insuranceProvider: body.insuranceProvider ? String(body.insuranceProvider) : null,
      insuranceId: body.insuranceId ? String(body.insuranceId) : null,
      diagnosis: body.diagnosis ? String(body.diagnosis) : null,
      parentName: body.parentName ? String(body.parentName) : null,
      parentPhone: body.parentPhone ? String(body.parentPhone) : null,
      parentEmail: body.parentEmail ? String(body.parentEmail) : null,
      parentRelationship: body.parentRelationship ? String(body.parentRelationship) : null,
      bcbaName: body.bcbaName ? String(body.bcbaName) : null,
      caseCoordinatorName: body.caseCoordinatorName ? String(body.caseCoordinatorName) : null,
      serviceStartDate: parseDate(body.serviceStartDate),
      serviceEndDate: parseDate(body.serviceEndDate),
      authHours:
        body.authHours !== undefined && body.authHours !== ''
          ? Number(body.authHours)
          : null,
      createdBy: user.id,
      documents: {
        create: SERVICE_CLIENT_DOCUMENT_TYPES.map((documentType) => ({
          documentType,
          collected: false,
        })),
      },
    },
  })

  const btNames = Array.isArray(body.btNames)
    ? (body.btNames as unknown[]).map((n) => String(n).trim()).filter(Boolean)
    : typeof body.btNames === 'string'
      ? String(body.btNames)
          .split(',')
          .map((n) => n.trim())
          .filter(Boolean)
      : []

  if (btNames.length > 0) {
    await prisma.serviceClientBtAssignment.createMany({
      data: btNames.map((btName, idx) => ({
        serviceClientId: client.id,
        btName,
        isPrimary: idx === 0,
        status: 'ACTIVE' as const,
      })),
    })
  }

  await recordStatusChange({
    serviceClientId: client.id,
    fromStatus: null,
    toStatus: status,
    changedBy: user.id,
    reason: 'Client created',
  })
  await addClientTimelineNote({
    serviceClientId: client.id,
    authorId: user.id,
    content: `[Created] ${firstName} ${lastName} (${clientCode})`,
  })

  await logClientAccess({
    userId: user.id,
    serviceClientId: client.id,
    action: 'CLIENT_CREATE',
    ip: getClientIpFromRequest(request),
  })

  return NextResponse.json({ client }, { status: 201 })
}
