import 'server-only'

import type { ClientStage, Prisma } from '@prisma/client'
import {
  assertCanViewClient,
  getVisibleClientsWhere,
} from '@/lib/crm/access'
import { deriveMetricsForClients } from '@/lib/client-services/serviceStatus'
import { STAGE_LABELS } from '@/lib/crm/stages'
import { classifyClientStaffingNeed } from '@/lib/crm/staffing/needsStaffing'
import { getMcpCrmUser } from '@/lib/mcp/crmUser'
import { paginate, jsonToolResult } from '@/lib/mcp/format'
import type { ToolResult } from '@/lib/mcp/types'
import { NOT_DELETED } from '@/lib/crm/softDelete'
import { prisma } from '@/lib/prisma'
import { getMcpSystemUserId } from '@/lib/mcp/systemUser'
import { auditClientAction } from '@/lib/crm/access'
import { hoursBetween } from '@/lib/rbt-schedule/utils'

const MCP_NOTE_AUTHOR = 'MCP Connector (Claude)'

async function resolveClientId(
  client: string
): Promise<{ id: string } | null> {
  const q = client.trim()
  if (!q) return null
  const user = await getMcpCrmUser()

  const byId = await prisma.serviceClient.findFirst({
    where: { id: q, ...NOT_DELETED, ...getVisibleClientsWhere(user) },
    select: { id: true },
  })
  if (byId) return byId

  const byCode = await prisma.serviceClient.findFirst({
    where: {
      clientCode: { equals: q, mode: 'insensitive' },
      ...NOT_DELETED,
      ...getVisibleClientsWhere(user),
    },
    select: { id: true },
  })
  return byCode
}

export async function lookupClient(args: { query: string }): Promise<ToolResult> {
  const query = args.query?.trim()
  if (!query) throw new Error('query is required')

  const user = await getMcpCrmUser()
  const visible = getVisibleClientsWhere(user)

  const where: Prisma.ServiceClientWhereInput = {
    ...NOT_DELETED,
    AND: [visible],
    OR: [
      { clientCode: { contains: query, mode: 'insensitive' } },
      { firstName: { contains: query, mode: 'insensitive' } },
      { lastName: { contains: query, mode: 'insensitive' } },
      { parentName: { contains: query, mode: 'insensitive' } },
      ...(query.includes('@')
        ? [{ parentEmail: { equals: query, mode: 'insensitive' as const } }]
        : []),
    ],
  }

  const clients = await prisma.serviceClient.findMany({
    where,
    take: 5,
    orderBy: [{ lastName: 'asc' }, { firstName: 'asc' }],
    select: clientSummarySelect,
  })

  if (clients.length === 0) {
    return {
      text: `No client found matching "${query}".`,
      summary: { matchCount: 0 },
    }
  }

  const metrics = await deriveMetricsForClients(
    clients.map((c) => ({
      id: c.id,
      status: c.status,
      authHours: c.authHours,
      btAssignments: c.btAssignments.map((a) => ({ btName: a.btName })),
    }))
  )
  const lines = clients.map((c) => formatClientLine(c, metrics.get(c.id)))

  return {
    text: `# Client lookup (${clients.length})\n\n${lines.join('\n\n')}`,
    summary: { matchCount: clients.length },
  }
}

