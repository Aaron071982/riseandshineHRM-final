import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

/**
 * Diagnostic: check if the app's DB connection can see rbt_profiles and users.
 * Open /api/debug/db-counts in the browser (while logged in or on same origin).
 * If rawCount > 0 but prismaOk is false, the schema/columns don't match (run migration).
 */
export async function GET() {
  try {
    const raw = await prisma.$queryRaw<[{ count: bigint }]>`
      SELECT COUNT(*) as count FROM rbt_profiles
    `
    const rawCount = Number(raw[0]?.count ?? 0)

    let prismaOk = false
    let prismaError: string | null = null
    try {
      await prisma.rBTProfile.findMany({ take: 1, include: { user: true } })
      prismaOk = true
    } catch (e) {
      prismaError = e instanceof Error ? e.message : String(e)
    }

    return NextResponse.json({
      rbt_profiles_raw_count: rawCount,
      prisma_query_ok: prismaOk,
      prisma_error: prismaError,
      hint: rawCount > 0 && !prismaOk
        ? 'Data is in DB but Prisma query failed. Run full prisma/supabase-migrations.sql (sections 4 and 5) in this Supabase project.'
        : rawCount === 0
        ? 'No rows in rbt_profiles. Confirm DATABASE_URL points to the Supabase project where you see data.'
        : 'OK',
    })
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error)
    return NextResponse.json(
      { error: message, hint: 'Check DATABASE_URL and that the database is reachable.' },
      { status: 500 }
    )
  }
}
