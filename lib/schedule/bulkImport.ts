import 'server-only'

import { randomBytes } from 'crypto'
import type { Prisma } from '@prisma/client'
import {
  assertCanEditClient,
  auditClientAction,
  CrmAccessError,
  fetchUserCrmRoles,
  isFullAccess,
  isSuperAdmin,
  type CrmUser,
} from '@/lib/crm/access'
import { assertPortalScheduleReadOnly } from '@/lib/crm/bcbaPortal'
import { NOT_DELETED, softDeleteData } from '@/lib/crm/softDelete'
import { getClientSchedulePeriod } from '@/lib/client-services/schedulePeriod'
import { writeAuditLog } from '@/lib/audit'
import { authorizedHoursWarning } from '@/lib/schedule/hoursCheck'
import { computeSessionBillability } from '@/lib/schedule/billability'
import { hoursBetween, parseTimeToMinutes } from '@/lib/rbt-schedule/utils'
import { prisma } from '@/lib/prisma'
import {
  BULK_IMPORT_BATCH_CAP,
  BULK_IMPORT_PREVIEW_TTL_HOURS,
  bulkImportRequiresAdminApproval,
} from '@/lib/mcp/scheduleBulkImportAllowlist'

export type BulkImportEntryInput = {
  /** Client id or clientCode */
  client: string
  /** RBT profile id, email, or "Last, First" / "First Last" */
  therapist: string
  /** CPT / service code (default 97153) */
  service?: string | null
  /** Day of week 0–6, weekday name, or YYYY-MM-DD date */
  dayOrDate: string | number
  start: string
  end: string
  location?: string | null
}

export type BulkImportRowStatus = 'ok' | 'conflict' | 'error'

export type BulkImportPreviewRow = {
  index: number
  status: BulkImportRowStatus
  reasons: string[]
  naturalKey?: string
  resolved?: {
    serviceClientId: string
    clientCode: string
    clientName: string
    rbtProfileId: string
    therapistName: string
    dayOfWeek: number
    startTime: string
    endTime: string
    location: string | null
    cptCode: string
  }
}

export type OkEntry = NonNullable<BulkImportPreviewRow['resolved']> & {
  index: number
  naturalKey: string
}

export type BulkImportPreviewResult = {
  previewToken: string
  batchId: string
  expiresAt: string
  requiresAdminApproval: boolean
  summary: {
    entries: number
    ok: number
    conflict: number
    error: number
    distinctClients: number
  }
  rows: BulkImportPreviewRow[]
}

export type BulkImportCommitResult =
  | {
      status: 'committed'
      batchId: string
      created: number
      updated: number
      skipped: number
    }
  | {
      status: 'awaiting_admin_approval'
      batchId: string
      previewToken: string
      message: string
    }

const DAY_NAMES: Record<string, number> = {
  sunday: 0,
  sun: 0,
  monday: 1,
  mon: 1,
  tuesday: 2,
  tue: 2,
  tues: 2,
  wednesday: 3,
  wed: 3,
  thursday: 4,
  thu: 4,
  thur: 4,
  thurs: 4,
  friday: 5,
  fri: 5,
  saturday: 6,
  sat: 6,
}

function normalizeTime(raw: string): string | null {
  const t = raw.trim()
  const m = /^(\d{1,2}):(\d{2})$/.exec(t)
  if (!m) return null
  const h = Number(m[1])
  const min = Number(m[2])
  if (h < 0 || h > 23 || min < 0 || min > 59) return null
  return `${String(h).padStart(2, '0')}:${String(min).padStart(2, '0')}`
}

