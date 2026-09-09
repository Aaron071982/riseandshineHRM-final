import { randomBytes } from 'crypto'
import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { requireClientServicesSession } from '@/lib/client-services/access'
import { isFullAccess } from '@/lib/crm/access'
import { getClientIpFromRequest } from '@/lib/client-ip'
import { logClientAccess } from '@/lib/client-services/audit'
import { hashKioskToken } from '@/lib/kiosk/auth'

export const dynamic = 'force-dynamic'

/** List provisioned kiosk devices (no token plaintext). */
export async function GET(request: NextRequest) {
  const auth = await requireClientServicesSession()
  if (auth.response) return auth.response
  const { user } = auth

  if (!isFullAccess(user)) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const devices = await prisma.kioskDevice.findMany({
    select: {
      id: true,
      label: true,
      locationLabel: true,
      tokenLast4: true,
      isActive: true,
      createdAt: true,
    },
    orderBy: [{ isActive: 'desc' }, { createdAt: 'desc' }],
  })

  await logClientAccess({
    userId: user.id,
    action: 'KIOSK_DEVICES_LIST',
    ip: getClientIpFromRequest(request),
  })

  return NextResponse.json({ devices })
}

/**
 * Provision a new kiosk device.
 * Returns plaintext `token` once — store it on the iPad; only hash is persisted.
 */
export async function POST(request: NextRequest) {
  const auth = await requireClientServicesSession()
  if (auth.response) return auth.response
  const { user } = auth

  if (!isFullAccess(user)) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  let body: Record<string, unknown>
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 })
  }

  const label = typeof body.label === 'string' ? body.label.trim() : ''
  const locationLabel =
    typeof body.locationLabel === 'string' ? body.locationLabel.trim() : ''

  if (!label || !locationLabel) {
    return NextResponse.json(
      { error: 'label and locationLabel are required' },
      { status: 400 }
    )
  }

  const token = randomBytes(32).toString('base64url')
  const tokenHash = hashKioskToken(token)
  const tokenLast4 = token.slice(-4)

  const device = await prisma.kioskDevice.create({
    data: {
      label,
      locationLabel,
      tokenHash,
      tokenLast4,
      isActive: true,
    },
    select: {
      id: true,
      label: true,
      locationLabel: true,
      tokenLast4: true,
      isActive: true,
      createdAt: true,
    },
  })

  await logClientAccess({
    userId: user.id,
    action: 'KIOSK_DEVICE_CREATE',
    ip: getClientIpFromRequest(request),
  })

  return NextResponse.json({ device, token }, { status: 201 })
}
