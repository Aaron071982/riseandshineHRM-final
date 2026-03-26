import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { requireAdminSession } from '@/lib/auth'

export const dynamic = 'force-dynamic'

type ExclusionRow = {
  id: string
  rbtProfileId: string
  excludedByUserId: string
  reason: string | null
  expiresAt: Date | null
  createdAt: Date
  updatedAt: Date
  rbtFirstName: string | null
  rbtLastName: string | null
  excludedByName: string | null
  excludedByEmail: string | null
}

export async function GET(request: NextRequest) {
  const auth = await requireAdminSession()
  if (auth.response) return auth.response
  const rbtProfileId = request.nextUrl.searchParams.get('rbtProfileId')

  const rows = await prisma.$queryRaw<ExclusionRow[]>`
    SELECT
      se.id,
      se."rbtProfileId",
      se."excludedByUserId",
      se.reason,
      se."expiresAt",
      se."createdAt",
      se."updatedAt",
      rp."firstName" AS "rbtFirstName",
      rp."lastName"  AS "rbtLastName",
      u.name         AS "excludedByName",
      u.email        AS "excludedByEmail"
    FROM scheduling_exclusions se
    LEFT JOIN rbt_profiles rp ON rp.id = se."rbtProfileId"
    LEFT JOIN users u ON u.id = se."excludedByUserId"
    WHERE (${rbtProfileId}::text IS NULL OR se."rbtProfileId" = ${rbtProfileId})
    ORDER BY se."createdAt" DESC
  `

  return NextResponse.json({
    exclusions: rows.map((row) => ({
      id: row.id,
      rbtProfileId: row.rbtProfileId,
      reason: row.reason,
      expiresAt: row.expiresAt ? row.expiresAt.toISOString() : null,
      createdAt: row.createdAt.toISOString(),
      updatedAt: row.updatedAt.toISOString(),
      rbtProfile: {
        id: row.rbtProfileId,
        firstName: row.rbtFirstName ?? 'Unknown',
        lastName: row.rbtLastName ?? '',
      },
      excludedBy: {
        id: row.excludedByUserId,
        name: row.excludedByName,
        email: row.excludedByEmail,
      },
      active: !row.expiresAt || row.expiresAt > new Date(),
    })),
  })
}

export async function POST(request: NextRequest) {
  const auth = await requireAdminSession()
  if (auth.response) return auth.response

  const body = await request.json().catch(() => ({}))
  const rbtProfileId = typeof body.rbtProfileId === 'string' ? body.rbtProfileId : ''
  const reason = typeof body.reason === 'string' ? body.reason.trim() : null
  const expiresAt = body.expiresAt ? new Date(body.expiresAt as string) : null

  if (!rbtProfileId) {
    return NextResponse.json({ error: 'rbtProfileId is required' }, { status: 400 })
  }
  if (expiresAt && Number.isNaN(expiresAt.getTime())) {
    return NextResponse.json({ error: 'Invalid expiresAt' }, { status: 400 })
  }

  const id = `se_${Date.now()}_${Math.random().toString(36).slice(2, 10)}`

  // Keep exactly one exclusion row per RBT (fully reversible state, no history table).
  await prisma.$executeRaw`
    DELETE FROM scheduling_exclusions
    WHERE "rbtProfileId" = ${rbtProfileId}
  `

  await prisma.$executeRaw`
    INSERT INTO scheduling_exclusions
      ("id", "rbtProfileId", "excludedByUserId", "reason", "expiresAt", "createdAt", "updatedAt")
    VALUES
      (${id}, ${rbtProfileId}, ${auth.user.id}, ${reason}, ${expiresAt}, NOW(), NOW())
  `

  const [row] = await prisma.$queryRaw<ExclusionRow[]>`
    SELECT
      se.id,
      se."rbtProfileId",
      se."excludedByUserId",
      se.reason,
      se."expiresAt",
      se."createdAt",
      se."updatedAt",
      rp."firstName" AS "rbtFirstName",
      rp."lastName"  AS "rbtLastName",
      u.name         AS "excludedByName",
      u.email        AS "excludedByEmail"
    FROM scheduling_exclusions se
    LEFT JOIN rbt_profiles rp ON rp.id = se."rbtProfileId"
    LEFT JOIN users u ON u.id = se."excludedByUserId"
    WHERE se.id = ${id}
    LIMIT 1
  `

  return NextResponse.json({
    exclusion: row
      ? {
          id: row.id,
          rbtProfileId: row.rbtProfileId,
          reason: row.reason,
          expiresAt: row.expiresAt ? row.expiresAt.toISOString() : null,
          createdAt: row.createdAt.toISOString(),
          updatedAt: row.updatedAt.toISOString(),
          rbtProfile: {
            id: row.rbtProfileId,
            firstName: row.rbtFirstName ?? 'Unknown',
            lastName: row.rbtLastName ?? '',
          },
          excludedBy: {
            id: row.excludedByUserId,
            name: row.excludedByName,
            email: row.excludedByEmail,
          },
          active: !row.expiresAt || row.expiresAt > new Date(),
        }
      : null,
  })
}