function parseDayOfWeek(dayOrDate: string | number): number | null {
  if (typeof dayOrDate === 'number') {
    if (Number.isInteger(dayOrDate) && dayOrDate >= 0 && dayOrDate <= 6) {
      return dayOrDate
    }
    return null
  }
  const s = dayOrDate.trim()
  if (/^\d$/.test(s)) {
    const n = Number(s)
    return n >= 0 && n <= 6 ? n : null
  }
  const named = DAY_NAMES[s.toLowerCase()]
  if (named != null) return named
  const iso = /^(\d{4})-(\d{2})-(\d{2})$/.exec(s)
  if (iso) {
    const d = new Date(Date.UTC(Number(iso[1]), Number(iso[2]) - 1, Number(iso[3])))
    if (Number.isNaN(d.getTime())) return null
    return d.getUTCDay()
  }
  return null
}

function naturalKey(parts: {
  serviceClientId: string
  rbtProfileId: string
  dayOfWeek: number
  startTime: string
}): string {
  return `${parts.serviceClientId}|${parts.rbtProfileId}|${parts.dayOfWeek}|${parts.startTime}`
}

function overlaps(
  aStart: number,
  aEnd: number,
  bStart: number,
  bEnd: number
): boolean {
  return aStart < bEnd && bStart < aEnd
}

export async function loadCrmUserForBulkImport(
  userId: string
): Promise<CrmUser | null> {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: {
      id: true,
      email: true,
      name: true,
      role: true,
      phoneNumber: true,
      isActive: true,
      canBulkImportSchedule: true,
    },
  })
  if (!user || !user.isActive) return null
  const crmRoles = await fetchUserCrmRoles(user.id)
  const subject = { id: user.id, email: user.email, crmRoles }
  return {
    id: user.id,
    email: user.email,
    name: user.name,
    role: user.role,
    phoneNumber: user.phoneNumber,
    crmRoles,
    fullAccess: isFullAccess(subject),
    superAdmin: isSuperAdmin(subject),
  }
}

async function resolveClient(raw: string): Promise<
  | {
      id: string
      clientCode: string
      firstName: string
      lastName: string
      borough: string | null
      authHours: number | null
      pipelineStatus: string
      stage: string
    }
  | { error: string }
> {
  const q = raw.trim()
  if (!q) return { error: 'Client identifier is empty' }

  const matches = await prisma.serviceClient.findMany({
    where: {
      ...NOT_DELETED,
      OR: [
        { id: q },
        { clientCode: { equals: q, mode: 'insensitive' } },
      ],
    },
    take: 3,
    select: {
      id: true,
      clientCode: true,
      firstName: true,
      lastName: true,
      borough: true,
      authHours: true,
      pipelineStatus: true,
      stage: true,
    },
  })

  if (matches.length === 0) {
    // Name search — only if exact single match
    const byName = await prisma.serviceClient.findMany({
      where: {
        ...NOT_DELETED,
        OR: [
          {
            AND: [
              { firstName: { equals: q.split(/\s+/)[0] ?? '', mode: 'insensitive' } },
              {
                lastName: {
                  equals: q.split(/\s+/).slice(1).join(' ') || q,
                  mode: 'insensitive',
                },
              },
            ],
          },
        ],
      },
      take: 3,
      select: {
        id: true,
        clientCode: true,
        firstName: true,
        lastName: true,
        borough: true,
        authHours: true,
        pipelineStatus: true,
        stage: true,
      },
    })
    if (byName.length === 1) return byName[0]
    if (byName.length > 1) {
      return {
        error: `Ambiguous client "${q}" — use client code or id (${byName
          .map((c) => c.clientCode)
          .join(', ')})`,
      }
    }
    return { error: `Client not found: ${q}` }
  }
  if (matches.length > 1) {
    return {
      error: `Ambiguous client "${q}" — matches ${matches
        .map((c) => c.clientCode)
        .join(', ')}`,
    }
  }
  return matches[0]
}

async function resolveTherapist(raw: string): Promise<
  | { id: string; firstName: string; lastName: string; email: string | null }
  | { error: string }
