import { NextResponse } from 'next/server'
import { requireScheduleSession } from '@/lib/schedule/access'
import { loadRbtMatchCandidates } from '@/lib/billing/payRate'

export const dynamic = 'force-dynamic'

/** RBT profiles for schedule import matching dropdowns. */
export async function GET() {
  const auth = await requireScheduleSession()
  if (auth.response) return auth.response

  const candidates = await loadRbtMatchCandidates()
  return NextResponse.json({
    candidates: candidates.map((c) => ({
      id: c.id,
      firstName: c.firstName,
      lastName: c.lastName,
      artemisProviderName: c.artemisProviderName,
    })),
  })
}
