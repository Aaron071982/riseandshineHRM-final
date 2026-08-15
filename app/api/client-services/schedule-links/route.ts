import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getClientIpFromRequest } from '@/lib/client-ip'
import {
  requireClientServicesSession,
  isClientServicesFullAccessEmail,
  enforceClientScope,
} from '@/lib/client-services/access'
import { getVisibleClientsWhere } from '@/lib/crm/access'
import { logClientAccess } from '@/lib/client-services/audit'
import {
  createManualClientSessions,
  getUnlinkedScheduleClientNames,
  manualLinkScheduleName,
  manualUnlinkScheduleName,
  resolveScheduleClientLinks,
  searchScheduleClientNames,
  unlinkServiceClientSchedule,
} from '@/lib/client-services/scheduleSync'
import { getClientSchedulePeriod } from '@/lib/client-services/schedulePeriod'

export const dynamic = 'force-dynamic'

/**
 * GET — unlinked schedule client names (+ search)
 * POST — link | unlink | unlink-client | resolve-all | create-manual
 */
export async function GET(request: NextRequest) {
  const auth = await requireClientServicesSession()
  if (auth.response) return auth.response
  const { user } = auth

  if (!isClientServicesFullAccessEmail(user.email)) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const period = await getClientSchedulePeriod()
  const prefer = (request.nextUrl.searchParams.get('prefer') ?? '').trim()
  const q = (request.nextUrl.searchParams.get('q') ?? '').trim()

  const [unlinked, searched, clients] = await Promise.all([
    getUnlinkedScheduleClientNames(period, { preferQuery: prefer || q }),
    q
      ? searchScheduleClientNames(period, q, { includeLinked: true, limit: 50 })
      : // Still surface period names even without q so dropdown isn't empty for MANUAL rows
        searchScheduleClientNames(period, prefer || '', { includeLinked: true, limit: 200 }),
    prisma.serviceClient.findMany({
      where: getVisibleClientsWhere(user),
      select: { id: true, clientCode: true, firstName: true, lastName: true },
      orderBy: [{ lastName: 'asc' }, { firstName: 'asc' }],
    }),
  ])

  const seen = new Set<string>()
  const merged: { clientName: string; assignmentCount: number; linked?: boolean }[] = []
  for (const row of searched) {
    if (seen.has(row.clientName)) continue
    seen.add(row.clientName)
    merged.push(row)
  }
  for (const row of unlinked) {
    if (seen.has(row.clientName)) continue
    seen.add(row.clientName)
    merged.push(row)
  }

  await logClientAccess({
    userId: user.id,
    action: 'SCHEDULE_LINKS_VIEW',
    ip: getClientIpFromRequest(request),
  })

  return NextResponse.json({
    unlinked: merged,
    clients,
    schedulePeriod: {
      start: period.start,
      end: period.end,
      label: period.label,
    },
  })
}

export async function POST(request: NextRequest) {
  const auth = await requireClientServicesSession()
  if (auth.response) return auth.response
  const { user, scope } = auth

  if (!isClientServicesFullAccessEmail(user.email)) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  let body: Record<string, unknown>
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 })
  }

  const action = String(body.action ?? '').toLowerCase()
  const ip = getClientIpFromRequest(request)

  if (action === 'resolve-all') {
    const result = await resolveScheduleClientLinks()
    await logClientAccess({ userId: user.id, action: 'SCHEDULE_LINKS_RESOLVE', ip })
    return NextResponse.json({ success: true, ...result })
  }

  if (action === 'link') {
    const name = String(body.scheduleClientName ?? '').trim()
    const serviceClientId = String(body.serviceClientId ?? '').trim()
    if (!name || !serviceClientId) {
      return NextResponse.json(
        { error: 'scheduleClientName and serviceClientId required' },
        { status: 400 }
      )
    }
    const denied = await enforceClientScope(user, scope, serviceClientId, request)
    if (denied) return denied
    const count = await manualLinkScheduleName(name, serviceClientId)
    if (count === 0) {
      return NextResponse.json(
        {
          error: `No schedule sessions found named "${name}". Use “Add schedule sessions” below, or check the name matches the Schedule roster exactly.`,
          updated: 0,
        },
        { status: 404 }
      )
    }
    await logClientAccess({
      userId: user.id,
      serviceClientId,
      action: 'SCHEDULE_LINK',
      ip,
    })
    return NextResponse.json({ success: true, updated: count })
  }

  if (action === 'create-manual') {
    const serviceClientId = String(body.serviceClientId ?? '').trim()
    const scheduleClientName = String(body.scheduleClientName ?? '').trim()
    const btName = String(body.btName ?? '').trim()
    const startTime = String(body.startTime ?? '').trim()
    const endTime = String(body.endTime ?? '').trim()
    const daysRaw = Array.isArray(body.days) ? body.days : []
    const days = daysRaw.map((d) => Number(d)).filter((d) => !Number.isNaN(d))

    if (!serviceClientId || !scheduleClientName || !btName || !startTime || !endTime) {
      return NextResponse.json(
        { error: 'serviceClientId, scheduleClientName, btName, startTime, endTime required' },
        { status: 400 }
      )
    }
    const denied = await enforceClientScope(user, scope, serviceClientId, request)
    if (denied) return denied

    try {
      const result = await createManualClientSessions({
        serviceClientId,
        scheduleClientName,
        btName,
        days,
        startTime,
        endTime,
        createdByUserId: user.id,
      })
      await logClientAccess({
        userId: user.id,
        serviceClientId,
        action: 'SCHEDULE_CREATE_MANUAL',
        ip,
      })
      return NextResponse.json({ success: true, ...result })
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to create sessions'
      return NextResponse.json({ error: message }, { status: 400 })
    }
  }

  if (action === 'unlink') {
    const name = String(body.scheduleClientName ?? '').trim()
    if (!name) {
      return NextResponse.json({ error: 'scheduleClientName required' }, { status: 400 })
    }
    const count = await manualUnlinkScheduleName(name)
    await logClientAccess({ userId: user.id, action: 'SCHEDULE_UNLINK', ip })
    return NextResponse.json({ success: true, updated: count })
  }

  if (action === 'unlink-client') {
    const serviceClientId = String(body.serviceClientId ?? '').trim()
    if (!serviceClientId) {
      return NextResponse.json({ error: 'serviceClientId required' }, { status: 400 })
    }
    const denied = await enforceClientScope(user, scope, serviceClientId, request)
    if (denied) return denied
    const count = await unlinkServiceClientSchedule(serviceClientId)
    await logClientAccess({
      userId: user.id,
      serviceClientId,
      action: 'SCHEDULE_UNLINK_CLIENT',
      ip,
    })
    return NextResponse.json({ success: true, updated: count })
  }

  return NextResponse.json({ error: 'Unknown action' }, { status: 400 })
}