> {
  const q = raw.trim()
  if (!q) return { error: 'Therapist identifier is empty' }

  const byId = await prisma.rBTProfile.findFirst({
    where: { id: q },
    select: { id: true, firstName: true, lastName: true, email: true },
  })
  if (byId) return byId

  if (q.includes('@')) {
    const byEmail = await prisma.rBTProfile.findMany({
      where: { email: { equals: q, mode: 'insensitive' } },
      take: 3,
      select: { id: true, firstName: true, lastName: true, email: true },
    })
    if (byEmail.length === 1) return byEmail[0]
    if (byEmail.length > 1) {
      return { error: `Ambiguous therapist email "${q}"` }
    }
  }

  let first = ''
  let last = ''
  if (q.includes(',')) {
    const [l, f] = q.split(',', 2)
    last = (l ?? '').trim()
    first = (f ?? '').trim()
  } else {
    const parts = q.split(/\s+/).filter(Boolean)
    if (parts.length >= 2) {
      first = parts[0]
      last = parts.slice(1).join(' ')
    }
  }

  if (first && last) {
    const byName = await prisma.rBTProfile.findMany({
      where: {
        firstName: { equals: first, mode: 'insensitive' },
        lastName: { equals: last, mode: 'insensitive' },
      },
      take: 3,
      select: { id: true, firstName: true, lastName: true, email: true },
    })
    if (byName.length === 1) return byName[0]
    if (byName.length > 1) {
      return {
        error: `Ambiguous therapist "${q}" — use email or rbtProfileId`,
      }
    }
  }

  return { error: `Therapist not found: ${q}` }
}

type LiveSlot = {
  id: string
  serviceClientId: string | null
  rbtProfileId: string
  dayOfWeek: number
  startMin: number
  endMin: number
}

function conflictReasons(
  candidate: {
    serviceClientId: string
    rbtProfileId: string
    dayOfWeek: number
    startMin: number
    endMin: number
  },
  live: LiveSlot[],
  proposed: Array<{
    index: number
    serviceClientId: string
    rbtProfileId: string
    dayOfWeek: number
    startMin: number
    endMin: number
  }>,
  selfIndex: number
): string[] {
  const reasons: string[] = []
  for (const slot of live) {
    if (slot.dayOfWeek !== candidate.dayOfWeek) continue
    if (!overlaps(candidate.startMin, candidate.endMin, slot.startMin, slot.endMin)) {
      continue
    }
    if (slot.rbtProfileId === candidate.rbtProfileId) {
      reasons.push('Therapist double-booked at this time')
    }
    if (slot.serviceClientId === candidate.serviceClientId) {
      reasons.push('Client double-booked at this time')
    }
  }
  for (const other of proposed) {
    if (other.index === selfIndex) continue
    if (other.dayOfWeek !== candidate.dayOfWeek) continue
    if (
      !overlaps(candidate.startMin, candidate.endMin, other.startMin, other.endMin)
    ) {
      continue
    }
    if (other.rbtProfileId === candidate.rbtProfileId) {
      reasons.push('Therapist double-booked within this import batch')
    }
    if (other.serviceClientId === candidate.serviceClientId) {
      reasons.push('Client double-booked within this import batch')
    }
  }
  return [...new Set(reasons)]
}

/**
 * Validate entries only — never writes assignments.
 * Stores a preview batch keyed by previewToken for a later commit.
 */
