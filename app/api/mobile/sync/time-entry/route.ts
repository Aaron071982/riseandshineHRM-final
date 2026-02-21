import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { SignatureStatus } from '@prisma/client'
import type { Prisma } from '@prisma/client'

const SIGNATURE_STATUS_MAP: Record<string, SignatureStatus> = {
  signed: 'SIGNED',
  missing: 'MISSING',
  na: 'NA',
}

function getAuthSecret(): string | undefined {
  return process.env.MOBILE_SYNC_SECRET || process.env.HRM_WEBHOOK_SECRET
}

function authorize(request: NextRequest): boolean {
  const secret = getAuthSecret()
  if (!secret) return false
  const authHeader = request.headers.get('authorization')
  const bearer = authHeader?.startsWith('Bearer ') ? authHeader.slice(7) : null
  const syncKey = request.headers.get('x-hrm-sync-key')
  return bearer === secret || syncKey === secret
}

type SessionNotePayload = {
  summary?: string
  whereServicesWere?: string
  whosInvolved?: string
  goalsWorkedOn?: string
  behaviorsObserved?: string
  reinforcersUsed?: string
  generalComments?: string
  payloadJson?: Record<string, unknown>
  submittedAt?: string
}

type SyncPayload = {
  hrmRbtProfileId: string
  clockInEventId: string
  clockOutEventId: string
  clockInTime: string
  clockOutTime: string
  hrmShiftId?: string
  signatureStatus?: 'signed' | 'missing' | 'na'
  signatureImageUrl?: string
  guardianName?: string
  signedAt?: string
  guardianUnavailableReason?: string
  guardianUnavailableNote?: string
  notes?: string
  latitude?: number
  longitude?: number
  sessionNote?: SessionNotePayload
}

function parsePayload(body: unknown): SyncPayload | null {
  if (!body || typeof body !== 'object') return null
  const o = body as Record<string, unknown>
  if (
    typeof o.hrmRbtProfileId !== 'string' ||
    typeof o.clockInEventId !== 'string' ||
    typeof o.clockOutEventId !== 'string' ||
    typeof o.clockInTime !== 'string' ||
    typeof o.clockOutTime !== 'string'
  )
    return null
  return {
    hrmRbtProfileId: o.hrmRbtProfileId as string,
    clockInEventId: o.clockInEventId as string,
    clockOutEventId: o.clockOutEventId as string,
    clockInTime: o.clockInTime as string,
    clockOutTime: o.clockOutTime as string,
    hrmShiftId: typeof o.hrmShiftId === 'string' ? o.hrmShiftId : undefined,
    signatureStatus: ['signed', 'missing', 'na'].includes(String(o.signatureStatus)) ? (o.signatureStatus as 'signed' | 'missing' | 'na') : undefined,
    signatureImageUrl: typeof o.signatureImageUrl === 'string' ? o.signatureImageUrl : undefined,
    guardianName: typeof o.guardianName === 'string' ? o.guardianName : undefined,
    signedAt: typeof o.signedAt === 'string' ? o.signedAt : undefined,
    guardianUnavailableReason: typeof o.guardianUnavailableReason === 'string' ? o.guardianUnavailableReason : undefined,
    guardianUnavailableNote: typeof o.guardianUnavailableNote === 'string' ? o.guardianUnavailableNote : undefined,
    notes: typeof o.notes === 'string' ? o.notes : undefined,
    latitude: typeof o.latitude === 'number' ? o.latitude : undefined,
    longitude: typeof o.longitude === 'number' ? o.longitude : undefined,
    sessionNote: o.sessionNote && typeof o.sessionNote === 'object' ? (o.sessionNote as SessionNotePayload) : undefined,
  }
}