export async function listClients(args: {
  stage?: string
  state?: string
  needs_staffing?: boolean
  missing_docs?: boolean
  limit?: number
  cursor?: string
}): Promise<ToolResult> {
  const user = await getMcpCrmUser()
  const where: Prisma.ServiceClientWhereInput = {
    ...NOT_DELETED,
    pipelineStatus: 'LIVE',
    ...getVisibleClientsWhere(user),
  }

  if (args.stage?.trim()) {
    where.stage = args.stage.trim().toUpperCase() as ClientStage
  }
  if (args.state?.trim()) {
    where.state = { equals: args.state.trim(), mode: 'insensitive' }
  }

  let clients = await prisma.serviceClient.findMany({
    where,
    orderBy: [{ lastName: 'asc' }, { firstName: 'asc' }, { id: 'asc' }],
    select: {
      id: true,
      clientCode: true,
      firstName: true,
      lastName: true,
      stage: true,
      state: true,
      city: true,
      staffingNeedsMoreHours: true,
      authHours: true,
      status: true,
      requirements: {
        where: {
          deletedAt: null,
          type: 'DOCUMENT',
          status: { in: ['MISSING', 'PENDING', 'EXPIRED'] },
        },
        select: { id: true },
        take: 1,
      },
      btAssignments: {
        where: { deletedAt: null, status: 'ACTIVE' },
        select: { id: true },
      },
      scheduleAssignments: {
        where: { deletedAt: null, isActive: true },
        select: { id: true, needsReplacement: true, replacementResolvedAt: true },
      },
    },
  })

  const metrics = await deriveMetricsForClients(
    clients.map((c) => ({
      id: c.id,
      status: c.status,
      authHours: c.authHours,
      btAssignments: c.btAssignments.map(() => ({ btName: '' })),
    }))
  )

  if (args.needs_staffing) {
    clients = clients.filter((c) => {
      const reasons = classifyClientStaffingNeed({
        id: c.id,
        stage: c.stage,
        staffingNeedsMoreHours: c.staffingNeedsMoreHours,
        authHours: c.authHours,
        activeBtCount: c.btAssignments.length,
        scheduledHoursPerWeek: metrics.get(c.id)?.scheduledHoursPerWeek ?? 0,
        hasOpenReplacementFlag: c.scheduleAssignments.some(
          (a) => a.needsReplacement && !a.replacementResolvedAt
        ),
      })
      return reasons.length > 0
    })
  }

  if (args.missing_docs) {
    clients = clients.filter((c) => c.requirements.length > 0)
  }

  const { page, nextCursor, total } = paginate(
    clients,
    args.limit ?? 25,
    args.cursor
  )

  const rows = page.map((c) => ({
    id: c.id,
    clientCode: c.clientCode,
    name: `${c.firstName} ${c.lastName}`.trim(),
    stage: c.stage,
    stageLabel: STAGE_LABELS[c.stage],
    state: c.state,
    city: c.city,
    scheduledHours: metrics.get(c.id)?.scheduledHoursPerWeek ?? 0,
    activeBts: c.btAssignments.length,
    missingDocs: c.requirements.length > 0,
  }))

  return jsonToolResult('Clients', { total, nextCursor, clients: rows }, {
    count: rows.length,
    total,
    nextCursor,
  })
}

export async function getClientSummary(args: {
  client: string
}): Promise<ToolResult> {
  const resolved = await resolveClientId(args.client)
  if (!resolved) throw new Error(`Client not found: ${args.client}`)

  const user = await getMcpCrmUser()
  await assertCanViewClient(user, resolved.id)

  const client = await prisma.serviceClient.findFirst({
    where: { id: resolved.id, ...getVisibleClientsWhere(user) },
    select: clientSummarySelect,
  })
  if (!client) throw new Error('Client not found or access denied')

  const metrics = await deriveMetricsForClients([
    {
      id: client.id,
      status: client.status,
      authHours: client.authHours,
      btAssignments: client.btAssignments.map((a) => ({ btName: a.btName })),
    },
  ])
  const metric = metrics.get(client.id)

  const missingDocs = client.requirements.filter(
    (r) => r.status === 'MISSING' || r.status === 'PENDING' || r.status === 'EXPIRED'
  )

  const payload = {
    id: client.id,
    clientCode: client.clientCode,
    name: `${client.firstName} ${client.lastName}`.trim(),
    stage: client.stage,
    stageLabel: STAGE_LABELS[client.stage],
    pipelineStatus: client.pipelineStatus,
    serviceAddress: [client.addressLine, client.city, client.state, client.zip]
      .filter(Boolean)
      .join(', '),
    authorizedHours: client.authHours,
    scheduledHoursPerWeek: metric?.scheduledHoursPerWeek ?? 0,
    bcba: client.bcbaProfile?.fullName ?? null,
    caseCoordinator: client.caseCoordinatorUser?.name ?? null,
    btAssignments: client.btAssignments.map((a) => ({
      name: a.btName,
      isPrimary: a.isPrimary,
      rbtProfileId: a.rbtProfileId,
    })),
    missingDocumentCount: missingDocs.length,
    assessmentStatus: client.treatmentPlanStatus,
    insuranceProvider: client.insuranceProvider,
  }

  return jsonToolResult(`Client summary — ${payload.name}`, payload, {
    clientId: client.id,
    stage: client.stage,
  })
}

