import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getClientIpFromRequest } from '@/lib/client-ip'
import { requireClientServicesSession } from '@/lib/client-services/access'
import { getVisibleClientsWhere } from '@/lib/crm/access'
import { logClientAccess } from '@/lib/client-services/audit'
import { caseloadQueueWhere, isClientStage } from '@/lib/crm/caseloadFilters'
import { STAGE_LABELS } from '@/lib/crm/stages'
import { assertRateLimit } from '@/lib/otp-rate-limit'
import type { Prisma } from '@prisma/client'

export const dynamic = 'force-dynamic'

function csvEscape(v: string | number | null | undefined): string {
  const s = v == null ? '' : String(v)
  if (/[",\n\r]/.test(s)) return `"${s.replace(/"/g, '""')}"`
  return s
}

/** Export scoped caseload as CSV (same filters as list GET). */
export async function GET(request: NextRequest) {
  const auth = await requireClientServicesSession()
  if (auth.response) return auth.response
  const { user } = auth

  const limited = await assertRateLimit(
    `crm:export:user:${user.id}`,
    10,
    15 * 60 * 1000,
    'Too many exports. Please wait before trying again.'
  )
  if (limited) return limited

  const sp = request.nextUrl.searchParams
  const q = sp.get('q')?.trim() || ''
  const stage = sp.get('stage')?.trim() || ''
  const queue = sp.get('queue')?.trim() || ''
  const group = sp.get('group')?.trim() || ''

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

  if (q) {
    where.OR = [
      { firstName: { contains: q, mode: 'insensitive' } },
      { lastName: { contains: q, mode: 'insensitive' } },
      { clientCode: { contains: q, mode: 'insensitive' } },
      { parentName: { contains: q, mode: 'insensitive' } },
      { parentEmail: { contains: q, mode: 'insensitive' } },
    ]
  }

  const clients = await prisma.serviceClient.findMany({
    where,
    orderBy: [{ lastName: 'asc' }, { firstName: 'asc' }],
    include: {
      btAssignments: {
        where: { status: 'ACTIVE' },
        orderBy: [{ isPrimary: 'desc' }],
        take: 3,
        include: {
          rbtProfile: { select: { firstName: true, lastName: true } },
        },
      },
      bcbaProfile: { select: { fullName: true } },
      caseCoordinatorUser: { select: { name: true, email: true } },
    },
  })

  const header = [
    'clientCode',
    'firstName',
    'lastName',
    'stage',
    'pipelineStatus',
    'ownerDept',
    'nextAction',
    'nextActionDueAt',
    'rbtTargetDate',
    'treatmentPlanStatus',
    'preferredRbtGender',
    'preferredRbtEthnicities',
    'insurance',
    'parentName',
    'parentPhone',
    'parentEmail',
    'borough',
    'bcba',
    'caseCoordinator',
    'rbts',
  ]

  const lines = [header.join(',')]
  for (const c of clients) {
    const rbts = c.btAssignments
      .map((a) =>
        a.rbtProfile
          ? `${a.rbtProfile.firstName} ${a.rbtProfile.lastName}`.trim()
          : a.btName
      )
      .filter(Boolean)
      .join('; ')
    lines.push(
      [
        csvEscape(c.clientCode),
        csvEscape(c.firstName),
        csvEscape(c.lastName),
        csvEscape(STAGE_LABELS[c.stage] ?? c.stage),
        csvEscape(c.pipelineStatus),
        csvEscape(c.currentOwnerDept),
        csvEscape(c.nextAction),
        csvEscape(
          c.nextActionDueAt ? c.nextActionDueAt.toISOString().slice(0, 10) : ''
        ),
        csvEscape(
          c.rbtTargetDate ? c.rbtTargetDate.toISOString().slice(0, 10) : ''
        ),
        csvEscape(c.treatmentPlanStatus),
        csvEscape(c.preferredRbtGender),
        csvEscape(c.preferredRbtEthnicities.join(';')),
        csvEscape(c.insuranceProvider),
        csvEscape(c.parentName),
        csvEscape(c.parentPhone),
        csvEscape(c.parentEmail),
        csvEscape(c.borough),
        csvEscape(c.bcbaProfile?.fullName || c.bcbaName),
        csvEscape(
          c.caseCoordinatorUser?.name ||
            c.caseCoordinatorUser?.email ||
            c.caseCoordinatorName
        ),
        csvEscape(rbts),
      ].join(',')
    )
  }

  await logClientAccess({
    userId: user.id,
    action: 'CLIENT_LIST_EXPORT',
    ip: getClientIpFromRequest(request),
  })

  const stamp = new Date().toISOString().slice(0, 10)
  return new NextResponse(lines.join('\n'), {
    status: 200,
    headers: {
      'Content-Type': 'text/csv; charset=utf-8',
      'Content-Disposition': `attachment; filename="caseload-${stamp}.csv"`,
    },
  })
}