export async function POST(request: NextRequest) {
  if (!authorize(request)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  let body: unknown
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 })
  }

  const payload = parsePayload(body)
  if (!payload) {
    return NextResponse.json(
      { error: 'Missing or invalid fields: hrmRbtProfileId, clockInEventId, clockOutEventId, clockInTime, clockOutTime required' },
      { status: 400 }
    )
  }

  const clockInTime = new Date(payload.clockInTime)
  const clockOutTime = new Date(payload.clockOutTime)
  if (isNaN(clockInTime.getTime()) || isNaN(clockOutTime.getTime())) {
    return NextResponse.json({ error: 'Invalid clockInTime or clockOutTime' }, { status: 400 })
  }
  if (clockOutTime.getTime() <= clockInTime.getTime()) {
    return NextResponse.json({ error: 'clockOutTime must be after clockInTime' }, { status: 400 })
  }

  const totalHours = Math.round(((clockOutTime.getTime() - clockInTime.getTime()) / (1000 * 60 * 60)) * 100) / 100

  const rbtProfile = await prisma.rBTProfile.findUnique({
    where: { id: payload.hrmRbtProfileId },
  })
  if (!rbtProfile) {
    return NextResponse.json({ error: 'RBT profile not found' }, { status: 404 })
  }

  const signatureStatus = payload.signatureStatus ? SIGNATURE_STATUS_MAP[payload.signatureStatus] ?? null : null
  const signedAt = payload.signedAt ? new Date(payload.signedAt) : null
  if (signedAt && isNaN(signedAt.getTime())) {
    return NextResponse.json({ error: 'Invalid signedAt' }, { status: 400 })
  }

  const submittedAt = payload.sessionNote?.submittedAt ? new Date(payload.sessionNote.submittedAt) : undefined
  if (submittedAt !== undefined && isNaN(submittedAt.getTime())) {
    return NextResponse.json({ error: 'Invalid sessionNote.submittedAt' }, { status: 400 })
  }

  const existing = await prisma.timeEntry.findUnique({
    where: {
      mobileClockEventIdClockIn_mobileClockEventIdClockOut: {
        mobileClockEventIdClockIn: payload.clockInEventId,
        mobileClockEventIdClockOut: payload.clockOutEventId,
      },
    },
    include: { sessionNote: true },
  })

  if (existing) {
    const updated = await prisma.timeEntry.update({
      where: { id: existing.id },
      data: {
        clockInTime,
        clockOutTime,
        totalHours,
        shiftId: payload.hrmShiftId || null,
        signatureStatus: signatureStatus ?? undefined,
        signatureImageUrl: payload.signatureImageUrl,
        guardianName: payload.guardianName,
        signedAt: signedAt ?? undefined,
        guardianUnavailableReason: payload.guardianUnavailableReason,
        guardianUnavailableNote: payload.guardianUnavailableNote,
        notes: payload.notes,
        latitude: payload.latitude,
        longitude: payload.longitude,
      },
      include: { sessionNote: true },
    })

    if (payload.sessionNote) {
      const sn = payload.sessionNote
      if (existing.sessionNote) {
        await prisma.sessionNote.update({
          where: { id: existing.sessionNote.id },
          data: {
            summary: sn.summary,
            whereServicesWere: sn.whereServicesWere,
            whosInvolved: sn.whosInvolved,
            goalsWorkedOn: sn.goalsWorkedOn,
            behaviorsObserved: sn.behaviorsObserved,
            reinforcersUsed: sn.reinforcersUsed,
            generalComments: sn.generalComments,
            payloadJson: (sn.payloadJson ?? undefined) as Prisma.InputJsonValue | undefined,
            submittedAt: submittedAt ?? undefined,
          },
        })
      } else {
        await prisma.sessionNote.create({
          data: {
            timeEntryId: existing.id,
            rbtProfileId: payload.hrmRbtProfileId,
            summary: sn.summary,
            whereServicesWere: sn.whereServicesWere,
            whosInvolved: sn.whosInvolved,
            goalsWorkedOn: sn.goalsWorkedOn,
            behaviorsObserved: sn.behaviorsObserved,
            reinforcersUsed: sn.reinforcersUsed,
            generalComments: sn.generalComments,
            payloadJson: (sn.payloadJson ?? undefined) as Prisma.InputJsonValue | undefined,
            submittedAt: submittedAt ?? undefined,
          },
        })
      }
    }

    return NextResponse.json({ success: true, timeEntryId: updated.id, updated: true })
  }

  const timeEntry = await prisma.timeEntry.create({
    data: {
      rbtProfileId: payload.hrmRbtProfileId,
      shiftId: payload.hrmShiftId || null,
      clockInTime,
      clockOutTime,
      totalHours,
      source: 'MOBILE_APP',
      signatureStatus: signatureStatus ?? undefined,
      signatureImageUrl: payload.signatureImageUrl,
      guardianName: payload.guardianName,
      signedAt: signedAt ?? undefined,
      guardianUnavailableReason: payload.guardianUnavailableReason,
      guardianUnavailableNote: payload.guardianUnavailableNote,
      notes: payload.notes,
      mobileClockEventIdClockIn: payload.clockInEventId,
      mobileClockEventIdClockOut: payload.clockOutEventId,
      latitude: payload.latitude,
      longitude: payload.longitude,
    },
  })

  if (payload.sessionNote) {
    const sn = payload.sessionNote
    await prisma.sessionNote.create({
      data: {
        timeEntryId: timeEntry.id,
        rbtProfileId: payload.hrmRbtProfileId,
        summary: sn.summary,
        whereServicesWere: sn.whereServicesWere,
        whosInvolved: sn.whosInvolved,
        goalsWorkedOn: sn.goalsWorkedOn,
        behaviorsObserved: sn.behaviorsObserved,
        reinforcersUsed: sn.reinforcersUsed,
        generalComments: sn.generalComments,
        payloadJson: (sn.payloadJson ?? undefined) as Prisma.InputJsonValue | undefined,
        submittedAt: submittedAt ?? undefined,
      },
    })
  }

  return NextResponse.json({ success: true, timeEntryId: timeEntry.id })
}
