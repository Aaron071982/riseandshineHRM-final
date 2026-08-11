import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getClientIpFromRequest } from '@/lib/client-ip'
import {
  requireClientServicesSession,
  enforceClientScope,
} from '@/lib/client-services/access'
import { logClientAccess } from '@/lib/client-services/audit'
import { breakTimerFromRow } from '@/lib/client-services/serviceStatus'
import type { ClientBreakReason } from '@prisma/client'

export const dynamic = 'force-dynamic'

type Ctx = { params: Promise<{ id: string }> }

const REASONS: ClientBreakReason[] = ['VACATION', 'MEDICAL', 'FAMILY', 'OTHER']

function parseReason(raw: unknown): ClientBreakReason {
  const s = String(raw ?? 'OTHER').toUpperCase()
  return (REASONS.includes(s as ClientBreakReason) ? s : 'OTHER') as ClientBreakReason
}

function parseDate(raw: unknown): Date | null {
  if (!raw) return null
  const d = new Date(String(raw))
  return Number.isNaN(d.getTime()) ? null : d
}

/** List active + recent breaks for a client */
export async function GET(request: NextRequest, context: Ctx) {
  const auth = await requireClientServicesSession()
  if (auth.response) return auth.response
  const { user, scope } = auth
  const { id } = await context.params

  const denied = await enforceClientScope(user, scope, id, request)
  if (denied) return denied

  const [clientBreaks, rbtBreaks] = await Promise.all([
    prisma.clientServiceBreak.findMany({
      where: { serviceClientId: id },
      orderBy: { createdAt: 'desc' },
      take: 20,
    }),
    prisma.clientRbtBreak.findMany({
      where: { serviceClientId: id },
      orderBy: { createdAt: 'desc' },
      take: 20,
    }),
  ])

  return NextResponse.json({
    clientBreaks: clientBreaks.map((b) => ({
      ...b,
      timer: breakTimerFromRow({ ...b, kind: 'client' }),
    })),
    rbtBreaks: rbtBreaks.map((b) => ({
      ...b,
      timer: breakTimerFromRow({ ...b, kind: 'rbt', btName: b.btName }),
    })),
  })
}

/**
 * Create a client or RBT break.
 * Body: { type: 'client' | 'rbt', reason, startDate, expectedReturnDate, notes?,
 *         btName?, hasCoverage?, coverageNotes? }
 */
export async function POST(request: NextRequest, context: Ctx) {
  const auth = await requireClientServicesSession()
  if (auth.response) return auth.response
  const { user, scope } = auth
  const { id } = await context.params

  const denied = await enforceClientScope(user, scope, id, request)
  if (denied) return denied

  let body: Record<string, unknown>
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 })
  }

  const type = String(body.type ?? 'client').toLowerCase()
  const reason = parseReason(body.reason)
  const startDate = parseDate(body.startDate)
  if (!startDate) {
    return NextResponse.json({ error: 'startDate required' }, { status: 400 })
  }
  // UI no longer collects expected return; default to start + 14 days when omitted
  let expectedReturnDate = parseDate(body.expectedReturnDate)
  if (!expectedReturnDate) {
    expectedReturnDate = new Date(startDate)
    expectedReturnDate.setDate(expectedReturnDate.getDate() + 14)
  }

  const ip = getClientIpFromRequest(request)

  if (type === 'rbt') {
    const btName = String(body.btName ?? '').trim()
    if (!btName) {
      return NextResponse.json({ error: 'btName required for RBT break' }, { status: 400 })
    }
    const row = await prisma.clientRbtBreak.create({
      data: {
        serviceClientId: id,
        btName,
        reason,
        startDate,
        expectedReturnDate,
        coverageNotes: body.coverageNotes != null ? String(body.coverageNotes) : null,
        hasCoverage: Boolean(body.hasCoverage),
        createdBy: user.id,
      },
    })
    await logClientAccess({
      userId: user.id,
      serviceClientId: id,
      action: 'RBT_BREAK_CREATE',
      ip,
    })
    const { addClientTimelineNote } = await import('@/lib/client-services/timeline')
    const { formatActivityNote } = await import('@/lib/client-services/activityNote')
    const coverage = body.hasCoverage ? 'Coverage arranged' : 'Needs coverage'
    const detailParts = [
      coverage,
      body.coverageNotes != null ? String(body.coverageNotes).trim() : '',
    ].filter(Boolean)
    await addClientTimelineNote({
      serviceClientId: id,
      authorId: user.id,
      content: formatActivityNote(
        `RBT ${btName} on break`,
        detailParts.join('\n') || null
      ),
    })
    return NextResponse.json({
      break: { ...row, timer: breakTimerFromRow({ ...row, kind: 'rbt' }) },
    })
  }

  // Client break — end any existing active client break first
  await prisma.clientServiceBreak.updateMany({
    where: { serviceClientId: id, status: 'ON_BREAK' },
    data: { status: 'RETURNED', actualReturnDate: new Date() },
  })

  const row = await prisma.clientServiceBreak.create({
    data: {
      serviceClientId: id,
      reason,
      startDate,
      expectedReturnDate,
      notes: body.notes != null ? String(body.notes) : null,
      createdBy: user.id,
    },
  })

  await logClientAccess({
    userId: user.id,
    serviceClientId: id,
    action: 'CLIENT_BREAK_CREATE',
    ip,
  })

  const { addClientTimelineNote } = await import('@/lib/client-services/timeline')
  const { formatActivityNote } = await import('@/lib/client-services/activityNote')
  await addClientTimelineNote({
    serviceClientId: id,
    authorId: user.id,
    content: formatActivityNote(
      `Client on break (${reason})`,
      body.notes != null ? String(body.notes).trim() : null
    ),
  })

  return NextResponse.json({
    break: { ...row, timer: breakTimerFromRow({ ...row, kind: 'client' }) },
  })
}

