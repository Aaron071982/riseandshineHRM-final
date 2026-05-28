import { NextRequest, NextResponse } from 'next/server'
import { RBTStatus } from '@prisma/client'
import { requireAdminSession } from '@/lib/auth'
import { runRbtProximitySearch } from '@/lib/scheduling-beta/proximitySearch'

const DEFAULT_LIMIT = 6

export const maxDuration = 60

export async function POST(req: NextRequest) {
  try {
    const auth = await requireAdminSession()
    if (auth.response) return auth.response

    const body = await req.json().catch(() => ({}))
    const clientAddress = typeof body.clientAddress === 'string' ? body.clientAddress.trim() : ''
    const clientCity = typeof body.clientCity === 'string' ? body.clientCity.trim() : ''
    const clientState = typeof body.clientState === 'string' ? body.clientState.trim() : ''
    const clientZip = typeof body.clientZip === 'string' ? body.clientZip.trim() : ''
    const limit = Math.min(10, Math.max(1, Number(body.limit) || DEFAULT_LIMIT))

    /** Include all pipeline stages except rejected candidates. */
    const result = await runRbtProximitySearch({
      clientAddress,
      clientCity,
      clientState,
      clientZip,
      limit,
      rbtWhere: { status: { not: RBTStatus.REJECTED } },
    })

    if ('error' in result && result.error) {
      return NextResponse.json(
        { error: result.error, code: result.code },
        { status: result.status }
      )
    }

    return NextResponse.json(result)
  } catch (e) {
    console.error('[proximity]', e)
    return NextResponse.json({ error: 'Failed to find nearest RBTs' }, { status: 500 })
  }
}