export async function previewScheduleBulkImport(input: {
  actor: CrmUser
  entries: BulkImportEntryInput[]
}): Promise<BulkImportPreviewResult> {
  assertPortalScheduleReadOnly(input.actor)

  if (!Array.isArray(input.entries) || input.entries.length === 0) {
    throw new Error('entries[] is required')
  }
  if (input.entries.length > BULK_IMPORT_BATCH_CAP) {
    throw new Error(
      `Batch cap is ${BULK_IMPORT_BATCH_CAP} rows per commit — split into multiple previews`
    )
  }

  const rows: BulkImportPreviewRow[] = []
  const proposed: Array<{
    index: number
    serviceClientId: string
    rbtProfileId: string
    dayOfWeek: number
    startMin: number
    endMin: number
  }> = []

  // Resolve all first pass (without cross-batch conflicts)
  type PartialResolved = {
    index: number
    status: BulkImportRowStatus
    reasons: string[]
    resolved?: OkEntry
  }
  const partials: PartialResolved[] = []

  for (let i = 0; i < input.entries.length; i++) {
    const entry = input.entries[i]
    const reasons: string[] = []

    const client = await resolveClient(String(entry.client ?? ''))
    if ('error' in client) {
      partials.push({ index: i, status: 'error', reasons: [client.error] })
      continue
    }

    if (
      client.pipelineStatus === 'DISCHARGED' ||
      client.pipelineStatus === 'LOST' ||
      client.stage === 'DISCHARGED'
    ) {
      partials.push({
        index: i,
        status: 'error',
        reasons: [`Client ${client.clientCode} is inactive/discharged`],
      })
      continue
    }

    try {
      await assertCanEditClient(input.actor, client.id)
    } catch (err) {
      const msg =
        err instanceof CrmAccessError
          ? err.message
          : 'Forbidden to edit this client'
      partials.push({ index: i, status: 'error', reasons: [msg] })
      continue
    }

    const therapist = await resolveTherapist(String(entry.therapist ?? ''))
    if ('error' in therapist) {
      partials.push({ index: i, status: 'error', reasons: [therapist.error] })
      continue
    }

    const anyAssigned = await prisma.serviceClientBtAssignment.count({
      where: {
        serviceClientId: client.id,
        status: 'ACTIVE',
        rbtProfileId: { not: null },
      },
    })
    if (anyAssigned > 0) {
      const assigned = await prisma.serviceClientBtAssignment.findFirst({
        where: {
          serviceClientId: client.id,
          rbtProfileId: therapist.id,
          status: 'ACTIVE',
        },
      })
      if (!assigned) {
        partials.push({
          index: i,
          status: 'error',
          reasons: [
            'Schedule RBT should be one of the assigned care-team RBTs',
          ],
        })
        continue
      }
    }

    const dayOfWeek = parseDayOfWeek(entry.dayOrDate)
    if (dayOfWeek == null) {
      partials.push({
        index: i,
        status: 'error',
        reasons: [
          `Invalid day/date "${entry.dayOrDate}" — use 0–6, weekday name, or YYYY-MM-DD`,
        ],
      })
      continue
    }

    const startTime = normalizeTime(String(entry.start ?? ''))
    const endTime = normalizeTime(String(entry.end ?? ''))
    if (!startTime || !endTime) {
      partials.push({
        index: i,
        status: 'error',
        reasons: ['Invalid time — use HH:MM (24h)'],
      })
      continue
    }
    if (startTime >= endTime) {
      partials.push({
        index: i,
        status: 'error',
        reasons: ['endTime must be after startTime'],
      })
      continue
    }

    const startMin = parseTimeToMinutes(startTime)
    const endMin = parseTimeToMinutes(endTime)
    if (startMin == null || endMin == null || endMin <= startMin) {
      partials.push({
        index: i,
        status: 'error',
        reasons: ['Invalid time range'],
      })
      continue
    }

    const addedHours = hoursBetween(startTime, endTime)
    const existingHours = await prisma.rbtScheduleAssignment.findMany({
      where: {
        serviceClientId: client.id,
        isActive: true,
        deletedAt: null,
        reviewStatus: { in: ['NONE', 'CONFIRMED'] },
      },
      select: { startTime: true, endTime: true },
    })
    const currentHours = existingHours.reduce(
      (sum, s) => sum + hoursBetween(s.startTime, s.endTime),
      0
    )
    const hoursCheck = authorizedHoursWarning({
      currentHours,
      addedHours,
      authHours: client.authHours,
    })
    if (hoursCheck.over) {
      reasons.push(
        hoursCheck.warning ??
          'Scheduled hours exceed authorized weekly hours'
      )
    }

    const cptCode = (entry.service?.trim() || '97153').toUpperCase()
    const key = naturalKey({
      serviceClientId: client.id,
      rbtProfileId: therapist.id,
      dayOfWeek,
      startTime,
    })

    const resolved: OkEntry = {
      index: i,
      naturalKey: key,
      serviceClientId: client.id,
      clientCode: client.clientCode,
      clientName: `${client.firstName} ${client.lastName}`.trim(),
      rbtProfileId: therapist.id,
      therapistName: `${therapist.firstName} ${therapist.lastName}`.trim(),
      dayOfWeek,
      startTime,
      endTime,
      location: entry.location?.trim() || null,
      cptCode,
    }

    proposed.push({
      index: i,
      serviceClientId: client.id,
      rbtProfileId: therapist.id,
      dayOfWeek,
      startMin,
      endMin,
    })

    partials.push({
      index: i,
      status: reasons.length ? 'conflict' : 'ok',
      reasons,
      resolved,
    })
  }

  // Load live slots for involved therapists/clients
  const therapistIds = [
    ...new Set(proposed.map((p) => p.rbtProfileId)),
  ]
  const clientIds = [...new Set(proposed.map((p) => p.serviceClientId))]
  const liveRows =
    therapistIds.length || clientIds.length
      ? await prisma.rbtScheduleAssignment.findMany({
          where: {
            isActive: true,
            deletedAt: null,
            reviewStatus: { in: ['NONE', 'CONFIRMED'] },
            OR: [
              ...(therapistIds.length
                ? [{ rbtProfileId: { in: therapistIds } }]
                : []),
              ...(clientIds.length
                ? [{ serviceClientId: { in: clientIds } }]
                : []),
            ],
          },
          select: {
            id: true,
            serviceClientId: true,
            rbtProfileId: true,
            dayOfWeek: true,
            startTime: true,
            endTime: true,
          },
        })
      : []

  const live: LiveSlot[] = liveRows
    .map((r) => {
      const startMin = parseTimeToMinutes(r.startTime)
      const endMin = parseTimeToMinutes(r.endTime)
      if (startMin == null || endMin == null) return null
      return {
        id: r.id,
        serviceClientId: r.serviceClientId,
        rbtProfileId: r.rbtProfileId,
        dayOfWeek: r.dayOfWeek,
        startMin,
        endMin,
      }
    })
    .filter((x): x is LiveSlot => x != null)

  for (const p of partials) {
    if (!p.resolved || p.status === 'error') {
      rows.push({
        index: p.index,
        status: p.status,
        reasons: p.reasons,
        naturalKey: p.resolved?.naturalKey,
        resolved: p.resolved
          ? {
              serviceClientId: p.resolved.serviceClientId,
              clientCode: p.resolved.clientCode,
              clientName: p.resolved.clientName,
              rbtProfileId: p.resolved.rbtProfileId,
              therapistName: p.resolved.therapistName,
              dayOfWeek: p.resolved.dayOfWeek,
              startTime: p.resolved.startTime,
              endTime: p.resolved.endTime,
              location: p.resolved.location,
              cptCode: p.resolved.cptCode,
            }
          : undefined,
      })
      continue
    }

    const startMin = parseTimeToMinutes(p.resolved.startTime)!
    const endMin = parseTimeToMinutes(p.resolved.endTime)!
    const conflict = conflictReasons(
      {
        serviceClientId: p.resolved.serviceClientId,
        rbtProfileId: p.resolved.rbtProfileId,
        dayOfWeek: p.resolved.dayOfWeek,
        startMin,
        endMin,
      },
      live,
      proposed,
      p.index
    )
    const reasons = [...p.reasons, ...conflict]
    const status: BulkImportRowStatus = reasons.length
      ? reasons.some((r) => r.includes('double-booked'))
        ? 'conflict'
        : p.status === 'conflict'
          ? 'conflict'
          : 'conflict'
      : 'ok'

    rows.push({
      index: p.index,
      status: reasons.length ? status : 'ok',
      reasons,
      naturalKey: p.resolved.naturalKey,
      resolved: {
        serviceClientId: p.resolved.serviceClientId,
        clientCode: p.resolved.clientCode,
        clientName: p.resolved.clientName,
        rbtProfileId: p.resolved.rbtProfileId,
        therapistName: p.resolved.therapistName,
        dayOfWeek: p.resolved.dayOfWeek,
        startTime: p.resolved.startTime,
        endTime: p.resolved.endTime,
        location: p.resolved.location,
        cptCode: p.resolved.cptCode,
      },
    })
  }

  const okEntries: OkEntry[] = rows
    .filter((r) => r.status === 'ok' && r.resolved && r.naturalKey)
    .map((r) => ({
      index: r.index,
      naturalKey: r.naturalKey!,
      ...r.resolved!,
    }))

  // Dedupe natural keys within ok set — keep first, mark later as conflict
  const seen = new Set<string>()
  const dedupedOk: OkEntry[] = []
  for (const row of rows) {
    if (row.status !== 'ok' || !row.naturalKey || !row.resolved) continue
    if (seen.has(row.naturalKey)) {
      row.status = 'conflict'
      row.reasons = [
        ...row.reasons,
        'Duplicate natural key within import (client+day+start+therapist)',
      ]
      continue
    }
    seen.add(row.naturalKey)
    dedupedOk.push({
      index: row.index,
      naturalKey: row.naturalKey,
      ...row.resolved,
    })
  }

  const okCount = rows.filter((r) => r.status === 'ok').length
  const conflictCount = rows.filter((r) => r.status === 'conflict').length
  const errorCount = rows.filter((r) => r.status === 'error').length
  const distinctClients = new Set(
    rows
      .filter((r) => r.resolved)
      .map((r) => r.resolved!.serviceClientId)
  ).size

  const previewToken = randomBytes(24).toString('hex')
  const expiresAt = new Date(
    Date.now() + BULK_IMPORT_PREVIEW_TTL_HOURS * 60 * 60 * 1000
  )
  const requiresAdminApproval = bulkImportRequiresAdminApproval()

  const batch = await prisma.scheduleBulkImportBatch.create({
    data: {
      previewToken,
      actorUserId: input.actor.id,
      status: 'PREVIEW',
      requiresAdminApproval,
      entryCount: rows.length,
      okCount,
      conflictCount,
      errorCount,
      okEntriesJson: dedupedOk as unknown as Prisma.InputJsonValue,
      previewJson: rows as unknown as Prisma.InputJsonValue,
      expiresAt,
    },
  })

  return {
    previewToken: batch.previewToken,
    batchId: batch.id,
    expiresAt: expiresAt.toISOString(),
    requiresAdminApproval,
    summary: {
      entries: rows.length,
      ok: okCount,
      conflict: conflictCount,
      error: errorCount,
      distinctClients,
    },
    rows,
  }
}

