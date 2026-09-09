import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { requireKioskDevice } from '@/lib/kiosk/auth'
import { easternTodayRangeUtc } from '@/lib/kiosk/today'

export const dynamic = 'force-dynamic'

/** Today's attendance events at this device's location (includes voided). */
export async function GET(request: NextRequest) {
  const auth = await requireKioskDevice(request)
  if (auth.response) return auth.response
  const { device } = auth

  const { start, end } = easternTodayRangeUtc()

  const events = await prisma.clientAttendanceEvent.findMany({
    where: {
      locationLabel: device.locationLabel,
      eventAt: { gte: start, lt: end },
    },
    orderBy: { eventAt: 'desc' },
    select: {
      id: true,
      serviceClientId: true,
      scheduleAssignmentId: true,
      eventType: true,
      eventAt: true,
      capturedAt: true,
      signedByName: true,
      signedByRelationship: true,
      locationLabel: true,
      kioskDeviceId: true,
      voidedAt: true,
      voidedByUserId: true,
      voidReason: true,
      createdAt: true,
      serviceClient: {
        select: {
          firstName: true,
          lastName: true,
          parentName: true,
        },
      },
    },
  })

  return NextResponse.json({
    locationLabel: device.locationLabel,
    events: events.map((e) => ({
      id: e.id,
      serviceClientId: e.serviceClientId,
      scheduleAssignmentId: e.scheduleAssignmentId,
      eventType: e.eventType,
      eventAt: e.eventAt,
      capturedAt: e.capturedAt,
      signedByName: e.signedByName,
      signedByRelationship: e.signedByRelationship,
      locationLabel: e.locationLabel,
      kioskDeviceId: e.kioskDeviceId,
      voidedAt: e.voidedAt,
      voidedByUserId: e.voidedByUserId,
      voidReason: e.voidReason,
      createdAt: e.createdAt,
      clientFirstName: e.serviceClient.firstName,
      clientLastName: e.serviceClient.lastName,
      parentName: e.serviceClient.parentName,
    })),
  })
}
