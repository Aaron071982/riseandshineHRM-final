import { createHash } from 'crypto'
import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getClientIpFromRequest } from '@/lib/client-ip'
import { requireKioskDevice } from '@/lib/kiosk/auth'

export const dynamic = 'force-dynamic'

function stripDataUrlPrefix(raw: string): string {
  const trimmed = raw.trim()
  const comma = trimmed.indexOf(',')
  if (trimmed.startsWith('data:') && comma !== -1) {
    return trimmed.slice(comma + 1)
  }
  return trimmed
}

export async function POST(request: NextRequest) {
  const auth = await requireKioskDevice(request)
  if (auth.response) return auth.response
  const { device } = auth

  let body: Record<string, unknown>
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 })
  }

  const serviceClientId =
    typeof body.serviceClientId === 'string' ? body.serviceClientId.trim() : ''
  const eventType =
    typeof body.eventType === 'string' ? body.eventType.trim().toUpperCase() : ''
  const signedByName =
    typeof body.signedByName === 'string' ? body.signedByName.trim() : ''
  const signedByRelationship =
    typeof body.signedByRelationship === 'string'
      ? body.signedByRelationship.trim()
      : ''
  const signatureHash =
    typeof body.signatureHash === 'string' ? body.signatureHash.trim() : ''
  const signaturePngBase64Raw =
    typeof body.signaturePngBase64 === 'string' ? body.signaturePngBase64 : ''

  let scheduleAssignmentId: string | null = null
  if (body.scheduleAssignmentId != null && body.scheduleAssignmentId !== '') {
    if (typeof body.scheduleAssignmentId !== 'string') {
      return NextResponse.json(
        { error: 'scheduleAssignmentId must be a string or null' },
        { status: 400 }
      )
    }
    scheduleAssignmentId = body.scheduleAssignmentId.trim() || null
  }

  const capturedAtRaw =
    body.capturedAt == null || body.capturedAt === ''
      ? null
      : typeof body.capturedAt === 'string'
        ? body.capturedAt
        : null

  if (
    !serviceClientId ||
    (eventType !== 'IN' && eventType !== 'OUT') ||
    !signedByName ||
    !signedByRelationship ||
    !signatureHash ||
    !signaturePngBase64Raw
  ) {
    return NextResponse.json(
      {
        error:
          'serviceClientId, eventType (IN|OUT), signedByName, signedByRelationship, signatureHash, and signaturePngBase64 are required',
      },
      { status: 400 }
    )
  }

  const client = await prisma.serviceClient.findFirst({
    where: {
      id: serviceClientId,
      isCenterClient: true,
      pipelineStatus: 'LIVE',
      deletedAt: null,
    },
    select: { id: true },
  })
  if (!client) {
    return NextResponse.json(
      { error: 'Client not found or not eligible for center check-in' },
      { status: 404 }
    )
  }

  const signatureImageData = stripDataUrlPrefix(signaturePngBase64Raw)
  let pngBytes: Buffer
  try {
    pngBytes = Buffer.from(signatureImageData, 'base64')
    if (pngBytes.length === 0) throw new Error('empty')
  } catch {
    return NextResponse.json(
      { error: 'Invalid signaturePngBase64' },
      { status: 400 }
    )
  }

  const computedHash = createHash('sha256').update(pngBytes).digest('hex')
  if (computedHash.toLowerCase() !== signatureHash.toLowerCase()) {
    return NextResponse.json(
      { error: 'signatureHash does not match signature bytes' },
      { status: 400 }
    )
  }

  let capturedAt: Date | null = null
  if (capturedAtRaw) {
    const d = new Date(capturedAtRaw)
    if (Number.isNaN(d.getTime())) {
      return NextResponse.json(
        { error: 'capturedAt must be a valid ISO datetime' },
        { status: 400 }
      )
    }
    capturedAt = d
  }

  if (scheduleAssignmentId) {
    const slot = await prisma.rbtScheduleAssignment.findFirst({
      where: {
        id: scheduleAssignmentId,
        serviceClientId,
        deletedAt: null,
      },
      select: { id: true },
    })
    if (!slot) {
      return NextResponse.json(
        { error: 'scheduleAssignmentId not found for this client' },
        { status: 400 }
      )
    }
  }

  const event = await prisma.clientAttendanceEvent.create({
    data: {
      serviceClientId,
      scheduleAssignmentId,
      eventType,
      eventAt: new Date(),
      capturedAt,
      signedByName,
      signedByRelationship,
      signatureImageData,
      signatureHash: computedHash,
      signatureConsentGiven: true,
      signatureIpAddress: getClientIpFromRequest(request),
      signatureUserAgent: request.headers.get('user-agent'),
      kioskDeviceId: device.id,
      locationLabel: device.locationLabel,
    },
    select: {
      id: true,
      serviceClientId: true,
      scheduleAssignmentId: true,
      eventType: true,
      eventAt: true,
      capturedAt: true,
      signedByName: true,
      signedByRelationship: true,
      signatureHash: true,
      signatureConsentGiven: true,
      locationLabel: true,
      kioskDeviceId: true,
      createdAt: true,
    },
  })

  return NextResponse.json({ event }, { status: 201 })
}