export async function commitScheduleBulkImport(input: {
  actor: CrmUser
  previewToken: string
  confirm: boolean
}): Promise<BulkImportCommitResult> {
  assertPortalScheduleReadOnly(input.actor)

  if (input.confirm !== true) {
    throw new Error('confirm: true is required to commit')
  }

  const token = input.previewToken?.trim()
  if (!token) throw new Error('previewToken is required')

  const batch = await prisma.scheduleBulkImportBatch.findUnique({
    where: { previewToken: token },
  })
  if (!batch) throw new Error('Unknown or expired previewToken')
  if (batch.actorUserId !== input.actor.id) {
    throw new Error('Forbidden: previewToken belongs to another user')
  }
  if (batch.status === 'COMMITTED') {
    // Idempotent: already committed
    const count = await prisma.rbtScheduleAssignment.count({
      where: { bulkImportBatchId: batch.id, deletedAt: null },
    })
    return {
      status: 'committed',
      batchId: batch.id,
      created: count,
      updated: 0,
      skipped: 0,
    }
  }
  if (batch.status === 'ROLLED_BACK') {
    throw new Error('This batch was rolled back — run a new preview')
  }
  if (batch.expiresAt < new Date() && batch.status === 'PREVIEW') {
    await prisma.scheduleBulkImportBatch.update({
      where: { id: batch.id },
      data: { status: 'EXPIRED' },
    })
    throw new Error('Preview token expired — run preview_schedule_import again')
  }

  if (batch.requiresAdminApproval && !batch.adminApprovedAt) {
    if (batch.status !== 'AWAITING_ADMIN') {
      await prisma.scheduleBulkImportBatch.update({
        where: { id: batch.id },
        data: { status: 'AWAITING_ADMIN' },
      })
    }
    return {
      status: 'awaiting_admin_approval',
      batchId: batch.id,
      previewToken: batch.previewToken,
      message:
        'Batch requires one-time admin approval in Admin → MCP Connections before commit. Re-call commit_schedule_import after approval.',
    }
  }

  const okEntries = batch.okEntriesJson as unknown as OkEntry[]
  if (!Array.isArray(okEntries) || okEntries.length === 0) {
    throw new Error('No ok rows to commit from this preview')
  }
  if (okEntries.length > BULK_IMPORT_BATCH_CAP) {
    throw new Error(`Batch exceeds cap of ${BULK_IMPORT_BATCH_CAP}`)
  }

  const period = await getClientSchedulePeriod()
  let created = 0
  let updated = 0
  let skipped = 0

  for (const entry of okEntries) {
    await assertCanEditClient(input.actor, entry.serviceClientId)

    const treatmentAuths = await prisma.clientAuthorization.findMany({
      where: {
        serviceClientId: entry.serviceClientId,
        deletedAt: null,
        authType: 'TREATMENT',
        status: 'APPROVED',
      },
      select: {
        effectiveDate: true,
        expirationDate: true,
        renderingProviderId: true,
        serviceLocation: true,
        lines: {
          where: { deletedAt: null },
          select: { cptCode: true, authRequired: true },
        },
      },
    })
    const billability = computeSessionBillability({
      dateOfService: period.startDate,
      cptCode: entry.cptCode,
      serviceLocation: entry.location,
      authorizations: treatmentAuths,
    })

    const existing = await prisma.rbtScheduleAssignment.findFirst({
      where: {
        serviceClientId: entry.serviceClientId,
        rbtProfileId: entry.rbtProfileId,
        dayOfWeek: entry.dayOfWeek,
        startTime: entry.startTime,
        isActive: true,
        deletedAt: null,
      },
    })

    if (existing) {
      if (existing.bulkImportBatchId === batch.id) {
        skipped++
        continue
      }
      const before = { ...existing }
      const row = await prisma.rbtScheduleAssignment.update({
        where: { id: existing.id },
        data: {
          endTime: entry.endTime,
          location: entry.location,
          cptCode: entry.cptCode,
          serviceLocation: entry.location,
          billabilityStatus: billability.status,
          billabilityReason: billability.reason,
          bulkImportBatchId: batch.id,
          notes: existing.notes?.includes('[MCP bulk]')
            ? existing.notes
            : `${existing.notes ?? ''} [MCP bulk]`.trim(),
        },
      })
      updated++
      await writeAuditLog({
        actorUserId: input.actor.id,
        entityType: 'RbtScheduleAssignment',
        entityId: row.id,
        action: 'UPDATE',
        before,
        after: {
          auditAction: 'SCHEDULE_BULK_IMPORT',
          batchId: batch.id,
          ...row,
        },
      })
      await auditClientAction({
        userId: input.actor.id,
        serviceClientId: entry.serviceClientId,
        action: 'SCHEDULE_BULK_IMPORT',
      })
      continue
    }

    const client = await prisma.serviceClient.findUniqueOrThrow({
      where: { id: entry.serviceClientId },
      select: { firstName: true, lastName: true, borough: true },
    })

    const row = await prisma.rbtScheduleAssignment.create({
      data: {
        rbtProfileId: entry.rbtProfileId,
        clientName: `${client.firstName} ${client.lastName}`.trim(),
        dayOfWeek: entry.dayOfWeek,
        startTime: entry.startTime,
        endTime: entry.endTime,
        location: entry.location,
        notes: '[MCP bulk] schedule entry',
        isActive: true,
        source: 'MANUAL',
        clientBorough: client.borough,
        periodStart: period.startDate,
        periodEnd: period.endDate,
        serviceClientId: entry.serviceClientId,
        cptCode: entry.cptCode,
        serviceLocation: entry.location,
        billabilityStatus: billability.status,
        billabilityReason: billability.reason,
        serviceClientLinkManual: true,
        bulkImportBatchId: batch.id,
        createdBy: input.actor.id,
      },
    })
    created++
    await writeAuditLog({
      actorUserId: input.actor.id,
      entityType: 'RbtScheduleAssignment',
      entityId: row.id,
      action: 'CREATE',
      after: {
        auditAction: 'SCHEDULE_BULK_IMPORT',
        batchId: batch.id,
        ...row,
      },
    })
    await auditClientAction({
      userId: input.actor.id,
      serviceClientId: entry.serviceClientId,
      action: 'SCHEDULE_BULK_IMPORT',
    })
  }

  await prisma.scheduleBulkImportBatch.update({
    where: { id: batch.id },
    data: { status: 'COMMITTED', committedAt: new Date() },
  })

  return {
    status: 'committed',
    batchId: batch.id,
    created,
    updated,
    skipped,
  }
}

