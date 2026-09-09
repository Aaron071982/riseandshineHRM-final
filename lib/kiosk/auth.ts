import { createHash } from 'crypto'
import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

export type KioskDeviceInfo = {
  id: string
  label: string
  locationLabel: string
}

export function hashKioskToken(token: string): string {
  return createHash('sha256').update(token, 'utf8').digest('hex')
}

/**
 * Authenticate a kiosk device via `Authorization: Bearer <token>`.
 * Token plaintext is never stored; only sha256(token) is matched.
 */
export async function requireKioskDevice(
  request: NextRequest
): Promise<
  | { device: KioskDeviceInfo; response?: never }
  | { device?: never; response: NextResponse }
> {
  const header = request.headers.get('authorization') ?? ''
  const match = /^Bearer\s+(.+)$/i.exec(header.trim())
  const token = match?.[1]?.trim()
  if (!token) {
    return {
      response: NextResponse.json({ error: 'Unauthorized' }, { status: 401 }),
    }
  }

  const tokenHash = hashKioskToken(token)
  const device = await prisma.kioskDevice.findFirst({
    where: { tokenHash, isActive: true },
    select: { id: true, label: true, locationLabel: true },
  })

  if (!device) {
    return {
      response: NextResponse.json({ error: 'Unauthorized' }, { status: 401 }),
    }
  }

  return { device }
}
