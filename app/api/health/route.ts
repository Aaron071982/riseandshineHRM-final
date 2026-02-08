import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

/**
 * GET /api/health
 * Database health check for monitoring and uptime.
 * Returns 200 when DB is reachable, 503 when not.
 */
export async function GET() {
  const timestamp = new Date().toISOString()
  try {
    await prisma.$queryRaw`SELECT 1`
    return NextResponse.json(
      { ok: true, db: 'connected', timestamp },
      { status: 200 }
    )
  } catch (error) {
    console.error('[health] Database check failed:', error)
    return NextResponse.json(
      {
        ok: false,
        db: 'error',
        message: 'Database unreachable',
        timestamp,
      },
      { status: 503 }
    )
  }
}