export async function rollbackScheduleBulkImport(input: {
  actor: CrmUser
  batchId: string
}): Promise<{ batchId: string; rolledBack: number }> {
  assertPortalScheduleReadOnly(input.actor)

  const batch = await prisma.scheduleBulkImportBatch.findUnique({
    where: { id: input.batchId.trim() },
  })
  if (!batch) throw new Error('Batch not found')
  if (batch.actorUserId !== input.actor.id && !input.actor.superAdmin) {
    throw new Error('Forbidden: batch belongs to another user')
  }
  if (batch.status === 'ROLLED_BACK') {
    return { batchId: batch.id, rolledBack: 0 }
  }
  if (batch.status !== 'COMMITTED') {
    throw new Error('Only committed batches can be rolled back')
  }

  const rows = await prisma.rbtScheduleAssignment.findMany({
    where: {
      bulkImportBatchId: batch.id,
      deletedAt: null,
    },
  })

  let rolledBack = 0
  for (const row of rows) {
    const before = { ...row }
    await prisma.rbtScheduleAssignment.update({
      where: { id: row.id },
      data: {
        isActive: false,
        ...softDeleteData(input.actor.id),
      },
    })
    rolledBack++
    await writeAuditLog({
      actorUserId: input.actor.id,
      entityType: 'RbtScheduleAssignment',
      entityId: row.id,
      action: 'DELETE',
      before,
      after: {
        auditAction: 'SCHEDULE_BULK_IMPORT_ROLLBACK',
        batchId: batch.id,
      },
    })
    if (row.serviceClientId) {
      await auditClientAction({
        userId: input.actor.id,
        serviceClientId: row.serviceClientId,
        action: 'SCHEDULE_BULK_IMPORT_ROLLBACK',
      })
    }
  }

  await prisma.scheduleBulkImportBatch.update({
    where: { id: batch.id },
    data: { status: 'ROLLED_BACK', rolledBackAt: new Date() },
  })

  return { batchId: batch.id, rolledBack }
}

export async function approveBulkImportBatch(input: {
  adminUserId: string
  batchId: string
}): Promise<void> {
  const batch = await prisma.scheduleBulkImportBatch.findUnique({
    where: { id: input.batchId },
  })
  if (!batch) throw new Error('Batch not found')
  if (batch.status !== 'AWAITING_ADMIN' && batch.status !== 'PREVIEW') {
    throw new Error(`Cannot approve batch in status ${batch.status}`)
  }
  await prisma.scheduleBulkImportBatch.update({
    where: { id: batch.id },
    data: {
      requiresAdminApproval: false,
      adminApprovedAt: new Date(),
      adminApprovedByUserId: input.adminUserId,
      status: 'PREVIEW',
    },
  })
}
