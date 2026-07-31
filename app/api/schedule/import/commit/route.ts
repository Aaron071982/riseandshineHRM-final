import { NextRequest, NextResponse } from 'next/server'
import { requireScheduleSession } from '@/lib/schedule/access'
import { commitScheduleImport } from '@/lib/schedule-import/persist'
import type { ScheduleDeriveResult } from '@/lib/schedule-import/deriveWeekly'

export const dynamic = 'force-dynamic'

function parseDate(s: string): Date | null {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(s.trim())
  if (!m) return null
  return new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]))
}

/** Commit a schedule import for a biweekly period. */
export async function POST(request: NextRequest) {
  const auth = await requireScheduleSession()
  if (auth.response) return auth.response
  const user = auth.user!

  const body = await request.json()
  const fileName = typeof body.fileName === 'string' ? body.fileName : 'upload.xlsx'
  const mode = body.mode === 'MERGE' ? 'MERGE' : 'REPLACE'
  const periodStart = typeof body.periodStart === 'string' ? parseDate(body.periodStart) : null
  const periodEnd = typeof body.periodEnd === 'string' ? parseDate(body.periodEnd) : null
  if (!periodStart || !periodEnd) {
    return NextResponse.json({ error: 'periodStart and periodEnd (YYYY-MM-DD) required' }, { status: 400 })
  }
  if (periodEnd < periodStart) {
    return NextResponse.json({ error: 'periodEnd must be on or after periodStart' }, { status: 400 })
  }

  const confirmedMatches =
    body.confirmedMatches && typeof body.confirmedMatches === 'object'
      ? (body.confirmedMatches as Record<string, string>)
      : {}
  const clientBoroughs =
    body.clientBoroughs && typeof body.clientBoroughs === 'object'
      ? (body.clientBoroughs as Record<string, string>)
      : {}
  const derived = body.derived as ScheduleDeriveResult | undefined
  if (!derived?.providers) {
    return NextResponse.json({ error: 'derived schedule payload required' }, { status: 400 })
  }

  // Rehydrate dates on derived (JSON lost Date objects)
  if (derived.detectedDateRange) {
    derived.detectedDateRange.min = derived.detectedDateRange.min
      ? new Date(derived.detectedDateRange.min)
      : null
    derived.detectedDateRange.max = derived.detectedDateRange.max
      ? new Date(derived.detectedDateRange.max)
      : null
  }

  try {
    const result = await commitScheduleImport({
      fileName,
      periodStart,
      periodEnd,
      mode,
      confirmedMatches,
      clientBoroughs,
      derived,
      importedById: user.id,
    })
    return NextResponse.json({ ok: true, ...result })
  } catch (err) {
    console.error('[schedule/import/commit]', err)
    const message = err instanceof Error ? err.message : 'Import failed'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