export async function getClientSchedule(args: {
  client: string
}): Promise<ToolResult> {
  const resolved = await resolveClientId(args.client)
  if (!resolved) throw new Error(`Client not found: ${args.client}`)

  const user = await getMcpCrmUser()
  await assertCanViewClient(user, resolved.id)

  const rows = await prisma.rbtScheduleAssignment.findMany({
    where: {
      serviceClientId: resolved.id,
      deletedAt: null,
      isActive: true,
    },
    orderBy: [{ dayOfWeek: 'asc' }, { startTime: 'asc' }],
    select: {
      id: true,
      dayOfWeek: true,
      startTime: true,
      endTime: true,
      periodStart: true,
      needsReplacement: true,
      rbtProfile: {
        select: { id: true, firstName: true, lastName: true, status: true },
      },
    },
  })

  const schedule = rows.map((r) => ({
    assignmentId: r.id,
    dayOfWeek: r.dayOfWeek,
    startTime: r.startTime,
    endTime: r.endTime,
    periodStart: r.periodStart?.toISOString().slice(0, 10) ?? null,
    hours: hoursBetween(r.startTime, r.endTime),
    therapist: r.rbtProfile
      ? `${r.rbtProfile.firstName} ${r.rbtProfile.lastName}`.trim()
      : null,
    rbtProfileId: r.rbtProfile?.id ?? null,
    needsReplacement: r.needsReplacement,
  }))

  const weeklyHours = schedule.reduce((sum, r) => sum + (r.hours ?? 0), 0)

  return jsonToolResult(
    `Schedule — client ${resolved.id}`,
    { clientId: resolved.id, weeklyHours, entries: schedule },
    { clientId: resolved.id, entryCount: schedule.length, weeklyHours }
  )
}

export async function addClientNote(args: {
  client: string
  note: string
}): Promise<ToolResult> {
  const resolved = await resolveClientId(args.client)
  if (!resolved) throw new Error(`Client not found: ${args.client}`)

  const note = args.note?.trim()
  if (!note) throw new Error('note is required')

  const userId = await getMcpSystemUserId()
  const user = await getMcpCrmUser()
  await assertCanViewClient(user, resolved.id)

  const created = await prisma.serviceClientNote.create({
    data: {
      serviceClientId: resolved.id,
      authorId: userId,
      content: `[${MCP_NOTE_AUTHOR}] ${note}`,
    },
  })

  await auditClientAction({
    userId,
    serviceClientId: resolved.id,
    action: 'NOTE_ADD:MCP',
  })

  return {
    text: `Note saved to client ${resolved.id}. Note ID: ${created.id}. Length: ${note.length} characters.`,
    summary: { clientId: resolved.id, noteId: created.id, noteLength: note.length },
  }
}

const clientSummarySelect = {
  id: true,
  clientCode: true,
  firstName: true,
  lastName: true,
  stage: true,
  pipelineStatus: true,
  addressLine: true,
  city: true,
  state: true,
  zip: true,
  authHours: true,
  status: true,
  insuranceProvider: true,
  treatmentPlanStatus: true,
  bcbaProfile: { select: { fullName: true } },
  caseCoordinatorUser: { select: { name: true } },
  btAssignments: {
    where: { deletedAt: null, status: 'ACTIVE' },
    select: { btName: true, isPrimary: true, rbtProfileId: true },
  },
  requirements: {
    where: { deletedAt: null, type: 'DOCUMENT' },
    select: { key: true, status: true },
  },
} as const

function formatClientLine(
  c: {
    id: string
    clientCode: string
    firstName: string
    lastName: string
    stage: ClientStage
    state: string | null
    city: string | null
    authHours: number | null
    bcbaProfile: { fullName: string } | null
    btAssignments: { btName: string; isPrimary: boolean }[]
  },
  metric?: { scheduledHoursPerWeek: number }
): string {
  const bts = c.btAssignments.map((a) => a.btName).join(', ') || '—'
  return [
    `## ${c.firstName} ${c.lastName} (${c.clientCode})`,
    `- ID: ${c.id}`,
    `- Stage: ${STAGE_LABELS[c.stage]}`,
    `- Location: ${[c.city, c.state].filter(Boolean).join(', ') || '—'}`,
    `- BCBA: ${c.bcbaProfile?.fullName ?? '—'}`,
    `- BTs: ${bts}`,
    `- Auth hours: ${c.authHours ?? '—'}`,
    `- Scheduled hrs/wk: ${metric?.scheduledHoursPerWeek?.toFixed(1) ?? '—'}`,
  ].join('\n')
}