/**
 * Patch break: mark returned, update coverage, etc.
 * Body: { breakId, breakType: 'client'|'rbt', action: 'return' | 'update', ... }
 */
export async function PATCH(request: NextRequest, context: Ctx) {
  const auth = await requireClientServicesSession()
  if (auth.response) return auth.response
  const { user, scope } = auth
  const { id } = await context.params

  const denied = await enforceClientScope(user, scope, id, request)
  if (denied) return denied

  let body: Record<string, unknown>
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 })
  }

  const breakId = String(body.breakId ?? '')
  const breakType = String(body.breakType ?? 'client').toLowerCase()
  const action = String(body.action ?? 'return').toLowerCase()
  if (!breakId) {
    return NextResponse.json({ error: 'breakId required' }, { status: 400 })
  }

  const ip = getClientIpFromRequest(request)

  if (breakType === 'rbt') {
    const existing = await prisma.clientRbtBreak.findFirst({
      where: { id: breakId, serviceClientId: id },
    })
    if (!existing) {
      return NextResponse.json({ error: 'Break not found' }, { status: 404 })
    }
    if (action === 'return') {
      const row = await prisma.clientRbtBreak.update({
        where: { id: breakId },
        data: { status: 'RETURNED', actualReturnDate: new Date() },
      })
      await logClientAccess({
        userId: user.id,
        serviceClientId: id,
        action: 'RBT_BREAK_RETURN',
        ip,
      })
      return NextResponse.json({ break: row })
    }
    const row = await prisma.clientRbtBreak.update({
      where: { id: breakId },
      data: {
        hasCoverage:
          body.hasCoverage !== undefined ? Boolean(body.hasCoverage) : existing.hasCoverage,
        coverageNotes:
          body.coverageNotes !== undefined
            ? String(body.coverageNotes)
            : existing.coverageNotes,
        expectedReturnDate: parseDate(body.expectedReturnDate) ?? existing.expectedReturnDate,
      },
    })
    await logClientAccess({
      userId: user.id,
      serviceClientId: id,
      action: 'RBT_BREAK_UPDATE',
      ip,
    })
    return NextResponse.json({
      break: { ...row, timer: breakTimerFromRow({ ...row, kind: 'rbt' }) },
    })
  }

  const existing = await prisma.clientServiceBreak.findFirst({
    where: { id: breakId, serviceClientId: id },
  })
  if (!existing) {
    return NextResponse.json({ error: 'Break not found' }, { status: 404 })
  }
  if (action === 'return') {
    const row = await prisma.clientServiceBreak.update({
      where: { id: breakId },
      data: { status: 'RETURNED', actualReturnDate: new Date() },
    })
    await logClientAccess({
      userId: user.id,
      serviceClientId: id,
      action: 'CLIENT_BREAK_RETURN',
      ip,
    })
    return NextResponse.json({ break: row })
  }

  const row = await prisma.clientServiceBreak.update({
    where: { id: breakId },
    data: {
      notes: body.notes !== undefined ? String(body.notes) : existing.notes,
      expectedReturnDate: parseDate(body.expectedReturnDate) ?? existing.expectedReturnDate,
    },
  })
  await logClientAccess({
    userId: user.id,
    serviceClientId: id,
    action: 'CLIENT_BREAK_UPDATE',
    ip,
  })
  return NextResponse.json({
    break: { ...row, timer: breakTimerFromRow({ ...row, kind: 'client' }) },
  })
}
