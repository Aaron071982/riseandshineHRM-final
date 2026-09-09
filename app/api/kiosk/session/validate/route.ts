import { NextRequest, NextResponse } from 'next/server'
import { requireKioskDevice } from '@/lib/kiosk/auth'

export const dynamic = 'force-dynamic'

/** Validate kiosk bearer token and return device metadata. */
export async function POST(request: NextRequest) {
  const auth = await requireKioskDevice(request)
  if (auth.response) return auth.response

  return NextResponse.json({
    device: {
      id: auth.device.id,
      label: auth.device.label,
      locationLabel: auth.device.locationLabel,
    },
  })
}
