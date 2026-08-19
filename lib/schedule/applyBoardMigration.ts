import fs from 'fs'
import { prisma } from '@/lib/prisma'
import { getClientSchedulePeriod } from '@/lib/client-services/schedulePeriod'
import { normalizeName } from '@/lib/rbt-schedule/from-roster'
import {
  assignmentFingerprint,
  planBoardSlot,
  summarizePlan,
  type BoardMigrationPlanRow,
  type ExistingAssignment,
} from '@/lib/schedule/boardMigration'

export type BoardMigrationApplyResult = {
  planned: number
  inserted: number
  skipped: number
  unresolvedRbt: number
  reportPath: string | null
  counts: ReturnType<typeof summarizePlan>
  rows: BoardMigrationPlanRow[]
}

export async function planBoardMigration(): Promise<{
  rows: BoardMigrationPlanRow[]
  counts: ReturnType<typeof summarizePlan>
}> {
  const [slots, therapists, clients, rbts, serviceClients, existing, already] =
    await Promise.all([
      prisma.scheduleSessionSlot.findMany(),
      prisma.scheduleTherapist.findMany(),
      prisma.scheduleWeeklyClient.findMany(),
      prisma.rBTProfile.findMany({
        select: { id: true, firstName: true, lastName: true, email: true },
      }),
      prisma.serviceClient.findMany({
        select: {
          id: true,
          firstName: true,
          lastName: true,
          pipelineStatus: true,
        },
      }),
      prisma.rbtScheduleAssignment.findMany({
        where: { deletedAt: null },
        select: {
          id: true,
          rbtProfileId: true,
          clientName: true,
          dayOfWeek: true,
          startTime: true,
          endTime: true,
          serviceClientId: true,
          isActive: true,
        },
      }),
      prisma.rbtScheduleAssignment.findMany({
        where: { boardSlotId: { not: null } },
        select: { boardSlotId: true },
      }),
    ])

  const therapistById = new Map(therapists.map((t) => [t.id, t]))
  const clientById = new Map(clients.map((c) => [c.id, c]))
  const alreadyMigratedSlotIds = new Set(
    already.map((a) => a.boardSlotId).filter((id): id is string => !!id)
  )

  const liveExisting = existing.filter((a) => a.isActive)
  const existingFingerprints = new Set(
    liveExisting.map((a) =>
      assignmentFingerprint({
        rbtProfileId: a.rbtProfileId,
        clientName: a.clientName,
        dayOfWeek: a.dayOfWeek,
        startTime: a.startTime,
        endTime: a.endTime,
      })
    )
  )

  const activeByClientKey = new Map<string, ExistingAssignment[]>()
  const push = (key: string, row: ExistingAssignment) => {
    const list = activeByClientKey.get(key) ?? []
    list.push(row)
    activeByClientKey.set(key, list)
  }
  for (const a of liveExisting) {
    if (a.serviceClientId) push(`id:${a.serviceClientId}`, a)
    push(`name:${normalizeName(a.clientName)}`, a)
  }

  const rows = slots.map((s) =>
    planBoardSlot({
      slot: s,
      therapist: therapistById.get(s.therapistId),
      client: clientById.get(s.clientId),
      rbts,
      serviceClients,
      existingFingerprints,
      alreadyMigratedSlotIds,
      activeByClientKey,
    })
  )

  return { rows, counts: summarizePlan(rows) }
}

export async function applyBoardMigration(opts: {
  createdByUserId: string
  dryRun: boolean
  reportPath?: string | null
}): Promise<BoardMigrationApplyResult> {
  const { rows, counts } = await planBoardMigration()
  const toInsert = rows.filter((r) => r.disposition === 'migrate')
  const period = await getClientSchedulePeriod()

  let inserted = 0
  if (!opts.dryRun) {
    for (const row of toInsert) {
      if (!row.rbtProfileId) continue
      await prisma.rbtScheduleAssignment.create({
        data: {
          rbtProfileId: row.rbtProfileId,
          clientName: row.clientName,
          dayOfWeek: row.dayOfWeek,
          startTime: row.startTime,
          endTime: row.endTime,
          location: row.location,
          notes: '[BOARD_MIGRATION] provisional — confirm or discard',
          isActive: false,
          source: 'BOARD_MIGRATION',
          reviewStatus: 'PENDING',
          boardSlotId: row.boardSlotId,
          clientBorough: null,
          periodStart: period.startDate,
          periodEnd: period.endDate,
          serviceClientId: row.serviceClientId,
          serviceClientLinkManual: false,
          createdBy: opts.createdByUserId,
        },
      })
      inserted++
    }
  }

  let reportPath: string | null = opts.reportPath ?? null
  if (reportPath) {
    fs.writeFileSync(
      reportPath,
      JSON.stringify(
        {
          takenAt: new Date().toISOString(),
          dryRun: opts.dryRun,
          counts,
          inserted,
          rows,
        },
        null,
        2
      )
    )
  }

  return {
    planned: toInsert.length,
    inserted: opts.dryRun ? 0 : inserted,
    skipped: rows.length - toInsert.length,
    unresolvedRbt: counts.unresolved_rbt,
    reportPath,
    counts,
    rows,
  }
}
